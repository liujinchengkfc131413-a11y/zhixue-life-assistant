import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const e2eDirectory = resolve(workspaceRoot, 'test-results', 'e2e');

if (!e2eDirectory.startsWith(resolve(workspaceRoot, 'test-results'))) {
  throw new Error('拒绝清理测试目录之外的路径。');
}

await rm(e2eDirectory, { recursive: true, force: true });
