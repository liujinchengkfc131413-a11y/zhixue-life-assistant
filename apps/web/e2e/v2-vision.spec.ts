import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';
import { completeSetup } from './helpers/complete-setup.js';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/vision');
const dataDirectory = resolve('test-results/v2-vision/data');
const viewports = [
  { width: 1448, height: 1086 },
  { width: 1536, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1100, height: 900 },
] as const;
const views = [
  { id: 'kanban', label: '看板', selector: '[data-planning-view="kanban"]' },
  { id: 'calendar', label: '日历', selector: '[data-planning-view="calendar"]' },
  { id: 'timeline', label: '时间轴', selector: '[data-planning-view="timeline"]' },
  { id: 'goal-tree', label: '目标树', selector: '[data-planning-view="goal-tree"]' },
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

test('initializes an isolated Phase 4 fixture with a shared goal and plan', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await completeSetup(page, dataDirectory);
  await page.evaluate(async () => {
    const previewResponse = await fetch('/api/v1/demo-data/clear-preview', { method: 'POST' });
    const preview = (await previewResponse.json()) as {
      data: { confirmation: { id: string; token: string } };
    };
    const clearResponse = await fetch('/api/v1/demo-data/clear', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        confirmationId: preview.data.confirmation.id,
        confirmationToken: preview.data.confirmation.token,
      }),
    });
    if (!clearResponse.ok) throw new Error('清空 Vision 隔离演示数据失败。');
  });

  await page.goto('/plans-goals');
  await expect(page.locator('.planning-kanban > section')).toHaveCount(5);
  await expect(page.locator('.planning-kanban-empty')).toHaveCount(5);
  await expect(page.locator('[data-empty-status="PAUSED"]')).toContainText('暂无暂停的计划');
  await expect(page.locator('[data-empty-status="CANCELLED"]')).toContainText('暂无已取消的计划');
  await expect(page.getByRole('heading', { name: '建立新的方向' })).toBeVisible();
  await expect(page.getByRole('button', { name: '＋ 新建', exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDirectory, 'first-run-empty-1536x1024.png') });
  await page.locator('.planning-direction-card[data-creation-kind="goal"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('目标名称').fill('完成生活助手 V2 视觉体系');
  await page.getByRole('button', { name: '创建目标' }).click();
  await page.getByRole('button', { name: '＋ 新建', exact: true }).click();
  await page.getByRole('button', { name: '新建计划', exact: true }).click();
  await page.getByLabel('关联目标').selectOption({ label: '完成生活助手 V2 视觉体系' });
  await expect(page.getByLabel('关联目标')).not.toHaveValue('');
  await page.getByLabel('计划名称').fill('交付 Vision 四视图');
  await page.getByRole('button', { name: '创建计划' }).click();
  await expect(page.locator('.planning-kanban article')).toContainText('交付 Vision 四视图');
});

test('keeps all four shared-data views usable at the master and four desktop viewports', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const metrics: Record<string, unknown>[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/plans-goals');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'vision');

    for (const view of views) {
      await page.getByRole('button', { name: view.label, exact: true }).click();
      await expect(page.locator(view.selector)).toBeVisible();
      await expect(page.locator(view.selector)).toContainText('交付 Vision 四视图');
      await waitForStablePage(page);
      const layout = await page.evaluate(() => {
        const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
        const kanban = document.querySelector<HTMLElement>('.planning-kanban');
        return {
          pageHeight: document.documentElement.scrollHeight,
          pageWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
          kanbanInternalOverflow: kanban ? kanban.scrollWidth - kanban.clientWidth : 0,
          atmosphereAnimation: atmosphere ? getComputedStyle(atmosphere).animationName : 'missing',
        };
      });
      expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
      expect(layout.atmosphereAnimation).toBe('none');
      const screenshot = `${view.id}-${String(viewport.width)}x${String(viewport.height)}.png`;
      await page.screenshot({ path: resolve(evidenceDirectory, screenshot), fullPage: true });
      metrics.push({ view: view.id, viewport, screenshot, ...layout });
    }
  }

  await writeFile(
    resolve(evidenceDirectory, 'vision-metrics.json'),
    `${JSON.stringify({ fixture: dataDirectory, metrics }, null, 2)}\n`,
    'utf8',
  );
  expect(consoleErrors).toEqual([]);
});

