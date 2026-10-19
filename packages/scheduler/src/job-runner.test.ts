import { setTimeout as sleep } from 'node:timers/promises';

import { JobRepository, SqliteDatabase } from '@life-assistant/database';
import { SystemClock } from '@life-assistant/kernel';
import { describe, expect, it } from 'vitest';

import { JobRunner } from './job-runner.js';

const clock = new SystemClock();

describe('JobRunner', () => {
  it('recovers an expired lease and completes the job after restart', async () => {
    let now = new Date('2026-08-11T00:00:00.000Z').getTime();
    const fakeClock = { now: () => new Date(now) };
    const database = new SqliteDatabase(':memory:', fakeClock);
    database.migrate();
    const repository = new JobRepository(database, fakeClock);
    const id = repository.enqueue({
      jobType: 'maintenance',
      idempotencyKey: 'maintenance-1',
      payload: {},
    });
    expect(repository.claimNext(1)).toMatchObject({ id });
    now += 2;

    const runner = new JobRunner(repository, { leaseMilliseconds: 1 });
    const handled: string[] = [];
    runner.register('maintenance', (job) => {
      handled.push(job.id);
      return Promise.resolve();
    });
    await runner.start(60_000);
    runner.stop();

    expect(handled).toEqual([id]);
    expect(database.raw.prepare('SELECT state FROM background_jobs WHERE id = ?').get(id)).toEqual({
      state: 'SUCCEEDED',
    });
    database.close();
  });

  it('renews the lease of a long-running job so a second instance never steals it', async () => {
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    const repository = new JobRepository(database, clock);
    const id = repository.enqueue({
      jobType: 'long-job',
      idempotencyKey: 'long-1',
      payload: {},
    });

    let invocations = 0;
    const handler = async (): Promise<void> => {
      invocations += 1;
      await sleep(1_200); // 运行时间远超 300ms 租约。
    };

    const first = new JobRunner(repository, { leaseMilliseconds: 300 });
    first.register('long-job', handler);
    await first.start(60_000);

    // 在租约过期后的窗口（~400ms）启动第二个实例：租约已被续期，不应被夺走。
    await sleep(400);
    const second = new JobRunner(repository, { leaseMilliseconds: 300 });
    second.register('long-job', handler);
    await second.start(60_000);

    // 等待首个实例完成。
    await sleep(1_000);
    first.stop();
    second.stop();

    expect(invocations).toBe(1);
    expect(database.raw.prepare('SELECT state FROM background_jobs WHERE id = ?').get(id)).toEqual({
      state: 'SUCCEEDED',
    });
    expect(repository.summary()).toEqual({ pending: 0, running: 0, failed: 0 });
    database.close();
  });

  it('retries a failing job up to maxAttempts and then marks it FAILED', async () => {
    const now = new Date('2026-08-11T00:00:00.000Z').getTime();
    const fakeClock = { now: () => new Date(now) };
    const database = new SqliteDatabase(':memory:', fakeClock);
    database.migrate();
    const repository = new JobRepository(database, fakeClock);
    const id = repository.enqueue({
      jobType: 'flaky',
      idempotencyKey: 'flaky-1',
      payload: {},
      maxAttempts: 3,
    });

    let attempts = 0;
    const runner = new JobRunner(repository, {
      leaseMilliseconds: 10_000,
      retryDelayMilliseconds: 0,
    });
    runner.register('flaky', () => {
      attempts += 1;
      return Promise.reject(new Error('临时故障'));
    });
    await runner.runDueJobs();
    await runner.runDueJobs();
    await runner.runDueJobs();
    runner.stop();

    expect(attempts).toBe(3);
    expect(
      database.raw.prepare('SELECT state, attempt_count FROM background_jobs WHERE id = ?').get(id),
    ).toEqual({
      state: 'FAILED',
      attempt_count: 3,
    });
    expect(repository.summary()).toEqual({ pending: 0, running: 0, failed: 1 });
    database.close();
  });

  it('honors the retry delay before re-claiming a failed job', async () => {
    let now = new Date('2026-08-11T00:00:00.000Z').getTime();
    const fakeClock = { now: () => new Date(now) };
    const database = new SqliteDatabase(':memory:', fakeClock);
    database.migrate();
    const repository = new JobRepository(database, fakeClock);
    const id = repository.enqueue({
      jobType: 'flaky',
      idempotencyKey: 'flaky-2',
      payload: {},
      maxAttempts: 2,
    });

    const runner = new JobRunner(repository, {
      leaseMilliseconds: 10_000,
      retryDelayMilliseconds: 1_000,
    });
    runner.register('flaky', () => Promise.reject(new Error('临时故障')));

    expect(await runner.runDueJobs()).toBe(1);
    // 重试延迟未到：run_at 在未来，不应被领取。
    expect(await runner.runDueJobs()).toBe(0);
    expect(repository.summary()).toEqual({ pending: 1, running: 0, failed: 0 });

    now += 2_000;
    expect(await runner.runDueJobs()).toBe(1);
    expect(repository.summary()).toEqual({ pending: 0, running: 0, failed: 1 });
    expect(
      database.raw.prepare('SELECT attempt_count FROM background_jobs WHERE id = ?').get(id),
    ).toEqual({ attempt_count: 2 });
    runner.stop();
    database.close();
  });

  it('claims each job exactly once across concurrent runner instances', async () => {
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    const repository = new JobRepository(database, clock);
    repository.enqueue({ jobType: 'once', idempotencyKey: 'once-1', payload: {} });

    let invocations = 0;
    const handler = async (): Promise<void> => {
      invocations += 1;
      await sleep(150);
    };
    const first = new JobRunner(repository, { leaseMilliseconds: 10_000 });
    const second = new JobRunner(repository, { leaseMilliseconds: 10_000 });
    first.register('once', handler);
    second.register('once', handler);

    await Promise.all([first.runDueJobs(), second.runDueJobs()]);
    first.stop();
    second.stop();

    expect(invocations).toBe(1);
    expect(repository.summary()).toEqual({ pending: 0, running: 0, failed: 0 });
    database.close();
  });
});
