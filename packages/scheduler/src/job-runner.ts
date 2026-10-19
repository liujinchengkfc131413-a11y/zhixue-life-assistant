import type { BackgroundJob, JobRepository } from '@life-assistant/database';

export type JobHandler = (job: BackgroundJob) => Promise<void>;

export interface JobRunnerOptions {
  readonly leaseMilliseconds?: number;
  readonly retryDelayMilliseconds?: number;
}

export class JobRunner {
  private readonly handlers = new Map<string, JobHandler>();
  private readonly leaseMilliseconds: number;
  private readonly retryDelayMilliseconds: number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  public constructor(
    private readonly repository: JobRepository,
    options: JobRunnerOptions = {},
  ) {
    this.leaseMilliseconds = options.leaseMilliseconds ?? 60_000;
    this.retryDelayMilliseconds = options.retryDelayMilliseconds ?? 30_000;
  }

  public register(jobType: string, handler: JobHandler): void {
    if (this.handlers.has(jobType)) throw new Error(`后台任务处理器重复注册：${jobType}`);
    this.handlers.set(jobType, handler);
  }

  public async start(intervalMilliseconds = 5_000): Promise<void> {
    this.repository.recoverExpiredLeases();
    await this.runDueJobs();
    this.timer = setInterval(() => void this.runDueJobs(), intervalMilliseconds);
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  public async runDueJobs(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let processed = 0;
    try {
      for (;;) {
        const job = this.repository.claimNext(this.leaseMilliseconds);
        if (job === undefined) break;
        await this.runJob(job);
        processed += 1;
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  private async runJob(job: BackgroundJob): Promise<void> {
    // 长任务续租：执行期间按租约的 1/3 周期刷新锁到期时间，
    // 避免运行超过租约时被其他实例或重启进程重复领取。
    const renewTimer = setInterval(
      () => {
        this.repository.renewLease(job.id, this.leaseMilliseconds);
      },
      Math.max(50, Math.floor(this.leaseMilliseconds / 3)),
    );
    renewTimer.unref();
    try {
      const handler = this.handlers.get(job.jobType);
      if (handler === undefined) throw new Error(`没有后台任务处理器：${job.jobType}`);
      await handler(job);
      this.repository.succeed(job.id);
    } catch (error) {
      this.repository.fail(
        job.id,
        error instanceof Error ? error.message : '未知后台任务错误',
        this.retryDelayMilliseconds,
      );
    } finally {
      clearInterval(renewTimer);
    }
  }
}
