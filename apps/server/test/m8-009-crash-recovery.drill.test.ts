import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { FixedClock } from '@life-assistant/kernel';
import { SqliteDatabase, migrations } from '@life-assistant/database';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { afterEach, describe, expect, it } from 'vitest';

import { LocalRuntime } from '../src/runtime-probe.js';

/**
 * M8-009 崩溃、断电模拟和 WAL 恢复演练。
 *
 * 目标：证明 SQLite WAL（synchronous=NORMAL）在进程被强制终止、断电式文件快照、
 * 迁移中途崩溃、在线备份中断等场景下，已提交数据不丢失、未提交事务整体回滚、
 * 数据库始终可通过 quick_check / foreign_key_check，且完整 Runtime 重启后可用。
 */
const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
const latestSchemaVersion = migrations.at(-1)?.version ?? 0;
const betterSqlitePath = createRequire(import.meta.url).resolve('better-sqlite3');
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const waitForFile = async (path: string, timeoutMs = 20_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    await sleep(25);
  }
  throw new Error(`等待文件超时：${path}`);
};

const waitForMarkerValue = async (
  path: string,
  minValue: number,
  timeoutMs = 20_000,
): Promise<number> => {
  const deadline = Date.now() + timeoutMs;
  let last = 0;
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      last = Number.parseInt(readFileSync(path, 'utf8').trim(), 10);
      if (last >= minValue) return last;
    }
    await sleep(20);
  }
  throw new Error(`等待标记值超时（期望 ≥ ${String(minValue)}，当前 ${String(last)}）。`);
};

const waitForMarkerText = async (
  path: string,
  expected: string,
  timeoutMs = 20_000,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path) && readFileSync(path, 'utf8').trim() === expected) return;
    await sleep(20);
  }
  throw new Error(`等待标记文本超时：${expected}`);
};

const spawnDrillChild = (script: string, env: Record<string, string>): ChildProcess =>
  spawn(process.execPath, ['-e', script], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

const hardKill = (child: ChildProcess): void => {
  const pid = child.pid;
  if (pid === undefined) throw new Error('子进程没有 PID。');
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      encoding: 'utf8',
    });
    const stderr = result.stderr;
    const alreadyGone = result.status !== 0 && /not found|找不到进程|不存在/i.test(stderr);
    if (
      result.status !== 0 &&
      !alreadyGone &&
      child.exitCode === null &&
      child.signalCode === null
    ) {
      throw new Error(`强制终止失败：${stderr}`);
    }
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // 进程可能已经退出。
    }
  }
};

const waitProcessExit = async (child: ChildProcess, timeoutMs = 10_000): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      resolve();
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
};

const reopenQuickCheck = (path: string): readonly string[] => {
  const database = new SqliteDatabase(path, clock);
  try {
    return database.quickCheck();
  } finally {
    database.close();
  }
};

const committedWritesChildScript = `
  const fs = require('node:fs');
  const path = require('node:path');
  const Database = require(${JSON.stringify(betterSqlitePath)});
  fs.mkdirSync(path.dirname(process.env.DRILL_DB), { recursive: true });
  const db = new Database(process.env.DRILL_DB);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec('CREATE TABLE IF NOT EXISTS crash_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 1; i <= 60; i += 1) {
    db.prepare('INSERT INTO crash_probe(value) VALUES (?)').run('committed-' + i);
    fs.writeFileSync(process.env.DRILL_MARKER, String(i));
    if (i === 20) {
      // 保持数值标记，等待父进程在已提交状态下强制击杀。
      Atomics.wait(wait, 0, 0, 60000);
    }
    if (i % 5 === 0) Atomics.wait(wait, 0, 0, 10);
  }
  fs.writeFileSync(process.env.DRILL_MARKER, 'done');
  setInterval(() => {}, 1000);
`;

