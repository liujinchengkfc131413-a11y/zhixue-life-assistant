/**
 * Today V2 Phase 0 视觉基线复现脚本。
 *
 * 用法：node scripts/today-visual-qa.mjs [--live-only|--phase8]
 * - 使用临时 bootstrap、临时数据目录和演示数据启动本地 server，绝不读取用户数据；
 * - 默认按 docs/design/today/fixtures/manifest.json 渲染稳定基线和所有确定性 Fixture；
 * - --live-only 仅更新实时演示数据下的 00-current-implementation.png。
 */
/* global console, process, fetch, AbortSignal, document, performance, window */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from '@playwright/test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(repoRoot, 'docs', 'design', 'today', 'fixtures');
const manifestPath = join(fixturesDir, 'manifest.json');
const outputDir = join(repoRoot, 'docs', 'design', 'today');
const serverEntry = join(repoRoot, 'apps', 'server', 'dist', 'main.cjs');
const port = 43123;
const installRoot = join(tmpdir(), `la-visual-qa-${Date.now()}`);
const bootstrapPath = join(installRoot, 'bootstrap.json');
const dataDirectory = join(installRoot, 'data');
const browserPath =
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const waitReady = async (base) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return true;
    } catch {
      // 服务仍在启动。
    }
    await sleep(250);
  }
  return false;
};

const killTree = (child) => {
  if (child.pid === undefined) return;
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
};

const readFixture = (file) => JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'));

const main = async () => {
  const liveOnly = process.argv.includes('--live-only');
  const phase8 = process.argv.includes('--phase8');
  await mkdir(installRoot, { recursive: true });

  const server = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      LIFE_ASSISTANT_PORT: String(port),
      LIFE_ASSISTANT_BOOTSTRAP_PATH: bootstrapPath,
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let serverStderr = '';
  server.stderr?.on('data', (chunk) => {
    serverStderr += chunk.toString('utf8');
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    if (!(await waitReady(base))) {
      throw new Error(`server 未就绪：${serverStderr.slice(0, 2000)}`);
    }
    const init = await fetch(`${base}/api/v1/setup/initialize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataDirectory,
        includeDemoData: true,
        backupFrequency: 'WEEKLY',
        backupRetentionCount: 5,
        quickCaptureDefaultAction: 'INBOX',
      }),
    });
    if (init.status !== 200)
      throw new Error(`初始化失败：${String(init.status)} ${await init.text()}`);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.version !== 1 || !Array.isArray(manifest.fixtures)) {
      throw new Error('fixtures/manifest.json 格式或版本无效。');
    }
    const browser = await chromium.launch({ executablePath: browserPath });

    const shoot = async (name, fixture) => {
      const context = await browser.newContext({
        viewport: manifest.viewport,
        deviceScaleFactor: manifest.viewport.deviceScaleFactor,
      });
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      if (fixture !== undefined) {
        const fixedTimestamp = Date.parse(fixture.serverNow);
        await page.addInitScript((timestamp) => {
          const NativeDate = Date;
          class FixedDate extends NativeDate {
            constructor(...arguments_) {
              super(...(arguments_.length === 0 ? [timestamp] : arguments_));
            }
            static now() {
              return timestamp;
            }
          }
          Object.setPrototypeOf(FixedDate, NativeDate);
          window.Date = FixedDate;
        }, fixedTimestamp);
        await page.route('**/api/v1/today*', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: fixture, meta: { requestId: 'today-fixture' } }),
          }),
        );
      }
      const response = await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      try {
        await page.waitForSelector('.today-immersive, .today-summary, .today-state', {
          timeout: 20_000,
        });
      } catch (error) {
        const body = await page.evaluate(() => document.body.innerText);
        throw new Error(
          `渲染超时：${fixture?.date ?? 'live'}; pageErrors=${JSON.stringify(pageErrors)}; consoleErrors=${JSON.stringify(consoleErrors.slice(0, 5))}; body=${body}`,
          { cause: error },
        );
      }
      await sleep(2500);
      const screenshotPath = name.startsWith('../')
        ? join(fixturesDir, name)
        : join(outputDir, name);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const navigation = await page.evaluate(() => {
        const entry = performance.getEntriesByType('navigation')[0];
        return entry === undefined ? null : entry.toJSON();
      });
      console.log(
        `  ✓ ${name} (http ${String(response?.status())}, pageErrors=${String(pageErrors.length)}, consoleErrors=${String(consoleErrors.length)}, domContentLoaded=${String(navigation?.domContentLoadedEventEnd ?? 'n/a')})`,
      );
      if (name.startsWith('00-')) {
        const areas = await page.evaluate(() => ({
          env: document.querySelector('.today-env') !== null,
          scene: document.querySelector('.fountain-scene') !== null,
          chips: document.querySelector('.today-chips') !== null,
          plan: document.querySelector('.today-plan') !== null,
          timeline: document.querySelector('.today-timeline') !== null,
          ai: document.querySelector('.today-ai') !== null,
          sidebarToday: document.querySelector('.sidebar--today') !== null,
          contentToday: document.querySelector('.content--today') !== null,
        }));
        console.log(`  [areas] ${JSON.stringify(areas)}`);
      }
      await context.close();
    };

    if (liveOnly) {
      console.log('截图：当前实现（实时演示数据）');
      await shoot('00-current-implementation.png', undefined);
    } else {
      const byFile = new Map(manifest.fixtures.map((entry) => [entry.file, entry]));
      const baseline = byFile.get(manifest.baseline.fixture);
      if (baseline === undefined) throw new Error('基线 fixture 不在 manifest.fixtures 中。');
      const baselineScreenshot = phase8
        ? '00-phase8-release-candidate.png'
        : manifest.baseline.screenshot;
      console.log(phase8 ? '截图：Phase 8 正式发布候选' : '截图：Phase 0 当前实现稳定基线');
      await shoot(baselineScreenshot, readFixture(baseline.file));
      console.log(`截图：${String(manifest.fixtures.length)} 种确定性状态`);
      for (const entry of manifest.fixtures) {
        await shoot(`fixtures/${entry.screenshot}`, readFixture(entry.file));
      }
    }
    await browser.close();
  } finally {
    killTree(server);
    await sleep(800);
    await rm(installRoot, { recursive: true, force: true }).catch(() => undefined);
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
