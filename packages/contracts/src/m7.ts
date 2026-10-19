import { z } from 'zod';

import { RequestMetaSchema } from './m1.js';

const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, meta: RequestMetaSchema });

export const AiProviderTypeSchema = z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE', 'OPENAI_COMPATIBLE']);
export const AiCapabilitiesSchema = z.object({
  chat: z.boolean(),
  streaming: z.boolean(),
  toolCalling: z.boolean(),
  nativeWebSearch: z.boolean(),
});
export const AiProviderConfigSchema = z.object({
  id: z.string(),
  providerType: AiProviderTypeSchema,
  displayName: z.string(),
  baseUrl: z.url().nullable(),
  modelId: z.string(),
  hasCredential: z.boolean(),
  capabilities: AiCapabilitiesSchema,
  isDefault: z.boolean(),
  lastVerifiedAt: z.iso.datetime().nullable(),
  lastError: z.string().nullable(),
  version: z.number().int().positive(),
});
export const CreateAiProviderRequestSchema = z
  .object({
    providerType: AiProviderTypeSchema,
    displayName: z.string().trim().min(1).max(100),
    baseUrl: z.url().nullish(),
    modelId: z.string().trim().min(1).max(200),
  })
  .superRefine((value, context) => {
    if (value.providerType === 'OPENAI_COMPATIBLE' && value.baseUrl === undefined) {
      context.addIssue({
        code: 'custom',
        message: '兼容 OpenAI 协议必须提供 baseUrl。',
        path: ['baseUrl'],
      });
    }
  });
export const UpdateAiProviderRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  baseUrl: z.url().nullable().optional(),
  modelId: z.string().trim().min(1).max(200).optional(),
  expectedVersion: z.number().int().positive(),
});
export const PutAiProviderCredentialRequestSchema = z.object({
  secret: z.string().trim().min(1).max(10_000),
});
export const AiProviderVersionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const AiProviderEnvelopeSchema = envelope(AiProviderConfigSchema);
export const AiProviderConfigsEnvelopeSchema = envelope(z.array(AiProviderConfigSchema));

export type AiProviderConfigDto = z.infer<typeof AiProviderConfigSchema>;
export type AiCapabilitiesDto = z.infer<typeof AiCapabilitiesSchema>;

export const NotificationSchema = z.object({
  id: z.string().length(26),
  notificationType: z.enum(['REMINDER', 'SYSTEM', 'AI_SUGGESTION', 'SCHEDULE_WARNING']),
  targetEntityId: z.string().length(26).nullable(),
  targetEntityType: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  scheduledAt: z.iso.datetime(),
  deliveredAt: z.iso.datetime().nullable(),
  readAt: z.iso.datetime().nullable(),
  snoozedUntil: z.iso.datetime().nullable(),
});
export const NotificationsEnvelopeSchema = envelope(z.array(NotificationSchema));
export type NotificationDto = z.infer<typeof NotificationSchema>;

