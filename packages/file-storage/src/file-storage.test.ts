import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';

import {
  AttachmentRepository,
  BootstrapStore,
  DataDirectoryManager,
  SqliteDatabase,
} from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { describe, expect, it } from 'vitest';

import { BackupService } from './backup-service.js';
import { ManagedFileStorage, PathTraversalError } from './managed-file-storage.js';

describe('managed files and backups', () => {
  it('rejects traversal, copies an attachment and verifies a complete backup', async () => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
    try {
      const manager = new DataDirectoryManager(
        new BootstrapStore(`${temporary.path}/bootstrap.json`),
        '0.1.0',
      );
      const layout = await manager.initialize(`${temporary.path}/data`);
      const metadata = await manager.readMetadata(layout);
      const database = new SqliteDatabase(layout.database, clock);
      database.migrate();
      const storage = new ManagedFileStorage(layout, new AttachmentRepository(database, clock));

      expect(() => storage.resolveStorageKey('../private.txt')).toThrow(PathTraversalError);
      const attachment = await storage.store({
        stream: Readable.from(Buffer.from('attachment body')),
        originalName: '../工作说明.txt',
        mediaType: 'text/plain',
        maxSizeBytes: 1024,
      });
      expect(await readFile(storage.resolveStorageKey(attachment.storageKey), 'utf8')).toBe(
        'attachment body',
      );

      const backups = new BackupService(database, layout, clock, '0.1.0');
      const backup = await backups.createManualBackup(metadata.installationId);
      expect(await backups.verify(backup.path)).toMatchObject({ formatVersion: 1, fileCount: 3 });

      await backups.createScheduledBackup(metadata.installationId, 1);
      await backups.createScheduledBackup(metadata.installationId, 1);
      const scheduled = backups.list().filter((record) => {
        const value = record as { backupType: string };
        return value.backupType === 'SCHEDULED';
      }) as { status: string; path: string | null }[];
      expect(scheduled.filter((record) => record.status === 'SUCCEEDED')).toHaveLength(1);
      expect(scheduled.filter((record) => record.status === 'DELETED')).toHaveLength(1);
      expect(scheduled.find((record) => record.status === 'SUCCEEDED')?.path).toMatch(
        /\.lifeassistant-backup$/,
      );
      database.close();
    } finally {
      await temporary.cleanup();
    }
  });
});
