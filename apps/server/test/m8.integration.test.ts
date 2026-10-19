import { createTestDataDirectory } from '@life-assistant/test-support';
import {
  HolidayOverrideRemoveEnvelopeSchema,
  HolidaysEnvelopeSchema,
  HolidayUpdateResultEnvelopeSchema,
  EventEnvelopeSchema,
  MutationEnvelopeSchema,
  NotificationsEnvelopeSchema,
  ReminderEnvelopeSchema,
  RemindersEnvelopeSchema,
} from '@life-assistant/contracts';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M8 reminders and notifications API', () => {
  it('creates a task reminder, delivers it, and supports read/snooze actions', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      suggestedDataDirectory: `${temporary.path}/suggested`,
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/chosen-data` },
      });

      // 创建任务
      const categoriesResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/categories',
      });
      const categoriesBody: { data: { id: string; parentArea: string }[] } =
        categoriesResponse.json();
      const categories = categoriesBody.data;
      const categoryId = categories.find((category) => category.parentArea === 'WORK')?.id;
      if (categoryId === undefined) throw new Error('没有可用工作分类');
      const createTaskResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: {
          categoryId,
          title: '提交周报',
          dueAt: '2026-08-13T12:00:00.000Z',
          estimatedMinutes: 60,
          isFlexible: true,
          isSplittable: false,
          preferredArea: 'WORK',
        },
      });
      if (createTaskResponse.statusCode !== 201) {
        throw new Error(`任务创建失败：${String(createTaskResponse.statusCode)}`);
      }
      const taskResponseBody: { data: { id: string } } = createTaskResponse.json();
      const taskId = taskResponseBody.data.id;

      // 创建偏移提醒
      const reminder = await app.inject({
        method: 'POST',
        url: '/api/v1/reminders',
        payload: {
          targetEntityId: taskId,
          triggerMode: 'OFFSET_BEFORE_DUE',
          offsetMinutes: 30,
        },
      });
      expect(reminder.statusCode).toBe(201);
      const reminderData = ReminderEnvelopeSchema.parse(reminder.json()).data;
      expect(reminderData).toMatchObject({
        targetEntityId: taskId,
        targetEntityType: 'TASK',
        triggerMode: 'OFFSET_BEFORE_DUE',
        offsetMinutes: 30,
        isEnabled: true,
        version: 1,
      });

      // 列表与筛选
      const list = await app.inject({ method: 'GET', url: '/api/v1/reminders' });
      expect(RemindersEnvelopeSchema.parse(list.json()).data).toHaveLength(1);
      const filtered = await app.inject({
        method: 'GET',
        url: `/api/v1/reminders?targetEntityId=${taskId}`,
      });
      expect(RemindersEnvelopeSchema.parse(filtered.json()).data).toHaveLength(1);

      // 更新提醒（带 If-Match）
      const updated = await app.inject({
        method: 'PATCH',
        url: `/api/v1/reminders/${reminderData.id}`,
        headers: { 'if-match': '"1"' },
        payload: { expectedVersion: 1, offsetMinutes: 10 },
      });
      expect(updated.statusCode).toBe(200);
      expect(ReminderEnvelopeSchema.parse(updated.json()).data.offsetMinutes).toBe(10);

      // 手动触发投递后台任务
      const delivery = runtime.reminderDelivery?.deliver();
      expect(delivery).toEqual({ delivered: 1, skipped: 0 });

      const notifications = await app.inject({ method: 'GET', url: '/api/v1/notifications' });
      const notificationList = NotificationsEnvelopeSchema.parse(notifications.json()).data;
      expect(notificationList).toHaveLength(1);
      expect(notificationList[0]).toMatchObject({
        notificationType: 'REMINDER',
        targetEntityId: taskId,
        title: '提醒：提交周报',
      });
      const notificationId = notificationList[0]?.id;
      if (notificationId === undefined) throw new Error('通知未生成');

      // 标记已读
      const read = await app.inject({
        method: 'POST',
        url: `/api/v1/notifications/${notificationId}:read`,
      });
      expect(read.statusCode).toBe(200);
      expect(MutationEnvelopeSchema.parse(read.json()).data).toEqual({ success: true });
      const afterRead = NotificationsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/notifications' })).json(),
      ).data;
      expect(afterRead[0]?.readAt).not.toBeNull();

      // 稍后提醒（先清空已读再 snooze）
      await app.inject({
        method: 'POST',
        url: `/api/v1/notifications/${notificationId}:read`,
      });
      const snooze = await app.inject({
        method: 'POST',
        url: `/api/v1/notifications/${notificationId}:snooze`,
        payload: { snoozedUntil: new Date(Date.now() + 3_600_000).toISOString() },
      });
      expect(snooze.statusCode).toBe(200);

      // 全部已读
      await app.inject({
        method: 'POST',
        url: '/api/v1/notifications:read-all',
      });
      const afterAll = NotificationsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/notifications' })).json(),
      ).data;
      expect(afterAll.every((item) => item.readAt !== null)).toBe(true);

      // 删除提醒
      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/v1/reminders/${reminderData.id}`,
        headers: { 'if-match': '"2"' },
        payload: { expectedVersion: 2 },
      });
      expect(removed.statusCode).toBe(204);
      expect(
        RemindersEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/reminders' })).json(),
        ).data,
      ).toHaveLength(0);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('creates and lists multiple reminders for an event', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/chosen-data` },
      });
      const categories = (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json<{
        data: { id: string; parentArea: string }[];
      }>().data;
      const categoryId = categories.find((category) => category.parentArea === 'WORK')?.id;
      if (categoryId === undefined) throw new Error('没有可用工作分类');
      const event = EventEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: {
              categoryId,
              title: '日程多提醒验收',
              startAt: '2026-09-05T02:00:00.000Z',
              endAt: '2026-09-05T03:00:00.000Z',
              eventType: 'MEETING',
              priority: 'NORMAL',
            },
          })
        ).json(),
      ).data;

      for (const offsetMinutes of [10, 60]) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/reminders',
          payload: {
            targetEntityId: event.id,
            triggerMode: 'OFFSET_BEFORE_START',
            offsetMinutes,
          },
        });
        expect(response.statusCode).toBe(201);
        expect(ReminderEnvelopeSchema.parse(response.json()).data).toMatchObject({
          targetEntityId: event.id,
          targetEntityType: 'EVENT',
          triggerMode: 'OFFSET_BEFORE_START',
          offsetMinutes,
        });
      }

      const reminders = RemindersEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/reminders?targetEntityId=${event.id}`,
          })
        ).json(),
      ).data;
      expect(reminders.map((item) => item.offsetMinutes)).toEqual([10, 60]);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('applies system holiday updates without overriding user overrides', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      suggestedDataDirectory: `${temporary.path}/suggested`,
      holidayProvider: new (await import('@life-assistant/scheduler')).HttpHolidayProvider(
        'https://mock.invalid/holidays.json',
        () =>
          Promise.resolve({
            holidays: [
              { date: '2026-10-01', name: '国庆节', dayType: 'HOLIDAY' },
              { date: '2026-09-27', name: '国庆调休', dayType: 'MAKEUP_WORKDAY' },
            ],
          }),
      ),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/chosen-data` },
      });

      // 用户先手动覆盖 10-01
      const override = await app.inject({
        method: 'PUT',
        url: '/api/v1/holidays/2026-10-01',
        payload: { name: '我的纪念日', dayType: 'HOLIDAY' },
      });
      expect(override.statusCode).toBe(204);

      // 系统更新
      const update = await app.inject({
        method: 'POST',
        url: '/api/v1/holidays:update',
        payload: { year: 2026 },
      });
      if (update.statusCode !== 200) {
        throw new Error(
          `节假日更新失败 ${String(update.statusCode)}: ${JSON.stringify(update.json())}`,
        );
      }
      const result = HolidayUpdateResultEnvelopeSchema.parse(update.json()).data;
      expect(result).toMatchObject({ providerId: 'http-holiday-feed', year: 2026, applied: 1 });
      expect(result.preservedUserOverrides).toBe(1);

      // 用户覆盖保留，系统数据应用于其余日期
      const holidays = HolidaysEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/holidays?year=2026' })).json(),
      ).data;
      const octFirst = holidays.find((item) => item.localDate === '2026-10-01');
      expect(octFirst).toMatchObject({ name: '我的纪念日', source: 'USER_OVERRIDE' });
      expect(
        holidays.some((item) => item.localDate === '2026-09-27' && item.source === 'SYSTEM_UPDATE'),
      ).toBe(true);

      // 移除用户覆盖：还原为系统数据（系统更新再次生效）
      const remove = await app.inject({
        method: 'DELETE',
        url: '/api/v1/holidays/2026-10-01/override',
      });
      expect(remove.statusCode).toBe(200);
      expect(HolidayOverrideRemoveEnvelopeSchema.parse(remove.json()).data).toEqual({
        removed: true,
      });

      const afterRemove = HolidaysEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/holidays?year=2026' })).json(),
      ).data;
      expect(afterRemove.find((item) => item.localDate === '2026-10-01')).toBeUndefined();
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
});
