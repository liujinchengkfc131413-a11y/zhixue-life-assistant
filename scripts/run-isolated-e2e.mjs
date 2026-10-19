import { spawnSync } from 'node:child_process';
import process from 'node:process';

const pnpm = 'pnpm';
const useShell = process.platform === 'win32';
const suites = [
  ['核心 A4 E2E', ['run', 'test:e2e:core:isolated', 'apps/web/e2e/a4-recurrence-selector.spec.ts']],
  [
    '核心 A5 E2E',
    ['run', 'test:e2e:core:isolated', 'apps/web/e2e/a5-schedule-history-entry.spec.ts'],
  ],
  ['核心 A8 E2E', ['run', 'test:e2e:core:isolated', 'apps/web/e2e/a8-search-filters.spec.ts']],
  ['核心纵向 E2E', ['run', 'test:e2e:core:isolated', 'apps/web/e2e/app-shell.spec.ts']],
  ['Today Scene E2E', ['run', 'test:e2e:core:isolated', 'apps/web/e2e/today-scene-video.spec.ts']],
  ['Today V2 E2E', ['run', 'test:e2e:core:isolated', 'apps/web/e2e/today-v2.spec.ts']],
  ['Today V3 E2E', ['run', 'test:e2e:core:isolated', 'apps/web/e2e/today-v3-phase7.spec.ts']],
  ['V2 Foundations', ['run', 'test:e2e:v2-foundations']],
  ['V2 Work', ['run', 'test:e2e:v2-work']],
  ['V2 Life', ['run', 'test:e2e:v2-life']],
  ['V2 Vision', ['run', 'test:e2e:v2-vision']],
  ['V2 Assistant', ['run', 'test:e2e:v2-assistant']],
  ['V2 A19/A20', ['run', 'test:e2e:v2-a19-a20']],
  ['V2 System', ['run', 'test:e2e:v2-system']],
  ['V2 Cross-theme', ['run', 'test:e2e:v2-cross-theme']],
  ['V2 Visual baseline verification', ['run', 'test:e2e:v2-baseline']],
];

const build = spawnSync(pnpm, ['run', 'build'], {
  cwd: process.cwd(),
  env: process.env,
  shell: useShell,
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.stderr.write('\nE2E 前置构建失败，未启动任何测试服务。\n');
  process.exit(1);
}

const failures = [];

for (const [name, args] of suites) {
  process.stdout.write(`\n=== ${name} ===\n`);
  const result = spawnSync(pnpm, args, {
    cwd: process.cwd(),
    env: { ...process.env, LIFE_ASSISTANT_E2E_SKIP_BUILD: '1' },
    shell: useShell,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    failures.push(name);
  }
}

if (failures.length > 0) {
  process.stderr.write(`\n失败的 E2E 套件：${failures.join('、')}\n`);
  process.exitCode = 1;
}
