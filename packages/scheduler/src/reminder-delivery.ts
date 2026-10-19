import type { Clock } from '@life-assistant/kernel';
import type { EventRecord, ReminderRecord, TaskRecord } from '@life-assistant/database';

export interface ReminderTargetResolver {
  getTask(id: string): TaskRecord | undefined;
  getEvent(id: string): EventRecord | undefined;
}

export interface ReminderNotificationSink {
  record(input: {
    notificationType: 'REMINDER';
    targetEntityId: string | null;
    title: string;
    body: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    scheduledAt: string;
    deliveredAt?: string | null;
    dedupeKey?: string | null;
  }): unknown;
  findByDedupeKey(dedupeKey: string): unknown;
}

export interface ReminderSource {
  list(targetEntityId?: string): readonly ReminderRecord[];
}

export interface DeliverRemindersResult {
  delivered: number;
  skipped: number;
}

/**
 * 计算提醒实际触发时间：
 * - ABSOLUTE：直接使用 trigger_at。
 * - OFFSET_BEFORE_START：目标日程开始时间减去 offset。
 * - OFFSET_BEFORE_DUE：目标任务截止时间减去 offset。
 */
const computeTriggerAt = (
  reminder: ReminderRecord,
  target: { type: 'TASK' | 'EVENT'; startAt: string | null; dueAt: string | null },
): number | null => {
  if (reminder.triggerMode === 'ABSOLUTE') {
    return reminder.triggerAt === null ? null : Date.parse(reminder.triggerAt);
  }
  const base =
    reminder.triggerMode === 'OFFSET_BEFORE_START'
      ? target.startAt === null
        ? null
        : Date.parse(target.startAt)
      : target.dueAt === null
        ? null
        : Date.parse(target.dueAt);
  if (base === null || reminder.offsetMinutes === null) return null;
  return base - reminder.offsetMinutes * 60_000;
};

export class ReminderDeliveryService {
  public constructor(
    private readonly source: ReminderSource,
    private readonly targets: ReminderTargetResolver,
    private readonly sink: ReminderNotificationSink,
    private readonly clock: Clock,
  ) {}

  public deliver(): DeliverRemindersResult {
    const now = this.clock.now();
    let delivered = 0;
    let skipped = 0;
    for (const reminder of this.source.list()) {
      if (!reminder.isEnabled) {
        skipped += 1;
        continue;
      }
      const target = this.resolveTarget(reminder);
      if (target === undefined) {
        skipped += 1;
        continue;
      }
      const triggerAt = computeTriggerAt(reminder, target);
      if (triggerAt === null || triggerAt > now.getTime()) {
        skipped += 1;
        continue;
      }
      const dedupeKey = `reminder:${reminder.id}`;
      if (this.sink.findByDedupeKey(dedupeKey) !== undefined) {
        skipped += 1;
        continue;
      }
      this.sink.record({
        notificationType: 'REMINDER',
        targetEntityId: reminder.targetEntityId,
        title: `提醒：${target.title}`,
        body: this.describe(reminder, target, triggerAt),
        severity: reminder.triggerMode === 'OFFSET_BEFORE_DUE' ? 'WARNING' : 'INFO',
        scheduledAt: new Date(triggerAt).toISOString(),
        deliveredAt: now.toISOString(),
        dedupeKey,
      });
      delivered += 1;
    }
    return { delivered, skipped };
  }

  private resolveTarget(
    reminder: ReminderRecord,
  ):
    | { type: 'TASK' | 'EVENT'; title: string; startAt: string | null; dueAt: string | null }
    | undefined {
    if (reminder.targetEntityType === 'TASK') {
      const task = this.targets.getTask(reminder.targetEntityId);
      return task === undefined
        ? undefined
        : {
            type: 'TASK',
            title: task.title,
            startAt: null,
            dueAt: task.dueAt,
          };
    }
    const event = this.targets.getEvent(reminder.targetEntityId);
    return event === undefined
      ? undefined
      : {
          type: 'EVENT',
          title: event.title,
          startAt: event.startAt,
          dueAt: null,
        };
  }

  private describe(
    reminder: ReminderRecord,
    target: { type: 'TASK' | 'EVENT'; title: string },
    triggerAt: number,
  ): string {
    if (reminder.triggerMode === 'ABSOLUTE') {
      return `预定于 ${new Date(triggerAt).toISOString()} 提醒。`;
    }
    if (reminder.offsetMinutes === null) return '';
    if (reminder.offsetMinutes >= 1440) {
      return `提前 ${String(Math.round(reminder.offsetMinutes / 1440))} 天提醒。`;
    }
    if (reminder.offsetMinutes >= 60) {
      return `提前 ${String(Math.round(reminder.offsetMinutes / 60))} 小时提醒。`;
    }
    return `提前 ${String(reminder.offsetMinutes)} 分钟提醒。`;
  }
}
