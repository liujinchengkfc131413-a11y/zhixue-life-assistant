import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import AdmZip from 'adm-zip';
import { BackupEnvelopeSchema } from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import {
  BootstrapStore,
  DataDirectoryManager,
  SharedRepository,
  SqliteDatabase,
  migrations,
  type DataDirectoryLayout,
} from '@life-assistant/database';
import { BackupService } from '@life-assistant/file-storage';
import { InMemoryCredentialStore, type CredentialStore } from '@life-assistant/ai-adapters';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

/**
 * M8-010 备份恢复、目录迁移和升级演练。
 *
 * 目标：在真实 SQLite + 文件系统上验证——
 * 1) 损坏备份（校验和不匹配 / 数据库载荷非法）在触碰当前数据前被拒绝；
 * 2) 恢复切换失败时自动回滚到原数据目录并保持应用可用；
 * 3) 备份失败记录 FAILED 且不影响后续备份；
 * 4) 目录迁移失败（目标非空 / 目标父级非法 / 目标嵌套）时原目录保持活动；
 * 5) 旧版本数据升级（v11→v17 自动升级前备份、v16→v17）数据保留且完整性通过；
 * 6) 旧版本备份跨版本恢复到当前版本并完成迁移。
 */
const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
const latestSchemaVersion = migrations.at(-1)?.version ?? 0;
const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

const taskId = '01K26T7Y0000000000000000T1';

const newRuntime = (temporaryPath: string, credentialStore?: CredentialStore): LocalRuntime =>
  new LocalRuntime({
    bootstrapPath: join(temporaryPath, 'bootstrap.json'),
    suggestedDataDirectory: join(temporaryPath, 'suggested'),
    ...(credentialStore === undefined ? {} : { credentialStore }),
  });

const initRuntime = async (
  temporaryPath: string,
  options: {
    includeDemoData?: boolean;
    backupFrequency?: 'DAILY' | 'WEEKLY' | 'MANUAL';
    dataDirectory?: string;
    credentialStore?: CredentialStore;
  } = {},
): Promise<{ runtime: LocalRuntime; dataDirectory: string }> => {
  const runtime = newRuntime(temporaryPath, options.credentialStore);
  const dataDirectory = options.dataDirectory ?? join(temporaryPath, 'data');
  await runtime.initialize(dataDirectory, {
    includeDemoData: options.includeDemoData ?? false,
    backupFrequency: options.backupFrequency ?? 'MANUAL',
    backupRetentionCount: 3,
    quickCaptureDefaultAction: 'INBOX',
  });
  return { runtime, dataDirectory };
};

const listDirectory = async (root: string): Promise<readonly string[]> => {
  const output: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) output.push(path);
    }
  };
  await visit(root);
  return output;
};

/** 构造一个“外部一致但数据库载荷非法”的备份包（校验和与内容匹配，载荷是垃圾字节）。 */
const buildFakeBackup = async (path: string, dbBytes: Buffer): Promise<void> => {
  const zip = new AdmZip();
  const manifest = {
    formatVersion: 1,
    appVersion: '0.1.0',
    schemaVersion: 17,
    generatedAt: '2026-08-11T00:00:00.000Z',
    installationId: 'fake-install',
    fileCount: 2,
  };
  const settings = '{}';
  const dbHash = createHash('sha256').update(dbBytes).digest('hex');
  const settingsHash = createHash('sha256').update(settings).digest('hex');
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest), 'utf8'));
  zip.addFile(
    'checksums.sha256',
    Buffer.from(
      `${dbHash}  database/life-assistant.db\n${settingsHash}  settings/non-sensitive.json\n`,
      'utf8',
    ),
  );
  zip.addFile('database/life-assistant.db', dbBytes);
  zip.addFile('settings/non-sensitive.json', Buffer.from(settings, 'utf8'));
  await zip.writeZipPromise(path);
};

