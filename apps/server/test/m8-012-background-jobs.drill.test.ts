import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { AttachmentRepository, JobRepository, SqliteDatabase } from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalRuntime } from '../src/runtime-probe.js';

/**
 * M8-012 后台任务长时间运行和补跑演练。
 *
 * 覆盖：进程异常退出后遗留的 RUNNING 任务在重启时被恢复并补跑成功；
 * 幂等键去重（同一键重复入队只保留一个任务）；启动型任务跨重启不重复；
 * 以及 JobRunner 对长任务续租（单元层已在 job-runner.test.ts 验证）。
 */
const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const initRuntime = async (
  temporaryPath: string,
): Promise<{ runtime: LocalRuntime; bootstrapPath: string }> => {
  const bootstrapPath = join(temporaryPath, 'bootstrap.json');
  const runtime = new LocalRuntime({ bootstrapPath, clock });
  await runtime.initialize(join(temporaryPath, 'data'), {
    includeDemoData: false,
    backupFrequency: 'MANUAL',
    backupRetentionCount: 3,
    quickCaptureDefaultAction: 'INBOX',
  });
  return { runtime, bootstrapPath };
};

describe('M8-012 background job long-running and replay drills', () => {
  it('continues recycle-bin purge while the background service runs without a browser', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    try {
      const database = runtime.database;
      if (database === undefined) throw new Error('数据库未连接');
      const expiredId = '01K26T7Y00000000000000R000';
      const now = clock.now().getTime();
      database.transaction(() => {
        database.raw
          .prepare(
            `INSERT INTO entity_index(id,entity_type,created_at,updated_at,deleted_at,purge_after)
               VALUES (?,'TAG',?,?,?,?)`,
          )
          .run(expiredId, now, now, now - 30 * 86_400_000, now);
        database.raw
          .prepare('INSERT INTO tags(id,name) VALUES (?,?)')
          .run(expiredId, '后台清理对象');
      });
      new JobRepository(database, clock).enqueue({
        jobType: 'recycle.purge',
        idempotencyKey: 'recycle:purge:service-running',
        payload: {},
      });

      await vi.waitFor(
        () => {
          expect(
            database.raw.prepare('SELECT 1 FROM entity_index WHERE id=?').get(expiredId),
          ).toBeUndefined();
        },
        { timeout: 6_000, interval: 100 },
      );
    } finally {
      runtime.close();
    }
  }, 8_000);

  it('purges expired recycle-bin database objects on startup and remains idempotent', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    const layout = runtime.getLayout();
    if (layout === undefined) throw new Error('数据目录未初始化');
    runtime.close();

    const expiredId = '01K26T7Y00000000000000R001';
    const retainedId = '01K26T7Y00000000000000R002';
    const expiredAt = clock.now().getTime() - 30 * 86_400_000;
    const database = new SqliteDatabase(layout.database, clock);
    try {
      database.transaction(() => {
        database.raw
          .prepare(
            `INSERT INTO entity_index(id,entity_type,created_at,updated_at,deleted_at,purge_after)
             VALUES (?,'TAG',?,?,?,?), (?,'TAG',?,?,?,?)`,
          )
          .run(
            expiredId,
            expiredAt,
            expiredAt,
            expiredAt,
            clock.now().getTime(),
            retainedId,
            expiredAt,
            expiredAt,
            expiredAt,
            clock.now().getTime() + 86_400_000,
          );
        database.raw
          .prepare('INSERT INTO tags(id,name) VALUES (?,?), (?,?)')
          .run(expiredId, '到期回收对象', retainedId, '未到期回收对象');
      });
      const jobs = new JobRepository(database, clock);
      jobs.enqueue({
        jobType: 'recycle.purge',
        idempotencyKey: 'recycle:purge:missed-a',
        payload: {},
        runAt: new Date(clock.now().getTime() - 2 * 86_400_000),
      });
      jobs.enqueue({
        jobType: 'recycle.purge',
        idempotencyKey: 'recycle:purge:missed-b',
        payload: {},
        runAt: new Date(clock.now().getTime() - 86_400_000),
      });
    } finally {
      database.close();
    }

    const restarted = new LocalRuntime({ bootstrapPath, clock });
    await restarted.start();
    try {
      const probe = restarted.database;
      if (probe === undefined) throw new Error('重启后数据库未连接');
      expect(
        probe.raw.prepare('SELECT 1 FROM entity_index WHERE id=?').get(expiredId),
      ).toBeUndefined();
      expect(probe.raw.prepare('SELECT 1 FROM tags WHERE id=?').get(expiredId)).toBeUndefined();
      expect(
        probe.raw.prepare('SELECT 1 FROM entity_index WHERE id=?').get(retainedId),
      ).toBeDefined();
      expect(
        probe.raw
          .prepare(
            `SELECT state FROM background_jobs
             WHERE idempotency_key IN ('recycle:purge:missed-a','recycle:purge:missed-b')
             ORDER BY idempotency_key`,
          )
          .all(),
      ).toEqual([{ state: 'SUCCEEDED' }, { state: 'SUCCEEDED' }]);
      expect(
        probe.raw
          .prepare(
            `SELECT COUNT(*) count FROM background_jobs
             WHERE job_type='recycle.purge' AND state='PENDING' AND run_at>?`,
          )
          .get(clock.now().getTime()),
      ).toEqual({ count: 1 });
    } finally {
      restarted.close();
    }
  });

  it('re-runs a job abandoned by a crashed process after runtime restart', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    const layout = runtime.getLayout();
    if (layout === undefined) throw new Error('数据目录未初始化');
    runtime.close();

    // 模拟“旧进程”：直接打开数据库、入队并领取任务后异常退出（租约 0ms 立即过期）。
    const id = (() => {
      const database = new SqliteDatabase(layout.database, clock);
      try {
        const repository = new JobRepository(database, clock);
        const enqueued = repository.enqueue({
          jobType: 'database.quick_check',
          idempotencyKey: 'drill:quick-check-restart',
          payload: {},
        });
        const claimed = repository.claimNext(0);
        if (claimed === undefined) throw new Error('任务未被领取');
        expect(claimed.id).toBe(enqueued);
        expect(repository.summary().running).toBe(1);
        return enqueued;
      } finally {
        database.close();
      }
    })();

    // 重启运行时：JobRunner.start() 恢复过期租约并补跑该任务。
    const restarted = new LocalRuntime({ bootstrapPath, clock });
    await restarted.start();
    try {
      const probe = restarted.database;
      if (probe === undefined) throw new Error('重启后数据库未连接');
      const row = probe.raw
        .prepare('SELECT state, attempt_count FROM background_jobs WHERE id = ?')
        .get(id) as { state: string; attempt_count: number };
      expect(row).toEqual({ state: 'SUCCEEDED', attempt_count: 2 });
      const summary = new JobRepository(probe, clock).summary();
      expect(summary.running).toBe(0);
      expect(summary.failed).toBe(0);
    } finally {
      restarted.close();
    }
  });

  it('re-arms an exhausted attachment GC job on restart and converges it', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    const layout = runtime.getLayout();
    if (layout === undefined) throw new Error('数据目录未初始化');
    runtime.close();

    const attachmentId = '01K26T7Y00000000000000G001';
    const storageKey = `aa/${attachmentId}.txt`;
    const attachmentPath = join(layout.attachments, storageKey);
    await mkdir(dirname(attachmentPath), { recursive: true });
    await writeFile(attachmentPath, 'retry after restart');
    const database = new SqliteDatabase(layout.database, clock);
    let jobId: string;
    try {
      new AttachmentRepository(database, clock).create({
        id: attachmentId,
        originalName: 'restart.txt',
        safeName: 'restart.txt',
        mediaType: 'text/plain',
        extension: '.txt',
        sizeBytes: 19,
        sha256: 'a'.repeat(64),
        storageKey,
        description: null,
        status: 'READY',
      });
      const jobs = new JobRepository(database, clock);
      jobId = jobs.enqueue({
        jobType: 'attachment.gc',
        idempotencyKey: `attachment:gc:${attachmentId}`,
        payload: { attachmentId },
        maxAttempts: 1,
      });
      const claimed = jobs.claimNext(10_000);
      if (claimed?.id !== jobId) throw new Error('附件 GC 任务未被领取');
      jobs.fail(jobId, 'ATTACHMENT_GC_FILE_DELETE_FAILED', 0);
      expect(jobs.summary().failed).toBe(1);
    } finally {
      database.close();
    }

    const restarted = new LocalRuntime({ bootstrapPath, clock });
    await restarted.start();
    try {
      const probe = restarted.database;
      if (probe === undefined) throw new Error('重启后数据库未连接');
      expect(
        probe.raw.prepare('SELECT state FROM background_jobs WHERE id = ?').get(jobId),
      ).toEqual({ state: 'SUCCEEDED' });
      expect(
        probe.raw.prepare('SELECT 1 FROM attachments WHERE id = ?').get(attachmentId),
      ).toBeUndefined();
      expect(existsSync(attachmentPath)).toBe(false);
    } finally {
      restarted.close();
    }
  });

  it('keeps an enqueued-but-unstarted job across restarts and completes it', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    const layout = runtime.getLayout();
    if (layout === undefined) throw new Error('数据目录未初始化');
    const repository = new JobRepository(
      runtime.database ?? new SqliteDatabase(layout.database, clock),
      clock,
    );
    const id = repository.enqueue({
      jobType: 'database.quick_check',
      idempotencyKey: 'drill:quick-check-pending',
      payload: {},
    });
    // 在运行器的 5 秒轮询前关闭，任务保持 PENDING。
    runtime.close();

    const restarted = new LocalRuntime({ bootstrapPath, clock });
    await restarted.start();
    try {
      const probe = restarted.database;
      if (probe === undefined) throw new Error('重启后数据库未连接');
      const row = probe.raw.prepare('SELECT state FROM background_jobs WHERE id = ?').get(id) as {
        state: string;
      };
      expect(row.state).toBe('SUCCEEDED');
    } finally {
      restarted.close();
    }
  });

  it('deduplicates enqueues by idempotency key', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    try {
      const probe = runtime.database;
      if (probe === undefined) throw new Error('数据库未连接');
      const repository = new JobRepository(probe, clock);
      const firstId = repository.enqueue({
        jobType: 'database.quick_check',
        idempotencyKey: 'drill:dedupe-key',
        payload: { round: 1 },
      });
      const secondId = repository.enqueue({
        jobType: 'database.quick_check',
        idempotencyKey: 'drill:dedupe-key',
        payload: { round: 2 },
      });
      expect(secondId).toBe(firstId);
      const count = probe.raw
        .prepare(
          "SELECT COUNT(*) AS count FROM background_jobs WHERE idempotency_key = 'drill:dedupe-key'",
        )
        .get() as { count: number };
      expect(count.count).toBe(1);
    } finally {
      runtime.close();
    }
  });

  it('does not duplicate startup jobs across restarts', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    runtime.close();

    const second = new LocalRuntime({ bootstrapPath, clock });
    await second.start();
    second.close();

    const third = new LocalRuntime({ bootstrapPath, clock });
    await third.start();
    try {
      const probe = third.database;
      if (probe === undefined) throw new Error('数据库未连接');
      const count = probe.raw
        .prepare(
          "SELECT COUNT(*) AS count FROM background_jobs WHERE idempotency_key = 'reminder:deliver:startup'",
        )
        .get() as { count: number };
      expect(count.count).toBe(1);
      const state = probe.raw
        .prepare(
          "SELECT state FROM background_jobs WHERE idempotency_key = 'reminder:deliver:startup'",
        )
        .get() as { state: string };
      expect(state.state).toBe('SUCCEEDED');
    } finally {
      third.close();
    }
  });
});
