import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const testRoot = resolve(tmpdir(), 'life-assistant-tests');

const assertInsideTestRoot = async (path: string): Promise<string> => {
  const resolvedRoot = resolve(testRoot);
  const resolvedPath = await realpath(path);
  const relativePath = relative(resolvedRoot, resolvedPath);

  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    resolve(resolvedRoot, relativePath) !== resolvedPath
  ) {
    throw new Error(`拒绝操作测试根目录之外的路径：${resolvedPath}`);
  }

  return resolvedPath;
};

export interface TestDataDirectory {
  readonly path: string;
  readonly databasePath: string;
  cleanup(): Promise<void>;
}

export const createTestDataDirectory = async (): Promise<TestDataDirectory> => {
  await mkdir(testRoot, { recursive: true });
  const path = await mkdtemp(join(testRoot, 'run-'));

  return {
    path,
    databasePath: join(path, 'database', 'life-assistant.test.db'),
    cleanup: async () => {
      const safePath = await assertInsideTestRoot(path);
      await rm(safePath, { recursive: true, force: true });
    },
  };
};
