import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';
import type { ReminderRecord } from '@life-assistant/database';

import { ReminderDeliveryService } from './reminder-delivery.js';

const clock = new FixedClock(new Date('2026-08-14T10:00:00.000Z'));

const makeReminder = (overrides: Partial<ReminderRecord>): ReminderRecord => ({
  id: '01J9REMINDER0000000000000001',
  targetEntityId: '01J5TASK00000000000000000001',
  targetEntityType: 'TASK',
  triggerMode: 'OFFSET_BEFORE_DUE',
  triggerAt: null,
  offsetMinutes: 60,
  isEnabled: true,
  version: 1,
  createdAt: '2026-08-14T08:00:00.000Z',
  updatedAt: '2026-08-14T08:00:00.000Z',
  ...overrides,
});

describe('ReminderDeliveryService', () => {
  it('delivers a due offset reminder once with a dedupe key', () => {
    const reminder = makeReminder({
      offsetMinutes: 60,
      targetEntityType: 'TASK',
    });
    const recorded: Record<string, unknown>[] = [];
    const service = new ReminderDeliveryService(
      { list: () => [reminder] },
      {
        getTask: () =>
          ({
            id: reminder.targetEntityId,
            title: '提交周报',
            dueAt: '2026-08-14T10:30:00.000Z',
          }) as never,
        getEvent: () => undefined,
      },
      {
        record: (input) => {
          recorded.push(input);
          return { id: '01J9NOTIFICATION000000000000001' };
        },
        findByDedupeKey: () => undefined,
      },
      clock,
    );

    const result = service.deliver();

    expect(result.delivered).toBe(1);
    expect(recorded[0]).toMatchObject({
      notificationType: 'REMINDER',
      targetEntityId: reminder.targetEntityId,
      title: '提醒：提交周报',
      dedupeKey: 'reminder:01J9REMINDER0000000000000001',
      severity: 'WARNING',
    });
  });

  it('skips reminders that are not yet due', () => {
    const service = new ReminderDeliveryService(
      {
        list: () => [
          makeReminder({
            offsetMinutes: 60,
            targetEntityType: 'EVENT',
            triggerMode: 'OFFSET_BEFORE_START',
          }),
        ],
      },
      {
        getTask: () => undefined,
        getEvent: () =>
          ({ id: '01J5EVENT0000000000000000001', startAt: '2026-08-14T23:00:00.000Z' }) as never,
      },
      {
        record: () => {
          throw new Error('不应投递未到期提醒');
        },
        findByDedupeKey: () => undefined,
      },
      clock,
    );

    expect(service.deliver()).toEqual({ delivered: 0, skipped: 1 });
  });

  it('recalculates an event offset reminder from the latest start time', () => {
    const reminder = makeReminder({
      targetEntityType: 'EVENT',
      triggerMode: 'OFFSET_BEFORE_START',
      offsetMinutes: 60,
    });
    let startAt = '2026-08-14T12:00:00.000Z';
    const recorded: Record<string, unknown>[] = [];
    const service = new ReminderDeliveryService(
      { list: () => [reminder] },
      {
        getTask: () => undefined,
        getEvent: () =>
          ({
            id: reminder.targetEntityId,
            title: '移动后的日程',
            startAt,
          }) as never,
      },
      {
        record: (input) => {
          recorded.push(input);
          return { id: 'notification-after-move' };
        },
        findByDedupeKey: () => undefined,
      },
      clock,
    );

    expect(service.deliver()).toEqual({ delivered: 0, skipped: 1 });
    startAt = '2026-08-14T10:30:00.000Z';
    expect(service.deliver()).toEqual({ delivered: 1, skipped: 0 });
    expect(recorded[0]).toMatchObject({
      targetEntityId: reminder.targetEntityId,
      title: '提醒：移动后的日程',
      scheduledAt: '2026-08-14T09:30:00.000Z',
    });
  });

  it('skips an absolute reminder whose trigger time has passed but was already delivered', () => {
    const reminder = makeReminder({
      triggerMode: 'ABSOLUTE',
      triggerAt: '2026-08-14T09:00:00.000Z',
      targetEntityType: 'TASK',
    });
    const service = new ReminderDeliveryService(
      { list: () => [reminder] },
      {
        getTask: () =>
          ({
            id: reminder.targetEntityId,
            title: '提交周报',
            dueAt: '2026-08-14T09:30:00.000Z',
          }) as never,
        getEvent: () => undefined,
      },
      {
        record: () => {
          throw new Error('已投递提醒不应重复生成');
        },
        findByDedupeKey: () => ({ id: 'existing' }),
      },
      clock,
    );

    expect(service.deliver()).toEqual({ delivered: 0, skipped: 1 });
  });
});
