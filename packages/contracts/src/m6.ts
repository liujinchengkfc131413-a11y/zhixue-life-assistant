import { z } from 'zod';

import { RequestMetaSchema } from './m1.js';

const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, meta: RequestMetaSchema });

export const CaptureModeSchema = z.enum(['INBOX_ONLY', 'AI_PROCESS']);
export const InboxStatusSchema = z.enum(['UNPROCESSED', 'PROCESSING', 'PROCESSED', 'ARCHIVED']);
export const InboxResultSchema = z.object({
  entityId: z.string(),
  resultType: z.enum(['TASK', 'SHOPPING_ITEM', 'GOAL']),
  createdAt: z.iso.datetime(),
});
export const InboxItemSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  status: InboxStatusSchema,
  captureMode: CaptureModeSchema,
  processedChangeSetId: z.string().nullable(),
  processedAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  results: z.array(InboxResultSchema),
});
export const QuickCaptureRequestSchema = z.object({
  text: z.string().trim().min(1).max(10000),
  mode: CaptureModeSchema,
});
export const UpdateInboxItemRequestSchema = z.object({
  rawText: z.string().trim().min(1).max(10000),
  expectedVersion: z.number().int().positive(),
});
const TaskInboxResultSchema = z.object({
  resultType: z.literal('TASK'),
  categoryId: z.string(),
  title: z.string().trim().min(1).max(300),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueAt: z.iso.datetime(),
  estimatedMinutes: z.number().int().positive().multipleOf(15).default(30),
  isFlexible: z.boolean().default(true),
  preferredArea: z.enum(['WORK', 'LIFE']),
});
const ShoppingInboxResultSchema = z.object({
  resultType: z.literal('SHOPPING_ITEM'),
  categoryId: z.string(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().default(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
});
const GoalInboxResultSchema = z
  .object({
    resultType: z.literal('GOAL'),
    categoryId: z.string(),
    title: z.string().trim().min(1).max(300),
    description: z.string().max(20_000).optional(),
    goalType: z.enum(['OUTCOME', 'HABIT']),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable().optional(),
  })
  .refine(
    (value) =>
      value.endDate === undefined || value.endDate === null || value.startDate <= value.endDate,
    '目标结束日期不能早于开始日期。',
  );
export const ProcessInboxManuallyRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  results: z
    .array(z.union([TaskInboxResultSchema, ShoppingInboxResultSchema, GoalInboxResultSchema]))
    .min(1)
    .max(50),
});
export const ArchiveInboxItemRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const InboxItemEnvelopeSchema = envelope(InboxItemSchema);
export const InboxItemsEnvelopeSchema = envelope(z.array(InboxItemSchema));

export const DraftSchema = z.object({
  id: z.string(),
  draftKey: z.string(),
  entityId: z.string().nullable(),
  formType: z.string(),
  content: z.unknown(),
  updatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
});
export const SaveDraftRequestSchema = z.object({
  entityId: z.string().nullable().optional(),
  formType: z.string().trim().min(1).max(100),
  content: z.unknown(),
  expiresAt: z.iso.datetime().nullable().optional(),
});
export const DraftEnvelopeSchema = envelope(DraftSchema.nullable());

export const ConvertNotePreviewRequestSchema = z.object({
  targetMode: z.enum(['RICH_TEXT', 'MARKDOWN']),
});
export const ConvertNotePreviewSchema = z.object({
  sourceMode: z.enum(['RICH_TEXT', 'MARKDOWN']),
  targetMode: z.enum(['RICH_TEXT', 'MARKDOWN']),
  preview: z.string(),
  warnings: z.array(z.string()),
  hasLoss: z.boolean(),
});
export const ConvertNotePreviewEnvelopeSchema = envelope(ConvertNotePreviewSchema);

export const SearchResultSchema = z.object({
  entityId: z.string(),
  entityType: z.string(),
  categoryId: z.string().nullable(),
  ownerEntityId: z.string().nullable(),
  ownerEntityType: z.string().nullable(),
  title: z.string(),
  snippet: z.string(),
  eventAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});
export const SearchQuerySchema = z
  .object({
    q: z.string(),
    entityType: z.string().optional(),
    module: z.string().optional(),
    categoryId: z.string().optional(),
    status: z.string().optional(),
    tagId: z.string().optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .refine(
    (value) =>
      value.from === undefined ||
      value.to === undefined ||
      Date.parse(value.from) < Date.parse(value.to),
    { message: 'from must be before to' },
  );
export const SearchResultsEnvelopeSchema = envelope(z.array(SearchResultSchema));
export const RebuildSearchEnvelopeSchema = envelope(
  z.object({ indexed: z.number().int().nonnegative() }),
);
export const EntityVersionSchema = z.object({
  entityVersion: z.number().int().positive(),
  source: z.string(),
  snapshot: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
  changeSetId: z.string().nullable(),
  summary: z.string().nullable(),
  historyKind: z.enum(['AUDIT_ONLY', 'BASELINE', 'CANONICAL']),
  restoreEligibility: z.enum(['UNVERIFIED', 'ELIGIBLE']),
});
export const EntityVersionsEnvelopeSchema = envelope(z.array(EntityVersionSchema));
export const ChangeSetSchema = z.object({
  id: z.string(),
  source: z.string(),
  summary: z.string(),
  riskLevel: z.string(),
  status: z.string(),
  operationCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  appliedAt: z.iso.datetime().nullable(),
  revertedAt: z.iso.datetime().nullable(),
  entityId: z.string().nullable(),
  entityVersion: z.number().int().positive().nullable(),
  canUndo: z.boolean(),
  canRedo: z.boolean(),
});
export const ChangeSetsEnvelopeSchema = envelope(z.array(ChangeSetSchema));
export const RecycleItemSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  version: z.number().int().positive(),
  title: z.string(),
  deletedAt: z.iso.datetime(),
  purgeAfter: z.iso.datetime(),
});
export const RecycleItemsEnvelopeSchema = envelope(z.array(RecycleItemSchema));
export const RestoreRecycleItemRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const PurgePreviewRequestSchema = z.object({ expectedVersion: z.number().int().positive() });
export const VersionRestorePreviewRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const ConfirmationPreviewSchema = z.object({
  id: z.string(),
  token: z.string(),
  expiresAt: z.iso.datetime(),
  preview: z.unknown(),
});
export const ConfirmationPreviewEnvelopeSchema = envelope(ConfirmationPreviewSchema);
export const ExecuteConfirmationRequestSchema = z.object({
  token: z.string().min(1),
  operation: z.enum(['PURGE_ENTITY', 'RESTORE_VERSION', 'UNDO_CHANGE_SET', 'REDO_CHANGE_SET']),
  entityId: z.string(),
  expectedVersion: z.number().int().positive(),
  targetVersion: z.number().int().positive().optional(),
  changeSetId: z.string().optional(),
});
export const MutationEnvelopeSchema = envelope(z.object({ success: z.literal(true) }));

export type InboxItemDto = z.infer<typeof InboxItemSchema>;
export type InboxStatusDto = z.infer<typeof InboxStatusSchema>;
export type ProcessInboxManuallyRequest = z.infer<typeof ProcessInboxManuallyRequestSchema>;
