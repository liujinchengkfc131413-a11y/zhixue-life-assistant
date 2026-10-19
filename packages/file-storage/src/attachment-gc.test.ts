import { existsSync } from 'node:fs';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import {
  AttachmentRepository,
  BootstrapStore,
  ConsistencyRepository,
  DataDirectoryManager,
  InformationRepository,
  JobRepository,
  SharedRepository,
  SqliteDatabase,
  type BackgroundJob,
} from '@life-assistant/database';
import type { Clock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { afterEach, describe, expect, it } from 'vitest';

import { AttachmentGarbageCollector } from './attachment-garbage-collector.js';
import { ManagedFileStorage } from './managed-file-storage.js';

class MutableClock implements Clock {
  public constructor(private instant: Date) {}
  public now(): Date {
    return new Date(this.instant);
  }
  public advance(milliseconds: number): void {
    this.instant = new Date(this.instant.getTime() + milliseconds);
  }
}

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const setup = async (removeFile?: (path: string) => Promise<void>) => {
  const temporary = await createTestDataDirectory();
  const clock = new MutableClock(new Date('2026-08-30T00:00:00.000Z'));
  const manager = new DataDirectoryManager(
    new BootstrapStore(join(temporary.path, 'bootstrap.json')),
    '0.1.0',
  );
  const layout = await manager.initialize(join(temporary.path, 'data'));
  const database = new SqliteDatabase(layout.database, clock);
  database.migrate();
  const jobs = new JobRepository(database, clock);
  const attachments = new AttachmentRepository(database, clock);
  const storage = new ManagedFileStorage(
    layout,
    attachments,
    removeFile === undefined ? undefined : { removeFile },
  );
  const information = new InformationRepository(
    database,
    clock,
    new ConsistencyRepository(database, clock),
  );
  const shared = new SharedRepository(database, clock);
  const collector = new AttachmentGarbageCollector(database, attachments, storage);
  cleanups.push(async () => {
    database.close();
    await temporary.cleanup();
  });
  return {
    temporary,
    clock,
    layout,
    database,
    jobs,
    attachments,
    storage,
    information,
    shared,
    collector,
  };
};

const createAttachment = async (
  fixture: Awaited<ReturnType<typeof setup>>,
  body = 'shared attachment body',
) =>
  fixture.storage.store({
    stream: Readable.from(Buffer.from(body)),
    originalName: 'proof.txt',
    mediaType: 'text/plain',
    maxSizeBytes: 1024,
  });

const gcJob = (database: SqliteDatabase, attachmentId: string) =>
  database.raw
    .prepare(
      `SELECT id,state,attempt_count,max_attempts,last_error
       FROM background_jobs WHERE idempotency_key=?`,
    )
    .get(`attachment:gc:${attachmentId}`) as
    | {
        id: string;
        state: string;
        attempt_count: number;
        max_attempts: number;
        last_error: string | null;
      }
    | undefined;

const runOneGcAttempt = async (fixture: Awaited<ReturnType<typeof setup>>) => {
  const job = fixture.jobs.claimNext(1_000);
  if (job === undefined) throw new Error('GC_JOB_NOT_FOUND');
  try {
    await fixture.collector.collect(job);
    fixture.jobs.succeed(job.id);
    return undefined;
  } catch (error) {
    fixture.jobs.fail(job.id, error instanceof Error ? error.message : 'ATTACHMENT_GC_FAILED', 0);
    return error;
  }
};

const purgeTag = (
  fixture: Awaited<ReturnType<typeof setup>>,
  tag: { id: string; version: number },
) => {
  fixture.shared.softDeleteTag(tag.id, tag.version);
  const deleted = fixture.information
    .recycleBin()
    .find((item) => (item as { id: string }).id === tag.id) as { version: number } | undefined;
  if (deleted === undefined) throw new Error('RECYCLE_ITEM_NOT_FOUND');
  const preview = fixture.information.previewPurge(tag.id);
  fixture.information.executePurge(preview.id, preview.token, tag.id, deleted.version);
};

describe('attachment physical garbage collection', () => {
  it('keeps links, metadata and files through soft delete and before purge_after', async () => {
    const fixture = await setup();
    const tag = fixture.shared.createTag({ name: 'soft-delete-owner' });
    const attachment = await createAttachment(fixture);
    const path = fixture.storage.resolveStorageKey(attachment.storageKey);
    fixture.attachments.link(attachment.id, tag.id, 'GENERAL');

    fixture.shared.softDeleteTag(tag.id, tag.version);
    expect(fixture.attachments.referenceCount(attachment.id)).toBe(1);
    expect(fixture.attachments.getForGc(attachment.id)).toBeDefined();
    expect(existsSync(path)).toBe(true);
    expect(gcJob(fixture.database, attachment.id)).toBeUndefined();

    expect(fixture.information.purgeExpiredRecycleBin()).toBe(0);
    expect(existsSync(path)).toBe(true);
    expect(gcJob(fixture.database, attachment.id)).toBeUndefined();
  });

  it('never collects an ordinary newly uploaded attachment with zero links', async () => {
    const fixture = await setup();
    const attachment = await createAttachment(fixture, 'new upload without link');
    const path = fixture.storage.resolveStorageKey(attachment.storageKey);

    fixture.information.purgeExpiredRecycleBin();
    expect(fixture.attachments.referenceCount(attachment.id)).toBe(0);
    expect(gcJob(fixture.database, attachment.id)).toBeUndefined();
    expect(existsSync(path)).toBe(true);
  });

  it('collects a single-reference attachment only after permanent purge', async () => {
    const fixture = await setup();
    const tag = fixture.shared.createTag({ name: 'single-owner' });
    const attachment = await createAttachment(fixture);
    const path = fixture.storage.resolveStorageKey(attachment.storageKey);
    fixture.attachments.link(attachment.id, tag.id, 'GENERAL');

    purgeTag(fixture, tag);
    expect(gcJob(fixture.database, attachment.id)?.state).toBe('PENDING');
    expect(fixture.attachments.getForGc(attachment.id)).toBeDefined();
    expect(existsSync(path)).toBe(true);

    expect(await runOneGcAttempt(fixture)).toBeUndefined();
    expect(existsSync(path)).toBe(false);
    expect(fixture.attachments.getForGc(attachment.id)).toBeUndefined();
    expect(gcJob(fixture.database, attachment.id)?.state).toBe('SUCCEEDED');
  });

  it('preserves a shared file until the final permanent reference is removed', async () => {
    const fixture = await setup();
    const ownerA = fixture.shared.createTag({ name: 'shared-owner-a' });
    const ownerB = fixture.shared.createTag({ name: 'shared-owner-b' });
    const attachment = await createAttachment(fixture);
    const path = fixture.storage.resolveStorageKey(attachment.storageKey);
    fixture.attachments.link(attachment.id, ownerA.id, 'GENERAL');
    fixture.attachments.link(attachment.id, ownerB.id, 'GENERAL');

    purgeTag(fixture, ownerA);
    expect(fixture.attachments.referenceCount(attachment.id)).toBe(1);
    expect(gcJob(fixture.database, attachment.id)).toBeUndefined();
    expect(existsSync(path)).toBe(true);

    purgeTag(fixture, ownerB);
    expect(fixture.attachments.referenceCount(attachment.id)).toBe(0);
    expect(gcJob(fixture.database, attachment.id)?.state).toBe('PENDING');
    await runOneGcAttempt(fixture);
    expect(existsSync(path)).toBe(false);
  });

  it('treats explicit unlink of the last existing reference as a GC transition', async () => {
    const fixture = await setup();
    const tag = fixture.shared.createTag({ name: 'unlink-owner' });
    const attachment = await createAttachment(fixture);
    const path = fixture.storage.resolveStorageKey(attachment.storageKey);
    fixture.attachments.link(attachment.id, tag.id, 'GENERAL');

    fixture.attachments.unlink(attachment.id, tag.id);
    expect(gcJob(fixture.database, attachment.id)?.state).toBe('PENDING');
    await runOneGcAttempt(fixture);
    expect(existsSync(path)).toBe(false);
  });

  it('converges when the file is already missing and repeated collection is idempotent', async () => {
    const fixture = await setup();
    const tag = fixture.shared.createTag({ name: 'missing-file-owner' });
    const attachment = await createAttachment(fixture);
    const path = fixture.storage.resolveStorageKey(attachment.storageKey);
    fixture.attachments.link(attachment.id, tag.id, 'GENERAL');
    purgeTag(fixture, tag);
    await rm(path, { force: true });

    const job = fixture.jobs.claimNext(1_000);
    if (job === undefined) throw new Error('GC_JOB_NOT_FOUND');
    await expect(fixture.collector.collect(job)).resolves.toBeUndefined();
    fixture.jobs.succeed(job.id);
    await expect(fixture.collector.collect(job)).resolves.toBeUndefined();
    expect(fixture.attachments.getForGc(attachment.id)).toBeUndefined();
  });

  it.each([
    [
      'absolute',
      (fixture: Awaited<ReturnType<typeof setup>>) => join(fixture.temporary.path, 'outside.txt'),
    ],
    ['traversal', () => '../outside.txt'],
  ])('rejects %s storage paths without deleting outside files', async (_label, storageKey) => {
    const fixture = await setup();
    const outside = join(fixture.temporary.path, 'outside.txt');
    await writeFile(outside, 'must survive', 'utf8');
    const tag = fixture.shared.createTag({ name: `invalid-path-${_label}` });
    const id = fixture.attachments.nextId();
    fixture.attachments.create({
      id,
      originalName: 'outside.txt',
      safeName: 'outside.txt',
      mediaType: 'text/plain',
      extension: '.txt',
      sizeBytes: 12,
      sha256: 'a'.repeat(64),
      storageKey: storageKey(fixture),
      description: null,
      status: 'READY',
    });
    fixture.attachments.link(id, tag.id, 'GENERAL');
    purgeTag(fixture, tag);

    expect(await runOneGcAttempt(fixture)).toBeInstanceOf(Error);
    expect(existsSync(outside)).toBe(true);
    expect(fixture.attachments.getForGc(id)).toBeDefined();
    expect(gcJob(fixture.database, id)?.last_error).toBe('ATTACHMENT_GC_PATH_REJECTED');
  });

  it('rejects a resolved symlink escape from the managed attachment root', async () => {
    const fixture = await setup();
    const outsideDirectory = join(fixture.temporary.path, 'outside-directory');
    const outside = join(outsideDirectory, 'outside.txt');
    await mkdir(outsideDirectory, { recursive: true });
    await writeFile(outside, 'must survive', 'utf8');
    await symlink(outsideDirectory, join(fixture.layout.attachments, 'escape'), 'junction');
    const tag = fixture.shared.createTag({ name: 'symlink-owner' });
    const id = fixture.attachments.nextId();
    fixture.attachments.create({
      id,
      originalName: 'outside.txt',
      safeName: 'outside.txt',
      mediaType: 'text/plain',
      extension: '.txt',
      sizeBytes: 12,
      sha256: 'b'.repeat(64),
      storageKey: 'escape/outside.txt',
      description: null,
      status: 'READY',
    });
    fixture.attachments.link(id, tag.id, 'GENERAL');
    purgeTag(fixture, tag);

    expect(await runOneGcAttempt(fixture)).toBeInstanceOf(Error);
    expect(existsSync(outside)).toBe(true);
    expect(gcJob(fixture.database, id)?.last_error).toBe('ATTACHMENT_GC_PATH_REJECTED');
  });

  it('keeps metadata on delete failure, then re-arms the stable failed job and succeeds', async () => {
    let failDeletion = true;
    const fixture = await setup(async (path) => {
      if (failDeletion) throw new Error(`sensitive path must not leak: ${path}`);
      await rm(path, { force: true });
    });
    const tag = fixture.shared.createTag({ name: 'retry-owner' });
    const attachment = await createAttachment(fixture);
    const path = fixture.storage.resolveStorageKey(attachment.storageKey);
    fixture.attachments.link(attachment.id, tag.id, 'GENERAL');
    purgeTag(fixture, tag);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await runOneGcAttempt(fixture)).toBeInstanceOf(Error);
    }
    const failed = gcJob(fixture.database, attachment.id);
    expect(failed).toMatchObject({ state: 'FAILED', attempt_count: 3, max_attempts: 3 });
    expect(failed?.last_error).toBe('ATTACHMENT_GC_FILE_DELETE_FAILED');
    expect(failed?.last_error).not.toContain(path);
    expect(fixture.attachments.getForGc(attachment.id)).toBeDefined();
    expect(existsSync(path)).toBe(true);

    failDeletion = false;
    expect(fixture.jobs.rearmFailedByType('attachment.gc')).toBe(1);
    const restartedCollector = new AttachmentGarbageCollector(
      fixture.database,
      new AttachmentRepository(fixture.database, fixture.clock),
      new ManagedFileStorage(
        fixture.layout,
        new AttachmentRepository(fixture.database, fixture.clock),
      ),
    );
    const job = fixture.jobs.claimNext(1_000);
    if (job === undefined) throw new Error('REARMED_GC_JOB_NOT_FOUND');
    await restartedCollector.collect(job);
    fixture.jobs.succeed(job.id);
    expect(existsSync(path)).toBe(false);
    expect(gcJob(fixture.database, attachment.id)?.state).toBe('SUCCEEDED');
  });

  it('keeps same-SHA attachment records and storage keys isolated', async () => {
    const fixture = await setup();
    const ownerA = fixture.shared.createTag({ name: 'sha-owner-a' });
    const ownerB = fixture.shared.createTag({ name: 'sha-owner-b' });
    const first = await createAttachment(fixture, 'identical bytes');
    const second = await createAttachment(fixture, 'identical bytes');
    expect(first.sha256).toBe(second.sha256);
    expect(first.storageKey).not.toBe(second.storageKey);
    const firstPath = fixture.storage.resolveStorageKey(first.storageKey);
    const secondPath = fixture.storage.resolveStorageKey(second.storageKey);
    fixture.attachments.link(first.id, ownerA.id, 'GENERAL');
    fixture.attachments.link(second.id, ownerB.id, 'GENERAL');

    purgeTag(fixture, ownerA);
    await runOneGcAttempt(fixture);
    expect(existsSync(firstPath)).toBe(false);
    expect(existsSync(secondPath)).toBe(true);
    expect(fixture.attachments.getForGc(second.id)).toBeDefined();
    expect(fixture.database.foreignKeyCheck()).toHaveLength(0);
    expect(fixture.database.quickCheck()).toEqual(['ok']);
  });

  it('rejects GC jobs that are not the stable candidate for their attachment', async () => {
    const fixture = await setup();
    const attachment = await createAttachment(fixture, 'not a candidate');
    const forged: BackgroundJob = {
      id: '01K26T7Y00000000000000GC00',
      jobType: 'attachment.gc',
      idempotencyKey: 'attachment:gc:wrong-id',
      payload: { attachmentId: attachment.id },
      attemptCount: 1,
      maxAttempts: 3,
    };
    await expect(fixture.collector.collect(forged)).rejects.toThrow('ATTACHMENT_GC_INVALID_JOB');
    expect(fixture.attachments.getForGc(attachment.id)).toBeDefined();
  });
});
