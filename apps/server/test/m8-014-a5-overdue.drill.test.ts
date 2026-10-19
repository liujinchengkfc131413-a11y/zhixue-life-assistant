import { join } from 'node:path';

import {
  JobRepository,
  SqliteDatabase,
  createUserOperationContext,
} from '@life-assistant/database';
import { TaskEnvelopeSchema } from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalRuntime } from '../src/runtime-probe.js';
import { buildApp } from '../src/app.js';

/**
 * A5：overdue next-due job 的端到端演练。
 *
 * 覆盖：无浏览器后台自动检测块结束并重排；关机跨过截止点后重启补跑；
 * 任务完成成功后 derived reschedule 失败不误报（转为后台重试）；job 幂等入队。
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

const workCategoryId = (runtime: LocalRuntime): string => {
  const categories = runtime.shared?.listCategories() ?? [];
  const category = categories.find((item) => item.parentArea === 'WORK');
  if (category === undefined) throw new Error('测试缺少工作分类。');
  return category.id;
};

const activeBlockCount = (runtime: LocalRuntime, taskId: string): number => {
  const database = runtime.database;
  if (database === undefined) throw new Error('数据库未连接');
  const row = database.raw
    .prepare(
      `SELECT COUNT(*) count FROM schedule_blocks block
       JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
       WHERE block.target_entity_id = ?`,
    )
    .get(taskId) as { count: number };
  return row.count;
};

const releasedBlockCount = (runtime: LocalRuntime, taskId: string): number => {
  const database = runtime.database;
  if (database === undefined) throw new Error('数据库未连接');
  const row = database.raw
    .prepare(
      `SELECT COUNT(*) count FROM schedule_blocks
       WHERE target_entity_id = ? AND reason_code = 'RELEASED'`,
    )
    .get(taskId) as { count: number };
  return row.count;
};

describe('A5 overdue background job drills', () => {
  it('detects an ended schedule block in the background and reschedules the incomplete task without any browser', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    try {
      const database = runtime.database;
      if (
        database === undefined ||
        runtime.actions === undefined ||
        runtime.schedules === undefined
      )
        throw new Error('服务未初始化');
      const now = clock.now().getTime();
      const task = runtime.actions.createTask(
        {
          categoryId: workCategoryId(runtime),
          title: '后台逾期',
          priority: 'NORMAL',
          dueAt: now + 8 * 3_600_000,
          estimatedMinutes: 60,
          isFlexible: true,
          isSplittable: false,
          preferredArea: 'WORK',
        },
        createUserOperationContext({ requestId: 'drill-create' }),
      );
      runtime.schedules.reschedule(now, now + 3 * 86_400_000, 'TASK_CREATED');
      expect(activeBlockCount(runtime, task.id)).toBe(1);

      // 模拟时间流逝：块整体进入过去，并让“块结束时刻”入队的 overdue job 到期。
      database.raw
        .prepare('UPDATE schedule_blocks SET start_at = ?, end_at = ? WHERE target_entity_id = ?')
        .run(now - 2 * 3_600_000, now - 3_600_000, task.id);
      new JobRepository(database, clock).enqueue({
        jobType: 'schedule.overdue',
        idempotencyKey: 'schedule:overdue:drill-block-end',
        payload: {},
        runAt: new Date(now - 3_600_000),
      });

      await vi.waitFor(
        () => {
          expect(releasedBlockCount(runtime, task.id)).toBe(1);
          expect(activeBlockCount(runtime, task.id)).toBe(1);
        },
        { timeout: 8_000, interval: 100 },
      );
      const newBlock = database.raw
        .prepare(
          `SELECT start_at FROM schedule_blocks block
           JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
           WHERE block.target_entity_id = ?`,
        )
        .get(task.id) as { start_at: number };
      expect(newBlock.start_at).toBeGreaterThanOrEqual(now);
      const dueRow = runtime.actions.getTask(task.id);
      expect(dueRow === undefined ? null : Date.parse(dueRow.dueAt)).toBe(now + 8 * 3_600_000);
    } finally {
      runtime.close();
    }
  }, 10_000);

  it('catches up overdue processing after an app restart that crossed the deadline', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    const now = clock.now().getTime();
    const layout = runtime.getLayout();
    if (layout === undefined || runtime.actions === undefined || runtime.schedules === undefined)
      throw new Error('服务未初始化');
    const task = runtime.actions.createTask(
      {
        categoryId: workCategoryId(runtime),
        title: '重启补跑',
        priority: 'NORMAL',
        dueAt: now + 8 * 3_600_000,
        estimatedMinutes: 60,
        isFlexible: true,
        isSplittable: false,
        preferredArea: 'WORK',
      },
      createUserOperationContext({ requestId: 'restart-create' }),
    );
    runtime.schedules.reschedule(now, now + 3 * 86_400_000, 'TASK_CREATED');
    runtime.close();

    // 模拟停机跨过截止点：块结束于停机期间，pending overdue job 的 run_at 已过。
    const offline = new SqliteDatabase(layout.database, clock);
    try {
      offline.raw
        .prepare('UPDATE schedule_blocks SET start_at = ?, end_at = ? WHERE target_entity_id = ?')
        .run(now - 2 * 3_600_000, now - 3_600_000, task.id);
      offline.raw
        .prepare(
          `UPDATE background_jobs SET run_at = ?
           WHERE job_type = 'schedule.overdue' AND state = 'PENDING'`,
        )
        .run(now - 3_600_000);
    } finally {
      offline.close();
    }

    const restarted = new LocalRuntime({ bootstrapPath, clock });
    await restarted.start();
    try {
      await vi.waitFor(
        () => {
          expect(releasedBlockCount(restarted, task.id)).toBe(1);
          expect(activeBlockCount(restarted, task.id)).toBe(1);
        },
        { timeout: 8_000, interval: 100 },
      );
      const database = restarted.database;
      if (database === undefined) throw new Error('数据库未连接');
      const redundantCatchUps = database.raw
        .prepare(
          `SELECT COUNT(*) count FROM background_jobs
           WHERE job_type = 'schedule.overdue'
             AND idempotency_key LIKE 'schedule:overdue:startup-catchup:%'`,
        )
        .get() as { count: number };
      expect(redundantCatchUps.count).toBe(0);
    } finally {
      restarted.close();
    }
  }, 10_000);

  it('catches up a missed checkpoint on a cold restart even when no overdue job exists', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    const now = clock.now().getTime();
    const layout = runtime.getLayout();
    if (layout === undefined || runtime.actions === undefined || runtime.schedules === undefined)
      throw new Error('服务未初始化');
    const task = runtime.actions.createTask(
      {
        categoryId: workCategoryId(runtime),
        title: '冷库补跑',
        priority: 'NORMAL',
        dueAt: now + 8 * 3_600_000,
        estimatedMinutes: 60,
        isFlexible: true,
        isSplittable: false,
        preferredArea: 'WORK',
      },
      createUserOperationContext({ requestId: 'cold-restart-create' }),
    );
    runtime.schedules.reschedule(now, now + 3 * 86_400_000, 'TASK_CREATED');
    runtime.close();

    const offline = new SqliteDatabase(layout.database, clock);
    try {
      offline.raw
        .prepare('UPDATE schedule_blocks SET start_at = ?, end_at = ? WHERE target_entity_id = ?')
        .run(now - 2 * 3_600_000, now - 3_600_000, task.id);
      offline.raw.prepare("DELETE FROM background_jobs WHERE job_type = 'schedule.overdue'").run();
    } finally {
      offline.close();
    }

    const restarted = new LocalRuntime({ bootstrapPath, clock });
    await restarted.start();
    try {
      await vi.waitFor(
        () => {
          expect(releasedBlockCount(restarted, task.id)).toBe(1);
          expect(activeBlockCount(restarted, task.id)).toBe(1);
        },
        { timeout: 8_000, interval: 100 },
      );
      const database = restarted.database;
      if (database === undefined) throw new Error('数据库未连接');
      const catchUps = database.raw
        .prepare(
          `SELECT COUNT(*) count FROM background_jobs
           WHERE job_type = 'schedule.overdue'
             AND idempotency_key LIKE 'schedule:overdue:startup-catchup:%'`,
        )
        .get() as { count: number };
      expect(catchUps.count).toBe(1);
    } finally {
      restarted.close();
    }
  }, 10_000);

  it('retries through one startup catch-up after the previous overdue job exhausted its attempts', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, bootstrapPath } = await initRuntime(temporary.path);
    const now = clock.now().getTime();
    const layout = runtime.getLayout();
    if (layout === undefined || runtime.actions === undefined || runtime.schedules === undefined)
      throw new Error('服务未初始化');
    const task = runtime.actions.createTask(
      {
        categoryId: workCategoryId(runtime),
        title: '失败后补跑',
        priority: 'NORMAL',
        dueAt: now + 8 * 3_600_000,
        estimatedMinutes: 60,
        isFlexible: true,
        isSplittable: false,
        preferredArea: 'WORK',
      },
      createUserOperationContext({ requestId: 'failed-restart-create' }),
    );
    runtime.schedules.reschedule(now, now + 3 * 86_400_000, 'TASK_CREATED');
    runtime.close();

    const offline = new SqliteDatabase(layout.database, clock);
    try {
      offline.raw
        .prepare('UPDATE schedule_blocks SET start_at = ?, end_at = ? WHERE target_entity_id = ?')
        .run(now - 2 * 3_600_000, now - 3_600_000, task.id);
      offline.raw
        .prepare(
          `UPDATE background_jobs
           SET state = 'FAILED', attempt_count = max_attempts, finished_at = ?
           WHERE job_type = 'schedule.overdue'`,
        )
        .run(now - 3_600_000);
    } finally {
      offline.close();
    }

    const restarted = new LocalRuntime({ bootstrapPath, clock });
    await restarted.start();
    try {
      await vi.waitFor(
        () => {
          expect(releasedBlockCount(restarted, task.id)).toBe(1);
          expect(activeBlockCount(restarted, task.id)).toBe(1);
        },
        { timeout: 8_000, interval: 100 },
      );
      const database = restarted.database;
      if (database === undefined) throw new Error('数据库未连接');
      const catchUps = database.raw
        .prepare(
          `SELECT COUNT(*) count FROM background_jobs
           WHERE job_type = 'schedule.overdue'
             AND idempotency_key LIKE 'schedule:overdue:startup-catchup:%'`,
        )
        .get() as { count: number };
      expect(catchUps.count).toBe(1);
    } finally {
      restarted.close();
    }
  }, 10_000);

  it('does not fail task completion when the derived reschedule throws, and enqueues a retry', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    const app = await buildApp({ runtime });
    try {
      const categoryId = workCategoryId(runtime);
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: {
          categoryId,
          title: '完成隔离',
          priority: 'NORMAL',
          dueAt: '2026-08-11T08:00:00.000Z',
          estimatedMinutes: 60,
          isFlexible: true,
          isSplittable: false,
          preferredArea: 'WORK',
        },
      });
      expect(created.statusCode).toBe(201);
      const task = TaskEnvelopeSchema.parse(created.json()).data;

      if (runtime.schedules === undefined) throw new Error('schedules 未初始化');
      const originalReschedule = runtime.schedules.reschedule.bind(runtime.schedules);
      runtime.schedules.reschedule = () => {
        throw new Error('SCHEDULE_DRILL_FAIL');
      };
      const complete = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${task.id}/complete`,
        headers: { 'if-match': `"${String(task.version)}"` },
        payload: { expectedVersion: task.version },
      });
      runtime.schedules.reschedule = originalReschedule;
      expect(complete.statusCode).toBe(200);
      if (runtime.actions === undefined) throw new Error('actions 未初始化');
      expect(runtime.actions.getTask(task.id)?.status).toBe('COMPLETED');
      const database = runtime.database;
      if (database === undefined) throw new Error('数据库未连接');
      const retryJobs = database.raw
        .prepare(
          `SELECT COUNT(*) count FROM background_jobs
           WHERE job_type = 'schedule.reschedule' AND state = 'PENDING'`,
        )
        .get() as { count: number };
      expect(retryJobs.count).toBe(1);
    } finally {
      await app.close();
      runtime.close();
    }
  });

  it('deduplicates overdue job enqueues by idempotency key', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    try {
      const database = runtime.database;
      if (database === undefined) throw new Error('数据库未连接');
      const jobs = new JobRepository(database, clock);
      const runAt = clock.now().getTime() + 3_600_000;
      jobs.enqueue({
        jobType: 'schedule.overdue',
        idempotencyKey: `schedule:overdue:${String(runAt)}`,
        payload: {},
        runAt: new Date(runAt),
      });
      jobs.enqueue({
        jobType: 'schedule.overdue',
        idempotencyKey: `schedule:overdue:${String(runAt)}`,
        payload: {},
        runAt: new Date(runAt),
      });
      const rows = database.raw
        .prepare(
          `SELECT COUNT(*) count FROM background_jobs
           WHERE job_type = 'schedule.overdue' AND idempotency_key = ?`,
        )
        .get(`schedule:overdue:${String(runAt)}`) as { count: number };
      expect(rows.count).toBe(1);
    } finally {
      runtime.close();
    }
  });
});
