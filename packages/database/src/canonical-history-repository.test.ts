import { ulid } from 'ulid';

import { FixedClock } from '@life-assistant/kernel';
import { describe, expect, it } from 'vitest';

import { ActionRepository } from './action-repository.js';
import { CanonicalHistoryRepository } from './canonical-history-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import { createUserOperationContext } from './operation-context.js';
import { SharedRepository } from './shared-repository.js';
import { SqliteDatabase } from './sqlite-database.js';
import { LifeRepository } from './life-repository.js';
import { WorkRepository } from './work-repository.js';

const clock = new FixedClock(new Date('2026-08-31T01:00:00.000Z'));

const setup = () => {
  const database = new SqliteDatabase(':memory:', clock);
  database.migrate();
  const consistency = new ConsistencyRepository(database, clock);
  const history = new CanonicalHistoryRepository(database, clock, consistency);
  const actions = new ActionRepository(database, clock, consistency);
  const work = new WorkRepository(database, clock, consistency);
  const life = new LifeRepository(database, clock, consistency);
  const shared = new SharedRepository(database, clock);
  shared.seedDefaults();
  const category = shared.listCategories().find((item) => item.parentArea === 'WORK');
  if (category === undefined) throw new Error('测试缺少工作分类。');
  return { database, consistency, history, actions, work, life, shared, category };
};

const user = (requestId: string) => createUserOperationContext({ requestId });

const categoryFor = (shared: SharedRepository, moduleType: string) => {
  const category = shared.listCategories().find((item) => item.moduleType === moduleType);
  if (category === undefined) throw new Error(`测试缺少 ${moduleType} 分类。`);
  return category;
};

