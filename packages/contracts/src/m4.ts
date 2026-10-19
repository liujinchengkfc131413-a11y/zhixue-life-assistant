import { z } from 'zod';

import { RequestMetaSchema } from './m1.js';

const EntitySchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const nullableText = z.string().max(20_000).nullable();
const optionalNullableText = z.string().max(20_000).nullable().optional();
const nullableId = z.string().nullable();
const optionalNullableId = z.string().nullable().optional();
const optionalNullableDateTime = z.iso.datetime().nullable().optional();
const ExpectedVersionSchema = z.object({ expectedVersion: z.number().int().positive() });

export const ContentTypeSchema = z.enum(['VIDEO', 'ARTICLE', 'AUDIO', 'IMAGE', 'OTHER']);
export const ContentStatusSchema = z.enum([
  'IDEA',
  'PLANNING',
  'CREATING',
  'READY',
  'PUBLISHED',
  'ARCHIVED',
]);
export const SelfMediaContentSchema = EntitySchema.extend({
  categoryId: z.string(),
  title: z.string(),
  idea: nullableText,
  script: nullableText,
  contentType: ContentTypeSchema,
  platform: nullableText,
  productionStatus: ContentStatusSchema,
  plannedPublishAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  calendarEventId: nullableId,
  taskId: nullableId,
});
export const CreateSelfMediaContentSchema = z.object({
  categoryId: z.string(),
  title: z.string().trim().min(1).max(200),
  idea: optionalNullableText,
  script: optionalNullableText,
  contentType: ContentTypeSchema,
  platform: z.string().max(100).nullable().optional(),
  productionStatus: ContentStatusSchema.optional(),
  plannedPublishAt: optionalNullableDateTime,
  publishedAt: optionalNullableDateTime,
  calendarEventId: optionalNullableId,
  taskId: optionalNullableId,
});
export const UpdateSelfMediaContentSchema = ExpectedVersionSchema.extend({
  title: z.string().trim().min(1).max(200).optional(),
  idea: optionalNullableText,
  script: optionalNullableText,
  contentType: ContentTypeSchema.optional(),
  platform: z.string().max(100).nullable().optional(),
  productionStatus: ContentStatusSchema.optional(),
  plannedPublishAt: optionalNullableDateTime,
  publishedAt: optionalNullableDateTime,
  calendarEventId: optionalNullableId,
  taskId: optionalNullableId,
});
export const TransitionContentSchema = ExpectedVersionSchema.extend({
  status: ContentStatusSchema,
  publishedAt: optionalNullableDateTime,
});

const optionalCount = z.number().int().nonnegative().nullable().optional();
export const SelfMediaMetricSchema = EntitySchema.extend({
  contentId: z.string(),
  recordedDate: z.iso.date(),
  platform: z.string(),
  views: z.number().int().nonnegative().nullable(),
  likes: z.number().int().nonnegative().nullable(),
  comments: z.number().int().nonnegative().nullable(),
  favorites: z.number().int().nonnegative().nullable(),
  shares: z.number().int().nonnegative().nullable(),
  followerDelta: z.number().int().nullable(),
  customMetrics: z.record(z.string(), z.number()),
});
export const CreateMetricSchema = z.object({
  recordedDate: z.iso.date(),
  platform: z.string().trim().min(1).max(100),
  views: optionalCount,
  likes: optionalCount,
  comments: optionalCount,
  favorites: optionalCount,
  shares: optionalCount,
  followerDelta: z.number().int().nullable().optional(),
  customMetrics: z.record(z.string(), z.number()).optional(),
});
export const UpdateMetricSchema = CreateMetricSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});

