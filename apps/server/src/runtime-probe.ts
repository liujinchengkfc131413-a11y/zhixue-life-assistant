import { randomUUID } from 'node:crypto';
import { existsSync, statfsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Writable } from 'node:stream';

import AdmZip from 'adm-zip';
import type {
  BackgroundJobSummary,
  DiagnosticInfo,
  DiskSpaceSummary,
} from '@life-assistant/contracts';
import { ListNotifications, type RuntimeProbe } from '@life-assistant/application';
import {
  ActionRepository,
  AiActionRepository,
  AiMemoryRepository,
  AiRepository,
  ChatRepository,
  AttachmentRepository,
  BootstrapStore,
  DataDirectoryManager,
  DemoDataRepository,
  DraftRepository,
  ConsistencyRepository,
  JobRepository,
  InboxRepository,
  InformationRepository,
  LifeRepository,
  NotificationRepository,
  ReminderRepository,
  RoutineRepository,
  SharedRepository,
  SqliteDatabase,
  migrations,
  type AiProviderConfigRecord,
  type DataDirectoryLayout,
  type DataDirectoryMetadata,
  type NotificationRecord,
  WorkRepository,
} from '@life-assistant/database';
import {
  AttachmentGarbageCollector,
  BackupService,
  ManagedFileStorage,
} from '@life-assistant/file-storage';
import { SystemClock, type Clock } from '@life-assistant/kernel';
import {
  HttpHolidayProvider,
  JobRunner,
  RecurrenceService,
  ReminderDeliveryService,
  ScheduleService,
  TodayService,
} from '@life-assistant/scheduler';
import {
  InMemoryCredentialStore,
  OpenAiCompatibleProvider,
  OpenAiProvider,
  type CredentialStore,
  type ModelProvider,
  type ToolCallingProvider,
} from '@life-assistant/ai-adapters';

import { WindowsCredentialStore } from './windows-credential-store.js';
import { ChatRunner } from './chat-runner.js';
import { AiWriteExecutor } from './ai-write-executor.js';
import { LogManager, type LogLevel } from './log-manager.js';
import {
  registerDomainWriteTools,
  registerHighRiskActionTools,
  registerOperationalWriteTools,
  type DomainWriteAdapter,
} from './domain-write-tools.js';
import {
  registerNotificationTools,
  registerAiProcessInboxTool,
  registerRememberMemoryTool,
  registerLowImpactWriteTools,
  registerHighRiskConfirmationTools,
  registerReadOnlyTools,
  registerRecordLookupTools,
  registerStatisticsTool,
  ToolRegistry,
} from './tool-registry.js';

const latestSchemaVersion = migrations.at(-1)?.version ?? 0;

export interface LocalRuntimeOptions {
  readonly appVersion?: string;
  readonly bootstrapPath?: string;
  readonly clock?: Clock;
  readonly suggestedDataDirectory?: string;
  readonly credentialStore?: CredentialStore;
  readonly openAiProvider?: ModelProvider;
  readonly openAiCompatibleProvider?: ModelProvider;
  readonly enableReadOnlyTools?: boolean;
  readonly holidayProvider?: HttpHolidayProvider;
}

export class BootstrapRuntimeProbe implements RuntimeProbe {
  public isDatabaseConnected(): boolean {
    return false;
  }
  public isDataDirectoryConfigured(): boolean {
    return false;
  }
  public isAiConfigured(): boolean {
    return false;
  }
  public isSchedulerAvailable(): boolean {
    return false;
  }
  public getBackgroundJobSummary(): BackgroundJobSummary {
    return { pending: 0, running: 0, failed: 0 };
  }
  public getDiskSpace(): DiskSpaceSummary {
    return { freeBytes: 0, totalBytes: 0 };
  }
}

export class LocalRuntime implements RuntimeProbe {
  public readonly appVersion: string;
  public readonly clock: Clock;
  public readonly dataDirectories: DataDirectoryManager;
  public readonly suggestedDataDirectory: string;
  public readonly credentials: CredentialStore;
  public readonly openAiProvider: ModelProvider;
  public readonly openAiCompatibleProvider: ModelProvider;
  public database: SqliteDatabase | undefined;
  public shared: SharedRepository | undefined;
  public attachments: ManagedFileStorage | undefined;
  public attachmentRepository: AttachmentRepository | undefined;
  public consistency: ConsistencyRepository | undefined;
  public backups: BackupService | undefined;
  public actions: ActionRepository | undefined;
  public ai: AiRepository | undefined;
  public aiActions: AiActionRepository | undefined;
  public aiMemories: AiMemoryRepository | undefined;
  public chats: ChatRepository | undefined;
  public chatRunner: ChatRunner | undefined;
  public notifications: NotificationRepository | undefined;
  public notificationService: ListNotifications<NotificationRecord> | undefined;
  public reminders: ReminderRepository | undefined;
  public reminderDelivery: ReminderDeliveryService | undefined;
  public tools: ToolRegistry | undefined;
  public routines: RoutineRepository | undefined;
  public schedules: ScheduleService | undefined;
  public recurrences: RecurrenceService | undefined;
  public today: TodayService | undefined;
  public holidayProvider: HttpHolidayProvider | undefined;
  public work: WorkRepository | undefined;
  public life: LifeRepository | undefined;
  public inbox: InboxRepository | undefined;
  public drafts: DraftRepository | undefined;
  public information: InformationRepository | undefined;
  public demo: DemoDataRepository | undefined;
  public metadata: DataDirectoryMetadata | undefined;
  public logs: LogManager | undefined;
  private readonly aiCredentialAvailability = new Map<string, boolean>();
  private readonly enableReadOnlyTools: boolean;
  private startedAt = 0;
  private jobRunner: JobRunner | undefined;
  private domainWrites: DomainWriteAdapter | undefined;
  private jobs: JobRepository | undefined;
  private layout: DataDirectoryLayout | undefined;

  public constructor(options: LocalRuntimeOptions = {}) {
    this.appVersion = options.appVersion ?? '0.1.0';
    this.clock = options.clock ?? new SystemClock();
    const bootstrapPath =
      options.bootstrapPath ??
      process.env.LIFE_ASSISTANT_BOOTSTRAP_PATH ??
      join(process.env.LOCALAPPDATA ?? homedir(), 'LifeAssistant', 'bootstrap.json');
    this.suggestedDataDirectory =
      options.suggestedDataDirectory ?? join(homedir(), 'Documents', 'LifeAssistantData');
    this.credentials =
      options.credentialStore ??
      (process.platform === 'win32' ? new WindowsCredentialStore() : new InMemoryCredentialStore());
    this.openAiProvider = options.openAiProvider ?? new OpenAiProvider();
    this.openAiCompatibleProvider =
      options.openAiCompatibleProvider ?? new OpenAiCompatibleProvider();
    this.holidayProvider =
      options.holidayProvider ??
      new HttpHolidayProvider(process.env.LIFE_ASSISTANT_HOLIDAY_FEED_URL ?? '', () =>
        Promise.reject(new Error('HOLIDAY_FEED_NOT_CONFIGURED')),
      );
    this.enableReadOnlyTools = options.enableReadOnlyTools ?? true;
    this.dataDirectories = new DataDirectoryManager(
      new BootstrapStore(bootstrapPath),
      this.appVersion,
    );
  }