/** 构造旧版本数据目录（迁移到 upTo 版本）并写入一个遗留任务。 */
const buildOldDataDirectory = async (
  root: string,
  upTo: number,
): Promise<{ layout: DataDirectoryLayout; categoryId: string }> => {
  const manager = new DataDirectoryManager(
    new BootstrapStore(join(root, 'bootstrap.json')),
    '0.1.0',
  );
  const layout = await manager.initialize(join(root, 'data'));
  const database = new SqliteDatabase(layout.database, clock);
  database.migrate(migrations.slice(0, upTo));
  const shared = new SharedRepository(database, clock);
  shared.seedDefaults();
  const categoryRow = database.raw
    .prepare("SELECT id FROM categories WHERE parent_area = 'WORK' LIMIT 1")
    .get() as { id: string } | undefined;
  if (categoryRow === undefined) throw new Error('旧版本数据目录缺少分类。');
  const now = clock.now().getTime();
  database.transaction(() => {
    database.raw
      .prepare(
        `INSERT INTO entity_index(id, entity_type, owner_id, version, created_at, updated_at)
         VALUES (?, 'TASK', 'local-user', 1, ?, ?)`,
      )
      .run(taskId, now, now);
    database.raw
      .prepare(
        `INSERT INTO tasks(id, category_id, title, status, priority, due_at, estimated_minutes, is_flexible, is_splittable, preferred_area)
         VALUES (?, ?, '旧版本遗留任务', 'TODO', 'NORMAL', ?, 60, 1, 0, 'WORK')`,
      )
      .run(taskId, categoryRow.id, now + 86_400_000);
  });
  database.close();
  return { layout, categoryId: categoryRow.id };
};

const readTaskTitle = (databasePath: string): string | undefined => {
  const database = new SqliteDatabase(databasePath, clock);
  try {
    const row = database.raw.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId) as
      { title: string } | undefined;
    return row?.title;
  } finally {
    database.close();
  }
};

