import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/rebaseline-v2');
const dataDirectory = resolve('test-results/v2-rebaseline/data');

interface RebaselineRoute {
  readonly id: string;
  readonly path: string;
  readonly heading: string;
  readonly theme: 'today' | 'work' | 'life' | 'vision' | 'ai' | 'system';
  readonly exact?: boolean;
}

interface LayoutMetric {
  readonly route: string;
  readonly theme: string | null;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly scrollWidth: number;
  readonly scrollHeight: number;
  readonly horizontalOverflow: number;
}

const routes = [
  { id: 'today', path: '/', heading: '今日', theme: 'today', exact: true },
  { id: 'work-overview', path: '/work', heading: '工作总览', theme: 'work' },
  { id: 'work-self-media', path: '/work/self-media', heading: '自媒体', theme: 'work' },
  { id: 'work-development', path: '/work/development', heading: '开发项目', theme: 'work' },
  { id: 'work-learning', path: '/work/learning', heading: '学习', theme: 'work' },
  { id: 'life-overview', path: '/life', heading: '生活总览', theme: 'life' },
  { id: 'life-shopping', path: '/life/shopping', heading: '购物', theme: 'life' },
  { id: 'life-diet', path: '/life/diet', heading: '饮食', theme: 'life', exact: true },
  { id: 'life-fitness', path: '/life/fitness', heading: '健身', theme: 'life' },
  { id: 'life-entertainment', path: '/life/entertainment', heading: '娱乐', theme: 'life' },
  { id: 'plans-goals', path: '/plans-goals', heading: '计划与目标', theme: 'vision' },
  { id: 'assistant', path: '/assistant', heading: 'AI 助手', theme: 'ai' },
  { id: 'inbox', path: '/inbox', heading: '收集箱', theme: 'system' },
  { id: 'data-management', path: '/data-management', heading: '数据管理', theme: 'system' },
  { id: 'reminders', path: '/reminders', heading: '提醒中心', theme: 'system' },
  { id: 'settings', path: '/settings', heading: '设置', theme: 'system' },
] as const satisfies readonly RebaselineRoute[];

const representativeRoutes = [
  routes[0],
  routes[1],
  routes[5],
  routes[10],
  routes[11],
  routes[12],
] as const;

const primaryViewport = { width: 1536, height: 1024 } as const;
const extendedViewports = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1100, height: 900 },
] as const;

const waitForStablePage = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.waitForTimeout(250);
};

const watchConsole = (page: Page): string[] => {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    messages.push(`pageerror: ${error.message}`);
  });
  return messages;
};

const openRoute = async (
  page: Page,
  route: RebaselineRoute,
  viewport: { readonly width: number; readonly height: number },
): Promise<LayoutMetric> => {
  await page.setViewportSize(viewport);
  await page.goto(route.path);
  await expect(
    page.getByRole('heading', { name: route.heading, exact: route.exact ?? false }).first(),
  ).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', route.theme);
  await waitForStablePage(page);
  return page.evaluate(
    ({ route: currentRoute, viewport: currentViewport }) => ({
      route: currentRoute,
      theme: document.querySelector('.app-shell')?.getAttribute('data-theme') ?? null,
      viewport: currentViewport,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    }),
    { route: route.path, viewport },
  );
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('captures setup and initializes isolated V2 plan rebaseline data', async ({ page }) => {
  test.setTimeout(90_000);
  const consoleMessages = watchConsole(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(primaryViewport);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '开始使用生活助手' })).toBeVisible();
  await waitForStablePage(page);
  await page.screenshot({ path: resolve(evidenceDirectory, 'setup-step1-1536x1024.png') });

  await page.getByRole('button', { name: '继续' }).click();
  await page.getByLabel('数据目录').fill(dataDirectory);
  await expect(page.getByRole('checkbox', { name: /加载演示数据/ })).toBeChecked();
  await waitForStablePage(page);
  await page.screenshot({ path: resolve(evidenceDirectory, 'setup-step2-1536x1024.png') });

  await page.getByRole('button', { name: '继续' }).click();
  await waitForStablePage(page);
  await page.screenshot({ path: resolve(evidenceDirectory, 'setup-step3-1536x1024.png') });
  await page.getByRole('button', { name: '完成并进入应用' }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  // The unconfigured shell probes business endpoints before setup completes, which produces
  // expected 500 resource messages. The configured application must be clean on a fresh load.
  consoleMessages.length = 0;
  await page.reload();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await waitForStablePage(page);
  expect(consoleMessages).toEqual([]);
});

test('captures all current routes at the primary viewport', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleMessages = watchConsole(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const metrics: LayoutMetric[] = [];

  for (const route of routes) {
    metrics.push(await openRoute(page, route, primaryViewport));
    await page.screenshot({
      path: resolve(evidenceDirectory, `${route.id}-1536x1024.png`),
      fullPage: true,
    });
  }

  await writeFile(
    resolve(evidenceDirectory, 'metrics-1536x1024.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8',
  );
  expect(consoleMessages).toEqual([]);
});

for (const viewport of extendedViewports) {
  test(`captures six visual spaces at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const consoleMessages = watchConsole(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const metrics: LayoutMetric[] = [];

    for (const route of representativeRoutes) {
      metrics.push(await openRoute(page, route, viewport));
      await page.screenshot({
        path: resolve(
          evidenceDirectory,
          `${route.id}-${String(viewport.width)}x${String(viewport.height)}.png`,
        ),
        fullPage: true,
      });
    }

    await writeFile(
      resolve(
        evidenceDirectory,
        `metrics-${String(viewport.width)}x${String(viewport.height)}.json`,
      ),
      `${JSON.stringify(metrics, null, 2)}\n`,
      'utf8',
    );
    expect(consoleMessages).toEqual([]);
  });
}

test('keeps frozen global navigation and overlay flows operable', async ({ page }) => {
  const consoleMessages = watchConsole(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(primaryViewport);
  await page.goto('/work');
  await expect(page.getByRole('heading', { name: '工作总览' })).toBeVisible();

  await page.getByRole('link', { name: '生活', exact: true }).click();
  await expect(page).toHaveURL(/\/life$/);
  await expect(page.getByRole('heading', { name: '生活总览' })).toBeVisible();

  await page.getByRole('button', { name: '快速记录' }).click();
  await expect(page.getByRole('dialog', { name: '快速记录' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '快速记录' })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: '全局搜索' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '全局搜索' })).toHaveCount(0);

  await page.getByRole('link', { name: '今日' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('24 小时时间轴')).toBeVisible();
  expect(consoleMessages).toEqual([]);
});
