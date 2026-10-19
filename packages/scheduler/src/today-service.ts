import type { ActionRepository, SqliteDatabase } from '@life-assistant/database';
import { calculatePressure, type PreferredArea, type Priority } from '@life-assistant/domain';
import type { Clock } from '@life-assistant/kernel';

import type { ScheduleService, TimelineBlock } from './schedule-service.js';

const DAY_MINUTES = 1_440;
const SLOT_MINUTES = 15;
const SLOT_MILLISECONDS = SLOT_MINUTES * 60_000;

export interface TodayTotals {
  readonly sleepMinutes: number;
  readonly workMinutes: number;
  readonly lifeMinutes: number;
  readonly freeMinutes: number;
}

export interface TodayPlanItem {
  readonly id: string;
  readonly entityId: string | null;
  readonly title: string;
  readonly kind: 'TASK' | 'EVENT';
  readonly area: PreferredArea;
  readonly startAt: string;
  readonly endAt: string;
  readonly priority: Priority;
}

interface PressureTaskBrief {
  readonly id: string;
  readonly priority: Priority;
  readonly dueAt: string;
  readonly estimatedMinutes: number;
  readonly title: string;
}

const dayRange = (date: string): { start: number; end: number } => {
  const start = Date.parse(`${date}T00:00:00+08:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start)) throw new Error('INVALID_DATE');
  return { start, end: start + 86_400_000 };
};

const classifySlots = (
  blocks: readonly TimelineBlock[],
  start: number,
): readonly ('FREE' | 'LIFE' | 'WORK' | 'SLEEP')[] => {
  const slots = Array.from({ length: DAY_MINUTES / SLOT_MINUTES }, () => 'FREE' as const) as (
    'FREE' | 'LIFE' | 'WORK' | 'SLEEP'
  )[];
  const rank = { FREE: 0, LIFE: 1, WORK: 2, SLEEP: 3 } as const;
  for (const block of blocks) {
    if (block.blockType === 'REST') continue;
    const classification = block.area;
    const first = Math.max(0, Math.floor((Date.parse(block.startAt) - start) / SLOT_MILLISECONDS));
    const last = Math.min(
      slots.length,
      Math.ceil((Date.parse(block.endAt) - start) / SLOT_MILLISECONDS),
    );
    for (let index = first; index < last; index += 1) {
      const current = slots[index];
      if (current !== undefined && rank[classification] > rank[current])
        slots[index] = classification;
    }
  }
  return slots;
};

const totalsFromSlots = (slots: readonly ('FREE' | 'LIFE' | 'WORK' | 'SLEEP')[]): TodayTotals => {
  const minutes = (kind: (typeof slots)[number]) =>
    slots.filter((slot) => slot === kind).length * SLOT_MINUTES;
  return {
    sleepMinutes: minutes('SLEEP'),
    workMinutes: minutes('WORK'),
    lifeMinutes: minutes('LIFE'),
    freeMinutes: minutes('FREE'),
  };
};

const longestWorkRun = (slots: readonly ('FREE' | 'LIFE' | 'WORK' | 'SLEEP')[]): number => {
  let current = 0;
  let longest = 0;
  for (const slot of slots) {
    current = slot === 'WORK' ? current + SLOT_MINUTES : 0;
    longest = Math.max(longest, current);
  }
  return longest;
};

const freeTimeFromSlots = (
  slots: readonly ('FREE' | 'LIFE' | 'WORK' | 'SLEEP')[],
  dayStart: number,
): readonly { startAt: string; endAt: string; minutes: number }[] => {
  const output: { startAt: string; endAt: string; minutes: number }[] = [];
  let startIndex: number | undefined;
  for (let index = 0; index <= slots.length; index += 1) {
    if (slots[index] === 'FREE' && startIndex === undefined) startIndex = index;
    if (slots[index] !== 'FREE' && startIndex !== undefined) {
      const startAt = dayStart + startIndex * SLOT_MILLISECONDS;
      const endAt = dayStart + index * SLOT_MILLISECONDS;
      output.push({
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        minutes: (endAt - startAt) / 60_000,
      });
      startIndex = undefined;
    }
  }
  return output;
};

export class TodayService {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly actions: ActionRepository,
    private readonly schedules: ScheduleService,
    private readonly clock: Clock,
  ) {}

  public getToday(date: string): {
    readonly date: string;
    readonly timeZone: 'Asia/Shanghai';
    readonly serverNow: string;
    readonly timelineVersion: number;
    readonly blocks: readonly TimelineBlock[];
    readonly plan: readonly TodayPlanItem[];
    readonly freeTime: readonly {
      readonly startAt: string;
      readonly endAt: string;
      readonly minutes: number;
    }[];
    readonly totals: TodayTotals;
    readonly pressure: ReturnType<typeof calculatePressure>;
    readonly notifications: readonly unknown[];
    readonly suggestions: readonly unknown[];
  } {
    const { start, end } = dayRange(date);
    const blocks = this.schedules.listTimeline(start, end);
    const slots = classifySlots(blocks, start);
    const totals = totalsFromSlots(slots);
    const taskById = this.pressureTasks(start, end);
    const events = this.actions.listEvents(start, end);
    const eventById = new Map(events.map((event) => [event.id, event]));
    const plan: TodayPlanItem[] = blocks.flatMap((block) => {
      if (block.blockType !== 'TASK' && block.blockType !== 'EVENT') return [];
      const task = block.targetEntityId === null ? undefined : taskById.get(block.targetEntityId);
      const event = block.targetEntityId === null ? undefined : eventById.get(block.targetEntityId);
      return [
        {
          id: block.id,
          entityId: block.targetEntityId,
          title: block.title,
          kind: block.blockType,
          area: block.area as PreferredArea,
          startAt: block.startAt,
          endAt: block.endAt,
          priority: task?.priority ?? event?.priority ?? 'NORMAL',
        },
      ];
    });
    const scheduledMinutes = new Map<string, number>();
    for (const item of plan) {
      if (item.kind !== 'TASK' || item.entityId === null) continue;
      scheduledMinutes.set(
        item.entityId,
        (scheduledMinutes.get(item.entityId) ?? 0) +
          (Date.parse(item.endAt) - Date.parse(item.startAt)) / 60_000,
      );
    }
    const pressure = calculatePressure({
      dayEnd: end,
      awakeMinutes: DAY_MINUTES - totals.sleepMinutes,
      workMinutes: totals.workMinutes,
      lifeMinutes: totals.lifeMinutes,
      freeMinutes: totals.freeMinutes,
      longestContinuousWorkMinutes: longestWorkRun(slots),
      tasks: [...taskById.values()].map((task) => ({
        priority: task.priority,
        dueAt: Date.parse(task.dueAt),
        estimatedMinutes: task.estimatedMinutes,
        scheduledMinutes: scheduledMinutes.get(task.id) ?? 0,
      })),
      ...this.pressureCounts(end),
    });
    const versionRow = this.database.raw
      .prepare(
        `SELECT COALESCE(MAX(updated_at), 0) AS version FROM entity_index WHERE entity_type IN ('TASK','EVENT','SCHEDULE_BLOCK')`,
      )
      .get() as { version: number };
    return {
      date,
      timeZone: 'Asia/Shanghai',
      serverNow: this.clock.now().toISOString(),
      timelineVersion: versionRow.version,
      blocks,
      plan,
      freeTime: freeTimeFromSlots(slots, start),
      totals,
      pressure,
      notifications: [],
      suggestions: [],
    };
  }

  /**
   * 仅加载今日有排程块的任务用于计划展示与压力加权，
   * 避免在 10 万级任务量下全量加载未完成任务导致今日聚合超时。
   */
  private pressureTasks(dayStart: number, dayEnd: number): Map<string, PressureTaskBrief> {
    const scheduledIds = this.database.raw
      .prepare(
        `SELECT DISTINCT block.target_entity_id AS id FROM schedule_blocks block
         JOIN entity_index entity ON entity.id = block.id AND entity.deleted_at IS NULL
         WHERE block.block_type = 'TASK' AND block.start_at >= ? AND block.end_at <= ?
           AND block.target_entity_id IS NOT NULL`,
      )
      .all(dayStart, dayEnd) as { id: string }[];
    const ids = scheduledIds.map((row) => row.id);
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.database.raw
      .prepare(
        `SELECT resource.id, resource.priority, resource.due_at, resource.estimated_minutes,
                resource.title
         FROM tasks resource
         JOIN entity_index entity ON entity.id = resource.id AND entity.deleted_at IS NULL
         WHERE resource.id IN (${placeholders})`,
      )
      .all(...ids) as {
      id: string;
      priority: Priority;
      due_at: number;
      estimated_minutes: number;
      title: string;
    }[];
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          priority: row.priority,
          dueAt: new Date(row.due_at).toISOString(),
          estimatedMinutes: row.estimated_minutes,
          title: row.title,
        },
      ]),
    );
  }

  /** 统计压力所需的逾期、今日到期与紧急任务数量（利用索引，避免全表扫描）。 */
  private pressureCounts(dayEnd: number): {
    overdueCount: number;
    dueTodayCount: number;
    urgentCount: number;
  } {
    // 软删除任务不参与排程与今日聚合，直接统计 tasks 表可复用
    // tasks_status_due_idx(status, due_at) / tasks_priority_due_active_idx 索引。
    const overdueRow = this.database.raw
      .prepare(
        `SELECT COUNT(*) AS count FROM tasks
         WHERE status IN ('TODO','IN_PROGRESS') AND due_at < ?`,
      )
      .get(dayEnd - 86_400_000) as { count: number };
    const dueTodayRow = this.database.raw
      .prepare(
        `SELECT COUNT(*) AS count FROM tasks
         WHERE status IN ('TODO','IN_PROGRESS') AND due_at >= ? AND due_at < ?`,
      )
      .get(dayEnd - 86_400_000, dayEnd) as { count: number };
    const urgentRow = this.database.raw
      .prepare(
        `SELECT COUNT(*) AS count FROM tasks
         WHERE status IN ('TODO','IN_PROGRESS') AND priority = 'URGENT'`,
      )
      .get() as { count: number };
    return {
      overdueCount: overdueRow.count,
      dueTodayCount: dueTodayRow.count,
      urgentCount: urgentRow.count,
    };
  }
}

export const assertTodayTotals = (totals: TodayTotals): void => {
  if (
    totals.sleepMinutes + totals.workMinutes + totals.lifeMinutes + totals.freeMinutes !==
    DAY_MINUTES
  ) {
    throw new Error('INVALID_TODAY_TOTALS');
  }
};