test('preserves filters, progress override, creation forms, and focus treatment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/plans-goals');

  await page.getByLabel('计划区域').selectOption('WORK');
  await expect(page.getByLabel('计划区域')).toHaveValue('WORK');
  await page.getByLabel('计划区域').selectOption('ALL');
  await page.getByRole('button', { name: '目标树', exact: true }).click();

  const goalNode = page.locator('.goal-node').filter({ hasText: '完成生活助手 V2 视觉体系' });
  await expect(goalNode).toBeVisible();
  const goalProgress = goalNode.locator('[data-progress-entity="GOAL"]');
  await goalProgress.getByLabel('手动进度').fill('42');
  await goalProgress.getByRole('button', { name: '手动覆盖' }).click();
  await expect(goalProgress.getByText('42%', { exact: true })).toBeVisible();

  const timelineButton = page.getByRole('button', { name: '时间轴', exact: true });
  await page.getByRole('button', { name: '目标树', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(timelineButton).toBeFocused();
  expect(
    await timelineButton.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe('none');
  await expect(page.getByRole('heading', { name: '建立新的方向' })).toBeVisible();
  await page.locator('.planning-direction-card[data-creation-kind="goal"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('目标名称')).toBeVisible();
  await expect(page.getByLabel('计划名称')).toHaveCount(0);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新建', exact: true }).click();
  await page.getByRole('button', { name: '新建计划', exact: true }).click();
  await expect(page.getByLabel('计划名称')).toBeVisible();
});

test('uses Air Glass, mist light, and spatial hierarchy without decorative particles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/plans-goals');
  await expect(page.getByRole('heading', { name: '计划与目标', exact: true })).toBeVisible();
  await expect(page.locator('.planning-kanban > section').first()).toBeVisible();
  await page.getByRole('button', { name: '＋ 新建', exact: true }).click();
  await page.getByRole('button', { name: '新建目标', exact: true }).click();
  const values = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
    const workspace = document.querySelector<HTMLElement>('.planning-workspace');
    const form = document.querySelector<HTMLElement>('.planning-form');
    const column = document.querySelector<HTMLElement>('.planning-kanban > section');
    const goalDirection = document.querySelector<HTMLElement>(
      '.planning-direction-card[data-creation-kind="goal"]',
    );
    const planDirection = document.querySelector<HTMLElement>(
      '.planning-direction-card[data-creation-kind="plan"]',
    );
    if (
      !shell ||
      !atmosphere ||
      !workspace ||
      !form ||
      !column ||
      !goalDirection ||
      !planDirection
    ) {
      throw new Error('缺少 Vision 验收节点。');
    }
    const shellStyle = getComputedStyle(shell);
    const formStyle = getComputedStyle(form);
    return {
      pageBackground: shellStyle.getPropertyValue('--page-bg').trim(),
      cardRadius: shellStyle.getPropertyValue('--card-radius').trim(),
      cardGap: shellStyle.getPropertyValue('--card-gap').trim(),
      panelBlur: shellStyle.getPropertyValue('--panel-blur').trim(),
      atmosphereBackground: getComputedStyle(atmosphere).backgroundImage,
      formShadow: formStyle.boxShadow,
      formBackground: formStyle.backgroundImage,
      goalArtwork: getComputedStyle(form, '::before').backgroundImage,
      goalDirectionArtwork: getComputedStyle(goalDirection).backgroundImage,
      planDirectionArtwork: getComputedStyle(planDirection).backgroundImage,
      columnBorderRadius: getComputedStyle(column).borderRadius,
      workspaceTop: workspace.getBoundingClientRect().top,
      formTop: form.getBoundingClientRect().top,
      particleCount: document.querySelectorAll('[class*="particle"], [class*="star"]').length,
    };
  });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新建', exact: true }).click();
  await page.getByRole('button', { name: '新建计划', exact: true }).click();
  const planArtwork = await page
    .locator('.planning-form[data-creation-kind="plan"]')
    .evaluate((element) => getComputedStyle(element, '::before').backgroundImage);

  expect(values.pageBackground).toBe('#1b4264');
  expect(values.cardRadius).toBe('20px');
  expect(values.cardGap).toBe('22px');
  expect(values.panelBlur).toBe('14px');
  expect(values.atmosphereBackground).toContain('vision-distant-horizon-v2-');
  expect(values.formShadow).toContain('inset');
  expect(values.goalArtwork).toContain('vision-goal-ascent-v2-');
  expect(values.goalDirectionArtwork).toContain('vision-goal-ascent-v2-');
  expect(values.planDirectionArtwork).toContain('vision-plan-steps-v2-');
  expect(planArtwork).toContain('vision-plan-steps-v2-');
  expect(values.columnBorderRadius).toBe('18px');
  expect(values.workspaceTop).toBeLessThan(values.formTop);
  expect(values.particleCount).toBe(0);
});