describe('canonical history and restore', () => {
  it('rejects an unverified legacy task version instead of reconstructing request patches', () => {
    const { database, history, actions, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: 'Legacy task',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-01T08:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });

    expect(history.versions(task.id)[0]).toMatchObject({
      historyKind: 'AUDIT_ONLY',
      restoreEligibility: 'UNVERIFIED',
    });
    expect(() =>
      history.restoreVersion({
        entityId: task.id,
        targetVersion: 1,
        expectedVersion: 1,
        context: createUserOperationContext({ requestId: 'legacy-restore' }),
      }),
    ).toThrow('ENTITY_VERSION_UNVERIFIED');
    database.close();
  });

  it('restores a trusted task baseline as a new canonical version without replaying schedule blocks', () => {
    const { database, history, actions, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: 'Baseline title',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-01T08:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const updated = actions.updateTaskWithContext(
      task.id,
      task.version,
      { title: 'Canonical title' },
      createUserOperationContext({ requestId: 'task-update' }),
    );
    const oldScheduleBlockId = '01K3ZQ0J5M0000000000000000';
    database.raw
      .prepare(
        `INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'SCHEDULE_BLOCK',?,?)`,
      )
      .run(oldScheduleBlockId, clock.now().getTime(), clock.now().getTime());
    database.raw
      .prepare(
        `INSERT INTO schedule_blocks(id,target_entity_id,block_type,area,start_at,end_at,source)
         VALUES (?,?,'TASK','WORK',?,?,'MANUAL')`,
      )
      .run(
        oldScheduleBlockId,
        task.id,
        Date.parse('2026-09-01T08:00:00.000Z'),
        Date.parse('2026-09-01T08:30:00.000Z'),
      );
    database.raw.prepare('DELETE FROM entity_index WHERE id=?').run(oldScheduleBlockId);

    const restored = history.restoreVersion({
      entityId: task.id,
      targetVersion: 1,
      expectedVersion: updated.version,
      context: createUserOperationContext({ requestId: 'task-restore' }),
    });

    expect(restored.entityVersion).toBe(3);
    expect(typeof restored.changeSetId).toBe('string');
    expect(actions.getTask(task.id)).toMatchObject({ title: 'Baseline title', version: 3 });
    expect(
      database.raw.prepare('SELECT id FROM schedule_blocks WHERE id=?').get(oldScheduleBlockId),
    ).toBeUndefined();
    expect(history.versions(task.id).map((item) => item.historyKind)).toEqual([
      'CANONICAL',
      'CANONICAL',
      'BASELINE',
    ]);
    history.restoreVersion({
      entityId: task.id,
      targetVersion: 2,
      expectedVersion: 3,
      context: user('task-redo-canonical'),
    });
    expect(actions.getTask(task.id)).toMatchObject({ title: 'Canonical title', version: 4 });
    history.restoreVersion({
      entityId: task.id,
      targetVersion: 1,
      expectedVersion: 4,
      context: user('task-roundtrip-baseline'),
    });
    expect(actions.getTask(task.id)).toMatchObject({ title: 'Baseline title', version: 5 });
    expect(history.versions(task.id).map((item) => item.entityVersion)).toEqual([5, 4, 3, 2, 1]);
    database.close();
  });

  it('creates a SYSTEM baseline at the existing version without a fake business mutation', () => {
    const { database, history, actions, category } = setup();
    const id = ulid();
    const now = clock.now().getTime();
    database.raw
      .prepare(
        "INSERT INTO entity_index(id,entity_type,version,created_at,updated_at) VALUES (?,'TASK',1,?,?)",
      )
      .run(id, now, now);
    database.raw
      .prepare(
        `INSERT INTO tasks(id,category_id,title,status,priority,due_at,estimated_minutes,is_flexible,is_splittable,preferred_area)
         VALUES (?,?,'无历史基线','TODO','NORMAL',?,30,1,0,'WORK')`,
      )
      .run(id, category.id, Date.parse('2026-09-01T08:00:00.000Z'));

    actions.updateTaskWithContext(id, 1, { title: '首次可信更新' }, user('first-trusted-update'));

    const rows = database.raw
      .prepare(
        'SELECT entity_version,change_set_id,source,actor_ref,patch_json FROM entity_versions WHERE entity_id=? ORDER BY entity_version',
      )
      .all(id) as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      entity_version: 1,
      change_set_id: null,
      source: 'SYSTEM',
      actor_ref: 'system:history-baseline',
    });
    expect(JSON.parse(String(rows[0]?.patch_json))).toMatchObject({ snapshotKind: 'BASELINE' });
    expect(
      (database.raw.prepare('SELECT COUNT(*) count FROM change_sets').get() as { count: number })
        .count,
    ).toBe(1);
    expect(actions.getTask(id)?.version).toBe(2);
    expect(history.versions(id).map((item) => item.entityVersion)).toEqual([2, 1]);
    database.close();
  });

  it('restores every TASK canonical field and owned relation atomically', () => {
    const { database, history, actions, shared, category } = setup();
    const goal = actions.createGoal(
      {
        categoryId: category.id,
        title: '目标',
        goalType: 'OUTCOME',
        startDate: '2026-08-31',
        endDate: '2026-12-31',
      },
      user('goal-create'),
    );
    const plan = actions.createPlan(
      {
        goalId: goal.id,
        categoryId: category.id,
        title: '计划',
        priority: 'HIGH',
        startDate: '2026-08-31',
        endDate: '2026-12-01',
      },
      user('plan-create'),
    );
    const parent = actions.createTask({
      categoryId: category.id,
      title: '父任务',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-02T08:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const predecessor = actions.createTask({
      categoryId: category.id,
      title: '前置任务',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-02T09:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const successor = actions.createTask({
      categoryId: category.id,
      title: '后置任务',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-02T10:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const task = actions.createTask({
      categoryId: category.id,
      goalId: goal.id,
      parentTaskId: parent.id,
      title: '关系基线',
      priority: 'HIGH',
      dueAt: Date.parse('2026-09-03T08:00:00.000Z'),
      estimatedMinutes: 60,
      isFlexible: false,
      isSplittable: true,
      preferredArea: 'WORK',
    });
    const tagId = ulid();
    const reminderId = ulid();
    const attachmentId = ulid();
    const now = clock.now().getTime();
    for (const [id, type] of [
      [tagId, 'TAG'],
      [reminderId, 'REMINDER'],
      [attachmentId, 'ATTACHMENT'],
    ] as const) {
      database.raw
        .prepare('INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)')
        .run(id, type, now, now);
    }
    database.raw
      .prepare("INSERT INTO tags(id,name,color_token) VALUES (?,'历史标签','violet')")
      .run(tagId);
    database.raw
      .prepare('INSERT INTO tag_links(tag_id,entity_id,created_at) VALUES (?,?,?)')
      .run(tagId, task.id, now);
    database.raw
      .prepare(
        `INSERT INTO reminders(id,target_entity_id,trigger_mode,trigger_at,offset_minutes,is_enabled)
         VALUES (?,?,'OFFSET_BEFORE_DUE',NULL,30,1)`,
      )
      .run(reminderId, task.id);
    database.raw
      .prepare(
        `INSERT INTO attachments(id,original_name,safe_name,media_type,extension,size_bytes,sha256,storage_key,status)
         VALUES (?,'proof.txt','proof.txt','text/plain','txt',5,?,'attachments/proof.txt','READY')`,
      )
      .run(attachmentId, 'a'.repeat(64));
    database.raw
      .prepare(
        "INSERT INTO attachment_links(attachment_id,entity_id,role,created_at) VALUES (?,?,'DOCUMENT',?)",
      )
      .run(attachmentId, task.id, now);
    database.raw
      .prepare(
        "INSERT INTO task_dependencies(predecessor_task_id,successor_task_id,dependency_type,created_at) VALUES (?,?,'FINISH_TO_START',?)",
      )
      .run(predecessor.id, task.id, now);
    database.raw
      .prepare(
        "INSERT INTO task_dependencies(predecessor_task_id,successor_task_id,dependency_type,created_at) VALUES (?,?,'FINISH_TO_START',?)",
      )
      .run(task.id, successor.id, now);

    const canonical = actions.updateTaskWithContext(
      task.id,
      task.version,
      { title: '关系版本' },
      user('task-relations-baseline'),
    );
    database.raw
      .prepare('DELETE FROM task_dependencies WHERE predecessor_task_id=? OR successor_task_id=?')
      .run(task.id, task.id);
    database.raw.prepare('DELETE FROM tag_links WHERE entity_id=?').run(task.id);
    database.raw.prepare('DELETE FROM entity_index WHERE id=?').run(reminderId);
    database.raw.prepare('DELETE FROM attachment_links WHERE entity_id=?').run(task.id);
    const changed = actions.updateTaskWithContext(
      task.id,
      canonical.version,
      { title: '关系已清空', priority: 'LOW' },
      user('task-relations-cleared'),
    );

    history.restoreVersion({
      entityId: task.id,
      targetVersion: canonical.version,
      expectedVersion: changed.version,
      context: user('task-relations-restore'),
    });

    expect(actions.getTask(task.id)).toMatchObject({
      title: '关系版本',
      categoryId: category.id,
      goalId: goal.id,
      planId: null,
      parentTaskId: parent.id,
      priority: 'HIGH',
      isFlexible: false,
      isSplittable: true,
      version: 4,
    });
    expect(
      database.raw
        .prepare(
          'SELECT predecessor_task_id predecessor,successor_task_id successor FROM task_dependencies WHERE predecessor_task_id=? OR successor_task_id=? ORDER BY predecessor_task_id',
        )
        .all(task.id, task.id),
    ).toEqual(
      expect.arrayContaining([
        { predecessor: task.id, successor: successor.id },
        { predecessor: predecessor.id, successor: task.id },
      ]),
    );
    expect(
      database.raw.prepare('SELECT tag_id FROM tag_links WHERE entity_id=?').get(task.id),
    ).toEqual({
      tag_id: tagId,
    });
    expect(
      database.raw
        .prepare(
          'SELECT trigger_mode,offset_minutes,is_enabled FROM reminders WHERE target_entity_id=?',
        )
        .get(task.id),
    ).toEqual({ trigger_mode: 'OFFSET_BEFORE_DUE', offset_minutes: 30, is_enabled: 1 });
    expect(
      database.raw
        .prepare('SELECT attachment_id,role FROM attachment_links WHERE entity_id=?')
        .get(task.id),
    ).toEqual({ attachment_id: attachmentId, role: 'DOCUMENT' });
    const alternateCategory = shared
      .listCategories()
      .find((item) => item.parentArea === 'WORK' && item.id !== category.id);
    if (alternateCategory === undefined) throw new Error('测试缺少备用工作分类。');
    const planTask = actions.createTask({
      categoryId: category.id,
      goalId: goal.id,
      planId: plan.id,
      title: '计划关系基线',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-04T08:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const planTaskCanonical = actions.updateTaskWithContext(
      planTask.id,
      planTask.version,
      { title: '计划关系版本' },
      user('plan-task-baseline'),
    );
    database.raw
      .prepare('UPDATE tasks SET category_id=?,plan_id=NULL,goal_id=NULL WHERE id=?')
      .run(alternateCategory.id, planTask.id);
    const planTaskChanged = actions.updateTaskWithContext(
      planTask.id,
      planTaskCanonical.version,
      { title: '计划关系清空' },
      user('plan-task-cleared'),
    );
    history.restoreVersion({
      entityId: planTask.id,
      targetVersion: planTaskCanonical.version,
      expectedVersion: planTaskChanged.version,
      context: user('plan-task-restore'),
    });
    expect(actions.getTask(planTask.id)).toMatchObject({
      categoryId: category.id,
      goalId: goal.id,
      planId: plan.id,
      title: '计划关系版本',
      version: 4,
    });
    expect(database.raw.pragma('foreign_key_check')).toEqual([]);
    expect(database.raw.pragma('integrity_check', { simple: true })).toBe('ok');
    database.close();
  });

  it('restores plan milestone fields and task links as owned canonical relations', () => {
    const { database, history, actions, category } = setup();
    const plan = actions.createPlan({
      categoryId: category.id,
      title: '通用里程碑计划',
      priority: 'HIGH',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
    });
    const createTask = (title: string) =>
      actions.createTask({
        categoryId: category.id,
        planId: plan.id,
        title,
        priority: 'NORMAL',
        dueAt: Date.parse('2026-09-20T08:00:00.000Z'),
        estimatedMinutes: 30,
        isFlexible: true,
        preferredArea: 'WORK',
      });
    const firstTask = createTask('首项任务');
    const secondTask = createTask('次项任务');
    const milestone = actions.createPlanMilestone(
      plan.id,
      {
        title: '基线里程碑',
        dueAt: Date.parse('2026-09-30T08:00:00.000Z'),
        linkedEntityIds: [firstTask.id, secondTask.id],
      },
      user('milestone-create'),
    );
    const baselineVersion = actions.listPlans().find((item) => item.id === plan.id)?.version;
    expect(baselineVersion).toBe(2);
    actions.updatePlanMilestone(
      milestone.id,
      milestone.version,
      { title: '变更里程碑', linkedEntityIds: [secondTask.id] },
      user('milestone-update'),
    );
    const changedVersion = actions.listPlans().find((item) => item.id === plan.id)?.version;
    expect(changedVersion).toBe(3);
    if (baselineVersion === undefined || changedVersion === undefined)
      throw new Error('测试缺少计划版本。');

    history.restoreVersion({
      entityId: plan.id,
      targetVersion: baselineVersion,
      expectedVersion: changedVersion,
      context: user('milestone-restore'),
    });
    expect(actions.listPlanMilestones(plan.id)[0]).toMatchObject({
      title: '基线里程碑',
      linkedEntityIds: [firstTask.id, secondTask.id].sort(),
    });
    expect(database.raw.pragma('foreign_key_check')).toEqual([]);
    database.close();
  });

  it('reports deleted task references and permanently removed attachments as restore conflicts', () => {
    const { database, history, actions, category } = setup();
    const parent = actions.createTask({
      categoryId: category.id,
      title: '将被删除的父任务',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-02T08:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const task = actions.createTask({
      categoryId: category.id,
      parentTaskId: parent.id,
      title: '冲突基线',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-03T08:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const attachmentId = ulid();
    const predecessor = actions.createTask({
      categoryId: category.id,
      title: '将被删除的依赖',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-09-02T09:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const tagId = ulid();
    const now = clock.now().getTime();
    for (const [id, type] of [
      [attachmentId, 'ATTACHMENT'],
      [tagId, 'TAG'],
    ] as const)
      database.raw
        .prepare('INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)')
        .run(id, type, now, now);
    database.raw
      .prepare(
        `INSERT INTO attachments(id,original_name,safe_name,media_type,size_bytes,sha256,storage_key,status)
         VALUES (?,'gone.txt','gone.txt','text/plain',1,?,'attachments/gone.txt','READY')`,
      )
      .run(attachmentId, 'b'.repeat(64));
    database.raw
      .prepare(
        "INSERT INTO attachment_links(attachment_id,entity_id,role,created_at) VALUES (?,?,'GENERAL',?)",
      )
      .run(attachmentId, task.id, now);
    database.raw.prepare("INSERT INTO tags(id,name) VALUES (?,'将被删除的标签')").run(tagId);
    database.raw
      .prepare('INSERT INTO tag_links(tag_id,entity_id,created_at) VALUES (?,?,?)')
      .run(tagId, task.id, now);
    database.raw
      .prepare(
        "INSERT INTO task_dependencies(predecessor_task_id,successor_task_id,dependency_type,created_at) VALUES (?,?,'FINISH_TO_START',?)",
      )
      .run(predecessor.id, task.id, now);
    const canonical = actions.updateTaskWithContext(
      task.id,
      task.version,
      { title: '可信冲突目标' },
      user('conflict-baseline'),
    );
    database.raw
      .prepare('UPDATE entity_index SET deleted_at=?,purge_after=? WHERE id=?')
      .run(now, now + 30 * 86_400_000, parent.id);
    database.raw
      .prepare('UPDATE entity_index SET deleted_at=?,purge_after=? WHERE id=?')
      .run(now, now + 30 * 86_400_000, predecessor.id);
    database.raw.prepare('DELETE FROM entity_index WHERE id=?').run(attachmentId);
    database.raw.prepare('DELETE FROM entity_index WHERE id=?').run(tagId);
    database.raw
      .prepare('UPDATE categories SET is_archived=1,archived_at=? WHERE id=?')
      .run(now, category.id);
    const changed = actions.updateTaskWithContext(
      task.id,
      canonical.version,
      { title: '当前安全状态' },
      user('conflict-current'),
    );

    const preview = history.previewRestore(task.id, canonical.version, changed.version);
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        { code: 'PARENT_TASK_UNAVAILABLE', referenceId: parent.id },
        { code: 'DEPENDENCY_TASK_UNAVAILABLE', referenceId: predecessor.id },
        { code: 'TAG_UNAVAILABLE', referenceId: tagId },
        { code: 'ATTACHMENT_UNAVAILABLE', referenceId: attachmentId },
        { code: 'CATEGORY_UNAVAILABLE', referenceId: category.id },
      ]),
    );
    expect(() =>
      history.restoreVersion({
        entityId: task.id,
        targetVersion: canonical.version,
        expectedVersion: changed.version,
        context: user('conflict-restore'),
      }),
    ).toThrow(/RESTORE_CONFLICT/);
    expect(actions.getTask(task.id)).toMatchObject({ title: '当前安全状态', version: 3 });
    expect(history.versions(task.id)).toHaveLength(3);
    expect(database.raw.pragma('foreign_key_check')).toEqual([]);
    database.close();
  });

  it('supports create-update-restore for GOAL, PLAN, EVENT and NOTE with monotonic USER history', () => {
    const { database, history, actions, work, category } = setup();
    const goal = actions.createGoal(
      {
        categoryId: category.id,
        title: '目标 v1',
        description: '完整目标',
        goalType: 'OUTCOME',
        startDate: '2026-08-31',
        endDate: '2026-12-31',
      },
      user('goal-v1'),
    );
    const goalV2 = actions.updateGoal(goal.id, goal.version, { title: '目标 v2' }, user('goal-v2'));
    const plan = actions.createPlan(
      {
        goalId: goal.id,
        categoryId: category.id,
        title: '计划 v1',
        description: '完整计划',
        priority: 'HIGH',
        startDate: '2026-09-01',
        endDate: '2026-12-01',
      },
      user('plan-v1'),
    );
    const planV2 = actions.updatePlan(plan.id, plan.version, { title: '计划 v2' }, user('plan-v2'));
    const event = actions.createEvent(
      {
        categoryId: category.id,
        title: '日程 v1',
        description: '完整日程',
        startAt: Date.parse('2026-09-05T08:00:00.000Z'),
        endAt: Date.parse('2026-09-05T09:00:00.000Z'),
        eventType: 'GENERAL',
        priority: 'NORMAL',
      },
      user('event-v1'),
    );
    const eventV2 = actions.updateEvent(
      event.id,
      event.version,
      { title: '日程 v2' },
      user('event-v2'),
    );
    const note = work.createNoteForEntity(
      {
        entityId: goal.id,
        categoryId: category.id,
        title: '笔记 v1',
        markdownContent: '完整正文 v1',
        role: 'KNOWLEDGE',
      },
      user('note-v1'),
    );
    const noteV2 = work.updateNote(
      note.id,
      goal.id,
      note.version,
      { title: '笔记 v2', markdownContent: '完整正文 v2' },
      user('note-v2'),
    );
    database.raw
      .prepare('UPDATE goals SET auto_progress=91,display_progress=91 WHERE id=?')
      .run(goal.id);
    database.raw
      .prepare('UPDATE plans SET auto_progress=73,display_progress=73 WHERE id=?')
      .run(plan.id);
    database.raw
      .prepare(
        `INSERT INTO search_documents(entity_id,entity_type,category_id,title,body,keywords,updated_at)
         VALUES (?,'NOTE',?,'stale projection','','',?)`,
      )
      .run(note.id, category.id, clock.now().getTime());
    const eventBlockId = ulid();
    database.raw
      .prepare(
        "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'SCHEDULE_BLOCK',?,?)",
      )
      .run(eventBlockId, clock.now().getTime(), clock.now().getTime());
    database.raw
      .prepare(
        `INSERT INTO schedule_blocks(id,target_entity_id,block_type,area,start_at,end_at,source)
         VALUES (?,?,'EVENT','WORK',?,?,'MANUAL')`,
      )
      .run(
        eventBlockId,
        event.id,
        Date.parse('2026-09-05T08:00:00.000Z'),
        Date.parse('2026-09-05T09:00:00.000Z'),
      );

    for (const [id, expectedVersion] of [
      [goal.id, goalV2.version],
      [plan.id, planV2.version],
      [event.id, eventV2.version],
      [note.id, noteV2.version],
    ] as const) {
      history.restoreVersion({
        entityId: id,
        targetVersion: 1,
        expectedVersion,
        context: user(`restore-${id}`),
      });
      const versions = history.versions(id);
      expect(versions.map((item) => item.entityVersion)).toEqual([3, 2, 1]);
      expect(versions.every((item) => item.source === 'USER')).toBe(true);
      expect(versions.every((item) => item.historyKind === 'CANONICAL')).toBe(true);
    }
    expect(actions.listGoals().find((item) => item.id === goal.id)?.title).toBe('目标 v1');
    expect(actions.listPlans().find((item) => item.id === plan.id)?.title).toBe('计划 v1');
    expect(actions.getEvent(event.id)?.title).toBe('日程 v1');
    expect(work.listNotes(goal.id).find((item) => item.id === note.id)).toMatchObject({
      title: '笔记 v1',
      markdownContent: '完整正文 v1',
      version: 3,
    });
    expect(database.raw.prepare('SELECT auto_progress FROM goals WHERE id=?').get(goal.id)).toEqual(
      {
        auto_progress: 0,
      },
    );
    expect(database.raw.prepare('SELECT auto_progress FROM plans WHERE id=?').get(plan.id)).toEqual(
      {
        auto_progress: 0,
      },
    );
    expect(
      database.raw.prepare('SELECT entity_id FROM search_documents WHERE entity_id=?').get(note.id),
    ).toBeUndefined();
    expect(
      database.raw.prepare('SELECT id FROM schedule_blocks WHERE id=?').get(eventBlockId),
    ).toBeUndefined();
    const operations = database.raw
      .prepare(
        `SELECT operation,before_json,after_json FROM change_operations
         WHERE entity_id IN (?,?,?,?) ORDER BY rowid`,
      )
      .all(goal.id, plan.id, event.id, note.id) as Record<string, unknown>[];
    expect(
      operations.every((item) => item.before_json !== null || item.operation === 'CREATE'),
    ).toBe(true);
    expect(operations.every((item) => item.after_json !== null)).toBe(true);
    database.close();
  });

  it('restores goal metrics and progress entries as owned canonical relations', () => {
    const { database, history, actions, category } = setup();
    const goal = actions.createGoal(
      {
        categoryId: category.id,
        title: '量化目标',
        goalType: 'HABIT',
        startDate: '2026-09-01',
        endDate: '2026-10-01',
      },
      user('metric-goal'),
    );
    const withMetric = actions.createGoalMetric(
      goal.id,
      goal.version,
      {
        name: '累计完成',
        metricType: 'COUNT',
        startValue: 0,
        targetValue: 10,
        direction: 'INCREASE',
        weight: 1,
      },
      user('metric-create'),
    );
    const metric = withMetric.metrics[0];
    if (metric === undefined) throw new Error('测试缺少目标指标。');
    const withEntry = actions.recordGoalProgress(
      goal.id,
      withMetric.goalVersion,
      {
        metricId: metric.id,
        value: 5,
        recordedAt: '2026-09-10T08:00:00.000Z',
        note: '第一阶段',
      },
      user('metric-entry'),
    );
    const changed = actions.updateGoalMetric(
      metric.id,
      withEntry.goalVersion,
      { targetValue: 20 },
      user('metric-update'),
    );
    actions.recordGoalProgress(
      goal.id,
      changed.goalVersion,
      { metricId: metric.id, value: 12, recordedAt: '2026-09-20T08:00:00.000Z' },
      user('metric-entry-2'),
    );

    history.restoreVersion({
      entityId: goal.id,
      targetVersion: withEntry.goalVersion,
      expectedVersion: changed.goalVersion + 1,
      context: user('metric-restore'),
    });
    const state = actions.getGoalMetrics(goal.id);
    expect(state.goalVersion).toBe(changed.goalVersion + 2);
    expect(state.metrics[0]).toMatchObject({
      id: metric.id,
      targetValue: 10,
      latestValue: 5,
      progressPercent: 50,
    });
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({ metricId: metric.id, value: 5, note: '第一阶段' });
    expect(state).toMatchObject({ autoProgress: 50, displayProgress: 50 });
    expect(database.raw.pragma('foreign_key_check')).toEqual([]);
    database.close();
  });

  it('restores the seven PRD module aggregate roots through the same canonical recorder', () => {
    const { database, history, work, life, shared } = setup();
    const selfMediaCategory = categoryFor(shared, 'SELF_MEDIA');
    const devCategory = categoryFor(shared, 'DEVELOPMENT');
    const learningCategory = categoryFor(shared, 'LEARNING');
    const shoppingCategory = categoryFor(shared, 'SHOPPING');
    const dietCategory = categoryFor(shared, 'DIET');
    const fitnessCategory = categoryFor(shared, 'FITNESS');
    const entertainmentCategory = categoryFor(shared, 'ENTERTAINMENT');

    const content = work.createContent(
      {
        categoryId: selfMediaCategory.id,
        title: '内容 v1',
        idea: 'idea',
        script: 'script',
        contentType: 'VIDEO',
        platform: 'local',
        plannedPublishAt: null,
        publishedAt: null,
        calendarEventId: null,
        taskId: null,
      },
      user('content-v1'),
    );
    const contentV2 = work.updateContent(
      content.id,
      content.version,
      { title: '内容 v2' },
      user('content-v2'),
    );
    const project = work.createProject(
      {
        categoryId: devCategory.id,
        name: '项目 v1',
        summary: 'summary',
        startDate: null,
        targetDate: null,
        planId: null,
      },
      user('project-v1'),
    );
    const projectV2 = work.updateProject(
      project.id,
      project.version,
      { name: '项目 v2' },
      user('project-v2'),
    );
    const learning = work.createLearningResource(
      {
        categoryId: learningCategory.id,
        title: '学习 v1',
        resourceType: 'BOOK',
        author: null,
        sourceUrl: null,
        progressTotal: 100,
        progressUnit: '页',
      },
      user('learning-v1'),
    );
    const learningV2 = work.updateLearningResource(
      learning.id,
      learning.version,
      { title: '学习 v2', progressCurrent: 20 },
      user('learning-v2'),
    );
    const shopping = life.createShoppingItem(
      { categoryId: shoppingCategory.id, name: '购物 v1' },
      user('shopping-v1'),
    );
    const shoppingV2 = life.updateShoppingItem(
      shopping.id,
      shopping.version,
      { name: '购物 v2' },
      user('shopping-v2'),
    );
    const recipe = life.createRecipe(
      { categoryId: dietCategory.id, name: '食谱 v1', servings: 2 },
      user('recipe-v1'),
    );
    const recipeV2 = life.updateRecipe(
      recipe.id,
      recipe.version,
      { name: '食谱 v2' },
      user('recipe-v2'),
    );
    const exercise = life.createExercise({
      name: '深蹲',
      exerciseType: 'STRENGTH',
      muscleGroups: ['legs'],
      defaultUnit: 'kg',
      instructions: null,
    });
    const workout = life.createWorkoutPlan(
      {
        categoryId: fitnessCategory.id,
        name: '训练 v1',
        items: [
          {
            exerciseId: exercise.id,
            setsTarget: 3,
            repsTarget: '8',
            weightTarget: null,
            durationSecondsTarget: null,
            distanceTarget: null,
            sortOrder: 0,
          },
        ],
      },
      user('workout-v1'),
    );
    const workoutV2 = life.updateWorkoutPlan(
      workout.id,
      workout.version,
      { name: '训练 v2' },
      user('workout-v2'),
    );
    const entertainment = life.createEntertainmentItem(
      {
        categoryId: entertainmentCategory.id,
        title: '娱乐 v1',
        itemType: 'BOOK',
        listType: 'OTHER',
        progressTotal: 10,
      },
      user('entertainment-v1'),
    );
    const entertainmentV2 = life.setEntertainmentProgress(
      entertainment.id,
      entertainment.version,
      { progressCurrent: 5 },
      user('entertainment-v2'),
    );

    for (const [id, version] of [
      [content.id, contentV2.version],
      [project.id, projectV2.version],
      [learning.id, learningV2.version],
      [shopping.id, shoppingV2.version],
      [recipe.id, recipeV2.version],
      [workout.id, workoutV2.version],
      [entertainment.id, entertainmentV2.version],
    ] as const) {
      history.restoreVersion({
        entityId: id,
        targetVersion: 1,
        expectedVersion: version,
        context: user(`module-restore-${id}`),
      });
      const versions = history.versions(id);
      expect(versions.map((item) => item.entityVersion)).toEqual([3, 2, 1]);
      expect(versions.every((item) => item.source === 'USER')).toBe(true);
      expect(versions.every((item) => item.historyKind === 'CANONICAL')).toBe(true);
    }
    expect(work.getContent(content.id)?.title).toBe('内容 v1');
    expect(work.getProject(project.id)?.name).toBe('项目 v1');
    expect(work.listLearningResources().find((item) => item.id === learning.id)?.title).toBe(
      '学习 v1',
    );
    expect(life.listShoppingItems().find((item) => item.id === shopping.id)?.name).toBe('购物 v1');
    expect(life.listRecipes().find((item) => item.id === recipe.id)?.name).toBe('食谱 v1');
    expect(life.listWorkoutPlans().find((item) => item.id === workout.id)).toMatchObject({
      name: '训练 v1',
      items: [{ exerciseId: exercise.id, setsTarget: 3 }],
    });
    expect(
      life.listEntertainmentItems().find((item) => item.id === entertainment.id),
    ).toMatchObject({
      title: '娱乐 v1',
      progressCurrent: 0,
    });
    expect(database.raw.pragma('foreign_key_check')).toEqual([]);
    expect(database.raw.pragma('integrity_check', { simple: true })).toBe('ok');
    database.close();
  });

  it('rolls back canonical state, owned relations and new history when restore fails mid-transaction', () => {
    const { database, history, life, shared } = setup();
    const category = categoryFor(shared, 'DIET');
    const recipe = life.createRecipe({ categoryId: category.id, name: '事务 v1' }, user('tx-v1'));
    const updated = life.updateRecipe(
      recipe.id,
      recipe.version,
      { name: '事务 v2' },
      user('tx-v2'),
    );
    database.raw.exec(`
      CREATE TRIGGER fail_canonical_restore BEFORE INSERT ON domain_events
      WHEN NEW.event_type='CANONICAL_ENTITY_RESTORED'
      BEGIN SELECT RAISE(ABORT,'DERIVED_REBUILD_FAILED'); END;
    `);

    expect(() =>
      history.restoreVersion({
        entityId: recipe.id,
        targetVersion: 1,
        expectedVersion: updated.version,
        context: user('tx-restore'),
      }),
    ).toThrow('DERIVED_REBUILD_FAILED');
    expect(life.listRecipes().find((item) => item.id === recipe.id)).toMatchObject({
      name: '事务 v2',
      version: 2,
    });
    expect(history.versions(recipe.id).map((item) => item.entityVersion)).toEqual([2, 1]);
    database.close();
  });
});
