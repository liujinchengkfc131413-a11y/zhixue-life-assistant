import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { createTestDataDirectory } from '@life-assistant/test-support';
import { FixedClock } from '@life-assistant/kernel';
import { afterEach, describe, expect, it } from 'vitest';

import { BootstrapStore, DataDirectoryManager } from './data-directory.js';
import { ConsistencyRepository, IdempotencyConflictError } from './consistency-repository.js';
import { migrations } from './migrations.js';
import { SharedRepository } from './shared-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe('M1 data directory and SQLite kernel', () => {
  it('creates the controlled directory layout and stable metadata', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const manager = new DataDirectoryManager(
      new BootstrapStore(`${temporary.path}/bootstrap/config.json`),
      '0.1.0',
    );

    const first = await manager.initialize(`${temporary.path}/user-data`);
    const metadata = JSON.parse(await readFile(first.metadata, 'utf8')) as {
      dataDirectoryId: string;
    };
    const second = await manager.initialize(first.root);

    expect(second).toEqual(first);
    expect(metadata.dataDirectoryId).toHaveLength(26);
    expect(await manager.current()).toEqual(first);
  });

  it('uses WAL, enforces foreign keys and rolls back failed transactions', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const database = new SqliteDatabase(temporary.databasePath, clock);
    database.migrate();

    expect(database.raw.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(database.raw.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(() =>
      database.transaction(() => {
        database.raw
          .prepare(
            "INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'TEST', 1, 1)",
          )
          .run('01K26T7Y000000000000000000');
        throw new Error('rollback');
      }),
    ).toThrow('rollback');
    expect(database.raw.prepare('SELECT COUNT(*) AS count FROM entity_index').get()).toEqual({
      count: 0,
    });
    expect(() =>
      database.raw
        .prepare(`INSERT INTO tags(id, name) VALUES ('01K26T7Y000000000000000001', 'orphan')`)
        .run(),
    ).toThrow();
    database.close();
  });

  it('recovers committed WAL data after the writer process exits without closing SQLite', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const betterSqlitePath = createRequire(import.meta.url).resolve('better-sqlite3');
    const childScript = `
      const { mkdirSync } = require('node:fs');
      const { dirname } = require('node:path');
      const Database = require(${JSON.stringify(betterSqlitePath)});
      const databasePath = ${JSON.stringify(temporary.databasePath)};
      mkdirSync(dirname(databasePath), { recursive: true });
      const database = new Database(databasePath);
      database.pragma('journal_mode = WAL');
      database.exec("CREATE TABLE crash_probe(value TEXT NOT NULL); BEGIN IMMEDIATE; INSERT INTO crash_probe VALUES ('committed'); COMMIT;");
      process.exit(0);
    `;
    const child = spawnSync(process.execPath, ['-e', childScript], { encoding: 'utf8' });
    expect(child.status, child.stderr).toBe(0);

    const reopened = new SqliteDatabase(temporary.databasePath, clock);
    expect(reopened.raw.prepare('SELECT value FROM crash_probe').get()).toEqual({
      value: 'committed',
    });
    expect(reopened.quickCheck()).toEqual(['ok']);
    reopened.close();
  });

  it('migrates an earlier schema and rejects modified applied migrations', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const database = new SqliteDatabase(temporary.databasePath, clock);
    const firstMigration = migrations.at(0);
    const secondMigration = migrations.at(1);
    if (firstMigration === undefined || secondMigration === undefined) {
      throw new Error('测试需要两条迁移。');
    }
    expect(database.migrate([firstMigration])).toMatchObject({
      fromVersion: 0,
      toVersion: 1,
      applied: [1],
    });
    expect(database.migrate()).toMatchObject({
      fromVersion: 1,
      toVersion: 21,
      applied: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    });
    expect(() =>
      database.migrate([{ ...firstMigration, checksum: 'changed' }, secondMigration]),
    ).toThrow('校验值已改变');
    database.close();
  });

  it('accepts the known migration 20 checksum from pre-RC3 builds without weakening drift checks', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const database = new SqliteDatabase(temporary.databasePath, clock);
    database.migrate(migrations.slice(0, 20));
    database.raw
      .prepare('UPDATE schema_migrations SET checksum = ? WHERE version = 20')
      .run('5279dd2aaa730d8ad474898f3af7c4f9ad9bb830a6bbfc0cd3c5852d6658604f');

    expect(database.migrate()).toMatchObject({ fromVersion: 20, toVersion: 21, applied: [21] });
    expect(() => {
      database.raw
        .prepare('UPDATE schema_migrations SET checksum = ? WHERE version = 20')
        .run('unknown-checksum');
      database.migrate();
    }).toThrow('校验值已改变');
    database.close();
  });

  it('seeds settings and the seven editable category templates', () => {
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    const repository = new SharedRepository(database, clock);
    repository.seedDefaults();

    expect(repository.listSettings()).toHaveLength(7);
    expect(repository.listCategories()).toHaveLength(7);
    const category = repository.createCategory({
      parentArea: 'WORK',
      moduleType: 'GENERIC',
      name: '新分类',
    });
    expect(repository.updateCategory(category.id, 1, { name: '已重命名' }).name).toBe('已重命名');
    expect(repository.setCategoryArchived(category.id, true, 2).isArchived).toBe(true);
    database.close();
  });

  it('replays equal idempotent requests and rejects key misuse', () => {
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    const repository = new ConsistencyRepository(database, clock);
    let calls = 0;
    const execute = (request: unknown) =>
      repository.executeIdempotent('request-1', request, () => ({
        statusCode: 201,
        body: { calls: ++calls },
      }));

    expect(execute({ name: 'same' }).replayed).toBe(false);
    expect(execute({ name: 'same' })).toMatchObject({ replayed: true, body: { calls: 1 } });
    expect(() => execute({ name: 'different' })).toThrow(IdempotencyConflictError);
    database.close();
  });

  it('stores only a hashed confirmation token and consumes it once', () => {
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    const repository = new ConsistencyRepository(database, clock);
    const request = { id: 'tag-1', expectedVersion: 1 };
    const confirmation = repository.createConfirmation('TAG_DELETE', request, {
      summary: 'preview',
    });
    const stored = database.raw
      .prepare('SELECT token_hash FROM confirmations WHERE id = ?')
      .get(confirmation.id) as { token_hash: string };

    expect(stored.token_hash).not.toContain(confirmation.token);
    repository.confirm(confirmation.id, confirmation.token, 'TAG_DELETE', request);
    repository.markConfirmationExecuted(confirmation.id);
    expect(() => {
      repository.confirm(confirmation.id, confirmation.token, 'TAG_DELETE', request);
    }).toThrow('CONFIRMATION_INVALID');
    database.close();
  });
});
