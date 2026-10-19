import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';

export interface BackgroundJob {
  readonly id: string;
  readonly jobType: string;
  readonly idempotencyKey: string;
  readonly payload: unknown;
  readonly attemptCount: number;
  readonly maxAttempts: number;
}

export class JobRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public enqueue(input: {
    readonly jobType: string;
    readonly idempotencyKey: string;
    readonly payload: unknown;
    readonly runAt?: Date;
    readonly maxAttempts?: number;
  }): string {
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.raw
      .prepare(
        `INSERT OR IGNORE INTO background_jobs(
          id, job_type, idempotency_key, payload_json, state, run_at, max_attempts, created_at
        ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      )
      .run(
        id,
        input.jobType,
        input.idempotencyKey,
        JSON.stringify(input.payload),
        input.runAt?.getTime() ?? now,
        input.maxAttempts ?? 3,
        now,
      );
    const row = this.database.raw
      .prepare('SELECT id FROM background_jobs WHERE idempotency_key = ?')
      .get(input.idempotencyKey) as { id: string };
    return row.id;
  }

  public recoverExpiredLeases(): number {
    const result = this.database.raw
      .prepare(
        `UPDATE background_jobs
         SET state = 'PENDING', locked_at = NULL, lock_expires_at = NULL
         WHERE state = 'RUNNING' AND lock_expires_at <= ?`,
      )
      .run(this.clock.now().getTime());
    return result.changes;
  }

  public rearmFailedByType(jobType: string, runAt = this.clock.now()): number {
    const result = this.database.raw
      .prepare(
        `UPDATE background_jobs
         SET state = 'PENDING', attempt_count = 0, run_at = ?, finished_at = NULL,
             locked_at = NULL, lock_expires_at = NULL
         WHERE job_type = ? AND state = 'FAILED'`,
      )
      .run(runAt.getTime(), jobType);
    return result.changes;
  }

  /** 某类型最早一个 PENDING 任务的计划执行时间；无则返回 null。 */
  public firstPendingRunAt(jobType: string): number | null {
    const row = this.database.raw
      .prepare(
        `SELECT MIN(run_at) AS runAt FROM background_jobs WHERE job_type = ? AND state = 'PENDING'`,
      )
      .get(jobType) as { runAt: number | null };
    return row.runAt;
  }

  /** 清理某类型已完成且早于给定时间的任务行，防止长期运行后表膨胀。 */
  public deleteFinishedByTypeBefore(jobType: string, beforeMs: number): number {
    const result = this.database.raw
      .prepare(
        `DELETE FROM background_jobs
         WHERE job_type = ? AND state IN ('SUCCEEDED','FAILED')
           AND finished_at IS NOT NULL AND finished_at < ?`,
      )
      .run(jobType, beforeMs);
    return result.changes;
  }

  public claimNext(leaseMilliseconds: number): BackgroundJob | undefined {
    return this.database.transaction(() => {
      const now = this.clock.now().getTime();
      const row = this.database.raw
        .prepare(
          `SELECT id, job_type, idempotency_key, payload_json, attempt_count, max_attempts
           FROM background_jobs
           WHERE state = 'PENDING' AND run_at <= ? AND attempt_count < max_attempts
           ORDER BY run_at, created_at LIMIT 1`,
        )
        .get(now) as
        | {
            id: string;
            job_type: string;
            idempotency_key: string;
            payload_json: string;
            attempt_count: number;
            max_attempts: number;
          }
        | undefined;
      if (row === undefined) return undefined;
      const result = this.database.raw
        .prepare(
          `UPDATE background_jobs
           SET state = 'RUNNING', locked_at = ?, lock_expires_at = ?, attempt_count = attempt_count + 1
           WHERE id = ? AND state = 'PENDING'`,
        )
        .run(now, now + leaseMilliseconds, row.id);
      if (result.changes !== 1) return undefined;
      return {
        id: row.id,
        jobType: row.job_type,
        idempotencyKey: row.idempotency_key,
        payload: JSON.parse(row.payload_json) as unknown,
        attemptCount: row.attempt_count + 1,
        maxAttempts: row.max_attempts,
      };
    });
  }

  public succeed(id: string): void {
    this.database.raw
      .prepare(
        `UPDATE background_jobs SET state = 'SUCCEEDED', finished_at = ?, locked_at = NULL, lock_expires_at = NULL WHERE id = ?`,
      )
      .run(this.clock.now().getTime(), id);
  }

  /** 续租：延长正在执行任务（state=RUNNING）的锁到期时间，防止长任务被其他实例重复领取。 */
  public renewLease(id: string, leaseMilliseconds: number): boolean {
    const result = this.database.raw
      .prepare(
        `UPDATE background_jobs
         SET lock_expires_at = ?
         WHERE id = ? AND state = 'RUNNING'`,
      )
      .run(this.clock.now().getTime() + leaseMilliseconds, id);
    return result.changes === 1;
  }

  public fail(id: string, error: string, retryDelayMilliseconds: number): void {
    const now = this.clock.now().getTime();
    const job = this.database.raw
      .prepare('SELECT attempt_count, max_attempts FROM background_jobs WHERE id = ?')
      .get(id) as { attempt_count: number; max_attempts: number };
    const exhausted = job.attempt_count >= job.max_attempts;
    this.database.raw
      .prepare(
        `UPDATE background_jobs
         SET state = ?, run_at = ?, last_error = ?, finished_at = ?, locked_at = NULL, lock_expires_at = NULL
         WHERE id = ?`,
      )
      .run(
        exhausted ? 'FAILED' : 'PENDING',
        now + retryDelayMilliseconds,
        error.slice(0, 1000),
        exhausted ? now : null,
        id,
      );
  }

  public summary(): { pending: number; running: number; failed: number } {
    const rows = this.database.raw
      .prepare('SELECT state, COUNT(*) AS count FROM background_jobs GROUP BY state')
      .all() as { state: string; count: number }[];
    const count = (state: string) => rows.find((row) => row.state === state)?.count ?? 0;
    return { pending: count('PENDING'), running: count('RUNNING'), failed: count('FAILED') };
  }
}