export const DevProjectStatusSchema = z.enum([
  'PLANNING',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
]);
export const DevProjectSchema = EntitySchema.extend({
  categoryId: z.string(),
  name: z.string(),
  summary: nullableText,
  status: DevProjectStatusSchema,
  startDate: z.iso.date().nullable(),
  targetDate: z.iso.date().nullable(),
  planId: nullableId,
});
export const CreateDevProjectSchema = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(200),
  summary: optionalNullableText,
  status: DevProjectStatusSchema.optional(),
  startDate: z.iso.date().nullable().optional(),
  targetDate: z.iso.date().nullable().optional(),
  planId: optionalNullableId,
});
export const UpdateDevProjectSchema = CreateDevProjectSchema.omit({ categoryId: true })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });

export const WorkPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const FeatureStatusSchema = z.enum([
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
]);
export const DevFeatureSchema = EntitySchema.extend({
  projectId: z.string(),
  title: z.string(),
  description: nullableText,
  status: FeatureStatusSchema,
  priority: WorkPrioritySchema,
  taskId: nullableId,
  milestoneId: nullableId,
  sortOrder: z.number().int().nonnegative(),
});
export const CreateDevFeatureSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalNullableText,
  status: FeatureStatusSchema.default('BACKLOG'),
  priority: WorkPrioritySchema.default('NORMAL'),
  taskId: optionalNullableId,
  milestoneId: optionalNullableId,
  sortOrder: z.number().int().nonnegative().default(0),
});
export const UpdateDevFeatureSchema = CreateDevFeatureSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});

export const DefectStatusSchema = z.enum([
  'OPEN',
  'CONFIRMED',
  'FIXING',
  'RESOLVED',
  'CLOSED',
  'WONT_FIX',
]);
export const DefectSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const DevDefectSchema = EntitySchema.extend({
  projectId: z.string(),
  featureId: nullableId,
  taskId: nullableId,
  title: z.string(),
  description: nullableText,
  reproductionSteps: nullableText,
  severity: DefectSeveritySchema,
  status: DefectStatusSchema,
  foundVersion: nullableText,
  resolvedVersion: nullableText,
  resolvedAt: z.iso.datetime().nullable(),
});
export const CreateDevDefectSchema = z.object({
  featureId: optionalNullableId,
  taskId: optionalNullableId,
  title: z.string().trim().min(1).max(200),
  description: optionalNullableText,
  reproductionSteps: optionalNullableText,
  severity: DefectSeveritySchema.default('MEDIUM'),
  status: DefectStatusSchema.default('OPEN'),
  foundVersion: z.string().max(100).nullable().optional(),
  resolvedVersion: z.string().max(100).nullable().optional(),
});
export const UpdateDevDefectSchema = CreateDevDefectSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});

export const RepositoryLinkSchema = EntitySchema.extend({
  projectId: z.string(),
  name: z.string(),
  url: z.url(),
  description: nullableText,
  sortOrder: z.number().int().nonnegative(),
});
export const CreateRepositoryLinkSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.url(),
  description: optionalNullableText,
  sortOrder: z.number().int().nonnegative().default(0),
});
export const UpdateRepositoryLinkSchema = CreateRepositoryLinkSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});

