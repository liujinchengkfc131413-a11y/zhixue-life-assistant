import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';
import { completeSetup } from './helpers/complete-setup.js';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/foundations-v2');
const dataDirectory = resolve('test-results/v2-foundations/data');

const themeRoutes = [
  { id: 'today', path: '/', heading: '今日', exact: true, theme: 'today' },
  { id: 'work', path: '/work', heading: '工作总览', exact: false, theme: 'work' },
  { id: 'life', path: '/life', heading: '生活总览', exact: false, theme: 'life' },
  { id: 'vision', path: '/plans-goals', heading: '计划与目标', exact: false, theme: 'vision' },
  { id: 'ai', path: '/assistant', heading: 'AI 助手', exact: false, theme: 'ai' },
  { id: 'system', path: '/inbox', heading: '收集箱', exact: false, theme: 'system' },
] as const;

const nonTodayRoutes = themeRoutes.filter((route) => route.theme !== 'today');

const waitForStablePage = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.waitForTimeout(250);
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('initializes isolated demo data for Phase 1 verification', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await completeSetup(page, dataDirectory);
});

test('maps every visual space to the correct theme without overflow or runtime errors', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const metrics: Record<string, string | number | boolean>[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1536, height: 1024 });

  for (const route of themeRoutes) {
    await page.goto(route.path);
    await expect(
      page.getByRole('heading', { name: route.heading, exact: route.exact }).first(),
    ).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', route.theme);
    await expect(page.locator('.theme-atmosphere')).toHaveCount(route.theme === 'today' ? 0 : 1);
    await waitForStablePage(page);
    const routeMetrics = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.app-shell');
      const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
      if (shell === null) throw new Error('缺少 AppShell。');
      return {
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        colorScheme: getComputedStyle(shell).colorScheme,
        atmospherePresent: atmosphere !== null,
        atmospherePointerEvents:
          atmosphere === null ? 'not-applicable' : getComputedStyle(atmosphere).pointerEvents,
      };
    });
    expect(routeMetrics.horizontalOverflow).toBeLessThanOrEqual(0);
    metrics.push({
      route: route.path,
      theme: route.theme,
      viewportWidth: 1536,
      viewportHeight: 1024,
      ...routeMetrics,
    });
    await page.screenshot({
      path: resolve(evidenceDirectory, `${route.id}-phase1-1536x1024.png`),
      fullPage: true,
    });
  }

  expect(consoleErrors).toEqual([]);
  await writeFile(
    resolve(evidenceDirectory, 'foundation-metrics.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2)}\n`,
    'utf8',
  );
});

