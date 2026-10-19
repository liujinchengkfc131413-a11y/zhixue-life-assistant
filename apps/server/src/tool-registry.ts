import {
  AiProviderError,
  type ToolCall,
  type ToolDefinition,
  type ToolRuntime,
} from '@life-assistant/ai-adapters';
import { z } from 'zod';
import type {
  AiMemoryRepository,
  AiActionType,
  AiToolExecutionContext,
  ManualInboxResult,
  OperationContext,
} from '@life-assistant/database';

import type { AiWriteExecutor } from './ai-write-executor.js';

export interface RegisteredTool<TSchema extends z.ZodType = z.ZodType> {
  readonly definition: ToolDefinition;
  readonly schema: TSchema;
  readonly riskLevel?: 'READ_ONLY' | 'LOW_WRITE' | 'HIGH_WRITE';
  readonly execute: (
    input: z.output<TSchema>,
    context?: AiToolExecutionContext,
  ) => Promise<unknown>;
}

/** Controlled bridge from model function calls to application services. */
export class ToolRegistry implements ToolRuntime {
  private readonly entries = new Map<string, RegisteredTool>();

  public register<TSchema extends z.ZodType>(tool: RegisteredTool<TSchema>): void {
    if (this.entries.has(tool.definition.name)) throw new Error('AI_TOOL_ALREADY_REGISTERED');
    this.entries.set(tool.definition.name, tool);
  }

  public definitions(): readonly ToolDefinition[] {
    return [...this.entries.values()].map((tool) => tool.definition);
  }

  public riskLevel(name: string): 'READ_ONLY' | 'LOW_WRITE' | 'HIGH_WRITE' {
    return this.entries.get(name)?.riskLevel ?? 'READ_ONLY';
  }

  public async execute(call: ToolCall, context?: AiToolExecutionContext): Promise<unknown> {
    const tool = this.entries.get(call.name);
    if (tool === undefined)
      throw new AiProviderError('AI_CAPABILITY_UNAVAILABLE', '模型请求了未注册的工具。', false);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(call.argumentsJson) as unknown;
    } catch {
      throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回了无效的工具参数。', false);
    }
    const input = tool.schema.safeParse(parsedJson);
    if (!input.success)
      throw new AiProviderError('AI_INVALID_RESPONSE', '模型工具参数未通过严格校验。', false);
    return context === undefined ? tool.execute(input.data) : tool.execute(input.data, context);
  }
}

