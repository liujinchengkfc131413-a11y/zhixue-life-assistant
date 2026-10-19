/* global console, process */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (status.status !== 0) {
  console.error(status.stderr.trim() || '无法读取 Git 工作树状态。');
  process.exit(1);
}

if (status.stdout.trim() !== '') {
  console.error('拒绝从 dirty worktree 构建正式发行包。请提交变更或使用 clean git worktree：');
  console.error(status.stdout.trim());
  process.exit(1);
}

console.log('Release preflight：Git working tree clean。');
