import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';
import { completeSetup } from './helpers/complete-setup.js';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/work-v2');
const dataDirectory = resolve('test-results/v2-work/data');
const viewports = [
  { width: 1536, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1100, height: 900 },
] as const;
const workRoutes = [
  { id: 'overview', path: '/work', heading: '工作总览' },
  { id: 'self-media', path: '/work/self-media', heading: '自媒体' },
  { id: 'development', path: '/work/development', heading: '开发项目' },
  { id: 'learning', path: '/work/learning', heading: '学习' },
] as const;
const visualMetrics: {
  route: string;
  viewport: string;
  horizontalOverflow: number;
  pageWidth: number;
  pageHeight: number;
  atmosphereAnimation: string;
  screenshot: string;
}[] = [];

const waitForStablePage = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.waitForTimeout(200);
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('initializes isolated demo data for Phase 2 verification', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await completeSetup(page, dataDirectory);
});

test('keeps all Work entries usable at the four Phase 2 desktop viewports', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of workRoutes) {
      await page.goto(route.path);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'work');
      await expect(page.locator('.work-page')).toHaveAttribute('data-work-section', route.id);
      await expect(
        page.getByRole('heading', { name: route.heading, exact: true }).first(),
      ).toBeVisible();
      await waitForStablePage(page);
      const screenshot = `${route.id}-${String(viewport.width)}x${String(viewport.height)}.png`;
      const metrics = await page.evaluate(() => {
        const workPage = document.querySelector<HTMLElement>('.work-page');
        const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
        if (!workPage || !atmosphere) throw new Error('缺少 Work V2 metrics 节点。');
        const pageRect = workPage.getBoundingClientRect();
        return {
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
          pageWidth: Math.round(pageRect.width),
          pageHeight: Math.round(pageRect.height),
          atmosphereAnimation: getComputedStyle(atmosphere).animationName,
        };
      });
      expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
      visualMetrics.push({
        route: route.path,
        viewport: `${String(viewport.width)}x${String(viewport.height)}`,
        ...metrics,
        screenshot,
      });
      await page.screenshot({
        path: resolve(evidenceDirectory, screenshot),
        fullPage: true,
      });
    }
  }

  expect(consoleErrors).toEqual([]);
  await writeFile(
    resolve(evidenceDirectory, 'work-metrics.json'),
    `${JSON.stringify({ fixture: dataDirectory, dpr: 1, entries: visualMetrics }, null, 2)}\n`,
    'utf8',
  );
});

test('preserves Work filters, view switches, selected details, and focus treatment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });

  await page.goto('/work');
  await page.getByRole('button', { name: '自定义' }).click();
  await expect(page.getByLabel('开始日期')).toBeVisible();
  await expect(page.getByLabel('结束日期')).toBeVisible();
  await page.getByRole('link', { name: '自媒体', exact: true }).click();
  await expect(page).toHaveURL(/\/work\/self-media$/u);

  await page.getByRole('button', { name: '趋势', exact: true }).click();
  await expect(page.getByLabel('近月内容表现趋势')).toBeVisible();
  await page.getByRole('button', { name: '管线', exact: true }).click();
  await expect(page.getByRole('heading', { name: '内容详情' })).toBeVisible();
  const selectedContent = page.locator('.pipeline-item[data-selected="true"]');
  await expect(selectedContent).toHaveCount(1);
  expect(await selectedContent.evaluate((element) => getComputedStyle(element).boxShadow)).toBe(
    'none',
  );

  await page.goto('/work/development');
  await expect(page.getByRole('button', { name: /生活助手改进/u }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '保存项目' })).toBeVisible();

  await page.goto('/work/learning');
  await expect(page.getByRole('heading', { name: '学习资源详情' })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存资源' })).toBeVisible();

  const firstTab = page.getByRole('link', { name: '工作总览' });
  await firstTab.focus();
  await expect(firstTab).toBeFocused();
  expect(await firstTab.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none',
  );
});