const requireExecutionContext = (
  context: AiToolExecutionContext | undefined,
): AiToolExecutionContext => {
  if (context === undefined)
    throw new AiProviderError('AI_INVALID_RESPONSE', '写工具缺少执行上下文。', false);
  return context;
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rangeSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .strict()
  .refine((value) => value.from <= value.to, '结束日期不能早于开始日期。');

export const registerReadOnlyTools = (
  registry: ToolRegistry,
  services: {
    readonly today: { getToday(date: string): unknown };
    readonly work: { overview(from: string, to: string): unknown };
    readonly life: { overview(from: string, to: string): unknown };
  },
): void => {
  registry.register({
    definition: {
      name: 'get_today_schedule',
      description: '读取指定日期的日程与今日计划。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['date'],
        properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
    schema: z.object({ date: dateSchema }).strict(),
    execute: (input: { readonly date: string }) => {
      const today = services.today.getToday(input.date) as {
        date: string;
        plan: unknown;
        totals: unknown;
        pressure: unknown;
      };
      return Promise.resolve({
        date: today.date,
        plan: today.plan,
        totals: today.totals,
        pressure: today.pressure,
      });
    },
  });
  registry.register({
    definition: {
      name: 'get_free_time',
      description: '读取指定日期的可用空闲时间段。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['date'],
        properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
    schema: z.object({ date: dateSchema }).strict(),
    execute: (input: { readonly date: string }) =>
      Promise.resolve({
        date: input.date,
        freeTime: (services.today.getToday(input.date) as { freeTime: unknown }).freeTime,
      }),
  });
  for (const [name, description, execute] of [
    [
      'get_work_overview',
      '读取工作概览统计。',
      ({ from, to }: z.output<typeof rangeSchema>) =>
        Promise.resolve(services.work.overview(from, to)),
    ],
    [
      'get_life_overview',
      '读取生活概览统计。',
      ({ from, to }: z.output<typeof rangeSchema>) =>
        Promise.resolve(services.life.overview(from, to)),
    ],
  ] as const) {
    registry.register({
      definition: {
        name,
        description,
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'to'],
          properties: {
            from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
      },
      schema: rangeSchema,
      execute,
    });
  }
};

export const registerRememberMemoryTool = (
  registry: ToolRegistry,
  memories: AiMemoryRepository,
  writeExecutor?: AiWriteExecutor,
): void => {
  const schema = z
    .object({
      memoryType: z.enum(['PREFERENCE', 'CONSTRAINT', 'ROUTINE_HINT', 'DECISION_STYLE']),
      content: z.string().trim().min(1).max(1_000),
      confidence: z.number().min(0.7).max(1),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict();
  registry.register({
    definition: {
      name: 'remember_user_preference',
      description: '仅从当前用户明确表达的稳定偏好或约束中提取长期记忆。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['memoryType', 'content', 'confidence', 'userIntentReference'],
        properties: {
          memoryType: {
            type: 'string',
            enum: ['PREFERENCE', 'CONSTRAINT', 'ROUTINE_HINT', 'DECISION_STYLE'],
          },
          content: { type: 'string', minLength: 1, maxLength: 1_000 },
          confidence: { type: 'number', minimum: 0.7, maximum: 1 },
          userIntentReference: { type: 'string' },
        },
      },
    },
    schema,
    riskLevel: 'LOW_WRITE',
    execute: ({ memoryType, content, confidence, userIntentReference: _intent }, execution) => {
      if (writeExecutor === undefined || execution === undefined)
        return Promise.resolve({
          memoryId: memories.remember({ memoryType, content, confidence }),
        });
      return Promise.resolve(
        writeExecutor.execute({
          execution: requireExecutionContext(execution),
          summary: 'AiMemoryCreated',
          mutate: (context) => ({
            memoryId: memories.remember(
              {
                memoryType,
                content,
                confidence,
                sourceSessionId: execution.sessionId,
              },
              context,
            ),
          }),
        }),
      );
    },
  });
};

export const registerRecordLookupTools = (
  registry: ToolRegistry,
  services: {
    readonly information: {
      search(query: string, entityType?: string): unknown;
      getAiDomainRecord(recordType: string | undefined, entityId: string): unknown;
    };
    readonly actions: {
      applyAiChangePlan<T>(summary: string, execute: () => T): { changeSetId: string; result: T };
      getTask(id: string): unknown;
      listPlans(): readonly { id: string; goalId: string | null }[];
      listGoals(): readonly { id: string }[];
      listTasks(): readonly { id: string; planId: string | null; goalId: string | null }[];
    };
  },
): void => {
  registry.register({
    definition: {
      name: 'search_records',
      description: '按关键词搜索本地记录。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 200 },
          entityType: { type: 'string' },
        },
      },
    },
    schema: z
      .object({
        query: z.string().trim().min(1).max(200),
        entityType: z.string().trim().min(1).max(50).optional(),
      })
      .strict(),
    execute: (input) => Promise.resolve(services.information.search(input.query, input.entityType)),
  });
  registry.register({
    definition: {
      name: 'get_task_detail',
      description: '读取单个任务详情。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId'],
        properties: { entityId: { type: 'string', minLength: 1 } },
      },
    },
    schema: z.object({ entityId: z.string().min(1) }).strict(),
    execute: (input) =>
      Promise.resolve(services.actions.getTask(input.entityId) ?? { found: false }),
  });
  registry.register({
    definition: {
      name: 'get_plan_detail',
      description: '读取单个计划及其任务摘要。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId'],
        properties: { entityId: { type: 'string', minLength: 1 } },
      },
    },
    schema: z.object({ entityId: z.string().min(1) }).strict(),
    execute: (input) => {
      const plan = services.actions.listPlans().find((item) => item.id === input.entityId);
      return Promise.resolve(
        plan === undefined
          ? { found: false }
          : { plan, tasks: services.actions.listTasks().filter((task) => task.planId === plan.id) },
      );
    },
  });
  registry.register({
    definition: {
      name: 'get_goal_tree',
      description: '读取目标及其计划、任务层级摘要。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId'],
        properties: { entityId: { type: 'string', minLength: 1 } },
      },
    },
    schema: z.object({ entityId: z.string().min(1) }).strict(),
    execute: (input) => {
      const goal = services.actions.listGoals().find((item) => item.id === input.entityId);
      if (goal === undefined) return Promise.resolve({ found: false });
      const plans = services.actions.listPlans().filter((plan) => plan.goalId === goal.id);
      const planIds = new Set(plans.map((plan) => plan.id));
      return Promise.resolve({
        goal,
        plans,
        tasks: services.actions
          .listTasks()
          .filter(
            (task) => task.goalId === goal.id || (task.planId !== null && planIds.has(task.planId)),
          ),
      });
    },
  });
  registry.register({
    definition: {
      name: 'get_domain_record',
      description: '按需读取指定业务对象的真实结构化字段；附件仅返回安全元数据。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId'],
        properties: {
          recordType: { type: 'string', minLength: 1 },
          entityId: { type: 'string', minLength: 1 },
        },
      },
    },
    schema: z
      .object({
        recordType: z.string().trim().min(1).max(50).optional(),
        entityId: z.string().min(1),
      })
      .strict(),
    execute: (input) =>
      Promise.resolve(
        services.information.getAiDomainRecord(input.recordType, input.entityId) ?? {
          found: false,
        },
      ),
  });
};

export const registerNotificationTools = (
  registry: ToolRegistry,
  service: { execute(): readonly unknown[] },
): void => {
  registry.register({
    definition: {
      name: 'get_notifications',
      description: '读取应用内提醒中心的持久化通知实例。',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
    },
    schema: z.object({}).strict(),
    execute: () => Promise.resolve(service.execute()),
  });
};

