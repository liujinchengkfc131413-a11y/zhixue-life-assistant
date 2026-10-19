import { ulid } from 'ulid';

import type {
  ActionRepository,
  ConsistencyRepository,
  JobRepository,
  OperationContext,
  RoutineRepository,
  SqliteDatabase,
} from '@life-assistant/database';
import { GRID_MILLISECONDS, type PreferredArea, type Priority } from '@life-assistant/domain';
import type { Clock } from '@life-assistant/kernel';

import {
  SCHEDULER_RULE_VERSION,
  scheduleDeterministically,
  type AvailabilitySlot,
  type OccupiedBlock,
  type ScheduleWarning,
} from './deterministic-scheduler.js';

export interface TimelineBlock {
  readonly id: string;
  readonly targetEntityId: string | null;
  readonly title: string;
  readonly blockType: 'TASK' | 'EVENT' | 'SLEEP' | 'REST';
  readonly area: PreferredArea | 'SLEEP';
  readonly startAt: string;
  readonly endAt: string;
  readonly source: 'MANUAL' | 'RULE_ENGINE' | 'ROUTINE';
  readonly isLocked: boolean;
  readonly crossAreaWarning: boolean;
}

export interface ScheduleRunResult {
  readonly id: string;
  readonly status: 'APPLIED' | 'NO_CHANGE';
  readonly createdBlocks: number;
  readonly preservedBlocks: number;
  readonly warnings: readonly ScheduleWarning[];
  readonly inputHash: string;
}

export interface ScheduleHistoryTimeSpan {
  readonly startAt: string;
  readonly endAt: string;
}
export interface TaskScheduleHistoryEntry {
  readonly runId: string | null;
  readonly trigger: string;
  readonly occurredAt: string;
  readonly kind: 'RELEASED' | 'SCHEDULED' | 'RESCHEDULED' | 'UNSCHEDULED';
  readonly reason: string | null;
  readonly previousBlocks: readonly ScheduleHistoryTimeSpan[];
  readonly newBlocks: readonly ScheduleHistoryTimeSpan[];
  readonly warnings: readonly { type: string; severity: string; message: string }[];
}
export interface TaskScheduleHistory {
  readonly taskId: string;
  readonly entries: readonly TaskScheduleHistoryEntry[];
}
export interface ScheduleRunDetail {
  readonly id: string;
  readonly rangeStart: string;
  readonly rangeEnd: string;
  readonly trigger: string;
  readonly status: string;
  readonly ruleVersion: string;
  readonly createdAt: string;
  readonly summary: {
    readonly createdBlocks: number;
    readonly releasedBlocks: readonly { taskId: string; startAt: number; endAt: number }[];
    readonly affectedTaskIds: readonly string[];
    readonly rescheduledTaskIds: readonly string[];
    readonly unscheduledTaskIds: readonly string[];
  };
  readonly createdBlocks: readonly {
    id: string;
    taskId: string;
    startAt: string;
    endAt: string;
    reasonCode: string | null;
    outcome: string | null;
    released: boolean;
    previousBlocks: readonly ScheduleHistoryTimeSpan[];
  }[];
  readonly releasedBlocks: readonly { taskId: string; startAt: string; endAt: string }[];
  readonly warnings: readonly {
    entityId: string | null;
    warningType: string;
    severity: string;
    message: string;
  }[];
}

