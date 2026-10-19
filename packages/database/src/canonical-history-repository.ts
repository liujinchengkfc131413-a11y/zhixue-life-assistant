import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import { ConsistencyRepository, type ChangeInput } from './consistency-repository.js';
import { refreshGoalProgress as refreshGoalProgressValue } from './goal-progress.js';
import type { OperationContext } from './operation-context.js';
import type { CanonicalEntitySnapshot } from './snapshot-contract.js';
import { isTrustedCanonicalSnapshotMetadata } from './snapshot-contract.js';
import type { SqliteDatabase } from './sqlite-database.js';

type FieldKind = 'plain' | 'boolean' | 'time' | 'json';

interface FieldDefinition {
  readonly key: string;
  readonly column: string;
  readonly kind?: FieldKind;
}

interface ReferenceDefinition {
  readonly key: string;
  readonly table: string;
  readonly conflict: string;
  readonly categoryModule?: string;
}

interface AdapterDefinition {
  readonly entityType: string;
  readonly table: string;
  readonly fields: readonly FieldDefinition[];
  readonly references: readonly ReferenceDefinition[];
}

export interface RestoreConflict {
  readonly code: string;
  readonly referenceId?: string;
}

export interface CanonicalSnapshotAdapter {
  readonly entityType: string;
  captureCurrentState(entityId: string): CanonicalEntitySnapshot<Record<string, unknown>>;
  validateRestoreTarget(snapshot: CanonicalEntitySnapshot): readonly RestoreConflict[];
  applyCanonicalState(entityId: string, snapshot: CanonicalEntitySnapshot): void;
  restoreOwnedRelations(entityId: string, snapshot: CanonicalEntitySnapshot): void;
  rebuildDerivedState(
    entityId: string,
    before: CanonicalEntitySnapshot,
    after: CanonicalEntitySnapshot,
    entityVersion: number,
  ): void;
}

export type HistoryKind = 'AUDIT_ONLY' | 'BASELINE' | 'CANONICAL';
export type RestoreEligibility = 'UNVERIFIED' | 'ELIGIBLE';

export interface CanonicalHistoryVersion {
  readonly entityVersion: number;
  readonly source: string;
  readonly snapshot: unknown;
  readonly createdAt: string;
  readonly changeSetId: string | null;
  readonly summary: string | null;
  readonly historyKind: HistoryKind;
  readonly restoreEligibility: RestoreEligibility;
}

const f = (key: string, column: string, kind: FieldKind = 'plain'): FieldDefinition => ({
  key,
  column,
  kind,
});

const category = (module?: string): ReferenceDefinition => ({
  key: 'categoryId',
  table: 'categories',
  conflict: 'CATEGORY_UNAVAILABLE',
  ...(module === undefined ? {} : { categoryModule: module }),
});
const ref = (key: string, table: string, conflict: string): ReferenceDefinition => ({
  key,
  table,
  conflict,
});

const definitions: readonly AdapterDefinition[] = [
  {
    entityType: 'GOAL',
    table: 'goals',
    fields: [
      f('categoryId', 'category_id'),
      f('title', 'title'),
      f('description', 'description'),
      f('goalType', 'goal_type'),
      f('status', 'status'),
      f('startDate', 'start_date'),
      f('endDate', 'end_date'),
      f('horizon', 'horizon'),
      f('manualProgress', 'manual_progress'),
      f('progressMode', 'progress_mode'),
      f('completedAt', 'completed_at', 'time'),
    ],
    references: [category()],
  },
  {
    entityType: 'PLAN',
    table: 'plans',
    fields: [
      f('goalId', 'goal_id'),
      f('categoryId', 'category_id'),
      f('title', 'title'),
      f('description', 'description'),
      f('status', 'status'),
      f('priority', 'priority'),
      f('startDate', 'start_date'),
      f('endDate', 'end_date'),
      f('manualProgress', 'manual_progress'),
      f('progressMode', 'progress_mode'),
    ],
    references: [category(), ref('goalId', 'goals', 'GOAL_UNAVAILABLE')],
  },
  {
    entityType: 'TASK',
    table: 'tasks',
    fields: [
      f('categoryId', 'category_id'),
      f('planId', 'plan_id'),
      f('goalId', 'goal_id'),
      f('parentTaskId', 'parent_task_id'),
      f('title', 'title'),
      f('description', 'description'),
      f('status', 'status'),
      f('priority', 'priority'),
      f('dueAt', 'due_at', 'time'),
      f('estimatedMinutes', 'estimated_minutes'),
      f('isFlexible', 'is_flexible', 'boolean'),
      f('isSplittable', 'is_splittable', 'boolean'),
      f('preferredArea', 'preferred_area'),
      f('completedAt', 'completed_at', 'time'),
      f('cancelledAt', 'cancelled_at', 'time'),
    ],
    references: [
      category(),
      ref('goalId', 'goals', 'GOAL_UNAVAILABLE'),
      ref('planId', 'plans', 'PLAN_UNAVAILABLE'),
      ref('parentTaskId', 'tasks', 'PARENT_TASK_UNAVAILABLE'),
    ],
  },
  {
    entityType: 'EVENT',
    table: 'events',
    fields: [
      f('categoryId', 'category_id'),
      f('title', 'title'),
      f('description', 'description'),
      f('startAt', 'start_at', 'time'),
      f('endAt', 'end_at', 'time'),
      f('timeZone', 'time_zone'),
      f('eventType', 'event_type'),
      f('priority', 'priority'),
      f('isImmovable', 'is_immovable', 'boolean'),
      f('allowOverlap', 'allow_overlap', 'boolean'),
      f('status', 'status'),
    ],
    references: [category()],
  },
  {
    entityType: 'NOTE',
    table: 'notes',
    fields: [
      f('categoryId', 'category_id'),
      f('title', 'title'),
      f('editorMode', 'editor_mode'),
      f('richContent', 'rich_content_json', 'json'),
      f('markdownContent', 'markdown_content'),
      f('summary', 'summary'),
    ],
    references: [category()],
  },
  {
    entityType: 'AI_MEMORY',
    table: 'ai_memories',
    fields: [
      f('memoryType', 'memory_type'),
      f('content', 'content'),
      f('confidence', 'confidence'),
      f('sourceSessionId', 'source_session_id'),
      f('lastUsedAt', 'last_used_at', 'time'),
      f('isActive', 'is_active', 'boolean'),
    ],
    references: [ref('sourceSessionId', 'chat_sessions', 'CHAT_SESSION_UNAVAILABLE')],
  },
  {
    entityType: 'INBOX_ITEM',
    table: 'inbox_items',
    fields: [
      f('rawText', 'raw_text'),
      f('status', 'status'),
      f('captureMode', 'capture_mode'),
      f('processedChangeSetId', 'processed_change_set_id'),
      f('processedAt', 'processed_at', 'time'),
    ],
    references: [],
  },
  {
    entityType: 'SELF_MEDIA_CONTENT',
    table: 'self_media_contents',
    fields: [
      f('categoryId', 'category_id'),
      f('title', 'title'),
      f('idea', 'idea'),
      f('script', 'script'),
      f('contentType', 'content_type'),
      f('platform', 'platform'),
      f('productionStatus', 'production_status'),
      f('plannedPublishAt', 'planned_publish_at', 'time'),
      f('publishedAt', 'published_at', 'time'),
      f('calendarEventId', 'calendar_event_id'),
      f('taskId', 'task_id'),
    ],
    references: [
      category('SELF_MEDIA'),
      ref('calendarEventId', 'events', 'EVENT_UNAVAILABLE'),
      ref('taskId', 'tasks', 'TASK_UNAVAILABLE'),
    ],
  },
  {
    entityType: 'DEV_PROJECT',
    table: 'dev_projects',
    fields: [
      f('categoryId', 'category_id'),
      f('name', 'name'),
      f('summary', 'summary'),
      f('status', 'status'),
      f('startDate', 'start_date'),
      f('targetDate', 'target_date'),
      f('planId', 'plan_id'),
    ],
    references: [category('DEVELOPMENT'), ref('planId', 'plans', 'PLAN_UNAVAILABLE')],
  },
  {
    entityType: 'LEARNING_RESOURCE',
    table: 'learning_resources',
    fields: [
      f('categoryId', 'category_id'),
      f('title', 'title'),
      f('resourceType', 'resource_type'),
      f('author', 'author'),
      f('sourceUrl', 'source_url'),
      f('status', 'status'),
      f('progressCurrent', 'progress_current'),
      f('progressTotal', 'progress_total'),
      f('progressUnit', 'progress_unit'),
      f('startedAt', 'started_at', 'time'),
      f('completedAt', 'completed_at', 'time'),
    ],
    references: [category('LEARNING')],
  },
  {
    entityType: 'SHOPPING_ITEM',
    table: 'shopping_items',
    fields: [
      f('categoryId', 'category_id'),
      f('name', 'name'),
      f('productCategory', 'product_category'),
      f('quantity', 'quantity'),
      f('unit', 'unit'),
      f('plannedUnitPriceMinor', 'planned_unit_price_minor'),
      f('budgetAmountMinor', 'budget_amount_minor'),
      f('priority', 'priority'),
      f('status', 'status'),
      f('purchaseChannel', 'purchase_channel'),
      f('taskId', 'task_id'),
    ],
    references: [category('SHOPPING'), ref('taskId', 'tasks', 'TASK_UNAVAILABLE')],
  },
  {
    entityType: 'RECIPE',
    table: 'recipes',
    fields: [
      f('categoryId', 'category_id'),
      f('name', 'name'),
      f('description', 'description'),
      f('servings', 'servings'),
      f('caloriesKcal', 'calories_kcal'),
      f('proteinG', 'protein_g'),
      f('carbsG', 'carbs_g'),
      f('fatG', 'fat_g'),
    ],
    references: [category('DIET')],
  },
  {
    entityType: 'WORKOUT_PLAN',
    table: 'workout_plans',
    fields: [
      f('categoryId', 'category_id'),
      f('name', 'name'),
      f('description', 'description'),
      f('goalId', 'goal_id'),
      f('status', 'status'),
    ],
    references: [category('FITNESS'), ref('goalId', 'goals', 'GOAL_UNAVAILABLE')],
  },
  {
    entityType: 'ENTERTAINMENT_ITEM',
    table: 'entertainment_items',
    fields: [
      f('categoryId', 'category_id'),
      f('title', 'title'),
      f('itemType', 'item_type'),
      f('listType', 'list_type'),
      f('status', 'status'),
      f('progressCurrent', 'progress_current'),
      f('progressTotal', 'progress_total'),
      f('progressUnit', 'progress_unit'),
      f('startedAt', 'started_at', 'time'),
      f('completedAt', 'completed_at', 'time'),
      f('rating', 'rating'),
      f('note', 'note'),
    ],
    references: [category('ENTERTAINMENT')],
  },
];