export const registerAiProcessInboxTool = (
  registry: ToolRegistry,
  inbox: {
    processByAi(
      id: string,
      expectedVersion: number,
      inputs: readonly ManualInboxResult[],
      context?: OperationContext,
    ): unknown;
  },
  writeExecutor?: AiWriteExecutor,
): void => {
  const result = z.union([
    z
      .object({
        resultType: z.literal('TASK'),
        categoryId: z.string().min(1),
        title: z.string().min(1),
        priority: prioritySchema,
        dueAt: z.number().int(),
        estimatedMinutes: z.number().int().positive().multipleOf(15),
        isFlexible: z.boolean(),
        preferredArea: preferredAreaSchema,
      })
      .strict(),
    z
      .object({
        resultType: z.literal('SHOPPING_ITEM'),
        categoryId: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().int().positive().optional(),
        priority: prioritySchema.optional(),
      })
      .strict(),
    z
      .object({
        resultType: z.literal('GOAL'),
        categoryId: z.string().min(1),
        title: z.string().trim().min(1).max(300),
        description: z.string().max(20_000).optional(),
        goalType: z.enum(['OUTCOME', 'HABIT']),
        status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
        startDate: z.iso.date(),
        endDate: z.iso.date().nullable().optional(),
      })
      .strict()
      .refine(
        (value) =>
          value.endDate === undefined || value.endDate === null || value.startDate <= value.endDate,
        '目标结束日期不能早于开始日期。',
      ),
  ]);
  registry.register({
    definition: {
      name: 'process_inbox_item',
      description: '根据用户明确要求，将 AI_PROCESS 收集箱记录原子拆分为任务、购物项或目标。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['inboxItemId', 'expectedVersion', 'results', 'userIntentReference'],
        properties: {
          inboxItemId: { type: 'string' },
          expectedVersion: { type: 'integer' },
          results: {
            type: 'array',
            minItems: 1,
            maxItems: 20,
            items: {
              anyOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'resultType',
                    'categoryId',
                    'title',
                    'priority',
                    'dueAt',
                    'estimatedMinutes',
                    'isFlexible',
                    'preferredArea',
                  ],
                  properties: {
                    resultType: { const: 'TASK' },
                    categoryId: { type: 'string' },
                    title: { type: 'string' },
                    priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
                    dueAt: { type: 'integer' },
                    estimatedMinutes: { type: 'integer', minimum: 15, multipleOf: 15 },
                    isFlexible: { type: 'boolean' },
                    preferredArea: { enum: ['WORK', 'LIFE'] },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['resultType', 'categoryId', 'name'],
                  properties: {
                    resultType: { const: 'SHOPPING_ITEM' },
                    categoryId: { type: 'string' },
                    name: { type: 'string' },
                    quantity: { type: 'integer', minimum: 1 },
                    priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['resultType', 'categoryId', 'title', 'goalType', 'startDate'],
                  properties: {
                    resultType: { const: 'GOAL' },
                    categoryId: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    goalType: { enum: ['OUTCOME', 'HABIT'] },
                    status: { enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
                    startDate: { type: 'string', format: 'date' },
                    endDate: { type: ['string', 'null'], format: 'date' },
                  },
                },
              ],
            },
          },
          userIntentReference: { type: 'string' },
        },
      },
    },
    schema: z
      .object({
        inboxItemId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        results: z.array(result).min(1).max(20),
        userIntentReference: userIntentReferenceSchema,
      })
      .strict(),
    riskLevel: 'LOW_WRITE',
    execute: ({ inboxItemId, expectedVersion, results }, execution) => {
      const mutate = (context?: OperationContext) =>
        inbox.processByAi(inboxItemId, expectedVersion, results, context);
      if (writeExecutor === undefined || execution === undefined) return Promise.resolve(mutate());
      return Promise.resolve(
        writeExecutor.execute({
          execution: requireExecutionContext(execution),
          summary: 'InboxItemProcessedByAi',
          mutate,
        }),
      );
    },
  });
};

