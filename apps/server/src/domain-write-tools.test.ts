import { describe, expect, it, vi } from 'vitest';

import type { AiToolExecutionContext, OperationContext } from '@life-assistant/database';

import type { AiWriteExecutor } from './ai-write-executor.js';
import {
  registerDomainWriteTools,
  registerHighRiskActionTools,
  registerOperationalWriteTools,
  type DomainWriteAdapter,
} from './domain-write-tools.js';
import { ToolRegistry } from './tool-registry.js';

const execution: AiToolExecutionContext = {
  sessionId: 'session-1',
  runId: 'run-1',
  providerConfigId: 'provider-1',
  modelId: 'model-1',
  userMessageId: 'user-message-1',
  assistantMessageId: 'assistant-message-1',
  toolCallId: 'tool-call-1',
  toolName: 'create_domain_record',
  userIntentReference: 'user-message-1',
};
const operationContext: OperationContext = {
  source: 'AI',
  sourceRef: 'ai-run:run-1',
  actorRef: 'provider-1:model-1',
};

describe('A14 domain write tools', () => {
  it('routes create and versioned update through the shared AI change-set executor', async () => {
    const create = vi.fn(() => ({ id: 'recipe-1', version: 1 }));
    const update = vi.fn(() => ({ id: 'recipe-1', version: 2 }));
    const domain: DomainWriteAdapter = { create, update };
    let executeCalls = 0;
    const executor: Pick<AiWriteExecutor, 'execute'> = {
      execute: <T>(input: { mutate: (context: OperationContext) => T }) => {
        executeCalls += 1;
        return {
          changeSetId: 'change-1',
          operations: [{ sequence: 0, entityId: 'recipe-1', operation: 'CREATE' }],
          result: input.mutate(operationContext),
        };
      },
    };
    const registry = new ToolRegistry();
    registerDomainWriteTools(registry, domain, executor);

    await expect(
      registry.execute(
        {
          callId: 'create-1',
          name: 'create_domain_record',
          argumentsJson: JSON.stringify({
            recordType: 'RECIPE',
            data: { categoryId: 'diet', name: '燕麦粥', servings: 1, proteinG: 12 },
            userIntentReference: 'user-message-1',
          }),
        },
        execution,
      ),
    ).resolves.toMatchObject({ changeSetId: 'change-1', result: { version: 1 } });
    expect(create).toHaveBeenCalledWith(
      'RECIPE',
      { categoryId: 'diet', name: '燕麦粥', servings: 1, proteinG: 12 },
      operationContext,
    );

    await registry.execute(
      {
        callId: 'update-1',
        name: 'update_domain_record',
        argumentsJson: JSON.stringify({
          recordType: 'RECIPE',
          entityId: 'recipe-1',
          expectedVersion: 1,
          patch: { proteinG: 15 },
          userIntentReference: 'user-message-1',
        }),
      },
      { ...execution, toolName: 'update_domain_record' },
    );
    expect(update).toHaveBeenCalledWith(
      'RECIPE',
      'recipe-1',
      1,
      { proteinG: 15 },
      operationContext,
    );
    expect(executeCalls).toBe(2);
  });

  it('rejects missing intent, unknown fields, invalid domain values and missing execution context', async () => {
    const domain: DomainWriteAdapter = { create: vi.fn(), update: vi.fn() };
    const execute = vi.fn();
    const registry = new ToolRegistry();
    registerDomainWriteTools(registry, domain, { execute });

    for (const argumentsJson of [
      JSON.stringify({ recordType: 'RECIPE', data: { categoryId: 'diet', name: '粥' } }),
      JSON.stringify({
        recordType: 'RECIPE',
        data: { categoryId: 'diet', name: '粥', attachmentBody: 'forbidden' },
        userIntentReference: 'intent',
      }),
      JSON.stringify({
        recordType: 'SHOPPING_ITEM',
        data: { categoryId: 'shopping', name: '牛奶', quantity: -1 },
        userIntentReference: 'intent',
      }),
    ]) {
      await expect(
        registry.execute(
          { callId: 'invalid', name: 'create_domain_record', argumentsJson },
          execution,
        ),
      ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    }
    await expect(
      registry.execute({
        callId: 'no-context',
        name: 'create_domain_record',
        argumentsJson: JSON.stringify({
          recordType: 'RECIPE',
          data: { categoryId: 'diet', name: '粥' },
          userIntentReference: 'intent',
        }),
      }),
    ).rejects.toThrow('AI_WRITE_CONTEXT_REQUIRED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('publishes both tools as low-risk writes', () => {
    const registry = new ToolRegistry();
    registerDomainWriteTools(registry, { create: vi.fn(), update: vi.fn() }, { execute: vi.fn() });
    expect(registry.riskLevel('create_domain_record')).toBe('LOW_WRITE');
    expect(registry.riskLevel('update_domain_record')).toBe('LOW_WRITE');
  });

  it('adds reminders and restores change sets through audited domain services', async () => {
    const createReminder = vi.fn(() => ({ id: 'reminder-1', version: 1 }));
    const restore = vi.fn(() => ({ undoChangeSetId: 'undo-1' }));
    const reschedule = vi.fn(() => ({ id: 'schedule-run-1', status: 'APPLIED' }));
    const executor: Pick<AiWriteExecutor, 'execute'> = {
      execute: <T>(input: { mutate: (context: OperationContext) => T }) => ({
        changeSetId: 'change-2',
        operations: [{ sequence: 0, entityId: 'reminder-1', operation: 'CREATE' }],
        result: input.mutate(operationContext),
      }),
    };
    const registry = new ToolRegistry();
    registerOperationalWriteTools(
      registry,
      { reminders: { create: createReminder }, actions: { undoAiChangeSet: restore }, reschedule },
      executor,
    );

    await registry.execute(
      {
        callId: 'reminder-call',
        name: 'add_reminder',
        argumentsJson: JSON.stringify({
          targetEntityId: 'task-1',
          triggerMode: 'OFFSET_BEFORE_DUE',
          offsetMinutes: 30,
          userIntentReference: 'user-message-1',
        }),
      },
      { ...execution, toolName: 'add_reminder' },
    );
    expect(createReminder).toHaveBeenCalledWith(
      { targetEntityId: 'task-1', triggerMode: 'OFFSET_BEFORE_DUE', offsetMinutes: 30 },
      operationContext,
    );

    await registry.execute(
      {
        callId: 'restore-call',
        name: 'restore_change_set',
        argumentsJson: JSON.stringify({
          changeSetId: 'change-original',
          userIntentReference: 'user-message-1',
        }),
      },
      { ...execution, toolName: 'restore_change_set' },
    );
    expect(restore).toHaveBeenCalledWith('change-original', operationContext);

    await registry.execute(
      {
        callId: 'reschedule-call',
        name: 'request_reschedule',
        argumentsJson: JSON.stringify({
          rangeStart: '2026-09-05T00:00:00.000Z',
          rangeEnd: '2026-09-06T00:00:00.000Z',
          reason: '调整明日安排',
          userIntentReference: 'user-message-1',
        }),
      },
      { ...execution, toolName: 'request_reschedule' },
    );
    expect(reschedule).toHaveBeenCalledWith(
      Date.parse('2026-09-05T00:00:00.000Z'),
      Date.parse('2026-09-06T00:00:00.000Z'),
      'AI_REQUEST:调整明日安排',
      operationContext,
    );
    expect(registry.riskLevel('add_reminder')).toBe('LOW_WRITE');
    expect(registry.riskLevel('restore_change_set')).toBe('LOW_WRITE');
    expect(registry.riskLevel('request_reschedule')).toBe('LOW_WRITE');
  });

  it('rejects incomplete reminder modes before writing', async () => {
    const registry = new ToolRegistry();
    const create = vi.fn();
    registerOperationalWriteTools(
      registry,
      {
        reminders: { create },
        actions: { undoAiChangeSet: vi.fn() },
        reschedule: vi.fn(),
      },
      { execute: vi.fn() },
    );
    await expect(
      registry.execute(
        {
          callId: 'invalid-reminder',
          name: 'add_reminder',
          argumentsJson: JSON.stringify({
            targetEntityId: 'task-1',
            triggerMode: 'ABSOLUTE',
            userIntentReference: 'user-message-1',
          }),
        },
        execution,
      ),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(create).not.toHaveBeenCalled();
  });

  it('turns destructive tools into persisted confirmation proposals without executing writes', async () => {
    const createAction = vi.fn((input: { actionType: string }) => ({
      id: `action-${input.actionType}`,
      status: 'AWAITING_CONFIRMATION',
    }));
    const registry = new ToolRegistry();
    registerHighRiskActionTools(registry, {
      consistency: {
        createConfirmation: (operationType) => ({
          id: `confirmation-${operationType}`,
          expiresAt: '2026-09-05T00:00:00.000Z',
        }),
      },
      aiActions: { create: createAction },
      readRecord: (_recordType, entityId) => ({
        found: true,
        entityId,
        data: { title: '目标记录' },
      }),
      memoryCount: () => 3,
      recycleCount: () => 2,
    });
    const cases = [
      [
        'delete_record',
        {
          recordType: 'TASK',
          entityId: 'task-1',
          expectedVersion: 1,
          userIntentReference: 'intent',
        },
      ],
      [
        'bulk_update_records',
        {
          operations: [
            {
              recordType: 'RECIPE',
              entityId: 'recipe-1',
              expectedVersion: 1,
              patch: { proteinG: 10 },
            },
            {
              recordType: 'RECIPE',
              entityId: 'recipe-2',
              expectedVersion: 2,
              patch: { servings: 2 },
            },
          ],
          userIntentReference: 'intent',
        },
      ],
      ['clear_ai_memory', { userIntentReference: 'intent' }],
      ['empty_recycle_bin', { userIntentReference: 'intent' }],
    ] as const;
    for (const [name, input] of cases) {
      await expect(
        registry.execute(
          { callId: name, name, argumentsJson: JSON.stringify(input) },
          { ...execution, toolName: name },
        ),
      ).resolves.toMatchObject({ status: 'AWAITING_CONFIRMATION' });
      expect(registry.riskLevel(name)).toBe('HIGH_WRITE');
    }
    expect(createAction).toHaveBeenCalledTimes(4);
  });
});