  public async start(): Promise<void> {
    const layout = await this.dataDirectories.current();
    if (layout !== undefined) await this.open(layout);
  }

  public async initialize(
    path: string,
    options: {
      includeDemoData: boolean;
      backupFrequency: 'DAILY' | 'WEEKLY' | 'MANUAL';
      backupRetentionCount: number;
      quickCaptureDefaultAction: 'INBOX' | 'AI';
    },
  ): Promise<void> {
    const layout = await this.dataDirectories.initialize(path);
    this.closeDataServices();
    await this.open(layout);
    this.shared?.setSetting('backup.frequency', options.backupFrequency);
    this.shared?.setSetting('backup.retention_count', options.backupRetentionCount);
    this.shared?.setSetting('quick_capture.default_action', options.quickCaptureDefaultAction);
    if (options.includeDemoData) this.demo?.seed();
  }

  public async previewDataDirectoryMigration(path: string): Promise<{
    source: string;
    destination: string;
    fileCount: number;
    totalBytes: number;
  }> {
    if (this.layout === undefined) throw new Error('APP_NOT_INITIALIZED');
    const destination = resolve(path);
    this.assertSeparateDirectories(this.layout.root, destination);
    const files = await this.listFiles(this.layout.root);
    const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
    return {
      source: this.layout.root,
      destination,
      fileCount: files.length,
      totalBytes: sizes.reduce((total, value) => total + value, 0),
    };
  }

  public async migrateDataDirectory(path: string): Promise<void> {
    if (this.layout === undefined) throw new Error('APP_NOT_INITIALIZED');
    const source = this.layout;
    const destination = resolve(path);
    this.assertSeparateDirectories(source.root, destination);
    await mkdir(dirname(destination), { recursive: true });
    const stagingParent = await mkdtemp(join(dirname(destination), '.life-assistant-migration-'));
    const staging = join(stagingParent, 'data');
    let switched = false;
    try {
      try {
        const entries = await readdir(destination);
        if (entries.length > 0) throw new Error('目标数据目录必须为空。');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }

      this.closeDataServices();
      await cp(source.root, staging, { recursive: true, errorOnExist: true, force: false });
      const stagedLayout = await this.dataDirectories.validate(staging);
      const verification = new SqliteDatabase(stagedLayout.database, this.clock);
      try {
        if (verification.quickCheck()[0] !== 'ok' || verification.foreignKeyCheck().length > 0) {
          throw new Error('迁移后的数据库完整性检查失败。');
        }
      } finally {
        verification.close();
      }
      await rm(destination, { recursive: false, force: true });
      await rename(staging, destination);
      switched = true;
      await rm(stagingParent, { recursive: true, force: true });
      const targetLayout = await this.dataDirectories.activate(destination);
      await this.open(targetLayout);
    } catch (error) {
      await this.dataDirectories.activate(source.root);
      if (!this.isDatabaseConnected()) await this.open(source);
      if (!switched) await rm(stagingParent, { recursive: true, force: true });
      throw error;
    }
  }

  public async previewBackupRestore(path: string): Promise<{
    path: string;
    appVersion: string;
    schemaVersion: number;
    generatedAt: string;
    fileCount: number;
  }> {
    if (this.backups === undefined) throw new Error('APP_NOT_INITIALIZED');
    const manifest = await this.backups.verify(resolve(path));
    if (manifest.schemaVersion > latestSchemaVersion) throw new Error('BACKUP_SCHEMA_TOO_NEW');
    return {
      path: resolve(path),
      appVersion: manifest.appVersion,
      schemaVersion: manifest.schemaVersion,
      generatedAt: manifest.generatedAt,
      fileCount: manifest.fileCount,
    };
  }

