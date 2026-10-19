import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';
import type { PreferredArea, Priority } from '@life-assistant/domain';

import type { ActionRepository } from './action-repository.js';
import type { LifeRepository } from './life-repository.js';
import type { SqliteDatabase } from './sqlite-database.js';
import { CanonicalHistoryRepository } from './canonical-history-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import type { OperationContext } from './operation-context.js';

export type InboxStatus = 'UNPROCESSED' | 'PROCESSING' | 'PROCESSED' | 'ARCHIVED';
export type CaptureMode = 'INBOX_ONLY' | 'AI_PROCESS';
export type InboxResultType = 'TASK' | 'SHOPPING_ITEM' | 'GOAL';

export interface InboxResult {
  readonly entityId: string;
  readonly resultType: InboxResultType;
  readonly createdAt: string;
}

export interface InboxItem {
  readonly id: string;
  readonly rawText: string;
  readonly status: InboxStatus;
  readonly captureMode: CaptureMode;
  readonly processedChangeSetId: string | null;
  readonly processedAt: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly results: readonly InboxResult[];
}

export type ManualInboxResult =
  | {
      readonly resultType: 'TASK';
      readonly categoryId: string;
      readonly title: string;
      readonly priority: Priority;
      readonly dueAt: number;
      readonly estimatedMinutes: number;
      readonly isFlexible: boolean;
      readonly preferredArea: PreferredArea;
    }
  | {
      readonly resultType: 'SHOPPING_ITEM';
      readonly categoryId: string;
      readonly name: string;
      readonly quantity?: number | undefined;
      readonly priority?: Priority | undefined;
    }
  | {
      readonly resultType: 'GOAL';
      readonly categoryId: string;
      readonly title: string;
      readonly description?: string | undefined;
      readonly goalType: 'OUTCOME' | 'HABIT';
      readonly status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | undefined;
      readonly startDate: string;
      readonly endDate?: string | null | undefined;
    };

interface InboxRow {
  id: string;
  raw_text: string;
  status: InboxStatus;
  capture_mode: CaptureMode;
  processed_change_set_id: string | null;
  processed_at: number | null;
  version: number;
  created_at: number;
  updated_at: number;
}

