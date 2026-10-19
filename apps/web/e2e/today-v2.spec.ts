import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface TodayFixture {
  readonly date: string;
  readonly serverNow: string;
  readonly pressure: { readonly score: number; readonly level: string };
}

interface FixtureManifestEntry {
  readonly file: string;
  readonly screenshot: string;
  readonly covers: readonly string[];
}

interface FixtureManifest {
  readonly version: number;
  readonly timeZone: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly deviceScaleFactor: number;
  };
  readonly baseline: { readonly fixture: string; readonly screenshot: string };
  readonly fixtures: readonly FixtureManifestEntry[];
}

const fixtureDirectory = resolve('docs/design/today/fixtures');
const manifest = JSON.parse(
  readFileSync(join(fixtureDirectory, 'manifest.json'), 'utf8'),
) as FixtureManifest;

const envelope = (data: unknown) => ({ data, meta: { requestId: 'today-v2-fixture' } });

const freezeClock = async (page: Page, serverNow: string): Promise<void> => {
  await page.addInitScript(`
    {
      const fixedTimestamp = ${JSON.stringify(Date.parse(serverNow))};
      const NativeDate = Date;
      class FixedDate extends NativeDate {
        constructor(...arguments_) {
          super(...(arguments_.length === 0 ? [fixedTimestamp] : arguments_));
        }
        static now() { return fixedTimestamp; }
      }
      Object.setPrototypeOf(FixedDate, NativeDate);
      window.Date = FixedDate;
    }
  `);
};

const mockTodayDependencies = async (
  page: Page,
  fixture: TodayFixture,
  overrides: {
    readonly categories?: readonly unknown[];
    readonly tasks?: readonly unknown[];
    readonly warnings?: readonly unknown[];
    readonly providers?: readonly unknown[];
  } = {},
): Promise<void> => {
  await page.route('**/api/v1/setup/status', (route) =>
    route.fulfill({
      json: envelope({ initialized: true, dataDirectory: null, suggestedDataDirectory: 'fixture' }),
    }),
  );
  await page.route('**/api/v1/settings*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/categories*', (route) =>
    route.fulfill({ json: envelope(overrides.categories ?? []) }),
  );
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/goals*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/plans*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/tags*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/tasks*', (route) =>
    route.fulfill({ json: envelope(overrides.tasks ?? []) }),
  );
  await page.route('**/api/v1/schedules/warnings', (route) =>
    route.fulfill({ json: envelope(overrides.warnings ?? []) }),
  );
  await page.route('**/api/v1/notifications*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/ai/providers*', (route) =>
    route.fulfill({ json: envelope(overrides.providers ?? []) }),
  );
  await page.route('**/api/v1/today*', (route) => route.fulfill({ json: envelope(fixture) }));
};

const requiredCoverage = [
  '低压',
  '正常压力',
  '高压',
  '工作密集',
  '生活密集',
  '睡眠不足',
  '空闲充足',
  '任务为空',
  '任务密集',
  '无天气',
  '进行中状态',
] as const;

test('Phase 0 Fixture manifest locks the required Today states', () => {
  expect(manifest.version).toBe(1);
  expect(manifest.timeZone).toBe('Asia/Shanghai');
  expect(manifest.viewport).toEqual({ width: 1536, height: 1024, deviceScaleFactor: 1 });
  expect(manifest.fixtures.map((fixture) => fixture.file)).toContain(manifest.baseline.fixture);
  const coverage = new Set(manifest.fixtures.flatMap((fixture) => fixture.covers));
  for (const state of requiredCoverage) expect(coverage).toContain(state);
});

