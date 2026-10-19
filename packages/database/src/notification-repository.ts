import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';

export interface NotificationRecord {
  readonly id: string;
  readonly notificationType: 'REMINDER' | 'SYSTEM' | 'AI_SUGGESTION' | 'SCHEDULE_WARNING';
  readonly targetEntityId: string | null;
  readonly targetEntityType: string | null;
  readonly title: string;
  readonly body: string;
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readonly scheduledAt: string;
  readonly deliveredAt: string | null;
  readonly readAt: string | null;
  readonly snoozedUntil: string | null;
}

interface NotificationRow {
  id: string;
  notification_type: NotificationRecord['notificationType'];
  target_entity_id: string | null;
  target_entity_type: string | null;
  title: string;
  body: string;
  severity: NotificationRecord['severity'];
  scheduled_at: number;
  delivered_at: number | null;
  read_at: number | null;
  snoozed_until: number | null;
}

export class NotificationRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}
  public record(
    input: Omit<
      NotificationRecord,
      'id' | 'deliveredAt' | 'readAt' | 'snoozedUntil' | 'targetEntityType'
    > & {
      deliveredAt?: string | null;
      dedupeKey?: string | null;
    },
  ): NotificationRecord {
    const id = ulid();
    const now = this.clock.now().getTime();
    const dedupeKey = input.dedupeKey ?? null;
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'NOTIFICATION',?,?)`,
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO notifications(id,notification_type,target_entity_id,title,body,severity,scheduled_at,delivered_at,read_at,snoozed_until,dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          id,
          input.notificationType,
          input.targetEntityId,
          input.title,
          input.body,
          input.severity,
          Date.parse(input.scheduledAt),
          input.deliveredAt === undefined
            ? now
            : input.deliveredAt === null
              ? null
              : Date.parse(input.deliveredAt),
          null,
          null,
          dedupeKey,
        );
    });
    const result = this.get(id);
    if (result === undefined) throw new Error('NOTIFICATION_NOT_FOUND');
    return result;
  }
  public list(): readonly NotificationRecord[] {
    return (
      this.database.raw
        .prepare(
          `SELECT n.*,target.entity_type target_entity_type FROM notifications n JOIN entity_index e ON e.id=n.id LEFT JOIN entity_index target ON target.id=n.target_entity_id AND target.deleted_at IS NULL WHERE e.deleted_at IS NULL ORDER BY n.read_at IS NULL DESC,n.scheduled_at DESC`,
        )
        .all() as NotificationRow[]
    ).map((row) => this.map(row));
  }
  public get(id: string): NotificationRecord | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT n.*,target.entity_type target_entity_type FROM notifications n JOIN entity_index e ON e.id=n.id LEFT JOIN entity_index target ON target.id=n.target_entity_id AND target.deleted_at IS NULL WHERE n.id=? AND e.deleted_at IS NULL`,
      )
      .get(id) as NotificationRow | undefined;
    return row === undefined ? undefined : this.map(row);
  }

  public markRead(id: string): NotificationRecord | undefined {
    const now = this.clock.now().getTime();
    this.database.raw
      .prepare(
        `UPDATE notifications SET read_at = ?, snoozed_until = NULL WHERE id = ? AND read_at IS NULL`,
      )
      .run(now, id);
    return this.get(id);
  }

  public markAllRead(): number {
    const now = this.clock.now().getTime();
    const result = this.database.raw
      .prepare(`UPDATE notifications SET read_at = ? WHERE read_at IS NULL`)
      .run(now);
    return result.changes;
  }

  public snooze(id: string, until: string): NotificationRecord | undefined {
    const untilMs = Date.parse(until);
    if (!Number.isFinite(untilMs)) throw new Error('INVALID_SNOOZE_TIME');
    this.database.raw
      .prepare(`UPDATE notifications SET snoozed_until = ?, read_at = NULL WHERE id = ?`)
      .run(untilMs, id);
    return this.get(id);
  }

  public findByDedupeKey(dedupeKey: string): NotificationRecord | undefined {
    const row = this.database.raw
      .prepare(
        'SELECT n.*,target.entity_type target_entity_type FROM notifications n LEFT JOIN entity_index target ON target.id=n.target_entity_id AND target.deleted_at IS NULL WHERE n.dedupe_key = ?',
      )
      .get(dedupeKey) as NotificationRow | undefined;
    return row === undefined ? undefined : this.map(row);
  }
  private map(row: NotificationRow): NotificationRecord {
    const iso = (value: number | null) => (value === null ? null : new Date(value).toISOString());
    return {
      id: row.id,
      notificationType: row.notification_type,
      targetEntityId: row.target_entity_id,
      targetEntityType: row.target_entity_type,
      title: row.title,
      body: row.body,
      severity: row.severity,
      scheduledAt: new Date(row.scheduled_at).toISOString(),
      deliveredAt: iso(row.delivered_at),
      readAt: iso(row.read_at),
      snoozedUntil: iso(row.snoozed_until),
    };
  }
}
