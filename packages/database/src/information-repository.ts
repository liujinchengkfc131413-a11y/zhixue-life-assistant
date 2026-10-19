import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import { AttachmentRepository } from './attachment-repository.js';
import { CanonicalHistoryRepository } from './canonical-history-repository.js';
import type { ConsistencyRepository } from './consistency-repository.js';
import type { OperationContext } from './operation-context.js';
import type { SqliteDatabase } from './sqlite-database.js';

export interface SearchResult {
  readonly entityId: string;
  readonly entityType: string;
  readonly categoryId: string | null;
  readonly ownerEntityId: string | null;
  readonly ownerEntityType: string | null;
  readonly title: string;
  readonly snippet: string;
  readonly eventAt: string | null;
  readonly updatedAt: string;
}

export interface SearchFilters {
  readonly entityType?: string | undefined;
  readonly module?: string | undefined;
  readonly categoryId?: string | undefined;
  readonly status?: string | undefined;
  readonly tagId?: string | undefined;
  readonly from?: number | undefined;
  readonly to?: number | undefined;
}

export interface DomainRecordSummary {
  readonly entityId: string;
  readonly entityType: string;
  readonly categoryId: string | null;
  readonly title: string | null;
  readonly snippet: string | null;
  readonly updatedAt: string;
}

export interface AiDomainRecord {
  readonly found: true;
  readonly recordType: string;
  readonly entityId: string;
  readonly updatedAt: string | null;
  readonly data: Readonly<Record<string, unknown>>;
}

const aiDomainTables = {
  GOAL: 'goals',
  PLAN: 'plans',
  TASK: 'tasks',
  EVENT: 'events',
  NOTE: 'notes',
  SELF_MEDIA_CONTENT: 'self_media_contents',
  DEV_PROJECT: 'dev_projects',
  LEARNING_RESOURCE: 'learning_resources',
  SHOPPING_ITEM: 'shopping_items',
  PURCHASE_RECORD: 'purchase_records',
  BUDGET: 'budgets',
  RECIPE: 'recipes',
  MEAL_PLAN: 'meal_plans',
  MEAL_RECORD: 'meal_records',
  HYDRATION_RECORD: 'hydration_records',
  DIETARY_PREFERENCE: 'dietary_preferences',
  EXERCISE: 'exercise_catalog',
  WORKOUT_PLAN: 'workout_plans',
  WORKOUT_SESSION: 'workout_sessions',
  BODY_MEASUREMENT: 'body_measurements',
  PERSONAL_RECORD: 'personal_records',
  RECOVERY_RECORD: 'recovery_records',
  ENTERTAINMENT_ITEM: 'entertainment_items',
  ENTERTAINMENT_SESSION: 'entertainment_sessions',
  REMINDER: 'reminders',
  SCHEDULE_BLOCK: 'schedule_blocks',
} as const;

interface SearchSource {
  readonly table: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly category: string;
  readonly eventAt: string;
}

interface SearchProjectionSignature {
  readonly count: number;
  readonly updated_at_sum: string;
}

const sources: readonly SearchSource[] = [
  {
    table: 'goals',
    type: 'GOAL',
    title: 'title',
    body: "COALESCE(description,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'plans',
    type: 'PLAN',
    title: 'title',
    body: "COALESCE(description,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'tasks',
    type: 'TASK',
    title: 'title',
    body: "COALESCE(description,'')",
    category: 'category_id',
    eventAt: 'due_at',
  },
  {
    table: 'events',
    type: 'EVENT',
    title: 'title',
    body: "COALESCE(description,'')",
    category: 'category_id',
    eventAt: 'start_at',
  },
  {
    table: 'notes',
    type: 'NOTE',
    title: 'title',
    body: 'plain_text',
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'self_media_contents',
    type: 'SELF_MEDIA_CONTENT',
    title: 'title',
    body: "COALESCE(idea,'')",
    category: 'category_id',
    eventAt: 'planned_publish_at',
  },
  {
    table: 'dev_projects',
    type: 'DEV_PROJECT',
    title: 'name',
    body: "COALESCE(summary,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'learning_resources',
    type: 'LEARNING_RESOURCE',
    title: 'title',
    body: "COALESCE(author,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'shopping_items',
    type: 'SHOPPING_ITEM',
    title: 'name',
    body: "COALESCE(product_category,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'recipes',
    type: 'RECIPE',
    title: 'name',
    body: "COALESCE(description,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'workout_plans',
    type: 'WORKOUT_PLAN',
    title: 'name',
    body: "COALESCE(description,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'entertainment_items',
    type: 'ENTERTAINMENT_ITEM',
    title: 'title',
    body: "COALESCE(note,'')",
    category: 'category_id',
    eventAt: 'NULL',
  },
  {
    table: 'inbox_items',
    type: 'INBOX_ITEM',
    title: 'substr(raw_text,1,120)',
    body: 'raw_text',
    category: 'NULL',
    eventAt: 'NULL',
  },
  {
    table: 'attachments',
    type: 'ATTACHMENT',
    title: 'original_name',
    body: "COALESCE(description,'') || ' ' || media_type || ' ' || COALESCE(extension,'')",
    category: 'NULL',
    eventAt: 'NULL',
  },
  {
    table: 'chat_sessions',
    type: 'CHAT_SESSION',
    title: 'title',
    body: "COALESCE((SELECT group_concat(plain_text,' ') FROM chat_messages WHERE session_id=item.id),'')",
    category: 'NULL',
    eventAt: 'last_message_at',
  },
];