for (const entry of manifest.fixtures) {
  test(`Today fixture renders deterministically: ${entry.file}`, async ({ page }, testInfo) => {
    const fixture = JSON.parse(
      readFileSync(join(fixtureDirectory, entry.file), 'utf8'),
    ) as TodayFixture;
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 500) failedResponses.push(response.url());
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await freezeClock(page, fixture.serverNow);
    await mockTodayDependencies(page, fixture);
    await page.setViewportSize({
      width: manifest.viewport.width,
      height: manifest.viewport.height,
    });
    await page.goto('/');

    await expect(page.locator('.today-immersive')).toBeVisible();
    await expect(page.getByLabel('天气暂不可用')).toBeVisible();
    await expect(page.locator('section.today-timeline')).toBeVisible();
    await expect(
      page
        .getByLabel('今日压力与当前状态')
        .getByText(String(fixture.pressure.score), { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(entry.screenshot), fullPage: false });

    const navigationTiming = await page.evaluate(() =>
      JSON.stringify({
        capturedAt: window.performance.now(),
        navigationEntries: window.performance.getEntriesByType('navigation').length,
      }),
    );
    await testInfo.attach('performance-sample.json', {
      body: navigationTiming,
      contentType: 'application/json',
    });
    expect(navigationTiming).toContain('"navigationEntries":1');
    expect(pageErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
}

test('Final architecture composes backdrop, state video and UI overlay without desktop overflow', async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, manifest.baseline.fixture), 'utf8'),
  ) as TodayFixture;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture);
  await page.setViewportSize({ width: manifest.viewport.width, height: manifest.viewport.height });
  await page.goto('/');

  const scene = page.locator('.today-scene');
  await expect(scene).toBeVisible();
  await expect(scene).toHaveAttribute('data-composition', 'v3-desktop-adaptive');
  for (const layer of [
    'scene-backdrop',
    'environment-overlay',
    'environment',
    'fountain',
    'plan-rail',
    'timeline',
    'ai-composer',
  ]) {
    await expect(page.locator(`[data-today-scene-layer="${layer}"]`)).toBeVisible();
  }
  await expect(page.locator('.today-scene-media')).toBeVisible();
  await expect(page.locator('.today-scene-media__video')).toHaveCount(2);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重新安排今日' })).toBeVisible();
  await expect(page.getByRole('button', { name: '添加事项' })).toBeVisible();

  const geometry = await page.evaluate(() => {
    const sceneElement = document.querySelector<HTMLElement>('.today-scene');
    const sceneStyle = sceneElement === null ? undefined : getComputedStyle(sceneElement);
    const sceneRect = sceneElement?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      scene:
        sceneRect === undefined
          ? undefined
          : {
              top: sceneRect.top,
              right: sceneRect.right,
              bottom: sceneRect.bottom,
              left: sceneRect.left,
              width: sceneRect.width,
              height: sceneRect.height,
            },
      position: sceneStyle?.position,
    };
  });

  expect(geometry.position).toBe('relative');
  expect(geometry.document.width).toBeLessThanOrEqual(geometry.viewport.width);
  expect(geometry.document.height).toBeLessThanOrEqual(geometry.viewport.height);
  expect((geometry.scene?.bottom ?? Infinity) <= geometry.viewport.height).toBe(true);
});

test('Final architecture separates the environment backdrop from state video and UI overlay', async ({
  page,
}, testInfo) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, manifest.baseline.fixture), 'utf8'),
  ) as TodayFixture;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture);
  await page.setViewportSize({ width: manifest.viewport.width, height: manifest.viewport.height });
  await page.goto('/');

  const backdrop = page.locator('[data-today-scene-layer="scene-backdrop"]');
  const media = page.locator('.today-scene-media');
  await expect(backdrop).toBeVisible();
  await expect(backdrop).toHaveJSProperty('naturalWidth', 1536);
  await expect(backdrop).toHaveJSProperty('naturalHeight', 1024);
  await expect(media).toHaveAttribute('data-scene-state', 'balanced');
  await expect(media).toHaveAttribute('data-media-ready', 'true', { timeout: 8_000 });
  await expect(media.locator('.today-scene-media__master')).toBeVisible();
  await expect(media.locator('.today-scene-media__video')).toHaveCount(2);
  await expect(page.locator('[data-today-scene-layer="environment-overlay"]')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('final-backdrop-video-overlay.png'),
    fullPage: false,
  });
});