const decode = (value: unknown, kind: FieldKind = 'plain'): unknown => {
  if (value === null) return null;
  if (kind === 'boolean') return value === 1;
  if (kind === 'time') return new Date(value as number).toISOString();
  if (kind === 'json') return JSON.parse(value as string) as unknown;
  return value;
};

const encode = (value: unknown, kind: FieldKind = 'plain'): unknown => {
  if (value === null || value === undefined) return null;
  if (kind === 'boolean') return value === true ? 1 : 0;
  if (kind === 'time') {
    if (typeof value !== 'string' && typeof value !== 'number')
      throw new Error('CANONICAL_SNAPSHOT_INVALID');
    const timestamp = Date.parse(String(value));
    if (!Number.isFinite(timestamp)) throw new Error('CANONICAL_SNAPSHOT_INVALID');
    return timestamp;
  }
  if (kind === 'json') return JSON.stringify(value);
  return value;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('CANONICAL_SNAPSHOT_INVALID');
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

export class CanonicalHistoryRepository {
  private readonly adapters = new Map<string, CanonicalSnapshotAdapter>();

  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    private readonly recorder: ConsistencyRepository = new ConsistencyRepository(database, clock),
  ) {
    for (const definition of definitions) {
      this.adapters.set(definition.entityType, this.createAdapter(definition));
    }
  }

  public supportedEntityTypes(): readonly string[] {
    return [...this.adapters.keys()];
  }

  public supports(entityType: string): boolean {
    return this.adapters.has(entityType);
  }

  public captureCurrentState(entityId: string): CanonicalEntitySnapshot<Record<string, unknown>> {
    const entity = this.requireEntity(entityId);
    return this.requireAdapter(entity.entity_type).captureCurrentState(entityId);
  }

  public captureStoredState(entityId: string): CanonicalEntitySnapshot<Record<string, unknown>> {
    const entity = this.database.raw
      .prepare('SELECT entity_type FROM entity_index WHERE id=?')
      .get(entityId) as { entity_type: string } | undefined;
    if (entity === undefined) throw new Error('ENTITY_NOT_FOUND');
    return this.requireAdapter(entity.entity_type).captureCurrentState(entityId);
  }

  public recordCreate(entityId: string, context: OperationContext, summary: string): string {
    const entity = this.requireEntity(entityId);
    if (entity.version !== 1) throw new Error('CREATE_VERSION_INVALID');
    const snapshot = this.captureCurrentState(entityId);
    return this.recorder.recordChange({
      context,
      summary,
      riskLevel: 'LOW_WRITE',
      changes: [
        {
          entityId,
          entityVersion: 1,
          operation: 'CREATE',
          after: snapshot,
          canonicalSnapshot: snapshot,
        },
      ],
    });
  }

  public recordUpdate(
    entityId: string,
    before: CanonicalEntitySnapshot,
    context: OperationContext,
    summary: string,
  ): string {
    const entity = this.requireEntity(entityId);
    const after = this.captureCurrentState(entityId);
    return this.recorder.recordChange({
      context,
      summary,
      riskLevel: 'LOW_WRITE',
      changes: [
        {
          entityId,
          entityVersion: entity.version,
          operation: 'UPDATE',
          before,
          after,
          canonicalSnapshot: after,
        },
      ],
    });
  }

  public recordLifecycleChange(input: {
    readonly entityId: string;
    readonly before: CanonicalEntitySnapshot;
    readonly context: OperationContext;
    readonly summary: string;
    readonly operation: 'SOFT_DELETE' | 'RESTORE';
  }): string {
    const entity = this.database.raw
      .prepare('SELECT version FROM entity_index WHERE id=?')
      .get(input.entityId) as { version: number } | undefined;
    if (entity === undefined) throw new Error('ENTITY_NOT_FOUND');
    const after = this.captureStoredState(input.entityId);
    return this.recorder.recordChange({
      context: input.context,
      summary: input.summary,
      riskLevel: 'LOW_WRITE',
      changes: [
        {
          entityId: input.entityId,
          entityVersion: entity.version,
          operation: input.operation,
          before: input.before,
          after,
          canonicalSnapshot: after,
        },
      ],
    });
  }

  public versions(entityId: string): readonly CanonicalHistoryVersion[] {
    return (
      this.database.raw
        .prepare(
          `SELECT version.entity_version,version.source,version.snapshot_json,version.patch_json,version.created_at,
                  version.change_set_id,change_set.summary
           FROM entity_versions version LEFT JOIN change_sets change_set ON change_set.id=version.change_set_id
           WHERE version.entity_id=? ORDER BY version.entity_version DESC`,
        )
        .all(entityId) as {
        entity_version: number;
        source: string;
        snapshot_json: string | null;
        patch_json: string;
        created_at: number;
        change_set_id: string | null;
        summary: string | null;
      }[]
    ).map((row) => {
      const metadata = JSON.parse(row.patch_json) as unknown;
      const trusted = isTrustedCanonicalSnapshotMetadata(metadata);
      const kind = trusted
        ? ((metadata as { snapshotKind: 'BASELINE' | 'CANONICAL' }).snapshotKind as HistoryKind)
        : 'AUDIT_ONLY';
      return {
        entityVersion: row.entity_version,
        source: row.source,
        snapshot: row.snapshot_json === null ? null : (JSON.parse(row.snapshot_json) as unknown),
        createdAt: new Date(row.created_at).toISOString(),
        changeSetId: row.change_set_id,
        summary: row.summary,
        historyKind: kind,
        restoreEligibility: trusted ? 'ELIGIBLE' : 'UNVERIFIED',
      };
    });
  }

  public previewRestore(
    entityId: string,
    targetVersion: number,
    expectedVersion: number,
  ): {
    readonly entityId: string;
    readonly entityType: string;
    readonly expectedVersion: number;
    readonly targetVersion: number;
    readonly conflicts: readonly RestoreConflict[];
    readonly changes: readonly { field: string; before: unknown; after: unknown }[];
  } {
    const currentEntity = this.requireEntity(entityId);
    if (currentEntity.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const target = this.requireTrustedVersion(entityId, targetVersion);
    const current = this.captureCurrentState(entityId);
    const adapter = this.requireAdapter(currentEntity.entity_type);
    const conflicts = this.validateForEntity(entityId, adapter, target);
    return {
      entityId,
      entityType: currentEntity.entity_type,
      expectedVersion,
      targetVersion,
      conflicts,
      changes: this.diff(current, target),
    };
  }

  public restoreVersion(input: {
    readonly entityId: string;
    readonly targetVersion: number;
    readonly expectedVersion: number;
    readonly context: OperationContext;
    readonly summary?: string;
  }): { readonly changeSetId: string; readonly entityVersion: number } {
    return this.database.transaction(() => {
      const entity = this.requireEntity(input.entityId);
      if (entity.version !== input.expectedVersion) throw new Error('VERSION_CONFLICT');
      const adapter = this.requireAdapter(entity.entity_type);
      const target = this.requireTrustedVersion(input.entityId, input.targetVersion);
      const before = adapter.captureCurrentState(input.entityId);
      const conflicts = this.validateForEntity(input.entityId, adapter, target);
      if (conflicts.length > 0) {
        throw new Error(`RESTORE_CONFLICT:${conflicts.map((item) => item.code).join(',')}`);
      }
      adapter.applyCanonicalState(input.entityId, target);
      adapter.restoreOwnedRelations(input.entityId, target);
      const entityVersion = input.expectedVersion + 1;
      this.database.raw
        .prepare('UPDATE entity_index SET version=?,updated_at=? WHERE id=?')
        .run(entityVersion, this.clock.now().getTime(), input.entityId);
      const after = adapter.captureCurrentState(input.entityId);
      const changeSetId = this.recorder.recordChange({
        context: input.context,
        summary: input.summary ?? `RestoredToVersion${String(input.targetVersion)}`,
        riskLevel: 'LOW_WRITE',
        changes: [
          {
            entityId: input.entityId,
            entityVersion,
            operation: 'RESTORE',
            before,
            after,
            canonicalSnapshot: after,
          },
        ],
      });
      adapter.rebuildDerivedState(input.entityId, before, after, entityVersion);
      return { changeSetId, entityVersion };
    });
  }

  public undoChangeSet(input: {
    readonly changeSetId: string;
    readonly context: OperationContext;
  }): { readonly undoChangeSetId: string } {
    return this.database.transaction(() => {
      const changeSet = this.database.raw
        .prepare('SELECT source,status,summary FROM change_sets WHERE id=?')
        .get(input.changeSetId) as { source: string; status: string; summary: string } | undefined;
      if (changeSet?.source !== 'AI' || changeSet.status !== 'APPLIED')
        throw new Error('CHANGE_SET_NOT_UNDOABLE');
      const operations = this.database.raw
        .prepare(
          `SELECT operation.sequence,operation.entity_id,operation.operation,operation.before_json,
                  version.entity_version
           FROM change_operations operation
           LEFT JOIN entity_versions version
             ON version.change_set_id=operation.change_set_id AND version.entity_id=operation.entity_id
           WHERE operation.change_set_id=? ORDER BY operation.sequence DESC`,
        )
        .all(input.changeSetId) as {
        sequence: number;
        entity_id: string | null;
        operation: ChangeInput['operation'];
        before_json: string | null;
        entity_version: number | null;
      }[];
      if (
        operations.length === 0 ||
        operations.some(
          (operation) =>
            operation.entity_id === null ||
            operation.entity_version === null ||
            !['CREATE', 'UPDATE'].includes(operation.operation),
        )
      )
        throw new Error('CHANGE_SET_NOT_UNDOABLE');

      for (const operation of operations) {
        const entity = this.requireStoredEntity(String(operation.entity_id));
        if (entity.version !== operation.entity_version || entity.deleted_at !== null)
          throw new Error('VERSION_CONFLICT');
        if (operation.operation === 'UPDATE') {
          if (operation.before_json === null) throw new Error('CHANGE_SET_NOT_UNDOABLE');
          const target = JSON.parse(operation.before_json) as CanonicalEntitySnapshot;
          const conflicts = this.validateForEntity(
            String(operation.entity_id),
            this.requireAdapter(entity.entity_type),
            target,
          );
          if (conflicts.length > 0)
            throw new Error(`RESTORE_CONFLICT:${conflicts.map((item) => item.code).join(',')}`);
        }
      }

      const changes: ChangeInput[] = [];
      const rebuilds: {
        entityId: string;
        adapter: CanonicalSnapshotAdapter;
        before: CanonicalEntitySnapshot;
        after: CanonicalEntitySnapshot;
        version: number;
      }[] = [];
      const now = this.clock.now().getTime();
      for (const operation of operations) {
        const entityId = String(operation.entity_id);
        const entity = this.requireStoredEntity(entityId);
        const adapter = this.requireAdapter(entity.entity_type);
        const current = adapter.captureCurrentState(entityId);
        const version = entity.version + 1;
        if (operation.operation === 'CREATE') {
          this.database.raw
            .prepare(
              `UPDATE entity_index SET deleted_at=?,purge_after=?,updated_at=?,version=? WHERE id=?`,
            )
            .run(now, now + 30 * 86_400_000, now, version, entityId);
          const after = this.captureStoredState(entityId);
          changes.push({
            entityId,
            entityVersion: version,
            operation: 'SOFT_DELETE',
            before: current,
            after,
            canonicalSnapshot: after,
          });
          rebuilds.push({ entityId, adapter, before: current, after, version });
          continue;
        }
        const target = JSON.parse(String(operation.before_json)) as CanonicalEntitySnapshot;
        adapter.applyCanonicalState(entityId, target);
        adapter.restoreOwnedRelations(entityId, target);
        this.database.raw
          .prepare('UPDATE entity_index SET version=?,updated_at=? WHERE id=?')
          .run(version, now, entityId);
        const after = adapter.captureCurrentState(entityId);
        changes.push({
          entityId,
          entityVersion: version,
          operation: 'RESTORE',
          before: current,
          after,
          canonicalSnapshot: after,
        });
        rebuilds.push({ entityId, adapter, before: current, after, version });
      }
      const undoChangeSetId = this.recorder.recordChange({
        context: input.context,
        summary: `Undo:${changeSet.summary}`,
        riskLevel: 'HIGH_WRITE',
        changes,
      });
      for (const rebuild of rebuilds)
        rebuild.adapter.rebuildDerivedState(
          rebuild.entityId,
          rebuild.before,
          rebuild.after,
          rebuild.version,
        );
      this.database.raw
        .prepare("UPDATE change_sets SET status='REVERTED',reverted_at=? WHERE id=?")
        .run(now, input.changeSetId);
      return { undoChangeSetId };
    });
  }

  private createAdapter(definition: AdapterDefinition): CanonicalSnapshotAdapter {
    return {
      entityType: definition.entityType,
      captureCurrentState: (entityId) => this.capture(definition, entityId),
      validateRestoreTarget: (snapshot) => this.validate(definition, snapshot),
      applyCanonicalState: (entityId, snapshot) => {
        this.apply(definition, entityId, snapshot);
      },
      restoreOwnedRelations: (entityId, snapshot) => {
        this.restoreRelations(entityId, snapshot);
      },
      rebuildDerivedState: (entityId, before, after, version) => {
        this.rebuildDerived(entityId, definition.entityType, before, after, version);
      },
    };
  }

  private capture(
    definition: AdapterDefinition,
    entityId: string,
  ): CanonicalEntitySnapshot<Record<string, unknown>> {
    const row = this.database.raw
      .prepare(
        `SELECT ${definition.fields.map((field) => field.column).join(',')} FROM ${definition.table} WHERE id=?`,
      )
      .get(entityId) as Record<string, unknown> | undefined;
    if (row === undefined) throw new Error('ENTITY_NOT_FOUND');
    const canonicalState: Record<string, unknown> = {};
    for (const field of definition.fields) {
      canonicalState[field.key] = decode(row[field.column], field.kind);
    }
    return {
      contractVersion: 1,
      entityType: definition.entityType,
      canonicalState,
      ownedRelations: this.captureRelations(entityId, definition.entityType),
    };
  }

  private commonRelations(entityId: string): Record<string, unknown> {
    const ids = (sql: string) =>
      (this.database.raw.prepare(sql).all(entityId) as { id: string }[]).map((item) => item.id);
    return {
      tagIds: ids('SELECT tag_id id FROM tag_links WHERE entity_id=? ORDER BY tag_id'),
      reminders: this.database.raw
        .prepare(
          `SELECT trigger_mode triggerMode,trigger_at triggerAt,offset_minutes offsetMinutes,is_enabled isEnabled
           FROM reminders WHERE target_entity_id=? ORDER BY id`,
        )
        .all(entityId),
      attachmentLinks: this.database.raw
        .prepare(
          'SELECT attachment_id attachmentId,role FROM attachment_links WHERE entity_id=? ORDER BY attachment_id',
        )
        .all(entityId),
    };
  }

  private captureRelations(entityId: string, entityType: string): Record<string, unknown> {
    const owned = this.commonRelations(entityId);
    if (entityType === 'TASK') {
      const ids = (sql: string) =>
        (this.database.raw.prepare(sql).all(entityId) as { id: string }[]).map((item) => item.id);
      Object.assign(owned, {
        predecessorTaskIds: ids(
          'SELECT predecessor_task_id id FROM task_dependencies WHERE successor_task_id=? ORDER BY predecessor_task_id',
        ),
        successorTaskIds: ids(
          'SELECT successor_task_id id FROM task_dependencies WHERE predecessor_task_id=? ORDER BY successor_task_id',
        ),
      });
    } else if (entityType === 'GOAL') {
      owned.goalMetrics = this.database.raw
        .prepare(
          `SELECT id,name,metric_type metricType,unit,start_value startValue,target_value targetValue,direction,weight
           FROM goal_metrics WHERE goal_id=? ORDER BY id`,
        )
        .all(entityId);
      owned.goalProgressEntries = this.database.raw
        .prepare(
          `SELECT id,metric_id metricId,value,recorded_at recordedAt,source,source_entity_id sourceEntityId,note
           FROM goal_progress_entries WHERE goal_id=? ORDER BY recorded_at,id`,
        )
        .all(entityId);
    } else if (entityType === 'PLAN') {
      const milestones = this.database.raw
        .prepare(
          `SELECT milestone.id,milestone.title,milestone.description,milestone.due_at dueAt,milestone.status,milestone.achieved_at achievedAt
           FROM milestones milestone JOIN entity_index entity ON entity.id=milestone.id AND entity.deleted_at IS NULL
           WHERE milestone.plan_id=? ORDER BY milestone.id`,
        )
        .all(entityId) as Record<string, unknown>[];
      owned.milestones = milestones.map((milestone) => ({
        ...milestone,
        linkedEntityIds: (
          this.database.raw
            .prepare(
              'SELECT entity_id id FROM milestone_links WHERE milestone_id=? ORDER BY entity_id',
            )
            .all(milestone.id) as { id: string }[]
        ).map((item) => item.id),
      }));
    } else if (entityType === 'EVENT') {
      const rule = this.database.raw
        .prepare(
          `SELECT rule.id,rule.rrule,rule.dtstart_local dtstartLocal,rule.time_zone timeZone,rule.until_at untilAt,
                  rule.count_limit countLimit,rule.generation_horizon_days generationHorizonDays,rule.is_active isActive
           FROM recurrence_rules rule JOIN entity_index entity ON entity.id=rule.id AND entity.deleted_at IS NULL
           WHERE rule.target_entity_id=? LIMIT 1`,
        )
        .get(entityId) as Record<string, unknown> | undefined;
      owned.recurrenceRule = rule ?? null;
      owned.recurrenceExceptions =
        rule === undefined
          ? []
          : this.database.raw
              .prepare(
                `SELECT id,recurrence_key recurrenceKey,exception_type exceptionType,override_json overrideJson
                 FROM recurrence_exceptions WHERE rule_id=? ORDER BY id`,
              )
              .all(rule.id);
    } else if (entityType === 'NOTE') {
      owned.workLinks = this.database.raw
        .prepare(
          'SELECT entity_id entityId,role,sort_order sortOrder FROM work_note_links WHERE note_id=? ORDER BY entity_id',
        )
        .all(entityId);
    } else if (entityType === 'LEARNING_RESOURCE') {
      owned.planLinks = this.database.raw
        .prepare(
          'SELECT plan_id planId,sort_order sortOrder FROM learning_plan_resources WHERE resource_id=? ORDER BY plan_id',
        )
        .all(entityId);
    } else if (entityType === 'RECIPE') {
      owned.ingredients = this.database.raw
        .prepare(
          'SELECT id,name,amount,unit,sort_order sortOrder FROM recipe_ingredients WHERE recipe_id=? ORDER BY sort_order,id',
        )
        .all(entityId);
    } else if (entityType === 'WORKOUT_PLAN') {
      owned.items = this.database.raw
        .prepare(
          `SELECT id,exercise_id exerciseId,sets_target setsTarget,reps_target repsTarget,weight_target weightTarget,
                  duration_seconds_target durationSecondsTarget,distance_target distanceTarget,sort_order sortOrder
           FROM workout_plan_items WHERE workout_plan_id=? ORDER BY sort_order,id`,
        )
        .all(entityId);
    } else if (entityType === 'ENTERTAINMENT_ITEM') {
      owned.tripDetail =
        this.database.raw
          .prepare(
            `SELECT start_at startAt,end_at endAt,location,event_id eventId,task_id taskId,details_json detailsJson
             FROM activity_trip_details WHERE entertainment_item_id=?`,
          )
          .get(entityId) ?? null;
    } else if (entityType === 'INBOX_ITEM') {
      owned.results = this.database.raw
        .prepare(
          `SELECT entity_id entityId,result_type resultType,created_at createdAt
           FROM inbox_item_results WHERE inbox_item_id=? ORDER BY created_at,entity_id`,
        )
        .all(entityId);
    }
    return owned;
  }

  private validate(
    definition: AdapterDefinition,
    snapshot: CanonicalEntitySnapshot,
  ): readonly RestoreConflict[] {
    if (snapshot.entityType !== definition.entityType)
      throw new Error('CANONICAL_SNAPSHOT_INVALID');
    const state = asRecord(snapshot.canonicalState);
    const owned = asRecord(snapshot.ownedRelations);
    const conflicts: RestoreConflict[] = [];
    for (const reference of definition.references) {
      const value = state[reference.key];
      if (value === null || value === undefined || typeof value !== 'string') continue;
      if (reference.table === 'categories') {
        const row = this.database.raw
          .prepare('SELECT module_type,is_archived FROM categories WHERE id=?')
          .get(value) as { module_type: string; is_archived: number } | undefined;
        if (
          row === undefined ||
          row.is_archived === 1 ||
          (reference.categoryModule !== undefined && row.module_type !== reference.categoryModule)
        ) {
          conflicts.push({ code: reference.conflict, referenceId: value });
        }
      } else if (!this.activeReference(reference.table, value)) {
        conflicts.push({ code: reference.conflict, referenceId: value });
      }
    }
    for (const tagId of asArray(owned.tagIds)) {
      if (!this.activeReference('tags', String(tagId)))
        conflicts.push({ code: 'TAG_UNAVAILABLE', referenceId: String(tagId) });
    }
    for (const linkValue of asArray(owned.attachmentLinks)) {
      const link = asRecord(linkValue);
      if (!this.activeReference('attachments', String(link.attachmentId)))
        conflicts.push({
          code: 'ATTACHMENT_UNAVAILABLE',
          referenceId: String(link.attachmentId),
        });
    }
    if (definition.entityType === 'TASK') {
      const categoryRow = this.database.raw
        .prepare('SELECT parent_area FROM categories WHERE id=?')
        .get(state.categoryId) as { parent_area: string } | undefined;
      if (categoryRow !== undefined && categoryRow.parent_area !== state.preferredArea)
        conflicts.push({ code: 'CATEGORY_AREA_MISMATCH', referenceId: String(state.categoryId) });
      if (typeof state.parentTaskId === 'string') {
        const parent = this.database.raw
          .prepare('SELECT parent_task_id FROM tasks WHERE id=?')
          .get(state.parentTaskId) as { parent_task_id: string | null } | undefined;
        if (parent !== undefined && parent.parent_task_id !== null)
          conflicts.push({ code: 'PARENT_TASK_DEPTH_CONFLICT', referenceId: state.parentTaskId });
      }
      for (const taskId of [
        ...asArray(owned.predecessorTaskIds),
        ...asArray(owned.successorTaskIds),
      ]) {
        if (!this.activeReference('tasks', String(taskId)))
          conflicts.push({ code: 'DEPENDENCY_TASK_UNAVAILABLE', referenceId: String(taskId) });
      }
      if (conflicts.length === 0 && this.wouldCreateTaskCycle(state, owned))
        conflicts.push({ code: 'TASK_DEPENDENCY_CYCLE' });
    }
    if (definition.entityType === 'PLAN') {
      for (const milestoneValue of asArray(owned.milestones)) {
        const milestone = asRecord(milestoneValue);
        if (!this.storedReference('milestones', String(milestone.id)))
          conflicts.push({ code: 'MILESTONE_UNAVAILABLE', referenceId: String(milestone.id) });
        for (const linkedEntityId of asArray(milestone.linkedEntityIds)) {
          if (!this.activeReference('entity_index', String(linkedEntityId)))
            conflicts.push({
              code: 'MILESTONE_LINK_TARGET_UNAVAILABLE',
              referenceId: String(linkedEntityId),
            });
        }
      }
    }
    if (definition.entityType === 'EVENT') {
      const ruleValue = owned.recurrenceRule;
      if (ruleValue !== null && ruleValue !== undefined) {
        const rule = asRecord(ruleValue);
        if (!this.storedReference('recurrence_rules', String(rule.id)))
          conflicts.push({ code: 'RECURRENCE_RULE_UNAVAILABLE', referenceId: String(rule.id) });
      }
    }
    if (definition.entityType === 'EVENT' && state.allowOverlap !== true) {
      const startAt = Date.parse(String(state.startAt));
      const endAt = Date.parse(String(state.endAt));
      const conflict = this.database.raw
        .prepare(
          `SELECT event.id FROM events event JOIN entity_index entity ON entity.id=event.id AND entity.deleted_at IS NULL
           WHERE event.id<>? AND event.status='SCHEDULED' AND event.start_at<? AND event.end_at>? LIMIT 1`,
        )
        .get(this.currentValidationEntityId, endAt, startAt) as { id: string } | undefined;
      if (conflict !== undefined)
        conflicts.push({ code: 'EVENT_SCHEDULE_CONFLICT', referenceId: conflict.id });
    }
    if (definition.entityType === 'NOTE') {
      for (const linkValue of asArray(owned.workLinks)) {
        const link = asRecord(linkValue);
        if (!this.activeEntity(String(link.entityId)))
          conflicts.push({
            code: 'WORK_LINK_TARGET_UNAVAILABLE',
            referenceId: String(link.entityId),
          });
      }
    }
    if (definition.entityType === 'LEARNING_RESOURCE') {
      for (const linkValue of asArray(owned.planLinks)) {
        const link = asRecord(linkValue);
        if (!this.activeReference('plans', String(link.planId)))
          conflicts.push({ code: 'PLAN_UNAVAILABLE', referenceId: String(link.planId) });
      }
    }
    if (definition.entityType === 'WORKOUT_PLAN') {
      for (const itemValue of asArray(owned.items)) {
        const item = asRecord(itemValue);
        if (!this.activeReference('exercise_catalog', String(item.exerciseId)))
          conflicts.push({ code: 'EXERCISE_UNAVAILABLE', referenceId: String(item.exerciseId) });
      }
    }
    if (definition.entityType === 'ENTERTAINMENT_ITEM' && owned.tripDetail !== null) {
      const detail = asRecord(owned.tripDetail);
      for (const [key, table, code] of [
        ['eventId', 'events', 'EVENT_UNAVAILABLE'],
        ['taskId', 'tasks', 'TASK_UNAVAILABLE'],
      ] as const) {
        const targetId = detail[key];
        if (typeof targetId === 'string' && !this.activeReference(table, targetId))
          conflicts.push({ code, referenceId: targetId });
      }
    }
    return conflicts;
  }

  private apply(
    definition: AdapterDefinition,
    entityId: string,
    snapshot: CanonicalEntitySnapshot,
  ): void {
    const state = asRecord(snapshot.canonicalState);
    for (const field of definition.fields) {
      if (!(field.key in state)) throw new Error('CANONICAL_SNAPSHOT_INVALID');
    }
    this.database.raw
      .prepare(
        `UPDATE ${definition.table} SET ${definition.fields.map((field) => `${field.column}=?`).join(',')} WHERE id=?`,
      )
      .run(...definition.fields.map((field) => encode(state[field.key], field.kind)), entityId);
  }

  private restoreRelations(entityId: string, snapshot: CanonicalEntitySnapshot): void {
    const owned = asRecord(snapshot.ownedRelations);
    const now = this.clock.now().getTime();
    this.database.raw.prepare('DELETE FROM tag_links WHERE entity_id=?').run(entityId);
    for (const tagId of asArray(owned.tagIds)) {
      this.database.raw
        .prepare('INSERT INTO tag_links(tag_id,entity_id,created_at) VALUES (?,?,?)')
        .run(tagId, entityId, now);
    }
    const reminderIds = this.database.raw
      .prepare('SELECT id FROM reminders WHERE target_entity_id=?')
      .all(entityId) as { id: string }[];
    for (const reminder of reminderIds)
      this.database.raw.prepare('DELETE FROM entity_index WHERE id=?').run(reminder.id);
    for (const reminderValue of asArray(owned.reminders)) {
      const reminder = asRecord(reminderValue);
      const id = ulid();
      this.database.raw
        .prepare(
          "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'REMINDER',?,?)",
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO reminders(id,target_entity_id,trigger_mode,trigger_at,offset_minutes,is_enabled)
           VALUES (?,?,?,?,?,?)`,
        )
        .run(
          id,
          entityId,
          reminder.triggerMode,
          reminder.triggerAt,
          reminder.offsetMinutes,
          reminder.isEnabled === true || reminder.isEnabled === 1 ? 1 : 0,
        );
    }
    this.database.raw.prepare('DELETE FROM attachment_links WHERE entity_id=?').run(entityId);
    for (const linkValue of asArray(owned.attachmentLinks)) {
      const link = asRecord(linkValue);
      this.database.raw
        .prepare(
          'INSERT INTO attachment_links(attachment_id,entity_id,role,created_at) VALUES (?,?,?,?)',
        )
        .run(link.attachmentId, entityId, link.role, now);
    }
    switch (snapshot.entityType) {
      case 'TASK':
        this.restoreTaskRelations(entityId, owned, now);
        break;
      case 'GOAL':
        this.replaceGoalMetrics(entityId, owned);
        this.replaceGoalProgressEntries(entityId, owned);
        break;
      case 'PLAN':
        this.restoreMilestones(entityId, owned, now);
        break;
      case 'EVENT':
        this.restoreRecurrence(entityId, owned);
        break;
      case 'NOTE':
        this.replaceWorkLinks(entityId, owned);
        break;
      case 'INBOX_ITEM':
        this.database.raw
          .prepare('DELETE FROM inbox_item_results WHERE inbox_item_id=?')
          .run(entityId);
        for (const resultValue of asArray(owned.results)) {
          const result = asRecord(resultValue);
          this.database.raw
            .prepare(
              `INSERT INTO inbox_item_results(inbox_item_id,entity_id,result_type,created_at)
               VALUES (?,?,?,?)`,
            )
            .run(entityId, result.entityId, result.resultType, result.createdAt);
        }
        break;
      case 'LEARNING_RESOURCE':
        this.replaceLearningLinks(entityId, owned);
        break;
      case 'RECIPE':
        this.replaceIngredients(entityId, owned);
        break;
      case 'WORKOUT_PLAN':
        this.replaceWorkoutItems(entityId, owned);
        break;
      case 'ENTERTAINMENT_ITEM':
        this.replaceTripDetail(entityId, owned);
        break;
    }
  }

  private restoreTaskRelations(
    entityId: string,
    owned: Record<string, unknown>,
    now: number,
  ): void {
    this.database.raw
      .prepare('DELETE FROM task_dependencies WHERE successor_task_id=? OR predecessor_task_id=?')
      .run(entityId, entityId);
    for (const predecessorId of asArray(owned.predecessorTaskIds)) {
      this.database.raw
        .prepare(
          "INSERT INTO task_dependencies(predecessor_task_id,successor_task_id,dependency_type,created_at) VALUES (?,?,'FINISH_TO_START',?)",
        )
        .run(predecessorId, entityId, now);
    }
    for (const successorId of asArray(owned.successorTaskIds)) {
      this.database.raw
        .prepare(
          "INSERT INTO task_dependencies(predecessor_task_id,successor_task_id,dependency_type,created_at) VALUES (?,?,'FINISH_TO_START',?)",
        )
        .run(entityId, successorId, now);
    }
  }

  private replaceGoalMetrics(entityId: string, owned: Record<string, unknown>): void {
    const metrics = asArray(owned.goalMetrics).map(asRecord);
    const targetIds = new Set(metrics.map((metric) => String(metric.id)));
    const current = this.database.raw
      .prepare('SELECT id FROM goal_metrics WHERE goal_id=?')
      .all(entityId) as { id: string }[];
    for (const metric of current)
      if (!targetIds.has(metric.id))
        this.database.raw.prepare('DELETE FROM goal_metrics WHERE id=?').run(metric.id);
    for (const metric of metrics) {
      this.database.raw
        .prepare(
          `INSERT INTO goal_metrics(id,goal_id,name,metric_type,unit,start_value,target_value,direction,weight)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name,metric_type=excluded.metric_type,unit=excluded.unit,
             start_value=excluded.start_value,target_value=excluded.target_value,direction=excluded.direction,weight=excluded.weight`,
        )
        .run(
          metric.id,
          entityId,
          metric.name,
          metric.metricType,
          metric.unit,
          metric.startValue,
          metric.targetValue,
          metric.direction,
          metric.weight,
        );
    }
  }

  private replaceGoalProgressEntries(entityId: string, owned: Record<string, unknown>): void {
    this.database.raw.prepare('DELETE FROM goal_progress_entries WHERE goal_id=?').run(entityId);
    const insert = this.database.raw.prepare(
      `INSERT INTO goal_progress_entries(id,goal_id,metric_id,value,recorded_at,source,source_entity_id,note)
       VALUES (?,?,?,?,?,?,?,?)`,
    );
    for (const entryValue of asArray(owned.goalProgressEntries)) {
      const entry = asRecord(entryValue);
      insert.run(
        entry.id,
        entityId,
        entry.metricId,
        entry.value,
        entry.recordedAt,
        entry.source,
        entry.sourceEntityId,
        entry.note,
      );
    }
  }

  private restoreMilestones(entityId: string, owned: Record<string, unknown>, now: number): void {
    const target = asArray(owned.milestones).map(asRecord);
    const targetIds = new Set(target.map((item) => String(item.id)));
    const current = this.database.raw
      .prepare('SELECT id FROM milestones WHERE plan_id=?')
      .all(entityId) as { id: string }[];
    for (const item of current) {
      if (!targetIds.has(item.id)) {
        this.database.raw
          .prepare('UPDATE entity_index SET deleted_at=?,purge_after=?,updated_at=? WHERE id=?')
          .run(now, now + 30 * 86_400_000, now, item.id);
      }
    }
    for (const item of target) {
      this.database.raw
        .prepare('UPDATE entity_index SET deleted_at=NULL,purge_after=NULL,updated_at=? WHERE id=?')
        .run(now, item.id);
      this.database.raw
        .prepare(
          'UPDATE milestones SET title=?,description=?,due_at=?,status=?,achieved_at=? WHERE id=? AND plan_id=?',
        )
        .run(
          item.title,
          item.description,
          item.dueAt,
          item.status,
          item.achievedAt,
          item.id,
          entityId,
        );
      this.database.raw.prepare('DELETE FROM milestone_links WHERE milestone_id=?').run(item.id);
      const insertLink = this.database.raw.prepare(
        'INSERT INTO milestone_links(milestone_id,entity_id,created_at) VALUES (?,?,?)',
      );
      for (const linkedEntityId of asArray(item.linkedEntityIds))
        insertLink.run(item.id, linkedEntityId, now);
    }
  }

  private restoreRecurrence(entityId: string, owned: Record<string, unknown>): void {
    const ruleValue = owned.recurrenceRule;
    const currentRules = this.database.raw
      .prepare('SELECT id FROM recurrence_rules WHERE target_entity_id=?')
      .all(entityId) as { id: string }[];
    if (ruleValue === null || ruleValue === undefined) {
      const now = this.clock.now().getTime();
      for (const current of currentRules)
        this.database.raw
          .prepare('UPDATE entity_index SET deleted_at=?,purge_after=?,updated_at=? WHERE id=?')
          .run(now, now + 30 * 86_400_000, now, current.id);
      return;
    }
    const rule = asRecord(ruleValue);
    const now = this.clock.now().getTime();
    for (const current of currentRules)
      if (current.id !== rule.id)
        this.database.raw
          .prepare('UPDATE entity_index SET deleted_at=?,purge_after=?,updated_at=? WHERE id=?')
          .run(now, now + 30 * 86_400_000, now, current.id);
    this.database.raw
      .prepare('UPDATE entity_index SET deleted_at=NULL,purge_after=NULL,updated_at=? WHERE id=?')
      .run(now, rule.id);
    this.database.raw
      .prepare(
        `UPDATE recurrence_rules SET rrule=?,dtstart_local=?,time_zone=?,until_at=?,count_limit=?,generation_horizon_days=?,is_active=?
         WHERE id=? AND target_entity_id=?`,
      )
      .run(
        rule.rrule,
        rule.dtstartLocal,
        rule.timeZone,
        rule.untilAt,
        rule.countLimit,
        rule.generationHorizonDays,
        rule.isActive === true || rule.isActive === 1 ? 1 : 0,
        rule.id,
        entityId,
      );
    this.database.raw.prepare('DELETE FROM recurrence_exceptions WHERE rule_id=?').run(rule.id);
    for (const exceptionValue of asArray(owned.recurrenceExceptions)) {
      const exception = asRecord(exceptionValue);
      this.database.raw
        .prepare(
          `INSERT INTO recurrence_exceptions(id,rule_id,recurrence_key,exception_type,override_json,created_at)
           VALUES (?,?,?,?,?,?)`,
        )
        .run(
          exception.id,
          rule.id,
          exception.recurrenceKey,
          exception.exceptionType,
          exception.overrideJson,
          this.clock.now().getTime(),
        );
    }
  }

  private replaceWorkLinks(entityId: string, owned: Record<string, unknown>): void {
    this.database.raw.prepare('DELETE FROM work_note_links WHERE note_id=?').run(entityId);
    for (const linkValue of asArray(owned.workLinks)) {
      const link = asRecord(linkValue);
      this.database.raw
        .prepare('INSERT INTO work_note_links(entity_id,note_id,role,sort_order) VALUES (?,?,?,?)')
        .run(link.entityId, entityId, link.role, link.sortOrder);
    }
  }

  private replaceLearningLinks(entityId: string, owned: Record<string, unknown>): void {
    this.database.raw
      .prepare('DELETE FROM learning_plan_resources WHERE resource_id=?')
      .run(entityId);
    for (const linkValue of asArray(owned.planLinks)) {
      const link = asRecord(linkValue);
      this.database.raw
        .prepare(
          'INSERT INTO learning_plan_resources(plan_id,resource_id,sort_order) VALUES (?,?,?)',
        )
        .run(link.planId, entityId, link.sortOrder);
    }
  }

  private replaceIngredients(entityId: string, owned: Record<string, unknown>): void {
    this.database.raw.prepare('DELETE FROM recipe_ingredients WHERE recipe_id=?').run(entityId);
    for (const ingredientValue of asArray(owned.ingredients)) {
      const ingredient = asRecord(ingredientValue);
      this.database.raw
        .prepare(
          'INSERT INTO recipe_ingredients(id,recipe_id,name,amount,unit,sort_order) VALUES (?,?,?,?,?,?)',
        )
        .run(
          ingredient.id,
          entityId,
          ingredient.name,
          ingredient.amount,
          ingredient.unit,
          ingredient.sortOrder,
        );
    }
  }

  private replaceWorkoutItems(entityId: string, owned: Record<string, unknown>): void {
    this.database.raw
      .prepare('DELETE FROM workout_plan_items WHERE workout_plan_id=?')
      .run(entityId);
    for (const itemValue of asArray(owned.items)) {
      const item = asRecord(itemValue);
      this.database.raw
        .prepare(
          `INSERT INTO workout_plan_items(id,workout_plan_id,exercise_id,sets_target,reps_target,weight_target,duration_seconds_target,distance_target,sort_order)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          item.id,
          entityId,
          item.exerciseId,
          item.setsTarget,
          item.repsTarget,
          item.weightTarget,
          item.durationSecondsTarget,
          item.distanceTarget,
          item.sortOrder,
        );
    }
  }

  private replaceTripDetail(entityId: string, owned: Record<string, unknown>): void {
    this.database.raw
      .prepare('DELETE FROM activity_trip_details WHERE entertainment_item_id=?')
      .run(entityId);
    if (owned.tripDetail === null || owned.tripDetail === undefined) return;
    const detail = asRecord(owned.tripDetail);
    this.database.raw
      .prepare(
        `INSERT INTO activity_trip_details(entertainment_item_id,start_at,end_at,location,event_id,task_id,details_json)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run(
        entityId,
        detail.startAt,
        detail.endAt,
        detail.location,
        detail.eventId,
        detail.taskId,
        detail.detailsJson,
      );
  }

  private rebuildDerived(
    entityId: string,
    entityType: string,
    before: CanonicalEntitySnapshot,
    after: CanonicalEntitySnapshot,
    version: number,
  ): void {
    this.database.raw.prepare('DELETE FROM search_documents WHERE entity_id=?').run(entityId);
    if (entityType === 'TASK' || entityType === 'EVENT') {
      const blocks = this.database.raw
        .prepare('SELECT id FROM schedule_blocks WHERE target_entity_id=?')
        .all(entityId) as { id: string }[];
      for (const block of blocks)
        this.database.raw.prepare('DELETE FROM entity_index WHERE id=?').run(block.id);
    }
    if (entityType === 'GOAL') this.refreshGoalProgress(entityId);
    if (entityType === 'PLAN') this.refreshPlanProgress(entityId);
    if (entityType === 'NOTE') {
      const state = asRecord(after.canonicalState);
      this.database.raw
        .prepare('UPDATE notes SET plain_text=? WHERE id=?')
        .run(state.markdownContent ?? '', entityId);
    }
    if (entityType === 'TASK') {
      const beforeState = asRecord(before.canonicalState);
      const afterState = asRecord(after.canonicalState);
      for (const planId of new Set([beforeState.planId, afterState.planId]))
        if (typeof planId === 'string') this.refreshPlanProgress(planId);
      for (const goalId of new Set([beforeState.goalId, afterState.goalId]))
        if (typeof goalId === 'string') this.refreshGoalProgress(goalId);
    }
    this.recorder.appendEvent({
      eventType: 'CANONICAL_ENTITY_RESTORED',
      aggregateId: entityId,
      aggregateVersion: version,
      payload: {
        entityType,
        rebuild: [
          'SEARCH',
          ...(entityType === 'TASK' || entityType === 'EVENT' ? ['SCHEDULE'] : []),
        ],
      },
    });
  }

  private refreshPlanProgress(planId: string): void {
    const counts = this.database.raw
      .prepare(
        `SELECT COUNT(*) total,SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) completed
         FROM tasks WHERE plan_id=? AND status<>'CANCELLED'`,
      )
      .get(planId) as { total: number; completed: number | null };
    const progress = counts.total === 0 ? 0 : ((counts.completed ?? 0) / counts.total) * 100;
    this.database.raw
      .prepare(
        `UPDATE plans SET auto_progress=?,display_progress=CASE WHEN progress_mode='AUTO' THEN ? ELSE display_progress END WHERE id=?`,
      )
      .run(progress, progress, planId);
  }

  private refreshGoalProgress(goalId: string): void {
    refreshGoalProgressValue(this.database, goalId);
  }

  private activeReference(table: string, id: string): boolean {
    return (
      this.database.raw
        .prepare(
          `SELECT resource.id FROM ${table} resource JOIN entity_index entity ON entity.id=resource.id WHERE resource.id=? AND entity.deleted_at IS NULL`,
        )
        .get(id) !== undefined
    );
  }

  private storedReference(table: string, id: string): boolean {
    return this.database.raw.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id) !== undefined;
  }

  private activeEntity(id: string): boolean {
    return (
      this.database.raw
        .prepare('SELECT id FROM entity_index WHERE id=? AND deleted_at IS NULL')
        .get(id) !== undefined
    );
  }

  private wouldCreateTaskCycle(
    state: Record<string, unknown>,
    owned: Record<string, unknown>,
  ): boolean {
    const entityId = this.currentValidationEntityId;
    if (entityId === null) return false;
    if (state.parentTaskId === entityId) return true;
    const edges = this.database.raw
      .prepare(
        'SELECT predecessor_task_id predecessor,successor_task_id successor FROM task_dependencies WHERE predecessor_task_id<>? AND successor_task_id<>?',
      )
      .all(entityId, entityId) as { predecessor: string; successor: string }[];
    for (const predecessor of asArray(owned.predecessorTaskIds))
      edges.push({ predecessor: String(predecessor), successor: entityId });
    for (const successor of asArray(owned.successorTaskIds))
      edges.push({ predecessor: entityId, successor: String(successor) });
    const graph = new Map<string, string[]>();
    for (const edge of edges)
      graph.set(edge.predecessor, [...(graph.get(edge.predecessor) ?? []), edge.successor]);
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const next of graph.get(node) ?? []) if (visit(next)) return true;
      visiting.delete(node);
      visited.add(node);
      return false;
    };
    return [...graph.keys()].some(visit);
  }

  private currentValidationEntityId: string | null = null;

  private requireTrustedVersion(entityId: string, targetVersion: number): CanonicalEntitySnapshot {
    const row = this.database.raw
      .prepare(
        'SELECT snapshot_json,patch_json FROM entity_versions WHERE entity_id=? AND entity_version=?',
      )
      .get(entityId, targetVersion) as
      { snapshot_json: string | null; patch_json: string } | undefined;
    if (row === undefined) throw new Error('ENTITY_VERSION_NOT_FOUND');
    if (!isTrustedCanonicalSnapshotMetadata(JSON.parse(row.patch_json) as unknown))
      throw new Error('ENTITY_VERSION_UNVERIFIED');
    if (row.snapshot_json === null) throw new Error('CANONICAL_SNAPSHOT_INVALID');
    const snapshot = JSON.parse(row.snapshot_json) as CanonicalEntitySnapshot;
    const entity = this.requireEntity(entityId);
    const adapter = this.requireAdapter(entity.entity_type);
    if (snapshot.entityType !== adapter.entityType) throw new Error('CANONICAL_SNAPSHOT_INVALID');
    return snapshot;
  }

  private validateForEntity(
    entityId: string,
    adapter: CanonicalSnapshotAdapter,
    snapshot: CanonicalEntitySnapshot,
  ): readonly RestoreConflict[] {
    this.currentValidationEntityId = entityId;
    try {
      return adapter.validateRestoreTarget(snapshot);
    } finally {
      this.currentValidationEntityId = null;
    }
  }

  private requireEntity(entityId: string): { entity_type: string; version: number } {
    const entity = this.database.raw
      .prepare('SELECT entity_type,version FROM entity_index WHERE id=? AND deleted_at IS NULL')
      .get(entityId) as { entity_type: string; version: number } | undefined;
    if (entity === undefined) throw new Error('ENTITY_NOT_FOUND');
    return entity;
  }

  private requireStoredEntity(entityId: string): {
    entity_type: string;
    version: number;
    deleted_at: number | null;
  } {
    const entity = this.database.raw
      .prepare('SELECT entity_type,version,deleted_at FROM entity_index WHERE id=?')
      .get(entityId) as
      { entity_type: string; version: number; deleted_at: number | null } | undefined;
    if (entity === undefined) throw new Error('ENTITY_NOT_FOUND');
    return entity;
  }

  private requireAdapter(entityType: string): CanonicalSnapshotAdapter {
    const adapter = this.adapters.get(entityType);
    if (adapter === undefined) throw new Error('ENTITY_HISTORY_UNSUPPORTED');
    return adapter;
  }

  private diff(
    before: CanonicalEntitySnapshot,
    after: CanonicalEntitySnapshot,
  ): readonly { field: string; before: unknown; after: unknown }[] {
    const beforeState = { ...asRecord(before.canonicalState), ...asRecord(before.ownedRelations) };
    const afterState = { ...asRecord(after.canonicalState), ...asRecord(after.ownedRelations) };
    return Object.keys({ ...beforeState, ...afterState })
      .filter((field) => JSON.stringify(beforeState[field]) !== JSON.stringify(afterState[field]))
      .map((field) => ({ field, before: beforeState[field], after: afterState[field] }));
  }
}

export const canonicalHistoryEntityTypes = definitions.map((definition) => definition.entityType);
