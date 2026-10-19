import { rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testResultsRoot = resolve(workspaceRoot, 'test-results');
const assistantResultsDirectory = resolve(testResultsRoot, 'v2-assistant');
const relativeTarget = relative(testResultsRoot, assistantResultsDirectory);

if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget) || relativeTarget === '') {
  throw new Error('拒绝清理 test-results 之外的路径。');
}

await rm(assistantResultsDirectory, { recursive: true, force: true });