const shanghaiLocalDate = (timestamp: number): string => {
  const shifted = new Date(timestamp + 8 * 3_600_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
};

const localDateTimeToTimestamp = (date: string, time: string): number =>
  Date.parse(`${date}T${time}:00+08:00`);

const nextLocalDate = (date: string): string => {
  const timestamp = Date.parse(`${date}T12:00:00+08:00`) + 86_400_000;
  return shanghaiLocalDate(timestamp);
};

export class ScheduleService {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly actions: ActionRepository,
    private readonly routines: RoutineRepository,
    private readonly clock: Clock,
    private readonly jobs?: JobRepository,
    private readonly consistency?: ConsistencyRepository,
  ) {}

  public reschedule(
    rangeStart: number,
    rangeEnd: number,
    triggerType: string,
    context?: OperationContext,
  ): ScheduleRunResult {
    if (
      rangeEnd <= rangeStart ||
      rangeStart % GRID_MILLISECONDS !== 0 ||
      rangeEnd % GRID_MILLISECONDS !== 0
    ) {
      throw new Error('INVALID_SCHEDULE_RANGE');
    }
    const now = this.clock.now().getTime();
    // 1) 释放“时间块已结束但仍未完成”任务的旧块（幂等；写入 RELEASED 原因），
    //    使释放后的时间立即重新计为空闲，且旧块进入 schedule-specific history。
    const released = this.releaseEndedTaskBlocks(now, triggerType);
    const releasedByTask = new Map<string, ScheduleHistoryTimeSpan[]>();
    for (const item of released) {
      const list = releasedByTask.get(item.taskId) ?? [];
      list.push({
        startAt: new Date(item.startAt).toISOString(),
        endAt: new Date(item.endAt).toISOString(),
      });
      releasedByTask.set(item.taskId, list);
    }
    const tasks = this.schedulableTasks(rangeStart, rangeEnd);
    const dependencies = this.database.raw
      .prepare(
        `SELECT dependency.successor_task_id AS task_id,
                MAX(CASE WHEN predecessor.status <> 'COMPLETED' THEN 1 ELSE 0 END) AS blocked
         FROM task_dependencies dependency
         JOIN tasks predecessor ON predecessor.id = dependency.predecessor_task_id
         GROUP BY dependency.successor_task_id`,
      )
      .all() as { task_id: string; blocked: number }[];
    const blockedByTask = new Map(dependencies.map((item) => [item.task_id, item.blocked === 1]));
    const availability = this.buildAvailability(rangeStart, rangeEnd);
    const occupied = this.listOccupied(rangeStart, rangeEnd);
    const result = scheduleDeterministically({
      rangeStart,
      rangeEnd,
      availability,
      occupied,
      tasks: tasks.map((task) => ({
        id: task.id,
        priority: task.priority,
        dueAt: task.dueAt,
        estimatedMinutes: task.estimatedMinutes,
        isSplittable: task.isSplittable,
        preferredArea: task.preferredArea,
        dependencyBlocked: blockedByTask.get(task.id) ?? false,
        // overdue task：dueAt 已被违反，不再作为硬性上限，改为窗口内任意合法时间。
        ...(task.dueAt < now ? { effectiveDueAt: rangeEnd } : {}),
      })),
    });
    const runId = ulid();
    const freshBlocks = result.blocks.filter((block) => !block.preserved);
    const rescheduledTaskIds = [...new Set(freshBlocks.map((block) => block.taskId))];
    const unscheduledTaskIds = [
      ...new Set(
        result.warnings
          .filter(
            (warning) =>
              warning.warningType === 'UNSCHEDULED' || warning.warningType === 'DEPENDENCY_BLOCKED',
          )
          .map((warning) => warning.entityId),
      ),
    ];
    const affectedTaskIds = [
      ...new Set([
        ...released.map((item) => item.taskId),
        ...rescheduledTaskIds,
        ...unscheduledTaskIds,
      ]),
    ];
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO schedule_runs(id, range_start, range_end, trigger_type, rule_version, status, input_hash, summary_json, created_at, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          runId,
          rangeStart,
          rangeEnd,
          triggerType,
          SCHEDULER_RULE_VERSION,
          freshBlocks.length === 0 ? 'NO_CHANGE' : 'APPLIED',
          result.inputHash,
          JSON.stringify({
            createdBlocks: freshBlocks.length,
            releasedBlocks: released,
            affectedTaskIds,
            rescheduledTaskIds,
            unscheduledTaskIds,
          }),
          now,
          now,
        );
      // 释放的旧块保持其创建 run（原时间/原安排的追溯链不变）；
      // 本次 run 的释放清单记录在 summary.releasedBlocks 中。
      for (const block of freshBlocks) {
        const id = ulid();
        const previous = releasedByTask.get(block.taskId) ?? [];
        this.database.raw
          .prepare(
            `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'SCHEDULE_BLOCK', ?, ?)`,
          )
          .run(id, now, now);
        this.database.raw
          .prepare(
            `INSERT INTO schedule_blocks(
               id, target_entity_id, block_type, area, start_at, end_at, source, is_locked,
               schedule_run_id, reason_code, reason_json, cross_area_warning
             ) VALUES (?, ?, 'TASK', ?, ?, ?, 'RULE_ENGINE', 0, ?, ?, ?, ?)`,
          )
          .run(
            id,
            block.taskId,
            block.area,
            block.startAt,
            block.endAt,
            runId,
            block.reasonCode,
            JSON.stringify({
              outcome: previous.length > 0 ? 'RESCHEDULED' : 'SCHEDULED',
              previousBlocks: previous,
            }),
            block.crossAreaWarning ? 1 : 0,
          );
      }
      for (const warning of result.warnings) this.insertWarning(runId, warning, now);
    });
    this.refreshNextDue();
    const runResult: ScheduleRunResult = {
      id: runId,
      status: freshBlocks.length === 0 ? 'NO_CHANGE' : 'APPLIED',
      createdBlocks: freshBlocks.length,
      preservedBlocks: result.blocks.length - freshBlocks.length,
      warnings: result.warnings,
      inputHash: result.inputHash,
    };
    if (context !== undefined && this.consistency !== undefined) {
      this.consistency.recordChange({
        context,
        summary: `ScheduleRequested:${triggerType}`,
        riskLevel: 'LOW_WRITE',
        changes: [{ operation: 'UPDATE', before: { rangeStart, rangeEnd }, after: runResult }],
      });
    }
    return runResult;
  }

  /**
   * 每次重排后维护 A5 next-due job：取「计算出的未来检查点」与「已存在的 PENDING job」中更早者，
   * 以带时间戳的幂等键入队；无任何需要检查的时间点时不制造 job。
   */
  private refreshNextDue(): void {
    if (this.jobs === undefined) return;
    const now = this.clock.now().getTime();
    const computed = this.nextOverdueCheckpoint(now);
    const existing = this.jobs.firstPendingRunAt('schedule.overdue');
    const candidates: number[] = [];
    if (computed !== null) candidates.push(computed);
    if (existing !== null) candidates.push(existing);
    if (candidates.length === 0) return;
    const nextCheck = Math.min(...candidates);
    this.jobs.enqueue({
      jobType: 'schedule.overdue',
      idempotencyKey: `schedule:overdue:${String(nextCheck)}`,
      payload: {},
      runAt: new Date(nextCheck),
      maxAttempts: 3,
    });
  }

  /**
   * 仅加载排程窗口内需要参与排程的弹性任务：未完成、可排程、无父任务，
   * 且要么在窗口内到期，要么窗口内已有排程块（保留既有安排）。
   * 通过 UNION 分别走 due_at 索引与已有块查询，避免全表扫描；
   * 按优先级/截止排序后限量，避免 10 万级任务量下全量排程导致超时。
   */
  private schedulableTasks(
    rangeStart: number,
    rangeEnd: number,
  ): readonly {
    id: string;
    priority: Priority;
    dueAt: number;
    estimatedMinutes: number;
    isSplittable: boolean;
    preferredArea: PreferredArea;
  }[] {
    const LIMIT = 500;
    const rows = this.database.raw
      .prepare(
        `SELECT * FROM (
           SELECT resource.id, resource.priority, resource.due_at, resource.estimated_minutes,
                  resource.is_splittable, resource.preferred_area
           FROM tasks resource
           JOIN entity_index entity ON entity.id = resource.id AND entity.deleted_at IS NULL
           WHERE resource.status IN ('TODO','IN_PROGRESS')
             AND resource.is_flexible = 1
             AND resource.parent_task_id IS NULL
             AND resource.due_at >= ? AND resource.due_at < ?
           UNION
           SELECT resource.id, resource.priority, resource.due_at, resource.estimated_minutes,
                  resource.is_splittable, resource.preferred_area
           FROM tasks resource
           JOIN entity_index entity ON entity.id = resource.id AND entity.deleted_at IS NULL
           WHERE resource.status IN ('TODO','IN_PROGRESS')
             AND resource.is_flexible = 1
             AND resource.parent_task_id IS NULL
             AND resource.id IN (
               SELECT block.target_entity_id FROM schedule_blocks block
               JOIN entity_index block_entity ON block_entity.id = block.id AND block_entity.deleted_at IS NULL
               WHERE block.target_entity_id IS NOT NULL
                 AND block.end_at > ? AND block.start_at < ?
             )
           UNION ALL
           SELECT resource.id, resource.priority, resource.due_at, resource.estimated_minutes,
                  resource.is_splittable, resource.preferred_area
           FROM tasks resource
           JOIN entity_index entity ON entity.id = resource.id AND entity.deleted_at IS NULL
           WHERE resource.status IN ('TODO','IN_PROGRESS')
             AND resource.is_flexible = 1
             AND resource.parent_task_id IS NULL
             AND resource.due_at < ?
             AND resource.id NOT IN (
               SELECT block.target_entity_id FROM schedule_blocks block
               JOIN entity_index block_entity ON block_entity.id = block.id AND block_entity.deleted_at IS NULL
               WHERE block.target_entity_id IS NOT NULL
                 AND block.end_at > ? AND block.start_at < ?
             )
         ) schedulable
         ORDER BY
           CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
           due_at, id
         LIMIT ${String(LIMIT)}`,
      )
      .all(rangeStart, rangeEnd, rangeStart, rangeEnd, rangeStart, rangeStart, rangeEnd) as {
      id: string;
      priority: Priority;
      due_at: number;
      estimated_minutes: number;
      is_splittable: number;
      preferred_area: PreferredArea;
    }[];
    return rows.map((row) => ({
      id: row.id,
      priority: row.priority,
      dueAt: row.due_at,
      estimatedMinutes: row.estimated_minutes,
      isSplittable: row.is_splittable === 1,
      preferredArea: row.preferred_area,
    }));
  }

  public listTimeline(rangeStart: number, rangeEnd: number): readonly TimelineBlock[] {
    const taskBlocks = this.database.raw
      .prepare(
        `SELECT block.id, block.target_entity_id, task.title, block.area, block.start_at, block.end_at,
                block.source, block.is_locked, block.cross_area_warning
         FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         JOIN tasks task ON task.id = block.target_entity_id
         WHERE block.end_at > ? AND block.start_at < ?`,
      )
      .all(rangeStart, rangeEnd) as {
      id: string;
      target_entity_id: string;
      title: string;
      area: PreferredArea;
      start_at: number;
      end_at: number;
      source: 'MANUAL' | 'RULE_ENGINE';
      is_locked: number;
      cross_area_warning: number;
    }[];
    const blocks: TimelineBlock[] = taskBlocks.map((block) => ({
      id: block.id,
      targetEntityId: block.target_entity_id,
      title: block.title,
      blockType: 'TASK',
      area: block.area,
      startAt: new Date(block.start_at).toISOString(),
      endAt: new Date(block.end_at).toISOString(),
      source: block.source,
      isLocked: block.is_locked === 1,
      crossAreaWarning: block.cross_area_warning === 1,
    }));
    for (const event of this.actions.listEvents(rangeStart, rangeEnd)) {
      if (event.status !== 'SCHEDULED') continue;
      blocks.push({
        id: event.id,
        targetEntityId: event.id,
        title: event.title,
        blockType: 'EVENT',
        area: this.categoryArea(event.categoryId),
        startAt: event.startAt,
        endAt: event.endAt,
        source: 'MANUAL',
        isLocked: event.isImmovable,
        crossAreaWarning: false,
      });
    }
    blocks.push(...this.buildRoutineTimeline(rangeStart, rangeEnd));
    return blocks.toSorted((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
  }

  public listWarnings(): readonly {
    id: string;
    entityId: string | null;
    warningType: string;
    severity: string;
    message: string;
  }[] {
    return this.database.raw
      .prepare(
        `SELECT warning.id, warning.entity_id AS entityId, warning.warning_type AS warningType,
                warning.severity, warning.message
         FROM schedule_warnings warning
         JOIN entity_index entity ON entity.id = warning.id AND entity.deleted_at IS NULL
         WHERE warning.resolved_at IS NULL ORDER BY entity.created_at DESC`,
      )
      .all() as {
      id: string;
      entityId: string | null;
      warningType: string;
      severity: string;
      message: string;
    }[];
  }

  public setBlockLocked(id: string, locked: boolean): void {
    const changed = this.database.raw
      .prepare('UPDATE schedule_blocks SET is_locked = ? WHERE id = ?')
      .run(locked ? 1 : 0, id);
    if (changed.changes !== 1) throw new Error('SCHEDULE_BLOCK_NOT_FOUND');
  }

  /**
   * 释放“时间块已结束但任务仍未完成”的旧块（软删除 + RELEASED 原因），幂等：
   * 只处理 active 且 end_at <= now 的 TASK 块；处理后被排除出后续占用/保留。
   */
  private releaseEndedTaskBlocks(
    now: number,
    triggerType: string,
  ): readonly { id: string; taskId: string; startAt: number; endAt: number }[] {
    const rows = this.database.raw
      .prepare(
        `SELECT block.id AS id, block.target_entity_id AS taskId,
                block.start_at AS startAt, block.end_at AS endAt
         FROM schedule_blocks block
         JOIN entity_index block_entity ON block_entity.id = block.id AND block_entity.deleted_at IS NULL
         JOIN tasks task ON task.id = block.target_entity_id
         JOIN entity_index task_entity ON task_entity.id = task.id AND task_entity.deleted_at IS NULL
         WHERE block.block_type = 'TASK'
           AND block.end_at <= ?
           AND task.status IN ('TODO','IN_PROGRESS')`,
      )
      .all(now) as { id: string; taskId: string; startAt: number; endAt: number }[];
    if (rows.length === 0) return [];
    this.database.transaction(() => {
      const ids = rows.map((row) => row.id);
      const placeholders = ids.map(() => '?').join(',');
      this.database.raw
        .prepare(
          `UPDATE entity_index SET deleted_at = ?, purge_after = NULL, updated_at = ? WHERE id IN (${placeholders})`,
        )
        .run(now, now, ...ids);
      this.database.raw
        .prepare(
          `UPDATE schedule_blocks SET reason_code = 'RELEASED', reason_json = ? WHERE id IN (${placeholders})`,
        )
        .run(
          JSON.stringify({ reason: triggerType, releasedAt: new Date(now).toISOString() }),
          ...ids,
        );
    });
    return rows;
  }

  /**
   * 下一次需要检查的 overdue 时间点（覆盖两种情形，同一任务只按一个检查点触发）：
   * A. 未完成任务的活动时间块的最早结束时间；
   * B. 没有活动时间块的未完成任务的最早 due_at。
   * 只返回未来时间点；过去的时间点由已入队的到期 Job 在启动/轮询时补跑。
   */
  public nextOverdueCheckpoint(now: number): number | null {
    const row = this.database.raw
      .prepare(
        `SELECT MIN(checkpoint) AS checkpoint FROM (
           SELECT MIN(block.end_at) AS checkpoint
           FROM schedule_blocks block
           JOIN entity_index block_entity ON block_entity.id = block.id AND block_entity.deleted_at IS NULL
           JOIN tasks task ON task.id = block.target_entity_id
           JOIN entity_index task_entity ON task_entity.id = task.id AND task_entity.deleted_at IS NULL
           WHERE block.block_type = 'TASK'
             AND task.status IN ('TODO','IN_PROGRESS')
             AND task.is_flexible = 1
             AND block.end_at > ?
           UNION ALL
           SELECT task.due_at AS checkpoint
           FROM tasks task
           JOIN entity_index task_entity ON task_entity.id = task.id AND task_entity.deleted_at IS NULL
           WHERE task.status IN ('TODO','IN_PROGRESS')
             AND task.is_flexible = 1
             AND task.parent_task_id IS NULL
             AND task.due_at > ?
             AND NOT EXISTS (
               SELECT 1 FROM schedule_blocks block2
               JOIN entity_index block_entity2 ON block_entity2.id = block2.id AND block_entity2.deleted_at IS NULL
               WHERE block2.target_entity_id = task.id
             )
         )`,
      )
      .get(now, now) as { checkpoint: number | null };
    return row.checkpoint;
  }

  /**
   * 启动补偿专用：识别已经错过的检查点。
   * 该判断不得进入普通 next-due refresh，否则无法排入的 overdue task 会反复制造即时 job。
   */
  public hasMissedOverdueCheckpoint(now: number): boolean {
    const row = this.database.raw
      .prepare(
        `SELECT EXISTS(
           SELECT 1
           FROM schedule_blocks block
           JOIN entity_index block_entity ON block_entity.id = block.id AND block_entity.deleted_at IS NULL
           JOIN tasks task ON task.id = block.target_entity_id
           JOIN entity_index task_entity ON task_entity.id = task.id AND task_entity.deleted_at IS NULL
           WHERE block.block_type = 'TASK'
             AND block.end_at <= ?
             AND task.status IN ('TODO','IN_PROGRESS')
             AND task.is_flexible = 1
           UNION ALL
           SELECT 1
           FROM tasks task
           JOIN entity_index task_entity ON task_entity.id = task.id AND task_entity.deleted_at IS NULL
           WHERE task.status IN ('TODO','IN_PROGRESS')
             AND task.is_flexible = 1
             AND task.parent_task_id IS NULL
             AND task.due_at <= ?
             AND NOT EXISTS (
               SELECT 1 FROM schedule_blocks block2
               JOIN entity_index block_entity2 ON block_entity2.id = block2.id AND block_entity2.deleted_at IS NULL
               WHERE block2.target_entity_id = task.id
             )
         ) AS missed`,
      )
      .get(now, now) as { missed: number };
    return row.missed === 1;
  }

  /** A5 compatibility repair: RELEASED blocks are immutable history, not 30-day recycle items. */
  public preserveReleasedBlockHistory(): number {
    return this.database.raw
      .prepare(
        `UPDATE entity_index SET purge_after = NULL
         WHERE entity_type = 'SCHEDULE_BLOCK'
           AND deleted_at IS NOT NULL
           AND purge_after IS NOT NULL
           AND id IN (SELECT id FROM schedule_blocks WHERE reason_code = 'RELEASED')`,
      )
      .run().changes;
  }

  public taskScheduleHistory(taskId: string): TaskScheduleHistory {
    const task = this.database.raw.prepare('SELECT id FROM tasks WHERE id=?').get(taskId);
    if (task === undefined) throw new Error('TASK_NOT_FOUND');
    const blocks = this.database.raw
      .prepare(
        `SELECT block.id, block.start_at, block.end_at, block.reason_code, block.reason_json,
                block.schedule_run_id, block_entity.deleted_at, block_entity.created_at AS block_created_at,
                run.trigger_type AS run_trigger, run.created_at AS run_created_at
         FROM schedule_blocks block
         JOIN entity_index block_entity ON block_entity.id = block.id
         LEFT JOIN schedule_runs run ON run.id = block.schedule_run_id
         WHERE block.target_entity_id = ?
         ORDER BY block.start_at, block_entity.created_at`,
      )
      .all(taskId) as {
      id: string;
      start_at: number;
      end_at: number;
      reason_code: string | null;
      reason_json: string | null;
      schedule_run_id: string | null;
      deleted_at: number | null;
      block_created_at: number;
      run_trigger: string | null;
      run_created_at: number | null;
    }[];
    const warnings = this.database.raw
      .prepare(
        `SELECT warning.warning_type, warning.severity, warning.message,
                warning.schedule_run_id, run.trigger_type AS run_trigger, run.created_at AS run_created_at
         FROM schedule_warnings warning
         JOIN schedule_runs run ON run.id = warning.schedule_run_id
         WHERE warning.entity_id = ?`,
      )
      .all(taskId) as {
      warning_type: string;
      severity: string;
      message: string;
      schedule_run_id: string;
      run_trigger: string;
      run_created_at: number;
    }[];
    const span = (value: { start_at: number; end_at: number }): ScheduleHistoryTimeSpan => ({
      startAt: new Date(value.start_at).toISOString(),
      endAt: new Date(value.end_at).toISOString(),
    });
    const parseReason = (row: {
      reason_json: string | null;
    }):
      | { reason?: unknown; outcome?: unknown; previousBlocks?: unknown; releasedAt?: unknown }
      | undefined =>
      row.reason_json === null
        ? undefined
        : (JSON.parse(row.reason_json) as {
            reason?: unknown;
            outcome?: unknown;
            previousBlocks?: unknown;
            releasedAt?: unknown;
          });
    // 按 run 分组：同一 run 中该任务的新块合并为一个条目（newBlocks[]），
    // 释放的旧块作为 previousBlocks[]；数组长度支持 split 多块场景。
    const groups = new Map<
      string,
      {
        created: (typeof blocks)[number][];
        released: (typeof blocks)[number][];
        trigger: string;
        createdAt: number | null;
      }
    >();
    for (const block of blocks) {
      const key = block.schedule_run_id ?? `none:${block.id}`;
      const group = groups.get(key) ?? {
        created: [],
        released: [],
        trigger: block.run_trigger ?? '',
        createdAt: block.run_created_at,
      };
      if (block.reason_code === 'RELEASED') group.released.push(block);
      else group.created.push(block);
      groups.set(key, group);
    }
    const entries: TaskScheduleHistoryEntry[] = [];
    for (const [key, group] of groups) {
      const runId = key.startsWith('none:') ? null : key;
      const baseTime =
        group.createdAt ?? group.created[0]?.start_at ?? group.released[0]?.start_at ?? 0;
      if (group.created.length > 0) {
        const createdReason = parseReason(group.created[0] ?? { reason_json: null });
        const previous = (
          Array.isArray(createdReason?.previousBlocks) ? createdReason.previousBlocks : []
        ).map((value) => {
          const item = value as { startAt?: unknown; endAt?: unknown };
          return {
            startAt: typeof item.startAt === 'string' ? item.startAt : '',
            endAt: typeof item.endAt === 'string' ? item.endAt : '',
          };
        }) as ScheduleHistoryTimeSpan[];
        entries.push({
          runId,
          trigger: group.trigger,
          occurredAt: new Date(baseTime).toISOString(),
          kind: previous.length > 0 ? 'RESCHEDULED' : 'SCHEDULED',
          reason: null,
          previousBlocks: previous,
          newBlocks: group.created.map(span),
          warnings: [],
        });
      } else {
        const first = group.released[0];
        const parsed = parseReason(first ?? { reason_json: null });
        const releasedAt =
          typeof parsed?.releasedAt === 'string'
            ? parsed.releasedAt
            : new Date(first?.deleted_at ?? baseTime).toISOString();
        entries.push({
          runId,
          trigger: group.trigger,
          occurredAt: releasedAt,
          kind: 'RELEASED',
          reason: typeof parsed?.reason === 'string' ? parsed.reason : null,
          previousBlocks: group.released.map(span),
          newBlocks: [],
          warnings: [],
        });
      }
    }
    const coveredRunIds = new Set(groups.keys());
    for (const warning of warnings) {
      if (coveredRunIds.has(warning.schedule_run_id)) continue;
      entries.push({
        runId: warning.schedule_run_id,
        trigger: warning.run_trigger,
        occurredAt: new Date(warning.run_created_at).toISOString(),
        kind: 'UNSCHEDULED',
        reason: null,
        previousBlocks: [],
        newBlocks: [],
        warnings: [
          {
            type: warning.warning_type,
            severity: warning.severity,
            message: warning.message,
          },
        ],
      });
    }
    entries.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
    return { taskId, entries };
  }

  public runDetail(runId: string): ScheduleRunDetail {
    const run = this.database.raw
      .prepare(
        `SELECT id, range_start, range_end, trigger_type, rule_version, status, summary_json, created_at
         FROM schedule_runs WHERE id = ?`,
      )
      .get(runId) as
      | {
          id: string;
          range_start: number;
          range_end: number;
          trigger_type: string;
          rule_version: string;
          status: string;
          summary_json: string;
          created_at: number;
        }
      | undefined;
    if (run === undefined) throw new Error('SCHEDULE_RUN_NOT_FOUND');
    const summary = JSON.parse(run.summary_json) as ScheduleRunDetail['summary'];
    const created = this.database.raw
      .prepare(
        `SELECT block.id, block.target_entity_id, block.start_at, block.end_at, block.reason_code, block.reason_json
         FROM schedule_blocks block
         WHERE block.schedule_run_id = ?`,
      )
      .all(runId) as {
      id: string;
      target_entity_id: string;
      start_at: number;
      end_at: number;
      reason_code: string | null;
      reason_json: string | null;
    }[];
    const released = summary.releasedBlocks.map((block) => ({
      taskId: block.taskId,
      startAt: new Date(block.startAt).toISOString(),
      endAt: new Date(block.endAt).toISOString(),
    }));
    const runWarnings = this.database.raw
      .prepare(
        `SELECT warning.entity_id, warning.warning_type, warning.severity, warning.message
         FROM schedule_warnings warning WHERE warning.schedule_run_id = ?`,
      )
      .all(runId) as {
      entity_id: string | null;
      warning_type: string;
      severity: string;
      message: string;
    }[];
    return {
      id: run.id,
      rangeStart: new Date(run.range_start).toISOString(),
      rangeEnd: new Date(run.range_end).toISOString(),
      trigger: run.trigger_type,
      status: run.status,
      ruleVersion: run.rule_version,
      createdAt: new Date(run.created_at).toISOString(),
      summary,
      createdBlocks: created.map((block) => {
        const parsed =
          block.reason_json === null
            ? undefined
            : (JSON.parse(block.reason_json) as {
                outcome?: unknown;
                previousBlocks?: unknown;
              });
        return {
          id: block.id,
          taskId: block.target_entity_id,
          startAt: new Date(block.start_at).toISOString(),
          endAt: new Date(block.end_at).toISOString(),
          reasonCode: block.reason_code,
          outcome: typeof parsed?.outcome === 'string' ? parsed.outcome : null,
          released: block.reason_code === 'RELEASED',
          previousBlocks: (Array.isArray(parsed?.previousBlocks) ? parsed.previousBlocks : []).map(
            (value) => {
              const item = value as { startAt?: unknown; endAt?: unknown };
              return {
                startAt: typeof item.startAt === 'string' ? item.startAt : '',
                endAt: typeof item.endAt === 'string' ? item.endAt : '',
              };
            },
          ),
        };
      }),
      releasedBlocks: released,
      warnings: runWarnings.map((warning) => ({
        entityId: warning.entity_id,
        warningType: warning.warning_type,
        severity: warning.severity,
        message: warning.message,
      })),
    };
  }

  private buildAvailability(rangeStart: number, rangeEnd: number): readonly AvailabilitySlot[] {
    const output: AvailabilitySlot[] = [];
    const now = this.clock.now().getTime();
    const schedulingFloor = Math.ceil(now / GRID_MILLISECONDS) * GRID_MILLISECONDS;
    for (
      let date = shanghaiLocalDate(rangeStart);
      localDateTimeToTimestamp(date, '00:00') < rangeEnd;
      date = nextLocalDate(date)
    ) {
      const template = this.routines.resolveTemplate(date);
      for (const segment of template.segments) {
        if (segment.segmentType !== 'WORK' && segment.segmentType !== 'LIFE') continue;
        const startAt = localDateTimeToTimestamp(date, segment.startTime);
        let endAt = localDateTimeToTimestamp(date, segment.endTime);
        if (endAt <= startAt) endAt += 86_400_000;
        output.push({
          startAt: Math.max(startAt, rangeStart, schedulingFloor),
          endAt: Math.min(endAt, rangeEnd),
          area: segment.segmentType,
        });
      }
    }
    return output.filter((slot) => slot.endAt > slot.startAt);
  }

  private buildRoutineTimeline(rangeStart: number, rangeEnd: number): readonly TimelineBlock[] {
    const output: TimelineBlock[] = [];
    for (
      let date = shanghaiLocalDate(rangeStart);
      localDateTimeToTimestamp(date, '00:00') < rangeEnd;
      date = nextLocalDate(date)
    ) {
      const template = this.routines.resolveTemplate(date);
      for (const segment of template.segments) {
        if (segment.segmentType !== 'SLEEP' && segment.segmentType !== 'REST') continue;
        const startAt = localDateTimeToTimestamp(date, segment.startTime);
        let endAt = localDateTimeToTimestamp(date, segment.endTime);
        if (endAt <= startAt) endAt += 86_400_000;
        if (endAt <= rangeStart || startAt >= rangeEnd) continue;
        output.push({
          id: `${template.id}:${date}:${segment.id}`,
          targetEntityId: null,
          title: segment.name,
          blockType: segment.segmentType,
          area: segment.segmentType === 'SLEEP' ? 'SLEEP' : 'LIFE',
          startAt: new Date(Math.max(startAt, rangeStart)).toISOString(),
          endAt: new Date(Math.min(endAt, rangeEnd)).toISOString(),
          source: 'ROUTINE',
          isLocked: segment.isImmovable,
          crossAreaWarning: false,
        });
      }
    }
    return output;
  }

  private listOccupied(rangeStart: number, rangeEnd: number): readonly OccupiedBlock[] {
    const blocks: OccupiedBlock[] = [];
    const areaByCategory = new Map<string, PreferredArea>(
      (
        this.database.raw.prepare('SELECT id, parent_area FROM categories').all() as {
          id: string;
          parent_area: PreferredArea;
        }[]
      ).map((row) => [row.id, row.parent_area]),
    );
    for (const event of this.actions.listEvents(rangeStart, rangeEnd)) {
      if (event.status !== 'SCHEDULED') continue;
      const area = areaByCategory.get(event.categoryId) ?? 'LIFE';
      blocks.push({
        id: event.id,
        targetEntityId: event.id,
        startAt: Date.parse(event.startAt),
        endAt: Date.parse(event.endAt),
        area,
        blockType: 'EVENT',
        isLocked: event.isImmovable,
      });
    }
    const scheduled = this.database.raw
      .prepare(
        `SELECT block.id, block.target_entity_id, block.start_at, block.end_at, block.area, block.is_locked
         FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.end_at > ? AND block.start_at < ?`,
      )
      .all(rangeStart, rangeEnd) as {
      id: string;
      target_entity_id: string | null;
      start_at: number;
      end_at: number;
      area: PreferredArea;
      is_locked: number;
    }[];
    blocks.push(
      ...scheduled.map((block) => ({
        id: block.id,
        targetEntityId: block.target_entity_id,
        startAt: block.start_at,
        endAt: block.end_at,
        area: block.area,
        blockType: 'TASK' as const,
        isLocked: block.is_locked === 1,
      })),
    );
    return blocks;
  }

  private categoryArea(categoryId: string): PreferredArea {
    const row = this.database.raw
      .prepare('SELECT parent_area FROM categories WHERE id = ?')
      .get(categoryId) as {
      parent_area: PreferredArea;
    };
    return row.parent_area;
  }

  private insertWarning(runId: string, warning: ScheduleWarning, now: number): void {
    const id = ulid();
    this.database.raw
      .prepare(
        `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'SCHEDULE_WARNING', ?, ?)`,
      )
      .run(id, now, now);
    this.database.raw
      .prepare(
        `INSERT INTO schedule_warnings(id, schedule_run_id, entity_id, warning_type, severity, message, details_json)
         VALUES (?, ?, ?, ?, ?, ?, '{}')`,
      )
      .run(id, runId, warning.entityId, warning.warningType, warning.severity, warning.message);
  }
}
