import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  ArchiveCategoryRequestSchema,
  AttachmentEnvelopeSchema,
  BackupEnvelopeSchema,
  BackupRecordsEnvelopeSchema,
  BackupRestoreExecuteRequestSchema,
  DemoDataClearPreviewEnvelopeSchema,
  DemoDataClearRequestSchema,
  DemoDataStatusEnvelopeSchema,
  BackupRestorePreviewEnvelopeSchema,
  BackupRestorePreviewRequestSchema,
  CategoriesEnvelopeSchema,
  CategoryEnvelopeSchema,
  CreateCategoryRequestSchema,
  CreateTagRequestSchema,
  DataDirectoryMigrationExecuteRequestSchema,
  DataDirectoryMigrationPreviewEnvelopeSchema,
  DataDirectoryMigrationPreviewRequestSchema,
  DeleteTagPreviewEnvelopeSchema,
  DeleteTagPreviewRequestSchema,
  InitializeRequestSchema,
  ReorderCategoriesRequestSchema,
  SettingsEnvelopeSchema,
  SetupStatusEnvelopeSchema,
  TagEnvelopeSchema,
  TagsEnvelopeSchema,
  UpdateCategoryRequestSchema,
  UpdateSettingsRequestSchema,
  UpdateTagRequestSchema,
  DeleteTagRequestSchema,
} from '@life-assistant/contracts';

import type { LocalRuntime } from './runtime-probe.js';

const settingDefinitions = [
  {
    key: 'general.time_zone',
    label: '时区',
    type: 'SELECT',
    options: [{ value: 'Asia/Shanghai', label: '东八区' }],
    sensitive: false,
  },
  {
    key: 'general.week_starts_on',
    label: '每周起始日',
    type: 'NUMBER',
    minimum: 1,
    maximum: 7,
    sensitive: false,
  },
  {
    key: 'quick_capture.default_action',
    label: '快速记录默认动作',
    type: 'SELECT',
    options: [
      { value: 'INBOX', label: '收集箱' },
      { value: 'AI', label: '交给 AI' },
    ],
    sensitive: false,
  },
  {
    key: 'backup.frequency',
    label: '自动备份频率',
    type: 'SELECT',
    options: [
      { value: 'DAILY', label: '每天' },
      { value: 'WEEKLY', label: '每周' },
      { value: 'MANUAL', label: '仅手动' },
    ],
    sensitive: false,
  },
  {
    key: 'backup.retention_count',
    label: '备份保留份数',
    type: 'NUMBER',
    minimum: 1,
    maximum: 100,
    sensitive: false,
  },
  {
    key: 'backup.destination',
    label: '自动备份目标目录',
    type: 'TEXT',
    sensitive: false,
  },
  {
    key: 'reminders.default_offset_minutes',
    label: '默认提前提醒分钟',
    type: 'NUMBER',
    minimum: 0,
    maximum: 10080,
    sensitive: false,
  },
  {
    key: 'attachments.max_size_bytes',
    label: '单个附件大小上限',
    type: 'NUMBER',
    minimum: 1_048_576,
    maximum: 2_147_483_648,
    sensitive: false,
  },
] as const;

const validateSetting = (key: string, value: unknown): void => {
  const valid =
    (key === 'general.time_zone' && value === 'Asia/Shanghai') ||
    (key === 'general.week_starts_on' && (value === 1 || value === 7)) ||
    (key === 'quick_capture.default_action' && (value === 'INBOX' || value === 'AI')) ||
    (key === 'backup.frequency' && ['DAILY', 'WEEKLY', 'MANUAL'].includes(String(value))) ||
    (key === 'backup.retention_count' &&
      Number.isInteger(value) &&
      Number(value) >= 1 &&
      Number(value) <= 100) ||
    (key === 'backup.destination' &&
      (value === '' ||
        (typeof value === 'string' &&
          value.trim().length > 0 &&
          /^[a-zA-Z]:[\\/]|^\\\\/.test(value)))) ||
    (key === 'reminders.default_offset_minutes' &&
      Number.isInteger(value) &&
      Number(value) >= 0 &&
      Number(value) <= 10_080) ||
    (key === 'attachments.max_size_bytes' &&
      Number.isInteger(value) &&
      Number(value) >= 1_048_576 &&
      Number(value) <= 2_147_483_648);
  if (!valid) throw new Error('INVALID_SETTING');
};

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});