test('uses the V2 cold-air atmosphere, glass hierarchy, and brighter fields', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/work');
  await expect(page.locator('.work-metrics article')).toHaveCount(4);
  await expect(page.locator('.work-overview-grid .work-module')).toHaveCount(3);
  await page.getByRole('button', { name: '自定义' }).click();
  // “自定义”点击后自定义日期区间控件异步渲染；.date-range 含开始/结束两个输入框，
  // 先等待首个字段出现再取值，避免 evaluate 时序竞态（querySelector 取首个，等价 first()）。
  await expect(page.locator('.date-range input').first()).toBeVisible();

  const values = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
    const primaryModule = document.querySelector<HTMLElement>('.work-module:first-child');
    const secondaryModule = document.querySelector<HTMLElement>('.work-module:nth-child(2)');
    const field = document.querySelector<HTMLElement>('.date-range input');
    if (!shell || !atmosphere || !primaryModule || !secondaryModule || !field) {
      throw new Error('缺少 Work V2 验收节点。');
    }
    const shellStyle = getComputedStyle(shell);
    const atmosphereStyle = getComputedStyle(atmosphere);
    const primaryStyle = getComputedStyle(primaryModule);
    const secondaryStyle = getComputedStyle(secondaryModule);
    const fieldStyle = getComputedStyle(field);
    return {
      pageBackground: shellStyle.getPropertyValue('--page-bg').trim(),
      pageBackgroundSecondary: shellStyle.getPropertyValue('--page-bg-secondary').trim(),
      cardRadius: shellStyle.getPropertyValue('--card-radius').trim(),
      hoverDuration: shellStyle.getPropertyValue('--motion-hover').trim(),
      panelDuration: shellStyle.getPropertyValue('--motion-panel').trim(),
      panelBlur: shellStyle.getPropertyValue('--panel-blur').trim(),
      fieldBackground: shellStyle.getPropertyValue('--field-bg').trim(),
      fieldHover: shellStyle.getPropertyValue('--field-hover').trim(),
      fieldBorder: shellStyle.getPropertyValue('--field-border').trim(),
      focusBorder: shellStyle.getPropertyValue('--border-focus').trim(),
      atmosphereBackground: atmosphereStyle.backgroundImage,
      atmosphereDuration: atmosphereStyle.animationDuration,
      primaryBlur: primaryStyle.backdropFilter,
      primaryBackground: primaryStyle.backgroundImage,
      primaryShadow: primaryStyle.boxShadow,
      secondaryBackground: secondaryStyle.backgroundImage,
      secondaryShadow: secondaryStyle.boxShadow,
      fieldRenderedBackground: fieldStyle.backgroundColor,
      primaryColumns: primaryModule.getBoundingClientRect().width,
      secondaryColumns: secondaryModule.getBoundingClientRect().width,
    };
  });

  expect(values.pageBackground).toBe('#0e141b');
  expect(values.pageBackgroundSecondary).toBe('#21313f');
  expect(values.cardRadius).toBe('18px');
  expect(['170ms', '.17s']).toContain(values.hoverDuration);
  expect(['210ms', '.21s']).toContain(values.panelDuration);
  expect(values.panelBlur).toBe('14px');
  expect(['rgb(46 67 78 / 68%)', '#2e434ead']).toContain(values.fieldBackground);
  expect(['rgb(53 76 87 / 76%)', '#354c57c2']).toContain(values.fieldHover);
  expect(['rgb(188 215 228 / 15%)', '#bcd7e426']).toContain(values.fieldBorder);
  expect(values.focusBorder).toBe('#8fc8f2');
  expect(values.atmosphereBackground).toContain('radial-gradient');
  expect(values.atmosphereBackground).toContain('linear-gradient');
  expect(['32s', '32000ms']).toContain(values.atmosphereDuration);
  expect(values.primaryBlur).toContain('14px');
  expect(values.primaryBackground).not.toBe(values.secondaryBackground);
  expect(values.primaryShadow).not.toBe('none');
  expect(values.secondaryShadow).not.toBe('none');
  expect(values.primaryShadow).not.toBe(values.secondaryShadow);
  expect(values.fieldRenderedBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(values.primaryColumns / values.secondaryColumns).toBeGreaterThan(1.8);
});