export const LearningStatusSchema = z.enum([
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'PAUSED',
  'ABANDONED',
]);
export const LearningResourceTypeSchema = z.enum([
  'COURSE',
  'BOOK',
  'ARTICLE',
  'VIDEO',
  'DOCUMENT',
  'OTHER',
]);
export const LearningResourceSchema = EntitySchema.extend({
  categoryId: z.string(),
  title: z.string(),
  resourceType: LearningResourceTypeSchema,
  author: nullableText,
  sourceUrl: z.url().nullable(),
  status: LearningStatusSchema,
  progressCurrent: z.number().nonnegative().nullable(),
  progressTotal: z.number().positive().nullable(),
  progressUnit: nullableText,
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
});
export const CreateLearningResourceSchema = z.object({
  categoryId: z.string(),
  title: z.string().trim().min(1).max(200),
  resourceType: LearningResourceTypeSchema,
  author: z.string().max(200).nullable().optional(),
  sourceUrl: z.url().nullable().optional(),
  status: LearningStatusSchema.optional(),
  progressCurrent: z.number().nonnegative().nullable().optional(),
  progressTotal: z.number().positive().nullable().optional(),
  progressUnit: z.string().max(40).nullable().optional(),
});
export const UpdateLearningResourceSchema = CreateLearningResourceSchema.omit({ categoryId: true })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const SetLearningProgressSchema = ExpectedVersionSchema.extend({
  current: z.number().nonnegative(),
  status: LearningStatusSchema.optional(),
});
export const LearningSessionSchema = EntitySchema.extend({
  resourceId: nullableId,
  planId: nullableId,
  taskId: nullableId,
  sessionDate: z.iso.date(),
  durationMinutes: z.number().int().positive(),
  progressDelta: z.number().nullable(),
  summary: nullableText,
});
const LearningSessionInputSchema = z.object({
  resourceId: optionalNullableId,
  planId: optionalNullableId,
  taskId: optionalNullableId,
  sessionDate: z.iso.date(),
  durationMinutes: z.number().int().positive(),
  progressDelta: z.number().nullable().optional(),
  summary: optionalNullableText,
});
export const CreateLearningSessionSchema = LearningSessionInputSchema.refine(
  (x) => x.resourceId != null || x.planId != null || x.taskId != null,
  { message: '至少关联一个学习资源、计划或任务' },
);
export const UpdateLearningSessionSchema = LearningSessionInputSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const LinkLearningResourceSchema = z.object({ resourceId: z.string() });

export const WorkNoteRoleSchema = z.enum(['SCRIPT', 'TECHNICAL', 'KNOWLEDGE', 'MATERIAL', 'OTHER']);
export const WorkNoteSchema = EntitySchema.extend({
  categoryId: z.string(),
  title: z.string(),
  editorMode: z.enum(['RICH_TEXT', 'MARKDOWN']),
  markdownContent: nullableText,
  richContent: z.unknown().nullable(),
  plainText: z.string(),
  summary: nullableText,
  role: WorkNoteRoleSchema,
});
export const CreateWorkNoteSchema = z
  .object({
    categoryId: z.string(),
    title: z.string().trim().min(1).max(200),
    editorMode: z.enum(['RICH_TEXT', 'MARKDOWN']).default('MARKDOWN'),
    markdownContent: z.string().max(100_000).nullable().optional(),
    richContent: z.unknown().nullable().optional(),
    summary: optionalNullableText,
    role: WorkNoteRoleSchema,
  })
  .superRefine((value, context) => {
    if (value.editorMode === 'MARKDOWN' && value.markdownContent === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['markdownContent'],
        message: 'Markdown 模式需要原文',
      });
    }
    if (value.editorMode === 'RICH_TEXT' && value.richContent === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['richContent'],
        message: '富文本模式需要文档内容',
      });
    }
  });
export const UpdateWorkNoteSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  markdownContent: z.string().max(100_000).nullable().optional(),
  richContent: z.unknown().nullable().optional(),
  editorMode: z.enum(['RICH_TEXT', 'MARKDOWN']).optional(),
  summary: optionalNullableText,
  role: WorkNoteRoleSchema.optional(),
});

export const DevMilestoneStatusSchema = z.enum(['PENDING', 'AT_RISK', 'ACHIEVED', 'MISSED']);
export const DevProjectMilestoneSchema = EntitySchema.extend({
  projectId: z.string(),
  title: z.string(),
  description: nullableText,
  dueAt: z.iso.datetime(),
  status: DevMilestoneStatusSchema,
  achievedAt: z.iso.datetime().nullable(),
  taskId: nullableId,
});
export const CreateDevProjectMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalNullableText,
  dueAt: z.iso.datetime(),
  status: DevMilestoneStatusSchema.optional(),
  taskId: optionalNullableId,
});
export const UpdateDevProjectMilestoneSchema = CreateDevProjectMilestoneSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});

