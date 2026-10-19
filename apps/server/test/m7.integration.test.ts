import { afterEach, describe, expect, it, vi } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { InMemoryCredentialStore, type ToolCallingRequest } from '@life-assistant/ai-adapters';
import { createSystemOperationContext } from '@life-assistant/database';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

const responseData = (body: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== 'object' || parsed === null || !('data' in parsed))
    throw new Error('Expected API envelope with data.');
  const data = parsed.data;
  if (typeof data !== 'object' || data === null) throw new Error('Expected object data.');
  return data as Record<string, unknown>;
};

describe('M7 AI provider configuration API', () => {
  const closers: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  it('processes an AI_PROCESS inbox item through the guarded tool runtime', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    const item = runtime.inbox?.capture('整理资料', 'AI_PROCESS');
    const database = runtime.database;
    if (category === undefined || item === undefined || database === undefined)
      throw new Error('Test runtime was not initialized.');
    const result = await runtime.tools?.execute({
      callId: 'process_ai_inbox',
      name: 'process_inbox_item',
      argumentsJson: JSON.stringify({
        inboxItemId: item.id,
        expectedVersion: item.version,
        userIntentReference: 'test-intent',
        results: [
          {
            resultType: 'TASK',
            categoryId: category.id,
            title: '整理资料',
            priority: 'NORMAL',
            dueAt: Date.parse('2026-08-15T09:00:00.000Z'),
            estimatedMinutes: 30,
            isFlexible: true,
            preferredArea: 'WORK',
          },
        ],
      }),
    });
    expect(result).toMatchObject({ status: 'PROCESSED', results: [{ resultType: 'TASK' }] });
    const processed = runtime.inbox?.get(item.id);
    expect(processed?.processedChangeSetId).toEqual(expect.any(String));
    expect(
      database.raw
        .prepare('SELECT source FROM change_sets WHERE id=?')
        .get(processed?.processedChangeSetId),
    ).toMatchObject({ source: 'AI' });
    expect(
      database.raw
        .prepare(
          'SELECT source FROM entity_versions WHERE entity_id=? ORDER BY entity_version DESC LIMIT 1',
        )
        .get(item.id),
    ).toMatchObject({ source: 'AI' });
  });

  it('atomically splits one inbox sentence into a task, shopping item, and goal', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const work = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    const life = runtime.shared?.listCategories().find((item) => item.parentArea === 'LIFE');
    if (
      work === undefined ||
      life === undefined ||
      runtime.inbox === undefined ||
      runtime.actions === undefined ||
      runtime.life === undefined ||
      runtime.database === undefined ||
      runtime.consistency === undefined
    )
      throw new Error('Test runtime was not initialized.');

    const results = [
      {
        resultType: 'TASK',
        categoryId: work.id,
        title: '完成项目首页',
        priority: 'HIGH',
        dueAt: Date.parse('2026-08-14T16:00:00.000Z'),
        estimatedMinutes: 120,
        isFlexible: true,
        preferredArea: 'WORK',
      },
      {
        resultType: 'SHOPPING_ITEM',
        categoryId: life.id,
        name: '牛奶',
        quantity: 1,
        priority: 'NORMAL',
      },
      {
        resultType: 'GOAL',
        categoryId: life.id,
        title: '减重两公斤',
        description: '身体指标目标',
        goalType: 'OUTCOME',
        startDate: '2026-08-14',
        endDate: '2026-09-30',
      },
    ] as const;
    const item = runtime.inbox.capture(
      '周五前完成项目首页，今晚买牛奶，下个月减重两公斤。',
      'AI_PROCESS',
    );
    const applied = runtime.consistency.executeAtomicChangeSet({
      context: createSystemOperationContext({ sourceId: 'a19-inbox-test' }),
      summary: 'InboxItemProcessedByAi',
      riskLevel: 'LOW_WRITE',
      execute: (context) => runtime.inbox?.processByAi(item.id, item.version, results, context),
    });
    expect(applied.result).toMatchObject({
      status: 'PROCESSED',
      results: [{ resultType: 'TASK' }, { resultType: 'SHOPPING_ITEM' }, { resultType: 'GOAL' }],
    });
    const changeSetIds = runtime.database.raw
      .prepare(
        'SELECT DISTINCT change_set_id FROM entity_versions WHERE entity_id IN (SELECT entity_id FROM inbox_item_results WHERE inbox_item_id=?)',
      )
      .all(item.id) as { change_set_id: string }[];
    expect(changeSetIds).toEqual([{ change_set_id: applied.changeSetId }]);
    expect(runtime.inbox.get(item.id)?.processedChangeSetId).toBe(applied.changeSetId);

    const rollbackItem = runtime.inbox.capture('前两项合法，第三项非法', 'AI_PROCESS');
    expect(() =>
      runtime.consistency?.executeAtomicChangeSet({
        context: createSystemOperationContext({ sourceId: 'a19-inbox-rollback-test' }),
        summary: 'InboxItemProcessedByAiRollback',
        riskLevel: 'LOW_WRITE',
        execute: (context) =>
          runtime.inbox?.processByAi(
            rollbackItem.id,
            rollbackItem.version,
            [
              { ...results[0], title: '不应保留的任务' },
              { ...results[1], name: '不应保留的购物项' },
              { ...results[2], categoryId: 'missing-category', title: '非法第三项' },
            ],
            context,
          ),
      }),
    ).toThrow();
    expect(
      runtime.actions.listTasks({ includeCompleted: true }).map((value) => value.title),
    ).not.toContain('不应保留的任务');
    expect(runtime.life.listShoppingItems().map((value) => value.name)).not.toContain(
      '不应保留的购物项',
    );
    expect(runtime.inbox.get(rollbackItem.id)).toMatchObject({
      status: 'UNPROCESSED',
      results: [],
    });
  });

  it('records proactive analysis as a suggestion without creating business objects', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    if (category === undefined || runtime.actions === undefined)
      throw new Error('Test runtime was not initialized.');
    runtime.actions.createTask({
      categoryId: category.id,
      title: '逾期任务',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-08-13T09:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    expect(runtime.analyzeAndSuggest()).toEqual({ created: 1 });
    expect(runtime.notifications?.list()).toEqual(
      expect.arrayContaining([expect.objectContaining({ notificationType: 'AI_SUGGESTION' })]),
    );
    expect(runtime.actions.listTasks({ includeCompleted: true })).toHaveLength(1);
  });

  it('detects every first-release proactive finding with evidence and no business writes', async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-14T08:00:00.000Z'));
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const work = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    const fitness = runtime.shared?.listCategories().find((item) => item.moduleType === 'FITNESS');
    const shopping = runtime.shared
      ?.listCategories()
      .find((item) => item.moduleType === 'SHOPPING');
    if (!work || !fitness || !shopping || !runtime.actions || !runtime.life || !runtime.database)
      throw new Error('Test runtime was not initialized.');
    const task = (title: string, dueAt: string, estimatedMinutes = 60) =>
      runtime.actions?.createTask({
        categoryId: work.id,
        title,
        priority: 'HIGH',
        dueAt: Date.parse(dueAt),
        estimatedMinutes,
        isFlexible: true,
        preferredArea: 'WORK',
      });
    const near = task('临近截止', '2026-08-15T00:00:00.000Z');
    const predecessor = task('未完成前置', '2026-08-20T00:00:00.000Z');
    const successor = task('被阻塞任务', '2026-08-20T00:00:00.000Z');
    runtime.actions.addDependency(
      successor?.id ?? '',
      predecessor?.id ?? '',
      undefined,
      successor?.version ?? 1,
    );
    const staleGoal = runtime.actions.createGoal({
      categoryId: fitness.id,
      title: '长期健身目标',
      goalType: 'OUTCOME',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    runtime.database.raw
      .prepare('UPDATE entity_index SET created_at=? WHERE id=?')
      .run(clock.now().getTime() - 60 * 86_400_000, staleGoal.id);
    const plan = runtime.actions.createPlan({
      categoryId: work.id,
      title: '明显不可执行计划',
      priority: 'HIGH',
      startDate: '2026-08-01',
      endDate: '2026-08-20',
    });
    runtime.actions.createTask({
      categoryId: work.id,
      planId: plan.id,
      title: '超量工作',
      priority: 'HIGH',
      dueAt: Date.parse('2026-08-20T00:00:00.000Z'),
      estimatedMinutes: 2_415,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    const blockId = '01A20BLOCK0000000000000001';
    runtime.database.raw
      .prepare(
        "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'SCHEDULE_BLOCK',?,?)",
      )
      .run(blockId, clock.now().getTime(), clock.now().getTime());
    runtime.database.raw
      .prepare(
        "INSERT INTO schedule_blocks(id,target_entity_id,block_type,area,start_at,end_at,source,is_locked) VALUES (?,?, 'TASK','WORK',?,?,'MANUAL',0)",
      )
      .run(
        blockId,
        near?.id,
        Date.parse('2026-08-14T00:00:00.000Z'),
        Date.parse('2026-08-14T10:00:00.000Z'),
      );
    const budget = runtime.life.createBudget({
      categoryId: shopping.id,
      moduleType: 'SHOPPING',
      periodType: 'MONTH',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      amountMinor: 10_000,
      alertThresholdPercent: 80,
    });
    const expenseId = '01A20EXPENSE00000000000001';
    runtime.database.raw
      .prepare(
        "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'EXPENSE_ENTRY',?,?)",
      )
      .run(expenseId, clock.now().getTime(), clock.now().getTime());
    runtime.database.raw
      .prepare(
        "INSERT INTO expense_entries(id,module_type,category_id,source_entity_id,occurred_at,amount_minor,currency) VALUES (?,'SHOPPING',?,?,?,?, 'CNY')",
      )
      .run(expenseId, shopping.id, budget.id, clock.now().getTime(), 8_500);
    const entityCountBefore = (
      runtime.database.raw.prepare('SELECT COUNT(*) count FROM entity_index').get() as {
        count: number;
      }
    ).count;

    expect(runtime.analyzeAndSuggest()).toEqual({ created: 8 });
    const suggestions = runtime.notifications?.list() ?? [];
    expect(suggestions.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('NEAR_DEADLINE'),
        expect.stringContaining('TODAY_OVERLOAD'),
        expect.stringContaining('CONTINUOUS_WORK'),
        expect.stringContaining('DEPENDENCY_BLOCKED'),
        expect.stringContaining('GOAL_STALLED'),
        expect.stringContaining('BUDGET_LIMIT'),
        expect.stringContaining('CROSS_DOMAIN_CONFLICT'),
        expect.stringContaining('PLAN_INFEASIBLE'),
      ]),
    );
    expect(
      suggestions.every((item) => item.targetEntityId !== null && item.body.includes('证据对象')),
    ).toBe(true);
    const entityCountAfter = (
      runtime.database.raw.prepare('SELECT COUNT(*) count FROM entity_index').get() as {
        count: number;
      }
    ).count;
    expect(entityCountAfter - entityCountBefore).toBe(8);
    expect(runtime.actions.listTasks({ includeCompleted: true })).toHaveLength(4);
  });

  it('creates a provider without returning or persisting a credential', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-13T00:00:00.000Z')),
      credentialStore: new InMemoryCredentialStore(),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '主模型', modelId: 'gpt-test' },
    });

    expect(response.statusCode).toBe(201);
    expect(responseData(response.body)).toMatchObject({
      providerType: 'OPENAI',
      displayName: '主模型',
      modelId: 'gpt-test',
      hasCredential: false,
    });
    expect(response.body).not.toContain('credentialRef');
    expect(runtime.isAiConfigured()).toBe(false);
  });

  it('clears AI memories only after an explicit one-time confirmation', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    runtime.aiMemories?.remember({
      memoryType: 'PREFERENCE',
      content: '偏好早晨安排',
      confidence: 0.9,
    });
    const preview = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/ai-memory:clear-preview',
    });
    const data = responseData(preview.body);
    expect(runtime.aiMemories?.listActive()).toHaveLength(1);
    const confirmed = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/ai-memory:clear-confirm',
      payload: { confirmationId: data.confirmationId, count: data.count },
    });
    expect(responseData(confirmed.body)).toMatchObject({ cleared: 1 });
    expect(runtime.aiMemories?.listActive()).toHaveLength(0);
  });

  it('executes registered low-impact task and note writes against the local services', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
      credentialStore: new InMemoryCredentialStore(),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    expect(category).toBeDefined();
    const created = await runtime.tools?.execute({
      callId: 'call_create_task',
      name: 'create_task',
      argumentsJson: JSON.stringify({
        categoryId: category?.id,
        title: '整理 M7-012 验收',
        priority: 'NORMAL',
        dueAt: '2026-08-15T09:00:00.000Z',
        estimatedMinutes: 30,
        isFlexible: true,
        isSplittable: false,
        preferredArea: 'WORK',
        userIntentReference: 'message_1',
      }),
    });
    expect(created).toMatchObject({ title: '整理 M7-012 验收', status: 'TODO', version: 1 });
    const taskId = (created as { entityId: string }).entityId;
    await expect(
      runtime.tools?.execute({
        callId: 'call_create_note',
        name: 'create_note',
        argumentsJson: JSON.stringify({
          entityId: taskId,
          categoryId: category?.id,
          title: '验收说明',
          markdownContent: '已由用户明确要求创建。',
          role: 'TECHNICAL',
          userIntentReference: 'message_1',
        }),
      }),
    ).resolves.toMatchObject({ title: '验收说明', version: 1 });
    expect(runtime.actions?.getTask(taskId)).toMatchObject({ title: '整理 M7-012 验收' });
    expect(runtime.work?.listNotes(taskId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: '验收说明', role: 'TECHNICAL' })]),
    );
  });

  it('waits for explicit local confirmation before replacing a long-term goal', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    if (category === undefined || runtime.actions === undefined)
      throw new Error('Test runtime was not initialized.');
    const goal = runtime.actions.createGoal({
      categoryId: category.id,
      title: '旧的长期目标',
      goalType: 'OUTCOME',
      startDate: '2026-08-14',
      endDate: '2027-08-14',
    });
    const pending = (await runtime.tools?.execute({
      callId: 'call_replace_goal',
      name: 'replace_long_term_goal',
      argumentsJson: JSON.stringify({
        goalId: goal.id,
        expectedVersion: goal.version,
        title: '新的长期目标',
        userIntentReference: 'message_confirm_goal',
      }),
    })) as { actionId: string; status: string; preview: unknown };
    expect(pending).toMatchObject({ status: 'AWAITING_CONFIRMATION' });
    expect(runtime.actions.listGoals().find((item) => item.id === goal.id)?.title).toBe(
      '旧的长期目标',
    );
    const fetched = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/actions/${pending.actionId}`,
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.body).not.toContain('token');
    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/actions/${pending.actionId}:confirm`,
    });
    expect(confirmed.statusCode).toBe(200);
    expect(responseData(confirmed.body)).toMatchObject({
      action: { status: 'EXECUTED' },
      result: { title: '新的长期目标' },
    });
    expect(runtime.actions.listGoals().find((item) => item.id === goal.id)?.title).toBe(
      '新的长期目标',
    );
    const duplicateConfirm = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/actions/${pending.actionId}:confirm`,
    });
    expect(duplicateConfirm.statusCode).toBe(200);
    expect(responseData(duplicateConfirm.body)).toMatchObject({
      action: { status: 'EXECUTED' },
      result: { title: '新的长期目标' },
    });
    expect(runtime.actions.listGoals().find((item) => item.id === goal.id)?.version).toBe(2);
    const cancellable = (await runtime.tools?.execute({
      callId: 'call_cancel_goal',
      name: 'replace_long_term_goal',
      argumentsJson: JSON.stringify({
        goalId: goal.id,
        expectedVersion: 2,
        title: '不应执行',
        userIntentReference: 'message_cancel_goal',
      }),
    })) as { actionId: string };
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/actions/${cancellable.actionId}:cancel`,
    });
    expect(responseData(cancelled.body)).toMatchObject({ status: 'CANCELLED' });
    expect(runtime.actions.listGoals().find((item) => item.id === goal.id)?.title).toBe(
      '新的长期目标',
    );
  });

  it('applies an AI change plan atomically and records one shared change set', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    if (category === undefined || runtime.actions === undefined || runtime.database === undefined)
      throw new Error('Test runtime was not initialized.');
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
    });
    const taskOperation = (title: string) => ({
      operation: 'CREATE_TASK',
      categoryId: category.id,
      title,
      priority: 'NORMAL',
      dueAt: '2026-08-15T09:00:00.000Z',
      estimatedMinutes: 30,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    const eventOperation = {
      operation: 'CREATE_EVENT',
      categoryId: category.id,
      title: '验收日程',
      startAt: '2026-08-16T09:00:00.000Z',
      endAt: '2026-08-16T10:00:00.000Z',
      eventType: 'GENERAL',
      priority: 'NORMAL',
    };
    const applied = (await runtime.tools?.execute({
      callId: 'call_atomic_plan',
      name: 'apply_change_plan',
      argumentsJson: JSON.stringify({
        summary: '创建跨模块验收对象',
        userIntentReference: 'message_atomic',
        operations: [taskOperation('任务一'), eventOperation],
      }),
    })) as { changeSetId: string; operations: { entityId: string }[] };
    expect(applied.operations).toHaveLength(2);
    const rows = runtime.database.raw
      .prepare('SELECT DISTINCT change_set_id FROM entity_versions WHERE entity_id IN (?, ?)')
      .all(applied.operations[0]?.entityId, applied.operations[1]?.entityId) as {
      change_set_id: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(
      runtime.database.raw
        .prepare('SELECT source FROM change_sets WHERE id=?')
        .get(rows[0]?.change_set_id),
    ).toMatchObject({ source: 'AI' });
    expect(rows[0]?.change_set_id).toBe(applied.changeSetId);
    expect(
      runtime.database.raw
        .prepare(
          'SELECT sequence,operation FROM change_operations WHERE change_set_id=? ORDER BY sequence',
        )
        .all(applied.changeSetId),
    ).toEqual([
      { sequence: 0, operation: 'CREATE' },
      { sequence: 1, operation: 'CREATE' },
    ]);
    await expect(
      runtime.tools?.execute({
        callId: 'call_atomic_rollback',
        name: 'apply_change_plan',
        argumentsJson: JSON.stringify({
          summary: '应回滚',
          userIntentReference: 'message_rollback',
          operations: [taskOperation('不应保留'), { ...eventOperation, title: '冲突日程' }],
        }),
      }),
    ).rejects.toThrow('SCHEDULE_CONFLICT');
    expect(
      runtime.actions.listTasks({ includeCompleted: true }).map((task) => task.title),
    ).not.toContain('不应保留');
    const details = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/change-sets/${applied.changeSetId}`,
    });
    expect(responseData(details.body)).toMatchObject({
      id: applied.changeSetId,
      status: 'APPLIED',
      operations: [{ operation: 'CREATE' }, { operation: 'CREATE' }],
    });
    const undone = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/change-sets/${applied.changeSetId}:undo`,
    });
    expect(undone.statusCode).toBe(200);
    expect(responseData(undone.body)).toMatchObject({ status: 'REVERTED' });
    expect(
      runtime.actions.listTasks({ includeCompleted: true }).map((task) => task.title),
    ).not.toContain('任务一');
  });

  it('stores a credential outside SQLite and verifies the OpenAI native tool provider', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-13T00:00:00.000Z')),
      credentialStore: credentials,
      openAiProvider: {
        providerType: 'OPENAI',
        verify: () =>
          Promise.resolve({
            chat: true,
            streaming: true,
            toolCalling: true,
            nativeWebSearch: true,
          }),
      },
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '主模型', modelId: 'gpt-test' },
    });
    const id = responseData(created.body).id as string;

    const saved = await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${id}/credential`,
      payload: { secret: 'test-secret' },
    });
    expect(saved.statusCode).toBe(204);
    await expect(credentials.get(`life-assistant:ai-provider:${id}`)).resolves.toBe('test-secret');
    expect(
      runtime.database?.raw
        .prepare('SELECT sql FROM sqlite_master WHERE name=?')
        .get('ai_provider_configs'),
    ).not.toContain('secret');

    const verified = await app.inject({ method: 'POST', url: `/api/v1/ai/providers/${id}:verify` });
    expect(verified.statusCode).toBe(200);
    expect(responseData(verified.body)).toMatchObject({
      hasCredential: true,
      capabilities: { chat: true, streaming: true, toolCalling: true, nativeWebSearch: true },
    });
    expect(verified.body).not.toContain('test-secret');
    expect(runtime.isAiConfigured()).toBe(true);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/ai/providers/${id}/credential`,
    });
    expect(removed.statusCode, removed.body).toBe(204);
    expect(runtime.isAiConfigured()).toBe(false);
  });

  it('sets a default provider and removes a provider together with its external credential', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-13T00:00:00.000Z')),
      credentialStore: credentials,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '主模型', modelId: 'gpt-main' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '备用模型', modelId: 'gpt-backup' },
    });
    const firstProvider = responseData(first.body);
    const secondProvider = responseData(second.body);
    const secondId = secondProvider.id as string;
    expect(firstProvider.isDefault).toBe(true);
    expect(secondProvider.isDefault).toBe(false);

    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${secondId}/credential`,
      payload: { secret: 'credential-to-delete' },
    });
    const setDefault = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/providers/${secondId}:set-default`,
      headers: { 'if-match': `"${String(secondProvider.version)}"` },
      payload: { expectedVersion: secondProvider.version },
    });
    expect(setDefault.statusCode).toBe(200);
    const defaultProvider = responseData(setDefault.body);
    expect(defaultProvider.isDefault).toBe(true);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/ai/providers/${secondId}`,
      headers: { 'if-match': `"${String(defaultProvider.version)}"` },
      payload: { expectedVersion: defaultProvider.version },
    });
    expect(removed.statusCode, removed.body).toBe(204);
    await expect(
      credentials.get(`life-assistant:ai-provider:${secondId}`),
    ).resolves.toBeUndefined();

    const providers = await app.inject({ method: 'GET', url: '/api/v1/ai/providers' });
    expect(responseData(providers.body)).toEqual([
      expect.objectContaining({ id: firstProvider.id, isDefault: true }),
    ]);
  });

  it('verifies an OpenAI-compatible provider through its configured custom base URL', async () => {
    const directory = await createTestDataDirectory();
    const compatibleVerify = vi.fn((input: { modelId: string; baseUrl: string | null }) =>
      Promise.resolve({
        chat: true,
        streaming: true,
        toolCalling: true,
        nativeWebSearch: false,
        ...input,
      }),
    );
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-13T00:00:00.000Z')),
      credentialStore: new InMemoryCredentialStore(),
      openAiCompatibleProvider: { providerType: 'OPENAI_COMPATIBLE', verify: compatibleVerify },
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: {
        providerType: 'OPENAI_COMPATIBLE',
        displayName: '兼容服务',
        baseUrl: 'https://compatible.example/v1',
        modelId: 'compatible-model',
      },
    });
    const id = responseData(created.body).id as string;
    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${id}/credential`,
      payload: { secret: 'test-secret' },
    });
    const verified = await app.inject({ method: 'POST', url: `/api/v1/ai/providers/${id}:verify` });

    expect(verified.statusCode).toBe(200);
    expect(compatibleVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'compatible-model',
        baseUrl: 'https://compatible.example/v1',
      }),
    );
    expect(responseData(verified.body)).toMatchObject({
      providerType: 'OPENAI_COMPATIBLE',
      capabilities: { toolCalling: true, nativeWebSearch: false },
    });
  });

  it.each([
    ['AI_AUTHENTICATION_FAILED', 401],
    ['AI_RATE_LIMITED', 429],
    ['AI_TIMEOUT', 504],
    ['AI_CAPABILITY_UNAVAILABLE', 503],
    ['AI_UNAVAILABLE', 503],
    ['CREDENTIAL_STORE_UNAVAILABLE', 503],
  ])('maps %s to a stable, secret-free HTTP status', async (code, expectedStatus) => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-13T00:00:00.000Z')),
      credentialStore: new InMemoryCredentialStore(),
      openAiProvider: {
        providerType: 'OPENAI',
        verify: () => Promise.reject(new Error(code)),
      },
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '主模型', modelId: 'gpt-4.1-mini' },
    });
    const id = responseData(created.body).id as string;
    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${id}/credential`,
      payload: { secret: 'test-secret' },
    });

    const response = await app.inject({ method: 'POST', url: `/api/v1/ai/providers/${id}:verify` });
    expect(response.statusCode).toBe(expectedStatus);
    expect(response.json()).toMatchObject({ code, status: expectedStatus });
    expect(response.body).not.toContain('test-secret');
  });

  it('persists multi-session messages and runs, supports archive/search and reports unavailable providers', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-13T00:00:00.000Z')),
      credentialStore: new InMemoryCredentialStore(),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const provider = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '主模型', modelId: 'gpt-4.1-mini' },
    });
    const providerId = responseData(provider.body).id as string;
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chats',
      payload: { title: '项目计划', providerConfigId: providerId },
    });
    const firstId = responseData(first.body).id as string;
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chats',
      payload: { title: '生活安排', providerConfigId: providerId },
    });
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/chats/${firstId}/messages`,
      payload: { content: '今天要做什么？' },
    });
    expect(sent.statusCode).toBe(202);
    const sentData = responseData(sent.body);
    const messages = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/chats/${firstId}/messages`,
    });
    expect(responseData(messages.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'USER', plainText: '今天要做什么？' }),
        expect.objectContaining({ role: 'ASSISTANT', status: 'FAILED' }),
      ]),
    );
    const messageSearch = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/chats?q=%E4%BB%8A%E5%A4%A9%E8%A6%81%E5%81%9A',
    });
    expect(responseData(messageSearch.body)).toEqual([
      expect.objectContaining({ id: firstId, title: '项目计划' }),
    ]);
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ai/chats/${firstId}`,
      headers: { 'if-match': String(responseData(first.body).version) },
      payload: { title: '项目计划已重命名', expectedVersion: responseData(first.body).version },
    });
    expect(renamed.statusCode).toBe(200);
    expect(responseData(renamed.body)).toMatchObject({ title: '项目计划已重命名', version: 2 });
    const staleRename = await app.inject({
      method: 'PATCH',
      url: `/api/v1/ai/chats/${firstId}`,
      headers: { 'if-match': String(responseData(first.body).version) },
      payload: { title: '不应覆盖', expectedVersion: responseData(first.body).version },
    });
    expect(staleRename.statusCode).toBe(409);
    const run = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/runs/${String(sentData.runId)}`,
    });
    expect(['QUEUED', 'FAILED']).toContain(responseData(run.body).status);
    await app.inject({ method: 'POST', url: `/api/v1/ai/chats/${firstId}:archive` });
    const active = await app.inject({ method: 'GET', url: '/api/v1/ai/chats?q=生活' });
    expect(responseData(active.body)).toEqual([
      expect.objectContaining({ id: responseData(second.body).id, status: 'ACTIVE' }),
    ]);
    const archived = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/chats?includeArchived=true&q=%E9%A1%B9%E7%9B%AE%E8%AE%A1%E5%88%92%E5%B7%B2%E9%87%8D%E5%91%BD%E5%90%8D',
    });
    expect(responseData(archived.body)).toEqual([
      expect.objectContaining({ id: firstId, status: 'ARCHIVED' }),
    ]);
    const restored = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/chats/${firstId}:unarchive`,
    });
    expect(responseData(restored.body)).toMatchObject({ status: 'ACTIVE' });
  });

  it('persists streamed deltas and exposes their ordered run events without a real provider', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const streamProvider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: () => Promise.resolve({ text: '', toolCalls: [], providerItems: [] }),
      async *streamTools() {
        await Promise.resolve();
        yield { type: 'text_delta' as const, delta: '你好，' };
        yield { type: 'text_delta' as const, delta: '这是流式回答。' };
        yield { type: 'completed' as const };
      },
    };
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
      credentialStore: credentials,
      openAiProvider: streamProvider,
      enableReadOnlyTools: false,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const provider = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '测试模型', modelId: 'gpt-4.1-mini' },
    });
    const providerId = responseData(provider.body).id as string;
    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${providerId}/credential`,
      payload: { secret: 'test-secret' },
    });
    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chats',
      payload: { title: '流式测试', providerConfigId: providerId },
    });
    const chatId = responseData(chat.body).id as string;
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/chats/${chatId}/messages`,
      payload: { content: '你好' },
    });
    const runId = String(responseData(sent.body).runId);
    for (
      let attempt = 0;
      attempt < 20 && runtime.chats?.getRun(runId).status !== 'COMPLETED';
      attempt += 1
    )
      await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runtime.chats?.getRun(runId)).toMatchObject({ status: 'COMPLETED' });
    expect(runtime.chats?.listMessages(chatId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'ASSISTANT',
          plainText: '你好，这是流式回答。',
          status: 'COMPLETED',
        }),
      ]),
    );
    expect(runtime.chatRunner?.eventsFor(runId).map((event) => event.type)).toEqual([
      'ai.run.started',
      'ai.run.delta',
      'ai.run.delta',
      'ai.run.completed',
    ]);
    const replay = await app.inject({ method: 'GET', url: `/api/v1/ai/runs/${runId}/events` });
    expect(replay.headers['content-type']).toContain('text/event-stream');
    expect(replay.body).toContain('event: ai.run.delta');
    const resync = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/runs/${runId}/events`,
      headers: { 'last-event-id': 'missing' },
    });
    expect(resync.body).toContain('event: sync.required');
  });

  it('cancels an in-flight provider stream and records one terminal cancellation event', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    let aborted = false;
    let resolveAbort = (): void => undefined;
    const abortedPromise = new Promise<void>((resolve) => {
      resolveAbort = resolve;
    });
    const streamProvider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: () => Promise.resolve({ text: '', toolCalls: [], providerItems: [] }),
      async *streamTools(request: { readonly signal?: AbortSignal }) {
        yield { type: 'text_delta' as const, delta: '开始生成' };
        await new Promise<void>((_resolve, reject) => {
          request.signal?.addEventListener(
            'abort',
            () => {
              aborted = true;
              resolveAbort();
              reject(new Error('aborted'));
            },
            { once: true },
          );
        });
      },
    };
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
      credentialStore: credentials,
      openAiProvider: streamProvider,
      enableReadOnlyTools: false,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const provider = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '取消测试', modelId: 'gpt-4.1-mini' },
    });
    const providerId = responseData(provider.body).id as string;
    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${providerId}/credential`,
      payload: { secret: 'test-secret' },
    });
    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chats',
      payload: { title: '取消流式测试', providerConfigId: providerId },
    });
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/chats/${String(responseData(chat.body).id)}/messages`,
      payload: { content: '请开始' },
    });
    const runId = String(responseData(sent.body).runId);
    for (
      let attempt = 0;
      attempt < 20 && runtime.chatRunner?.eventsFor(runId).length !== 2;
      attempt += 1
    )
      await new Promise((resolve) => setTimeout(resolve, 0));
    const cancelled = await app.inject({ method: 'POST', url: `/api/v1/ai/runs/${runId}:cancel` });
    expect(responseData(cancelled.body)).toMatchObject({ status: 'CANCELLED' });
    await Promise.race([abortedPromise, new Promise<void>((resolve) => setTimeout(resolve, 100))]);
    expect(aborted).toBe(true);
    expect(runtime.chatRunner?.eventsFor(runId).map((event) => event.type)).toEqual([
      'ai.run.started',
      'ai.run.delta',
      'ai.run.cancelled',
    ]);
  });

  it('executes a registered search tool and returns its output to the next provider round', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const requests: ToolCallingRequest[] = [];
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: vi.fn((request: ToolCallingRequest) => {
        requests.push(request);
        return Promise.resolve(
          requests.length === 1
            ? {
                text: '',
                toolCalls: [
                  {
                    callId: 'call_search',
                    name: 'search_records',
                    argumentsJson: '{"query":"不存在"}',
                  },
                ],
                providerItems: [{ type: 'function_call', call_id: 'call_search' }],
              }
            : { text: '已完成本地搜索。', toolCalls: [], providerItems: [] },
        );
      }),
    };
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
      credentialStore: credentials,
      openAiProvider: provider,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '工具模型', modelId: 'gpt-4.1-mini' },
    });
    const providerId = responseData(created.body).id as string;
    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${providerId}/credential`,
      payload: { secret: 'test-secret' },
    });
    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chats',
      payload: { title: '工具闭环', providerConfigId: providerId },
    });
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/chats/${String(responseData(chat.body).id)}/messages`,
      payload: { content: '帮我搜索' },
    });
    const runId = String(responseData(sent.body).runId);
    for (
      let attempt = 0;
      attempt < 30 && runtime.chats?.getRun(runId).status !== 'COMPLETED';
      attempt += 1
    )
      await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runtime.chats?.getRun(runId)).toMatchObject({ status: 'COMPLETED' });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.tools.map((tool) => tool.name)).toContain('search_records');
    expect(requests[1]?.toolOutputs).toEqual([{ callId: 'call_search', output: [] }]);
  });

  it('injects eligible memories and persists provider-native web sources with the completed assistant message', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const requests: ToolCallingRequest[] = [];
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: true }),
      executeTools: vi.fn((request: ToolCallingRequest) => {
        requests.push(request);
        return Promise.resolve({
          text: '已查到结果。',
          toolCalls: [],
          providerItems: [],
          sources: [{ title: '官方来源', url: 'https://example.com/source' }],
        });
      }),
    };
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
      credentialStore: credentials,
      openAiProvider: provider,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '联网模型', modelId: 'gpt-4.1-mini' },
    });
    const providerId = String(responseData(created.body).id);
    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${providerId}/credential`,
      payload: { secret: 'test-secret' },
    });
    const verified = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/providers/${providerId}:verify`,
    });
    expect(verified.statusCode).toBe(200);
    const memoryId = runtime.aiMemories?.remember({
      memoryType: 'PREFERENCE',
      content: '偏好早晨安排',
      confidence: 0.9,
    });
    if (memoryId === undefined || runtime.database === undefined)
      throw new Error('Test runtime was not initialized.');
    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chats',
      payload: { title: '联网来源', providerConfigId: providerId },
    });
    const chatId = String(responseData(chat.body).id);
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/chats/${chatId}/messages`,
      payload: { content: '请联网查询' },
    });
    const runId = String(responseData(sent.body).runId);
    for (
      let attempt = 0;
      attempt < 30 && runtime.chats?.getRun(runId).status !== 'COMPLETED';
      attempt += 1
    )
      await new Promise((resolve) => setTimeout(resolve, 0));
    const messages = await app.inject({
      method: 'GET',
      url: `/api/v1/ai/chats/${chatId}/messages`,
    });
    expect(responseData(messages.body)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'ASSISTANT',
          sources: [
            expect.objectContaining({ title: '官方来源', url: 'https://example.com/source' }),
          ],
        }),
      ]),
    );
    expect(provider.executeTools).toHaveBeenCalledWith(
      expect.objectContaining({ nativeWebSearch: true }),
    );
    expect(
      requests[0]?.messages.some(
        (message) => message.role === 'system' && message.content.includes('偏好早晨安排'),
      ),
    ).toBe(true);
    expect(
      runtime.database.raw.prepare('SELECT last_used_at FROM ai_memories WHERE id=?').get(memoryId),
    ).toMatchObject({ last_used_at: Date.parse('2026-08-14T00:00:00.000Z') });
  });

  it('rejects a write tool whose intent reference is not the current user message', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: () =>
        Promise.resolve({
          text: '',
          toolCalls: [
            {
              callId: 'call_invalid_intent',
              name: 'create_task',
              argumentsJson: JSON.stringify({
                categoryId: 'placeholder',
                title: '不应创建',
                priority: 'NORMAL',
                dueAt: '2026-08-15T09:00:00.000Z',
                estimatedMinutes: 30,
                isFlexible: true,
                isSplittable: false,
                preferredArea: 'WORK',
                userIntentReference: 'not-a-current-user-message',
              }),
            },
          ],
          providerItems: [],
        }),
    };
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
      credentialStore: credentials,
      openAiProvider: provider,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const config = runtime.ai?.createProvider({
      providerType: 'OPENAI',
      displayName: '意图校验模型',
      modelId: 'gpt-4.1-mini',
    });
    if (config === undefined || runtime.chats === undefined || runtime.chatRunner === undefined)
      throw new Error('Test runtime was not initialized.');
    await runtime.putAiCredential(config.id, 'test-secret');
    const session = runtime.chats.createSession({ title: '意图校验', providerConfigId: config.id });
    const sent = runtime.chats.sendMessage(String(session.id), '请创建一个任务');
    await runtime.chatRunner.run(sent.runId);
    expect(runtime.chats.getRun(sent.runId)).toMatchObject({
      status: 'FAILED',
      errorCode: 'AI_INVALID_RESPONSE',
    });
    expect(
      runtime.actions?.listTasks({ includeCompleted: true }).map((task) => task.title),
    ).not.toContain('不应创建');
  });

  it('keeps attachment metadata and body references out of provider chat context', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T00:00:00.000Z')),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    const config = runtime.ai?.createProvider({
      providerType: 'OPENAI',
      displayName: '上下文测试',
      modelId: 'gpt-4.1-mini',
    });
    if (
      config === undefined ||
      runtime.chats === undefined ||
      runtime.attachmentRepository === undefined
    )
      throw new Error('Test runtime was not initialized.');
    const session = runtime.chats.createSession({ title: '附件隔离', providerConfigId: config.id });
    const sent = runtime.chats.sendMessage(String(session.id), '请帮我处理这个附件');
    const attachmentId = runtime.attachmentRepository.nextId();
    runtime.attachmentRepository.create({
      id: attachmentId,
      originalName: 'private-plan.pdf',
      safeName: 'private-plan.pdf',
      mediaType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 42,
      sha256: 'a'.repeat(64),
      storageKey: 'attachments/private-plan.pdf',
      description: '不应发送给模型的附件说明',
      status: 'READY',
    });
    runtime.attachmentRepository.link(attachmentId, sent.userMessageId, 'DOCUMENT');
    const contextJson = JSON.stringify(runtime.chats.getRunContext(sent.runId).messages);
    expect(contextJson).toContain('请帮我处理这个附件');
    expect(contextJson).not.toContain('private-plan.pdf');
    expect(contextJson).not.toContain('不应发送给模型的附件说明');
  });

  it('exposes a persisted notification through GET /notifications and the tool runtime', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T09:00:00.000Z')),
      credentialStore: new InMemoryCredentialStore(),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    runtime.notifications?.record({
      notificationType: 'REMINDER',
      targetEntityId: null,
      title: '喝水提醒',
      body: '该补充水分了。',
      severity: 'INFO',
      scheduledAt: '2026-08-14T09:00:00.000Z',
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/notifications' });
    expect(response.statusCode).toBe(200);
    expect((JSON.parse(response.body) as { data: unknown }).data).toEqual([
      expect.objectContaining({ notificationType: 'REMINDER', title: '喝水提醒' }),
    ]);
    await expect(
      runtime.tools?.execute({
        callId: 'call_notification',
        name: 'get_notifications',
        argumentsJson: '{}',
      }),
    ).resolves.toEqual([expect.objectContaining({ body: '该补充水分了。' })]);
  });

  it('returns persisted notifications as a provider function-call output', async () => {
    const directory = await createTestDataDirectory();
    const credentials = new InMemoryCredentialStore();
    const requests: ToolCallingRequest[] = [];
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: vi.fn((request: ToolCallingRequest) => {
        requests.push(request);
        return Promise.resolve(
          requests.length === 1
            ? {
                text: '',
                toolCalls: [
                  { callId: 'call_notifications', name: 'get_notifications', argumentsJson: '{}' },
                ],
                providerItems: [{ type: 'function_call', call_id: 'call_notifications' }],
              }
            : { text: '你有一条提醒。', toolCalls: [], providerItems: [] },
        );
      }),
    };
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-14T09:00:00.000Z')),
      credentialStore: credentials,
      openAiProvider: provider,
    });
    await runtime.initialize(directory.path, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    const app = await buildApp({ runtime });
    closers.push(async () => {
      await app.close();
      runtime.close();
      await directory.cleanup();
    });
    runtime.notifications?.record({
      notificationType: 'REMINDER',
      targetEntityId: null,
      title: '喝水提醒',
      body: '该补充水分了。',
      severity: 'INFO',
      scheduledAt: '2026-08-14T09:00:00.000Z',
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/providers',
      payload: { providerType: 'OPENAI', displayName: '通知模型', modelId: 'gpt-4.1-mini' },
    });
    const providerId = responseData(created.body).id as string;
    await app.inject({
      method: 'PUT',
      url: `/api/v1/ai/providers/${providerId}/credential`,
      payload: { secret: 'test-secret' },
    });
    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/chats',
      payload: { title: '通知工具', providerConfigId: providerId },
    });
    const sent = await app.inject({
      method: 'POST',
      url: `/api/v1/ai/chats/${String(responseData(chat.body).id)}/messages`,
      payload: { content: '我有什么提醒？' },
    });
    const runId = String(responseData(sent.body).runId);
    for (
      let attempt = 0;
      attempt < 30 && runtime.chats?.getRun(runId).status !== 'COMPLETED';
      attempt += 1
    )
      await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requests).toHaveLength(2);
    expect(requests[1]?.toolOutputs).toEqual([
      expect.objectContaining({
        callId: 'call_notifications',
        output: [expect.objectContaining({ title: '喝水提醒' })],
      }),
    ]);
  });

  it('reads persisted structured domain fields and scoped statistics through the tool runtime', async () => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock: new FixedClock(new Date('2026-08-17T09:00:00.000Z')),
      credentialStore: new InMemoryCredentialStore(),
    });
    await runtime.initialize(directory.path, {
      includeDemoData: true,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    });
    closers.push(async () => {
      runtime.close();
      await directory.cleanup();
    });
    await expect(
      runtime.tools?.execute({
        callId: 'call_domain',
        name: 'get_domain_record',
        argumentsJson: '{"entityId":"01J5DEMO000000000000000003"}',
      }),
    ).resolves.toMatchObject({
      found: true,
      recordType: 'TASK',
      data: { title: '梳理本周项目重点', priority: 'HIGH' },
    });
    const domainFixtures = [
      ['SELF_MEDIA_CONTENT', '01J5DEMO000000000000000004', 'idea'],
      ['DEV_PROJECT', '01J5DEMO000000000000000005', 'summary'],
      ['LEARNING_RESOURCE', '01J5DEMO000000000000000006', 'progress_total'],
      ['SHOPPING_ITEM', '01J5DEMO000000000000000007', 'planned_unit_price_minor'],
      ['RECIPE', '01J5DEMO000000000000000008', 'protein_g'],
      ['EXERCISE', '01J5DEMO000000000000000009', 'muscle_groups_json'],
      ['ENTERTAINMENT_ITEM', '01J5DEMO000000000000000010', 'progress_unit'],
    ] as const;
    for (const [recordType, entityId, structuredField] of domainFixtures) {
      const result = await runtime.tools?.execute({
        callId: `call_${recordType}`,
        name: 'get_domain_record',
        argumentsJson: JSON.stringify({ recordType, entityId }),
      });
      expect(result).toMatchObject({ found: true, recordType, entityId });
      expect((result as { data: Record<string, unknown> }).data).toHaveProperty(structuredField);
    }
    await expect(
      runtime.tools?.execute({
        callId: 'call_statistics',
        name: 'get_statistics',
        argumentsJson: '{"scope":"WORK","from":"2026-08-01","to":"2026-08-31"}',
      }),
    ).resolves.toMatchObject({ range: { from: '2026-08-01', to: '2026-08-31' } });
  });
});