export class InboxRepository {
  private readonly history: CanonicalHistoryRepository;
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    private readonly actions: ActionRepository,
    private readonly life: LifeRepository,
    consistency: ConsistencyRepository = new ConsistencyRepository(database, clock),
  ) {
    this.history = new CanonicalHistoryRepository(database, clock, consistency);
  }

  public capture(rawText: string, captureMode: CaptureMode): InboxItem {
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'INBOX_ITEM',?,?)",
        )
        .run(id, now, now);
      this.database.raw
        .prepare('INSERT INTO inbox_items(id,raw_text,capture_mode) VALUES (?,?,?)')
        .run(id, rawText.trim(), captureMode);
      this.audit(id, 1, 'InboxItemCaptured', { rawText, captureMode });
    });
    return this.require(id);
  }

  public list(status?: InboxStatus): readonly InboxItem[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at
         FROM inbox_items item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL
         WHERE (? IS NULL OR item.status=?)
         ORDER BY entity.updated_at DESC`,
      )
      .all(status ?? null, status ?? null) as InboxRow[];
    return rows.map((row) => this.map(row));
  }

  public get(id: string): InboxItem | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at
         FROM inbox_items item JOIN entity_index entity ON entity.id=item.id
         WHERE item.id=? AND entity.deleted_at IS NULL`,
      )
      .get(id) as InboxRow | undefined;
    return row === undefined ? undefined : this.map(row);
  }

  public update(id: string, expectedVersion: number, rawText: string): InboxItem {
    const current = this.require(id);
    this.assertMutable(current);
    this.assertVersion(current.version, expectedVersion);
    this.database.transaction(() => {
      this.database.raw
        .prepare('UPDATE inbox_items SET raw_text=? WHERE id=?')
        .run(rawText.trim(), id);
      const version = this.bump(id);
      this.audit(id, version, 'InboxItemUpdated', { rawText });
    });
    return this.require(id);
  }

  public processManually(
    id: string,
    expectedVersion: number,
    inputs: readonly ManualInboxResult[],
  ): InboxItem {
    return this.process(id, expectedVersion, inputs, 'USER', 'InboxItemProcessedManually');
  }

  private process(
    id: string,
    expectedVersion: number,
    inputs: readonly ManualInboxResult[],
    source: 'USER' | 'AI',
    summary: string,
  ): InboxItem {
    const current = this.require(id);
    this.assertMutable(current);
    this.assertVersion(current.version, expectedVersion);
    if (inputs.length === 0) throw new Error('INVALID_INBOX_RESULTS');
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      const changeSetId = ulid();
      this.database.raw
        .prepare(
          `INSERT INTO change_sets(id,source,summary,risk_level,status,created_at,applied_at)
           VALUES (?,?,?,'LOW_WRITE','APPLIED',?,?)`,
        )
        .run(changeSetId, source, summary, now, now);
      for (const input of inputs) {
        const entity =
          input.resultType === 'TASK'
            ? this.actions.createTask(input)
            : input.resultType === 'GOAL'
              ? this.actions.createGoal(input)
              : this.life.createShoppingItem({
                  categoryId: input.categoryId,
                  name: input.name,
                  quantity: input.quantity ?? 1,
                  priority: input.priority ?? 'NORMAL',
                });
        this.database.raw
          .prepare(
            'INSERT INTO inbox_item_results(inbox_item_id,entity_id,result_type,created_at) VALUES (?,?,?,?)',
          )
          .run(id, entity.id, input.resultType, now);
      }
      this.database.raw
        .prepare(
          `UPDATE inbox_items SET status='PROCESSED',processed_change_set_id=?,processed_at=? WHERE id=?`,
        )
        .run(changeSetId, now, id);
      const version = this.bump(id);
      this.audit(id, version, summary, { resultCount: inputs.length }, source);
    });
    return this.require(id);
  }

  public processByAi(
    id: string,
    expectedVersion: number,
    inputs: readonly ManualInboxResult[],
    context?: OperationContext,
  ): InboxItem {
    const current = this.require(id);
    if (current.captureMode !== 'AI_PROCESS') throw new Error('INBOX_ITEM_NOT_AI_PROCESS');
    if (context?.activeChangeSetId === undefined)
      return this.process(id, expectedVersion, inputs, 'AI', 'InboxItemProcessedByAi');
    if (inputs.length === 0) throw new Error('INVALID_INBOX_RESULTS');
    const now = this.clock.now().getTime();
    return this.database.transaction(() => {
      const before = this.history.captureCurrentState(id);
      for (const input of inputs) {
        const entity =
          input.resultType === 'TASK'
            ? this.actions.createTask(input, context)
            : input.resultType === 'GOAL'
              ? this.actions.createGoal(input, context)
              : this.life.createShoppingItem(
                  {
                    categoryId: input.categoryId,
                    name: input.name,
                    quantity: input.quantity ?? 1,
                    priority: input.priority ?? 'NORMAL',
                  },
                  context,
                );
        this.database.raw
          .prepare(
            'INSERT INTO inbox_item_results(inbox_item_id,entity_id,result_type,created_at) VALUES (?,?,?,?)',
          )
          .run(id, entity.id, input.resultType, now);
      }
      this.database.raw
        .prepare(
          `UPDATE inbox_items SET status='PROCESSED',processed_change_set_id=?,processed_at=? WHERE id=?`,
        )
        .run(context.activeChangeSetId, now, id);
      this.bump(id);
      this.history.recordUpdate(id, before, context, 'InboxItemProcessedByAi');
      return this.require(id);
    });
  }

  public archive(id: string, expectedVersion: number): InboxItem {
    const current = this.require(id);
    this.assertVersion(current.version, expectedVersion);
    if (current.status === 'ARCHIVED') return current;
    this.database.transaction(() => {
      this.database.raw.prepare("UPDATE inbox_items SET status='ARCHIVED' WHERE id=?").run(id);
      const version = this.bump(id);
      this.audit(id, version, 'InboxItemArchived', {});
    });
    return this.require(id);
  }

  private require(id: string): InboxItem {
    const value = this.get(id);
    if (value === undefined) throw new Error('INBOX_ITEM_NOT_FOUND');
    return value;
  }

  private map(row: InboxRow): InboxItem {
    const results = this.database.raw
      .prepare(
        'SELECT entity_id,result_type,created_at FROM inbox_item_results WHERE inbox_item_id=? ORDER BY created_at,entity_id',
      )
      .all(row.id) as { entity_id: string; result_type: InboxResultType; created_at: number }[];
    return {
      id: row.id,
      rawText: row.raw_text,
      status: row.status,
      captureMode: row.capture_mode,
      processedChangeSetId: row.processed_change_set_id,
      processedAt: row.processed_at === null ? null : new Date(row.processed_at).toISOString(),
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      results: results.map((result) => ({
        entityId: result.entity_id,
        resultType: result.result_type,
        createdAt: new Date(result.created_at).toISOString(),
      })),
    };
  }

  private bump(id: string): number {
    this.database.raw
      .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
      .run(this.clock.now().getTime(), id);
    return (
      this.database.raw.prepare('SELECT version FROM entity_index WHERE id=?').get(id) as {
        version: number;
      }
    ).version;
  }

  private audit(
    id: string,
    version: number,
    event: string,
    snapshot: unknown,
    source: 'USER' | 'AI' = 'USER',
  ): void {
    const now = this.clock.now().getTime();
    const changeSetId = ulid();
    this.database.raw
      .prepare(
        `INSERT INTO change_sets(id,source,summary,risk_level,status,created_at,applied_at)
         VALUES (?,?,?,'LOW_WRITE','APPLIED',?,?)`,
      )
      .run(changeSetId, source, event, now, now);
    this.database.raw
      .prepare(
        `INSERT INTO entity_versions(id,entity_id,entity_version,change_set_id,source,snapshot_json,patch_json,created_at)
         VALUES (?,?,?,?, ?,?,'{}',?)`,
      )
      .run(ulid(), id, version, changeSetId, source, JSON.stringify(snapshot), now);
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) throw new Error('VERSION_CONFLICT');
  }

  private assertMutable(item: InboxItem): void {
    if (item.status === 'PROCESSED' || item.status === 'ARCHIVED') {
      throw new Error('INVALID_INBOX_STATUS');
    }
  }
}
