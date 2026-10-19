import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { ReminderRepository } from './reminder-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

describe('ReminderRepository', () => {
  it('creates, lists, updates and removes reminders with version checks', async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-14T09:00:00.000Z'));
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const now = clock.now().getTime();
      const shared = new (await import('./shared-repository.js')).SharedRepository(database, clock);
      shared.seedDefaults();
      const categoryId = (
        database.raw.prepare('SELECT id FROM categories LIMIT 1').get() as { id: string }
      ).id;
      database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, created_at, updated_at)
           VALUES (?, 'TASK', ?, ?)`,
        )
        .run('01J5TASK000000000000000000', now, now);
      database.raw
        .prepare(
          `INSERT INTO tasks(id, category_id, title, status, priority, due_at, estimated_minutes, is_flexible, is_splittable, preferred_area)
           VALUES (?, ?, '提交周报', 'TODO', 'NORMAL', ?, 60, 1, 0, 'WORK')`,
        )
        .run('01J5TASK000000000000000000', categoryId, now + 3_600_000);
      const repository = new ReminderRepository(database, clock);

      const created = repository.create({
        targetEntityId: '01J5TASK000000000000000000',
        triggerMode: 'OFFSET_BEFORE_DUE',
        offsetMinutes: 60,
      });
      expect(created).toMatchObject({
        targetEntityType: 'TASK',
        triggerMode: 'OFFSET_BEFORE_DUE',
        offsetMinutes: 60,
        isEnabled: true,
        version: 1,
      });
      expect(repository.list()).toHaveLength(1);
      expect(repository.list('01J5TASK000000000000000000')).toHaveLength(1);
      expect(repository.list('01J5EVENT000000000000000000')).toHaveLength(0);

      const updated = repository.update(created.id, 1, { offsetMinutes: 120 });
      expect(updated.offsetMinutes).toBe(120);
      expect(updated.version).toBe(2);

      expect(() => repository.update(created.id, 1, { isEnabled: false })).toThrow(
        'VERSION_CONFLICT',
      );

      repository.remove(created.id, 2);
      expect(repository.get(created.id)).toBeUndefined();
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('rejects reminders targeting missing or non-task/event entities', async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-14T09:00:00.000Z'));
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const repository = new ReminderRepository(database, clock);
      expect(() =>
        repository.create({
          targetEntityId: '01J5TASK000000000000000001',
          triggerMode: 'OFFSET_BEFORE_DUE',
          offsetMinutes: 30,
        }),
      ).toThrow('REMINDER_TARGET_NOT_FOUND');
      expect(() =>
        repository.create({
          targetEntityId: '01J5TASK000000000000000002',
          triggerMode: 'ABSOLUTE',
        }),
      ).toThrow('INVALID_REMINDER');
    } finally {
      database.close();
      await directory.cleanup();
    }
  });
});