test('Final architecture maps pressure states while reduced motion keeps the master frame static', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const baseFixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  const states = [
    ['relaxed', 12, 'RELAXED'],
    ['comfortable', 37, 'COMFORTABLE'],
    ['elevated', 62, 'ELEVATED'],
    ['high', 87, 'HIGH_PRESSURE'],
  ] as const;
  for (const [name, score, level] of states) {
    const fixture = { ...baseFixture, pressure: { ...baseFixture.pressure, score, level } };
    await page.unrouteAll({ behavior: 'wait' });
    await mockTodayDependencies(page, fixture);
    await page.setViewportSize({
      width: manifest.viewport.width,
      height: manifest.viewport.height,
    });
    await page.goto('/');
    const media = page.locator('.today-scene-media');
    const expectedState =
      score <= 24 ? 'calm' : score <= 49 ? 'balanced' : score <= 74 ? 'busy' : 'intense';
    await expect(media).toHaveAttribute('data-scene-state', expectedState);
    await expect(media).toHaveAttribute('data-reduced-motion', 'true');
    await expect(media).toHaveAttribute('data-media-ready', 'false');
    await expect(media.locator('.today-scene-media__master')).toBeVisible();
    await expect(media.locator('.today-scene-media__video[data-visible="true"]')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`phase3-${name}-reduced-motion.png`) });
  }
});

test('Phase 4 composes the state axis, status floats, and a continuous 24h timeline', async ({
  page,
}, testInfo) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture);
  await page.setViewportSize({ width: manifest.viewport.width, height: manifest.viewport.height });
  await page.goto('/');

  await expect(page.locator('.today-state-axis')).toBeVisible();
  await expect(page.locator('.today-status-floats__item')).toHaveCount(4);
  await expect(page.locator('.today-status-floats__item[data-active="true"]')).toHaveCount(1);
  await expect(page.locator('.fountain-scene__pressure')).toHaveCount(0);
  await expect(page.locator('.today-chips')).toHaveCount(0);
  await expect(page.locator('.today-timeline__ticks span')).toHaveCount(5);
  expect(await page.locator('.today-timeline__nodes span').count()).toBeGreaterThan(0);
  await expect(page.locator('.today-timeline__cursor')).toHaveCount(1);

  const coverage = await page.locator('.today-timeline__band-segment').evaluateAll((elements) =>
    elements.map((element) => {
      const htmlElement = element as HTMLElement;
      const left = Number.parseFloat(htmlElement.style.left);
      const width = Number.parseFloat(htmlElement.style.width);
      return { left, right: left + width };
    }),
  );
  expect(coverage[0]?.left).toBeCloseTo(0, 2);
  expect(coverage.at(-1)?.right).toBeCloseTo(100, 2);
  for (let index = 1; index < coverage.length; index += 1) {
    expect(coverage[index]?.left).toBeCloseTo(coverage[index - 1]?.right ?? -1, 2);
  }

  await page.screenshot({ path: testInfo.outputPath('phase4-state-axis.png'), fullPage: false });
  const sceneBefore = await page.locator('.today-scene__stage').boundingBox();
  const timelineBefore = await page.locator('.today-timeline').boundingBox();
  await page.getByRole('button', { name: '查看 1 项因素' }).click();
  await expect(page.locator('.today-state-axis__popover')).toBeVisible();
  expect(await page.locator('.today-scene__stage').boundingBox()).toEqual(sceneBefore);
  expect(await page.locator('.today-timeline').boundingBox()).toEqual(timelineBefore);
  await page.screenshot({
    path: testInfo.outputPath('phase4-factors-overlay.png'),
    fullPage: false,
  });

  await page.getByRole('button', { name: '收起因素' }).click();
  await page.setViewportSize({ width: 720, height: 1_000 });
  await expect(page.locator('.today-state-axis')).toBeVisible();
  await expect(page.locator('.today-status-floats__item')).toHaveCount(4);
  const mobileOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('phase4-narrow.png'), fullPage: false });
});

