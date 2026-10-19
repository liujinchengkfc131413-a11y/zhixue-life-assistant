import { z } from 'zod';

export const RequestMetaSchema = z.object({ requestId: z.string().min(1) });

export const SetupStatusSchema = z.object({
  initialized: z.boolean(),
  dataDirectory: z.string().nullable(),
  suggestedDataDirectory: z.string(),
});
export const SetupStatusEnvelopeSchema = z.object({
  data: SetupStatusSchema,
  meta: RequestMetaSchema,
});
const SetupRoutineSegmentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  segmentType: z.enum(['SLEEP', 'WORK', 'LIFE', 'REST']),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/),
  isImmovable: z.boolean(),
});
const SetupRoutineTemplateSchema = z.object({
  templateType: z.enum(['WORKDAY', 'WEEKEND', 'HOLIDAY']),
  segments: z.array(SetupRoutineSegmentSchema).min(1),
});
const setupTimeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};
export const InitializeRequestSchema = z
  .object({
    dataDirectory: z.string().trim().min(1).max(1024),
    includeDemoData: z.boolean().default(true),
    backupFrequency: z.enum(['DAILY', 'WEEKLY', 'MANUAL']).default('WEEKLY'),
    backupRetentionCount: z.number().int().min(1).max(52).default(8),
    quickCaptureDefaultAction: z.enum(['INBOX', 'AI']).default('INBOX'),
    routineTemplates: z.array(SetupRoutineTemplateSchema).length(3).optional(),
    aiProvider: z
      .object({
        providerType: z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE', 'OPENAI_COMPATIBLE']),
        displayName: z.string().trim().min(1).max(100),
        baseUrl: z.url().optional(),
        modelId: z.string().trim().min(1).max(200),
        apiKey: z.string().min(1).max(4096),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.routineTemplates !== undefined) {
      const types = new Set(value.routineTemplates.map((template) => template.templateType));
      if (types.size !== 3) {
        context.addIssue({
          code: 'custom',
          path: ['routineTemplates'],
          message: '工作日、周末和节假日作息必须各提供一份。',
        });
      }
      value.routineTemplates.forEach((template, templateIndex) => {
        const occupied: { start: number; end: number }[] = [];
        template.segments.forEach((segment, segmentIndex) => {
          const start = setupTimeToMinutes(segment.startTime);
          const end = setupTimeToMinutes(segment.endTime);
          if (start === end) {
            context.addIssue({
              code: 'custom',
              path: ['routineTemplates', templateIndex, 'segments', segmentIndex],
              message: '作息时段的开始与结束时间不能相同。',
            });
            return;
          }
          const parts =
            end > start
              ? [{ start, end }]
              : [
                  { start, end: 1440 },
                  { start: 0, end },
                ];
          if (
            parts.some((part) =>
              occupied.some((other) => part.start < other.end && other.start < part.end),
            )
          ) {
            context.addIssue({
              code: 'custom',
              path: ['routineTemplates', templateIndex, 'segments', segmentIndex],
              message: '同一作息模板的时段不能重叠。',
            });
          }
          occupied.push(...parts);
        });
      });
    }
    if (
      value.aiProvider?.providerType === 'OPENAI_COMPATIBLE' &&
      value.aiProvider.baseUrl === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['aiProvider', 'baseUrl'],
        message: '兼容服务必须提供 Base URL。',
      });
    }
  });
export const DataDirectoryMigrationPreviewRequestSchema = z.object({
  dataDirectory: z.string().trim().min(1).max(1024),
});
export const DataDirectoryMigrationPreviewSchema = z.object({
  source: z.string(),
  destination: z.string(),
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  confirmation: z.object({
    id: z.string().length(26),
    token: z.string().min(32),
    expiresAt: z.iso.datetime(),
  }),
});
export const DataDirectoryMigrationPreviewEnvelopeSchema = z.object({
  data: DataDirectoryMigrationPreviewSchema,
  meta: RequestMetaSchema,
});
export const DataDirectoryMigrationExecuteRequestSchema = z.object({
  dataDirectory: z.string().trim().min(1).max(1024),
  confirmationId: z.string().length(26),
  confirmationToken: z.string().min(32),
});

export const SettingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);
export const SettingSchema = z.object({
  key: z.string().min(1).max(120),
  value: SettingValueSchema,
  valueType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'OBJECT', 'ARRAY']),
  updatedAt: z.iso.datetime(),
});
export const SettingsEnvelopeSchema = z.object({
  data: z.array(SettingSchema),
  meta: RequestMetaSchema,
});
export const UpdateSettingsRequestSchema = z.object({
  values: z.record(z.string().min(1).max(120), SettingValueSchema),
});
export const SettingDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'SELECT', 'PATH']),
  options: z.array(z.object({ value: SettingValueSchema, label: z.string() })).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  sensitive: z.literal(false),
});
export const SettingsSchemaEnvelopeSchema = z.object({
  data: z.array(SettingDefinitionSchema),
  meta: RequestMetaSchema,
});

export const ParentAreaSchema = z.enum(['WORK', 'LIFE']);
export const ModuleTypeSchema = z.enum([
  'SELF_MEDIA',
  'DEVELOPMENT',
  'LEARNING',
  'SHOPPING',
  'DIET',
  'FITNESS',
  'ENTERTAINMENT',
  'GENERIC',
]);
export const CategorySchema = z.object({
  id: z.string().length(26),
  parentArea: ParentAreaSchema,
  moduleType: ModuleTypeSchema,
  name: z.string().min(1).max(80),
  description: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
  isArchived: z.boolean(),
  version: z.number().int().positive(),
});
export const CategoriesEnvelopeSchema = z.object({
  data: z.array(CategorySchema),
  meta: RequestMetaSchema.extend({
    orderVersions: z.record(ParentAreaSchema, z.number().int().positive()),
  }),
});
export const CategoryEnvelopeSchema = z.object({ data: CategorySchema, meta: RequestMetaSchema });
export const CreateCategoryRequestSchema = z.object({
  parentArea: ParentAreaSchema,
  moduleType: ModuleTypeSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
});
export const UpdateCategoryRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});
export const ArchiveCategoryRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const ReorderCategoriesRequestSchema = z.object({
  parentArea: ParentAreaSchema,
  ids: z.array(z.string().length(26)),
  expectedOrderVersion: z.number().int().positive(),
});

