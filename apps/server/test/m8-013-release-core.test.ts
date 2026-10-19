import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createTestDataDirectory } from '@life-assistant/test-support';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildManifest,
  collectRelativeFiles,
  computeSchemaVersion,
  findForbiddenContent,
  isExcludedReleaseFile,
  sha256Buffer,
} from '../../../scripts/release/portable-core.mjs';

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe('M8-013/015 portable release core', () => {
  it('extracts the current schema version from the migrations source', async () => {
    const source = await readFile(
      join(process.cwd(), 'packages/database/src/migrations.ts'),
      'utf8',
    );
    expect(computeSchemaVersion(source)).toBe(21);
  });

  it('collects files relative to a root with forward slashes and sorted order', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    await mkdir(join(temporary.path, 'sub'), { recursive: true });
    await writeFile(join(temporary.path, 'b.txt'), 'b', 'utf8');
    await writeFile(join(temporary.path, 'a.txt'), 'a', 'utf8');
    await writeFile(join(temporary.path, 'sub', 'c.txt'), 'c', 'utf8');

    const files = await collectRelativeFiles(temporary.path);
    expect(files).toEqual(['a.txt', 'b.txt', 'sub/c.txt']);
  });

  it('builds a manifest with SHA-256 entries and consistent counts', async () => {
    const temporary = await createTestDataDirectory();
    cleanups.push(() => temporary.cleanup());
    await writeFile(join(temporary.path, 'server.js'), 'console.log(1)', 'utf8');
    await writeFile(join(temporary.path, 'node.exe'), Buffer.from([1, 2, 3, 4]));

    const manifest = await buildManifest(temporary.path, {
      releaseVersion: '2.0.0-rc.4',
      appVersion: '0.1.0',
      gitCommit: 'abc123',
      schemaVersion: 17,
      openApiSha256: 'x'.repeat(64),
      builtAt: '2026-08-15T00:00:00.000Z',
    });
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.releaseVersion).toBe('2.0.0-rc.4');
    expect(manifest.fileCount).toBe(2);
    expect(manifest.files).toHaveLength(2);
    const serverEntry = manifest.files.find((file) => file.path === 'server.js');
    expect(serverEntry?.sha256).toBe(sha256Buffer(Buffer.from('console.log(1)', 'utf8')));
  });

  it('flags source maps, absolute paths and key-like content', () => {
    expect(isExcludedReleaseFile('main.js.map')).toBe(true);
    expect(isExcludedReleaseFile('main.pdb')).toBe(true);
    expect(isExcludedReleaseFile('main.cjs')).toBe(false);

    expect(findForbiddenContent('//# sourceMappingURL=main.cjs.map', [])).toEqual([
      'sourceMappingURL',
    ]);
    expect(findForbiddenContent('D:\\secret\\source.ts', ['D:\\secret'])).toContain(
      '绝对路径：D:\\secret',
    );
    expect(findForbiddenContent('key=sk-0123456789abcdef0123456789abcdef', [])).not.toHaveLength(0);
    expect(findForbiddenContent('普通内容没有任何问题', [])).toHaveLength(0);
  });
});