export class InformationRepository {
  private readonly canonicalHistory: CanonicalHistoryRepository;

  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    private readonly consistency: ConsistencyRepository,
  ) {
    this.canonicalHistory = new CanonicalHistoryRepository(database, clock, consistency);
  }

  public rebuildSearchIndex(): number {
    return this.database.transaction(() => {
      this.database.raw.prepare('DELETE FROM search_documents').run();
      const insert = this.database.raw.prepare(
        `INSERT INTO search_documents(entity_id,entity_type,category_id,title,body,keywords,event_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      );
      let count = 0;
      for (const source of sources) {
        const rows = this.database.raw
          .prepare(
            `SELECT item.id,${source.title} title,${source.body} body,${source.category} category_id,${source.eventAt} event_at,entity.updated_at
           FROM ${source.table} item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL`,
          )
          .all() as {
          id: string;
          title: string;
          body: string;
          category_id: string | null;
          event_at: number | null;
          updated_at: number;
        }[];
        for (const row of rows) {
          const keywords = this.searchKeywords(source.type, row.id);
          insert.run(
            row.id,
            source.type,
            row.category_id,
            row.title,
            row.body,
            keywords,
            row.event_at,
            row.updated_at,
          );
          count += 1;
        }
      }
      return count;
    });
  }

  /**
   * 增量同步搜索投影：只更新自上次同步以来变化或新增的实体，并清理已软删除实体的投影。
   * 投影以 entity_index.updated_at 为版本，写入路径无需改动即可保持搜索新鲜。
   */
  public syncChangedSearchDocuments(): number {
    return this.database.transaction(() => {
      const searchableTypes = sources.map((source) => `'${source.type}'`).join(',');
      const sourceSignature = this.database.raw
        .prepare(
          `SELECT COUNT(*) count, printf('%lld', COALESCE(SUM(updated_at), 0)) updated_at_sum
           FROM entity_index
           WHERE deleted_at IS NULL AND entity_type IN (${searchableTypes})`,
        )
        .get() as SearchProjectionSignature;
      const projectionSignature = this.database.raw
        .prepare(
          `SELECT COUNT(*) count, printf('%lld', COALESCE(SUM(updated_at), 0)) updated_at_sum
           FROM search_documents`,
        )
        .get() as SearchProjectionSignature;
      if (
        sourceSignature.count === projectionSignature.count &&
        sourceSignature.updated_at_sum === projectionSignature.updated_at_sum
      ) {
        return 0;
      }
      this.database.raw
        .prepare(
          `DELETE FROM search_documents WHERE entity_id IN (
             SELECT id FROM entity_index WHERE deleted_at IS NOT NULL
           )`,
        )
        .run();
      const changed = this.database.raw
        .prepare(
          `SELECT e.id, e.entity_type FROM entity_index e
           LEFT JOIN search_documents s ON s.entity_id = e.id
           WHERE e.deleted_at IS NULL
             AND e.entity_type IN (${searchableTypes})
             AND (s.entity_id IS NULL OR s.updated_at < e.updated_at)`,
        )
        .all() as { id: string; entity_type: string }[];
      let synced = 0;
      for (const source of sources) {
        const ids = changed
          .filter((entity) => entity.entity_type === source.type)
          .map((entity) => entity.id);
        if (ids.length === 0) continue;
        const placeholders = ids.map(() => '?').join(',');
        const rows = this.database.raw
          .prepare(
            `SELECT item.id,${source.title} title,${source.body} body,${source.category} category_id,${source.eventAt} event_at,entity.updated_at
             FROM ${source.table} item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL
             WHERE item.id IN (${placeholders})`,
          )
          .all(...ids) as {
          id: string;
          title: string;
          body: string;
          category_id: string | null;
          event_at: number | null;
          updated_at: number;
        }[];
        const upsert = this.database.raw.prepare(
          `INSERT INTO search_documents(entity_id,entity_type,category_id,title,body,keywords,event_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(entity_id) DO UPDATE SET
             entity_type=excluded.entity_type,category_id=excluded.category_id,title=excluded.title,
             body=excluded.body,keywords=excluded.keywords,event_at=excluded.event_at,updated_at=excluded.updated_at`,
        );
        for (const row of rows) {
          const keywords = this.searchKeywords(source.type, row.id);
          upsert.run(
            row.id,
            source.type,
            row.category_id,
            row.title,
            row.body,
            keywords,
            row.event_at,
            row.updated_at,
          );
          synced += 1;
        }
      }
      return synced;
    });
  }

  public search(query: string, input: SearchFilters | string = {}): readonly SearchResult[] {
    this.syncChangedSearchDocuments();
    const filters = typeof input === 'string' ? { entityType: input } : input;
    const q = query.trim();
    if (q.length === 0) return [];
    const like = `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    const ftsQuery = `"${q.replaceAll('"', '""')}"*`;
    const rows = this.database.raw
      .prepare(
        `SELECT document.entity_id,document.entity_type,document.category_id,document.title,document.body,
                CASE WHEN document.entity_type='NOTE' THEN (
                  SELECT link.entity_id FROM work_note_links link
                  WHERE link.note_id=document.entity_id ORDER BY link.sort_order,link.entity_id LIMIT 1
                ) ELSE NULL END owner_entity_id,
                CASE WHEN document.entity_type='NOTE' THEN (
                  SELECT owner.entity_type FROM work_note_links link
                  JOIN entity_index owner ON owner.id=link.entity_id AND owner.deleted_at IS NULL
                  WHERE link.note_id=document.entity_id ORDER BY link.sort_order,link.entity_id LIMIT 1
                ) ELSE NULL END owner_entity_type,
                document.event_at,document.updated_at
       FROM search_fts search
       JOIN search_documents document ON document.rowid=search.rowid
       LEFT JOIN categories category ON category.id=document.category_id
       WHERE search_fts MATCH ?
         AND (? IS NULL OR document.entity_type=?)
         AND (? IS NULL OR category.module_type=?)
         AND (? IS NULL OR document.category_id=?)
         AND (? IS NULL OR EXISTS (
           SELECT 1 FROM tag_links link WHERE link.entity_id=document.entity_id AND link.tag_id=?
         ))
         AND (? IS NULL OR COALESCE(document.event_at,document.updated_at)>=?)
         AND (? IS NULL OR COALESCE(document.event_at,document.updated_at)<?)
         AND (? IS NULL OR ${this.searchStatusExpression()}=?)
       ORDER BY CASE WHEN document.title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,document.updated_at DESC LIMIT 50`,
      )
      .all(
        ftsQuery,
        filters.entityType ?? null,
        filters.entityType ?? null,
        filters.module ?? null,
        filters.module ?? null,
        filters.categoryId ?? null,
        filters.categoryId ?? null,
        filters.tagId ?? null,
        filters.tagId ?? null,
        filters.from ?? null,
        filters.from ?? null,
        filters.to ?? null,
        filters.to ?? null,
        filters.status ?? null,
        filters.status ?? null,
        like,
      ) as {
      entity_id: string;
      entity_type: string;
      category_id: string | null;
      owner_entity_id: string | null;
      owner_entity_type: string | null;
      title: string;
      body: string;
      event_at: number | null;
      updated_at: number;
    }[];
    return rows.map((row) => ({
      entityId: row.entity_id,
      entityType: row.entity_type,
      categoryId: row.category_id,
      ownerEntityId: row.owner_entity_id,
      ownerEntityType: row.owner_entity_type,
      title: row.title,
      snippet: this.snippet(row.body || row.title, q),
      eventAt: row.event_at === null ? null : new Date(row.event_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  private searchKeywords(entityType: string, entityId: string): string {
    const tags = this.database.raw
      .prepare(
        `SELECT group_concat(tag.name,' ') value FROM tag_links link JOIN tags tag ON tag.id=link.tag_id WHERE link.entity_id=?`,
      )
      .get(entityId) as { value: string | null };
    if (entityType !== 'ATTACHMENT') return tags.value ?? '';
    const ownership = this.database.raw
      .prepare(
        `SELECT group_concat(link.role || ' ' || owner.entity_type,' ') value
         FROM attachment_links link JOIN entity_index owner ON owner.id=link.entity_id
         WHERE link.attachment_id=? AND owner.deleted_at IS NULL`,
      )
      .get(entityId) as { value: string | null };
    return [tags.value, ownership.value]
      .filter((value): value is string => value !== null)
      .join(' ');
  }

  private searchStatusExpression(): string {
    return `CASE document.entity_type
      WHEN 'GOAL' THEN (SELECT status FROM goals WHERE id=document.entity_id)
      WHEN 'PLAN' THEN (SELECT status FROM plans WHERE id=document.entity_id)
      WHEN 'TASK' THEN (SELECT status FROM tasks WHERE id=document.entity_id)
      WHEN 'EVENT' THEN (SELECT status FROM events WHERE id=document.entity_id)
      WHEN 'SELF_MEDIA_CONTENT' THEN (SELECT production_status FROM self_media_contents WHERE id=document.entity_id)
      WHEN 'DEV_PROJECT' THEN (SELECT status FROM dev_projects WHERE id=document.entity_id)
      WHEN 'LEARNING_RESOURCE' THEN (SELECT status FROM learning_resources WHERE id=document.entity_id)
      WHEN 'SHOPPING_ITEM' THEN (SELECT status FROM shopping_items WHERE id=document.entity_id)
      WHEN 'WORKOUT_PLAN' THEN (SELECT status FROM workout_plans WHERE id=document.entity_id)
      WHEN 'ENTERTAINMENT_ITEM' THEN (SELECT status FROM entertainment_items WHERE id=document.entity_id)
      WHEN 'INBOX_ITEM' THEN (SELECT status FROM inbox_items WHERE id=document.entity_id)
      WHEN 'ATTACHMENT' THEN (SELECT status FROM attachments WHERE id=document.entity_id)
      WHEN 'CHAT_SESSION' THEN (SELECT status FROM chat_sessions WHERE id=document.entity_id)
      ELSE NULL END`;
  }

  public getDomainRecord(entityId: string): DomainRecordSummary | undefined {
    this.syncChangedSearchDocuments();
    const row = this.database.raw
      .prepare(
        `SELECT entity.id AS entity_id,entity.entity_type,entity.updated_at,
                document.category_id,document.title,document.body
         FROM entity_index entity LEFT JOIN search_documents document ON document.entity_id=entity.id
         WHERE entity.id=? AND entity.deleted_at IS NULL`,
      )
      .get(entityId) as
      | {
          entity_id: string;
          entity_type: string;
          updated_at: number;
          category_id: string | null;
          title: string | null;
          body: string | null;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          entityId: row.entity_id,
          entityType: row.entity_type,
          categoryId: row.category_id,
          title: row.title,
          snippet: row.body,
          updatedAt: new Date(row.updated_at).toISOString(),
        };
  }

  /** AI-safe structured read path. It never reads search projection bodies or attachment bytes. */
  public getAiDomainRecord(
    recordType: string | undefined,
    entityId: string,
  ): AiDomainRecord | undefined {
    const entity = this.database.raw
      .prepare(
        `SELECT entity_type,updated_at FROM entity_index
         WHERE id=? AND deleted_at IS NULL`,
      )
      .get(entityId) as { entity_type: string; updated_at: number } | undefined;
    if (entity === undefined) return undefined;
    const resolvedType = recordType ?? entity.entity_type;
    if (entity.entity_type !== resolvedType) return undefined;

    if (resolvedType === 'ATTACHMENT') {
      const row = this.database.raw
        .prepare(
          `SELECT attachment.id,attachment.original_name,attachment.media_type,attachment.extension,
                  attachment.size_bytes,attachment.description,attachment.status,
                  link.entity_id owner_entity_id,link.role ownership_role
           FROM attachments attachment
           LEFT JOIN attachment_links link ON link.attachment_id=attachment.id
           WHERE attachment.id=?`,
        )
        .get(entityId) as Record<string, unknown> | undefined;
      return row === undefined
        ? undefined
        : {
            found: true,
            recordType: resolvedType,
            entityId,
            updatedAt: new Date(entity.updated_at).toISOString(),
            data: row,
          };
    }

    if (!(resolvedType in aiDomainTables)) return undefined;
    const table = aiDomainTables[resolvedType as keyof typeof aiDomainTables];
    const row = this.database.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get(entityId) as
      Record<string, unknown> | undefined;
    return row === undefined
      ? undefined
      : {
          found: true,
          recordType: resolvedType,
          entityId,
          updatedAt: new Date(entity.updated_at).toISOString(),
          data: row,
        };
  }

  public versions(entityId: string): readonly unknown[] {
    return this.canonicalHistory.versions(entityId);
  }

  public previewVersionRestore(
    entityId: string,
    targetVersion: number,
    expectedVersion: number,
  ): { id: string; token: string; expiresAt: string; preview: unknown } {
    const canonicalPreview = this.canonicalHistory.previewRestore(
      entityId,
      targetVersion,
      expectedVersion,
    );
    if (canonicalPreview.conflicts.length > 0)
      throw new Error(
        `RESTORE_CONFLICT:${canonicalPreview.conflicts.map((item) => item.code).join(',')}`,
      );
    const request = { operation: 'RESTORE_VERSION', entityId, targetVersion, expectedVersion };
    const preview = {
      title: `恢复到版本 ${String(targetVersion)}`,
      impact: '当前内容会保留在历史中，恢复操作会生成一个新版本。',
      entityId,
      entityType: canonicalPreview.entityType,
      expectedVersion,
      targetVersion,
      conflicts: canonicalPreview.conflicts,
      changes: canonicalPreview.changes,
    };
    return {
      ...this.consistency.createConfirmation('RESTORE_VERSION', request, preview),
      preview,
    };
  }

  public executeVersionRestore(
    confirmationId: string,
    token: string,
    entityId: string,
    targetVersion: number,
    expectedVersion: number,
    context: OperationContext,
    sourceChangeSetId?: string,
  ): void {
    const request = { operation: 'RESTORE_VERSION', entityId, targetVersion, expectedVersion };
    this.database.transaction(() => {
      this.consistency.confirm(confirmationId, token, 'RESTORE_VERSION', request);
      this.canonicalHistory.restoreVersion({
        entityId,
        targetVersion,
        expectedVersion,
        context,
      });
      if (sourceChangeSetId !== undefined) {
        this.database.raw
          .prepare(
            "UPDATE change_sets SET status='REVERTED',reverted_at=? WHERE id=? AND status='APPLIED'",
          )
          .run(this.clock.now().getTime(), sourceChangeSetId);
      }
      this.consistency.markConfirmationExecuted(confirmationId);
    });
  }

  public previewUndo(changeSetId: string): {
    id: string;
    token: string;
    expiresAt: string;
    preview: unknown;
  } {
    const version = this.changeSetVersion(changeSetId);
    if (version.entity_version <= 1) throw new Error('CHANGE_SET_NOT_UNDOABLE');
    const current = this.database.raw
      .prepare('SELECT entity_type,version FROM entity_index WHERE id=? AND deleted_at IS NULL')
      .get(version.entity_id) as { entity_type: string; version: number } | undefined;
    if (current === undefined) throw new Error('ENTITY_NOT_FOUND');
    if (current.version !== version.entity_version) throw new Error('CHANGE_SET_NOT_LATEST');
    const targetVersion = version.entity_version - 1;
    const request = {
      operation: 'UNDO_CHANGE_SET',
      changeSetId,
      entityId: version.entity_id,
      targetVersion,
      expectedVersion: current.version,
    };
    const canonicalPreview = this.canonicalHistory.previewRestore(
      version.entity_id,
      targetVersion,
      current.version,
    );
    if (canonicalPreview.conflicts.length > 0)
      throw new Error(
        `RESTORE_CONFLICT:${canonicalPreview.conflicts.map((item) => item.code).join(',')}`,
      );
    const preview = {
      title: '撤销最近操作',
      impact: '撤销会把对象恢复到操作前状态，并生成新的历史版本。',
      changeSetId,
      entityId: version.entity_id,
      entityType: current.entity_type,
      expectedVersion: current.version,
      targetVersion,
      changes: canonicalPreview.changes,
    };
    return {
      ...this.consistency.createConfirmation('UNDO_CHANGE_SET', request, preview),
      preview,
    };
  }

  public executeUndo(
    confirmationId: string,
    token: string,
    changeSetId: string,
    entityId: string,
    targetVersion: number,
    expectedVersion: number,
    context: OperationContext,
  ): void {
    const request = {
      operation: 'UNDO_CHANGE_SET',
      changeSetId,
      entityId,
      targetVersion,
      expectedVersion,
    };
    this.database.transaction(() => {
      this.consistency.confirm(confirmationId, token, 'UNDO_CHANGE_SET', request);
      const now = this.clock.now().getTime();
      this.canonicalHistory.restoreVersion({
        entityId,
        targetVersion,
        expectedVersion,
        context,
        summary: `UndoChangeSet:${changeSetId}`,
      });
      this.database.raw
        .prepare(
          "UPDATE change_sets SET status='REVERTED',reverted_at=? WHERE id=? AND status='APPLIED'",
        )
        .run(now, changeSetId);
      this.consistency.markConfirmationExecuted(confirmationId);
    });
  }

  public previewRedo(changeSetId: string): {
    id: string;
    token: string;
    expiresAt: string;
    preview: unknown;
  } {
    const version = this.changeSetVersion(changeSetId, 'REVERTED');
    const current = this.database.raw
      .prepare('SELECT entity_type,version FROM entity_index WHERE id=? AND deleted_at IS NULL')
      .get(version.entity_id) as { entity_type: string; version: number } | undefined;
    if (current === undefined) throw new Error('ENTITY_NOT_FOUND');
    const canonicalPreview = this.canonicalHistory.previewRestore(
      version.entity_id,
      version.entity_version,
      current.version,
    );
    if (canonicalPreview.conflicts.length > 0)
      throw new Error(
        `RESTORE_CONFLICT:${canonicalPreview.conflicts.map((item) => item.code).join(',')}`,
      );
    const request = {
      operation: 'REDO_CHANGE_SET',
      changeSetId,
      entityId: version.entity_id,
      targetVersion: version.entity_version,
      expectedVersion: current.version,
    };
    const preview = {
      title: '重做已撤销操作',
      impact: '重做会恢复原操作完成后的状态，并生成新的历史版本。',
      ...request,
      entityType: current.entity_type,
      changes: canonicalPreview.changes,
    };
    return {
      ...this.consistency.createConfirmation('REDO_CHANGE_SET', request, preview),
      preview,
    };
  }

  public executeRedo(
    confirmationId: string,
    token: string,
    changeSetId: string,
    entityId: string,
    targetVersion: number,
    expectedVersion: number,
    context: OperationContext,
  ): void {
    const request = {
      operation: 'REDO_CHANGE_SET',
      changeSetId,
      entityId,
      targetVersion,
      expectedVersion,
    };
    this.database.transaction(() => {
      this.consistency.confirm(confirmationId, token, 'REDO_CHANGE_SET', request);
      this.canonicalHistory.restoreVersion({
        entityId,
        targetVersion,
        expectedVersion,
        context,
        summary: `RedoChangeSet:${changeSetId}`,
      });
      this.database.raw
        .prepare(
          "UPDATE change_sets SET status='APPLIED',reverted_at=NULL WHERE id=? AND status='REVERTED'",
        )
        .run(changeSetId);
      this.consistency.markConfirmationExecuted(confirmationId);
    });
  }

  public changeSets(): readonly unknown[] {
    return this.database.raw
      .prepare(
        `SELECT change_set.*,COUNT(operation.id) operation_count,
                version.entity_id,version.entity_version,entity.version current_version
       FROM change_sets change_set LEFT JOIN change_operations operation ON operation.change_set_id=change_set.id
       LEFT JOIN entity_versions version ON version.change_set_id=change_set.id
       LEFT JOIN entity_index entity ON entity.id=version.entity_id AND entity.deleted_at IS NULL
       GROUP BY change_set.id ORDER BY change_set.created_at DESC LIMIT 100`,
      )
      .all()
      .map((value: unknown) => {
        const row = value as Record<string, unknown> & {
          created_at: number;
          applied_at: number | null;
          reverted_at: number | null;
          entity_id: string | null;
          entity_version: number | null;
          current_version: number | null;
        };
        return {
          id: row.id,
          source: row.source,
          summary: row.summary,
          riskLevel: row.risk_level,
          status: row.status,
          operationCount: row.operation_count,
          createdAt: new Date(row.created_at).toISOString(),
          appliedAt: row.applied_at === null ? null : new Date(row.applied_at).toISOString(),
          revertedAt: row.reverted_at === null ? null : new Date(row.reverted_at).toISOString(),
          entityId: row.entity_id,
          entityVersion: row.entity_version,
          canUndo:
            row.status === 'APPLIED' &&
            row.entity_version !== null &&
            row.entity_version > 1 &&
            row.entity_version === row.current_version,
          canRedo: row.status === 'REVERTED' && row.entity_id !== null,
        };
      });
  }

  public recycleBin(): readonly unknown[] {
    return this.database.raw
      .prepare(
        `SELECT entity.id,entity.entity_type,entity.version,entity.deleted_at,entity.purge_after,
              COALESCE(task.title,note.title,goal.title,plan.title,milestone.title,event.title,media.title,shopping.name,project.name,learning.title,entertainment.title,entertainment_session.note,'娱乐记录 ' || entertainment_session.session_date,recipe.name,meal.title,preference.name,hydration.note,CAST(hydration.amount_ml AS TEXT) || ' ml',workout.name,exercise.name,session.note,'训练记录 ' || date(session.started_at/1000,'unixepoch'),measurement.note,'身体指标 ' || date(measurement.measured_at/1000,'unixepoch'),CAST(personal.value AS TEXT) || ' ' || personal.unit,recovery.note,'恢复状态 ' || recovery.recorded_date,inbox.raw_text,entity.entity_type) title
       FROM entity_index entity
       LEFT JOIN tasks task ON task.id=entity.id LEFT JOIN notes note ON note.id=entity.id
       LEFT JOIN goals goal ON goal.id=entity.id LEFT JOIN plans plan ON plan.id=entity.id LEFT JOIN events event ON event.id=entity.id
       LEFT JOIN milestones milestone ON milestone.id=entity.id
       LEFT JOIN self_media_contents media ON media.id=entity.id
       LEFT JOIN shopping_items shopping ON shopping.id=entity.id LEFT JOIN dev_projects project ON project.id=entity.id
       LEFT JOIN learning_resources learning ON learning.id=entity.id LEFT JOIN entertainment_items entertainment ON entertainment.id=entity.id
       LEFT JOIN entertainment_sessions entertainment_session ON entertainment_session.id=entity.id
       LEFT JOIN recipes recipe ON recipe.id=entity.id LEFT JOIN meal_records meal ON meal.id=entity.id
       LEFT JOIN dietary_preferences preference ON preference.id=entity.id LEFT JOIN hydration_records hydration ON hydration.id=entity.id
       LEFT JOIN workout_plans workout ON workout.id=entity.id LEFT JOIN exercise_catalog exercise ON exercise.id=entity.id
       LEFT JOIN workout_sessions session ON session.id=entity.id LEFT JOIN body_measurements measurement ON measurement.id=entity.id
       LEFT JOIN personal_records personal ON personal.id=entity.id LEFT JOIN recovery_records recovery ON recovery.id=entity.id
       LEFT JOIN inbox_items inbox ON inbox.id=entity.id
       WHERE entity.deleted_at IS NOT NULL
         AND entity.entity_type <> 'SCHEDULE_BLOCK'
       ORDER BY entity.deleted_at DESC`,
      )
      .all()
      .map((value: unknown) => {
        const row = value as {
          id: string;
          entity_type: string;
          version: number;
          title: string;
          deleted_at: number;
          purge_after: number;
        };
        return {
          id: row.id,
          entityType: row.entity_type,
          version: row.version,
          title: row.title,
          deletedAt: new Date(row.deleted_at).toISOString(),
          purgeAfter: new Date(row.purge_after).toISOString(),
        };
      });
  }

  public restoreDeleted(id: string, expectedVersion: number, context?: OperationContext): void {
    this.database.transaction(() => {
      const row = this.database.raw
        .prepare('SELECT entity_type,version,deleted_at FROM entity_index WHERE id=?')
        .get(id) as { entity_type: string; version: number; deleted_at: number | null } | undefined;
      if (row?.deleted_at === null || row === undefined) throw new Error('RECYCLE_ITEM_NOT_FOUND');
      if (row.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
      const before =
        context === undefined || !this.canonicalHistory.supports(row.entity_type)
          ? undefined
          : this.canonicalHistory.captureStoredState(id);
      const now = this.clock.now().getTime();
      this.database.raw
        .prepare(
          'UPDATE entity_index SET version=version+1,updated_at=?,deleted_at=NULL,purge_after=NULL WHERE id=?',
        )
        .run(now, id);
      if (context !== undefined && before !== undefined)
        this.canonicalHistory.recordLifecycleChange({
          entityId: id,
          before,
          context,
          summary: 'EntityRestored',
          operation: 'RESTORE',
        });
      else this.audit(id, expectedVersion + 1, 'EntityRestored', { id });
    });
  }

  public purgeExpiredRecycleBin(): number {
    const now = this.clock.now().getTime();
    return this.database.transaction(() => {
      const expired = this.database.raw
        .prepare(
          `SELECT id FROM entity_index
           WHERE entity_type <> 'ATTACHMENT'
             AND deleted_at IS NOT NULL AND purge_after IS NOT NULL AND purge_after <= ?
           ORDER BY purge_after, id`,
        )
        .all(now) as { id: string }[];
      if (expired.length === 0) return 0;
      const placeholders = expired.map(() => '?').join(',');
      const ids = expired.map((row) => row.id);
      const affectedAttachments = this.database.raw
        .prepare(
          `SELECT DISTINCT attachment_id FROM attachment_links
           WHERE entity_id IN (${placeholders})`,
        )
        .all(...ids) as { attachment_id: string }[];
      this.database.raw
        .prepare(`UPDATE change_operations SET entity_id=NULL WHERE entity_id IN (${placeholders})`)
        .run(...ids);
      const purged = this.database.raw
        .prepare(
          `DELETE FROM entity_index
           WHERE deleted_at IS NOT NULL AND purge_after IS NOT NULL AND purge_after <= ?
             AND id IN (${placeholders})`,
        )
        .run(now, ...ids).changes;
      new AttachmentRepository(this.database, this.clock).enqueueGcIfUnreferenced(
        affectedAttachments.map((row) => row.attachment_id),
      );
      return purged;
    });
  }

  public emptyRecycleBin(context: OperationContext): { purged: number } {
    return this.database.transaction(() => {
      const deleted = this.database.raw
        .prepare(
          `SELECT id,entity_type,version,deleted_at,purge_after FROM entity_index
           WHERE deleted_at IS NOT NULL AND entity_type <> 'SCHEDULE_BLOCK' ORDER BY id`,
        )
        .all() as Record<string, unknown>[];
      if (deleted.length === 0) return { purged: 0 };
      const ids = deleted.map((row) => String(row.id));
      const placeholders = ids.map(() => '?').join(',');
      const affectedAttachments = this.database.raw
        .prepare(
          `SELECT DISTINCT attachment_id FROM attachment_links WHERE entity_id IN (${placeholders})`,
        )
        .all(...ids) as { attachment_id: string }[];
      this.database.raw
        .prepare(`UPDATE change_operations SET entity_id=NULL WHERE entity_id IN (${placeholders})`)
        .run(...ids);
      const purged = this.database.raw
        .prepare(
          `DELETE FROM entity_index WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`,
        )
        .run(...ids).changes;
      this.consistency.recordChange({
        context,
        summary: 'RecycleBinEmptied',
        riskLevel: 'HIGH_WRITE',
        changes: deleted.map((before) => ({ operation: 'PURGE' as const, before })),
      });
      new AttachmentRepository(this.database, this.clock).enqueueGcIfUnreferenced(
        affectedAttachments.map((row) => row.attachment_id),
      );
      return { purged };
    });
  }

  public previewPurge(id: string): {
    id: string;
    token: string;
    expiresAt: string;
    preview: unknown;
  } {
    const row = this.database.raw
      .prepare(
        'SELECT id,entity_type,version,purge_after FROM entity_index WHERE id=? AND deleted_at IS NOT NULL',
      )
      .get(id) as
      { id: string; entity_type: string; version: number; purge_after: number } | undefined;
    if (row === undefined) throw new Error('RECYCLE_ITEM_NOT_FOUND');
    const request = { operation: 'PURGE_ENTITY', entityId: id, expectedVersion: row.version };
    const preview = {
      title: '永久删除对象',
      impact: '对象、版本历史与关联数据将永久删除，且不可撤销。',
      entityId: id,
      entityType: row.entity_type,
      expectedVersion: row.version,
    };
    return { ...this.consistency.createConfirmation('PURGE_ENTITY', request, preview), preview };
  }

  public executePurge(
    confirmationId: string,
    token: string,
    entityId: string,
    expectedVersion: number,
  ): void {
    const request = { operation: 'PURGE_ENTITY', entityId, expectedVersion };
    this.database.transaction(() => {
      this.consistency.confirm(confirmationId, token, 'PURGE_ENTITY', request);
      const row = this.database.raw
        .prepare('SELECT version,deleted_at FROM entity_index WHERE id=?')
        .get(entityId) as { version: number; deleted_at: number | null } | undefined;
      if (row?.deleted_at === null || row === undefined) throw new Error('RECYCLE_ITEM_NOT_FOUND');
      if (row.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
      const affectedAttachments = this.database.raw
        .prepare('SELECT attachment_id FROM attachment_links WHERE entity_id = ?')
        .all(entityId) as { attachment_id: string }[];
      this.database.raw
        .prepare('UPDATE change_operations SET entity_id=NULL WHERE entity_id=?')
        .run(entityId);
      this.database.raw.prepare('DELETE FROM entity_index WHERE id=?').run(entityId);
      new AttachmentRepository(this.database, this.clock).enqueueGcIfUnreferenced(
        affectedAttachments.map((item) => item.attachment_id),
      );
      this.consistency.markConfirmationExecuted(confirmationId);
    });
  }

  private snippet(body: string, query: string): string {
    const index = body.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    if (index < 0) return body.slice(0, 140);
    const start = Math.max(0, index - 45);
    return `${start > 0 ? '…' : ''}${body.slice(start, start + 140)}${start + 140 < body.length ? '…' : ''}`;
  }

  private changeSetVersion(
    changeSetId: string,
    requiredStatus = 'APPLIED',
  ): { entity_id: string; entity_version: number } {
    const rows = this.database.raw
      .prepare(
        `SELECT version.entity_id,version.entity_version FROM entity_versions version
         JOIN change_sets change_set ON change_set.id=version.change_set_id
         WHERE change_set.id=? AND change_set.status=?`,
      )
      .all(changeSetId, requiredStatus) as { entity_id: string; entity_version: number }[];
    if (rows.length !== 1) throw new Error('CHANGE_SET_NOT_UNDOABLE');
    const row = rows[0];
    if (row === undefined) throw new Error('CHANGE_SET_NOT_UNDOABLE');
    return row;
  }

  private audit(
    entityId: string,
    version: number,
    summary: string,
    snapshot: unknown,
    operation: 'UPDATE' | 'RESTORE' = 'UPDATE',
    before?: unknown,
  ): string {
    const now = this.clock.now().getTime();
    const changeSetId = ulid();
    this.database.raw
      .prepare(
        `INSERT INTO change_sets(id,source,summary,risk_level,status,created_at,applied_at) VALUES (?, 'USER',?,'LOW_WRITE','APPLIED',?,?)`,
      )
      .run(changeSetId, summary, now, now);
    this.database.raw
      .prepare(
        `INSERT INTO change_operations(id,change_set_id,sequence,entity_id,operation,before_json,after_json) VALUES (?,?,0,?,?,?,?)`,
      )
      .run(
        ulid(),
        changeSetId,
        entityId,
        operation,
        before === undefined ? null : JSON.stringify(before),
        JSON.stringify(snapshot),
      );
    this.database.raw
      .prepare(
        `INSERT INTO entity_versions(id,entity_id,entity_version,change_set_id,source,snapshot_json,patch_json,created_at) VALUES (?,?,?,?, 'USER',?,'{}',?)`,
      )
      .run(ulid(), entityId, version, changeSetId, JSON.stringify(snapshot), now);
    return changeSetId;
  }
}