export const registerStatisticsTool = (
  registry: ToolRegistry,
  services: {
    readonly work: { overview(from: string, to: string): unknown };
    readonly life: { overview(from: string, to: string): unknown };
  },
): void => {
  registry.register({
    definition: {
      name: 'get_statistics',
      description: '读取工作或生活范围统计。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['scope', 'from', 'to'],
        properties: {
          scope: { enum: ['WORK', 'LIFE'] },
          from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
    },
    schema: z
      .object({ scope: z.enum(['WORK', 'LIFE']), from: dateSchema, to: dateSchema })
      .strict()
      .refine((value) => value.from <= value.to, '结束日期不能早于开始日期。'),
    execute: (input) =>
      Promise.resolve(
        input.scope === 'WORK'
          ? services.work.overview(input.from, input.to)
          : services.life.overview(input.from, input.to),
      ),
  });
};

const userIntentReferenceSchema = z.string().trim().min(1).max(200);
const prioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const goalStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']);
const preferredAreaSchema = z.enum(['WORK', 'LIFE']);
const dateTimeSchema = z.iso.datetime();
const writeIntentProperty = {
  userIntentReference: { type: 'string', minLength: 1, maxLength: 200 },
};

const writeResult = (record: { id: string; version: number; title: string; status: string }) => ({
  entityId: record.id,
  version: record.version,
  title: record.title,
  status: record.status,
});
const noteResult = (record: { id: string; version: number; title: string }) => ({
  entityId: record.id,
  version: record.version,
  title: record.title,
});

/**
 * Registers the M7-012 single-object writes. The intent reference is retained in every
 * tool schema now; validating that it points to the active user message is M7-016.
 */
export const registerLowImpactWriteTools = (
  registry: ToolRegistry,
  services: {
    readonly actions: {
      applyAiChangePlan<T>(summary: string, execute: () => T): { changeSetId: string; result: T };
      createGoal(
        input: {
          categoryId: string;
          title: string;
          description?: string | undefined;
          goalType: 'OUTCOME' | 'HABIT';
          status?: z.output<typeof goalStatusSchema> | undefined;
          startDate: string;
          endDate?: string | null | undefined;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      updateGoal(
        id: string,
        expectedVersion: number,
        patch: {
          title?: string | undefined;
          description?: string | undefined;
          status?: z.output<typeof goalStatusSchema> | undefined;
          startDate?: string | undefined;
          endDate?: string | null | undefined;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      createPlan(
        input: {
          goalId?: string | null | undefined;
          categoryId: string;
          title: string;
          description?: string | undefined;
          priority: z.output<typeof prioritySchema>;
          startDate: string;
          endDate: string;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      updatePlan(
        id: string,
        expectedVersion: number,
        patch: {
          title?: string | undefined;
          description?: string | undefined;
          status?: z.output<typeof goalStatusSchema> | undefined;
          priority?: z.output<typeof prioritySchema> | undefined;
          startDate?: string | undefined;
          endDate?: string | undefined;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      createTask(
        input: {
          categoryId: string;
          planId?: string | null | undefined;
          goalId?: string | null | undefined;
          title: string;
          description?: string | undefined;
          priority: z.output<typeof prioritySchema>;
          dueAt: number;
          estimatedMinutes: number;
          isFlexible: boolean;
          isSplittable: boolean;
          preferredArea: z.output<typeof preferredAreaSchema>;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      updateTask(
        id: string,
        expectedVersion: number,
        patch: {
          title?: string | undefined;
          description?: string | undefined;
          priority?: z.output<typeof prioritySchema> | undefined;
          dueAt?: string | undefined;
          estimatedMinutes?: number | undefined;
          isFlexible?: boolean | undefined;
          isSplittable?: boolean | undefined;
          preferredArea?: z.output<typeof preferredAreaSchema> | undefined;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      transitionTask(
        id: string,
        expectedVersion: number,
        status: 'COMPLETED',
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      createEvent(
        input: {
          categoryId: string;
          title: string;
          description?: string | undefined;
          startAt: number;
          endAt: number;
          eventType: 'GENERAL' | 'MEETING' | 'MEDICAL' | 'TRAVEL' | 'REST';
          priority: z.output<typeof prioritySchema>;
          isImmovable?: boolean | undefined;
          allowOverlap?: boolean | undefined;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
      updateEvent(
        id: string,
        expectedVersion: number,
        patch: {
          title?: string | undefined;
          description?: string | undefined;
          startAt?: string | undefined;
          endAt?: string | undefined;
          eventType?: 'GENERAL' | 'MEETING' | 'MEDICAL' | 'TRAVEL' | 'REST' | undefined;
          priority?: z.output<typeof prioritySchema> | undefined;
          isImmovable?: boolean | undefined;
          allowOverlap?: boolean | undefined;
          status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | undefined;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string; status: string };
    };
    readonly work: {
      createNoteForEntity(
        input: {
          entityId: string;
          categoryId: string;
          title: string;
          markdownContent: string;
          summary?: string | null | undefined;
          role: 'SCRIPT' | 'TECHNICAL' | 'KNOWLEDGE' | 'MATERIAL' | 'OTHER';
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string };
      updateNote(
        id: string,
        entityId: string,
        expectedVersion: number,
        patch: {
          title?: string | undefined;
          markdownContent?: string | null | undefined;
          summary?: string | null | undefined;
          role?: 'SCRIPT' | 'TECHNICAL' | 'KNOWLEDGE' | 'MATERIAL' | 'OTHER' | undefined;
        },
        context?: OperationContext,
      ): { id: string; version: number; title: string };
    };
    readonly reschedule: (trigger: string) => void;
    readonly writeExecutor?: AiWriteExecutor;
  },
): void => {
  const executeWrite = <T>(
    context: AiToolExecutionContext | undefined,
    summary: string,
    mutate: (operationContext?: OperationContext) => T,
  ) => {
    if (services.writeExecutor === undefined || context === undefined) return mutate();
    return services.writeExecutor.execute({
      execution: requireExecutionContext(context),
      summary,
      mutate: (operationContext) => mutate(operationContext),
    });
  };
  const taskCreateSchema = z
    .object({
      categoryId: z.string().min(1),
      planId: z.string().min(1).nullable().optional(),
      goalId: z.string().min(1).nullable().optional(),
      title: z.string().trim().min(1).max(300),
      description: z.string().max(20_000).optional(),
      priority: prioritySchema,
      dueAt: dateTimeSchema,
      estimatedMinutes: z.number().int().positive().multipleOf(15),
      isFlexible: z.boolean(),
      isSplittable: z.boolean(),
      preferredArea: preferredAreaSchema,
      inferenceReason: z.string().trim().min(1).max(500).nullable().optional(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict();
  const changePlanTaskSchema = taskCreateSchema
    .omit({ userIntentReference: true })
    .extend({ operation: z.literal('CREATE_TASK') })
    .strict();
  const changePlanEventSchema = z
    .object({
      operation: z.literal('CREATE_EVENT'),
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(300),
      description: z.string().max(20_000).optional(),
      startAt: dateTimeSchema,
      endAt: dateTimeSchema,
      eventType: z.enum(['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST']),
      priority: prioritySchema,
      isImmovable: z.boolean().optional(),
      allowOverlap: z.boolean().optional(),
    })
    .strict()
    .refine((value) => value.startAt < value.endAt, '结束时间必须晚于开始时间。');
  const changePlanSchema = z
    .object({
      summary: z.string().trim().min(1).max(300),
      operations: z
        .array(z.union([changePlanTaskSchema, changePlanEventSchema]))
        .min(2)
        .max(20),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict();
  registry.register({
    definition: {
      name: 'apply_change_plan',
      description: '根据用户明确指令，原子创建多个任务或日程；任一项失败则全部回滚。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'operations', 'userIntentReference'],
        properties: {
          summary: { type: 'string', minLength: 1, maxLength: 300 },
          operations: {
            type: 'array',
            minItems: 2,
            maxItems: 20,
            items: {
              anyOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'operation',
                    'categoryId',
                    'title',
                    'priority',
                    'dueAt',
                    'estimatedMinutes',
                    'isFlexible',
                    'isSplittable',
                    'preferredArea',
                  ],
                  properties: {
                    operation: { const: 'CREATE_TASK' },
                    categoryId: { type: 'string' },
                    planId: { type: ['string', 'null'] },
                    goalId: { type: ['string', 'null'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
                    dueAt: { type: 'string', format: 'date-time' },
                    estimatedMinutes: { type: 'integer', minimum: 15, multipleOf: 15 },
                    isFlexible: { type: 'boolean' },
                    isSplittable: { type: 'boolean' },
                    preferredArea: { enum: ['WORK', 'LIFE'] },
                    inferenceReason: { type: ['string', 'null'] },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'operation',
                    'categoryId',
                    'title',
                    'startAt',
                    'endAt',
                    'eventType',
                    'priority',
                  ],
                  properties: {
                    operation: { const: 'CREATE_EVENT' },
                    categoryId: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    startAt: { type: 'string', format: 'date-time' },
                    endAt: { type: 'string', format: 'date-time' },
                    eventType: { enum: ['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST'] },
                    priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
                    isImmovable: { type: 'boolean' },
                    allowOverlap: { type: 'boolean' },
                  },
                },
              ],
            },
          },
          ...writeIntentProperty,
        },
      },
    },
    schema: changePlanSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ summary, operations }, execution) => {
      const mutate = (operationContext?: OperationContext) => {
        const results = operations.map((operation) => {
          if (operation.operation === 'CREATE_TASK') {
            const { operation: _operation, inferenceReason: _reason, ...task } = operation;
            return writeResult(
              services.actions.createTask(
                { ...task, dueAt: Date.parse(task.dueAt) },
                operationContext,
              ),
            );
          }
          const { operation: _operation, ...event } = operation;
          return writeResult(
            services.actions.createEvent(
              {
                ...event,
                startAt: Date.parse(event.startAt),
                endAt: Date.parse(event.endAt),
              },
              operationContext,
            ),
          );
        });
        return results;
      };
      if (services.writeExecutor === undefined || execution === undefined) {
        const legacy = services.actions.applyAiChangePlan(summary, () => mutate());
        services.reschedule('AI_CHANGE_PLAN_APPLIED');
        return Promise.resolve({
          changeSetId: legacy.changeSetId,
          changeSetSummary: summary,
          operations: legacy.result,
        });
      }
      const applied = services.writeExecutor.execute({
        execution: requireExecutionContext(execution),
        summary,
        mutate,
      });
      return Promise.resolve({
        changeSetId: applied.changeSetId,
        changeSetSummary: summary,
        operations: applied.operations,
        result: applied.result,
      });
    },
  });
  registry.register({
    definition: {
      name: 'create_task',
      description: '根据用户明确指令创建一个任务。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: [
          'categoryId',
          'title',
          'priority',
          'dueAt',
          'estimatedMinutes',
          'isFlexible',
          'isSplittable',
          'preferredArea',
          'userIntentReference',
        ],
        properties: {
          categoryId: { type: 'string' },
          planId: { type: ['string', 'null'] },
          goalId: { type: ['string', 'null'] },
          title: { type: 'string', minLength: 1, maxLength: 300 },
          description: { type: 'string', maxLength: 20_000 },
          priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
          dueAt: { type: 'string', format: 'date-time' },
          estimatedMinutes: { type: 'integer', minimum: 15, multipleOf: 15 },
          isFlexible: { type: 'boolean' },
          isSplittable: { type: 'boolean' },
          preferredArea: { enum: ['WORK', 'LIFE'] },
          inferenceReason: { type: ['string', 'null'] },
          ...writeIntentProperty,
        },
      },
    },
    schema: taskCreateSchema,
    riskLevel: 'LOW_WRITE',
    execute: (input, execution) => {
      const { userIntentReference: _intent, inferenceReason: _reason, ...taskInput } = input;
      const result = executeWrite(execution, 'TaskCreated', (context) =>
        writeResult(
          context === undefined
            ? services.actions.createTask({
                ...taskInput,
                dueAt: Date.parse(taskInput.dueAt),
              })
            : services.actions.createTask(
                { ...taskInput, dueAt: Date.parse(taskInput.dueAt) },
                context,
              ),
        ),
      );
      if (execution === undefined) services.reschedule('AI_TASK_CREATED');
      return Promise.resolve(result);
    },
  });

  const noteCreateSchema = z
    .object({
      entityId: z.string().min(1),
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(200),
      markdownContent: z.string().max(100_000),
      summary: z.string().max(2_000).nullable().optional(),
      role: z.enum(['SCRIPT', 'TECHNICAL', 'KNOWLEDGE', 'MATERIAL', 'OTHER']),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict();
  registry.register({
    definition: {
      name: 'create_note',
      description: '根据用户明确指令，为已有对象添加 Markdown 笔记。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: [
          'entityId',
          'categoryId',
          'title',
          'markdownContent',
          'role',
          'userIntentReference',
        ],
        properties: {
          entityId: { type: 'string' },
          categoryId: { type: 'string' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          markdownContent: { type: 'string', maxLength: 100_000 },
          summary: { type: ['string', 'null'], maxLength: 2_000 },
          role: { enum: ['SCRIPT', 'TECHNICAL', 'KNOWLEDGE', 'MATERIAL', 'OTHER'] },
          ...writeIntentProperty,
        },
      },
    },
    schema: noteCreateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ userIntentReference: _intent, ...input }, execution) =>
      Promise.resolve(
        executeWrite(execution, 'WorkNoteCreated', (context) =>
          noteResult(services.work.createNoteForEntity(input, context)),
        ),
      ),
  });
  const noteUpdateSchema = z
    .object({
      entityId: z.string().min(1),
      noteId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      title: z.string().trim().min(1).max(200).optional(),
      markdownContent: z.string().max(100_000).nullable().optional(),
      summary: z.string().max(2_000).nullable().optional(),
      role: z.enum(['SCRIPT', 'TECHNICAL', 'KNOWLEDGE', 'MATERIAL', 'OTHER']).optional(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict();
  registry.register({
    definition: {
      name: 'update_note',
      description: '根据用户明确指令更新已有 Markdown 笔记。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId', 'noteId', 'expectedVersion', 'userIntentReference'],
        properties: {
          entityId: { type: 'string' },
          noteId: { type: 'string' },
          expectedVersion: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          markdownContent: { type: ['string', 'null'], maxLength: 100_000 },
          summary: { type: ['string', 'null'], maxLength: 2_000 },
          role: { enum: ['SCRIPT', 'TECHNICAL', 'KNOWLEDGE', 'MATERIAL', 'OTHER'] },
          ...writeIntentProperty,
        },
      },
    },
    schema: noteUpdateSchema,
    riskLevel: 'LOW_WRITE',
    execute: (
      { entityId, noteId, expectedVersion, userIntentReference: _intent, ...patch },
      execution,
    ) =>
      Promise.resolve(
        executeWrite(execution, 'WorkNoteUpdated', (context) =>
          noteResult(services.work.updateNote(noteId, entityId, expectedVersion, patch, context)),
        ),
      ),
  });

  const taskUpdateSchema = taskCreateSchema
    .omit({ categoryId: true, planId: true, goalId: true })
    .partial()
    .extend({
      entityId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict();
  registry.register({
    definition: {
      name: 'update_task',
      description: '根据用户明确指令更新一个任务的普通字段。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId', 'expectedVersion', 'userIntentReference'],
        properties: {
          entityId: { type: 'string' },
          expectedVersion: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
          dueAt: { type: 'string', format: 'date-time' },
          estimatedMinutes: { type: 'integer', minimum: 15, multipleOf: 15 },
          isFlexible: { type: 'boolean' },
          isSplittable: { type: 'boolean' },
          preferredArea: { enum: ['WORK', 'LIFE'] },
          inferenceReason: { type: ['string', 'null'] },
          ...writeIntentProperty,
        },
      },
    },
    schema: taskUpdateSchema,
    riskLevel: 'LOW_WRITE',
    execute: (
      {
        entityId,
        expectedVersion,
        userIntentReference: _intent,
        inferenceReason: _reason,
        ...patch
      },
      execution,
    ) => {
      return Promise.resolve(
        executeWrite(execution, 'TaskUpdated', (context) =>
          writeResult(services.actions.updateTask(entityId, expectedVersion, patch, context)),
        ),
      );
    },
  });
  registry.register({
    definition: {
      name: 'complete_task',
      description: '根据用户明确指令完成一个任务。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId', 'expectedVersion', 'userIntentReference'],
        properties: {
          entityId: { type: 'string' },
          expectedVersion: { type: 'integer', minimum: 1 },
          ...writeIntentProperty,
        },
      },
    },
    schema: z
      .object({
        entityId: z.string().min(1),
        expectedVersion: z.number().int().positive(),
        userIntentReference: userIntentReferenceSchema,
      })
      .strict(),
    riskLevel: 'LOW_WRITE',
    execute: ({ entityId, expectedVersion }, execution) => {
      return Promise.resolve(
        executeWrite(execution, 'TaskCompleted', (context) =>
          writeResult(
            services.actions.transitionTask(entityId, expectedVersion, 'COMPLETED', context),
          ),
        ),
      );
    },
  });

  const goalCreateSchema = z
    .object({
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(20_000).optional(),
      goalType: z.enum(['OUTCOME', 'HABIT']),
      status: goalStatusSchema.optional(),
      startDate: dateSchema,
      endDate: dateSchema.nullable().optional(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict();
  registry.register({
    definition: {
      name: 'create_goal',
      description: '根据用户明确指令创建一个目标。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['categoryId', 'title', 'goalType', 'startDate', 'userIntentReference'],
        properties: {
          categoryId: { type: 'string' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          goalType: { enum: ['OUTCOME', 'HABIT'] },
          status: { enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: ['string', 'null'], format: 'date' },
          ...writeIntentProperty,
        },
      },
    },
    schema: goalCreateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ userIntentReference: _intent, ...input }, execution) =>
      Promise.resolve(
        executeWrite(execution, 'GoalCreated', (context) =>
          writeResult(services.actions.createGoal(input, context)),
        ),
      ),
  });
  const goalUpdateSchema = goalCreateSchema
    .omit({ categoryId: true, goalType: true })
    .partial()
    .extend({
      entityId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict();
  registry.register({
    definition: {
      name: 'update_goal',
      description: '根据用户明确指令更新一个目标的普通字段。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId', 'expectedVersion', 'userIntentReference'],
        properties: {
          entityId: { type: 'string' },
          expectedVersion: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: ['string', 'null'], format: 'date' },
          ...writeIntentProperty,
        },
      },
    },
    schema: goalUpdateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ entityId, expectedVersion, userIntentReference: _intent, ...patch }, execution) =>
      Promise.resolve(
        executeWrite(execution, 'GoalUpdated', (context) =>
          writeResult(services.actions.updateGoal(entityId, expectedVersion, patch, context)),
        ),
      ),
  });

  const planCreateSchema = z
    .object({
      goalId: z.string().min(1).nullable().optional(),
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(20_000).optional(),
      priority: prioritySchema,
      startDate: dateSchema,
      endDate: dateSchema,
      userIntentReference: userIntentReferenceSchema,
    })
    .strict()
    .refine((value) => value.startDate <= value.endDate, '结束日期不能早于开始日期。');
  registry.register({
    definition: {
      name: 'create_plan',
      description: '根据用户明确指令创建一个计划。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: [
          'categoryId',
          'title',
          'priority',
          'startDate',
          'endDate',
          'userIntentReference',
        ],
        properties: {
          goalId: { type: ['string', 'null'] },
          categoryId: { type: 'string' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string' },
          priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          ...writeIntentProperty,
        },
      },
    },
    schema: planCreateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ userIntentReference: _intent, ...input }, execution) =>
      Promise.resolve(
        executeWrite(execution, 'PlanCreated', (context) =>
          writeResult(services.actions.createPlan(input, context)),
        ),
      ),
  });
  const planUpdateSchema = z
    .object({
      entityId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(20_000).optional(),
      status: goalStatusSchema.optional(),
      priority: prioritySchema.optional(),
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict()
    .refine(
      (value) =>
        value.startDate === undefined ||
        value.endDate === undefined ||
        value.startDate <= value.endDate,
      '结束日期不能早于开始日期。',
    );
  registry.register({
    definition: {
      name: 'update_plan',
      description: '根据用户明确指令更新一个计划的普通字段。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId', 'expectedVersion', 'userIntentReference'],
        properties: {
          entityId: { type: 'string' },
          expectedVersion: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
          priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          ...writeIntentProperty,
        },
      },
    },
    schema: planUpdateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ entityId, expectedVersion, userIntentReference: _intent, ...patch }, execution) =>
      Promise.resolve(
        executeWrite(execution, 'PlanUpdated', (context) =>
          writeResult(services.actions.updatePlan(entityId, expectedVersion, patch, context)),
        ),
      ),
  });

  const eventCreateSchema = z
    .object({
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(300),
      description: z.string().max(20_000).optional(),
      startAt: dateTimeSchema,
      endAt: dateTimeSchema,
      eventType: z.enum(['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST']),
      priority: prioritySchema,
      isImmovable: z.boolean().optional(),
      allowOverlap: z.boolean().optional(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict()
    .refine((value) => value.startAt < value.endAt, '结束时间必须晚于开始时间。');
  registry.register({
    definition: {
      name: 'create_event',
      description: '根据用户明确指令创建一个日程；发生冲突时由服务拒绝执行。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: [
          'categoryId',
          'title',
          'startAt',
          'endAt',
          'eventType',
          'priority',
          'userIntentReference',
        ],
        properties: {
          categoryId: { type: 'string' },
          title: { type: 'string', minLength: 1, maxLength: 300 },
          description: { type: 'string' },
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time' },
          eventType: { enum: ['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST'] },
          priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
          isImmovable: { type: 'boolean' },
          allowOverlap: { type: 'boolean' },
          ...writeIntentProperty,
        },
      },
    },
    schema: eventCreateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ userIntentReference: _intent, ...input }, execution) => {
      return Promise.resolve(
        executeWrite(execution, 'EventCreated', (context) =>
          writeResult(
            services.actions.createEvent(
              {
                ...input,
                startAt: Date.parse(input.startAt),
                endAt: Date.parse(input.endAt),
              },
              context,
            ),
          ),
        ),
      );
    },
  });
  const eventUpdateSchema = z
    .object({
      entityId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      title: z.string().trim().min(1).max(300).optional(),
      description: z.string().max(20_000).optional(),
      startAt: dateTimeSchema.optional(),
      endAt: dateTimeSchema.optional(),
      eventType: z.enum(['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST']).optional(),
      priority: prioritySchema.optional(),
      isImmovable: z.boolean().optional(),
      allowOverlap: z.boolean().optional(),
      userIntentReference: userIntentReferenceSchema,
      status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
    })
    .strict();
  registry.register({
    definition: {
      name: 'update_event',
      description: '根据用户明确指令更新一个日程；产生冲突时由服务拒绝执行。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId', 'expectedVersion', 'userIntentReference'],
        properties: {
          entityId: { type: 'string' },
          expectedVersion: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          description: { type: 'string' },
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time' },
          eventType: { enum: ['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST'] },
          priority: { enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
          isImmovable: { type: 'boolean' },
          allowOverlap: { type: 'boolean' },
          status: { enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'] },
          ...writeIntentProperty,
        },
      },
    },
    schema: eventUpdateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ entityId, expectedVersion, userIntentReference: _intent, ...patch }, execution) => {
      return Promise.resolve(
        executeWrite(execution, 'EventUpdated', (context) =>
          writeResult(services.actions.updateEvent(entityId, expectedVersion, patch, context)),
        ),
      );
    },
  });
};

/**
 * High-risk tools only create an immutable pending action. Execution is deliberately unavailable
 * to the model and must be initiated by the local user's confirmation endpoint.
 */
export const registerHighRiskConfirmationTools = (
  registry: ToolRegistry,
  services: {
    readonly actions: {
      listGoals(): readonly {
        id: string;
        version: number;
        title: string;
        description: string | null;
        horizon: 'SHORT_TERM' | 'LONG_TERM';
        status: string;
        startDate: string;
        endDate: string | null;
      }[];
    };
    readonly consistency: {
      createConfirmation(
        operationType: string,
        request: unknown,
        preview: unknown,
      ): { id: string; expiresAt: string };
    };
    readonly aiActions: {
      create(input: {
        actionType: AiActionType;
        request: unknown;
        preview: unknown;
        confirmationId: string;
        expiresAt?: string | undefined;
        executionContext?: AiToolExecutionContext | undefined;
      }): { id: string; status: string; confirmationId: string; createdAt: string };
    };
  },
): void => {
  const schema = z
    .object({
      goalId: z.string().length(26),
      expectedVersion: z.number().int().positive(),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(20_000).nullable().optional(),
      startDate: dateSchema.optional(),
      endDate: dateSchema.nullable().optional(),
      status: goalStatusSchema.optional(),
      userIntentReference: userIntentReferenceSchema,
    })
    .strict()
    .refine(
      (value) =>
        value.endDate === undefined ||
        value.startDate === undefined ||
        value.endDate === null ||
        value.startDate <= value.endDate,
      '结束日期不能早于开始日期。',
    );
  registry.register({
    definition: {
      name: 'replace_long_term_goal',
      description: '替换长期目标内容。此高风险操作只创建待用户确认的预览，绝不由模型直接执行。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['goalId', 'expectedVersion', 'title', 'userIntentReference'],
        properties: {
          goalId: { type: 'string', minLength: 26, maxLength: 26 },
          expectedVersion: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: ['string', 'null'], maxLength: 20000 },
          startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          endDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          status: { enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
          ...writeIntentProperty,
        },
      },
    },
    schema,
    riskLevel: 'HIGH_WRITE',
    execute: (input, execution) => {
      const current = services.actions.listGoals().find((goal) => goal.id === input.goalId);
      if (current === undefined) throw new Error('GOAL_NOT_FOUND');
      if (current.horizon !== 'LONG_TERM') throw new Error('AI_ACTION_INVALID_TARGET');
      if (current.version !== input.expectedVersion) throw new Error('VERSION_CONFLICT');
      const request = {
        goalId: input.goalId,
        expectedVersion: input.expectedVersion,
        title: input.title,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
        ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
        ...(input.status === undefined ? {} : { status: input.status }),
      };
      const preview = {
        actionType: 'REPLACE_LONG_TERM_GOAL',
        target: { entityId: current.id, version: current.version, title: current.title },
        after: {
          title: request.title,
          description: request.description ?? current.description,
          startDate: request.startDate ?? current.startDate,
          endDate: request.endDate === undefined ? current.endDate : request.endDate,
          status: request.status ?? current.status,
        },
      };
      const confirmation = services.consistency.createConfirmation(
        'REPLACE_LONG_TERM_GOAL',
        request,
        preview,
      );
      const action = services.aiActions.create({
        actionType: 'REPLACE_LONG_TERM_GOAL',
        request,
        preview,
        confirmationId: confirmation.id,
        expiresAt: confirmation.expiresAt,
        ...(execution === undefined ? {} : { executionContext: execution }),
      });
      return Promise.resolve({
        actionId: action.id,
        status: action.status,
        preview,
        expiresAt: confirmation.expiresAt,
      });
    },
  });
};