test('Phase 5 keeps the Plan Rail hierarchical and opens Add as a geometry-stable overlay', async ({
  page,
}, testInfo) => {
  const baseFixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture & { readonly plan: readonly Record<string, unknown>[] };
  const fixture = {
    ...baseFixture,
    serverNow: '2026-08-15T04:00:00.000Z',
    plan: Array.from({ length: 12 }, (_, index) => {
      const source = baseFixture.plan[index % baseFixture.plan.length];
      return {
        ...source,
        id: `${String(source?.id)}-${String(index)}`,
        entityId: index === 1 ? 'task-focus' : null,
        title: index === 1 ? '开发今日页' : `${String(source?.title)} ${String(index + 1)}`,
      };
    }),
  };
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    categories: [{ id: 'category-work', name: '工作', parentArea: 'WORK' }],
    tasks: [
      {
        id: 'task-focus',
        version: 2,
        title: '开发今日页',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        isFlexible: true,
        preferredArea: 'WORK',
        estimatedMinutes: 180,
        dueAt: '2026-08-15T08:00:00.000Z',
      },
      {
        id: 'task-flex',
        version: 1,
        title: '整理重构笔记',
        status: 'TODO',
        priority: 'NORMAL',
        isFlexible: true,
        preferredArea: 'LIFE',
        estimatedMinutes: 45,
        dueAt: '2026-08-15T10:00:00.000Z',
      },
    ],
    warnings: [
      {
        id: 'warning-focus',
        entityId: 'task-focus',
        warningType: 'DEADLINE_RISK',
        severity: 'WARNING',
        message: '当前任务距离截止时间较近。',
      },
    ],
  });
  await page.setViewportSize({ width: manifest.viewport.width, height: manifest.viewport.height });
  await page.goto('/');

  const rail = page.locator('.today-plan');
  const stage = page.locator('.today-scene__stage');
  await expect(rail).toBeVisible();
  const currentItems = rail.locator('[data-state="CURRENT"]');
  expect(await currentItems.count()).toBeGreaterThan(0);
  expect((await currentItems.allTextContents()).every((text) => text.includes('进行中'))).toBe(
    true,
  );
  await expect(rail.getByText('当前任务距离截止时间较近。')).toBeVisible();
  await expect(rail.getByText('整理重构笔记')).toBeVisible();
  await rail.getByRole('button', { name: '查看全部' }).click();
  const primaryList = rail.locator('.today-plan__list--primary');
  const scrollGeometry = await primaryList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollGeometry.scrollHeight).toBeGreaterThan(scrollGeometry.clientHeight);

  const stageBefore = await stage.boundingBox();
  const railBefore = await rail.boundingBox();
  const addTrigger = page.getByRole('button', { name: '添加事项' });
  await addTrigger.click();
  await expect(page.getByRole('dialog', { name: '添加事项' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '事项标题' })).toBeFocused();
  expect(await stage.boundingBox()).toEqual(stageBefore);
  expect(await rail.boundingBox()).toEqual(railBefore);
  await page.screenshot({
    path: testInfo.outputPath('phase5-plan-rail-overlay.png'),
    fullPage: false,
  });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '添加事项' })).toHaveCount(0);
  await expect(addTrigger).toBeFocused();
  const viewportGeometry = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  expect(viewportGeometry.documentHeight).toBeLessThanOrEqual(viewportGeometry.viewportHeight);
  expect(viewportGeometry.documentWidth).toBeLessThanOrEqual(viewportGeometry.viewportWidth);
});

const readyProvider = (id: string, isDefault: boolean) => ({
  id,
  providerType: 'OPENAI',
  displayName: id,
  baseUrl: null,
  modelId: 'gpt-test',
  hasCredential: true,
  capabilities: { chat: true, streaming: true, toolCalling: true, nativeWebSearch: false },
  isDefault,
  lastVerifiedAt: '2026-08-20T08:00:00.000Z',
  lastError: null,
  version: 1,
});

