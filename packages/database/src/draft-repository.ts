import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';

export interface DraftRecord {
  readonly id: string;
  readonly draftKey: string;
  readonly entityId: string | null;
  readonly formType: string;
  readonly content: unknown;
  readonly updatedAt: string;
  readonly expiresAt: string | null;
}

interface DraftRow {
  id: string;
  draft_key: string;
  entity_id: string | null;
  form_type: string;
  content_json: string;
  updated_at: number;
  expires_at: number | null;
}

export class DraftRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public get(draftKey: string): DraftRecord | undefined {
    const row = this.database.raw
      .prepare('SELECT * FROM drafts WHERE draft_key=? AND (expires_at IS NULL OR expires_at>?)')
      .get(draftKey, this.clock.now().getTime()) as DraftRow | undefined;
    return row === undefined ? undefined : this.map(row);
  }

  public save(input: {
    draftKey: string;
    entityId?: string | null;
    formType: string;
    content: unknown;
    expiresAt?: number | null;
  }): DraftRecord {
    const now = this.clock.now().getTime();
    this.database.raw
      .prepare(
        `INSERT INTO drafts(id,draft_key,entity_id,form_type,content_json,updated_at,expires_at)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(draft_key) DO UPDATE SET entity_id=excluded.entity_id,form_type=excluded.form_type,
           content_json=excluded.content_json,updated_at=excluded.updated_at,expires_at=excluded.expires_at`,
      )
      .run(
        ulid(),
        input.draftKey,
        input.entityId ?? null,
        input.formType,
        JSON.stringify(input.content),
        now,
        input.expiresAt ?? null,
      );
    const value = this.get(input.draftKey);
    if (value === undefined) throw new Error('DRAFT_NOT_FOUND');
    return value;
  }

  public remove(draftKey: string): void {
    this.database.raw.prepare('DELETE FROM drafts WHERE draft_key=?').run(draftKey);
  }

  private map(row: DraftRow): DraftRecord {
    return {
      id: row.id,
      draftKey: row.draft_key,
      entityId: row.entity_id,
      formType: row.form_type,
      content: JSON.parse(row.content_json) as unknown,
      updatedAt: new Date(row.updated_at).toISOString(),
      expiresAt: row.expires_at === null ? null : new Date(row.expires_at).toISOString(),
    };
  }
}
