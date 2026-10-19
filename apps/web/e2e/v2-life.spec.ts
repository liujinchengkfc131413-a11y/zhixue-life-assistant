import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';
import { completeSetup } from './helpers/complete-setup.js';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/life-v2');
const dataDirectory = resolve('test-results/v2-life/data');
const viewports = [
  { width: 1536, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1100, height: 900 },
] as const;
const lifeRoutes = [
  { id: 'overview', path: '/life', heading: '生活总览' },
  { id: 'shopping', path: '/life/shopping', heading: '购物' },
  { id: 'diet', path: '/life/diet', heading: '饮食' },
  { id: 'fitness', path: '/life/fitness', heading: '健身' },
  { id: 'entertainment', path: '/life/entertainment', heading: '娱乐' },
] as const;

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

test('initializes isolated demo data for Phase 3 verification', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await completeSetup(page, dataDirectory);
});

test('keeps all Life entries usable at the four Phase 3 desktop viewports', async ({ page }) => {
  const consoleErrors: string[] = [];
  const metrics: Record<string, unknown>[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of lifeRoutes) {
      await page.goto(route.path);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'life');
      await expect(
        page.getByRole('heading', { name: route.heading, exact: true }).first(),
      ).toBeVisible();
      await waitForStablePage(page);
      const layout = await page.evaluate(() => {
        const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
        return {
          dpr: window.devicePixelRatio,
          pageHeight: document.documentElement.scrollHeight,
          pageWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
          atmosphereAnimation: atmosphere ? getComputedStyle(atmosphere).animationName : 'missing',
        };
      });
      expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
      expect(layout.atmosphereAnimation).toBe('none');
      const screenshot = `${route.id}-browse-p5-${String(viewport.width)}x${String(viewport.height)}.png`;
      await page.screenshot({
        path: resolve(evidenceDirectory, screenshot),
        fullPage: true,
      });
      metrics.push({ route: route.path, viewport, screenshot, ...layout });
    }
  }

  await writeFile(
    resolve(evidenceDirectory, 'life-metrics.json'),
    `${JSON.stringify({ fixture: dataDirectory, metrics }, null, 2)}\n`,
    'utf8',
  );
  expect(consoleErrors).toEqual([]);
});

test('separates Life browsing from create and management panels without losing fields', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });

  await page.goto('/life');
  await page.getByRole('button', { name: '本周', exact: true }).click();
  await expect(page.locator('.range-control .button[data-selected="true"]')).toHaveText('本周');

  await page.getByRole('link', { name: '购物', exact: true }).click();
  await expect(page).toHaveURL(/\/life\/shopping$/u);
  await expect(page.getByRole('heading', { name: '待购详情' })).toBeHidden();
  await expect(page.getByPlaceholder('实际单价（元）')).toBeHidden();
  const selectedShopping = page.locator('.shopping-list button[data-selected="true"]');
  await expect(selectedShopping).toHaveCount(1);
  expect(await selectedShopping.evaluate((element) => getComputedStyle(element).boxShadow)).toBe(
    'none',
  );
  await selectedShopping.click();
  await expect(page.getByRole('heading', { name: '待购详情' })).toBeVisible();
  await expect(page.getByPlaceholder('实际单价（元）')).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, 'shopping-manage-drawer-1536x1024.png'),
  });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '＋ 添加待购' }).click();
  await expect(page.getByPlaceholder('新增待购商品')).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, 'shopping-create-drawer-1536x1024.png'),
  });
  await page.getByRole('button', { name: '关闭', exact: true }).click();

  await page.goto('/life/diet');
  await expect(page.getByRole('heading', { name: '今日饮食' })).toBeVisible();
  await expect(page.getByPlaceholder('餐食名称')).toBeHidden();
  await page.getByRole('button', { name: '＋ 记录一餐' }).click();
  await expect(page.getByPlaceholder('餐食名称')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '管理饮食资料' }).click();
  await expect(page.getByPlaceholder('食谱名称')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();

  await page.goto('/life/fitness');
  await expect(page.getByRole('heading', { name: '训练记录' })).toBeVisible();
  await expect(page.getByPlaceholder('训练备注')).toBeHidden();
  await page.getByRole('button', { name: '＋ 记录一次训练' }).click();
  await expect(page.getByPlaceholder('训练备注')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '管理训练资料' }).click();
  await expect(page.getByPlaceholder('动作名称')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();

  await page.goto('/life/entertainment');
  await page.getByRole('button', { name: /周末公园散步/u }).click();
  await expect(page.getByRole('heading', { name: '周末公园散步' })).toBeVisible();
  await expect(page.getByRole('button', { name: '更新进度' })).toBeVisible();

  const overviewTab = page.getByRole('link', { name: '生活总览' });
  await overviewTab.focus();
  await expect(overviewTab).toBeFocused();
  await page.keyboard.press('Tab');
  const shoppingTab = page.getByRole('link', { name: '购物', exact: true });
  await expect(shoppingTab).toBeFocused();
  expect(
    await shoppingTab.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    }),
  ).toBe(true);
});

