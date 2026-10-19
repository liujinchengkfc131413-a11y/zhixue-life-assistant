import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { BenchmarkDataGenerator, type BenchmarkTargets } from './benchmark-data-generator.js';
import { SqliteDatabase } from './sqlite-database.js';

const clock = new FixedClock(new Date('2026-08-14T09:00:00.000Z'));

const smallTargets: BenchmarkTargets = {
  tasks: 500,
  chatSessions: 4,
  messagesPerSession: 10,
  goals: 10,
  plans: 20,
  events: 30,
  notes: 15,
  selfMediaContents: 8,
  devProjects: 5,
  learningResources: 8,
  shoppingItems: 12,
  recipes: 6,
  mealRecords: 15,
  exerciseCatalog: 5,
  workoutSessions: 8,
  entertainmentItems: 10,
  inboxItems: 6,
};

const openBenchmarkDatabase = async (): Promise<{
  directory: Awaited<ReturnType<typeof createTestDataDirectory>>;
  database: SqliteDatabase;
}> => {
  const directory = await createTestDataDirectory();
  const database = new SqliteDatabase(directory.databasePath, clock);
  database.migrate();
  return { directory, database };
};

describe('M8-007 benchmark data generator', () => {
  it('creates the requested record counts with valid foreign keys', async () => {
    const { directory, database } = await openBenchmarkDatabase();
    try {
      const generator = new BenchmarkDataGenerator(database, clock, 20260814);
      generator.generate(smallTargets);
      const verification = generator.verify();

      expect(verification.quickCheck).toEqual(['ok']);
      expect(verification.foreignKeyViolations).toEqual([]);
      expect(verification.counts).toMatchObject({
        tasks: 500,
        chatMessages: 4 * 10,
        chatSessions: 4,
        goals: 10,
        plans: 20,
        events: 30,
        notes: 15,
        selfMediaContents: 8,
        devProjects: 5,
        learningResources: 8,
        shoppingItems: 12,
        recipes: 6,
        mealRecords: 15,
        exerciseCatalog: 5,
        workoutSessions: 8,
        entertainmentItems: 10,
        inboxItems: 6,
      });
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('rebuilds the search projection for benchmark records', async () => {
    const { directory, database } = await openBenchmarkDatabase();
    try {
      const generator = new BenchmarkDataGenerator(database, clock, 20260814);
      generator.generate(smallTargets);
      const documentCount = generator.rebuildSearchIndex();
      const verification = generator.verify();

      expect(documentCount).toBeGreaterThan(0);
      expect(verification.counts.searchDocuments).toBe(documentCount);
      const searchable = database.raw
        .prepare(
          `SELECT COUNT(*) AS count FROM search_documents
           WHERE title LIKE '%#%' OR body LIKE '%基准%'`,
        )
        .get() as { count: number };
      expect(searchable.count).toBeGreaterThan(0);
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('produces deterministic output for the same seed and clock', async () => {
    const first = await openBenchmarkDatabase();
    const second = await openBenchmarkDatabase();
    try {
      const firstGenerator = new BenchmarkDataGenerator(first.database, clock, 424242);
      firstGenerator.generate(smallTargets);
      const secondGenerator = new BenchmarkDataGenerator(second.database, clock, 424242);
      secondGenerator.generate(smallTargets);

      const firstTitles = first.database.raw
        .prepare('SELECT title FROM tasks ORDER BY id LIMIT 50')
        .all() as { title: string }[];
      const secondTitles = second.database.raw
        .prepare('SELECT title FROM tasks ORDER BY id LIMIT 50')
        .all() as { title: string }[];

      expect(firstTitles).toEqual(secondTitles);

      const firstChat = first.database.raw
        .prepare('SELECT plain_text FROM chat_messages ORDER BY id LIMIT 20')
        .all() as { plain_text: string }[];
      const secondChat = second.database.raw
        .prepare('SELECT plain_text FROM chat_messages ORDER BY id LIMIT 20')
        .all() as { plain_text: string }[];

      expect(firstChat).toEqual(secondChat);
    } finally {
      first.database.close();
      second.database.close();
      await first.directory.cleanup();
      await second.directory.cleanup();
    }
  });

  it('supports creating a standalone benchmark database at a path', async () => {
    const { directory, database } = await openBenchmarkDatabase();
    const targetPath = `${directory.path}/standalone/life-assistant.benchmark.db`;
    try {
      const verification = BenchmarkDataGenerator.createAt(targetPath, clock, {
        seed: 20260814,
        targets: smallTargets,
      });
      expect(verification.quickCheck).toEqual(['ok']);
      expect(verification.foreignKeyViolations).toEqual([]);
      expect(verification.counts.tasks).toBe(500);
    } finally {
      database.close();
      await directory.cleanup();
    }
  });
});
