/* global console, process, fetch, AbortSignal */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import { findForbiddenContent } from '../release/portable-core.mjs';

/**
 * M8-016 干净 Windows 环境安装/启动验收（本机隔离模拟）：
 * 1) 将发布目录复制到仓库之外的临时位置，模拟干净安装目录；
 * 2) 自包含检查：无仓库绝对路径、无指向仓库的符号链接；
 * 3) 用发布自带的 node.exe 启动服务，完成首次初始化与无 AI Key 纵向主流程
 *    （初始化 → 分类 → 任务 → 手动备份 → 诊断导出 → 静态页）；
 * 4) Launcher 单实例验证：二次启动不产生第二个服务实例。
 *
 * 浏览器通道：本机仅 Chrome，Edge 通道（回退逻辑已实现）留待真实干净环境验收。
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

const findFreePort = () =>
  new Promise((resolvePort) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolvePort(typeof address === 'object' && address ? address.port : 0));
    });
  });

const waitForReady = async (port, child, attempts = 80) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child.exitCode !== null) return false;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return true;
    } catch {
      // 服务仍在启动。
    }
    await sleep(250);
  }
  return false;
};

const main = async () => {
  const releaseArg = process.argv[2];
  const version = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;
  const releaseDir = resolve(
    releaseArg ?? join(repoRoot, 'distribution', `LifeAssistant-${version}`),
  );
  if (!existsSync(join(releaseDir, 'LifeAssistant.exe'))) {
    console.error(`发布目录不存在或缺少 Launcher：${releaseDir}。请先运行 pnpm release:portable。`);
    process.exit(1);
  }
  console.log(`验收发布目录：${releaseDir}`);

  // 1) 复制到隔离的“干净安装”位置（仓库之外）。
  const installRoot = join(tmpdir(), `la-clean-install-${Date.now()}`);
  const installDir = join(installRoot, 'LifeAssistant');
  const realBootstrapPath = join(
    process.env.LOCALAPPDATA ?? tmpdir(),
    'LifeAssistant',
    'bootstrap.json',
  );
  const realBootstrapBefore = existsSync(realBootstrapPath)
    ? await readFile(realBootstrapPath, 'utf8')
    : undefined;
  await mkdir(installRoot, { recursive: true });
  await cp(releaseDir, installDir, { recursive: true, dereference: true });
  console.log(`模拟干净安装目录：${installDir}`);
  check(!installDir.startsWith(repoRoot), '安装目录位于仓库之外');

  // 2) 自包含检查：文本文件无仓库绝对路径。
  const textExtensions = new Set(['.js', '.cjs', '.json', '.txt', '.html', '.css']);
  const scanDir = async (directory) => {
    const { readdir } = await import('node:fs/promises');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.isSymbolicLink()) {
          check(false, `存在符号链接：${path}`);
          continue;
        }
        await scanDir(path);
      } else if (entry.isFile()) {
        const extension = path.slice(path.lastIndexOf('.'));
        if (textExtensions.has(extension)) {
          const text = await readFile(path, 'utf8');
          const forbidden = findForbiddenContent(text, [repoRoot, 'D:\\Documents']);
          check(
            forbidden.length === 0,
            forbidden.length === 0
              ? `无仓库绝对路径：${path.replace(installDir, '')}`
              : `自包含扫描：${path} -> ${forbidden.join('; ')}`,
          );
        }
      }
    }
  };
  await scanDir(installDir);

  // 3) 用私有 node.exe 启动服务，完成无 AI Key 纵向主流程。
  const port = await findFreePort();
  const bootstrapPath = join(installRoot, 'bootstrap.json');
  const dataDirectory = join(installRoot, 'data');
  const server = spawn(
    join(installDir, 'runtime', 'node.exe'),
    [join(installDir, 'app/server/main.cjs')],
    {
      env: {
        ...process.env,
        LIFE_ASSISTANT_PORT: String(port),
        LIFE_ASSISTANT_BOOTSTRAP_PATH: bootstrapPath,
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  let serverStderr = '';
  server.stderr?.on('data', (chunk) => {
    serverStderr += chunk.toString('utf8');
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, options) => {
    const response = await fetch(`${base}${path}`, options);
    const text = await response.text();
    let body;
    try {
      body = text === '' ? null : JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body };
  };
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (server.exitCode !== null) break;
      try {
        const response = await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // 服务仍在启动。
      }
      await sleep(250);
    }
    check(ready, '私有 node.exe 启动服务并响应 /health/ready');
    if (!ready) {
      console.error(`  [server stderr] ${serverStderr.slice(0, 2000)}`);
      throw new Error('服务未就绪，终止验收。');
    }

    const status = await api('/api/v1/setup/status');
    check(status.status === 200 && status.body?.data?.initialized === false, '首次启动未初始化');

    const initialize = await api('/api/v1/setup/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataDirectory,
        includeDemoData: false,
        backupFrequency: 'WEEKLY',
        backupRetentionCount: 5,
        quickCaptureDefaultAction: 'INBOX',
      }),
    });
    check(initialize.status === 200, '完成数据目录初始化');

    const categories = await api('/api/v1/categories');
    const workCategory = categories.body?.data?.find((item) => item.parentArea === 'WORK');
    check(categories.status === 200 && workCategory !== undefined, '读取默认分类');

    const task = await api('/api/v1/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        categoryId: workCategory.id,
        title: '干净环境验收任务',
        dueAt: '2026-08-20T12:00:00.000Z',
        estimatedMinutes: 60,
        isFlexible: true,
        isSplittable: false,
        preferredArea: 'WORK',
      }),
    });
    check(task.status === 201, '创建任务');

    const backup = await api('/api/v1/backups', { method: 'POST' });
    check(backup.status === 201, '手动备份成功');

    const providers = await api('/api/v1/ai/providers');
    check(
      providers.status === 200 && (providers.body?.data ?? []).length === 0,
      '无 AI Key 配置（本地功能不受影响）',
    );

    const diagnostics = await api('/api/v1/system/diagnostics');
    check(
      diagnostics.status === 200 && typeof diagnostics.body?.data?.logTail === 'string',
      '诊断信息可用',
    );

    const exported = await api('/api/v1/system/diagnostics:export', { method: 'POST' });
    check(exported.status === 200 && existsSync(exported.body?.data?.path ?? ''), '诊断包导出成功');

    const page = await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) });
    const html = await page.text();
    check(page.status === 200 && html.includes('<div id="root"></div>'), '静态 Web 页面可访问');

    // 浏览器通道：使用机器安装的真实 Chrome 与 Edge 分别通过 CDP 加载工作台。
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    const chromeCandidates = [
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    const edgeCandidates = [
      join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFiles, 'Edge', 'App', 'msedge.exe'),
      join(programFilesX86, 'Edge', 'App', 'msedge.exe'),
    ];
    const verifyBrowser = async (name, executablePath) => {
      const cdpPort = await findFreePort();
      const profile = join(installRoot, `${name.toLowerCase()}-profile`);
      const browser = spawn(
        executablePath,
        [
          '--headless',
          '--disable-gpu',
          '--no-first-run',
          `--user-data-dir=${profile}`,
          `--remote-debugging-port=${cdpPort}`,
          `${base}/`,
        ],
        { stdio: 'ignore', detached: true, windowsHide: true },
      );
      browser.unref();
      try {
        let browserOk = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          try {
            const targets = await fetch(`http://127.0.0.1:${cdpPort}/json`, {
              signal: AbortSignal.timeout(1000),
            }).then((response) => response.json());
            if (
              Array.isArray(targets) &&
              targets.some(
                (target) => target.title === '个人生活助手' && String(target.url).startsWith(base),
              )
            ) {
              browserOk = true;
              break;
            }
          } catch {
            // 浏览器仍在启动。
          }
          await sleep(250);
        }
        check(browserOk, `${name} 可加载工作台页面（CDP 通道）`);
      } finally {
        if (browser.pid !== undefined) {
          spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
        }
      }
    };
    const isLaunchableBrowser = (candidate) => {
      if (!existsSync(candidate)) return false;
      const probe = spawnSync(candidate, ['--version'], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
      });
      return probe.status === 0;
    };
    const chromePath = chromeCandidates.find(isLaunchableBrowser);
    const edgePath = edgeCandidates.find(isLaunchableBrowser);
    check(chromePath !== undefined, '发现真实 Google Chrome');
    check(edgePath !== undefined, '发现真实 Microsoft Edge');
    if (chromePath !== undefined) await verifyBrowser('Chrome', chromePath);
    if (edgePath !== undefined) await verifyBrowser('Edge', edgePath);
  } finally {
    killProcessTree(server);
    await sleep(750);
  }

  // 3b) 最终发布包数据库回归：当前 hash、真实 Schema 20 历史 hash、升级后重启。
  const legacyMigration20Checksum =
    '5279dd2aaa730d8ad474898f3af7c4f9ad9bb830a6bbfc0cd3c5852d6658604f';
  const currentMigration20Checksum =
    '509fb303feaac073399ded7fd4e7c626a2917089874e9ff7f98eb2bda341dc47';
  const packagedNode = join(installDir, 'runtime', 'node.exe');
  const packagedBetterSqlite = join(
    installDir,
    'app/server/node_modules/better-sqlite3/lib/index.js',
  );
  const databasePath = join(dataDirectory, 'database', 'life-assistant.db');
  const spawnPackagedServer = (selectedPort) =>
    spawn(packagedNode, [join(installDir, 'app/server/main.cjs')], {
      env: {
        ...process.env,
        LIFE_ASSISTANT_PORT: String(selectedPort),
        LIFE_ASSISTANT_BOOTSTRAP_PATH: bootstrapPath,
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
  const runDatabaseScript = (script, ...args) =>
    spawnSync(packagedNode, ['-e', script, packagedBetterSqlite, databasePath, ...args], {
      encoding: 'utf8',
      windowsHide: true,
    });

  const currentHashPort = await findFreePort();
  const currentHashServer = spawnPackagedServer(currentHashPort);
  let currentHashStderr = '';
  currentHashServer.stderr?.on('data', (chunk) => {
    currentHashStderr += chunk.toString('utf8');
  });
  try {
    const currentHashReady = await waitForReady(currentHashPort, currentHashServer);
    check(currentHashReady, '当前 migration 20 hash 数据库可冷启动');
    if (!currentHashReady)
      console.error(`  [current hash stderr] ${currentHashStderr.slice(0, 2000)}`);
  } finally {
    killProcessTree(currentHashServer);
  }

  const downgradeToSchema20 = (checksum) =>
    runDatabaseScript(
      [
        'const Database=require(process.argv[1]);',
        'const db=new Database(process.argv[2]);',
        "db.pragma('foreign_keys=OFF');",
        "db.exec(\"BEGIN; ALTER TABLE inbox_item_results RENAME TO inbox_item_results_v21; DROP INDEX inbox_item_results_entity_idx; CREATE TABLE inbox_item_results (inbox_item_id TEXT NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE, entity_id TEXT NOT NULL REFERENCES entity_index(id) ON DELETE CASCADE, result_type TEXT NOT NULL CHECK(result_type IN ('TASK','SHOPPING_ITEM')), created_at INTEGER NOT NULL, PRIMARY KEY(inbox_item_id, entity_id)); INSERT INTO inbox_item_results SELECT * FROM inbox_item_results_v21; DROP TABLE inbox_item_results_v21; CREATE INDEX inbox_item_results_entity_idx ON inbox_item_results(entity_id); DELETE FROM schema_migrations WHERE version=21; PRAGMA user_version=20; COMMIT;\");",
        "db.prepare('UPDATE schema_migrations SET checksum=? WHERE version=20').run(process.argv[3]);",
        'db.close();',
      ].join(''),
      checksum,
    );

  const seedLegacySchema20 = downgradeToSchema20(legacyMigration20Checksum);
  check(seedLegacySchema20.status === 0, '构造真实 Schema 20 + migration 20 历史 hash 样本');
  if (seedLegacySchema20.status !== 0) console.error(seedLegacySchema20.stderr.slice(0, 2000));

  const upgradePort = await findFreePort();
  const upgradeServer = spawnPackagedServer(upgradePort);
  let upgradeStderr = '';
  upgradeServer.stderr?.on('data', (chunk) => {
    upgradeStderr += chunk.toString('utf8');
  });
  try {
    const upgradeReady = await waitForReady(upgradePort, upgradeServer);
    check(upgradeReady, '最终发布包可将历史数据库 Schema 20 升级到 21');
    if (!upgradeReady) console.error(`  [upgrade stderr] ${upgradeStderr.slice(0, 2000)}`);
    if (upgradeReady) {
      const upgradedPage = await fetch(`http://127.0.0.1:${upgradePort}/`);
      check(upgradedPage.ok, '历史数据库升级后 frontend root 正常');
    }
  } finally {
    killProcessTree(upgradeServer);
  }

  const inspectUpgrade = runDatabaseScript(
    "const Database=require(process.argv[1]);const db=new Database(process.argv[2],{readonly:true});console.log(JSON.stringify({version:db.pragma('user_version',{simple:true}),migration21:db.prepare('SELECT COUNT(*) count FROM schema_migrations WHERE version=21').get().count,tasks:db.prepare(\"SELECT COUNT(*) count FROM tasks WHERE title='干净环境验收任务'\").get().count,quickCheck:db.pragma('quick_check',{simple:true})}));db.close();",
  );
  const upgradedState = inspectUpgrade.status === 0 ? JSON.parse(inspectUpgrade.stdout) : {};
  check(
    upgradedState.version === 21 && upgradedState.migration21 === 1,
    '历史数据库升级结果为 Schema 21 且 migration 21 仅一条',
  );
  check(upgradedState.tasks === 1, '历史数据库升级后业务数据保留');
  check(upgradedState.quickCheck === 'ok', '历史数据库升级后 SQLite quick_check=ok');

  const restartPort = await findFreePort();
  const restartServer = spawnPackagedServer(restartPort);
  try {
    check(await waitForReady(restartPort, restartServer), 'Schema 21 升级后再次冷启动正常');
  } finally {
    killProcessTree(restartServer);
  }

  // 4a) 隔离用户桌面快捷方式：launcher 首次运行会在桌面创建指向自身 exe 的快捷方式，
  // 本脚本从临时安装副本启动 launcher，若不隔离会把用户快捷方式指向即将删除的临时目录。
  // 验证期间临时移走用户快捷方式，结束后原样恢复（原本不存在则删除 launcher 创建的）。
  const desktopDir = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"],
    { encoding: 'utf8' },
  ).stdout.trim();
  const userShortcutPath = desktopDir === '' ? undefined : join(desktopDir, '知雪的生活助手.lnk');
  const shortcutBackupPath = join(installRoot, 'desktop-shortcut-backup.lnk');
  let hadUserShortcut = false;
  if (userShortcutPath !== undefined && existsSync(userShortcutPath)) {
    hadUserShortcut = true;
    await copyFile(userShortcutPath, shortcutBackupPath);
    await rm(userShortcutPath, { force: true });
  }

  // 4) 未知 drift 必须由最终 Launcher 捕获，保持 Schema 20 且不得打开浏览器。
  const unknownChecksum = 'unknown-migration-20-checksum';
  const seedUnknownSchema20 = downgradeToSchema20(unknownChecksum);
  check(seedUnknownSchema20.status === 0, '构造 Schema 20 未知 drift 样本');
  const driftPort = await findFreePort();
  const driftLogPath = join(installRoot, 'launcher-drift.log');
  const driftLauncherEnv = {
    ...process.env,
    LIFE_ASSISTANT_FIXED_PORT: String(driftPort),
    LIFE_ASSISTANT_BOOTSTRAP_PATH: bootstrapPath,
    LIFE_ASSISTANT_LAUNCHER_LOG_PATH: driftLogPath,
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost',
  };
  const driftLauncher = spawn(join(installDir, 'LifeAssistant.exe'), [], {
    env: driftLauncherEnv,
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  });
  driftLauncher.unref();
  try {
    let driftLog = '';
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (existsSync(driftLogPath)) driftLog = await readFile(driftLogPath, 'utf8');
      if (driftLog.includes('server.start-failed')) break;
      await sleep(250);
    }
    let driftReady = false;
    try {
      driftReady = (
        await fetch(`http://127.0.0.1:${driftPort}/health/ready`, {
          signal: AbortSignal.timeout(1000),
        })
      ).ok;
    } catch {
      // 预期：未知迁移漂移不会建立 listener。
    }
    check(!driftReady, '未知 migration drift 拒绝启动且无 listener');
    check(
      driftLog.includes('server.stderr') &&
        driftLog.includes('server.exited') &&
        driftLog.includes('server.start-failed'),
      'Launcher 捕获未知 drift 的 stderr、exit 与 startup failure',
    );
    check(!driftLog.includes('browser.opened'), 'backend 启动失败时不打开 localhost 页面');
    const driftStateResult = runDatabaseScript(
      "const Database=require(process.argv[1]);const db=new Database(process.argv[2],{readonly:true});console.log(JSON.stringify({version:db.pragma('user_version',{simple:true}),migration21:db.prepare('SELECT COUNT(*) count FROM schema_migrations WHERE version=21').get().count,checksum:db.prepare('SELECT checksum FROM schema_migrations WHERE version=20').get().checksum}));db.close();",
    );
    const driftState = driftStateResult.status === 0 ? JSON.parse(driftStateResult.stdout) : {};
    check(
      driftState.version === 20 &&
        driftState.migration21 === 0 &&
        driftState.checksum === unknownChecksum,
      '未知 drift 后数据库保持 Schema 20，未继续错误迁移',
    );
  } finally {
    spawnSync(join(installDir, 'LifeAssistant.exe'), ['--shutdown'], {
      env: driftLauncherEnv,
      stdio: 'ignore',
      timeout: 15_000,
    });
    for (let attempt = 0; attempt < 20 && driftLauncher.exitCode === null; attempt += 1)
      await sleep(250);
    if (driftLauncher.exitCode === null) killProcessTree(driftLauncher);
  }

  const restoreCurrentChecksum = runDatabaseScript(
    "const Database=require(process.argv[1]);const db=new Database(process.argv[2]);db.prepare('UPDATE schema_migrations SET checksum=? WHERE version=20').run(process.argv[3]);db.close();",
    currentMigration20Checksum,
  );
  check(restoreCurrentChecksum.status === 0, '未知 drift 样本恢复为当前合法 hash');

  // 5) Launcher 单实例、日志与 graceful shutdown 验证。
  const launcherPort = await findFreePort();
  const launcherLogPath = join(installRoot, 'launcher.log');
  const launcher = spawn(join(installDir, 'LifeAssistant.exe'), [], {
    env: {
      ...process.env,
      LIFE_ASSISTANT_FIXED_PORT: String(launcherPort),
      LIFE_ASSISTANT_SKIP_BROWSER: '1',
      LIFE_ASSISTANT_BOOTSTRAP_PATH: bootstrapPath,
      LIFE_ASSISTANT_LAUNCHER_LOG_PATH: launcherLogPath,
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
    },
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  });
  launcher.unref();
  try {
    let launcherReady = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${launcherPort}/health/ready`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          launcherReady = true;
          break;
        }
      } catch {
        // 等待启动。
      }
      await sleep(250);
    }
    check(launcherReady, 'Launcher 通过私有 node.exe 启动服务');
    let launcherLog = '';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      launcherLog = existsSync(launcherLogPath) ? await readFile(launcherLogPath, 'utf8') : '';
      if (launcherLog.includes('server.spawned') && launcherLog.includes('server.ready')) break;
      await sleep(250);
    }
    check(
      launcherLog.includes('server.spawned') && launcherLog.includes('server.ready'),
      'Launcher 持久日志记录 child PID 与 readiness',
    );

    // 二次启动：应只发信号并退出，不产生第二个服务实例。
    const second = spawnSync(join(installDir, 'LifeAssistant.exe'), [], {
      env: {
        ...process.env,
        LIFE_ASSISTANT_FIXED_PORT: String(launcherPort),
        LIFE_ASSISTANT_SKIP_BROWSER: '1',
        LIFE_ASSISTANT_BOOTSTRAP_PATH: bootstrapPath,
        LIFE_ASSISTANT_LAUNCHER_LOG_PATH: launcherLogPath,
      },
      stdio: 'ignore',
      timeout: 15_000,
    });
    await sleep(1_500);
    let processCount = 0;
    const listing = spawnSync('tasklist', ['/FI', 'IMAGENAME eq LifeAssistant.exe', '/FO', 'CSV'], {
      encoding: 'utf8',
    });
    processCount = (listing.stdout.match(/LifeAssistant\.exe/g) ?? []).length;
    check(second.status === 0 || second.error !== undefined, '二次启动进程可正常退出');
    check(processCount === 1, `Launcher 单实例（当前 ${String(processCount)} 个进程）`);
    const stillReady = await fetch(`http://127.0.0.1:${launcherPort}/health/ready`, {
      signal: AbortSignal.timeout(2000),
    });
    check(stillReady.ok, '二次启动后服务仍正常运行');
  } finally {
    const pid = launcher.pid;
    const shutdown = spawnSync(join(installDir, 'LifeAssistant.exe'), ['--shutdown'], {
      env: {
        ...process.env,
        LIFE_ASSISTANT_BOOTSTRAP_PATH: bootstrapPath,
        LIFE_ASSISTANT_LAUNCHER_LOG_PATH: launcherLogPath,
      },
      stdio: 'ignore',
      timeout: 15_000,
    });
    for (let attempt = 0; attempt < 20 && launcher.exitCode === null; attempt += 1)
      await sleep(250);
    check(
      shutdown.status === 0 && launcher.exitCode !== null,
      'Launcher 通过 IPC graceful shutdown',
    );
    if (pid !== undefined && launcher.exitCode === null) killProcessTree(launcher);
    const remaining = spawnSync(
      'tasklist',
      ['/FI', 'IMAGENAME eq LifeAssistant.exe', '/FO', 'CSV'],
      { encoding: 'utf8' },
    );
    check(!(remaining.stdout ?? '').includes('LifeAssistant.exe'), '退出后无 Launcher 残留进程');
    // 恢复用户桌面快捷方式（原本存在则还原原目标；原本不存在则清理 launcher 创建的临时快捷方式）。
    if (userShortcutPath !== undefined) {
      if (hadUserShortcut) {
        await copyFile(shortcutBackupPath, userShortcutPath);
        await rm(shortcutBackupPath, { force: true });
      } else if (existsSync(userShortcutPath)) {
        await rm(userShortcutPath, { force: true });
      }
    }
  }

  // 6) polluted bootstrap 在隔离副本中明确失败；修正后同一 artifact 可恢复启动。
  const pollutedBootstrapPath = join(installRoot, 'polluted-bootstrap.json');
  const pollutedLogPath = join(installRoot, 'polluted-launcher.log');
  await writeFile(
    pollutedBootstrapPath,
    `${JSON.stringify({ dataDirectory: join(installRoot, 'missing-polluted-data') }, null, 2)}\n`,
    'utf8',
  );
  const pollutedPort = await findFreePort();
  const pollutedEnv = {
    ...process.env,
    LIFE_ASSISTANT_FIXED_PORT: String(pollutedPort),
    LIFE_ASSISTANT_SKIP_BROWSER: '1',
    LIFE_ASSISTANT_BOOTSTRAP_PATH: pollutedBootstrapPath,
    LIFE_ASSISTANT_LAUNCHER_LOG_PATH: pollutedLogPath,
  };
  const pollutedLauncher = spawn(join(installDir, 'LifeAssistant.exe'), [], {
    env: pollutedEnv,
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  });
  pollutedLauncher.unref();
  let pollutedLog = '';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (existsSync(pollutedLogPath)) pollutedLog = await readFile(pollutedLogPath, 'utf8');
    if (pollutedLog.includes('server.start-failed')) break;
    await sleep(250);
  }
  check(pollutedLog.includes('server.start-failed'), 'polluted bootstrap 失败被 Launcher 日志捕获');
  spawnSync(join(installDir, 'LifeAssistant.exe'), ['--shutdown'], {
    env: pollutedEnv,
    stdio: 'ignore',
    timeout: 15_000,
  });
  for (let attempt = 0; attempt < 20 && pollutedLauncher.exitCode === null; attempt += 1)
    await sleep(250);
  if (pollutedLauncher.exitCode === null) killProcessTree(pollutedLauncher);

  await writeFile(pollutedBootstrapPath, `${JSON.stringify({ dataDirectory }, null, 2)}\n`, 'utf8');
  const recoveryPort = await findFreePort();
  const recoveredLauncher = spawn(join(installDir, 'LifeAssistant.exe'), [], {
    env: { ...pollutedEnv, LIFE_ASSISTANT_FIXED_PORT: String(recoveryPort) },
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  });
  recoveredLauncher.unref();
  try {
    check(
      await waitForReady(recoveryPort, recoveredLauncher),
      'polluted bootstrap 修正后恢复 READY',
    );
  } finally {
    spawnSync(join(installDir, 'LifeAssistant.exe'), ['--shutdown'], {
      env: { ...pollutedEnv, LIFE_ASSISTANT_FIXED_PORT: String(recoveryPort) },
      stdio: 'ignore',
      timeout: 15_000,
    });
    for (let attempt = 0; attempt < 20 && recoveredLauncher.exitCode === null; attempt += 1)
      await sleep(250);
    if (recoveredLauncher.exitCode === null) killProcessTree(recoveredLauncher);
  }

  const realBootstrapAfter = existsSync(realBootstrapPath)
    ? await readFile(realBootstrapPath, 'utf8')
    : undefined;
  check(realBootstrapAfter === realBootstrapBefore, '自动测试未污染真实 %LOCALAPPDATA% bootstrap');

  // 等待进程句柄释放后清理隔离目录（重试一次）。
  await sleep(800);
  try {
    await rm(installRoot, { recursive: true, force: true });
  } catch {
    await sleep(1_000);
    await rm(installRoot, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\n干净环境验收失败：${String(failures.length)} 项`);
    process.exit(1);
  }
  console.log('\n干净 Windows 环境安装/启动验收通过。');
  console.log('说明：Chrome 与 Edge 均使用机器实际安装版本完成 CDP 页面加载；');
  console.log('Launcher 浏览器发现顺序为 Chrome → Edge（含非标准路径）→ 系统默认。');
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

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
