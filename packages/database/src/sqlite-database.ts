import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

import BetterSqlite3, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { Clock } from '@life-assistant/kernel';

import { migrations, type Migration } from './migrations.js';

export interface MigrationResult {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly applied: readonly number[];
}

export class SqliteDatabase {
  public readonly raw: BetterSqliteDatabase;
  public readonly orm: BetterSQLite3Database;

  public constructor(
    path: string,
    private readonly clock: Clock,
  ) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.raw = new BetterSqlite3(path);
    try {
      this.raw.pragma('foreign_keys = ON');
      this.raw.pragma('journal_mode = WAL');
      this.raw.pragma('synchronous = NORMAL');
      this.raw.pragma('busy_timeout = 5000');
      this.raw.pragma('temp_store = MEMORY');
    } catch (error) {
      // 数据库文件非法时，释放已打开的句柄，避免 Windows 上文件被占用。
      this.raw.close();
      throw error;
    }
    this.orm = drizzle(this.raw);
  }

  public migrate(availableMigrations: readonly Migration[] = migrations): MigrationResult {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        app_version TEXT NOT NULL
      );
    `);

    const appliedRows = this.raw
      .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
      .all() as { version: number; checksum: string }[];
    const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));
    for (const migration of availableMigrations) {
      const checksum = applied.get(migration.version);
      const acceptedChecksums = [migration.checksum, ...(migration.acceptedChecksums ?? [])];
      if (checksum !== undefined && !acceptedChecksums.includes(checksum)) {
        throw new Error(`迁移 ${String(migration.version)} 的校验值已改变。`);
      }
    }

    const fromVersion = appliedRows.at(-1)?.version ?? 0;
    const pending = availableMigrations.filter((migration) => !applied.has(migration.version));
    const apply = this.raw.transaction((migration: Migration) => {
      this.raw.exec(migration.sql);
      this.raw
        .prepare(
          'INSERT INTO schema_migrations(version, name, checksum, applied_at, app_version) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          migration.version,
          migration.name,
          migration.checksum,
          this.clock.now().getTime(),
          '0.1.0',
        );
    });
    for (const migration of pending) {
      apply(migration);
      this.raw.pragma(`user_version = ${String(migration.version)}`);
    }
    const toVersion = availableMigrations.at(-1)?.version ?? 0;
    return { fromVersion, toVersion, applied: pending.map((migration) => migration.version) };
  }

  public transaction<T>(operation: () => T): T {
    return this.raw.transaction(operation)();
  }

  public quickCheck(): readonly string[] {
    const rows = this.raw.pragma('quick_check', { simple: false }) as {
      quick_check: unknown;
    }[];
    return rows.map((row) => String(row.quick_check));
  }

  public foreignKeyCheck(): readonly unknown[] {
    return this.raw.pragma('foreign_key_check', { simple: false }) as readonly unknown[];
  }

  public async backup(destination: string): Promise<void> {
    mkdirSync(dirname(destination), { recursive: true });
    await this.raw.backup(destination);
  }

  public close(): void {
    this.raw.pragma('wal_checkpoint(TRUNCATE)');
    this.raw.close();
  }
}