test('Phase 6 sends Today context with the explicit default and opens the exact run', async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  const session = {
    id: 'session-today',
    title: `今日 · ${fixture.date}`,
    providerConfigId: 'provider-default',
    status: 'ACTIVE',
    lastMessageAt: fixture.serverNow,
    version: 1,
    createdAt: fixture.serverNow,
    updatedAt: fixture.serverNow,
  };
  let created: Record<string, unknown> | undefined;
  let sent: Record<string, unknown> | undefined;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    providers: [readyProvider('provider-first', false), readyProvider('provider-default', true)],
  });
  await page.route('**/api/v1/ai/chats', async (route) => {
    if (route.request().method() === 'POST') {
      created = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, json: envelope(session) });
      return;
    }
    await route.fulfill({ json: envelope([session]) });
  });
  await page.route('**/api/v1/ai/chats/session-today/messages', async (route) => {
    if (route.request().method() === 'POST') {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 202,
        json: envelope({
          userMessageId: 'user-message',
          assistantMessageId: 'assistant-message',
          runId: 'run-today',
          status: 'QUEUED',
        }),
      });
      return;
    }
    await route.fulfill({ json: envelope([]) });
  });
  await page.route('**/api/v1/ai/runs/run-today/events', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: ai.run.completed\ndata: {}\n\n',
    }),
  );

  await page.goto('/');
  await page.getByLabel('AI 助手输入').fill('帮我安排接下来的时间');
  await page.getByRole('button', { name: 'AI 助手', exact: true }).click();
  await expect(page).toHaveURL(/\/assistant\?sessionId=session-today&runId=run-today/);

  expect(created).toMatchObject({ providerConfigId: 'provider-default' });
  expect(sent).toMatchObject({
    content: '帮我安排接下来的时间',
    context: { source: 'TODAY', date: fixture.date, timeZone: 'Asia/Shanghai' },
  });
  const serialized = JSON.stringify(sent);
  expect(serialized).not.toContain('provider-default');
  expect(serialized).not.toContain('api_key');
  expect(serialized).not.toContain('C:\\');
});

test('Phase 6 preserves input and reuses the session when sending is retried', async ({ page }) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  const session = {
    id: 'session-retry',
    title: `今日 · ${fixture.date}`,
    providerConfigId: 'provider-default',
    status: 'ACTIVE',
    lastMessageAt: fixture.serverNow,
    version: 1,
    createdAt: fixture.serverNow,
    updatedAt: fixture.serverNow,
  };
  let createCount = 0;
  let sendCount = 0;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    providers: [readyProvider('provider-default', true)],
  });
  await page.route('**/api/v1/ai/chats', async (route) => {
    if (route.request().method() === 'POST') createCount += 1;
    await route.fulfill({
      status: route.request().method() === 'POST' ? 201 : 200,
      json: envelope(route.request().method() === 'POST' ? session : [session]),
    });
  });
  await page.route('**/api/v1/ai/chats/session-retry/messages', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ json: envelope([]) });
      return;
    }
    sendCount += 1;
    if (sendCount === 1) {
      await route.fulfill({ status: 500, json: { error: { code: 'TEST_FAILURE' } } });
      return;
    }
    await route.fulfill({
      status: 202,
      json: envelope({
        userMessageId: 'user-message',
        assistantMessageId: 'assistant-message',
        runId: 'run-retry',
        status: 'QUEUED',
      }),
    });
  });
  await page.route('**/api/v1/ai/runs/run-retry/events', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: '' }),
  );

  await page.goto('/');
  const input = page.getByLabel('AI 助手输入');
  await input.fill('请保留这段内容');
  await page.getByRole('button', { name: 'AI 助手', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('内容已保留');
  await expect(input).toHaveValue('请保留这段内容');
  await page.getByRole('button', { name: 'AI 助手', exact: true }).click();
  await expect(page).toHaveURL(/\/assistant\?sessionId=session-retry&runId=run-retry/);
  expect(createCount).toBe(1);
  expect(sendCount).toBe(2);
});

