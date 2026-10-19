import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { NotificationRepository } from './notification-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

describe('NotificationRepository', () => {
  it('persists and lists a delivered notification instance', async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-14T09:00:00.000Z'));
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const repository = new NotificationRepository(database, clock);
      const targetId = '01J5TASK000000000000000000';
      database.raw
        .prepare(
          `INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'TASK',?,?)`,
        )
        .run(targetId, clock.now().getTime(), clock.now().getTime());
      const notification = repository.record({
        notificationType: 'REMINDER',
        targetEntityId: targetId,
        title: '喝水提醒',
        body: '该补充水分了。',
        severity: 'INFO',
        scheduledAt: '2026-08-14T09:00:00.000Z',
      });
      expect(repository.list()).toEqual([notification]);
      expect(notification.targetEntityType).toBe('TASK');
      expect(database.raw.prepare('SELECT notification_type FROM notifications').get()).toEqual({
        notification_type: 'REMINDER',
      });
    } finally {
      database.close();
      await directory.cleanup();
    }
  });
});
