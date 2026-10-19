import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';
import { completeSetup } from './helpers/complete-setup.js';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/cross-theme');
const dataDirectory = resolve('test-results/v2-cross-theme/data');

const themeRoutes = [
  { id: 'today', path: '/', heading: '今日', exact: true, theme: 'today', nav: '今日' },
  { id: 'work', path: '/work', heading: '工作总览', exact: false, theme: 'work', nav: '工作' },
  { id: 'life', path: '/life', heading: '生活总览', exact: false, theme: 'life', nav: '生活' },
  {
    id: 'vision',
    path: '/plans-goals',
    heading: '计划与目标',
    exact: false,
    theme: 'vision',
    nav: '计划与目标',
  },
  {
    id: 'assistant',
    path: '/assistant',
    heading: 'AI 助手',
    exact: false,
    theme: 'ai',
    nav: 'AI 助手',
  },
  { id: 'system', path: '/inbox', heading: '收集箱', exact: false, theme: 'system', nav: '收集箱' },
] as const;

const nonTodayRoutes = themeRoutes.filter((route) => route.theme !== 'today');

const waitForStablePage = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.waitForTimeout(220);
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('initializes isolated demo data for Phase 7 verification', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await completeSetup(page, dataDirectory);
});

test('keeps the navigation family structure and Lucide language while preserving theme materials', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const metrics: Record<string, unknown>[] = [];
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
    await waitForStablePage(page);
    const result = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.app-shell');
      const sidebar = document.querySelector<HTMLElement>('.sidebar');
      const capture = document.querySelector<HTMLElement>('.sidebar__capture');
      const search = document.querySelector<HTMLElement>('.sidebar__search');
      const links = [...document.querySelectorAll<HTMLElement>('.sidebar__link')];
      const firstLink = links[0];
      const selected = document.querySelector<HTMLElement>('.sidebar__link[data-selected="true"]');
      const firstUnselected = links.find((link) => link.dataset.selected !== 'true');
      const icon = document.querySelector<SVGElement>('.sidebar__link .lucide');
      if (
        shell === null ||
        sidebar === null ||
        capture === null ||
        search === null ||
        firstLink === undefined ||
        selected === null ||
        firstUnselected === undefined ||
        icon === null
      ) {
        throw new Error('缺少跨主题导航审计节点。');
      }
      const sidebarStyle = getComputedStyle(sidebar);
      const selectedStyle = getComputedStyle(selected);
      const unselectedStyle = getComputedStyle(firstUnselected);
      return {
        theme: shell.dataset.theme,
        navigationLabels: links.map((link) => link.textContent.trim()),
        linkFontSize: getComputedStyle(firstLink).fontSize,
        linkHeight: firstLink.getBoundingClientRect().height,
        linkRadius: getComputedStyle(firstLink).borderRadius,
        linkGap: getComputedStyle(firstLink).gap,
        linkIconWidth: icon.getAttribute('width'),
        linkIconStroke: icon.getAttribute('stroke-width'),
        captureHeight: capture.getBoundingClientRect().height,
        captureRadius: getComputedStyle(capture).borderRadius,
        searchHeight: search.getBoundingClientRect().height,
        searchRadius: getComputedStyle(search).borderRadius,
        captureBeforeSearch:
          capture.compareDocumentPosition(search) === Node.DOCUMENT_POSITION_FOLLOWING,
        selectedDistinct:
          selectedStyle.backgroundColor !== unselectedStyle.backgroundColor ||
          selectedStyle.boxShadow !== unselectedStyle.boxShadow,
        selectedAccent: selectedStyle.boxShadow,
        sidebarBackground: sidebarStyle.background,
        sidebarWidth: sidebar.getBoundingClientRect().width,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(result).toMatchObject({
      theme: route.theme,
      navigationLabels: [
        '今日',
        '工作',
        '生活',
        '计划与目标',
        'AI 助手',
        '收集箱',
        '数据管理',
        '提醒中心',
        '设置',
      ],
      linkFontSize: '14px',
      linkHeight: 39,
      linkRadius: '11px',
      linkGap: '10px',
      linkIconWidth: '15',
      linkIconStroke: '2',
      captureHeight: 40,
      captureRadius: '11px',
      searchHeight: 40,
      searchRadius: '11px',
      captureBeforeSearch: true,
      selectedDistinct: true,
      horizontalOverflow: 0,
    });
    metrics.push(result);
    await page.screenshot({
      path: resolve(evidenceDirectory, `${route.id}-1536x1024.png`),
      fullPage: true,
    });
  }

  expect(new Set(metrics.map((item) => item.sidebarBackground)).size).toBe(1);
  expect(new Set(metrics.map((item) => item.selectedAccent)).size).toBe(themeRoutes.length);
  expect(consoleErrors).toEqual([]);
  await writeFile(
    resolve(evidenceDirectory, 'cross-theme-metrics.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), metrics }, null, 2)}\n`,
    'utf8',
  );
});