describe('M8-009 crash / power-loss drill and WAL recovery', () => {
  it('rolls back an in-flight transaction after a hard kill', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const marker = join(temporary.path, 'in-tx.marker');
    const script = `
      const fs = require('node:fs');
      const path = require('node:path');
      const Database = require(${JSON.stringify(betterSqlitePath)});
      fs.mkdirSync(path.dirname(process.env.DRILL_DB), { recursive: true });
      const db = new Database(process.env.DRILL_DB);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.exec('CREATE TABLE IF NOT EXISTS crash_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      db.exec('BEGIN IMMEDIATE');
      db.prepare('INSERT INTO crash_probe(value) VALUES (?)').run('in-flight');
      fs.writeFileSync(process.env.DRILL_MARKER, '1');
      setInterval(() => {}, 1000);
    `;
    const child = spawnDrillChild(script, {
      DRILL_DB: temporary.databasePath,
      DRILL_MARKER: marker,
    });
    try {
      await waitForFile(marker);
      hardKill(child);
      await waitProcessExit(child);
      await sleep(250);
      const database = new SqliteDatabase(temporary.databasePath, clock);
      try {
        expect(database.quickCheck()).toEqual(['ok']);
        expect(database.raw.prepare('SELECT COUNT(*) AS count FROM crash_probe').get()).toEqual({
          count: 0,
        });
      } finally {
        database.close();
      }
    } finally {
      hardKill(child);
    }
  }, 30_000);

  it('keeps every committed write after repeated hard kills without a checkpoint', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    for (let round = 1; round <= 10; round += 1) {
      const marker = join(temporary.path, `committed-${String(round)}.marker`);
      const child = spawnDrillChild(committedWritesChildScript, {
        DRILL_DB: temporary.databasePath,
        DRILL_MARKER: marker,
      });
      try {
        const committed = await waitForMarkerValue(marker, 20);
        hardKill(child);
        await waitProcessExit(child);
        await sleep(150);
        const database = new SqliteDatabase(temporary.databasePath, clock);
        try {
          expect(database.quickCheck()).toEqual(['ok']);
          expect(database.foreignKeyCheck()).toHaveLength(0);
          const row = database.raw.prepare('SELECT COUNT(*) AS count FROM crash_probe').get() as {
            count: number;
          };
          expect(row.count).toBeGreaterThanOrEqual(committed);
        } finally {
          database.close();
        }
      } finally {
        hardKill(child);
      }
    }
  }, 60_000);

  it('recovers a power-loss snapshot taken with a dirty WAL', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const marker = join(temporary.path, 'power.marker');
    const script = `
      const fs = require('node:fs');
      const path = require('node:path');
      const Database = require(${JSON.stringify(betterSqlitePath)});
      fs.mkdirSync(path.dirname(process.env.DRILL_DB), { recursive: true });
      const db = new Database(process.env.DRILL_DB);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.exec('CREATE TABLE IF NOT EXISTS crash_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      for (let i = 1; i <= 10; i += 1) {
        db.prepare('INSERT INTO crash_probe(value) VALUES (?)').run('power-' + i);
      }
      fs.writeFileSync(process.env.DRILL_MARKER, '1');
      setInterval(() => {}, 1000);
    `;
    const child = spawnDrillChild(script, {
      DRILL_DB: temporary.databasePath,
      DRILL_MARKER: marker,
    });
    try {
      await waitForFile(marker);
      // 模拟断电瞬间磁盘上的文件集合：主库 + WAL + SHM 同时拷贝。
      const snapshot = join(temporary.path, 'snapshot');
      mkdirSync(snapshot, { recursive: true });
      copyFileSync(temporary.databasePath, join(snapshot, 'life-assistant.db'));
      copyFileSync(`${temporary.databasePath}-wal`, join(snapshot, 'life-assistant.db-wal'));
      copyFileSync(`${temporary.databasePath}-shm`, join(snapshot, 'life-assistant.db-shm'));
      hardKill(child);
      await waitProcessExit(child);

      const recovered = new SqliteDatabase(join(snapshot, 'life-assistant.db'), clock);
      try {
        expect(recovered.quickCheck()).toEqual(['ok']);
        expect(recovered.raw.prepare('SELECT COUNT(*) AS count FROM crash_probe').get()).toEqual({
          count: 10,
        });
      } finally {
        recovered.close();
      }

      // 仅保留主库（WAL 丢失）也必须是一个有效数据库；这是 WAL 持久化边界。
      const lite = join(temporary.path, 'snapshot-lite');
      mkdirSync(lite, { recursive: true });
      copyFileSync(temporary.databasePath, join(lite, 'life-assistant.db'));
      expect(reopenQuickCheck(join(lite, 'life-assistant.db'))).toEqual(['ok']);
    } finally {
      hardKill(child);
    }
  }, 30_000);

  it('leaves a consistent schema when killed in the middle of a migration', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const slowMigration = {
      version: 18,
      name: 'drill-slow-migration',
      sql: `
CREATE TABLE drill_migration_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
WITH RECURSIVE s(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM s WHERE x < 1000)
INSERT INTO drill_migration_probe(value)
SELECT 'row-' || (a.x * 1000 + b.x) FROM s a, s b;
CREATE INDEX drill_migration_probe_value_idx ON drill_migration_probe(value);
`,
    };
    const drillMigrations = [
      ...migrations.slice(0, 16),
      { ...slowMigration, checksum: createHash('sha256').update(slowMigration.sql).digest('hex') },
    ];
    const childScript = `
      const fs = require('node:fs');
      const path = require('node:path');
      const Database = require(${JSON.stringify(betterSqlitePath)});
      fs.mkdirSync(path.dirname(process.env.DRILL_DB), { recursive: true });
      const db = new Database(process.env.DRILL_DB);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.exec(\`CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL, app_version TEXT NOT NULL)\`);
      const list = JSON.parse(fs.readFileSync(process.env.DRILL_MIGRATIONS, 'utf8'));
      const applied = new Map(
        db.prepare('SELECT version, checksum FROM schema_migrations').all()
          .map((row) => [row.version, row.checksum]),
      );
      for (let i = 0; i < list.length; i += 1) {
        const migration = list[i];
        if (applied.has(migration.version)) continue;
        if (i === list.length - 1) {
          fs.writeFileSync(process.env.DRILL_MARKER, 'migrating');
        }
        const apply = db.transaction(() => {
          db.exec(migration.sql);
          db.prepare(
            'INSERT INTO schema_migrations(version, name, checksum, applied_at, app_version) VALUES (?, ?, ?, ?, ?)',
          ).run(migration.version, migration.name, migration.checksum, Date.now(), '0.1.0');
        });
        apply();
        db.pragma('user_version = ' + migration.version);
      }
      fs.writeFileSync(process.env.DRILL_MARKER, 'done');
      setInterval(() => {}, 1000);
    `;
    const migrationsFile = join(temporary.path, 'drill-migrations.json');
    writeFileSync(migrationsFile, JSON.stringify(drillMigrations), 'utf8');
    if (drillMigrations.length !== 17 || drillMigrations.at(-1)?.version !== 18) {
      throw new Error('演练迁移列表不符合预期。');
    }

    let observedRollback = false;
    for (let round = 1; round <= 5; round += 1) {
      const marker = join(temporary.path, `migration-${String(round)}.marker`);
      // 每一轮使用独立数据库文件，避免上一轮已迁移的库被直接跳过。
      const roundDb = join(temporary.path, `round-${String(round)}`, 'life-assistant.db');
      const child = spawnDrillChild(childScript, {
        DRILL_DB: roundDb,
        DRILL_MARKER: marker,
        DRILL_MIGRATIONS: migrationsFile,
      });
      let childStderr = '';
      let childStdout = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        childStderr += chunk.toString('utf8');
      });
      child.stdout?.on('data', (chunk: Buffer) => {
        childStdout += chunk.toString('utf8');
      });
      try {
        try {
          await waitForMarkerText(marker, 'migrating');
        } catch (error: unknown) {
          const markerState = existsSync(marker)
            ? `marker='${readFileSync(marker, 'utf8')}'`
            : 'marker 未创建';
          const dbState = existsSync(roundDb)
            ? (() => {
                const probe = new SqliteDatabase(roundDb, clock);
                try {
                  const versionRow = probe.raw
                    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
                    .get() as { version: number };
                  const tableRow = probe.raw
                    .prepare(
                      "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'drill_migration_probe'",
                    )
                    .get();
                  return `db schema=${String(versionRow.version)} table=${String(
                    tableRow !== undefined,
                  )}`;
                } catch (probeError) {
                  return `db 打开失败：${probeError instanceof Error ? probeError.message : '未知'}`;
                } finally {
                  probe.close();
                }
              })()
            : 'db 不存在';
          throw new Error(
            `子进程未进入迁移阶段（exit=${String(child.exitCode)} signal=${String(
              child.signalCode,
            )}）${markerState} ${dbState} stderr=${childStderr.slice(0, 1500)} stdout=${childStdout.slice(
              0,
              1500,
            )}`,
            { cause: error },
          );
        }
        await sleep(15);
        hardKill(child);
        await waitProcessExit(child);
        await sleep(250);

        const database = new SqliteDatabase(roundDb, clock);
        try {
          expect(database.quickCheck()).toEqual(['ok']);
          const versionRow = database.raw
            .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
            .get() as { version: number };
          const tableRow = database.raw
            .prepare(
              "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'drill_migration_probe'",
            )
            .get();
          if (versionRow.version === 16) {
            observedRollback = true;
            expect(tableRow).toBeUndefined();
          } else {
            expect(versionRow.version).toBe(18);
            expect(tableRow).not.toBeUndefined();
            expect(
              database.raw.prepare('SELECT COUNT(*) AS count FROM drill_migration_probe').get(),
            ).toEqual({ count: 1_000_000 });
          }
          // 无论崩溃落在哪一步，重新迁移都必须能干净地补完。
          const result = database.migrate(drillMigrations);
          expect(result.toVersion).toBe(18);
          expect(
            database.raw.prepare('SELECT COUNT(*) AS count FROM drill_migration_probe').get(),
          ).toEqual({ count: 1_000_000 });
        } finally {
          database.close();
        }
      } finally {
        hardKill(child);
      }
    }
    expect(observedRollback).toBe(true);
  }, 120_000);

  it('recovers the full runtime after a hard kill during active writes', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const bootstrapPath = `${temporary.path}/bootstrap.json`;
    const dataDirectory = `${temporary.path}/data`;

    const runtime = new LocalRuntime({
      bootstrapPath,
      suggestedDataDirectory: `${temporary.path}/suggested`,
    });
    await runtime.initialize(dataDirectory, {
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 3,
      quickCaptureDefaultAction: 'INBOX',
    });
    const layout = runtime.getLayout();
    if (layout === undefined) throw new Error('数据目录未初始化');
    runtime.shared?.createCategory({ parentArea: 'WORK', moduleType: 'GENERIC', name: '基线分类' });
    runtime.close();

    const marker = join(temporary.path, 'runtime-writes.marker');
    const child = spawnDrillChild(committedWritesChildScript, {
      DRILL_DB: layout.database,
      DRILL_MARKER: marker,
    });
    try {
      const committed = await waitForMarkerValue(marker, 20);
      hardKill(child);
      await waitProcessExit(child);
      await sleep(300);

      const restarted = new LocalRuntime({
        bootstrapPath,
        suggestedDataDirectory: `${temporary.path}/suggested`,
      });
      await restarted.start();
      try {
        expect(restarted.isDatabaseConnected()).toBe(true);
        const database = restarted.database;
        if (database === undefined) throw new Error('重启后数据库未连接');
        expect(database.quickCheck()).toEqual(['ok']);
        expect(database.foreignKeyCheck()).toHaveLength(0);
        const versionRow = database.raw
          .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
          .get() as { version: number };
        expect(versionRow.version).toBe(latestSchemaVersion);
        const probeRow = database.raw
          .prepare('SELECT COUNT(*) AS count FROM crash_probe')
          .get() as { count: number };
        expect(probeRow.count).toBeGreaterThanOrEqual(committed);
        const categories = restarted.shared?.listCategories() ?? [];
        expect(categories.some((category) => category.name === '基线分类')).toBe(true);
        // 重启后的应用仍然可写。
        const created = restarted.shared?.createCategory({
          parentArea: 'LIFE',
          moduleType: 'GENERIC',
          name: '重启后新分类',
        });
        expect(created?.name).toBe('重启后新分类');
      } finally {
        restarted.close();
      }
    } finally {
      hardKill(child);
    }
  }, 60_000);

  it('keeps the source database intact when killed during an online backup', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const marker = join(temporary.path, 'backup.marker');
    const backupDestination = join(temporary.path, 'partial-backup.db');
    const script = `
      const fs = require('node:fs');
      const path = require('node:path');
      const Database = require(${JSON.stringify(betterSqlitePath)});
      fs.mkdirSync(path.dirname(process.env.DRILL_DB), { recursive: true });
      const db = new Database(process.env.DRILL_DB);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.exec('CREATE TABLE IF NOT EXISTS crash_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      const insert = db.prepare('INSERT INTO crash_probe(value) VALUES (?)');
      const bulk = db.transaction((count) => {
        for (let i = 1; i <= count; i += 1) insert.run('backup-' + i);
      });
      bulk(200000);
      const wait = new Int32Array(new SharedArrayBuffer(4));
      let signaled = false;
      (async () => {
        await db.backup(process.env.DRILL_BACKUP, {
          progress() {
            if (!signaled) {
              signaled = true;
              fs.writeFileSync(process.env.DRILL_MARKER, 'running');
              // 保持备份“在途”状态，等待父进程在备份进行中强制击杀。
              Atomics.wait(wait, 0, 0, 60000);
            }
            return undefined;
          },
        });
        fs.writeFileSync(process.env.DRILL_MARKER, 'done');
      })().catch((error) => {
        console.error(error);
        process.exit(1);
      });
      setInterval(() => {}, 1000);
    `;
    const child = spawnDrillChild(script, {
      DRILL_DB: temporary.databasePath,
      DRILL_MARKER: marker,
      DRILL_BACKUP: backupDestination,
    });
    try {
      let childStderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        childStderr += chunk.toString('utf8');
      });
      try {
        await waitForMarkerText(marker, 'running');
      } catch (error: unknown) {
        const markerState = existsSync(marker)
          ? `marker='${readFileSync(marker, 'utf8')}'`
          : 'marker 未创建';
        throw new Error(
          `备份子进程未进入备份阶段（exit=${String(child.exitCode)} signal=${String(
            child.signalCode,
          )}）${markerState} stderr=${childStderr.slice(0, 1500)}`,
          { cause: error },
        );
      }
      hardKill(child);
      await waitProcessExit(child);
      await sleep(250);
      // 源数据库在任何中断下都保持完整且可用。
      const database = new SqliteDatabase(temporary.databasePath, clock);
      try {
        expect(database.quickCheck()).toEqual(['ok']);
        expect(database.raw.prepare('SELECT COUNT(*) AS count FROM crash_probe').get()).toEqual({
          count: 200_000,
        });
      } finally {
        database.close();
      }
      // 重新执行一次完整备份必须成功，证明中断不影响后续备份能力。
      const backupPath = join(temporary.path, 'fresh-backup.db');
      const fresh = new SqliteDatabase(temporary.databasePath, clock);
      try {
        await fresh.backup(backupPath);
      } finally {
        fresh.close();
      }
      expect(reopenQuickCheck(backupPath)).toEqual(['ok']);
    } finally {
      hardKill(child);
    }
  }, 60_000);
});