const requireShared = (runtime: LocalRuntime) => {
  if (runtime.shared === undefined) throw new Error('APP_NOT_INITIALIZED');
  return runtime.shared;
};

const categoryListEnvelope = (
  request: FastifyRequest,
  runtime: LocalRuntime,
  includeArchived: boolean,
) => {
  const shared = requireShared(runtime);
  return {
    data: shared.listCategories(includeArchived),
    meta: {
      requestId: request.id,
      orderVersions: {
        WORK: shared.getCategoryOrderVersion('WORK'),
        LIFE: shared.getCategoryOrderVersion('LIFE'),
      },
    },
  };
};

export const registerM1Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  app.get(
    '/api/v1/setup/status',
    { schema: { response: { 200: SetupStatusEnvelopeSchema } } },
    (request) =>
      envelope(request, {
        initialized: runtime.isDataDirectoryConfigured(),
        dataDirectory: runtime.getLayout()?.root ?? null,
        suggestedDataDirectory: runtime.suggestedDataDirectory,
      }),
  );

  app.post(
    '/api/v1/setup/initialize',
    { schema: { body: InitializeRequestSchema, response: { 200: SetupStatusEnvelopeSchema } } },
    async (request) => {
      const body = InitializeRequestSchema.parse(request.body);
      await runtime.initialize(body.dataDirectory, body);
      const layout = runtime.getLayout();
      if (layout === undefined) throw new Error('APP_NOT_INITIALIZED');
      for (const routineInput of body.routineTemplates ?? []) {
        const routine = runtime.routines
          ?.listTemplates()
          .find(
            (template) => template.templateType === routineInput.templateType && template.isDefault,
          );
        if (routine === undefined) throw new Error('DEFAULT_ROUTINE_NOT_FOUND');
        runtime.routines?.updateTemplate(routine.id, routine.version, {
          segments: routineInput.segments,
        });
      }
      if (body.aiProvider !== undefined) {
        if (runtime.ai === undefined) throw new Error('APP_NOT_INITIALIZED');
        const provider = runtime.ai.createProvider({
          providerType: body.aiProvider.providerType,
          displayName: body.aiProvider.displayName,
          modelId: body.aiProvider.modelId,
          ...(body.aiProvider.baseUrl === undefined ? {} : { baseUrl: body.aiProvider.baseUrl }),
        });
        await runtime.putAiCredential(provider.id, body.aiProvider.apiKey);
        runtime.ai.setDefault(provider.id, provider.version);
      }
      return envelope(request, {
        initialized: true,
        dataDirectory: layout.root,
        suggestedDataDirectory: runtime.suggestedDataDirectory,
      });
    },
  );
  app.get(
    '/api/v1/demo-data',
    { schema: { response: { 200: DemoDataStatusEnvelopeSchema } } },
    (request) => {
      if (runtime.demo === undefined) throw new Error('APP_NOT_INITIALIZED');
      return envelope(request, runtime.demo.status());
    },
  );
  app.post(
    '/api/v1/demo-data/clear-preview',
    { schema: { response: { 200: DemoDataClearPreviewEnvelopeSchema } } },
    (request) => {
      if (runtime.demo === undefined || runtime.consistency === undefined)
        throw new Error('APP_NOT_INITIALIZED');
      const preview = runtime.demo.status();
      const confirmation = runtime.consistency.createConfirmation('CLEAR_DEMO_DATA', {}, preview);
      return envelope(request, { ...preview, confirmation });
    },
  );
  app.post('/api/v1/demo-data/clear', (request) => {
    if (runtime.demo === undefined || runtime.consistency === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const body = DemoDataClearRequestSchema.parse(request.body);
    runtime.consistency.confirm(body.confirmationId, body.confirmationToken, 'CLEAR_DEMO_DATA', {});
    const result = runtime.demo.clear();
    runtime.consistency.markConfirmationExecuted(body.confirmationId);
    return envelope(request, result);
  });
  app.get(
    '/api/v1/backups',
    { schema: { response: { 200: BackupRecordsEnvelopeSchema } } },
    (request) => {
      if (runtime.backups === undefined) throw new Error('APP_NOT_INITIALIZED');
      return envelope(request, runtime.backups.list());
    },
  );
  app.post(
    '/api/v1/backups/restore-preview',
    {
      schema: {
        body: BackupRestorePreviewRequestSchema,
        response: { 200: BackupRestorePreviewEnvelopeSchema },
      },
    },
    async (request) => {
      if (runtime.consistency === undefined) throw new Error('APP_NOT_INITIALIZED');
      const body = BackupRestorePreviewRequestSchema.parse(request.body);
      const preview = await runtime.previewBackupRestore(body.path);
      const confirmation = runtime.consistency.createConfirmation('BACKUP_RESTORE', body, preview);
      return envelope(request, { ...preview, confirmation });
    },
  );
  app.post(
    '/api/v1/backups/restore',
    {
      schema: {
        body: BackupRestoreExecuteRequestSchema,
        response: { 200: SetupStatusEnvelopeSchema },
      },
    },
    async (request) => {
      if (runtime.consistency === undefined) throw new Error('APP_NOT_INITIALIZED');
      const body = BackupRestoreExecuteRequestSchema.parse(request.body);
      runtime.consistency.confirm(body.confirmationId, body.confirmationToken, 'BACKUP_RESTORE', {
        path: body.path,
      });
      await runtime.restoreBackup(body.path);
      const consistency = runtime.consistency;
      const layout = runtime.getLayout();
      if (layout === undefined) throw new Error('APP_NOT_INITIALIZED');
      consistency.markConfirmationExecuted(body.confirmationId);
      return envelope(request, {
        initialized: true,
        dataDirectory: layout.root,
        suggestedDataDirectory: runtime.suggestedDataDirectory,
      });
    },
  );
  app.post(
    '/api/v1/settings/data-directory/migration-preview',
    {
      schema: {
        body: DataDirectoryMigrationPreviewRequestSchema,
        response: { 200: DataDirectoryMigrationPreviewEnvelopeSchema },
      },
    },
    async (request) => {
      if (runtime.consistency === undefined) throw new Error('APP_NOT_INITIALIZED');
      const body = DataDirectoryMigrationPreviewRequestSchema.parse(request.body);
      const preview = await runtime.previewDataDirectoryMigration(body.dataDirectory);
      const confirmation = runtime.consistency.createConfirmation(
        'DATA_DIRECTORY_MIGRATION',
        body,
        preview,
      );
      return envelope(request, { ...preview, confirmation });
    },
  );
  app.post(
    '/api/v1/settings/data-directory/migrate',
    {
      schema: {
        body: DataDirectoryMigrationExecuteRequestSchema,
        response: { 200: SetupStatusEnvelopeSchema },
      },
    },
    async (request) => {
      if (runtime.consistency === undefined) throw new Error('APP_NOT_INITIALIZED');
      const body = DataDirectoryMigrationExecuteRequestSchema.parse(request.body);
      runtime.consistency.confirm(
        body.confirmationId,
        body.confirmationToken,
        'DATA_DIRECTORY_MIGRATION',
        { dataDirectory: body.dataDirectory },
      );
      await runtime.migrateDataDirectory(body.dataDirectory);
      const consistency = runtime.consistency;
      const layout = runtime.getLayout();
      if (layout === undefined) throw new Error('APP_NOT_INITIALIZED');
      consistency.markConfirmationExecuted(body.confirmationId);
      return envelope(request, {
        initialized: true,
        dataDirectory: layout.root,
        suggestedDataDirectory: runtime.suggestedDataDirectory,
      });
    },
  );
  app.patch(
    '/api/v1/tags/:id',
    { schema: { body: UpdateTagRequestSchema, response: { 200: TagEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      const { expectedVersion, ...patch } = UpdateTagRequestSchema.parse(request.body);
      return envelope(request, requireShared(runtime).updateTag(id, expectedVersion, patch));
    },
  );
  app.post(
    '/api/v1/tags/:id/delete-preview',
    {
      schema: {
        body: DeleteTagPreviewRequestSchema,
        response: { 200: DeleteTagPreviewEnvelopeSchema },
      },
    },
    (request) => {
      if (runtime.consistency === undefined) throw new Error('APP_NOT_INITIALIZED');
      const { id } = request.params as { id: string };
      const body = DeleteTagPreviewRequestSchema.parse(request.body);
      const tag = requireShared(runtime)
        .listTags()
        .find((item) => item.id === id);
      if (tag === undefined) throw new Error('标签不存在。');
      if (tag.version !== body.expectedVersion) throw new Error('VERSION_CONFLICT');
      const summary = `标签“${tag.name}”将进入回收站，并在 30 天后彻底删除。`;
      const confirmation = runtime.consistency.createConfirmation(
        'TAG_DELETE',
        { id, expectedVersion: body.expectedVersion },
        { summary, tagId: id },
      );
      return envelope(request, { summary, tagId: id, confirmation });
    },
  );
  app.delete('/api/v1/tags/:id', { schema: { body: DeleteTagRequestSchema } }, (request, reply) => {
    if (runtime.consistency === undefined) throw new Error('APP_NOT_INITIALIZED');
    const { id } = request.params as { id: string };
    const body = DeleteTagRequestSchema.parse(request.body);
    runtime.consistency.confirm(body.confirmationId, body.confirmationToken, 'TAG_DELETE', {
      id,
      expectedVersion: body.expectedVersion,
    });
    requireShared(runtime).softDeleteTag(id, body.expectedVersion);
    runtime.consistency.markConfirmationExecuted(body.confirmationId);
    return reply.code(204).send();
  });

  app.get('/api/v1/settings/schema', (request) => envelope(request, settingDefinitions));
  app.get(
    '/api/v1/settings',
    { schema: { response: { 200: SettingsEnvelopeSchema } } },
    (request) => envelope(request, requireShared(runtime).listSettings()),
  );
  app.patch(
    '/api/v1/settings',
    { schema: { body: UpdateSettingsRequestSchema, response: { 200: SettingsEnvelopeSchema } } },
    (request) => {
      const body = UpdateSettingsRequestSchema.parse(request.body);
      const shared = requireShared(runtime);
      const database = runtime.database;
      if (database === undefined) throw new Error('APP_NOT_INITIALIZED');
      database.transaction(() => {
        for (const [key, value] of Object.entries(body.values)) {
          validateSetting(key, value);
          shared.setSetting(key, value);
        }
      });
      return envelope(request, shared.listSettings());
    },
  );

  app.get(
    '/api/v1/categories',
    { schema: { response: { 200: CategoriesEnvelopeSchema } } },
    (request) => {
      const query = request.query as { includeArchived?: string };
      return categoryListEnvelope(request, runtime, query.includeArchived === 'true');
    },
  );
  app.post(
    '/api/v1/categories',
    { schema: { body: CreateCategoryRequestSchema, response: { 201: CategoryEnvelopeSchema } } },
    (request, reply) => {
      const body = CreateCategoryRequestSchema.parse(request.body);
      const category = requireShared(runtime).createCategory(body);
      return reply.code(201).send(envelope(request, category));
    },
  );
  app.patch(
    '/api/v1/categories/:id',
    { schema: { body: UpdateCategoryRequestSchema, response: { 200: CategoryEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      const { expectedVersion, ...patch } = UpdateCategoryRequestSchema.parse(request.body);
      return envelope(request, requireShared(runtime).updateCategory(id, expectedVersion, patch));
    },
  );
  app.post(
    '/api/v1/categories:reorder',
    {
      schema: { body: ReorderCategoriesRequestSchema, response: { 200: CategoriesEnvelopeSchema } },
    },
    (request) => {
      const body = ReorderCategoriesRequestSchema.parse(request.body);
      requireShared(runtime).reorderCategories(
        body.parentArea,
        body.ids,
        body.expectedOrderVersion,
      );
      return categoryListEnvelope(request, runtime, true);
    },
  );
  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ] as const) {
    app.post(
      `/api/v1/categories/:id/${action}`,
      { schema: { body: ArchiveCategoryRequestSchema, response: { 200: CategoryEnvelopeSchema } } },
      (request) => {
        const { id } = request.params as { id: string };
        const body = ArchiveCategoryRequestSchema.parse(request.body);
        return envelope(
          request,
          requireShared(runtime).setCategoryArchived(id, archived, body.expectedVersion),
        );
      },
    );
  }

  app.get('/api/v1/tags', { schema: { response: { 200: TagsEnvelopeSchema } } }, (request) =>
    envelope(request, requireShared(runtime).listTags()),
  );
  app.post(
    '/api/v1/tags',
    { schema: { body: CreateTagRequestSchema, response: { 201: TagEnvelopeSchema } } },
    (request, reply) => {
      const tag = requireShared(runtime).createTag(CreateTagRequestSchema.parse(request.body));
      return reply.code(201).send(envelope(request, tag));
    },
  );

  app.post(
    '/api/v1/backups',
    { schema: { response: { 201: BackupEnvelopeSchema } } },
    async (request, reply) => {
      if (runtime.backups === undefined || runtime.metadata === undefined)
        throw new Error('APP_NOT_INITIALIZED');
      const destination = runtime.backupDestination();
      const backup = await runtime.backups.createManualBackup(
        runtime.metadata.installationId,
        destination,
      );
      return reply.code(201).send(envelope(request, backup));
    },
  );

  app.post('/api/v1/attachments', async (request, reply) => {
    if (runtime.attachments === undefined || runtime.shared === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const file = await request.file();
    if (file === undefined) throw new Error('附件上传请求缺少文件。');
    const maxSizeSetting = runtime.shared
      .listSettings()
      .find((setting) => setting.key === 'attachments.max_size_bytes');
    const maxSizeBytes =
      typeof maxSizeSetting?.value === 'number' ? maxSizeSetting.value : 2_147_483_648;
    const attachment = await runtime.attachments.store({
      stream: file.file,
      originalName: file.filename,
      mediaType: file.mimetype,
      maxSizeBytes,
    });
    return reply.code(201).send(envelope(request, attachment));
  });
  app.get(
    '/api/v1/attachments/:id',
    { schema: { response: { 200: AttachmentEnvelopeSchema } } },
    (request) => {
      if (runtime.attachmentRepository === undefined) throw new Error('APP_NOT_INITIALIZED');
      const { id } = request.params as { id: string };
      return envelope(request, runtime.attachmentRepository.get(id));
    },
  );
  app.get('/api/v1/attachments/:id/content', (request, reply) => {
    if (runtime.attachmentRepository === undefined || runtime.attachments === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const { id } = request.params as { id: string };
    const attachment = runtime.attachmentRepository.get(id);
    reply.header('content-type', attachment.mediaType);
    reply.header(
      'content-disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.safeName)}`,
    );
    return reply.send(runtime.attachments.open(attachment));
  });
};
