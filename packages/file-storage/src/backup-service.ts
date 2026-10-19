import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

import AdmZip from 'adm-zip';
import { ulid } from 'ulid';

import type { DataDirectoryLayout, SqliteDatabase } from '@life-assistant/database';
import type { Clock } from '@life-assistant/kernel';

export interface BackupManifest {
  readonly formatVersion: 1;
  readonly appVersion: string;
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly installationId: string;
  readonly fileCount: number;
}

const listFiles = async (root: string): Promise<readonly string[]> => {
  const output: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) output.push(path);
    }
  };
  try {
    await visit(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return output;
};

const sha256 = async (path: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');

export class BackupService {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly layout: DataDirectoryLayout,
    private readonly clock: Clock,
    private readonly appVersion: string,
  ) {}

  public async createManualBackup(
    installationId: string,
    destination?: string,
  ): Promise<{ path: string; manifest: BackupManifest; checksum: string }> {
    return this.createBackup(installationId, 'MANUAL', destination);
  }

  public async createScheduledBackup(
    installationId: string,
    retentionCount: number,
    destination?: string,
  ): Promise<{ path: string; manifest: BackupManifest; checksum: string }> {
    const result = await this.createBackup(installationId, 'SCHEDULED', destination);
    await this.rotate(retentionCount);
    return result;
  }

  public async createPreRestoreBackup(
    installationId: string,
    destination?: string,
  ): Promise<{ path: string; manifest: BackupManifest; checksum: string }> {
    return this.createBackup(installationId, 'PRE_RESTORE', destination);
  }

  public list(): readonly unknown[] {
    return this.database.raw
      .prepare(
        `SELECT id,backup_type,status,file_path,manifest_json,checksum,created_at,finished_at,error
       FROM backup_records ORDER BY created_at DESC LIMIT 100`,
      )
      .all()
      .map((value: unknown) => {
        const row = value as {
          id: string;
          backup_type: string;
          status: string;
          file_path: string | null;
          manifest_json: string | null;
          checksum: string | null;
          created_at: number;
          finished_at: number | null;
          error: string | null;
        };
        return {
          id: row.id,
          backupType: row.backup_type,
          status: row.status,
          path: row.file_path,
          manifest: row.manifest_json === null ? null : (JSON.parse(row.manifest_json) as unknown),
          checksum: row.checksum,
          createdAt: new Date(row.created_at).toISOString(),
          finishedAt: row.finished_at === null ? null : new Date(row.finished_at).toISOString(),
          error: row.error,
        };
      });
  }

  public latestSuccessfulScheduledAt(): number | null {
    const row = this.database.raw
      .prepare(
        "SELECT MAX(finished_at) value FROM backup_records WHERE backup_type='SCHEDULED' AND status='SUCCEEDED'",
      )
      .get() as { value: number | null };
    return row.value;
  }

  public async extractVerified(path: string, destination: string): Promise<BackupManifest> {
    const manifest = await this.verify(path);
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
    const zip = new AdmZip(path);
    zip.extractAllTo(destination, true, true);
    return manifest;
  }

  private async createBackup(
    installationId: string,
    backupType: 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE',
    destination?: string,
  ): Promise<{ path: string; manifest: BackupManifest; checksum: string }> {
    const id = ulid();
    const staging = join(this.layout.cache, `backup-${id}`);
    const databasePath = join(staging, 'database', 'life-assistant.db');
    const backupDirectory = destination ?? this.layout.backups;
    await mkdir(backupDirectory, { recursive: true });
    const backupPath = join(backupDirectory, `life-assistant-${id}.lifeassistant-backup`);
    const startedAt = this.clock.now().getTime();
    this.database.raw
      .prepare(
        `INSERT INTO backup_records(id, backup_type, status, created_at) VALUES (?, ?, 'RUNNING', ?)`,
      )
      .run(id, backupType, startedAt);

    try {
      await this.database.backup(databasePath);
      const attachmentFiles = await listFiles(this.layout.attachments);
      const settings = this.database.raw
        .prepare(
          `SELECT key, value_json FROM settings
           WHERE lower(key) NOT LIKE '%api_key%' AND lower(key) NOT LIKE '%credential%' ORDER BY key`,
        )
        .all() as { key: string; value_json: string }[];
      await mkdir(join(staging, 'settings'), { recursive: true });
      await writeFile(
        join(staging, 'settings', 'non-sensitive.json'),
        `${JSON.stringify(
          Object.fromEntries(
            settings.map((setting) => [setting.key, JSON.parse(setting.value_json) as unknown]),
          ),
          null,
          2,
        )}\n`,
        'utf8',
      );
      const settingsPath = join(staging, 'settings', 'non-sensitive.json');
      const checksums: string[] = [
        `${await sha256(databasePath)}  database/life-assistant.db`,
        `${await sha256(settingsPath)}  settings/non-sensitive.json`,
      ];
      for (const source of attachmentFiles) {
        const key = relative(this.layout.attachments, source).replaceAll('\\', '/');
        checksums.push(`${await sha256(source)}  attachments/${key}`);
      }
      const manifest: BackupManifest = {
        formatVersion: 1,
        appVersion: this.appVersion,
        schemaVersion: this.database.raw.pragma('user_version', { simple: true }) as number,
        generatedAt: this.clock.now().toISOString(),
        installationId,
        fileCount: checksums.length,
      };
      await writeFile(
        join(staging, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      await writeFile(join(staging, 'checksums.sha256'), `${checksums.join('\n')}\n`, 'utf8');

      const zip = new AdmZip();
      zip.addLocalFile(databasePath, 'database');
      for (const source of attachmentFiles) {
        const relativeName = relative(this.layout.attachments, source);
        zip.addLocalFile(source, join('attachments', dirname(relativeName)));
      }
      zip.addLocalFile(join(staging, 'manifest.json'));
      zip.addLocalFile(join(staging, 'checksums.sha256'));
      zip.addLocalFile(settingsPath, 'settings');
      await zip.writeZipPromise(backupPath);
      const checksum = await sha256(backupPath);
      this.database.raw
        .prepare(
          `UPDATE backup_records
           SET status = 'SUCCEEDED', file_path = ?, manifest_json = ?, checksum = ?, finished_at = ? WHERE id = ?`,
        )
        .run(backupPath, JSON.stringify(manifest), checksum, this.clock.now().getTime(), id);
      return { path: backupPath, manifest, checksum };
    } catch (error) {
      this.database.raw
        .prepare(
          `UPDATE backup_records SET status = 'FAILED', error = ?, finished_at = ? WHERE id = ?`,
        )
        .run(
          error instanceof Error ? error.message.slice(0, 1000) : '未知备份错误',
          this.clock.now().getTime(),
          id,
        );
      throw error;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  private async rotate(retentionCount: number): Promise<void> {
    const rows = this.database.raw
      .prepare(
        `SELECT id,file_path FROM backup_records WHERE backup_type='SCHEDULED' AND status='SUCCEEDED' ORDER BY finished_at DESC`,
      )
      .all() as { id: string; file_path: string | null }[];
    for (const row of rows.slice(Math.max(1, retentionCount))) {
      if (row.file_path !== null) {
        try {
          await unlink(row.file_path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      this.database.raw
        .prepare("UPDATE backup_records SET status='DELETED',file_path=NULL WHERE id=?")
        .run(row.id);
    }
  }

  public async verify(path: string): Promise<BackupManifest> {
    if (!path.endsWith('.lifeassistant-backup') || !(await stat(path)).isFile()) {
      throw new Error('备份文件格式不正确。');
    }
    const zip = new AdmZip(path);
    for (const entry of zip.getEntries()) {
      const normalized = entry.entryName.replaceAll('\\', '/');
      if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
        throw new Error('备份包含不安全路径。');
      }
    }
    const manifestEntry = zip.getEntry('manifest.json');
    const checksumEntry = zip.getEntry('checksums.sha256');
    if (manifestEntry === null || checksumEntry === null)
      throw new Error('备份缺少清单或校验文件。');
    const parsedManifest: unknown = JSON.parse(manifestEntry.getData().toString('utf8'));
    if (
      typeof parsedManifest !== 'object' ||
      parsedManifest === null ||
      !('formatVersion' in parsedManifest) ||
      parsedManifest.formatVersion !== 1
    ) {
      throw new Error('不支持的备份格式版本。');
    }
    const manifest = parsedManifest as unknown as BackupManifest;
    const expected = checksumEntry.getData().toString('utf8').trim().split('\n');
    if (expected.length !== manifest.fileCount) throw new Error('备份清单文件数量不匹配。');
    for (const line of expected) {
      const separator = line.indexOf('  ');
      if (separator !== 64) throw new Error('备份校验清单格式无效。');
      const hash = line.slice(0, separator);
      const name = line.slice(separator + 2);
      const entry = zip.getEntry(name);
      if (entry === null) throw new Error(`备份缺少文件：${name}`);
      const actual = createHash('sha256').update(entry.getData()).digest('hex');
      if (actual !== hash) throw new Error(`备份文件校验失败：${basename(name)}`);
    }
    return manifest;
  }
}