export const ChatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  providerConfigId: z.string(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  lastMessageAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['USER', 'ASSISTANT', 'TOOL', 'SYSTEM']),
  content: z.unknown(),
  plainText: z.string(),
  modelId: z.string().nullable(),
  status: z.enum(['PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  sources: z.array(z.object({ title: z.string(), url: z.url(), retrievedAt: z.iso.datetime() })),
});
export const AiRunSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  status: z.enum([
    'QUEUED',
    'RUNNING',
    'AWAITING_TOOL',
    'AWAITING_CONFIRMATION',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ]),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  errorCode: z.string().nullable(),
});
export const CreateChatRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  providerConfigId: z.string(),
});
export const UpdateChatSessionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  expectedVersion: z.number().int().positive(),
});
export const TodayAiContextSchema = z.object({
  source: z.literal('TODAY'),
  date: z.iso.date(),
  timeZone: z.string().min(1).max(100),
  currentTime: z.iso.datetime(),
  pressure: z.object({
    score: z.number().int().min(0).max(100),
    level: z.enum(['RELAXED', 'COMFORTABLE', 'ELEVATED', 'HIGH_PRESSURE']),
  }),
  totals: z.object({
    sleepMinutes: z.number().int().nonnegative(),
    workMinutes: z.number().int().nonnegative(),
    lifeMinutes: z.number().int().nonnegative(),
    freeMinutes: z.number().int().nonnegative(),
  }),
  currentBlock: z
    .object({
      title: z.string().max(300),
      kind: z.enum(['TASK', 'EVENT', 'SLEEP', 'REST']),
      area: z.enum(['WORK', 'LIFE', 'SLEEP']),
      startAt: z.iso.datetime(),
      endAt: z.iso.datetime(),
    })
    .nullable(),
  upcoming: z
    .array(
      z.object({
        title: z.string().max(300),
        kind: z.enum(['TASK', 'EVENT']),
        area: z.enum(['WORK', 'LIFE']),
        startAt: z.iso.datetime(),
        endAt: z.iso.datetime(),
      }),
    )
    .max(5),
});
export type TodayAiContextDto = z.infer<typeof TodayAiContextSchema>;
export const SendChatMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(20000),
  context: TodayAiContextSchema.optional(),
});
export const ChatSessionEnvelopeSchema = envelope(ChatSessionSchema);
export const ChatSessionsEnvelopeSchema = envelope(z.array(ChatSessionSchema));
export const ChatMessagesEnvelopeSchema = envelope(z.array(ChatMessageSchema));
export const AiRunEnvelopeSchema = envelope(AiRunSchema);
export const SendChatMessageEnvelopeSchema = envelope(
  z.object({
    userMessageId: z.string(),
    assistantMessageId: z.string(),
    runId: z.string(),
    status: z.literal('QUEUED'),
  }),
);

export const AiActionSchema = z.object({
  id: z.string().length(26),
  actionType: z.enum([
    'REPLACE_LONG_TERM_GOAL',
    'DELETE_RECORD',
    'BULK_UPDATE_RECORDS',
    'CLEAR_AI_MEMORY',
    'EMPTY_RECYCLE_BIN',
    'REQUEST_RESCHEDULE',
  ]),
  preview: z.unknown(),
  status: z.enum([
    'AWAITING_CONFIRMATION',
    'CONFIRMED',
    'EXECUTING',
    'EXECUTED',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
  ]),
  createdAt: z.iso.datetime(),
  executedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  result: z.unknown().nullable(),
  errorCode: z.string().nullable(),
});
export const AiActionEnvelopeSchema = envelope(AiActionSchema);
export const ConfirmAiActionEnvelopeSchema = envelope(
  z.object({ action: AiActionSchema, result: z.unknown() }),
);

export const AiChangeOperationSchema = z.object({
  sequence: z.number().int().nonnegative(),
  entityId: z.string().length(26).nullable(),
  operation: z.enum(['CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'PURGE']),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
});
export const AiChangeSetSchema = z.object({
  id: z.string().length(26),
  source: z.enum(['USER', 'RULE_ENGINE', 'AI', 'SYSTEM']),
  summary: z.string(),
  riskLevel: z.enum(['READ_ONLY', 'LOW_WRITE', 'HIGH_WRITE']),
  status: z.enum(['PENDING', 'APPLIED', 'REVERTED', 'FAILED']),
  createdAt: z.iso.datetime(),
  appliedAt: z.iso.datetime().nullable(),
  revertedAt: z.iso.datetime().nullable(),
  operations: z.array(AiChangeOperationSchema),
});
export const AiChangeSetEnvelopeSchema = envelope(AiChangeSetSchema);
export const UndoAiChangeSetEnvelopeSchema = envelope(AiChangeSetSchema);
export const ClearAiMemoryPreviewSchema = z.object({
  confirmationId: z.string().length(26),
  count: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime(),
});
export const ClearAiMemoryConfirmRequestSchema = z.object({
  confirmationId: z.string().length(26),
  count: z.number().int().nonnegative(),
});
export const ClearAiMemoryPreviewEnvelopeSchema = envelope(ClearAiMemoryPreviewSchema);
export const ClearAiMemoryConfirmEnvelopeSchema = envelope(
  z.object({ cleared: z.number().int().nonnegative() }),
);
export const CreateAiSuggestionRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
});
export const AiSuggestionAnalysisSchema = z.object({
  created: z.number().int().nonnegative(),
});
export const AiSuggestionEnvelopeSchema = envelope(NotificationSchema);
export const AiSuggestionAnalysisEnvelopeSchema = envelope(AiSuggestionAnalysisSchema);