test('Phase 6 blocks sending when no explicit default provider exists', async ({ page }) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    providers: [readyProvider('provider-only', false)],
  });
  await page.setViewportSize({ width: 1_536, height: 1_024 });
  await page.goto('/');

  await page.getByLabel('AI 助手输入').fill('这条消息不能发送');
  await expect(page.getByRole('button', { name: 'AI 助手', exact: true })).toBeDisabled();
  const providerHint = page.getByText('请先在设置中选择默认 AI 服务');
  await expect(providerHint).toBeVisible();
  const hintBox = await providerHint.boundingBox();
  expect(hintBox).not.toBeNull();
  expect((hintBox?.y ?? Infinity) + (hintBox?.height ?? Infinity)).toBeLessThanOrEqual(1_016);
});

test('Final desktop architecture retains the scene hierarchy across supported widths', async ({
  page,
}, testInfo) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    categories: [{ id: 'category-work', name: '工作', parentArea: 'WORK' }],
  });

  await page.setViewportSize({ width: 1_366, height: 768 });
  await page.goto('/');
  await expect(page.locator('.today-scene')).toHaveAttribute(
    'data-composition',
    'v3-desktop-adaptive',
  );
  await expect(page.locator('.today-scene__plan')).toBeVisible();
  await expect(page.locator('.today-scene-media')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  const desktopGeometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  expect(desktopGeometry.scrollWidth).toBeLessThanOrEqual(desktopGeometry.viewportWidth);
  await expect(page.getByLabel('今日压力与当前状态')).toBeVisible();
  await expect(page.locator('section.today-timeline')).toBeVisible();
  await expect(page.getByLabel('AI 助手输入')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('final-desktop-1366x768.png'),
    fullPage: false,
  });
});

test('Phase 7 preserves keyboard focus and reduced-motion static rendering', async ({ page }) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    categories: [{ id: 'category-work', name: '工作', parentArea: 'WORK' }],
  });
  await page.goto('/');

  const timelineSegment = page.getByRole('button', { name: /团队例会|开发今日页/ }).first();
  await timelineSegment.focus();
  await expect(timelineSegment).toBeFocused();
  await expect(timelineSegment).toHaveCSS('outline-style', 'solid');

  const factors = page.getByRole('button', { name: /查看 \d+ 项因素/ });
  await factors.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.today-state-axis__popover')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.today-state-axis__popover')).toHaveCount(0);
  await expect(factors).toBeFocused();

  const addTrigger = page.getByRole('button', { name: '添加事项' });
  await addTrigger.click();
  const dialog = page.getByRole('dialog', { name: '添加事项' });
  await expect(dialog.getByRole('textbox', { name: '事项标题' })).toBeFocused();
  await dialog.locator('.today-add__submit').focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭添加事项' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(addTrigger).toBeFocused();

  const media = page.locator('.today-scene-media');
  await expect(media).toHaveAttribute('data-reduced-motion', 'true');
  await expect(media).toHaveAttribute('data-media-ready', 'false');
  await expect(media.locator('.today-scene-media__master')).toBeVisible();
  await expect(media.locator('.today-scene-media__video[data-visible="true"]')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('Final state video pauses while hidden and resumes without a Canvas renderer', async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 });
  });
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture);
  await page.goto('/');

  const media = page.locator('.today-scene-media');
  const videos = media.locator('.today-scene-media__video');
  await expect(media).toHaveAttribute('data-media-ready', 'true', { timeout: 8_000 });
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect
    .poll(() =>
      videos.evaluateAll(
        (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
      ),
    )
    .toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() =>
      videos.evaluateAll(
        (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
      ),
    )
    .toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() =>
      videos.evaluateAll(
        (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
      ),
    )
    .toBe(1);
});

