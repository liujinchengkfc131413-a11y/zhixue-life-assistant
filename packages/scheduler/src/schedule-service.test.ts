import { describe, expect, it } from 'vitest';

import {
  ActionRepository,
  ConsistencyRepository,
  InformationRepository,
  RoutineRepository,
  SharedRepository,
  SqliteDatabase,
} from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';

import { ScheduleService } from './schedule-service.js';

const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
const DAY = 86_400_000;
const GRID = 900_000;

const setup = () => {
  const database = new SqliteDatabase(':memory:', clock);
  database.migrate();
  const consistency = new ConsistencyRepository(database, clock);
  const actions = new ActionRepository(database, clock, consistency);
  const shared = new SharedRepository(database, clock);
  shared.seedDefaults();
  const routines = new RoutineRepository(database, clock);
  routines.seedDefaults();
  const schedules = new ScheduleService(database, actions, routines, clock);
  const information = new InformationRepository(database, clock, consistency);
  const category = shared.listCategories().find((item) => item.parentArea === 'WORK');
  if (category === undefined) throw new Error('测试缺少工作分类。');
  return { database, actions, information, schedules, category };
};

const now = () => clock.now().getTime();

describe('A5 schedule overdue and history', () => {
  it('releases the schedule blocks of a completed task with a RELEASED reason visible in task history', () => {
    const { database, actions, information, schedules, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: '完成即释放',
      priority: 'NORMAL',
      dueAt: now() + 6 * 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'TASK_CREATED');
    expect(
      database.raw
        .prepare(
          `SELECT COUNT(*) count FROM schedule_blocks block
           JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
           WHERE block.target_entity_id = ?`,
        )
        .get(task.id),
    ).toMatchObject({ count: 1 });

    actions.transitionTask(task.id, task.version, 'COMPLETED', undefined);
    const released = database.raw
      .prepare(
        `SELECT block.id, block.reason_code, block.reason_json, entity.purge_after
         FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as {
      id: string;
      reason_code: string;
      reason_json: string;
      purge_after: number | null;
    };
    expect(released.reason_code).toBe('RELEASED');
    expect(JSON.parse(released.reason_json)).toMatchObject({ reason: 'TASK_COMPLETED' });
    expect(released.purge_after).toBeNull();
    expect(
      information.recycleBin().some((item) => (item as { id: string }).id === released.id),
    ).toBe(false);

    const history = schedules.taskScheduleHistory(task.id);
    expect(history.entries.some((entry) => entry.kind === 'RELEASED')).toBe(true);
    const releasedEntry = history.entries.find((entry) => entry.kind === 'RELEASED');
    expect(releasedEntry?.reason).toBe('TASK_COMPLETED');
    expect(releasedEntry?.previousBlocks).toHaveLength(1);
  });

  it('repairs legacy RELEASED blocks so purge cannot erase canonical schedule history', () => {
    const { database, actions, information, schedules, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: '旧历史保留',
      priority: 'NORMAL',
      dueAt: now() + 8 * 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'TASK_CREATED');
    actions.transitionTask(task.id, task.version, 'COMPLETED', undefined);
    database.raw
      .prepare(
        `UPDATE entity_index SET purge_after = ?
         WHERE id IN (SELECT id FROM schedule_blocks WHERE target_entity_id = ?)`,
      )
      .run(now() - 1, task.id);

    expect(schedules.preserveReleasedBlockHistory()).toBe(1);
    const row = database.raw
      .prepare(
        `SELECT entity.purge_after
         FROM schedule_blocks block JOIN entity_index entity ON entity.id = block.id
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { purge_after: number | null };
    expect(row.purge_after).toBeNull();
    expect(information.purgeExpiredRecycleBin()).toBe(0);
    expect(
      schedules.taskScheduleHistory(task.id).entries.some((entry) => entry.kind === 'RELEASED'),
    ).toBe(true);
  });

  it('releases an ended block of an incomplete task and reschedules it with previous/new blocks in history', () => {
    const { database, actions, schedules, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: '逾期重排',
      priority: 'NORMAL',
      dueAt: now() + 8 * 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'TASK_CREATED');
    const oldBlock = database.raw
      .prepare(`SELECT id FROM schedule_blocks WHERE target_entity_id = ?`)
      .get(task.id) as { id: string };
    // 模拟时间流逝：让旧块整体进入过去（结束时间超过开始时间保持 CHECK 有效）。
    database.raw
      .prepare('UPDATE schedule_blocks SET start_at = ?, end_at = ? WHERE id = ?')
      .run(now() - 3_600_000, now() - 30 * 60_000, oldBlock.id);

    const run = schedules.reschedule(now(), now() + DAY, 'OVERDUE');

    const oldRow = database.raw
      .prepare(
        `SELECT block.reason_code, entity.deleted_at
         FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id
         WHERE block.id = ?`,
      )
      .get(oldBlock.id) as { reason_code: string; deleted_at: number | null };
    expect(oldRow.reason_code).toBe('RELEASED');
    expect(oldRow.deleted_at).not.toBeNull();
    const newBlock = database.raw
      .prepare(
        `SELECT start_at, end_at FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { start_at: number; end_at: number };
    expect(newBlock.start_at).toBeGreaterThanOrEqual(now());

    const detail = schedules.runDetail(run.id);
    expect(detail.createdBlocks.map((block) => block.taskId)).toContain(task.id);
    expect(detail.createdBlocks[0]?.outcome).toBe('RESCHEDULED');
    expect(detail.createdBlocks[0]?.previousBlocks).toHaveLength(1);
    expect(detail.releasedBlocks.some((block) => block.taskId === task.id)).toBe(true);

    const history = schedules.taskScheduleHistory(task.id);
    const rescheduled = history.entries.find((entry) => entry.kind === 'RESCHEDULED');
    expect(rescheduled).toBeDefined();
    expect(rescheduled?.previousBlocks).toHaveLength(1);
    expect(rescheduled?.newBlocks).toHaveLength(1);
    expect(rescheduled?.trigger).toBe('OVERDUE');
  });

  it('schedules an overdue task that has no active block without touching its dueAt', () => {
    const { database, actions, schedules, category } = setup();
    const dueAt = now() - 3_600_000;
    const task = actions.createTask({
      categoryId: category.id,
      title: '无块逾期',
      priority: 'NORMAL',
      dueAt,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    const run = schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const dueRow = actions.getTask(task.id);
    expect(dueRow === undefined ? null : Date.parse(dueRow.dueAt)).toBe(dueAt);
    expect(run.createdBlocks).toBeGreaterThan(0);
    const blocks = database.raw
      .prepare(
        `SELECT COUNT(*) count FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { count: number };
    expect(blocks.count).toBe(1);
    const history = schedules.taskScheduleHistory(task.id);
    const scheduled = history.entries.find((entry) => entry.kind === 'SCHEDULED');
    expect(scheduled).toBeDefined();
    expect(scheduled?.trigger).toBe('OVERDUE');
  });

  it('reschedules a splittable overdue task into multiple blocks with previous/new arrays', () => {
    const { database, actions, schedules, category } = setup();
    // 用固定日程把上午工作时段切成两段，迫使可拆分任务分成多个块。
    actions.createEvent(
      {
        categoryId: category.id,
        title: '占用中段',
        startAt: now() + 2 * 3_600_000,
        endAt: now() + 3 * 3_600_000,
        eventType: 'GENERAL',
        priority: 'NORMAL',
      },
      undefined,
    );
    const task = actions.createTask({
      categoryId: category.id,
      title: '可拆分逾期',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 120,
      isFlexible: true,
      isSplittable: true,
      preferredArea: 'WORK',
    });
    const run = schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    expect(run.createdBlocks).toBeGreaterThanOrEqual(2);
    const activeBlocks = database.raw
      .prepare(
        `SELECT COUNT(*) count FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { count: number };
    expect(activeBlocks.count).toBeGreaterThanOrEqual(2);
    const history = schedules.taskScheduleHistory(task.id);
    const scheduled = history.entries.find((entry) => entry.kind === 'SCHEDULED');
    expect(scheduled?.newBlocks.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('keeps a fixed event occupied and reports UNSCHEDULED when an overdue task has no free slot', () => {
    const { actions, schedules, category } = setup();
    // 占满全天可用：把固定日程铺到工作时段（沿用不可移动语义）。
    actions.createEvent(
      {
        categoryId: category.id,
        title: '全天固定',
        startAt: now(),
        endAt: now() + DAY,
        eventType: 'MEETING',
        priority: 'NORMAL',
      },
      undefined,
    );
    const task = actions.createTask({
      categoryId: category.id,
      title: '无处安放',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    const run = schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    expect(run.warnings.some((warning) => warning.warningType === 'UNSCHEDULED')).toBe(true);
    const detail = schedules.runDetail(run.id);
    expect(detail.summary.unscheduledTaskIds).toContain(task.id);
    const history = schedules.taskScheduleHistory(task.id);
    expect(history.entries.some((entry) => entry.kind === 'UNSCHEDULED')).toBe(true);
  });

  it('does not schedule a dependency-blocked overdue task', () => {
    const { database, actions, schedules, category } = setup();
    const predecessor = actions.createTask({
      categoryId: category.id,
      title: '前置未完成',
      priority: 'NORMAL',
      dueAt: now() + 3_600_000,
      estimatedMinutes: 30,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    const successor = actions.createTask({
      categoryId: category.id,
      title: '后继',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    actions.addDependency(successor.id, predecessor.id, undefined);
    const run = schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    expect(
      run.warnings.some(
        (warning) =>
          warning.warningType === 'DEPENDENCY_BLOCKED' && warning.entityId === successor.id,
      ),
    ).toBe(true);
    const successorBlocks = database.raw
      .prepare(`SELECT COUNT(*) count FROM schedule_blocks WHERE target_entity_id = ?`)
      .get(successor.id) as { count: number };
    expect(successorBlocks.count).toBe(0);
  });

  it('is idempotent: repeated overdue runs do not duplicate blocks or releases', () => {
    const { database, actions, schedules, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: '幂等',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const blocks = database.raw
      .prepare(
        `SELECT COUNT(*) count FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { count: number };
    expect(blocks.count).toBe(1);
    const released = database.raw
      .prepare(
        `SELECT COUNT(*) count FROM schedule_blocks WHERE target_entity_id = ? AND reason_code = 'RELEASED'`,
      )
      .get(task.id) as { count: number };
    expect(released.count).toBe(0);
  });

  it('computes the next overdue checkpoint from block ends and block-less dues', () => {
    const { actions, schedules, category } = setup();
    expect(schedules.nextOverdueCheckpoint(now())).toBeNull();
    // 无块任务：checkpoint = dueAt
    const dueTask = actions.createTask({
      categoryId: category.id,
      title: '按 due 触发',
      priority: 'NORMAL',
      dueAt: now() + 2 * 3_600_000,
      estimatedMinutes: 30,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    expect(schedules.nextOverdueCheckpoint(now())).toBe(Date.parse(dueTask.dueAt));
    // 有块任务：checkpoint = 最早块结束时间（不再取 dueAt）
    const blockedTask = actions.createTask({
      categoryId: category.id,
      title: '按块结束触发',
      priority: 'NORMAL',
      dueAt: now() + 12 * 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    void blockedTask;
    schedules.reschedule(now(), now() + DAY, 'TASK_CREATED');
    const checkpoint = schedules.nextOverdueCheckpoint(now());
    expect(checkpoint).not.toBeNull();
    expect(checkpoint ?? 0).toBeGreaterThan(now());
  });

  it('cleans up via GRID semantics and never schedules into the past', () => {
    const { database, actions, schedules, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: '过去不可排',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 30,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const block = database.raw
      .prepare(`SELECT start_at FROM schedule_blocks WHERE target_entity_id = ?`)
      .get(task.id) as { start_at: number };
    expect(block.start_at % GRID).toBe(0);
    expect(block.start_at).toBeGreaterThanOrEqual(now());
  });

  // ── A5 Tail Closure：审计补测 T1/T2/T3 ────────────────────────────────

  it('T1: keeps an unexpired locked block untouched by overdue processing and reschedule', () => {
    const { database, actions, schedules, category } = setup();
    const task = actions.createTask({
      categoryId: category.id,
      title: '锁定保护',
      priority: 'NORMAL',
      dueAt: now() + 8 * 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'TASK_CREATED');
    const block = database.raw
      .prepare(`SELECT id, start_at, end_at FROM schedule_blocks WHERE target_entity_id = ?`)
      .get(task.id) as { id: string; start_at: number; end_at: number };
    expect(block.end_at).toBeGreaterThan(now());
    schedules.setBlockLocked(block.id, true);

    // overdue processing：块仍未过期 → 不得删除、移动或覆盖
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const after = database.raw
      .prepare(
        `SELECT block.start_at, block.end_at, block.is_locked, block.reason_code, entity.deleted_at
         FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id
         WHERE block.id = ?`,
      )
      .get(block.id) as {
      start_at: number;
      end_at: number;
      is_locked: number;
      reason_code: string | null;
      deleted_at: number | null;
    };
    expect(after.deleted_at).toBeNull();
    expect(after.is_locked).toBe(1);
    expect(after.start_at).toBe(block.start_at);
    expect(after.end_at).toBe(block.end_at);
    expect(after.reason_code).not.toBe('RELEASED');
    const active = database.raw
      .prepare(
        `SELECT COUNT(*) count FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { count: number };
    expect(active.count).toBe(1);
  });

  it('T2: checkpoint uses the active block end (not dueAt) once a block exists', () => {
    const { database, actions, schedules, category } = setup();
    // 场景：任务已被重排到未来，块仍然活跃；其 dueAt 早已过去。
    const task = actions.createTask({
      categoryId: category.id,
      title: '有块看块结束',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const block = database.raw
      .prepare(
        `SELECT start_at, end_at FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { start_at: number; end_at: number };
    expect(block.start_at).toBeGreaterThanOrEqual(now());
    // 有活动块 → checkpoint = 块结束时间（不再取已过去的 dueAt）
    expect(schedules.nextOverdueCheckpoint(now())).toBe(block.end_at);
    // 块仍活跃且尚未结束 → overdue 处理不得提前释放
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const stillActive = database.raw
      .prepare(
        `SELECT COUNT(*) count FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.target_entity_id = ?`,
      )
      .get(task.id) as { count: number };
    expect(stillActive.count).toBe(1);
  });

  it('T2b: a block extending past dueAt still keys the checkpoint to the block end', () => {
    const { database, actions, schedules, category } = setup();
    // 场景：dueAt 早于块结束（例如用户把 dueAt 提前，块被保留），
    // 检查点仍应取块结束时间，而不是更早的 dueAt。
    const dueAt = now() + 4 * 3_600_000;
    const task = actions.createTask({
      categoryId: category.id,
      title: '截止早于块结束',
      priority: 'NORMAL',
      dueAt,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'TASK_CREATED');
    const block = database.raw
      .prepare(`SELECT id, start_at FROM schedule_blocks WHERE target_entity_id = ?`)
      .get(task.id) as { id: string; start_at: number };
    // 把块结束时间推到 dueAt 之后（等价于因编辑截止时间而被保留的块）。
    const extendedEnd = dueAt + 3_600_000;
    database.raw
      .prepare('UPDATE schedule_blocks SET end_at = ? WHERE id = ?')
      .run(extendedEnd, block.id);
    expect(schedules.nextOverdueCheckpoint(now())).toBe(extendedEnd);
    // 块未过期 → overdue 处理不得释放它
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const row = database.raw
      .prepare(
        `SELECT entity.deleted_at FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id
         WHERE block.id = ?`,
      )
      .get(block.id) as { deleted_at: number | null };
    expect(row.deleted_at).toBeNull();
  });

  it('T3: split reschedule history keeps previousBlocks isolated per task in a multi-task run', () => {
    const { database, actions, schedules, category } = setup();
    // 两个任务各自有旧块；同一 OVERDUE run 同时处理两者。
    const first = actions.createTask({
      categoryId: category.id,
      title: '任务甲',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 60,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    const second = actions.createTask({
      categoryId: category.id,
      title: '任务乙',
      priority: 'NORMAL',
      dueAt: now() - 3_600_000,
      estimatedMinutes: 30,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    schedules.reschedule(now(), now() + DAY, 'OVERDUE');
    const oldFirst = database.raw
      .prepare(`SELECT id, start_at, end_at FROM schedule_blocks WHERE target_entity_id = ?`)
      .get(first.id) as { id: string; start_at: number; end_at: number };
    const oldSecond = database.raw
      .prepare(`SELECT id, start_at, end_at FROM schedule_blocks WHERE target_entity_id = ?`)
      .get(second.id) as { id: string; start_at: number; end_at: number };
    // 把两块都移入过去（不同时段）→ 下一次 run 会同时释放并重排两个任务。
    // 释放行保留移动后的时间；历史 previousBlocks 即这些实际旧块时间。
    const firstStart = now() - 3 * 3_600_000;
    const firstEnd = now() - 2 * 3_600_000;
    const secondStart = now() - 2 * 3_600_000;
    const secondEnd = now() - 3_600_000;
    database.raw
      .prepare('UPDATE schedule_blocks SET start_at = ?, end_at = ? WHERE id = ?')
      .run(firstStart, firstEnd, oldFirst.id);
    database.raw
      .prepare('UPDATE schedule_blocks SET start_at = ?, end_at = ? WHERE id = ?')
      .run(secondStart, secondEnd, oldSecond.id);

    schedules.reschedule(now(), now() + DAY, 'OVERDUE');

    const historyFirst = schedules.taskScheduleHistory(first.id);
    const rescheduledFirst = historyFirst.entries.find((entry) => entry.kind === 'RESCHEDULED');
    expect(rescheduledFirst).toBeDefined();
    expect(rescheduledFirst?.previousBlocks).toHaveLength(1);
    expect(rescheduledFirst?.previousBlocks[0]).toEqual({
      startAt: new Date(firstStart).toISOString(),
      endAt: new Date(firstEnd).toISOString(),
    });
    expect(rescheduledFirst?.newBlocks).toHaveLength(1);

    const historySecond = schedules.taskScheduleHistory(second.id);
    const rescheduledSecond = historySecond.entries.find((entry) => entry.kind === 'RESCHEDULED');
    expect(rescheduledSecond).toBeDefined();
    expect(rescheduledSecond?.previousBlocks).toHaveLength(1);
    expect(rescheduledSecond?.previousBlocks[0]).toEqual({
      startAt: new Date(secondStart).toISOString(),
      endAt: new Date(secondEnd).toISOString(),
    });
    // 交叉污染检查：任务甲的历史不得包含任务乙的旧块，反之亦然。
    expect(
      rescheduledSecond?.previousBlocks.some(
        (span) => span.startAt === new Date(firstStart).toISOString(),
      ),
    ).toBe(false);
    expect(
      rescheduledFirst?.previousBlocks.some(
        (span) => span.startAt === new Date(secondStart).toISOString(),
      ),
    ).toBe(false);
  });
});
