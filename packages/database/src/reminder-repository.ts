import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';
import { ConsistencyRepository } from './consistency-repository.js';
import type { OperationContext } from './operation-context.js';

export interface ReminderRecord {
  readonly id: string;
  readonly targetEntityId: string;
  readonly targetEntityType: 'TASK' | 'EVENT';
  readonly triggerMode: 'ABSOLUTE' | 'OFFSET_BEFORE_START' | 'OFFSET_BEFORE_DUE';
  readonly triggerAt: string | null;
  readonly offsetMinutes: number | null;
  readonly isEnabled: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateReminderInput {
  readonly targetEntityId: string;
  readonly triggerMode: 'ABSOLUTE' | 'OFFSET_BEFORE_START' | 'OFFSET_BEFORE_DUE';
  readonly triggerAt?: string | null;
  readonly offsetMinutes?: number | null;
}

interface ReminderRow {
  id: string;
  target_entity_id: string;
  entity_type: string;
  trigger_mode: string;
  trigger_at: number | null;
  offset_minutes: number | null;
  is_enabled: number;
  version: number;
  created_at: number;
  updated_at: number;
}

const assertReminderShape = (input: CreateReminderInput): void => {
  if (input.triggerMode === 'ABSOLUTE' && (input.triggerAt ?? null) === null)
    throw new Error('INVALID_REMINDER');
  if (input.triggerMode !== 'ABSOLUTE' && (input.offsetMinutes ?? null) === null)
    throw new Error('INVALID_REMINDER');
  if (input.triggerMode !== 'ABSOLUTE' && (input.offsetMinutes ?? 0) < 1)
    throw new Error('INVALID_REMINDER');
};

export class ReminderRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    private readonly consistency: ConsistencyRepository = new ConsistencyRepository(
      database,
      clock,
    ),
  ) {}

  public create(input: CreateReminderInput, context?: OperationContext): ReminderRecord {
    assertReminderShape(input);
    void this.resolveTarget(input.targetEntityId);
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'REMINDER', ?, ?)`,
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO reminders(id, target_entity_id, trigger_mode, trigger_at, offset_minutes, is_enabled)
           VALUES (?, ?, ?, ?, ?, 1)`,
        )
        .run(
          id,
          input.targetEntityId,
          input.triggerMode,
          input.triggerMode === 'ABSOLUTE' ? Date.parse(input.triggerAt ?? '') : null,
          input.triggerMode === 'ABSOLUTE' ? null : (input.offsetMinutes ?? null),
        );
    });
    const created = this.get(id);
    if (created === undefined) throw new Error('REMINDER_NOT_FOUND');
    if (context !== undefined) {
      this.consistency.recordChange({
        context,
        summary: 'ReminderCreated',
        riskLevel: 'LOW_WRITE',
        changes: [
          { entityId: id, entityVersion: created.version, operation: 'CREATE', after: created },
        ],
      });
    }
    return created;
  }

  public list(targetEntityId?: string): readonly ReminderRecord[] {
    const rows =
      targetEntityId === undefined
        ? (this.database.raw
            .prepare(
              `SELECT r.*, e.entity_type, e.version, e.created_at, e.updated_at
               FROM reminders r JOIN entity_index e ON e.id = r.id
               WHERE e.deleted_at IS NULL
               ORDER BY e.created_at`,
            )
            .all() as ReminderRow[])
        : (this.database.raw
            .prepare(
              `SELECT r.*, e.entity_type, e.version, e.created_at, e.updated_at
               FROM reminders r JOIN entity_index e ON e.id = r.id
               WHERE e.deleted_at IS NULL AND r.target_entity_id = ?
               ORDER BY e.created_at`,
            )
            .all(targetEntityId) as ReminderRow[]);
    return rows.map((row) => {
      const target = this.resolveTarget(row.target_entity_id);
      return this.map(row, target.entityType);
    });
  }

  public get(id: string): ReminderRecord | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT r.*, e.entity_type, e.version, e.created_at, e.updated_at
         FROM reminders r JOIN entity_index e ON e.id = r.id
         WHERE r.id = ? AND e.deleted_at IS NULL`,
      )
      .get(id) as ReminderRow | undefined;
    if (row === undefined) return undefined;
    const target = this.resolveTarget(row.target_entity_id);
    return this.map(row, target.entityType);
  }

  public update(
    id: string,
    expectedVersion: number,
    patch: {
      triggerMode?: 'ABSOLUTE' | 'OFFSET_BEFORE_START' | 'OFFSET_BEFORE_DUE';
      triggerAt?: string | null;
      offsetMinutes?: number | null;
      isEnabled?: boolean;
    },
  ): ReminderRecord {
    const current = this.get(id);
    if (current === undefined) throw new Error('REMINDER_NOT_FOUND');
    this.assertVersion(current.version, expectedVersion);
    const triggerMode = patch.triggerMode ?? current.triggerMode;
    const triggerAt = patch.triggerAt === undefined ? current.triggerAt : patch.triggerAt;
    const offsetMinutes =
      patch.offsetMinutes === undefined ? current.offsetMinutes : patch.offsetMinutes;
    if (triggerMode === 'ABSOLUTE' && triggerAt === null) throw new Error('INVALID_REMINDER');
    if (triggerMode !== 'ABSOLUTE' && (offsetMinutes ?? 0) < 1) throw new Error('INVALID_REMINDER');
    const isEnabled = patch.isEnabled ?? current.isEnabled;
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `UPDATE reminders
           SET trigger_mode = ?, trigger_at = ?, offset_minutes = ?, is_enabled = ?
           WHERE id = ?`,
        )
        .run(
          triggerMode,
          triggerMode === 'ABSOLUTE' ? Date.parse(triggerAt ?? '') : null,
          triggerMode === 'ABSOLUTE' ? null : offsetMinutes,
          isEnabled ? 1 : 0,
          id,
        );
      this.database.raw
        .prepare('UPDATE entity_index SET version = version + 1, updated_at = ? WHERE id = ?')
        .run(now, id);
    });
    const updated = this.get(id);
    if (updated === undefined) throw new Error('REMINDER_NOT_FOUND');
    return updated;
  }

  public remove(id: string, expectedVersion: number): void {
    const current = this.get(id);
    if (current === undefined) throw new Error('REMINDER_NOT_FOUND');
    this.assertVersion(current.version, expectedVersion);
    this.database.transaction(() => {
      this.database.raw
        .prepare('UPDATE entity_index SET deleted_at = ? WHERE id = ?')
        .run(this.clock.now().getTime(), id);
      this.database.raw.prepare('UPDATE reminders SET is_enabled = 0 WHERE id = ?').run(id);
    });
  }

  private resolveTarget(targetEntityId: string): { entityType: 'TASK' | 'EVENT' } {
    const row = this.database.raw
      .prepare(
        `SELECT entity_type FROM entity_index
         WHERE id = ? AND deleted_at IS NULL AND entity_type IN ('TASK','EVENT')`,
      )
      .get(targetEntityId) as { entity_type: string } | undefined;
    if (row === undefined) throw new Error('REMINDER_TARGET_NOT_FOUND');
    return { entityType: row.entity_type === 'TASK' ? 'TASK' : 'EVENT' };
  }

  private assertVersion(current: number, expected: number): void {
    if (current !== expected) throw new Error('VERSION_CONFLICT');
  }

  private map(row: ReminderRow, targetEntityType: 'TASK' | 'EVENT'): ReminderRecord {
    return {
      id: row.id,
      targetEntityId: row.target_entity_id,
      targetEntityType,
      triggerMode: row.trigger_mode as ReminderRecord['triggerMode'],
      triggerAt: row.trigger_at === null ? null : new Date(row.trigger_at).toISOString(),
      offsetMinutes: row.offset_minutes,
      isEnabled: row.is_enabled === 1,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