test('keeps the Today header centered and grouped at common desktop widths', async ({ page }) => {
  for (const width of [1366, 1440, 1536, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1024 });
    await page.goto('/');
    await waitForStablePage(page);

    const header = page.locator('.today-env');
    const date = page.locator('.today-env__date');
    await expect(date).toContainText(/\d+月\d+日 星期. · 农历.+/);
    await expect(header).not.toContainText('丙午年');

    const geometry = await page.evaluate(() => {
      const readRect = (selector: string) => {
        const node = document.querySelector<HTMLElement>(selector);
        if (node === null) throw new Error(`缺少 Today Header 节点：${selector}`);
        return node.getBoundingClientRect();
      };
      const environment = readRect('.today-env');
      const center = readRect('.today-env__sentence');
      const right = readRect('.today-env__right');
      return {
        centerDelta: Math.abs(
          center.left + center.width / 2 - (environment.left + environment.width / 2),
        ),
        rightDelta: Math.abs(environment.right - right.right),
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(geometry.centerDelta).toBeLessThanOrEqual(1);
    expect(geometry.rightDelta).toBeLessThanOrEqual(2);
    expect(geometry.horizontalOverflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: resolve(
        evidenceDirectory,
        `today-header-${String(width)}x${String(width === 1366 ? 768 : 1024)}.png`,
      ),
      fullPage: true,
    });
  }
});

test('keeps product-facing fields and enum labels localized across primary routes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  const routes = [
    '/',
    '/work',
    '/work/self-media',
    '/work/development',
    '/work/learning',
    '/life',
    '/life/shopping',
    '/life/diet',
    '/life/fitness',
    '/life/entertainment',
    '/plans-goals',
    '/assistant',
    '/inbox',
    '/data',
    '/reminders',
    '/settings',
  ] as const;

  for (const route of routes) {
    await page.goto(route);
    await waitForStablePage(page);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(
      /\bNORMAL\b|Choose File|No file chosen|mm\/dd\/yyyy|\d{2}\/\d{2}\/\d{4}/,
    );
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(page.locator('input[type="file"]:visible')).toHaveCount(0);
  }
});

test('keeps typography and shared control geometry identical across non-Today themes', async ({
  page,
}) => {
  const contracts: Record<string, string>[] = [];
  await page.setViewportSize({ width: 1536, height: 1024 });

  for (const route of nonTodayRoutes) {
    await page.goto(route.path);
    await waitForStablePage(page);
    contracts.push(
      await page.evaluate(() => {
        const content = document.querySelector<HTMLElement>('.content');
        if (content === null) throw new Error('缺少内容区域。');
        const fixture = document.createElement('section');
        fixture.innerHTML = `
          <header class="page__header"><h1>Page title</h1><p>Body copy</p></header>
          <h2>Section title</h2><h3>Card title</h3>
          <button class="button button--primary">Primary</button>
          <input aria-label="Phase 7 field" />
          <div class="segmented-control"><button data-selected="true">Tab</button></div>
          <span class="badge">Badge</span>`;
        content.append(fixture);
        const read = (selector: string) => {
          const element = fixture.querySelector(selector);
          if (element === null) throw new Error(`缺少 Phase 7 Fixture 节点：${selector}`);
          return getComputedStyle(element);
        };
        const h1 = read('h1');
        const h2 = read('h2');
        const h3 = read('h3');
        const body = read('header p');
        const button = read('.button');
        const field = read('input');
        const tab = read('.segmented-control button');
        const badge = read('.badge');
        const result = {
          h1: `${h1.fontSize}/${h1.fontWeight}`,
          h2: `${h2.fontSize}/${h2.fontWeight}`,
          h3: `${h3.fontSize}/${h3.fontWeight}`,
          body: `${body.fontSize}/${body.fontWeight}`,
          button: `${button.minHeight}/${button.borderRadius}`,
          field: `${field.minHeight}/${field.borderRadius}`,
          tabRadius: tab.borderRadius,
          badgeHeight: badge.minHeight,
        };
        fixture.remove();
        return result;
      }),
    );
  }

  expect(new Set(contracts.map((contract) => JSON.stringify(contract))).size).toBe(1);
  expect(contracts[0]).toEqual({
    h1: '32px/600',
    h2: '23px/600',
    h3: '18px/600',
    body: '14px/400',
    button: '40px/11px',
    field: '40px/11px',
    tabRadius: '11px',
    badgeHeight: '24px',
  });
});