test('uses the approved Life fog, rhythm, and mixed overview hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/life');
  await expect(page.locator('.life-highlights article')).toHaveCount(4);
  await expect(page.locator('.life-overview-grid .life-overview-card')).toHaveCount(4);

  const values = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
    const firstCard = document.querySelector<HTMLElement>('.life-overview-card:nth-child(1)');
    const secondCard = document.querySelector<HTMLElement>('.life-overview-card:nth-child(2)');
    const thirdCard = document.querySelector<HTMLElement>('.life-overview-card:nth-child(3)');
    const fourthCard = document.querySelector<HTMLElement>('.life-overview-card:nth-child(4)');
    const field = document.querySelector<HTMLElement>('.range-control .button');
    if (!shell || !atmosphere || !field || !firstCard || !secondCard || !thirdCard || !fourthCard) {
      throw new Error('缺少 Life 验收节点。');
    }
    const shellStyle = getComputedStyle(shell);
    const cardStyle = getComputedStyle(firstCard);
    return {
      pageBackground: shellStyle.getPropertyValue('--page-bg').trim(),
      cardRadius: shellStyle.getPropertyValue('--card-radius').trim(),
      cardGap: shellStyle.getPropertyValue('--card-gap').trim(),
      hoverDuration: shellStyle.getPropertyValue('--motion-hover').trim(),
      panelDuration: shellStyle.getPropertyValue('--motion-panel').trim(),
      surface: shellStyle.getPropertyValue('--surface').trim(),
      surfaceElevated: shellStyle.getPropertyValue('--surface-elevated').trim(),
      fieldBackground: shellStyle.getPropertyValue('--field-bg').trim(),
      textPrimary: shellStyle.getPropertyValue('--text-primary').trim(),
      textSecondary: shellStyle.getPropertyValue('--text-secondary').trim(),
      textMuted: shellStyle.getPropertyValue('--text-muted').trim(),
      blur: cardStyle.backdropFilter,
      atmosphereBackground: getComputedStyle(atmosphere).backgroundImage,
      firstWidth: firstCard.getBoundingClientRect().width,
      secondWidth: secondCard.getBoundingClientRect().width,
      thirdWidth: thirdCard.getBoundingClientRect().width,
      fourthWidth: fourthCard.getBoundingClientRect().width,
    };
  });

  expect(values.pageBackground).toBe('#eaf2ec');
  expect(values.cardRadius).toBe('22px');
  expect(values.cardGap).toBe('22px');
  expect(['220ms', '.22s']).toContain(values.hoverDuration);
  expect(['260ms', '.26s']).toContain(values.panelDuration);
  expect(values.blur).toContain('7px');
  expect(values.surface).toBe('#fffdf6b8');
  expect(values.surfaceElevated).toBe('#fffffce0');
  expect(values.fieldBackground).toBe('#e1eadfdb');
  expect(values.textPrimary).toBe('#344239');
  expect(values.textSecondary).toBe('#526158');
  expect(values.textMuted).toBe('#5b6a61');
  expect(values.atmosphereBackground).toContain('life-morning-sage-forest-v2-');
  expect(values.firstWidth / values.secondWidth).toBeGreaterThan(1.3);
  expect(values.fourthWidth / values.thirdWidth).toBeGreaterThan(1.8);
});

test('keeps static mist and sunlight while reduced motion stops atmosphere drift', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/life');
  const atmosphere = page.locator('.theme-atmosphere');
  await expect(atmosphere).toBeVisible();
  expect(await atmosphere.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    'none',
  );
  expect(
    await atmosphere.evaluate((element) => getComputedStyle(element).backgroundImage),
  ).not.toBe('none');
});
