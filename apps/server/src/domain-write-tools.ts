import { z } from 'zod';

import type { AiToolExecutionContext, OperationContext } from '@life-assistant/database';

import type { AiWriteExecutor } from './ai-write-executor.js';
import type { ToolRegistry } from './tool-registry.js';

const recordTypeSchema = z.enum([
  'SELF_MEDIA_CONTENT',
  'DEV_PROJECT',
  'LEARNING_RESOURCE',
  'SHOPPING_ITEM',
  'RECIPE',
  'WORKOUT_PLAN',
  'ENTERTAINMENT_ITEM',
]);
const nullableText = z.string().max(20_000).nullable().optional();
const createDataSchemas = {
  SELF_MEDIA_CONTENT: z
    .object({
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(300),
      idea: nullableText,
      script: nullableText,
      contentType: z.enum(['VIDEO', 'ARTICLE', 'AUDIO', 'IMAGE', 'OTHER']),
      platform: z.string().max(200).nullable(),
      productionStatus: z
        .enum(['IDEA', 'PLANNING', 'CREATING', 'READY', 'PUBLISHED', 'ARCHIVED'])
        .optional(),
      plannedPublishAt: z.iso.datetime().nullable(),
      calendarEventId: z.string().min(1).nullable(),
      taskId: z.string().min(1).nullable(),
    })
    .strict(),
  DEV_PROJECT: z
    .object({
      categoryId: z.string().min(1),
      name: z.string().trim().min(1).max(300),
      summary: nullableText,
      status: z.enum(['PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
      startDate: z.iso.date().nullable(),
      targetDate: z.iso.date().nullable(),
      planId: z.string().min(1).nullable(),
    })
    .strict(),
  LEARNING_RESOURCE: z
    .object({
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(300),
      resourceType: z.enum(['COURSE', 'BOOK', 'ARTICLE', 'VIDEO', 'DOCUMENT', 'OTHER']),
      author: z.string().max(300).nullable(),
      sourceUrl: z.url().nullable(),
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'ABANDONED']).optional(),
      progressCurrent: z.number().nonnegative().nullable().optional(),
      progressTotal: z.number().positive().nullable(),
      progressUnit: z.string().max(50).nullable(),
    })
    .strict(),
  SHOPPING_ITEM: z
    .object({
      categoryId: z.string().min(1),
      name: z.string().trim().min(1).max(300),
      productCategory: z.string().max(200).nullable().optional(),
      quantity: z.number().positive().optional(),
      unit: z.string().max(50).nullable().optional(),
      plannedUnitPriceMinor: z.number().int().nonnegative().nullable().optional(),
      budgetAmountMinor: z.number().int().nonnegative().nullable().optional(),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
      status: z.enum(['WANTED', 'RESEARCHING', 'READY', 'PURCHASED', 'CANCELLED']).optional(),
      purchaseChannel: z.string().max(200).nullable().optional(),
      taskId: z.string().min(1).nullable().optional(),
    })
    .strict(),
  RECIPE: z
    .object({
      categoryId: z.string().min(1),
      name: z.string().trim().min(1).max(300),
      description: nullableText,
      servings: z.number().int().positive().optional(),
      caloriesKcal: z.number().nonnegative().nullable().optional(),
      proteinG: z.number().nonnegative().nullable().optional(),
      carbsG: z.number().nonnegative().nullable().optional(),
      fatG: z.number().nonnegative().nullable().optional(),
    })
    .strict(),
  WORKOUT_PLAN: z
    .object({
      categoryId: z.string().min(1),
      name: z.string().trim().min(1).max(300),
      description: nullableText,
      goalId: z.string().min(1).nullable().optional(),
      status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
      items: z
        .array(
          z
            .object({
              exerciseId: z.string().min(1),
              setsTarget: z.number().int().positive().nullable(),
              repsTarget: z.string().max(50).nullable(),
              weightTarget: z.number().nonnegative().nullable(),
              durationSecondsTarget: z.number().int().positive().nullable(),
              distanceTarget: z.number().nonnegative().nullable(),
              sortOrder: z.number().int().nonnegative(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict(),
  ENTERTAINMENT_ITEM: z
    .object({
      categoryId: z.string().min(1),
      title: z.string().trim().min(1).max(300),
      itemType: z.enum(['MOVIE', 'SERIES', 'BOOK', 'COMIC', 'GAME', 'ACTIVITY', 'TRIP', 'OTHER']),
      listType: z.enum(['WANT_TO_WATCH', 'WANT_TO_PLAY', 'WANT_TO_GO', 'OTHER']),
      status: z.enum(['WISHLIST', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']).optional(),
      progressTotal: z.number().nonnegative().nullable().optional(),
      progressUnit: z.string().max(50).nullable().optional(),
      note: nullableText,
    })
    .strict(),
} satisfies Record<z.output<typeof recordTypeSchema>, z.ZodType>;

const updateDataSchema = (recordType: z.output<typeof recordTypeSchema>) => {
  const schema: z.ZodObject<z.ZodRawShape> = createDataSchemas[recordType];
  return schema.partial().omit({ categoryId: true });
};

export interface DomainWriteAdapter {
  create(
    recordType: z.output<typeof recordTypeSchema>,
    data: unknown,
    context: OperationContext,
  ): unknown;
  update(
    recordType: z.output<typeof recordTypeSchema>,
    entityId: string,
    expectedVersion: number,
    patch: unknown,
    context: OperationContext,
  ): unknown;
}

const requireContext = (context: AiToolExecutionContext | undefined): AiToolExecutionContext => {
  if (context === undefined) throw new Error('AI_WRITE_CONTEXT_REQUIRED');
  return context;
};

export const registerDomainWriteTools = (
  registry: ToolRegistry,
  domain: DomainWriteAdapter,
  executor: Pick<AiWriteExecutor, 'execute'>,
): void => {
  const createSchema = z
    .object({
      recordType: recordTypeSchema,
      data: z.record(z.string(), z.unknown()),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict()
    .superRefine((value, context) => {
      const parsed = createDataSchemas[value.recordType].safeParse(value.data);
      if (!parsed.success)
        parsed.error.issues.forEach((issue) => {
          context.addIssue({ ...issue, path: ['data', ...issue.path] });
        });
    });
  registry.register({
    definition: {
      name: 'create_domain_record',
      description: '根据用户明确指令，在七个专属模块创建结构化主记录。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['recordType', 'data', 'userIntentReference'],
        properties: {
          recordType: { enum: recordTypeSchema.options },
          data: { type: 'object' },
          userIntentReference: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
    schema: createSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ recordType, data }, execution) => {
      const parsed = createDataSchemas[recordType].parse(data);
      return Promise.resolve(
        executor.execute({
          execution: requireContext(execution),
          summary: `${recordType}:Created`,
          mutate: (context) => domain.create(recordType, parsed, context),
        }),
      );
    },
  });

  const updateSchema = z
    .object({
      recordType: recordTypeSchema,
      entityId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      patch: z.record(z.string(), z.unknown()),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict()
    .superRefine((value, context) => {
      const parsed = updateDataSchema(value.recordType).safeParse(value.patch);
      if (!parsed.success)
        parsed.error.issues.forEach((issue) => {
          context.addIssue({ ...issue, path: ['patch', ...issue.path] });
        });
    });
  registry.register({
    definition: {
      name: 'update_domain_record',
      description: '根据用户明确指令和当前版本，更新七个专属模块的结构化主记录。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['recordType', 'entityId', 'expectedVersion', 'patch', 'userIntentReference'],
        properties: {
          recordType: { enum: recordTypeSchema.options },
          entityId: { type: 'string', minLength: 1 },
          expectedVersion: { type: 'integer', minimum: 1 },
          patch: { type: 'object' },
          userIntentReference: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
    schema: updateSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ recordType, entityId, expectedVersion, patch }, execution) => {
      const parsed = updateDataSchema(recordType).parse(patch);
      return Promise.resolve(
        executor.execute({
          execution: requireContext(execution),
          summary: `${recordType}:Updated`,
          mutate: (context) =>
            domain.update(recordType, entityId, expectedVersion, parsed, context),
        }),
      );
    },
  });
};

export const registerOperationalWriteTools = (
  registry: ToolRegistry,
  services: {
    readonly reminders: {
      create(
        input: {
          targetEntityId: string;
          triggerMode: 'ABSOLUTE' | 'OFFSET_BEFORE_START' | 'OFFSET_BEFORE_DUE';
          triggerAt?: string | null;
          offsetMinutes?: number | null;
        },
        context?: OperationContext,
      ): unknown;
    };
    readonly actions: { undoAiChangeSet(id: string, context?: OperationContext): unknown };
    readonly reschedule: (
      rangeStart: number,
      rangeEnd: number,
      trigger: string,
      context?: OperationContext,
    ) => unknown;
  },
  executor: Pick<AiWriteExecutor, 'execute'>,
): void => {
  const reminderSchema = z
    .object({
      targetEntityId: z.string().min(1),
      triggerMode: z.enum(['ABSOLUTE', 'OFFSET_BEFORE_START', 'OFFSET_BEFORE_DUE']),
      triggerAt: z.iso.datetime().nullable().optional(),
      offsetMinutes: z.number().int().positive().nullable().optional(),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.triggerMode === 'ABSOLUTE' && value.triggerAt === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['triggerAt'],
          message: '固定提醒必须提供时间。',
        });
      }
      if (value.triggerMode !== 'ABSOLUTE' && value.offsetMinutes === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['offsetMinutes'],
          message: '提前提醒必须提供分钟数。',
        });
      }
    });
  registry.register({
    definition: {
      name: 'add_reminder',
      description: '根据用户明确指令，为任务或日程添加一个固定时间或提前提醒。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['targetEntityId', 'triggerMode', 'userIntentReference'],
        properties: {
          targetEntityId: { type: 'string', minLength: 1 },
          triggerMode: { enum: ['ABSOLUTE', 'OFFSET_BEFORE_START', 'OFFSET_BEFORE_DUE'] },
          triggerAt: { type: ['string', 'null'], format: 'date-time' },
          offsetMinutes: { type: ['integer', 'null'], minimum: 1 },
          userIntentReference: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
    schema: reminderSchema,
    riskLevel: 'LOW_WRITE',
    execute: (
      { targetEntityId, triggerMode, triggerAt, offsetMinutes, userIntentReference: _intent },
      execution,
    ) =>
      Promise.resolve(
        executor.execute({
          execution: requireContext(execution),
          summary: 'ReminderCreated',
          mutate: (context) =>
            services.reminders.create(
              {
                targetEntityId,
                triggerMode,
                ...(triggerAt === undefined ? {} : { triggerAt }),
                ...(offsetMinutes === undefined ? {} : { offsetMinutes }),
              },
              context,
            ),
        }),
      ),
  });

  const rescheduleSchema = z
    .object({
      rangeStart: z.iso.datetime(),
      rangeEnd: z.iso.datetime(),
      reason: z.string().trim().min(1).max(200),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict()
    .refine((value) => {
      const duration = Date.parse(value.rangeEnd) - Date.parse(value.rangeStart);
      return duration > 0 && duration <= 7 * 86_400_000;
    }, '普通重排范围必须为正且不超过七天。');
  registry.register({
    definition: {
      name: 'request_reschedule',
      description: '根据用户明确指令请求七天以内的普通排程调整；更大范围需要高风险确认。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['rangeStart', 'rangeEnd', 'reason', 'userIntentReference'],
        properties: {
          rangeStart: { type: 'string', format: 'date-time' },
          rangeEnd: { type: 'string', format: 'date-time' },
          reason: { type: 'string', minLength: 1, maxLength: 200 },
          userIntentReference: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
    schema: rescheduleSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ rangeStart, rangeEnd, reason, userIntentReference: _intent }, execution) =>
      Promise.resolve(
        executor.execute({
          execution: requireContext(execution),
          summary: `ScheduleRequested:${reason}`,
          mutate: (context) =>
            services.reschedule(
              Date.parse(rangeStart),
              Date.parse(rangeEnd),
              `AI_REQUEST:${reason}`,
              context,
            ),
        }),
      ),
  });

  const restoreSchema = z
    .object({
      changeSetId: z.string().min(1),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict();
  registry.register({
    definition: {
      name: 'restore_change_set',
      description: '根据用户明确指令撤销一个仍可恢复的 AI change set。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['changeSetId', 'userIntentReference'],
        properties: {
          changeSetId: { type: 'string', minLength: 1 },
          userIntentReference: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
    schema: restoreSchema,
    riskLevel: 'LOW_WRITE',
    execute: ({ changeSetId }, execution) =>
      Promise.resolve(
        executor.execute({
          execution: requireContext(execution),
          summary: `RestoreChangeSet:${changeSetId}`,
          mutate: (context) => services.actions.undoAiChangeSet(changeSetId, context),
        }),
      ),
  });
};

export const registerHighRiskActionTools = (
  registry: ToolRegistry,
  services: {
    readonly consistency: {
      createConfirmation(
        operationType: string,
        request: unknown,
        preview: unknown,
      ): { id: string; expiresAt: string };
    };
    readonly aiActions: {
      create(input: {
        actionType:
          'DELETE_RECORD' | 'BULK_UPDATE_RECORDS' | 'CLEAR_AI_MEMORY' | 'EMPTY_RECYCLE_BIN';
        request: unknown;
        preview: unknown;
        confirmationId: string;
        expiresAt?: string | undefined;
        executionContext?: AiToolExecutionContext | undefined;
      }): { id: string; status: string };
    };
    readonly readRecord: (recordType: string, entityId: string) => unknown;
    readonly memoryCount: () => number;
    readonly recycleCount: () => number;
  },
): void => {
  const propose = (
    actionType: 'DELETE_RECORD' | 'BULK_UPDATE_RECORDS' | 'CLEAR_AI_MEMORY' | 'EMPTY_RECYCLE_BIN',
    request: unknown,
    preview: unknown,
    execution: AiToolExecutionContext | undefined,
  ) => {
    const context = requireContext(execution);
    const confirmation = services.consistency.createConfirmation(actionType, request, preview);
    const action = services.aiActions.create({
      actionType,
      request,
      preview,
      confirmationId: confirmation.id,
      expiresAt: confirmation.expiresAt,
      executionContext: context,
    });
    return {
      actionId: action.id,
      status: action.status,
      preview,
      expiresAt: confirmation.expiresAt,
    };
  };

  const deleteSchema = z
    .object({
      recordType: z.string().trim().min(1).max(50),
      entityId: z.string().min(1),
      expectedVersion: z.number().int().positive(),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict();
  registry.register({
    definition: {
      name: 'delete_record',
      description: '提出软删除业务记录的高风险操作，等待用户确认后执行。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['recordType', 'entityId', 'expectedVersion', 'userIntentReference'],
        properties: {
          recordType: { type: 'string' },
          entityId: { type: 'string' },
          expectedVersion: { type: 'integer', minimum: 1 },
          userIntentReference: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
    schema: deleteSchema,
    riskLevel: 'HIGH_WRITE',
    execute: ({ userIntentReference: _intent, ...request }, execution) => {
      const current = services.readRecord(request.recordType, request.entityId);
      if (current === undefined) throw new Error('ENTITY_NOT_FOUND');
      return Promise.resolve(
        propose(
          'DELETE_RECORD',
          request,
          { actionType: 'DELETE_RECORD', count: 1, target: current },
          execution,
        ),
      );
    },
  });

  const bulkSchema = z
    .object({
      operations: z
        .array(
          z
            .object({
              recordType: recordTypeSchema,
              entityId: z.string().min(1),
              expectedVersion: z.number().int().positive(),
              patch: z.record(z.string(), z.unknown()),
            })
            .strict(),
        )
        .min(2)
        .max(50),
      userIntentReference: z.string().trim().min(1).max(200),
    })
    .strict()
    .superRefine((value, context) => {
      value.operations.forEach((operation, index) => {
        const parsed = updateDataSchema(operation.recordType).safeParse(operation.patch);
        if (!parsed.success)
          parsed.error.issues.forEach((issue) => {
            context.addIssue({ ...issue, path: ['operations', index, 'patch', ...issue.path] });
          });
      });
    });
  registry.register({
    definition: {
      name: 'bulk_update_records',
      description: '提出多个领域记录的原子批量更新，等待用户确认后一次执行。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['operations', 'userIntentReference'],
        properties: {
          operations: { type: 'array', minItems: 2, maxItems: 50 },
          userIntentReference: { type: 'string', minLength: 1 },
        },
      },
    },
    schema: bulkSchema,
    riskLevel: 'HIGH_WRITE',
    execute: ({ operations, userIntentReference: _intent }, execution) => {
      const validated = operations.map((operation) => ({
        ...operation,
        patch: updateDataSchema(operation.recordType).parse(operation.patch),
      }));
      const targets = validated.map((operation) => {
        const current = services.readRecord(operation.recordType, operation.entityId);
        if (current === undefined) throw new Error('ENTITY_NOT_FOUND');
        return current;
      });
      return Promise.resolve(
        propose(
          'BULK_UPDATE_RECORDS',
          { operations: validated },
          { actionType: 'BULK_UPDATE_RECORDS', count: validated.length, targets },
          execution,
        ),
      );
    },
  });

  for (const [name, actionType, count] of [
    ['clear_ai_memory', 'CLEAR_AI_MEMORY', services.memoryCount],
    ['empty_recycle_bin', 'EMPTY_RECYCLE_BIN', services.recycleCount],
  ] as const) {
    registry.register({
      definition: {
        name,
        description: `${actionType === 'CLEAR_AI_MEMORY' ? '清空 AI 长期记忆' : '永久清空回收站'}；仅创建待确认高风险操作。`,
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['userIntentReference'],
          properties: { userIntentReference: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
      schema: z.object({ userIntentReference: z.string().trim().min(1).max(200) }).strict(),
      riskLevel: 'HIGH_WRITE',
      execute: (_input, execution) => {
        const affected = count();
        const request = { count: affected };
        return Promise.resolve(
          propose(
            actionType,
            request,
            { actionType, count: affected, irreversible: actionType === 'EMPTY_RECYCLE_BIN' },
            execution,
          ),
        );
      },
    });
  }
};