export const AttachmentRoleSchema = z.enum(['GENERAL', 'MATERIAL', 'DOCUMENT', 'COVER']);
export const LinkAttachmentSchema = z.object({
  attachmentId: z.string(),
  role: AttachmentRoleSchema,
});
export const LinkedAttachmentSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  safeName: z.string(),
  mediaType: z.string(),
  extension: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  storageKey: z.string(),
  description: z.string().nullable(),
  status: z.enum(['UPLOADING', 'READY', 'MISSING', 'QUARANTINED']),
  role: AttachmentRoleSchema,
});

export const SelfMediaTrendPointSchema = z.object({
  date: z.iso.date(),
  views: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
  favorites: z.number().int(),
  shares: z.number().int(),
  followerDelta: z.number().int(),
});

export const WorkRangeSchema = z.enum(['WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM']);
export const WorkRangeQuerySchema = z.object({
  range: WorkRangeSchema.default('WEEK'),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export const WorkOverviewSchema = z.object({
  range: z.object({ from: z.iso.date(), to: z.iso.date() }),
  tasks: z.object({
    total: z.number().int(),
    completed: z.number().int(),
    overdue: z.number().int(),
    completionRate: z.number(),
  }),
  selfMedia: z.object({
    contents: z.number().int(),
    published: z.number().int(),
    views: z.number(),
  }),
  development: z.object({
    projects: z.number().int(),
    featureCompletionRate: z.number(),
    openDefects: z.number().int(),
    criticalDefects: z.number().int(),
  }),
  learning: z.object({
    minutes: z.number().int(),
    activeResources: z.number().int(),
    completedResources: z.number().int(),
  }),
});

const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, meta: RequestMetaSchema });
export const SelfMediaContentEnvelopeSchema = envelope(SelfMediaContentSchema);
export const SelfMediaContentsEnvelopeSchema = envelope(z.array(SelfMediaContentSchema));
export const SelfMediaMetricEnvelopeSchema = envelope(SelfMediaMetricSchema);
export const SelfMediaMetricsEnvelopeSchema = envelope(z.array(SelfMediaMetricSchema));
export const DevProjectEnvelopeSchema = envelope(DevProjectSchema);
export const DevProjectsEnvelopeSchema = envelope(z.array(DevProjectSchema));
export const DevFeatureEnvelopeSchema = envelope(DevFeatureSchema);
export const DevFeaturesEnvelopeSchema = envelope(z.array(DevFeatureSchema));
export const DevDefectEnvelopeSchema = envelope(DevDefectSchema);
export const DevDefectsEnvelopeSchema = envelope(z.array(DevDefectSchema));
export const RepositoryLinkEnvelopeSchema = envelope(RepositoryLinkSchema);
export const RepositoryLinksEnvelopeSchema = envelope(z.array(RepositoryLinkSchema));
export const LearningResourceEnvelopeSchema = envelope(LearningResourceSchema);
export const LearningResourcesEnvelopeSchema = envelope(z.array(LearningResourceSchema));
export const LearningSessionEnvelopeSchema = envelope(LearningSessionSchema);
export const LearningSessionsEnvelopeSchema = envelope(z.array(LearningSessionSchema));
export const WorkOverviewEnvelopeSchema = envelope(WorkOverviewSchema);
export const WorkNoteEnvelopeSchema = envelope(WorkNoteSchema);
export const WorkNotesEnvelopeSchema = envelope(z.array(WorkNoteSchema));
export const DevProjectMilestoneEnvelopeSchema = envelope(DevProjectMilestoneSchema);
export const DevProjectMilestonesEnvelopeSchema = envelope(z.array(DevProjectMilestoneSchema));
export const LinkedAttachmentsEnvelopeSchema = envelope(z.array(LinkedAttachmentSchema));
export const SelfMediaTrendEnvelopeSchema = envelope(z.array(SelfMediaTrendPointSchema));
