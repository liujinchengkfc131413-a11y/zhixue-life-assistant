/* global console, process */
import { spawnSync } from 'node:child_process';
import { copyFile, cp, mkdir, realpath, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManifest, computeSchemaVersion, sha256Buffer } from './portable-core.mjs';

/**
 * M8-013~015 便携发布组装：
 * 1) 私有 Node runtime（runtime/node.exe）+ 自包含 Launcher（M8-014）
 * 2) app/server（打包产物 main.cjs + better-sqlite3）+ app/web 静态资源
 * 3) runtime.json 与 app/package-manifest.json（版本/Git/Schema/OpenAPI 哈希/文件 SHA-256，M8-015）
 *
 * 前置：已执行 pnpm build 与 pnpm launcher:publish（由 pnpm release:portable 串联）。
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distributionDir = join(repoRoot, 'distribution');

const assertFile = (path, hint) => {
  if (!existsSync(path)) throw new Error(`缺少构建产物：${path}。${hint}`);
};

const gitCommit = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0 ? result.stdout.trim() : 'unknown';
};

const readdirEntries = async (directory) => {
  const { readdir } = await import('node:fs/promises');
  return readdir(directory);
};

/** 复制某依赖包中指定子路径到发布目录 node_modules/<pkg>/。 */
const copyPackageSubset = async (packageName, targetNodeModules, subsets) => {
  const source = await resolvePackageDir(packageName);
  const target = join(targetNodeModules, packageName);
  await mkdir(target, { recursive: true });
  for (const subset of subsets) {
    const from = join(source, subset);
    if (!existsSync(from)) continue;
    await cp(from, join(target, subset), { recursive: true, dereference: true });
  }
};

const resolvePackageDir = async (packageName) => {
  const candidates = [
    join(repoRoot, 'apps/server/node_modules', packageName),
    join(repoRoot, 'node_modules', packageName),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpath(candidate);
  }
  throw new Error(`找不到依赖包：${packageName}`);
};

const main = async () => {
  const rootPackage = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
  const release = JSON.parse(await readFile(join(repoRoot, 'release.json'), 'utf8'));
  const appVersion = rootPackage.version;
  const releaseVersion = release.productVersion;
  const schemaVersion = computeSchemaVersion(
    await readFile(join(repoRoot, 'packages/database/src/migrations.ts'), 'utf8'),
  );
  const openApiSha256 = sha256Buffer(await readFile(join(repoRoot, 'docs/api/openapi.json')));
  const commit = gitCommit();
  const builtAt = new Date().toISOString();

  const serverDist = join(repoRoot, 'apps/server/dist/main.cjs');
  const webDist = join(repoRoot, 'apps/web/dist');
  const publishDir = join(repoRoot, 'apps/launcher/bin/Release/net8.0-windows/win-x64/publish');
  const launcherExe = join(publishDir, 'LifeAssistant.exe');
  assertFile(serverDist, '请先运行 pnpm build。');
  assertFile(join(webDist, 'index.html'), '请先运行 pnpm build。');
  assertFile(launcherExe, '请先运行 pnpm launcher:publish。');

  const releaseName = `LifeAssistant-${appVersion}`;
  const releaseDir = join(distributionDir, releaseName);
  await rm(releaseDir, { recursive: true, force: true });
  await mkdir(releaseDir, { recursive: true });

  // Launcher（单文件自包含，排除调试符号）。
  for (const entry of await readdirEntries(publishDir)) {
    if (entry.endsWith('.pdb')) continue;
    await copyFile(join(publishDir, entry), join(releaseDir, entry));
  }

  // 私有 Node runtime。
  await mkdir(join(releaseDir, 'runtime'), { recursive: true });
  await copyFile(process.execPath, join(releaseDir, 'runtime', 'node.exe'));

  // Server 打包产物：剥离 sourceMappingURL 注释，发布包不携带源码映射。
  await mkdir(join(releaseDir, 'app/server'), { recursive: true });
  const serverBundle = (await readFile(serverDist, 'utf8')).replace(
    /\n?\/\/# sourceMappingURL=.*$/m,
    '',
  );
  await writeFile(join(releaseDir, 'app/server/main.cjs'), serverBundle, 'utf8');

  // better-sqlite3 原生依赖：复制运行时所需文件（lib + 各平台 prebuilds + 包元数据）。
  // prebuilds 为预编译 NAPI 二进制，运行时不需要 node-addon-api（仅构建期使用）。
  const serverNodeModules = join(releaseDir, 'app/server/node_modules');
  await copyPackageSubset('better-sqlite3', serverNodeModules, [
    'lib',
    'prebuilds',
    'package.json',
    'LICENSE',
  ]);

  // Web 静态资源。
  await cp(webDist, join(releaseDir, 'app/web'), { recursive: true, dereference: true });

  // assets 目录（品牌资源预留）。
  await mkdir(join(releaseDir, 'assets'), { recursive: true });
  await writeFile(
    join(releaseDir, 'assets/README.txt'),
    '本目录用于存放应用图标与品牌资源，当前版本使用系统默认图标。\n',
    'utf8',
  );

  // runtime.json（端口策略与应用版本信息，供启动协议使用）。
  await writeFile(
    join(releaseDir, 'runtime.json'),
    `${JSON.stringify(
      {
        formatVersion: 1,
        releaseVersion,
        appVersion,
        schemaVersion,
        gitCommit: commit,
        builtAt,
        portPolicy: 'auto',
        browser: 'chrome-then-edge',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  // package-manifest.json（发布清单：版本 + Git + Schema + OpenAPI 哈希 + 各文件 SHA-256）。
  const manifest = await buildManifest(releaseDir, {
    releaseVersion,
    appVersion,
    gitCommit: commit,
    schemaVersion,
    openApiSha256,
    builtAt,
  });
  await writeFile(
    join(releaseDir, 'app/package-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  const totalSize = manifest.files.reduce((sum, file) => sum + file.size, 0);
  console.log(
    `便携发布已生成：${releaseDir}`,
    `（${String(manifest.fileCount)} 个文件，${(totalSize / 1024 / 1024).toFixed(1)} MB）`,
  );
  console.log(
    `  releaseVersion=${releaseVersion} appVersion=${appVersion} schemaVersion=${String(schemaVersion)} commit=${commit}`,
  );
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
