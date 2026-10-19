import type { AttachmentRepository, BackgroundJob, SqliteDatabase } from '@life-assistant/database';

import { PathTraversalError } from './managed-file-storage.js';
import type { ManagedFileStorage } from './managed-file-storage.js';

export class AttachmentGarbageCollector {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly attachments: AttachmentRepository,
    private readonly storage: ManagedFileStorage,
  ) {}

  public async collect(job: BackgroundJob): Promise<void> {
    const payload = job.payload as { attachmentId?: unknown };
    if (
      job.jobType !== 'attachment.gc' ||
      typeof payload.attachmentId !== 'string' ||
      job.idempotencyKey !== `attachment:gc:${payload.attachmentId}`
    ) {
      throw new Error('ATTACHMENT_GC_INVALID_JOB');
    }

    const attachment = this.attachments.getForGc(payload.attachmentId);
    if (attachment === undefined) return;
    if (this.attachments.referenceCount(attachment.id) !== 0) {
      throw new Error('ATTACHMENT_GC_STILL_REFERENCED');
    }

    try {
      await this.storage.removeManaged(attachment.storageKey);
    } catch (error) {
      if (error instanceof PathTraversalError) {
        throw new Error('ATTACHMENT_GC_PATH_REJECTED', { cause: error });
      }
      throw new Error('ATTACHMENT_GC_FILE_DELETE_FAILED', { cause: error });
    }

    this.database.transaction(() => {
      this.attachments.deleteAfterGc(attachment.id);
    });
  }
}
