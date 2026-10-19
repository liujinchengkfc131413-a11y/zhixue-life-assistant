import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';
import { JobRepository } from './job-repository.js';

export interface AttachmentRecord {
  readonly id: string;
  readonly originalName: string;
  readonly safeName: string;
  readonly mediaType: string;
  readonly extension: string | null;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly storageKey: string;
  readonly description: string | null;
  readonly status: 'UPLOADING' | 'READY' | 'MISSING' | 'QUARANTINED';
}
export interface LinkedAttachmentRecord extends AttachmentRecord {
  readonly role: 'GENERAL' | 'MATERIAL' | 'DOCUMENT' | 'COVER';
}

export class AttachmentRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public nextId(): string {
    return ulid();
  }

  public create(record: AttachmentRecord): AttachmentRecord {
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'ATTACHMENT', ?, ?) `,
        )
        .run(record.id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO attachments(
            id, original_name, safe_name, media_type, extension, size_bytes, sha256, storage_key, description, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.originalName,
          record.safeName,
          record.mediaType,
          record.extension,
          record.sizeBytes,
          record.sha256,
          record.storageKey,
          record.description,
          record.status,
        );
    });
    return record;
  }

  public get(id: string): AttachmentRecord {
    const row = this.database.raw
      .prepare(
        `SELECT a.* FROM attachments a JOIN entity_index e ON e.id = a.id
         WHERE a.id = ? AND e.deleted_at IS NULL`,
      )
      .get(id) as
      | {
          id: string;
          original_name: string;
          safe_name: string;
          media_type: string;
          extension: string | null;
          size_bytes: number;
          sha256: string;
          storage_key: string;
          description: string | null;
          status: AttachmentRecord['status'];
        }
      | undefined;
    if (row === undefined) throw new Error('附件不存在。');
    return this.mapRecord(row);
  }

  public getForGc(id: string): AttachmentRecord | undefined {
    const row = this.database.raw.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
      | {
          id: string;
          original_name: string;
          safe_name: string;
          media_type: string;
          extension: string | null;
          size_bytes: number;
          sha256: string;
          storage_key: string;
          description: string | null;
          status: AttachmentRecord['status'];
        }
      | undefined;
    return row === undefined ? undefined : this.mapRecord(row);
  }

  public referenceCount(attachmentId: string): number {
    const row = this.database.raw
      .prepare('SELECT COUNT(*) AS count FROM attachment_links WHERE attachment_id = ?')
      .get(attachmentId) as { count: number };
    return row.count;
  }

  public enqueueGcIfUnreferenced(attachmentIds: readonly string[]): number {
    const jobs = new JobRepository(this.database, this.clock);
    let enqueued = 0;
    for (const attachmentId of new Set(attachmentIds)) {
      if (this.getForGc(attachmentId) === undefined || this.referenceCount(attachmentId) !== 0) {
        continue;
      }
      const key = `attachment:gc:${attachmentId}`;
      const existing = this.database.raw
        .prepare('SELECT 1 FROM background_jobs WHERE idempotency_key = ?')
        .get(key);
      jobs.enqueue({
        jobType: 'attachment.gc',
        idempotencyKey: key,
        payload: { attachmentId },
        maxAttempts: 3,
      });
      if (existing === undefined) enqueued += 1;
    }
    return enqueued;
  }

  public deleteAfterGc(attachmentId: string): void {
    this.database.transaction(() => {
      if (this.getForGc(attachmentId) === undefined) return;
      if (this.referenceCount(attachmentId) !== 0)
        throw new Error('ATTACHMENT_GC_STILL_REFERENCED');
      this.database.raw
        .prepare('UPDATE change_operations SET entity_id = NULL WHERE entity_id = ?')
        .run(attachmentId);
      this.database.raw.prepare('DELETE FROM entity_index WHERE id = ?').run(attachmentId);
    });
  }

  private mapRecord(row: {
    id: string;
    original_name: string;
    safe_name: string;
    media_type: string;
    extension: string | null;
    size_bytes: number;
    sha256: string;
    storage_key: string;
    description: string | null;
    status: AttachmentRecord['status'];
  }): AttachmentRecord {
    return {
      id: row.id,
      originalName: row.original_name,
      safeName: row.safe_name,
      mediaType: row.media_type,
      extension: row.extension,
      sizeBytes: row.size_bytes,
      sha256: row.sha256,
      storageKey: row.storage_key,
      description: row.description,
      status: row.status,
    };
  }

  public link(attachmentId: string, entityId: string, role: LinkedAttachmentRecord['role']): void {
    this.database.transaction(() => {
      this.get(attachmentId);
      const candidate = this.database.raw
        .prepare(
          `SELECT 1 FROM background_jobs
           WHERE idempotency_key = ? AND state IN ('PENDING', 'RUNNING', 'FAILED')`,
        )
        .get(`attachment:gc:${attachmentId}`);
      if (candidate !== undefined) throw new Error('ATTACHMENT_GC_PENDING');
      const entity = this.database.raw
        .prepare('SELECT 1 FROM entity_index WHERE id = ? AND deleted_at IS NULL')
        .get(entityId);
      if (entity === undefined) throw new Error('ENTITY_NOT_FOUND');
      this.database.raw
        .prepare(
          `INSERT INTO attachment_links(attachment_id, entity_id, role, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(attachment_id, entity_id) DO UPDATE SET role = excluded.role`,
        )
        .run(attachmentId, entityId, role, this.clock.now().getTime());
      this.database.raw
        .prepare('UPDATE entity_index SET updated_at=MAX(updated_at+1,?) WHERE id=?')
        .run(this.clock.now().getTime(), attachmentId);
    });
  }

  public unlink(attachmentId: string, entityId: string): void {
    this.database.transaction(() => {
      const removed = this.database.raw
        .prepare('DELETE FROM attachment_links WHERE attachment_id = ? AND entity_id = ?')
        .run(attachmentId, entityId).changes;
      if (removed === 1) {
        this.database.raw
          .prepare('UPDATE entity_index SET updated_at=MAX(updated_at+1,?) WHERE id=?')
          .run(this.clock.now().getTime(), attachmentId);
        this.enqueueGcIfUnreferenced([attachmentId]);
      }
    });
  }

  public listForEntity(entityId: string): readonly LinkedAttachmentRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT attachment.id, link.role FROM attachment_links link
         JOIN attachments attachment ON attachment.id = link.attachment_id
         JOIN entity_index entity ON entity.id = attachment.id AND entity.deleted_at IS NULL
         WHERE link.entity_id = ? ORDER BY link.created_at`,
      )
      .all(entityId) as { id: string; role: LinkedAttachmentRecord['role'] }[];
    return rows.map((row) => ({ ...this.get(row.id), role: row.role }));
  }
}
