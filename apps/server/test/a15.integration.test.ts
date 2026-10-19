import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryCredentialStore, type ToolCallingRequest } from '@life-assistant/ai-adapters';
import { createUserOperationContext, type AiToolExecutionContext } from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { LocalRuntime } from '../src/runtime-probe.js';

const clock = new FixedClock(new Date('2026-08-14T00:00:00.000Z'));

describe('A15 AI write audit, change-set cards and undo', () => {
  const closers: (() => Promise<void>)[] = [];

  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  const initialize = async (provider: {
    providerType: 'OPENAI';
    verify: () => Promise<{
      chat: boolean;
      streaming: boolean;
      toolCalling: boolean;
      nativeWebSearch: boolean;
    }>;
    executeTools: (request: ToolCallingRequest) => Promise<{
      text: string;
      toolCalls: { callId: string; name: string; argumentsJson: string }[];
      providerItems: unknown[];
    }>;
  }) => {
    const directory = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${directory.path}/bootstrap.json`,
      suggestedDataDirectory: directory.path,
      clock,
      credentialStore: new InMemoryCredentialStore(),
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
      displayName: 'A15 测试模型',
      modelId: 'gpt-4.1-mini',
    });
    if (
      config === undefined ||
      runtime.chats === undefined ||
      runtime.chatRunner === undefined ||
      runtime.actions === undefined ||
      runtime.database === undefined
    )
      throw new Error('Test runtime was not initialized.');
    await runtime.putAiCredential(config.id, 'test-secret');
    return {
      runtime,
      config,
      chats: runtime.chats,
      chatRunner: runtime.chatRunner,
      actions: runtime.actions,
      database: runtime.database,
    };
  };

  it('keeps a committed AI write and its operation card when the provider fails afterwards', async () => {
    let categoryId = '';
    let userMessageId = '';
    let round = 0;
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: vi.fn((_request: ToolCallingRequest) => {
        round += 1;
        if (round > 1)
          return Promise.reject(
            Object.assign(new Error('provider failed'), { code: 'AI_UNAVAILABLE' }),
          );
        return Promise.resolve({
          text: '',
          toolCalls: [
            {
              callId: 'call_create_task',
              name: 'create_task',
              argumentsJson: JSON.stringify({
                categoryId,
                title: '保留已经写入的任务',
                priority: 'NORMAL',
                dueAt: '2026-08-15T09:00:00.000Z',
                estimatedMinutes: 30,
                isFlexible: true,
                isSplittable: false,
                preferredArea: 'WORK',
                userIntentReference: userMessageId,
              }),
            },
          ],
          providerItems: [{ type: 'function_call', call_id: 'call_create_task' }],
        });
      }),
    };
    const { runtime, config, chats, chatRunner, actions, database } = await initialize(provider);
    categoryId =
      runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK')?.id ?? '';
    const session = chats.createSession({ title: '失败后保留卡片', providerConfigId: config.id });
    const sent = chats.sendMessage(String(session.id), '创建一个任务');
    userMessageId = sent.userMessageId;

    await chatRunner.run(sent.runId);

    expect(chats.getRun(sent.runId)).toMatchObject({
      status: 'FAILED',
      errorCode: 'AI_UNAVAILABLE',
    });
    expect(actions.listTasks({ includeCompleted: true })).toEqual([
      expect.objectContaining({ title: '保留已经写入的任务' }),
    ]);
    const toolCall = database.raw
      .prepare('SELECT * FROM ai_tool_calls WHERE provider_call_id=?')
      .get('call_create_task') as Record<string, unknown>;
    expect(toolCall).toMatchObject({
      run_id: sent.runId,
      provider_config_id: config.id,
      model_id: 'gpt-4.1-mini',
      user_message_id: sent.userMessageId,
      assistant_message_id: sent.assistantMessageId,
      tool_name: 'create_task',
      user_intent_reference: sent.userMessageId,
      status: 'SUCCEEDED',
    });
    expect(toolCall.change_set_id).toEqual(expect.any(String));
    expect(
      database.raw
        .prepare('SELECT source,source_ref,actor_ref,status FROM change_sets WHERE id=?')
        .get(String(toolCall.change_set_id)),
    ).toMatchObject({
      source: 'AI',
      source_ref: `ai-run:${sent.runId}`,
      actor_ref: `ai-tool-call:${String(toolCall.id)}`,
      status: 'APPLIED',
    });
    const operation = database.raw
      .prepare('SELECT before_json,after_json FROM change_operations WHERE change_set_id=?')
      .get(String(toolCall.change_set_id)) as { before_json: string | null; after_json: string };
    expect(operation.before_json).toBeNull();
    expect(JSON.parse(operation.after_json)).toMatchObject({
      contractVersion: 1,
      entityType: 'TASK',
      canonicalState: { title: '保留已经写入的任务' },
    });
    const assistant = chats
      .listMessages(String(session.id))
      .find((message) => message.id === sent.assistantMessageId);
    expect(assistant?.status).toBe('FAILED');
    if (!Array.isArray(assistant?.content)) throw new Error('Missing assistant content parts.');
    const contentParts: unknown[] = assistant.content;
    expect(contentParts).toContainEqual({
      type: 'change_set',
      changeSetId: String(toolCall.change_set_id),
    });
  });

  it('restores an AI update through a new USER undo change set', async () => {
    let taskId = '';
    let taskVersion = 0;
    let userMessageId = '';
    let round = 0;
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: vi.fn((_request: ToolCallingRequest) => {
        round += 1;
        return Promise.resolve(
          round === 1
            ? {
                text: '',
                toolCalls: [
                  {
                    callId: 'call_update_task',
                    name: 'update_task',
                    argumentsJson: JSON.stringify({
                      entityId: taskId,
                      expectedVersion: taskVersion,
                      title: 'AI 修改后的标题',
                      userIntentReference: userMessageId,
                    }),
                  },
                ],
                providerItems: [{ type: 'function_call', call_id: 'call_update_task' }],
              }
            : { text: '已经修改。', toolCalls: [], providerItems: [] },
        );
      }),
    };
    const { runtime, config, chats, chatRunner, actions, database } = await initialize(provider);
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    if (category === undefined) throw new Error('Missing category.');
    const original = actions.createTask({
      categoryId: category.id,
      title: '原始标题',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-08-15T09:00:00.000Z'),
      estimatedMinutes: 30,
      isFlexible: true,
      preferredArea: 'WORK',
    });
    taskId = original.id;
    taskVersion = original.version;
    const session = chats.createSession({ title: '撤销更新', providerConfigId: config.id });
    const sent = chats.sendMessage(String(session.id), '修改任务标题');
    userMessageId = sent.userMessageId;

    await chatRunner.run(sent.runId);

    expect(actions.getTask(taskId)).toMatchObject({ title: 'AI 修改后的标题' });
    const toolCall = database.raw
      .prepare('SELECT change_set_id FROM ai_tool_calls WHERE provider_call_id=?')
      .get('call_update_task') as { change_set_id: string };
    const operation = database.raw
      .prepare('SELECT before_json,after_json FROM change_operations WHERE change_set_id=?')
      .get(toolCall.change_set_id) as { before_json: string; after_json: string };
    expect(JSON.parse(operation.before_json)).toMatchObject({
      canonicalState: { title: '原始标题' },
    });
    expect(JSON.parse(operation.after_json)).toMatchObject({
      canonicalState: { title: 'AI 修改后的标题' },
    });

    const undone = actions.undoAiChangeSet(
      toolCall.change_set_id,
      createUserOperationContext({ requestId: 'request_undo_a15' }),
    );

    expect(actions.getTask(taskId)).toMatchObject({ title: '原始标题' });
    expect(
      database.raw.prepare('SELECT status FROM change_sets WHERE id=?').get(toolCall.change_set_id),
    ).toMatchObject({ status: 'REVERTED' });
    if (!('undoChangeSetId' in undone)) throw new Error('Missing undo change set.');
    expect(
      database.raw
        .prepare('SELECT source,status FROM change_sets WHERE id=?')
        .get(undone.undoChangeSetId),
    ).toMatchObject({
      source: 'USER',
      status: 'APPLIED',
    });
  });

  it('records and can undo an AI memory with the originating session and tool context', async () => {
    let userMessageId = '';
    let round = 0;
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: vi.fn((_request: ToolCallingRequest) => {
        round += 1;
        return Promise.resolve(
          round === 1
            ? {
                text: '',
                toolCalls: [
                  {
                    callId: 'call_remember',
                    name: 'remember_user_preference',
                    argumentsJson: JSON.stringify({
                      memoryType: 'PREFERENCE',
                      content: '偏好早晨处理深度工作',
                      confidence: 0.9,
                      userIntentReference: userMessageId,
                    }),
                  },
                ],
                providerItems: [{ type: 'function_call', call_id: 'call_remember' }],
              }
            : { text: '记住了。', toolCalls: [], providerItems: [] },
        );
      }),
    };
    const { runtime, config, chats, chatRunner, actions, database } = await initialize(provider);
    if (runtime.aiMemories === undefined) throw new Error('Missing AI memory repository.');
    const session = chats.createSession({ title: 'AI 记忆审计', providerConfigId: config.id });
    const sent = chats.sendMessage(String(session.id), '请记住我偏好早晨深度工作');
    userMessageId = sent.userMessageId;

    await chatRunner.run(sent.runId);

    const memory = runtime.aiMemories.listActive()[0];
    expect(memory).toMatchObject({ content: '偏好早晨处理深度工作' });
    expect(
      database.raw.prepare('SELECT source_session_id FROM ai_memories WHERE id=?').get(memory?.id),
    ).toMatchObject({ source_session_id: String(session.id) });
    const toolCall = database.raw
      .prepare('SELECT id,change_set_id FROM ai_tool_calls WHERE provider_call_id=?')
      .get('call_remember') as { id: string; change_set_id: string };
    expect(
      database.raw
        .prepare('SELECT source,actor_ref FROM change_sets WHERE id=?')
        .get(toolCall.change_set_id),
    ).toMatchObject({ source: 'AI', actor_ref: `ai-tool-call:${toolCall.id}` });

    const undone = actions.undoAiChangeSet(
      toolCall.change_set_id,
      createUserOperationContext({ requestId: 'request_undo_memory' }),
    );
    expect(undone).toMatchObject({ status: 'REVERTED' });
    expect(runtime.aiMemories.listActive()).toHaveLength(0);
  });

  it('keeps inbox processing and every created object in one attributed change set', async () => {
    let inboxItemId = '';
    let inboxVersion = 0;
    let categoryId = '';
    let shoppingCategoryId = '';
    let fitnessCategoryId = '';
    let userMessageId = '';
    let round = 0;
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: vi.fn((_request: ToolCallingRequest) => {
        round += 1;
        return Promise.resolve(
          round === 1
            ? {
                text: '',
                toolCalls: [
                  {
                    callId: 'call_process_inbox',
                    name: 'process_inbox_item',
                    argumentsJson: JSON.stringify({
                      inboxItemId,
                      expectedVersion: inboxVersion,
                      userIntentReference: userMessageId,
                      results: [
                        {
                          resultType: 'TASK',
                          categoryId,
                          title: '从收件箱创建的任务',
                          priority: 'NORMAL',
                          dueAt: Date.parse('2026-08-15T09:00:00.000Z'),
                          estimatedMinutes: 30,
                          isFlexible: true,
                          preferredArea: 'WORK',
                        },
                        {
                          resultType: 'SHOPPING_ITEM',
                          categoryId: shoppingCategoryId,
                          name: '牛奶',
                          quantity: 1,
                          priority: 'NORMAL',
                        },
                        {
                          resultType: 'GOAL',
                          categoryId: fitnessCategoryId,
                          title: '减重两公斤',
                          description: '身体指标目标',
                          goalType: 'OUTCOME',
                          startDate: '2026-08-14',
                          endDate: '2026-09-30',
                        },
                      ],
                    }),
                  },
                ],
                providerItems: [{ type: 'function_call', call_id: 'call_process_inbox' }],
              }
            : { text: '收件箱已处理。', toolCalls: [], providerItems: [] },
        );
      }),
    };
    const { runtime, config, chats, chatRunner, database } = await initialize(provider);
    if (runtime.inbox === undefined) throw new Error('Missing inbox repository.');
    categoryId =
      runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK')?.id ?? '';
    shoppingCategoryId =
      runtime.shared?.listCategories().find((item) => item.moduleType === 'SHOPPING')?.id ?? '';
    fitnessCategoryId =
      runtime.shared?.listCategories().find((item) => item.moduleType === 'FITNESS')?.id ?? '';
    const inboxItem = runtime.inbox.capture(
      '周五前完成项目首页，今晚买牛奶，下个月减重两公斤。',
      'AI_PROCESS',
    );
    inboxItemId = inboxItem.id;
    inboxVersion = inboxItem.version;
    const session = chats.createSession({ title: 'Inbox AI 审计', providerConfigId: config.id });
    const sent = chats.sendMessage(String(session.id), '把这条收件箱内容跨模块整理');
    userMessageId = sent.userMessageId;

    await chatRunner.run(sent.runId);

    const toolCall = database.raw
      .prepare('SELECT id,change_set_id FROM ai_tool_calls WHERE provider_call_id=?')
      .get('call_process_inbox') as { id: string; change_set_id: string };
    const processed = runtime.inbox.get(inboxItem.id);
    if (processed === undefined) throw new Error('Missing processed inbox item.');
    expect(processed.processedChangeSetId).toBe(toolCall.change_set_id);
    expect(
      database.raw
        .prepare(
          'SELECT entity_id,operation FROM change_operations WHERE change_set_id=? ORDER BY sequence',
        )
        .all(toolCall.change_set_id),
    ).toEqual([
      expect.objectContaining({ operation: 'CREATE' }),
      expect.objectContaining({ operation: 'CREATE' }),
      expect.objectContaining({ operation: 'CREATE' }),
      expect.objectContaining({ entity_id: inboxItem.id, operation: 'UPDATE' }),
    ]);
    expect(
      database.raw
        .prepare('SELECT source,actor_ref FROM change_sets WHERE id=?')
        .get(toolCall.change_set_id),
    ).toMatchObject({ source: 'AI', actor_ref: `ai-tool-call:${toolCall.id}` });
    expect(processed.results.map((result) => result.resultType)).toEqual([
      'TASK',
      'SHOPPING_ITEM',
      'GOAL',
    ]);
    const assistant = chats
      .listMessages(String(session.id))
      .find((message) => message.id === sent.assistantMessageId);
    expect(assistant?.content).toContainEqual({
      type: 'change_set',
      changeSetId: toolCall.change_set_id,
    });
  });

  it('executes a confirmed long-term goal replacement through the original AI context', async () => {
    let goalId = '';
    let goalVersion = 0;
    let userMessageId = '';
    let round = 0;
    const provider = {
      providerType: 'OPENAI' as const,
      verify: () =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      executeTools: vi.fn((_request: ToolCallingRequest) => {
        round += 1;
        return Promise.resolve(
          round === 1
            ? {
                text: '',
                toolCalls: [
                  {
                    callId: 'call_replace_goal_a15',
                    name: 'replace_long_term_goal',
                    argumentsJson: JSON.stringify({
                      goalId,
                      expectedVersion: goalVersion,
                      title: '确认后的长期目标',
                      userIntentReference: userMessageId,
                    }),
                  },
                ],
                providerItems: [{ type: 'function_call', call_id: 'call_replace_goal_a15' }],
              }
            : { text: '请确认是否替换长期目标。', toolCalls: [], providerItems: [] },
        );
      }),
    };
    const { runtime, config, chats, chatRunner, actions, database } = await initialize(provider);
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'WORK');
    if (category === undefined) throw new Error('Missing category.');
    const goal = actions.createGoal({
      categoryId: category.id,
      title: '原长期目标',
      goalType: 'OUTCOME',
      startDate: '2026-08-14',
      endDate: '2027-08-14',
    });
    goalId = goal.id;
    goalVersion = goal.version;
    const session = chats.createSession({ title: '高风险确认审计', providerConfigId: config.id });
    const sent = chats.sendMessage(String(session.id), '将我的长期目标替换为新目标');
    userMessageId = sent.userMessageId;

    await chatRunner.run(sent.runId);

    const action = database.raw
      .prepare('SELECT id FROM ai_actions ORDER BY id DESC LIMIT 1')
      .get() as { id: string };
    expect(actions.listGoals().find((item) => item.id === goal.id)).toMatchObject({
      title: '原长期目标',
    });
    runtime.confirmAiAction(action.id);
    expect(actions.listGoals().find((item) => item.id === goal.id)).toMatchObject({
      title: '确认后的长期目标',
    });
    const toolCall = database.raw
      .prepare('SELECT id,change_set_id FROM ai_tool_calls WHERE provider_call_id=?')
      .get('call_replace_goal_a15') as { id: string; change_set_id: string };
    expect(
      database.raw
        .prepare('SELECT source,actor_ref,risk_level FROM change_sets WHERE id=?')
        .get(toolCall.change_set_id),
    ).toMatchObject({
      source: 'AI',
      actor_ref: `ai-action:${action.id}`,
      risk_level: 'HIGH_WRITE',
    });
    const assistant = chats
      .listMessages(String(session.id))
      .find((message) => message.id === sent.assistantMessageId);
    if (!Array.isArray(assistant?.content)) throw new Error('Missing assistant content parts.');
    const parts: unknown[] = assistant.content;
    expect(parts).toContainEqual({ type: 'change_set', changeSetId: toolCall.change_set_id });
  });

  it('executes confirmed high-risk domain actions atomically with action-linked A15 audit', async () => {
    const provider = {
      providerType: 'OPENAI' as const,
      verify: vi.fn(() =>
        Promise.resolve({ chat: true, streaming: true, toolCalling: true, nativeWebSearch: false }),
      ),
      executeTools: vi.fn(() =>
        Promise.resolve({ text: 'unused', toolCalls: [], providerItems: [] }),
      ),
    };
    const { runtime, config, chats, database } = await initialize(provider);
    const category = runtime.shared?.listCategories().find((item) => item.parentArea === 'LIFE');
    if (
      category === undefined ||
      runtime.tools === undefined ||
      runtime.aiMemories === undefined ||
      runtime.information === undefined
    )
      throw new Error('Missing high-risk action dependencies.');
    const tools = runtime.tools;
    const information = runtime.information;
    const session = chats.createSession({ title: 'A14/A16 联合验收', providerConfigId: config.id });
    let sequence = 0;
    const executeTool = async (name: string, input: Record<string, unknown>) => {
      sequence += 1;
      const sent = chats.sendMessage(String(session.id), `执行 ${name} ${String(sequence)}`);
      const argumentsJson = JSON.stringify({ ...input, userIntentReference: sent.userMessageId });
      const toolCall = chats.startToolCall({
        runId: sent.runId,
        providerConfigId: config.id,
        modelId: config.modelId,
        providerCallId: `high_risk_${String(sequence)}`,
        toolName: name,
        argumentsJson,
        userIntentReference: sent.userMessageId,
        riskLevel: tools.riskLevel(name),
      });
      const context: AiToolExecutionContext = {
        sessionId: toolCall.sessionId,
        runId: sent.runId,
        providerConfigId: config.id,
        modelId: config.modelId,
        userMessageId: toolCall.userMessageId,
        assistantMessageId: toolCall.assistantMessageId,
        toolCallId: toolCall.id,
        toolName: name,
        userIntentReference: sent.userMessageId,
      };
      const result = await tools.execute({ callId: toolCall.id, name, argumentsJson }, context);
      chats.completeToolCall(toolCall.id, result);
      return { result, sent, toolCall };
    };
    const createShoppingItem = async (name: string) => {
      const output = await executeTool('create_domain_record', {
        recordType: 'SHOPPING_ITEM',
        data: { categoryId: category.id, name, quantity: 1, priority: 'NORMAL' },
      });
      return (output.result as { result: { id: string; version: number } }).result;
    };
    const first = await createShoppingItem('原子更新甲');
    const second = await createShoppingItem('原子更新乙');

    const bulk = await executeTool('bulk_update_records', {
      operations: [
        {
          recordType: 'SHOPPING_ITEM',
          entityId: first.id,
          expectedVersion: 1,
          patch: { name: '已更新甲' },
        },
        {
          recordType: 'SHOPPING_ITEM',
          entityId: second.id,
          expectedVersion: 999,
          patch: { name: '不应更新乙' },
        },
      ],
    });
    const bulkActionId = (bulk.result as { actionId: string }).actionId;
    expect(information.getAiDomainRecord('SHOPPING_ITEM', first.id)?.data).toMatchObject({
      name: '原子更新甲',
    });
    expect(() => runtime.confirmAiAction(bulkActionId)).toThrow();
    expect(information.getAiDomainRecord('SHOPPING_ITEM', first.id)?.data).toMatchObject({
      name: '原子更新甲',
    });
    expect(runtime.aiActions?.get(bulkActionId)).toMatchObject({ status: 'FAILED' });

    const deletion = await executeTool('delete_record', {
      recordType: 'SHOPPING_ITEM',
      entityId: first.id,
      expectedVersion: 1,
    });
    const deleteActionId = (deletion.result as { actionId: string }).actionId;
    expect(information.getAiDomainRecord('SHOPPING_ITEM', first.id)).toBeDefined();
    runtime.confirmAiAction(deleteActionId);
    expect(information.getAiDomainRecord('SHOPPING_ITEM', first.id)).toBeUndefined();
    const deletionTool = database.raw
      .prepare('SELECT change_set_id FROM ai_tool_calls WHERE id=?')
      .get(deletion.toolCall.id) as { change_set_id: string };
    expect(
      database.raw
        .prepare('SELECT source,actor_ref,risk_level,status FROM change_sets WHERE id=?')
        .get(deletionTool.change_set_id),
    ).toMatchObject({
      source: 'AI',
      actor_ref: `ai-action:${deleteActionId}`,
      risk_level: 'HIGH_WRITE',
      status: 'APPLIED',
    });

    const empty = await executeTool('empty_recycle_bin', {});
    const emptyActionId = (empty.result as { actionId: string }).actionId;
    expect(
      database.raw.prepare('SELECT id FROM entity_index WHERE id=?').get(first.id),
    ).toBeDefined();
    runtime.confirmAiAction(emptyActionId);
    expect(
      database.raw.prepare('SELECT id FROM entity_index WHERE id=?').get(first.id),
    ).toBeUndefined();
    expect(runtime.aiActions?.get(emptyActionId)).toMatchObject({ status: 'EXECUTED' });

    const third = await createShoppingItem('批量成功甲');
    const fourth = await createShoppingItem('批量成功乙');
    const successfulBulk = await executeTool('bulk_update_records', {
      operations: [
        {
          recordType: 'SHOPPING_ITEM',
          entityId: third.id,
          expectedVersion: 1,
          patch: { name: '批量完成甲' },
        },
        {
          recordType: 'SHOPPING_ITEM',
          entityId: fourth.id,
          expectedVersion: 1,
          patch: { name: '批量完成乙' },
        },
      ],
    });
    const successfulBulkId = (successfulBulk.result as { actionId: string }).actionId;
    runtime.confirmAiAction(successfulBulkId);
    expect(information.getAiDomainRecord('SHOPPING_ITEM', third.id)?.data).toMatchObject({
      name: '批量完成甲',
    });
    expect(information.getAiDomainRecord('SHOPPING_ITEM', fourth.id)?.data).toMatchObject({
      name: '批量完成乙',
    });
    const bulkTool = database.raw
      .prepare('SELECT change_set_id FROM ai_tool_calls WHERE id=?')
      .get(successfulBulk.toolCall.id) as { change_set_id: string };
    expect(
      database.raw
        .prepare('SELECT COUNT(*) AS count FROM change_operations WHERE change_set_id=?')
        .get(bulkTool.change_set_id),
    ).toMatchObject({ count: 2 });

    runtime.aiMemories.remember({
      memoryType: 'PREFERENCE',
      content: '喜欢联合验收',
      confidence: 0.9,
      sourceSessionId: String(session.id),
    });
    const clear = await executeTool('clear_ai_memory', {});
    const clearActionId = (clear.result as { actionId: string }).actionId;
    expect(runtime.aiMemories.listActive()).toHaveLength(1);
    runtime.cancelAiAction(clearActionId);
    expect(runtime.aiMemories.listActive()).toHaveLength(1);

    const clearConfirmed = await executeTool('clear_ai_memory', {});
    const clearConfirmedId = (clearConfirmed.result as { actionId: string }).actionId;
    runtime.confirmAiAction(clearConfirmedId);
    expect(runtime.aiMemories.listActive()).toHaveLength(0);
    expect(runtime.aiActions?.get(clearConfirmedId)).toMatchObject({ status: 'EXECUTED' });

    const assistant = chats
      .listMessages(String(session.id))
      .find((message) => message.id === deletion.sent.assistantMessageId);
    expect(assistant?.content).toContainEqual({ type: 'ai_action', actionId: deleteActionId });
  });
});
