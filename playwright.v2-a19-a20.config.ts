import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const skipBuild = process.env.LIFE_ASSISTANT_E2E_SKIP_BUILD === '1';
const desktopBrowser = process.env.LIFE_ASSISTANT_BROWSER === 'msedge' ? 'msedge' : 'chrome';
const browserExecutablePath = process.env.LIFE_ASSISTANT_BROWSER_EXECUTABLE_PATH;
const port = 43179;
const baseURL = `http://127.0.0.1:${String(port)}`;
const bootstrapPath = resolve('test-results/v2-a19-a20/bootstrap.json').replaceAll('\\', '/');

export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: 'v2-a19-a20.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/a19-a20', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `${skipBuild ? '' : 'pnpm build && '}cross-env LIFE_ASSISTANT_BOOTSTRAP_PATH="${bootstrapPath}" LIFE_ASSISTANT_PORT=${String(port)} node apps/server/dist/main.cjs`,
    url: `${baseURL}/health/live`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: `v2-a19-a20-${desktopBrowser}`,
      use: {
        ...devices['Desktop Chrome'],
        ...(browserExecutablePath === undefined
          ? { channel: desktopBrowser }
          : { launchOptions: { executablePath: browserExecutablePath } }),
      },
    },
  ],
});
