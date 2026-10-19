import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const skipBuild = process.env.LIFE_ASSISTANT_E2E_SKIP_BUILD === '1';

const e2eBootstrapPath = resolve('test-results/e2e/bootstrap.json').replaceAll('\\', '/');
const desktopBrowser = process.env.LIFE_ASSISTANT_BROWSER === 'msedge' ? 'msedge' : 'chrome';
const browserExecutablePath = process.env.LIFE_ASSISTANT_BROWSER_EXECUTABLE_PATH;
const e2ePort = process.env.LIFE_ASSISTANT_E2E_PORT ?? '43120';
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const usesIsolatedPort = process.env.LIFE_ASSISTANT_E2E_PORT !== undefined;

export default defineConfig({
  testDir: './apps/web/e2e',
  // V2 专项各自拥有独立 fixture、bootstrap 和服务端口，由 isolated 编排器顺序执行。
  testIgnore: ['v2-*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `${skipBuild ? '' : 'pnpm build && '}cross-env LIFE_ASSISTANT_BOOTSTRAP_PATH="${e2eBootstrapPath}" LIFE_ASSISTANT_PORT=${e2ePort} node apps/server/dist/main.cjs`,
    // 首次启动尚未配置数据目录，等待存活探针后由用例完成初始化。
    url: `${e2eBaseUrl}/health/live`,
    reuseExistingServer: !process.env.CI && !usesIsolatedPort,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserExecutablePath === undefined
          ? { channel: desktopBrowser }
          : { launchOptions: { executablePath: browserExecutablePath } }),
      },
    },
  ],
});