  public async restoreBackup(path: string): Promise<void> {
    if (this.layout === undefined || this.backups === undefined || this.metadata === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const layout = this.layout;
    const backupService = this.backups;
    const metadata = this.metadata;
    const staging = await mkdtemp(join(layout.cache, 'restore-'));
    const rollback = await mkdtemp(join(layout.cache, 'rollback-'));
    let databaseMoved = false;
    let attachmentsMoved = false;
    try {
      const manifest = await backupService.extractVerified(resolve(path), staging);
      if (manifest.schemaVersion > latestSchemaVersion) throw new Error('BACKUP_SCHEMA_TOO_NEW');
      const stagedDatabase = join(staging, 'database', 'life-assistant.db');
      const verification = new SqliteDatabase(stagedDatabase, this.clock);
      try {
        if (verification.quickCheck()[0] !== 'ok' || verification.foreignKeyCheck().length > 0)
          throw new Error('BACKUP_DATABASE_INVALID');
      } finally {
        verification.close();
      }
      await mkdir(join(staging, 'attachments'), { recursive: true });
      await backupService.createPreRestoreBackup(metadata.installationId);
      this.closeDataServices();
      await rename(dirname(layout.database), join(rollback, 'database'));
      databaseMoved = true;
      await rename(layout.attachments, join(rollback, 'attachments'));
      attachmentsMoved = true;
      await rename(join(staging, 'database'), dirname(layout.database));
      await rename(join(staging, 'attachments'), layout.attachments);
      await this.open(layout, { invalidateRestoredAiCredentials: true });
      await rm(rollback, { recursive: true, force: true });
    } catch (error) {
      if (databaseMoved || attachmentsMoved) {
        this.closeDataServices();
        if (databaseMoved) {
          await rm(dirname(layout.database), { recursive: true, force: true });
          await rename(join(rollback, 'database'), dirname(layout.database));
        }
        if (attachmentsMoved) {
          await rm(layout.attachments, { recursive: true, force: true });
          await rename(join(rollback, 'attachments'), layout.attachments);
        }
      }
      if (!this.isDatabaseConnected()) await this.open(layout);
      throw error;
    } finally {
      await rm(staging, { recursive: true, force: true });
      await rm(rollback, { recursive: true, force: true });
    }
  }

  /** 写入一条带类别的本地日志；未初始化数据目录时静默丢弃。 */
  public log(category: string, level: LogLevel, message: string, fields: object = {}): void {
    this.logs?.write(category, level, message, fields);
  }

  /** 供 Fastify logger 使用的脱敏写入流；未初始化数据目录时返回 undefined。 */
  public getLogStream(): Writable | undefined {
    return this.logs?.createStream();
  }

  /** 返回脱敏诊断信息：不含个人内容与密钥，日志仅包含脱敏尾部。 */
  public getDiagnostics(): DiagnosticInfo {
    if (this.layout === undefined || this.database === undefined || this.metadata === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const versionRow = this.database.raw
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get() as { version: number };
    return {
      appVersion: this.appVersion,
      schemaVersion: versionRow.version,
      dataDirectoryId: this.metadata.dataDirectoryId,
      generatedAt: this.clock.now().toISOString(),
      uptimeSeconds: Math.max(0, Math.floor((this.clock.now().getTime() - this.startedAt) / 1000)),
      backgroundJobs: this.getBackgroundJobSummary(),
      disk: this.getDiskSpace(),
      logs: this.logs?.listFiles() ?? [],
      logTail: this.logs?.tail() ?? '',
    };
  }

  /** 导出诊断包：脱敏后的诊断信息与日志打包为 ZIP，存放在数据目录缓存。 */
  public async exportDiagnostics(): Promise<{ path: string }> {
    if (this.layout === undefined || this.logs === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const info = this.getDiagnostics();
    const zipPath = join(
      this.layout.cache,
      `diagnostics-${String(this.clock.now().getTime())}.zip`,
    );
    const zip = new AdmZip();
    zip.addFile('diagnostics.json', Buffer.from(`${JSON.stringify(info, null, 2)}\n`, 'utf8'));
    for (const file of info.logs) {
      zip.addFile(`logs/${file.name}`, Buffer.from(this.logs.readLogFile(file.name), 'utf8'));
    }
    await zip.writeZipPromise(zipPath);
    this.log('diagnostics', 'info', '诊断包已导出', { path: zipPath });
    return { path: zipPath };
  }

  public close(): void {
    this.closeDataServices();
  }

  public getLayout(): DataDirectoryLayout | undefined {
    return this.layout;
  }

  public isDatabaseConnected(): boolean {
    return this.database?.raw.open ?? false;
  }

  public isDataDirectoryConfigured(): boolean {
    return this.layout !== undefined;
  }

  public isAiConfigured(): boolean {
    return (this.ai?.listProviders() ?? []).some((provider) => this.hasAiCredential(provider.id));
  }

  public async putAiCredential(providerId: string, secret: string): Promise<void> {
    const provider = this.ai?.getProvider(providerId);
    if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    await this.credentials.set(provider.credentialRef, secret);
    this.aiCredentialAvailability.set(providerId, true);
  }

  public async removeAiCredential(providerId: string): Promise<void> {
    const provider = this.ai?.getProvider(providerId);
    if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    await this.credentials.remove(provider.credentialRef);
    this.aiCredentialAvailability.set(providerId, false);
  }

  public getAiAction(id: string) {
    if (this.aiActions === undefined) throw new Error('APP_NOT_INITIALIZED');
    return this.aiActions.get(id);
  }

  public confirmAiAction(id: string) {
    if (
      this.aiActions === undefined ||
      this.consistency === undefined ||
      this.actions === undefined ||
      this.chats === undefined
    )
      throw new Error('APP_NOT_INITIALIZED');
    this.aiActions.expireDue();
    const action = this.aiActions.get(id);
    if (action.status === 'EXECUTED') return { action, result: action.result };
    if (action.status === 'EXPIRED' || action.status === 'CANCELLED')
      throw new Error('AI_ACTION_NOT_CONFIRMABLE');
    if (action.status === 'FAILED')
      throw new Error(action.errorCode ?? 'AI_ACTION_EXECUTION_FAILED');
    if (action.status === 'EXECUTING') throw new Error('AI_ACTION_EXECUTION_IN_PROGRESS');
    const request = action.request as {
      goalId: string;
      expectedVersion: number;
      title: string;
      description?: string | null;
      startDate?: string;
      endDate?: string | null;
      status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
    };
    const executionContext = action.executionContext;
    if (executionContext === null) {
      try {
        if (action.status === 'AWAITING_CONFIRMATION') {
          this.consistency.confirmTrusted(action.confirmationId, action.actionType, request);
          this.aiActions.markConfirmed(id);
        }
        this.aiActions.markExecuting(id);
        const result = this.actions.updateGoal(request.goalId, request.expectedVersion, {
          title: request.title,
          ...(request.description === undefined
            ? {}
            : { description: request.description ?? undefined }),
          ...(request.startDate === undefined ? {} : { startDate: request.startDate }),
          ...(request.endDate === undefined ? {} : { endDate: request.endDate }),
          ...(request.status === undefined ? {} : { status: request.status }),
        });
        this.consistency.markConfirmationExecuted(action.confirmationId);
        return { action: this.aiActions.markExecuted(id, result), result };
      } catch (error) {
        const current = this.aiActions.get(id);
        if (current.status === 'EXECUTING')
          this.aiActions.markFailed(
            id,
            error instanceof Error ? error.message : 'AI_ACTION_EXECUTION_FAILED',
          );
        throw error;
      }
    }
    const consistency = this.consistency;
    const actions = this.actions;
    const aiActions = this.aiActions;
    const chats = this.chats;
    try {
      if (action.status === 'AWAITING_CONFIRMATION') {
        consistency.confirmTrusted(action.confirmationId, action.actionType, request);
        aiActions.markConfirmed(id);
      }
      aiActions.markExecuting(id);
      const applied = new AiWriteExecutor(consistency).execute({
        execution: { ...executionContext, aiActionId: id },
        summary: action.actionType,
        riskLevel: 'HIGH_WRITE',
        mutate: (context) => {
          if (action.actionType === 'REPLACE_LONG_TERM_GOAL')
            return actions.updateGoal(
              request.goalId,
              request.expectedVersion,
              {
                title: request.title,
                ...(request.description === undefined
                  ? {}
                  : { description: request.description ?? undefined }),
                ...(request.startDate === undefined ? {} : { startDate: request.startDate }),
                ...(request.endDate === undefined ? {} : { endDate: request.endDate }),
                ...(request.status === undefined ? {} : { status: request.status }),
              },
              context,
            );
          if (action.actionType === 'DELETE_RECORD') {
            const deletion = action.request as {
              recordType: string;
              entityId: string;
              expectedVersion: number;
            };
            if (['GOAL', 'PLAN', 'TASK', 'EVENT'].includes(deletion.recordType))
              actions.softDelete(deletion.entityId, deletion.expectedVersion, context);
            else if (
              ['SELF_MEDIA_CONTENT', 'DEV_PROJECT', 'LEARNING_RESOURCE'].includes(
                deletion.recordType,
              )
            )
              this.work?.softDelete(deletion.entityId, deletion.expectedVersion, context);
            else this.life?.softDelete(deletion.entityId, deletion.expectedVersion, context);
            return { entityId: deletion.entityId, deleted: true };
          }
          if (action.actionType === 'BULK_UPDATE_RECORDS') {
            const bulk = action.request as {
              operations: {
                recordType: Parameters<DomainWriteAdapter['update']>[0];
                entityId: string;
                expectedVersion: number;
                patch: unknown;
              }[];
            };
            const domainWrites = this.domainWrites;
            if (domainWrites === undefined) throw new Error('APP_NOT_INITIALIZED');
            return bulk.operations.map((operation) =>
              domainWrites.update(
                operation.recordType,
                operation.entityId,
                operation.expectedVersion,
                operation.patch,
                context,
              ),
            );
          }
          if (action.actionType === 'CLEAR_AI_MEMORY')
            return { cleared: this.aiMemories?.clearAll(context) ?? 0 };
          if (action.actionType === 'EMPTY_RECYCLE_BIN') {
            if (this.information === undefined) throw new Error('APP_NOT_INITIALIZED');
            return this.information.emptyRecycleBin(context);
          }
          throw new Error('AI_ACTION_TYPE_UNSUPPORTED');
        },
      });
      consistency.markConfirmationExecuted(action.confirmationId);
      chats.attachToolCallChangeSet(executionContext.toolCallId, applied.changeSetId, applied);
      return { action: aiActions.markExecuted(id, applied.result), result: applied.result };
    } catch (error) {
      const current = aiActions.get(id);
      if (current.status === 'EXECUTING')
        aiActions.markFailed(
          id,
          error instanceof Error ? error.message : 'AI_ACTION_EXECUTION_FAILED',
        );
      throw error;
    }
  }

  public cancelAiAction(id: string) {
    if (this.aiActions === undefined) throw new Error('APP_NOT_INITIALIZED');
    return this.aiActions.cancel(id);
  }

  public previewClearAiMemories(): { confirmationId: string; count: number; expiresAt: string } {
    if (this.consistency === undefined || this.aiMemories === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const count = this.aiMemories.listActive().length;
    const confirmation = this.consistency.createConfirmation(
      'CLEAR_AI_MEMORY',
      { count },
      { count, summary: '将清空全部 AI 长期记忆。' },
    );
    return { confirmationId: confirmation.id, count, expiresAt: confirmation.expiresAt };
  }

  public confirmClearAiMemories(confirmationId: string, count: number): { cleared: number } {
    if (this.consistency === undefined || this.aiMemories === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    this.consistency.confirmTrusted(confirmationId, 'CLEAR_AI_MEMORY', { count });
    const cleared = this.aiMemories.clearAll();
    this.consistency.markConfirmationExecuted(confirmationId);
    return { cleared };
  }

  /** Persists an AI analysis result as a suggestion only; it never invokes domain writes. */
  public recordAiSuggestion(input: {
    title: string;
    body: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    targetEntityId?: string | null;
  }) {
    if (this.notifications === undefined) throw new Error('APP_NOT_INITIALIZED');
    return this.notifications.record({
      notificationType: 'AI_SUGGESTION',
      targetEntityId: input.targetEntityId ?? null,
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'INFO',
      scheduledAt: this.clock.now().toISOString(),
    });
  }

  public analyzeAndSuggest(): { created: number } {
    if (this.actions === undefined || this.database === undefined)
      throw new Error('APP_NOT_INITIALIZED');
    const database = this.database.raw;
    const now = this.clock.now().getTime();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const from = dayStart.getTime();
    const to = from + 86_400_000;
    const ids = (sql: string, ...params: unknown[]): string[] =>
      (database.prepare(sql).all(...params) as { id: string }[]).map((row) => row.id);
    const findings: {
      type: string;
      message: string;
      evidenceIds: string[];
      severity: 'INFO' | 'WARNING' | 'CRITICAL';
    }[] = [];
    const add = (
      type: string,
      message: string,
      evidenceIds: string[],
      severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'WARNING',
    ) => {
      if (evidenceIds.length > 0) findings.push({ type, message, evidenceIds, severity });
    };

    const overdue = this.actions
      .listTasks({ includeCompleted: true })
      .filter((task) => task.status !== 'COMPLETED' && Date.parse(task.dueAt) < now);
    add(
      'OVERDUE',
      `当前有 ${String(overdue.length)} 个未完成事项已过截止时间。`,
      overdue.map((task) => task.id),
    );
    const nearDeadline = ids(
      `SELECT task.id FROM tasks task JOIN entity_index entity ON entity.id=task.id AND entity.deleted_at IS NULL
       WHERE task.status IN ('TODO','IN_PROGRESS') AND task.due_at>=? AND task.due_at<=?`,
      now,
      now + 48 * 3_600_000,
    );
    add('NEAR_DEADLINE', '发现 48 小时内临近截止的事项，建议确认优先级。', nearDeadline);
    const todayBlocks = ids(
      `SELECT block.id FROM schedule_blocks block JOIN entity_index entity ON entity.id=block.id AND entity.deleted_at IS NULL
       WHERE block.start_at<? AND block.end_at>?`,
      to,
      from,
    );
    const scheduledMinutes = database
      .prepare(
        `SELECT COALESCE(SUM((MIN(end_at,?)-MAX(start_at,?))/60000),0) total
         FROM schedule_blocks WHERE start_at<? AND end_at>?`,
      )
      .get(to, from, to, from) as { total: number };
    if (scheduledMinutes.total >= 600)
      add(
        'TODAY_OVERLOAD',
        `今日已安排约 ${String(Math.round(scheduledMinutes.total))} 分钟，空闲缓冲不足。`,
        todayBlocks,
        'CRITICAL',
      );
    const continuous = ids(
      `SELECT block.id FROM schedule_blocks block JOIN entity_index entity ON entity.id=block.id AND entity.deleted_at IS NULL
       WHERE block.end_at-block.start_at>=? AND block.start_at<? AND block.end_at>?`,
      180 * 60_000,
      to,
      from,
    );
    add('CONTINUOUS_WORK', '发现连续工作超过 3 小时的时间块，建议加入休息。', continuous);
    const blocked = ids(
      `SELECT successor.id FROM task_dependencies dependency
       JOIN tasks predecessor ON predecessor.id=dependency.predecessor_task_id
       JOIN tasks successor ON successor.id=dependency.successor_task_id
       JOIN entity_index entity ON entity.id=successor.id AND entity.deleted_at IS NULL
       WHERE predecessor.status NOT IN ('COMPLETED','CANCELLED') AND successor.status IN ('TODO','IN_PROGRESS')`,
    );
    add('DEPENDENCY_BLOCKED', '发现仍被前置任务阻塞的事项。', blocked);
    const staleGoals = ids(
      `SELECT goal.id FROM goals goal JOIN entity_index entity ON entity.id=goal.id AND entity.deleted_at IS NULL
       WHERE goal.status='ACTIVE' AND entity.created_at<=? AND NOT EXISTS (
         SELECT 1 FROM goal_progress_entries progress WHERE progress.goal_id=goal.id AND progress.recorded_at>=?
       )`,
      now - 30 * 86_400_000,
      now - 30 * 86_400_000,
    );
    add('GOAL_STALLED', '发现超过 30 天没有进展记录的活跃目标。', staleGoals);
    const budgetRisks = ids(
      `SELECT budget.id FROM budgets budget JOIN entity_index entity ON entity.id=budget.id AND entity.deleted_at IS NULL
       WHERE budget.period_start<=? AND budget.period_end>=? AND
       (SELECT COALESCE(SUM(expense.amount_minor),0) FROM expense_entries expense
        WHERE (budget.module_type IS NULL OR expense.module_type=budget.module_type)
          AND date(expense.occurred_at/1000,'unixepoch') BETWEEN budget.period_start AND budget.period_end)
       >= budget.amount_minor*budget.alert_threshold_percent/100`,
      new Date(now).toISOString().slice(0, 10),
      new Date(now).toISOString().slice(0, 10),
    );
    add('BUDGET_LIMIT', '发现当前周期支出已接近或达到预算提醒线。', budgetRisks, 'CRITICAL');
    const fitnessConflicts = ids(
      `SELECT goal.id FROM goals goal JOIN categories category ON category.id=goal.category_id
       JOIN entity_index entity ON entity.id=goal.id AND entity.deleted_at IS NULL
       WHERE goal.status='ACTIVE' AND category.module_type='FITNESS' AND NOT EXISTS (
         SELECT 1 FROM workout_sessions session WHERE session.started_at>=?
       )`,
      now - 14 * 86_400_000,
    );
    add(
      'CROSS_DOMAIN_CONFLICT',
      '存在活跃健身目标，但近 14 天没有运动记录；目标与生活执行数据不一致。',
      fitnessConflicts,
    );
    const infeasiblePlans = ids(
      `SELECT plan.id FROM plans plan JOIN entity_index entity ON entity.id=plan.id AND entity.deleted_at IS NULL
       WHERE plan.status='ACTIVE' AND plan.end_date<=? AND
       (SELECT COALESCE(SUM(task.estimated_minutes),0) FROM tasks task
        WHERE task.plan_id=plan.id AND task.status IN ('TODO','IN_PROGRESS'))>2400`,
      new Date(now + 7 * 86_400_000).toISOString().slice(0, 10),
    );
    add(
      'PLAN_INFEASIBLE',
      '发现一周内到期且剩余工作量超过 40 小时的计划，建议重排。',
      infeasiblePlans,
      'CRITICAL',
    );

    for (const finding of findings) {
      this.recordAiSuggestion({
        title: `[${finding.type}] 主动建议`,
        body: `${finding.message}\n证据对象：${finding.evidenceIds.join('、')}\n仅生成建议，需你明确执行后才会修改数据。`,
        severity: finding.severity,
        targetEntityId: finding.evidenceIds[0] ?? null,
      });
    }
    return { created: findings.length };
  }

  public hasAiCredential(providerId: string): boolean {
    return this.aiCredentialAvailability.get(providerId) ?? false;
  }

  public async verifyAiProvider(providerId: string) {
    const provider = this.ai?.getProvider(providerId);
    if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
    const credential = await this.credentials.get(provider.credentialRef);
    if (credential === undefined) throw new Error('AI_UNAVAILABLE');
    const modelProvider = this.modelProviderFor(provider.providerType);
    if (modelProvider === undefined) throw new Error('AI_CAPABILITY_UNAVAILABLE');
    try {
      const capabilities = await modelProvider.verify({
        modelId: provider.modelId,
        baseUrl: provider.baseUrl,
        credential,
      });
      return this.ai?.recordVerification(providerId, capabilities, null);
    } catch (error) {
      const code =
        error instanceof Error && 'code' in error ? String(error.code) : 'AI_UNAVAILABLE';
      this.ai?.recordVerification(
        providerId,
        {
          chat: false,
          streaming: false,
          toolCalling: false,
          nativeWebSearch: false,
        },
        code,
      );
      throw error;
    }
  }

  private modelProviderFor(
    providerType: AiProviderConfigRecord['providerType'],
  ): ModelProvider | undefined {
    if (providerType === 'OPENAI') return this.openAiProvider;
    if (providerType === 'OPENAI_COMPATIBLE') return this.openAiCompatibleProvider;
    return undefined;
  }

  public isSchedulerAvailable(): boolean {
    return this.jobRunner !== undefined;
  }

  /**
   * 刷新 A5 next-due overdue job：取「计算出的未来检查点」与「已存在的 PENDING job」中更早者，
   * 以带时间戳的幂等键入队。启动时到期的旧 job 保留，由 jobRunner 补跑。
   */
  public refreshOverdueNextDue(): void {
    if (this.schedules === undefined || this.jobs === undefined) return;
    const now = this.clock.now().getTime();
    const computed = this.schedules.nextOverdueCheckpoint(now);
    const existing = this.jobs.firstPendingRunAt('schedule.overdue');
    const candidates: number[] = [];
    if (computed !== null) candidates.push(computed);
    if (existing !== null) candidates.push(existing);
    if (candidates.length === 0) return;
    const nextCheck = Math.min(...candidates);
    this.jobs.enqueue({
      jobType: 'schedule.overdue',
      idempotencyKey: `schedule:overdue:${String(nextCheck)}`,
      payload: {},
      runAt: new Date(nextCheck),
      maxAttempts: 3,
    });
  }

  /**
   * A5 冷启动补偿：恢复耗尽的 overdue job；若旧库从未有 next-due job，
   * 只在启动阶段为已经错过的 checkpoint 补一条即时任务。
   */
  private enqueueOverdueCatchUpOnStartup(): void {
    if (this.schedules === undefined || this.jobs === undefined) return;
    const now = this.clock.now().getTime();
    if (!this.schedules.hasMissedOverdueCheckpoint(now)) return;
    const pendingRunAt = this.jobs.firstPendingRunAt('schedule.overdue');
    if (pendingRunAt !== null && pendingRunAt <= now) return;
    this.jobs.enqueue({
      jobType: 'schedule.overdue',
      idempotencyKey: `schedule:overdue:startup-catchup:${String(now)}`,
      payload: {},
      runAt: new Date(now),
      maxAttempts: 3,
    });
  }

  /**
   * canonical 写操作成功后的 derived reschedule 失败隔离：将失败转为后台重试，
   * 不把已经成功的任务完成/更新误报为失败。
   */
  public enqueueScheduleRetry(
    rangeStart: number,
    rangeEnd: number,
    trigger: string,
    error: unknown,
  ): void {
    if (this.jobs === undefined) return;
    const message = error instanceof Error ? error.message : 'UNKNOWN_SCHEDULE_ERROR';
    this.log('scheduler', 'error', '自动排程失败，已转为后台重试', {
      trigger,
      rangeStart,
      rangeEnd,
      message,
    });
    this.jobs.enqueue({
      jobType: 'schedule.reschedule',
      idempotencyKey: `schedule:reschedule:${trigger}:${String(rangeStart)}:${String(this.clock.now().getTime())}`,
      payload: { rangeStart, rangeEnd, triggerType: trigger },
      maxAttempts: 3,
    });
  }

  public getBackgroundJobSummary(): BackgroundJobSummary {
    if (this.jobs === undefined) return { pending: 0, running: 0, failed: 0 };
    return this.jobs.summary();
  }

  public getDiskSpace(): DiskSpaceSummary {
    if (this.layout === undefined) return { freeBytes: 0, totalBytes: 0 };
    try {
      const info = statfsSync(this.layout.root);
      return {
        freeBytes: info.bavail * info.bsize,
        totalBytes: info.blocks * info.bsize,
      };
    } catch {
      return { freeBytes: 0, totalBytes: 0 };
    }
  }

  private async open(
    layout: DataDirectoryLayout,
    options: { readonly invalidateRestoredAiCredentials?: boolean } = {},
  ): Promise<void> {
    const database = new SqliteDatabase(layout.database, this.clock);
    try {
      await this.openServices(layout, database, options);
    } catch (error) {
      // 迁移或初始化失败时必须释放句柄，否则恢复/迁移回滚无法删除新数据库文件。
      database.close();
      throw error;
    }
  }

  private async openServices(
    layout: DataDirectoryLayout,
    database: SqliteDatabase,
    options: { readonly invalidateRestoredAiCredentials?: boolean } = {},
  ): Promise<void> {
    const hasExistingDatabase = existsSync(layout.database) && this.hasAppliedMigration(database);
    if (hasExistingDatabase) {
      const currentVersion = this.currentSchemaVersion(database);
      if (currentVersion > 0 && currentVersion < 12) {
        await database.backup(
          join(layout.backups, `pre-migration-${String(this.clock.now().getTime())}.db`),
        );
      }
    }
    const migrationResult = database.migrate();
    const invalidatedCredentialCount = options.invalidateRestoredAiCredentials
      ? this.invalidateRestoredAiCredentialReferences(database)
      : 0;
    const logs = new LogManager(layout.logs);
    this.logs = logs;
    this.startedAt = this.clock.now().getTime();
    logs.write('startup', 'info', '数据服务已打开', {
      schemaVersion: migrationResult.toVersion,
      applied: migrationResult.applied.length,
    });
    if (migrationResult.applied.length > 0) {
      logs.write('database', 'info', '数据库迁移完成', {
        fromVersion: migrationResult.fromVersion,
        toVersion: migrationResult.toVersion,
      });
    }
    if (invalidatedCredentialCount > 0) {
      logs.write('backup', 'info', '恢复后 AI 凭据引用已失效', {
        providerCount: invalidatedCredentialCount,
      });
    }
    const shared = new SharedRepository(database, this.clock);
    shared.seedDefaults();
    const demo = new DemoDataRepository(database);
    const metadata = await this.dataDirectories.readMetadata(layout);
    const upsertMetadata = database.raw.prepare(
      `INSERT INTO app_metadata(key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    );
    database.transaction(() => {
      const now = this.clock.now().getTime();
      for (const [key, value] of Object.entries({
        installation_id: metadata.installationId,
        initialized_at: metadata.createdAt,
        app_version: this.appVersion,
        schema_version: 16,
        data_directory_id: metadata.dataDirectoryId,
      })) {
        upsertMetadata.run(key, JSON.stringify(value), now);
      }
    });
    const jobs = new JobRepository(database, this.clock);
    const consistency = new ConsistencyRepository(database, this.clock);
    const actions = new ActionRepository(database, this.clock, consistency);
    const information = new InformationRepository(database, this.clock, consistency);
    const attachmentRepository = new AttachmentRepository(database, this.clock);
    const attachmentStorage = new ManagedFileStorage(layout, attachmentRepository);
    const attachmentGc = new AttachmentGarbageCollector(
      database,
      attachmentRepository,
      attachmentStorage,
    );
    const routines = new RoutineRepository(database, this.clock);
    routines.seedDefaults();
    const schedules = new ScheduleService(
      database,
      actions,
      routines,
      this.clock,
      jobs,
      consistency,
    );
    const recurrences = new RecurrenceService(database, actions, this.clock);
    const today = new TodayService(database, actions, schedules, this.clock);
    const backupService = new BackupService(database, layout, this.clock, this.appVersion);
    const jobRunner = new JobRunner(jobs);
    jobRunner.register('database.quick_check', () => {
      const result = database.quickCheck();
      if (result.length !== 1 || result[0] !== 'ok') throw new Error('数据库完整性检查失败。');
      return Promise.resolve();
    });
    jobRunner.register('recurrence.generate', (job) => {
      const payload = job.payload as { ruleId?: unknown };
      if (typeof payload.ruleId !== 'string') throw new Error('周期生成任务缺少 ruleId。');
      recurrences.generate(payload.ruleId);
      return Promise.resolve();
    });
    jobRunner.register('schedule.reschedule', (job) => {
      const payload = job.payload as {
        rangeStart?: unknown;
        rangeEnd?: unknown;
        triggerType?: unknown;
      };
      if (typeof payload.rangeStart !== 'number' || typeof payload.rangeEnd !== 'number') {
        throw new Error('排程任务缺少时间范围。');
      }
      try {
        schedules.reschedule(
          payload.rangeStart,
          payload.rangeEnd,
          typeof payload.triggerType === 'string' ? payload.triggerType : 'BACKGROUND_JOB',
        );
      } finally {
        this.refreshOverdueNextDue();
      }
      return Promise.resolve();
    });
    // A5：持久 overdue next-due job。run_at = 下一次需要检查的时间（活动块最早结束 / 无块任务最早 due），
    // 到点处理所有 checkpoint <= now 的逾期任务；启动时到期的旧 job 由 jobRunner.start() 补跑。
    jobRunner.register('schedule.overdue', () => {
      const now = this.clock.now().getTime();
      const gridNow = Math.ceil(now / 900_000) * 900_000;
      try {
        schedules.reschedule(gridNow, gridNow + 3 * 86_400_000, 'OVERDUE');
      } finally {
        jobs.deleteFinishedByTypeBefore('schedule.overdue', now - 7 * 86_400_000);
        this.refreshOverdueNextDue();
      }
      return Promise.resolve();
    });
    jobRunner.register('backup.scheduled', async () => {
      const frequency = this.setting<'DAILY' | 'WEEKLY' | 'MANUAL'>(
        database,
        'backup.frequency',
        'WEEKLY',
      );
      if (frequency === 'MANUAL') return;
      const retention = this.setting(database, 'backup.retention_count', 10);
      const result = await backupService.createScheduledBackup(
        metadata.installationId,
        retention,
        this.backupDestination(database),
      );
      logs.write('backup', 'info', '自动备份完成', { path: result.path, frequency });
      this.enqueueNextBackup(jobs, frequency);
    });
    this.enqueueNextBackup(
      jobs,
      this.setting<'DAILY' | 'WEEKLY' | 'MANUAL'>(database, 'backup.frequency', 'WEEKLY'),
      backupService.latestSuccessfulScheduledAt(),
    );
    jobRunner.register('recycle.purge', () => {
      try {
        const rearmedAttachmentGc = jobs.rearmFailedByType('attachment.gc');
        const purged = information.purgeExpiredRecycleBin();
        logs.write('database', 'info', '回收站到期对象清理完成', {
          purged,
          rearmedAttachmentGc,
        });
      } finally {
        this.enqueueNextRecyclePurge(jobs);
      }
      return Promise.resolve();
    });
    jobRunner.register('attachment.gc', (job) => attachmentGc.collect(job));
    this.enqueueRecyclePurgeOnStartup(jobs);
    jobs.rearmFailedByType('attachment.gc');

    this.layout = layout;
    this.database = database;
    this.shared = shared;
    this.demo = demo;
    this.consistency = consistency;
    this.information = information;
    this.metadata = metadata;
    this.jobs = jobs;
    this.jobRunner = jobRunner;
    this.attachmentRepository = attachmentRepository;
    this.attachments = attachmentStorage;
    this.backups = backupService;
    this.actions = actions;
    this.ai = new AiRepository(database, this.clock);
    this.aiActions = new AiActionRepository(database, this.clock);
    const aiMemories = new AiMemoryRepository(database, this.clock, consistency);
    this.aiMemories = aiMemories;
    this.chats = new ChatRepository(database, this.clock);
    this.notifications = new NotificationRepository(database, this.clock);
    this.notificationService = new ListNotifications(this.notifications);
    const reminders = new ReminderRepository(database, this.clock, consistency);
    this.reminders = reminders;
    this.reminderDelivery = new ReminderDeliveryService(
      reminders,
      actions,
      this.notifications,
      this.clock,
    );
    jobRunner.register('reminder.deliver', () => {
      this.reminderDelivery?.deliver();
      this.enqueueReminderDelivery(jobs);
      return Promise.resolve();
    });
    jobs.enqueue({
      jobType: 'reminder.deliver',
      idempotencyKey: `reminder:deliver:startup`,
      payload: {},
      runAt: new Date(this.clock.now().getTime()),
      maxAttempts: 3,
    });
    // 所有处理器注册与启动任务入队完成后再启动轮询，
    // 避免启动时领取到尚无处理器的任务导致虚假失败。
    this.schedules = schedules;
    this.jobs = jobs;
    schedules.preserveReleasedBlockHistory();
    this.enqueueOverdueCatchUpOnStartup();
    this.refreshOverdueNextDue();
    await jobRunner.start();
    this.tools = new ToolRegistry();
    this.chatRunner = new ChatRunner(
      this.chats,
      this.ai,
      async (providerId) => {
        const provider = this.ai?.getProvider(providerId);
        return provider === undefined ? undefined : this.credentials.get(provider.credentialRef);
      },
      (type) => {
        const candidate = this.modelProviderFor(type as AiProviderConfigRecord['providerType']);
        return candidate !== undefined && 'executeTools' in candidate
          ? (candidate as ToolCallingProvider)
          : undefined;
      },
      this.tools,
      () => this.aiMemories?.listForContext(0.7, 20) ?? [],
      (level, message, fields) => {
        this.log('ai-run', level, message, fields);
      },
      this.clock,
    );
    await this.refreshAiCredentialAvailability();
    this.routines = routines;
    this.schedules = schedules;
    this.recurrences = recurrences;
    this.today = today;
    const work = new WorkRepository(database, this.clock, consistency);
    this.work = work;
    const life = new LifeRepository(database, this.clock, consistency);
    this.life = life;
    this.inbox = new InboxRepository(database, this.clock, actions, life, consistency);
    if (this.enableReadOnlyTools)
      registerReadOnlyTools(this.tools, { today, work: this.work, life });
    if (this.enableReadOnlyTools)
      registerRecordLookupTools(this.tools, { information: this.information, actions });
    if (this.enableReadOnlyTools) registerStatisticsTool(this.tools, { work: this.work, life });
    if (this.enableReadOnlyTools) registerNotificationTools(this.tools, this.notificationService);
    if (this.enableReadOnlyTools)
      registerAiProcessInboxTool(this.tools, this.inbox, new AiWriteExecutor(consistency));
    if (this.enableReadOnlyTools)
      registerRememberMemoryTool(this.tools, aiMemories, new AiWriteExecutor(consistency));
    if (this.enableReadOnlyTools)
      registerLowImpactWriteTools(this.tools, {
        actions,
        work: this.work,
        writeExecutor: new AiWriteExecutor(consistency),
        reschedule: (trigger) => {
          const { rangeStart, rangeEnd } = this.currentScheduleRange();
          schedules.reschedule(rangeStart, rangeEnd, trigger);
        },
      });
    if (this.enableReadOnlyTools) {
      const domainWrites: DomainWriteAdapter = {
        create: (recordType, data, context) => {
          switch (recordType) {
            case 'SELF_MEDIA_CONTENT':
              return work.createContent(
                data as Parameters<WorkRepository['createContent']>[0],
                context,
              );
            case 'DEV_PROJECT':
              return work.createProject(
                data as Parameters<WorkRepository['createProject']>[0],
                context,
              );
            case 'LEARNING_RESOURCE':
              return work.createLearningResource(
                data as Parameters<WorkRepository['createLearningResource']>[0],
                context,
              );
            case 'SHOPPING_ITEM':
              return life.createShoppingItem(
                data as Parameters<LifeRepository['createShoppingItem']>[0],
                context,
              );
            case 'RECIPE':
              return life.createRecipe(
                data as Parameters<LifeRepository['createRecipe']>[0],
                context,
              );
            case 'WORKOUT_PLAN':
              return life.createWorkoutPlan(
                data as Parameters<LifeRepository['createWorkoutPlan']>[0],
                context,
              );
            case 'ENTERTAINMENT_ITEM':
              return life.createEntertainmentItem(
                data as Parameters<LifeRepository['createEntertainmentItem']>[0],
                context,
              );
          }
        },
        update: (recordType, entityId, expectedVersion, patch, context) => {
          switch (recordType) {
            case 'SELF_MEDIA_CONTENT':
              return work.updateContent(
                entityId,
                expectedVersion,
                patch as Parameters<WorkRepository['updateContent']>[2],
                context,
              );
            case 'DEV_PROJECT':
              return work.updateProject(
                entityId,
                expectedVersion,
                patch as Parameters<WorkRepository['updateProject']>[2],
                context,
              );
            case 'LEARNING_RESOURCE':
              return work.updateLearningResource(
                entityId,
                expectedVersion,
                patch as Parameters<WorkRepository['updateLearningResource']>[2],
                context,
              );
            case 'SHOPPING_ITEM':
              return life.updateShoppingItem(
                entityId,
                expectedVersion,
                patch as Parameters<LifeRepository['updateShoppingItem']>[2],
                context,
              );
            case 'RECIPE':
              return life.updateRecipe(
                entityId,
                expectedVersion,
                patch as Parameters<LifeRepository['updateRecipe']>[2],
                context,
              );
            case 'WORKOUT_PLAN':
              return life.updateWorkoutPlan(
                entityId,
                expectedVersion,
                patch as Parameters<LifeRepository['updateWorkoutPlan']>[2],
                context,
              );
            case 'ENTERTAINMENT_ITEM':
              return life.updateEntertainmentItem(
                entityId,
                expectedVersion,
                patch as Parameters<LifeRepository['updateEntertainmentItem']>[2],
                context,
              );
          }
        },
      };
      this.domainWrites = domainWrites;
      registerDomainWriteTools(this.tools, domainWrites, new AiWriteExecutor(consistency));
      registerOperationalWriteTools(
        this.tools,
        {
          reminders,
          actions,
          reschedule: (from, to, trigger, context) =>
            schedules.reschedule(from, to, trigger, context),
        },
        new AiWriteExecutor(consistency),
      );
      registerHighRiskActionTools(this.tools, {
        consistency,
        aiActions: this.aiActions,
        readRecord: (recordType, entityId) =>
          this.information?.getAiDomainRecord(recordType, entityId),
        memoryCount: () => aiMemories.listActive().length,
        recycleCount: () => this.information?.recycleBin().length ?? 0,
      });
    }
    if (this.enableReadOnlyTools)
      registerHighRiskConfirmationTools(this.tools, {
        actions,
        consistency: this.consistency,
        aiActions: this.aiActions,
      });
    this.drafts = new DraftRepository(database, this.clock);
  }

  private hasAppliedMigration(database: SqliteDatabase): boolean {
    const table = database.raw
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    return table !== undefined;
  }

  private currentSchemaVersion(database: SqliteDatabase): number {
    const row = database.raw
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get() as {
      version: number;
    };
    return row.version;
  }

  private setting<T>(database: SqliteDatabase, key: string, fallback: T): T {
    const row = database.raw.prepare('SELECT value_json FROM settings WHERE key=?').get(key) as
      { value_json: string } | undefined;
    return row === undefined ? fallback : (JSON.parse(row.value_json) as T);
  }

  private invalidateRestoredAiCredentialReferences(database: SqliteDatabase): number {
    const restoreId = randomUUID();
    return database.transaction(
      () =>
        database.raw
          .prepare(
            `UPDATE ai_provider_configs
           SET credential_ref = 'life-assistant:ai-provider:' || id || ':restore:' || ?`,
          )
          .run(restoreId).changes,
    );
  }

  public backupDestination(database?: SqliteDatabase): string | undefined {
    const db = database ?? this.database;
    if (db === undefined) return undefined;
    const destination = this.setting<string>(db, 'backup.destination', '');
    return destination.trim() === '' ? undefined : resolve(destination);
  }

  private currentScheduleRange(): { rangeStart: number; rangeEnd: number } {
    const now = this.clock.now().getTime();
    const shifted = new Date(now + 8 * 3_600_000);
    const rangeStart =
      Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      8 * 3_600_000;
    // 自动触发只重排今天 + 未来 3 天（覆盖今日页与近端安排）；
    // 手动 /schedules:reschedule 保留完整自定义范围。
    return { rangeStart, rangeEnd: rangeStart + 3 * 86_400_000 };
  }

  private enqueueNextBackup(jobs: JobRepository, frequency: unknown, lastAt?: number | null): void {
    if (frequency !== 'DAILY' && frequency !== 'WEEKLY') return;
    const interval = frequency === 'DAILY' ? 86_400_000 : 7 * 86_400_000;
    const now = this.clock.now().getTime();
    const runAt =
      lastAt === null || lastAt === undefined ? now + interval : Math.max(now, lastAt + interval);
    jobs.enqueue({
      jobType: 'backup.scheduled',
      idempotencyKey: `backup:${frequency}:${String(runAt)}`,
      payload: { frequency },
      runAt: new Date(runAt),
      maxAttempts: 3,
    });
  }

  private enqueueReminderDelivery(jobs: JobRepository): void {
    const now = this.clock.now().getTime();
    jobs.enqueue({
      jobType: 'reminder.deliver',
      idempotencyKey: `reminder:deliver:${String(Math.floor(now / 10_000))}`,
      payload: {},
      runAt: new Date(now + 10_000),
      maxAttempts: 3,
    });
  }

  private enqueueRecyclePurgeOnStartup(jobs: JobRepository): void {
    const now = this.clock.now().getTime();
    jobs.enqueue({
      jobType: 'recycle.purge',
      idempotencyKey: `recycle:purge:${String(Math.floor(now / 86_400_000))}`,
      payload: {},
      runAt: new Date(now),
      maxAttempts: 3,
    });
  }

  private enqueueNextRecyclePurge(jobs: JobRepository): void {
    const now = this.clock.now().getTime();
    const nextRunAt = (Math.floor(now / 86_400_000) + 1) * 86_400_000;
    jobs.enqueue({
      jobType: 'recycle.purge',
      idempotencyKey: `recycle:purge:${String(Math.floor(nextRunAt / 86_400_000))}`,
      payload: {},
      runAt: new Date(nextRunAt),
      maxAttempts: 3,
    });
  }

  private closeDataServices(): void {
    this.jobRunner?.stop();
    this.jobRunner = undefined;
    this.jobs = undefined;
    this.database?.close();
    this.database = undefined;
    this.shared = undefined;
    this.consistency = undefined;
    this.attachments = undefined;
    this.attachmentRepository = undefined;
    this.backups = undefined;
    this.actions = undefined;
    this.ai = undefined;
    this.aiActions = undefined;
    this.aiMemories = undefined;
    this.chats = undefined;
    this.chatRunner = undefined;
    this.notifications = undefined;
    this.notificationService = undefined;
    this.reminders = undefined;
    this.reminderDelivery = undefined;
    this.tools = undefined;
    this.routines = undefined;
    this.schedules = undefined;
    this.recurrences = undefined;
    this.today = undefined;
    this.work = undefined;
    this.life = undefined;
    this.inbox = undefined;
    this.drafts = undefined;
    this.information = undefined;
    this.demo = undefined;
    this.metadata = undefined;
    this.logs?.close();
    this.logs = undefined;
    this.startedAt = 0;
    this.aiCredentialAvailability.clear();
    this.layout = undefined;
  }

  private async refreshAiCredentialAvailability(): Promise<void> {
    this.aiCredentialAvailability.clear();
    if (this.ai === undefined) return;
    await Promise.all(
      this.ai.listProviders().map(async (provider) => {
        this.aiCredentialAvailability.set(
          provider.id,
          await this.credentials.has(provider.credentialRef),
        );
      }),
    );
  }

  private assertSeparateDirectories(source: string, destination: string): void {
    const relativePath = relative(resolve(source), destination);
    const reverse = relative(destination, resolve(source));
    if (
      relativePath === '' ||
      (!isAbsolute(relativePath) &&
        relativePath !== '..' &&
        !relativePath.startsWith(`..${sep}`)) ||
      (!isAbsolute(reverse) && reverse !== '..' && !reverse.startsWith(`..${sep}`))
    ) {
      throw new Error('新旧数据目录不能相同或互相嵌套。');
    }
  }

  private async listFiles(root: string): Promise<readonly string[]> {
    const output: string[] = [];
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile()) output.push(path);
      }
    };
    await visit(root);
    return output;
  }
}
