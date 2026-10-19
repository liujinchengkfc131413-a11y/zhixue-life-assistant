import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  registerRecordLookupTools,
  registerLowImpactWriteTools,
  registerReadOnlyTools,
  registerStatisticsTool,
  ToolRegistry,
} from './tool-registry.js';

describe('ToolRegistry', () => {
  it('publishes schemas and executes only strictly valid registered calls', async () => {
    const registry = new ToolRegistry();
    const execute = vi.fn(() => Promise.resolve({ count: 1 }));
    registry.register({
      definition: {
        name: 'get_today_schedule',
        description: '读取今日安排',
        parameters: { type: 'object', additionalProperties: false, properties: {} },
      },
      schema: z.object({}).strict(),
      execute,
    });
    await expect(
      registry.execute({ callId: 'call_1', name: 'get_today_schedule', argumentsJson: '{}' }),
    ).resolves.toEqual({ count: 1 });
    await expect(
      registry.execute({
        callId: 'call_2',
        name: 'get_today_schedule',
        argumentsJson: '{"extra":1}',
      }),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    await expect(
      registry.execute({ callId: 'call_3', name: 'unknown', argumentsJson: '{}' }),
    ).rejects.toMatchObject({ code: 'AI_CAPABILITY_UNAVAILABLE' });
    expect(registry.definitions()).toHaveLength(1);
    expect(execute).toHaveBeenCalledWith({});
  });

  it('registers read-only tools with minimal result DTOs', async () => {
    const registry = new ToolRegistry();
    const today = vi.fn(() => ({
      date: '2026-08-14',
      plan: [{ title: '安排' }],
      totals: {},
      pressure: {},
      freeTime: [{ minutes: 30 }],
    }));
    registerReadOnlyTools(registry, {
      today: { getToday: today },
      work: { overview: vi.fn(() => ({ tasks: { total: 1 } })) },
      life: { overview: vi.fn(() => ({ expenses: { total: 2 } })) },
    });
    await expect(
      registry.execute({
        callId: 'call_4',
        name: 'get_free_time',
        argumentsJson: '{"date":"2026-08-14"}',
      }),
    ).resolves.toEqual({ date: '2026-08-14', freeTime: [{ minutes: 30 }] });
    await expect(
      registry.execute({
        callId: 'call_5',
        name: 'get_work_overview',
        argumentsJson: '{"from":"2026-08-14","to":"2026-08-13"}',
      }),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(registry.definitions().map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'get_today_schedule',
        'get_free_time',
        'get_work_overview',
        'get_life_overview',
      ]),
    );
    expect(today).toHaveBeenCalledWith('2026-08-14');
  });

  it('reads a structured domain DTO and reuses scoped statistics services', async () => {
    const registry = new ToolRegistry();
    const workOverview = vi.fn(() => ({ tasks: { total: 2 } }));
    registerRecordLookupTools(registry, {
      information: {
        search: vi.fn(),
        getAiDomainRecord: vi.fn(() => ({
          found: true,
          entityId: 'record_1',
          recordType: 'DEV_PROJECT',
          data: { summary: '真实项目字段' },
        })),
      },
      actions: {
        applyAiChangePlan: <T>(_summary: string, execute: () => T) => ({
          changeSetId: 'change_1',
          result: execute(),
        }),
        getTask: vi.fn(),
        listPlans: vi.fn(() => []),
        listGoals: vi.fn(() => []),
        listTasks: vi.fn(() => []),
      },
    });
    registerStatisticsTool(registry, {
      work: { overview: workOverview },
      life: { overview: vi.fn(() => ({ expenses: { total: 3 } })) },
    });
    await expect(
      registry.execute({
        callId: 'call_6',
        name: 'get_domain_record',
        argumentsJson: '{"entityId":"record_1"}',
      }),
    ).resolves.toEqual({
      found: true,
      entityId: 'record_1',
      recordType: 'DEV_PROJECT',
      data: { summary: '真实项目字段' },
    });
    await expect(
      registry.execute({
        callId: 'call_7',
        name: 'get_statistics',
        argumentsJson: '{"scope":"WORK","from":"2026-08-01","to":"2026-08-14"}',
      }),
    ).resolves.toEqual({ tasks: { total: 2 } });
    expect(workOverview).toHaveBeenCalledWith('2026-08-01', '2026-08-14');
  });

  it('executes single-object low-impact writes only with intent and version metadata', async () => {
    const registry = new ToolRegistry();
    const createTask = vi.fn(() => ({
      id: 'task_1',
      version: 1,
      title: '整理资料',
      status: 'TODO',
    }));
    const updateTask = vi.fn(() => ({
      id: 'task_1',
      version: 2,
      title: '整理资料',
      status: 'TODO',
    }));
    const reschedule = vi.fn();
    registerLowImpactWriteTools(registry, {
      actions: {
        applyAiChangePlan: <T>(_summary: string, execute: () => T) => ({
          changeSetId: 'change_1',
          result: execute(),
        }),
        createTask,
        updateTask,
        transitionTask: vi.fn(() => ({
          id: 'task_1',
          version: 3,
          title: '整理资料',
          status: 'COMPLETED',
        })),
        createGoal: vi.fn(() => ({ id: 'goal_1', version: 1, title: '目标', status: 'ACTIVE' })),
        updateGoal: vi.fn(() => ({ id: 'goal_1', version: 2, title: '目标', status: 'ACTIVE' })),
        createPlan: vi.fn(() => ({ id: 'plan_1', version: 1, title: '计划', status: 'ACTIVE' })),
        updatePlan: vi.fn(() => ({ id: 'plan_1', version: 2, title: '计划', status: 'ACTIVE' })),
        createEvent: vi.fn(() => ({
          id: 'event_1',
          version: 1,
          title: '会议',
          status: 'SCHEDULED',
        })),
        updateEvent: vi.fn(() => ({
          id: 'event_1',
          version: 2,
          title: '会议',
          status: 'SCHEDULED',
        })),
      },
      work: {
        createNoteForEntity: vi.fn(() => ({ id: 'note_1', version: 1, title: '笔记' })),
        updateNote: vi.fn(() => ({ id: 'note_1', version: 2, title: '笔记' })),
      },
      reschedule,
    });
    await expect(
      registry.execute({
        callId: 'call_write_1',
        name: 'create_task',
        argumentsJson: JSON.stringify({
          categoryId: 'category_1',
          title: '整理资料',
          priority: 'NORMAL',
          dueAt: '2026-08-15T09:00:00.000Z',
          estimatedMinutes: 30,
          isFlexible: true,
          isSplittable: false,
          preferredArea: 'WORK',
          userIntentReference: 'message_1',
        }),
      }),
    ).resolves.toEqual({ entityId: 'task_1', version: 1, title: '整理资料', status: 'TODO' });
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: Date.parse('2026-08-15T09:00:00.000Z') }),
    );
    expect(reschedule).toHaveBeenCalledWith('AI_TASK_CREATED');
    await expect(
      registry.execute({
        callId: 'call_write_2',
        name: 'update_task',
        argumentsJson: '{"entityId":"task_1","expectedVersion":1,"title":"已整理"}',
      }),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    await expect(
      registry.execute({
        callId: 'call_write_3',
        name: 'update_task',
        argumentsJson:
          '{"entityId":"task_1","expectedVersion":1,"title":"已整理","userIntentReference":"message_2","unexpected":true}',
      }),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    await registry.execute({
      callId: 'call_write_4',
      name: 'update_task',
      argumentsJson:
        '{"entityId":"task_1","expectedVersion":1,"title":"已整理","userIntentReference":"message_2"}',
    });
    expect(updateTask).toHaveBeenCalledWith('task_1', 1, { title: '已整理' }, undefined);
    await expect(
      registry.execute({
        callId: 'call_plan_1',
        name: 'apply_change_plan',
        argumentsJson: JSON.stringify({
          summary: '创建任务和日程',
          userIntentReference: 'message_3',
          operations: [
            {
              operation: 'CREATE_TASK',
              categoryId: 'category_1',
              title: '准备材料',
              priority: 'NORMAL',
              dueAt: '2026-08-15T09:00:00.000Z',
              estimatedMinutes: 30,
              isFlexible: true,
              isSplittable: false,
              preferredArea: 'WORK',
            },
            {
              operation: 'CREATE_EVENT',
              categoryId: 'category_1',
              title: '评审会议',
              startAt: '2026-08-16T09:00:00.000Z',
              endAt: '2026-08-16T10:00:00.000Z',
              eventType: 'MEETING',
              priority: 'HIGH',
            },
          ],
        }),
      }),
    ).resolves.toMatchObject({
      changeSetId: 'change_1',
      operations: [{ entityId: 'task_1' }, { entityId: 'event_1' }],
    });
    expect(reschedule).toHaveBeenCalledWith('AI_CHANGE_PLAN_APPLIED');
    const createTaskParameters = registry
      .definitions()
      .find((tool) => tool.name === 'create_task')?.parameters;
    expect(createTaskParameters).toMatchObject({
      additionalProperties: false,
      properties: { userIntentReference: { type: 'string' } },
    });
    expect(createTaskParameters?.required).toContain('userIntentReference');
  });
});