test('keeps global dialogs structurally identical and uses Lucide search in every theme', async ({
  page,
}) => {
  const geometries = new Set<string>();
  await page.setViewportSize({ width: 1536, height: 1024 });

  for (const route of themeRoutes) {
    await page.goto(route.path);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: '全局搜索' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.search-dialog__input .lucide-search')).toHaveCount(1);
    geometries.add(
      await dialog.evaluate((element) => {
        const style = getComputedStyle(element);
        return JSON.stringify({
          width: element.getBoundingClientRect().width,
          radius: style.borderRadius,
          padding: style.padding,
          background: style.background,
        });
      }),
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }

  expect(geometries.size).toBe(1);
});

test('changes themes through persistent navigation without focus loss, flash color or overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/work');
  await waitForStablePage(page);

  for (const route of [
    themeRoutes[2],
    themeRoutes[3],
    themeRoutes[4],
    themeRoutes[5],
    themeRoutes[0],
  ]) {
    const link = page.getByRole('link', { name: route.nav, exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', route.theme);
    await expect(link).toBeFocused();
    const transitionState = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.app-shell');
      const content = document.querySelector<HTMLElement>('.content');
      if (shell === null || content === null) throw new Error('缺少主题过渡宿主。');
      const contentStyle = getComputedStyle(content);
      return {
        transitionProperties: contentStyle.transitionProperty,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(
      transitionState.transitionProperties === 'all' ||
        transitionState.transitionProperties.includes('background-color'),
    ).toBe(true);
    expect(transitionState.horizontalOverflow).toBeLessThanOrEqual(0);
  }
});

test('keeps primary, secondary and meta text readable after capture compression', async ({
  page,
}) => {
  const metrics: Record<string, unknown>[] = [];
  await page.setViewportSize({ width: 1536, height: 1024 });

  for (const route of nonTodayRoutes) {
    await page.goto(route.path);
    const result = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.app-shell');
      if (shell === null) throw new Error('缺少 Theme Token 宿主。');
      const fixture = document.createElement('div');
      fixture.style.background = 'var(--page-bg)';
      fixture.innerHTML = `
        <span data-tone="primary" style="color:var(--text-primary)">主要文字</span>
        <span data-tone="secondary" style="color:var(--text-secondary)">次要文字</span>
        <span data-tone="muted" style="color:var(--text-muted)">辅助文字</span>
        <input aria-label="对比度字段" placeholder="字段提示" />`;
      shell.append(fixture);
      const parse = (value: string): [number, number, number] => {
        const channels = value
          .match(/[\d.]+/gu)
          ?.slice(0, 3)
          .map(Number);
        if (channels === undefined || channels.length < 3)
          throw new Error(`无法解析颜色：${value}`);
        return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
      };
      const luminance = (color: [number, number, number]) => {
        const [red, green, blue] = color.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
      };
      const contrast = (foreground: string, background: string) => {
        const foregroundLuminance = luminance(parse(foreground));
        const backgroundLuminance = luminance(parse(background));
        return (
          (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
        );
      };
      const background = getComputedStyle(fixture).backgroundColor;
      const ratio = (tone: string) => {
        const node = fixture.querySelector<HTMLElement>(`[data-tone="${tone}"]`);
        if (node === null) throw new Error(`缺少 ${tone} 文本节点。`);
        return contrast(getComputedStyle(node).color, background);
      };
      const field = fixture.querySelector<HTMLInputElement>('input');
      if (field === null) throw new Error('缺少字段节点。');
      const output = {
        theme: shell.dataset.theme,
        primary: ratio('primary'),
        secondary: ratio('secondary'),
        muted: ratio('muted'),
        fieldBorder: getComputedStyle(field).borderColor,
        placeholder: getComputedStyle(field, '::placeholder').color,
      };
      fixture.remove();
      return output;
    });
    expect(result.primary).toBeGreaterThan(result.secondary);
    expect(result.secondary).toBeGreaterThan(result.muted);
    expect(result.muted).toBeGreaterThanOrEqual(4.5);
    metrics.push(result);
  }

  await page.goto('/');
  const todayPlaceholder = await page
    .locator('.today-ai__input')
    .evaluate((element) => getComputedStyle(element, '::placeholder').color);
  expect(todayPlaceholder).toContain('0.8');
  await writeFile(
    resolve(evidenceDirectory, 'contrast-metrics.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), metrics, todayPlaceholder }, null, 2)}\n`,
    'utf8',
  );
});

test('records grayscale evidence without erasing Work and Life material differences', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1536, height: 1024 });

  for (const route of [themeRoutes[1], themeRoutes[2]]) {
    await page.goto(route.path);
    await waitForStablePage(page);
    await page.locator('.app-shell').evaluate((element) => {
      (element as HTMLElement).style.filter = 'grayscale(1)';
    });
    await page.screenshot({
      path: resolve(evidenceDirectory, `${route.id}-grayscale-1536x1024.png`),
      fullPage: true,
    });
  }
});