test('Phase 8 keeps long content and the 200% zoom-equivalent viewport operable', async ({
  page,
}, testInfo) => {
  const baseFixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture & {
    readonly plan: readonly Record<string, unknown>[];
    readonly pressure: Record<string, unknown> & {
      readonly factors: readonly Record<string, unknown>[];
    };
  };
  const longTitle = '这是一项用于验证二百倍缩放与超长标题不会破坏今日场景关键操作的高优先级任务';
  const fixture = {
    ...baseFixture,
    pressure: {
      ...baseFixture.pressure,
      factors: [
        {
          code: 'LONG_FACTOR',
          points: 18,
          message:
            '连续会议、紧迫截止时间与不足的空闲窗口共同造成了较高压力，需要保留完整解释且不能推动主场景。',
        },
      ],
    },
    plan: Array.from({ length: 18 }, (_, index) => ({
      ...baseFixture.plan[index % baseFixture.plan.length],
      id: `long-plan-${String(index)}`,
      entityId: null,
      title: `${longTitle} ${String(index + 1)}`,
    })),
  };
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    categories: [{ id: 'category-work', name: '工作', parentArea: 'WORK' }],
  });
  await page.setViewportSize({ width: 768, height: 512 });
  await page.goto('/');

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  await page.getByRole('button', { name: '查看 1 项因素' }).click();
  await expect(page.locator('.today-state-axis__popover')).toContainText('连续会议');
  await page.keyboard.press('Escape');
  const addTrigger = page.getByRole('button', { name: '添加事项' });
  await addTrigger.scrollIntoViewIfNeeded();
  await addTrigger.click();
  await expect(page.getByRole('dialog', { name: '添加事项' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('phase8-zoom-200-long-content.png'),
    fullPage: false,
  });
});

test('Final architecture updates Today after completion without remounting scene media', async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '6-in-progress.json'), 'utf8'),
  ) as TodayFixture & {
    readonly plan: readonly Record<string, unknown>[];
    readonly blocks: readonly Record<string, unknown>[];
  };
  let completed = false;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture, {
    tasks: [
      {
        id: 'task-focus',
        version: 1,
        title: '开发今日页',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        isFlexible: true,
        preferredArea: 'WORK',
        estimatedMinutes: 180,
        dueAt: '2026-08-15T08:00:00.000Z',
      },
    ],
  });
  await page.route('**/api/v1/today*', (route) =>
    route.fulfill({
      json: envelope(
        completed
          ? {
              ...fixture,
              timelineVersion: 2,
              pressure: { ...fixture.pressure, score: 12, level: 'RELAXED' },
              plan: fixture.plan.filter((item) => item.entityId !== 'task-focus'),
              blocks: fixture.blocks.filter((item) => item.targetEntityId !== 'task-focus'),
            }
          : fixture,
      ),
    }),
  );
  await page.route('**/api/v1/tasks/task-focus/complete', async (route) => {
    completed = true;
    await route.fulfill({
      json: envelope({
        id: 'task-focus',
        version: 2,
        title: '开发今日页',
        status: 'COMPLETED',
      }),
    });
  });
  await page.goto('/');

  const media = page.locator('.today-scene-media');
  await media.evaluate((element) => {
    (element as HTMLElement).dataset.phase8Identity = 'stable';
  });
  await page.getByRole('button', { name: '完成任务：开发今日页' }).click();
  await expect(
    page.getByLabel('今日压力与当前状态').getByText('12', { exact: true }),
  ).toBeVisible();
  await expect(media).toHaveAttribute('data-phase8-identity', 'stable');
});

test('Phase 0 interaction baseline opens a non-task schedule detail', async ({ page }) => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDirectory, '1-workday-relaxed.json'), 'utf8'),
  ) as TodayFixture;
  await freezeClock(page, fixture.serverNow);
  await mockTodayDependencies(page, fixture);
  await page.goto('/');

  const timelineSegment = page.getByRole('button', { name: /团队例会/ }).last();
  await timelineSegment.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '时间块详情' })).toContainText('团队例会');
});