test('enforces the V2 typography, semantic colors, fields, focus and environment contract', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1536, height: 1024 });

  for (const route of nonTodayRoutes) {
    await page.goto(route.path);
    await waitForStablePage(page);
    const contract = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.app-shell');
      const content = document.querySelector<HTMLElement>('.content');
      const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
      if (shell === null || content === null || atmosphere === null)
        throw new Error('缺少 Foundation 宿主。');

      const fixture = document.createElement('section');
      fixture.className = 'status-panel';
      fixture.setAttribute('data-foundation-fixture', 'true');
      const field = document.createElement('input');
      field.setAttribute('aria-label', 'Foundation Field');
      const primary = document.createElement('button');
      primary.className = 'button button--primary';
      primary.textContent = 'Primary';
      const ghost = document.createElement('button');
      ghost.className = 'button button--ghost';
      ghost.textContent = 'Ghost';
      const danger = document.createElement('button');
      danger.className = 'button button--danger';
      danger.textContent = 'Danger';
      const focusMarker = document.createElement('span');
      focusMarker.style.color = 'var(--border-focus)';
      const surfaceProbe = document.createElement('span');
      surfaceProbe.style.background = 'var(--surface)';
      const pageProbe = document.createElement('span');
      pageProbe.style.background = 'var(--page-bg)';
      fixture.append(field, primary, ghost, danger, focusMarker, surfaceProbe, pageProbe);
      content.append(fixture);
      field.focus();

      const shellStyle = getComputedStyle(shell);
      const fieldStyle = getComputedStyle(field);
      const fixtureStyle = getComputedStyle(fixture);
      const primaryStyle = getComputedStyle(primary);
      const dangerStyle = getComputedStyle(danger);
      const colorChannels = (value: string): [number, number, number, number] => {
        const channels = value.match(/[\d.]+/gu)?.map(Number) ?? [];
        return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, channels[3] ?? 1];
      };
      const composite = (
        foreground: [number, number, number, number],
        background: [number, number, number, number],
      ): [number, number, number, number] => {
        const alpha = foreground[3];
        return [
          foreground[0] * alpha + background[0] * (1 - alpha),
          foreground[1] * alpha + background[1] * (1 - alpha),
          foreground[2] * alpha + background[2] * (1 - alpha),
          1,
        ];
      };
      const tone = (channels: [number, number, number, number]): number =>
        (channels[0] + channels[1] + channels[2]) / 3;
      const pageChannels = colorChannels(getComputedStyle(pageProbe).backgroundColor);
      const surfaceChannels = composite(
        colorChannels(getComputedStyle(surfaceProbe).backgroundColor),
        pageChannels,
      );
      const fieldChannels = composite(colorChannels(fieldStyle.backgroundColor), surfaceChannels);
      const result = {
        theme: shell.dataset.theme,
        colorScheme: shellStyle.colorScheme,
        pageTitle: shellStyle.getPropertyValue('--font-size-page-title').trim(),
        sectionTitle: shellStyle.getPropertyValue('--font-size-section-title').trim(),
        cardTitle: shellStyle.getPropertyValue('--font-size-card-title').trim(),
        body: shellStyle.getPropertyValue('--font-size-body').trim(),
        success: shellStyle.getPropertyValue('--semantic-success').trim(),
        warning: shellStyle.getPropertyValue('--semantic-warning').trim(),
        danger: shellStyle.getPropertyValue('--semantic-danger').trim(),
        info: shellStyle.getPropertyValue('--semantic-info').trim(),
        fieldBackground: fieldStyle.backgroundColor,
        cardBackground: fixtureStyle.backgroundColor,
        fieldTone: tone(fieldChannels),
        surfaceTone: tone(surfaceChannels),
        fieldHeight: fieldStyle.minHeight,
        fieldRadius: fieldStyle.borderRadius,
        focusOutline: fieldStyle.outlineColor,
        borderFocus: getComputedStyle(focusMarker).color,
        primaryBackground: primaryStyle.backgroundColor,
        dangerColor: dangerStyle.color,
        atmospherePointerEvents: getComputedStyle(atmosphere).pointerEvents,
        atmosphereAnimation: getComputedStyle(atmosphere).animationName,
      };
      fixture.remove();
      return result;
    });

    expect(contract).toMatchObject({
      theme: route.theme,
      colorScheme: route.theme === 'life' ? 'light' : 'dark',
      pageTitle: '32px',
      sectionTitle: '23px',
      cardTitle: '18px',
      body: '14px',
      success: '#6fcf9d',
      warning: '#e4ae61',
      danger: '#e26d70',
      info: '#76b4e5',
      fieldHeight: '40px',
      fieldRadius: '11px',
      atmospherePointerEvents: 'none',
      atmosphereAnimation: 'none',
    });
    expect(contract.fieldBackground).not.toBe(contract.cardBackground);
    // Each space keeps its own elevation direction; the shared contract is a perceptible separation.
    expect(Math.abs(contract.fieldTone - contract.surfaceTone)).toBeGreaterThan(1);
    expect(contract.focusOutline).toBe(contract.borderFocus);
    expect(contract.primaryBackground).not.toBe(contract.fieldBackground);
    expect(contract.dangerColor).not.toBe(contract.primaryBackground);
  }
});

test('keeps quick capture and search on the same accessible System surface in every theme', async ({
  page,
}) => {
  const surfaceBackgrounds = new Set<string>();
  await page.setViewportSize({ width: 1536, height: 1024 });

  for (const route of themeRoutes) {
    await page.goto(route.path);
    await page.keyboard.press('Control+Shift+Space');
    const capture = page.getByRole('dialog', { name: '快速记录' });
    await expect(capture).toBeVisible();
    await expect(capture).toHaveAttribute('data-surface', 'system');
    await expect(page.getByLabel('记录内容')).toBeFocused();
    surfaceBackgrounds.add(
      await capture.evaluate((element) => getComputedStyle(element).background),
    );
    if (route.theme === 'work') {
      await page.screenshot({
        path: resolve(evidenceDirectory, 'quick-capture-work-phase1-1536x1024.png'),
      });
    }
    await page.keyboard.press('Escape');
    await expect(capture).toHaveCount(0);

    await page.keyboard.press('Control+k');
    const search = page.getByRole('dialog', { name: '全局搜索' });
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('data-surface', 'system');
    await expect(page.getByPlaceholder(/搜索任务/)).toBeFocused();
    if (route.theme === 'ai') {
      await page.screenshot({
        path: resolve(evidenceDirectory, 'search-ai-phase1-1536x1024.png'),
      });
    }
    await page.keyboard.press('Escape');
    await expect(search).toHaveCount(0);
  }

  expect(surfaceBackgrounds.size).toBe(1);
});

test('preserves Today composition at the three Phase 1 protection viewports', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [
    { width: 1536, height: 1024 },
    { width: 1654, height: 960 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'today');
    await expect(page.getByLabel('24 小时时间轴')).toBeVisible();
    await expect(page.getByLabel('今日计划')).toBeVisible();
    await waitForStablePage(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: resolve(
        evidenceDirectory,
        `today-protection-phase1-${String(viewport.width)}x${String(viewport.height)}.png`,
      ),
    });
  }
});
