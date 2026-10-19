import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { ulid } from 'ulid';

export const DATA_DIRECTORY_FORMAT_VERSION = 1;

export interface DataDirectoryMetadata {
  readonly formatVersion: number;
  readonly dataDirectoryId: string;
  readonly installationId: string;
  readonly createdAt: string;
  readonly appVersion: string;
}

export interface DataDirectoryLayout {
  readonly root: string;
  readonly database: string;
  readonly attachments: string;
  readonly backups: string;
  readonly logs: string;
  readonly cache: string;
  readonly metadata: string;
}

export interface BootstrapConfiguration {
  readonly dataDirectory: string;
}

export const getDataDirectoryLayout = (root: string): DataDirectoryLayout => {
  const absoluteRoot = resolve(root);
  return {
    root: absoluteRoot,
    database: join(absoluteRoot, 'database', 'life-assistant.db'),
    attachments: join(absoluteRoot, 'attachments'),
    backups: join(absoluteRoot, 'backups'),
    logs: join(absoluteRoot, 'logs'),
    cache: join(absoluteRoot, 'cache'),
    metadata: join(absoluteRoot, 'metadata.json'),
  };
};

const atomicWriteJson = async (path: string, value: unknown): Promise<void> => {
  const temporaryPath = `${path}.${String(process.pid)}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
};

export class BootstrapStore {
  public constructor(private readonly path: string) {}

  public async read(): Promise<BootstrapConfiguration | undefined> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'dataDirectory' in parsed &&
        typeof parsed.dataDirectory === 'string'
      ) {
        return { dataDirectory: resolve(parsed.dataDirectory) };
      }
      throw new Error('引导配置格式无效。');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  public async write(configuration: BootstrapConfiguration): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await atomicWriteJson(this.path, { dataDirectory: resolve(configuration.dataDirectory) });
  }
}

export class DataDirectoryManager {
  public constructor(
    private readonly bootstrapStore: BootstrapStore,
    private readonly appVersion: string,
  ) {}

  public async current(): Promise<DataDirectoryLayout | undefined> {
    const configuration = await this.bootstrapStore.read();
    if (configuration === undefined) return undefined;
    const layout = getDataDirectoryLayout(configuration.dataDirectory);
    await this.validateExisting(layout);
    return layout;
  }

  public async initialize(root: string): Promise<DataDirectoryLayout> {
    if (root.trim().length === 0) throw new Error('数据目录不能为空。');
    const layout = getDataDirectoryLayout(root);
    await Promise.all([
      mkdir(dirname(layout.database), { recursive: true }),
      mkdir(layout.attachments, { recursive: true }),
      mkdir(layout.backups, { recursive: true }),
      mkdir(layout.logs, { recursive: true }),
      mkdir(layout.cache, { recursive: true }),
    ]);
    await access(layout.root, constants.R_OK | constants.W_OK);

    let metadata: DataDirectoryMetadata;
    try {
      metadata = await this.readMetadata(layout);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      metadata = {
        formatVersion: DATA_DIRECTORY_FORMAT_VERSION,
        dataDirectoryId: ulid(),
        installationId: ulid(),
        createdAt: new Date().toISOString(),
        appVersion: this.appVersion,
      };
      await atomicWriteJson(layout.metadata, metadata);
    }

    if (metadata.formatVersion !== DATA_DIRECTORY_FORMAT_VERSION) {
      throw new Error(`不支持的数据目录格式版本：${String(metadata.formatVersion)}`);
    }
    await this.bootstrapStore.write({ dataDirectory: layout.root });
    return layout;
  }

  public async activate(root: string): Promise<DataDirectoryLayout> {
    const layout = await this.validate(root);
    await this.bootstrapStore.write({ dataDirectory: layout.root });
    return layout;
  }

  public async validate(root: string): Promise<DataDirectoryLayout> {
    const layout = getDataDirectoryLayout(root);
    await this.validateExisting(layout);
    return layout;
  }

  public async readMetadata(layout: DataDirectoryLayout): Promise<DataDirectoryMetadata> {
    const parsed: unknown = JSON.parse(await readFile(layout.metadata, 'utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('formatVersion' in parsed) ||
      typeof parsed.formatVersion !== 'number' ||
      !('dataDirectoryId' in parsed) ||
      typeof parsed.dataDirectoryId !== 'string' ||
      !('installationId' in parsed) ||
      typeof parsed.installationId !== 'string' ||
      !('createdAt' in parsed) ||
      typeof parsed.createdAt !== 'string' ||
      !('appVersion' in parsed) ||
      typeof parsed.appVersion !== 'string'
    ) {
      throw new Error('metadata.json 格式无效。');
    }
    return parsed as DataDirectoryMetadata;
  }

  private async validateExisting(layout: DataDirectoryLayout): Promise<void> {
    const rootStat = await stat(layout.root);
    if (!rootStat.isDirectory()) throw new Error('已配置的数据目录不是文件夹。');
    await access(layout.root, constants.R_OK | constants.W_OK);
    await this.readMetadata(layout);
  }
}
