import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

import type {
  AttachmentRecord,
  AttachmentRepository,
  DataDirectoryLayout,
} from '@life-assistant/database';

const safeDisplayName = (name: string): string => {
  const invalidCharacters = '<>:"/\\|?*';
  let normalized = '';
  for (const character of basename(name)) {
    normalized +=
      character.charCodeAt(0) < 32 || invalidCharacters.includes(character) ? '_' : character;
  }
  normalized = normalized.trim();
  return normalized.slice(0, 240) || '未命名文件';
};

export class PathTraversalError extends Error {
  public constructor() {
    super('存储路径越过了应用管理目录。');
  }
}

export interface ManagedFileStorageOptions {
  readonly removeFile?: (path: string) => Promise<void>;
}

const isInside = (root: string, target: string): boolean => {
  const relativePath = relative(root, target);
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
};

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

export class ManagedFileStorage {
  public constructor(
    private readonly layout: DataDirectoryLayout,
    private readonly repository: AttachmentRepository,
    private readonly options: ManagedFileStorageOptions = {},
  ) {}

  public resolveStorageKey(storageKey: string): string {
    if (isAbsolute(storageKey)) throw new PathTraversalError();
    const root = resolve(this.layout.attachments);
    const target = resolve(root, storageKey);
    const relativePath = relative(root, target);
    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new PathTraversalError();
    }
    return target;
  }

  public async removeManaged(storageKey: string): Promise<void> {
    const target = this.resolveStorageKey(storageKey);
    const root = resolve(this.layout.attachments);
    const resolvedRoot = await realpath(root);
    let existing = target;
    let targetExists = true;
    for (;;) {
      try {
        const status = await lstat(existing);
        if (existing === target && status.isSymbolicLink()) throw new PathTraversalError();
        break;
      } catch (error) {
        if (!isMissing(error)) throw error;
        targetExists = false;
        const parent = dirname(existing);
        if (parent === existing) throw new PathTraversalError();
        existing = parent;
      }
    }
    const resolvedExisting = await realpath(existing);
    if (resolvedExisting !== resolvedRoot && !isInside(resolvedRoot, resolvedExisting)) {
      throw new PathTraversalError();
    }
    if (!targetExists) return;
    const resolvedTarget = await realpath(target);
    if (!isInside(resolvedRoot, resolvedTarget)) throw new PathTraversalError();
    await (this.options.removeFile ?? ((path) => rm(path, { force: true })))(target);
  }

  public async store(input: {
    readonly stream: Readable;
    readonly originalName: string;
    readonly mediaType: string;
    readonly description?: string;
    readonly maxSizeBytes: number;
  }): Promise<AttachmentRecord> {
    const id = this.repository.nextId();
    const safeName = safeDisplayName(input.originalName);
    const extension = extname(safeName).toLowerCase().slice(0, 20) || null;
    const temporaryKey = `.upload/${id}.tmp`;
    const temporaryPath = this.resolveStorageKey(temporaryKey);
    await mkdir(resolve(temporaryPath, '..'), { recursive: true });

    const hash = createHash('sha256');
    let sizeBytes = 0;
    input.stream.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += buffer.byteLength;
      if (sizeBytes > input.maxSizeBytes) input.stream.destroy(new Error('附件超过允许的大小。'));
      hash.update(buffer);
    });

    try {
      await pipeline(input.stream, createWriteStream(temporaryPath, { flags: 'wx' }));
      const sha256 = hash.digest('hex');
      const storageKey = `${sha256.slice(0, 2)}/${id}${extension ?? ''}`;
      const destination = this.resolveStorageKey(storageKey);
      await mkdir(resolve(destination, '..'), { recursive: true });
      await rename(temporaryPath, destination);
      return this.repository.create({
        id,
        originalName: input.originalName,
        safeName,
        mediaType: input.mediaType,
        extension,
        sizeBytes,
        sha256,
        storageKey,
        description: input.description ?? null,
        status: 'READY',
      });
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  public open(record: AttachmentRecord): NodeJS.ReadableStream {
    return createReadStream(this.resolveStorageKey(record.storageKey));
  }
}