describe('M8-010 backup restore, directory migration and upgrade drills', () => {
  it('invalidates restored AI credential references without deleting unrelated credentials', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const credentials = new InMemoryCredentialStore();
    const { runtime } = await initRuntime(temporary.path, { credentialStore: credentials });
    try {
      const provider = runtime.ai?.createProvider({
        providerType: 'OPENAI',
        displayName: '恢复测试 Provider',
        modelId: 'gpt-test',
      });
      if (provider === undefined) throw new Error('AI Provider 未创建');
      await credentials.set(provider.credentialRef, 'restored-provider-secret');
      await credentials.set('unrelated-windows-credential', 'must-survive-restore');

      const backup = await runtime.backups?.createManualBackup('credential-restore-test');
      if (backup === undefined) throw new Error('备份未生成');
      await runtime.restoreBackup(backup.path);

      const restoredProvider = runtime.ai?.getProvider(provider.id);
      expect(restoredProvider).toBeDefined();
      expect(restoredProvider?.credentialRef).not.toBe(provider.credentialRef);
      await expect(credentials.get(restoredProvider?.credentialRef ?? '')).resolves.toBeUndefined();
      await expect(credentials.get('unrelated-windows-credential')).resolves.toBe(
        'must-survive-restore',
      );
    } finally {
      runtime.close();
    }
  });

  it('rejects a corrupted backup before touching current data', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    const app = await buildApp({ runtime });
    try {
      runtime.shared?.createCategory({
        parentArea: 'WORK',
        moduleType: 'GENERIC',
        name: '受保护数据',
      });
      const backup = await app.inject({ method: 'POST', url: '/api/v1/backups' });
      expect(backup.statusCode).toBe(201);
      const backupPath = BackupEnvelopeSchema.parse(backup.json()).data.path;

      // 篡改包内设置文件内容（校验清单不再匹配）。
      const zip = new AdmZip(backupPath);
      zip.updateFile('settings/non-sensitive.json', Buffer.from('{"tampered":true}', 'utf8'));
      await zip.writeZipPromise(backupPath);

      const preview = await app.inject({
        method: 'POST',
        url: '/api/v1/backups/restore-preview',
        payload: { path: backupPath },
      });
      expect(preview.statusCode).not.toBe(200);
      await expect(runtime.backups?.verify(backupPath)).rejects.toThrow();

      const categories = runtime.shared?.listCategories() ?? [];
      expect(categories.some((category) => category.name === '受保护数据')).toBe(true);
      expect(
        runtime.shared?.createCategory({
          parentArea: 'LIFE',
          moduleType: 'GENERIC',
          name: '仍可写入',
        }).name,
      ).toBe('仍可写入');
    } finally {
      await app.close();
      runtime.close();
    }
  });

  it('rejects a backup whose database payload is invalid before switching', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    try {
      runtime.shared?.createCategory({
        parentArea: 'WORK',
        moduleType: 'GENERIC',
        name: '现有数据',
      });
      const fakeBackup = join(temporary.path, 'invalid-payload.lifeassistant-backup');
      await buildFakeBackup(fakeBackup, Buffer.from('NOT-A-SQLITE-DATABASE-BYTES-0123456789'));

      await expect(runtime.restoreBackup(fakeBackup)).rejects.toThrow();
      const categories = runtime.shared?.listCategories() ?? [];
      expect(categories.some((category) => category.name === '现有数据')).toBe(true);
      expect(runtime.isDatabaseConnected()).toBe(true);
      expect(runtime.database?.quickCheck()).toEqual(['ok']);
    } finally {
      runtime.close();
    }
  });

  it('rolls back to the original data when the restored database fails to open', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());

    // 构造“校验和一致但 schema_migrations 校验值被篡改”的备份：验证能通过、
    // quick_check 能通过，但迁移器会在切换后拒绝打开。
    const sourceRoot = join(temporary.path, 'source');
    const manager = new DataDirectoryManager(
      new BootstrapStore(join(sourceRoot, 'bootstrap.json')),
      '0.1.0',
    );
    const sourceLayout = await manager.initialize(join(sourceRoot, 'data'));
    const sourceDb = new SqliteDatabase(sourceLayout.database, clock);
    sourceDb.migrate();
    new SharedRepository(sourceDb, clock).seedDefaults();
    sourceDb.raw
      .prepare("UPDATE schema_migrations SET checksum = 'tampered' WHERE version = 1")
      .run();
    const sourceBackupService = new BackupService(sourceDb, sourceLayout, clock, '0.1.0');
    const sourceMetadata = await manager.readMetadata(sourceLayout);
    const badBackup = await sourceBackupService.createManualBackup(sourceMetadata.installationId);
    sourceDb.close();

    // 目标数据目录：有真实数据，恢复必须失败并回滚。
    const { runtime } = await initRuntime(temporary.path, {
      dataDirectory: join(temporary.path, 'target'),
    });
    try {
      runtime.shared?.createCategory({
        parentArea: 'WORK',
        moduleType: 'GENERIC',
        name: '目标原始数据',
      });
      await expect(runtime.restoreBackup(badBackup.path)).rejects.toThrow('校验值已改变');

      const categories = runtime.shared?.listCategories() ?? [];
      expect(categories.some((category) => category.name === '目标原始数据')).toBe(true);
      expect(runtime.database?.quickCheck()).toEqual(['ok']);
      expect(runtime.database?.foreignKeyCheck()).toHaveLength(0);
      expect(
        runtime.shared?.createCategory({
          parentArea: 'LIFE',
          moduleType: 'GENERIC',
          name: '回滚后仍可写入',
        }).name,
      ).toBe('回滚后仍可写入');
    } finally {
      runtime.close();
    }
  });

  it('keeps the app intact on backup failure and records FAILED for mid-flight failures', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime } = await initRuntime(temporary.path);
    try {
      // 1) 目标目录不可用：备份在开始前失败（不产生记录），应用保持完好。
      const blocker = join(temporary.path, 'blocker');
      writeFileSync(blocker, 'block', 'utf8');
      await expect(
        runtime.backups?.createManualBackup('drill-install', join(blocker, 'backups')),
      ).rejects.toThrow();
      expect(runtime.database?.quickCheck()).toEqual(['ok']);
      expect(runtime.backups?.list() ?? []).toHaveLength(0);

      // 2) 备份过程中失败（模拟磁盘空间不足）：必须留下 FAILED 记录。
      const database = runtime.database;
      if (database === undefined) throw new Error('数据库未连接');
      const originalBackup = database.backup.bind(database);
      database.backup = () => {
        throw new Error('磁盘空间不足（模拟）');
      };
      try {
        await expect(runtime.backups?.createManualBackup('drill-install')).rejects.toThrow(
          '磁盘空间不足',
        );
      } finally {
        database.backup = originalBackup;
      }
      const records = runtime.backups?.list() ?? [];
      expect(records.some((record) => (record as { status: string }).status === 'FAILED')).toBe(
        true,
      );

      // 3) 故障恢复后，备份必须成功且可验证。
      const backup = await runtime.backups?.createManualBackup(
        'drill-install',
        join(temporary.path, 'backup-out'),
      );
      if (backup === undefined) throw new Error('备份未生成');
      await expect(runtime.backups?.verify(backup.path)).resolves.toMatchObject({
        formatVersion: 1,
      });
    } finally {
      runtime.close();
    }
  });

  it('keeps the original directory active when a migration target is invalid', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, dataDirectory } = await initRuntime(temporary.path);
    try {
      runtime.shared?.createCategory({
        parentArea: 'WORK',
        moduleType: 'GENERIC',
        name: '迁移前数据',
      });

      // 目标非空。
      const nonEmpty = join(temporary.path, 'non-empty');
      mkdirSync(nonEmpty, { recursive: true });
      writeFileSync(join(nonEmpty, 'occupied.txt'), 'x', 'utf8');
      await expect(runtime.migrateDataDirectory(nonEmpty)).rejects.toThrow('必须为空');

      // 目标父级是一个文件。
      const blocker = join(temporary.path, 'block-file');
      writeFileSync(blocker, 'block', 'utf8');
      await expect(runtime.migrateDataDirectory(join(blocker, 'child'))).rejects.toThrow();

      // 目标与源相同或嵌套。
      await expect(runtime.migrateDataDirectory(dataDirectory)).rejects.toThrow(
        '不能相同或互相嵌套',
      );
      await expect(runtime.migrateDataDirectory(join(dataDirectory, 'nested'))).rejects.toThrow(
        '不能相同或互相嵌套',
      );

      expect(runtime.getLayout()?.root.toLowerCase()).toBe(resolve(dataDirectory).toLowerCase());
      const categories = runtime.shared?.listCategories() ?? [];
      expect(categories.some((category) => category.name === '迁移前数据')).toBe(true);
      expect(runtime.database?.quickCheck()).toEqual(['ok']);
    } finally {
      runtime.close();
    }
  });

  it('migrates the data directory successfully and preserves the source as fallback', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const { runtime, dataDirectory } = await initRuntime(temporary.path, {
      includeDemoData: true,
    });
    try {
      runtime.shared?.createCategory({
        parentArea: 'WORK',
        moduleType: 'GENERIC',
        name: '迁移数据',
      });
      const destination = join(temporary.path, 'migrated');
      await runtime.migrateDataDirectory(destination);

      expect(runtime.getLayout()?.root.toLowerCase()).toBe(resolve(destination).toLowerCase());
      expect(runtime.database?.quickCheck()).toEqual(['ok']);
      expect(runtime.database?.foreignKeyCheck()).toHaveLength(0);
      const categories = runtime.shared?.listCategories() ?? [];
      expect(categories.some((category) => category.name === '迁移数据')).toBe(true);
      // 原目录保留作为回退副本，且仍然可校验。
      const originalDb = join(dataDirectory, 'database', 'life-assistant.db');
      expect(existsSync(originalDb)).toBe(true);
      const probe = new SqliteDatabase(originalDb, clock);
      try {
        expect(probe.quickCheck()).toEqual(['ok']);
        const countRow = probe.raw.prepare('SELECT COUNT(*) AS count FROM entity_index').get() as {
          count: number;
        };
        expect(typeof countRow.count).toBe('number');
        expect(countRow.count).toBeGreaterThan(0);
      } finally {
        probe.close();
      }
    } finally {
      runtime.close();
    }
  });

  it('upgrades an old v11 data directory with an automatic pre-migration backup', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const root = join(temporary.path, 'old');
    const { layout } = await buildOldDataDirectory(root, 11);

    const runtime = new LocalRuntime({
      bootstrapPath: join(root, 'bootstrap.json'),
      suggestedDataDirectory: join(root, 'suggested'),
    });
    await runtime.start();
    try {
      const database = runtime.database;
      if (database === undefined) throw new Error('数据库未连接');
      expect(database.quickCheck()).toEqual(['ok']);
      expect(database.foreignKeyCheck()).toHaveLength(0);
      expect(
        database.raw
          .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
          .get(),
      ).toEqual({ version: latestSchemaVersion });
      expect(readTaskTitle(layout.database)).toBe('旧版本遗留任务');

      // 升级前备份必须已自动生成，且是一个包含旧数据的有效数据库。
      const backups = await listDirectory(layout.backups);
      const preMigration = backups.filter((file) => file.includes('pre-migration-'));
      expect(preMigration.length).toBeGreaterThan(0);
      expect(readTaskTitle(preMigration[0] ?? '')).toBe('旧版本遗留任务');
    } finally {
      runtime.close();
    }
  });

  it('upgrades an old v16 data directory without data loss', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    const root = join(temporary.path, 'old');
    const { layout } = await buildOldDataDirectory(root, 16);

    const runtime = new LocalRuntime({
      bootstrapPath: join(root, 'bootstrap.json'),
      suggestedDataDirectory: join(root, 'suggested'),
    });
    await runtime.start();
    try {
      const database = runtime.database;
      if (database === undefined) throw new Error('数据库未连接');
      expect(database.quickCheck()).toEqual(['ok']);
      expect(
        database.raw
          .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
          .get(),
      ).toEqual({ version: latestSchemaVersion });
      expect(readTaskTitle(layout.database)).toBe('旧版本遗留任务');
    } finally {
      runtime.close();
    }
  });

  it('restores an old-version backup and migrates it to the current schema', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());

    // 旧版本数据目录 + 使用旧版数据生成的备份。
    const root = join(temporary.path, 'old');
    const { layout } = await buildOldDataDirectory(root, 11);
    const database = new SqliteDatabase(layout.database, clock);
    const backupService = new BackupService(database, layout, clock, '0.1.0');
    const manager = new DataDirectoryManager(
      new BootstrapStore(join(root, 'bootstrap.json')),
      '0.1.0',
    );
    const metadata = await manager.readMetadata(layout);
    const oldBackup = await backupService.createManualBackup(metadata.installationId);
    database.close();

    // 恢复到全新数据目录。
    const { runtime } = await initRuntime(temporary.path, {
      dataDirectory: join(temporary.path, 'fresh'),
    });
    try {
      await runtime.restoreBackup(oldBackup.path);
      const restored = runtime.database;
      if (restored === undefined) throw new Error('恢复后数据库未连接');
      expect(restored.quickCheck()).toEqual(['ok']);
      expect(
        restored.raw
          .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
          .get(),
      ).toEqual({ version: latestSchemaVersion });
      const row = restored.raw.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId) as
        { title: string } | undefined;
      expect(row?.title).toBe('旧版本遗留任务');
    } finally {
      runtime.close();
    }
  });
});