export const TagSchema = z.object({
  id: z.string().length(26),
  name: z.string().min(1).max(40),
  colorToken: z.string().nullable(),
  description: z.string().nullable(),
  version: z.number().int().positive(),
});
export const TagsEnvelopeSchema = z.object({ data: z.array(TagSchema), meta: RequestMetaSchema });
export const TagEnvelopeSchema = z.object({ data: TagSchema, meta: RequestMetaSchema });
export const CreateTagRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
  colorToken: z.enum(['slate', 'blue', 'green', 'amber', 'red', 'purple']).optional(),
  description: z.string().trim().max(500).optional(),
});
export const UpdateTagRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(40).optional(),
  colorToken: z.enum(['slate', 'blue', 'green', 'amber', 'red', 'purple']).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});
export const DeleteTagPreviewRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const DeleteTagPreviewEnvelopeSchema = z.object({
  data: z.object({
    summary: z.string(),
    tagId: z.string().length(26),
    confirmation: z.object({
      id: z.string().length(26),
      token: z.string().min(32),
      expiresAt: z.iso.datetime(),
    }),
  }),
  meta: RequestMetaSchema,
});
export const DeleteTagRequestSchema = DeleteTagPreviewRequestSchema.extend({
  confirmationId: z.string().length(26),
  confirmationToken: z.string().min(32),
});

export const SessionSchema = z.object({
  csrfToken: z.string().min(32),
  expiresAt: z.iso.datetime(),
});
export const SessionEnvelopeSchema = z.object({ data: SessionSchema, meta: RequestMetaSchema });

export const BackupSchema = z.object({
  path: z.string(),
  checksum: z.string().length(64),
  manifest: z.object({
    formatVersion: z.literal(1),
    appVersion: z.string(),
    schemaVersion: z.number().int().nonnegative(),
    generatedAt: z.iso.datetime(),
    installationId: z.string(),
    fileCount: z.number().int().positive(),
  }),
});
export const BackupEnvelopeSchema = z.object({ data: BackupSchema, meta: RequestMetaSchema });
export const BackupRecordSchema = z.object({
  id: z.string(),
  backupType: z.string(),
  status: z.string(),
  path: z.string().nullable(),
  manifest: z.unknown().nullable(),
  checksum: z.string().nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  error: z.string().nullable(),
});
export const BackupRecordsEnvelopeSchema = z.object({
  data: z.array(BackupRecordSchema),
  meta: RequestMetaSchema,
});
export const BackupRestorePreviewRequestSchema = z.object({
  path: z.string().trim().min(1).max(1024),
});
export const BackupRestorePreviewSchema = z.object({
  path: z.string(),
  appVersion: z.string(),
  schemaVersion: z.number().int().positive(),
  generatedAt: z.iso.datetime(),
  fileCount: z.number().int().positive(),
  confirmation: z.object({ id: z.string(), token: z.string(), expiresAt: z.iso.datetime() }),
});
export const BackupRestorePreviewEnvelopeSchema = z.object({
  data: BackupRestorePreviewSchema,
  meta: RequestMetaSchema,
});
export const BackupRestoreExecuteRequestSchema = z.object({
  path: z.string().trim().min(1).max(1024),
  confirmationId: z.string(),
  confirmationToken: z.string(),
});

export const DemoDataStatusSchema = z.object({
  exists: z.boolean(),
  recordCount: z.number().int().nonnegative(),
  batchId: z.string(),
});
export const DemoDataStatusEnvelopeSchema = z.object({
  data: DemoDataStatusSchema,
  meta: RequestMetaSchema,
});
export const DemoDataClearPreviewSchema = DemoDataStatusSchema.extend({
  confirmation: z.object({ id: z.string(), token: z.string(), expiresAt: z.iso.datetime() }),
});
export const DemoDataClearPreviewEnvelopeSchema = z.object({
  data: DemoDataClearPreviewSchema,
  meta: RequestMetaSchema,
});
export const DemoDataClearRequestSchema = z.object({
  confirmationId: z.string(),
  confirmationToken: z.string(),
});

export const AttachmentSchema = z.object({
  id: z.string().length(26),
  originalName: z.string(),
  safeName: z.string(),
  mediaType: z.string(),
  extension: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  storageKey: z.string(),
  description: z.string().nullable(),
  status: z.enum(['UPLOADING', 'READY', 'MISSING', 'QUARANTINED']),
});
export const AttachmentEnvelopeSchema = z.object({
  data: AttachmentSchema,
  meta: RequestMetaSchema,
});

export type SetupStatus = z.infer<typeof SetupStatusSchema>;
export type InitializeRequest = z.infer<typeof InitializeRequestSchema>;
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;
export type CreateCategoryRequest = z.infer<typeof CreateCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof UpdateCategoryRequestSchema>;
export type ReorderCategoriesRequest = z.infer<typeof ReorderCategoriesRequestSchema>;
export type CreateTagRequest = z.infer<typeof CreateTagRequestSchema>;
export type UpdateTagRequest = z.infer<typeof UpdateTagRequestSchema>;
