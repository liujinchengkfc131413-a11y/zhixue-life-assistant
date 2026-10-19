/* global console, process, fetch, AbortSignal */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import { findForbiddenContent, sha256Buffer } from './portable-core.mjs';

/**
 * 便携发布验证：结构完整性、清单哈希一致、无绝对源码路径/密钥、
 * 以及用发布目录自带的 node.exe 实际启动服务并完成健康检查。
 * 用法：node scripts/release/verify-portable.mjs [发布目录]
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const failures = [];
const check = (condition, message) => {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
};

const killProcessTree = (child) => {
  const pid = child.pid;
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    child.kill();
  } catch {
    // 进程可能已经退出。
  }
};

const main = async () => {
  const releaseArg = process.argv[2];
  const defaultRelease = (() => {
    const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    return join(repoRoot, 'distribution', `LifeAssistant-${rootPackage.version}`);
  })();
  const releaseDir = resolve(releaseArg ?? defaultRelease);
  console.log(`验证发布目录：${releaseDir}`);

  const required = [
    'LifeAssistant.exe',
    'runtime/node.exe',
    'app/server/main.cjs',
    'app/server/node_modules/better-sqlite3/lib/index.js',
    'app/server/node_modules/better-sqlite3/prebuilds/win32-x64.node',
    'app/web/index.html',
    'app/package-manifest.json',
    'runtime.json',
    'assets/README.txt',
  ];
  for (const rel of required) check(existsSync(join(releaseDir, rel)), `存在 ${rel}`);

  const manifestPath = join(releaseDir, 'app/package-manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('缺少发布清单，无法继续。');
    process.exit(1);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const release = JSON.parse(await readFile(join(repoRoot, 'release.json'), 'utf8'));
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).stdout.trim();
  check(
    manifest.releaseVersion === release.productVersion,
    `清单包含产品版本 ${release.productVersion}`,
  );
  check(typeof manifest.appVersion === 'string', '清单包含应用版本');
  check(manifest.gitCommit === head, `清单 commit 对应 HEAD ${head.slice(0, 12)}`);
  check(manifest.schemaVersion > 0, `清单包含 Schema 版本（${String(manifest.schemaVersion)}）`);
  check(/^[0-9a-f]{64}$/.test(manifest.openApiSha256), '清单包含 OpenAPI 契约哈希');
  check(manifest.files.length === manifest.fileCount, '清单文件数量一致');

  // 逐文件哈希核对 + 内容安全扫描。
  const textExtensions = new Set(['.js', '.cjs', '.json', '.txt', '.html', '.css', '.md']);
  let totalSize = 0;
  for (const file of manifest.files) {
    const absolute = join(releaseDir, file.path);
    if (!existsSync(absolute)) {
      check(false, `清单文件存在：${file.path}`);
      continue;
    }
    const content = await readFile(absolute);
    totalSize += content.length;
    const actualHash = sha256Buffer(content);
    check(actualHash === file.sha256, `哈希一致：${file.path}`);
    const extension = file.path.slice(file.path.lastIndexOf('.'));
    if (textExtensions.has(extension)) {
      const text = content.toString('utf8');
      const forbidden = findForbiddenContent(text, [repoRoot]);
      check(
        forbidden.length === 0,
        forbidden.length === 0
          ? `无绝对路径/密钥/源码映射：${file.path}`
          : `安全扫描：${file.path} -> ${forbidden.join('; ')}`,
      );
    }
  }
  console.log(`  发布总大小：${(totalSize / 1024 / 1024).toFixed(1)} MB`);

  // 冒烟：使用发布自带的 node.exe 启动服务。
  const nodeExe = join(releaseDir, 'runtime', 'node.exe');
  const serverEntry = join(releaseDir, 'app/server/main.cjs');
  const port = 43_400 + Math.floor(Math.random() * 100);
  const dataDir = join(releaseDir, '.smoke-data');
  const child = spawn(nodeExe, [serverEntry], {
    env: {
      ...process.env,
      LIFE_ASSISTANT_PORT: String(port),
      LIFE_ASSISTANT_BOOTSTRAP_PATH: join(dataDir, 'bootstrap.json'),
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // 服务仍在启动。
      }
      await sleep(250);
    }
    check(ready, '发布版服务可通过 /health/ready');
    if (!ready && stderr.length > 0) console.error(`  [server stderr] ${stderr.slice(0, 2000)}`);
    if (ready) {
      const status = await fetch(`http://127.0.0.1:${port}/api/v1/system/status`).then((response) =>
        response.json(),
      );
      check(
        status?.data?.appVersion === manifest.appVersion,
        `服务报告版本 ${manifest.appVersion}`,
      );
    }
  } finally {
    killProcessTree(child);
    await rm(dataDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\n验证失败：${String(failures.length)} 项`);
    process.exit(1);
  }
  console.log('\n发布目录验证通过。');
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
