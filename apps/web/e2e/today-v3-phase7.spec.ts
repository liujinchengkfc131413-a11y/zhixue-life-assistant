import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fixture = JSON.parse(
  readFileSync(resolve('docs/design/today/fixtures/6-in-progress.json'), 'utf8'),
) as {
  readonly serverNow: string;
  readonly pressure: { readonly score: number; readonly level: string };
  readonly plan: readonly Record<string, unknown>[];
  readonly blocks: readonly Record<string, unknown>[];
};

const envelope = (data: unknown) => ({ data, meta: { requestId: 'today-v3-phase7' } });

const freezeClock = async (page: Page): Promise<void> => {
  await page.addInitScript(`
    {
      const fixedTimestamp = ${JSON.stringify(Date.parse(fixture.serverNow))};
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

const mockPeripheralCollections = async (page: Page): Promise<void> => {
  for (const resource of ['events', 'goals', 'plans', 'tags']) {
    await page.route(`**/api/v1/${resource}*`, (route) => route.fulfill({ json: envelope([]) }));
  }
};

test('V3 Phase 7 reconnects the complete Today business flow without remounting the fountain', async ({
  page,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      runtimeErrors.push(`${String(response.status())} ${response.url()}`);
  });
  let taskCompleted = false;
  let taskTitle = '开发今日页';
  let taskVersion = 1;
  let rescheduleCount = 0;
  let updateBody: Record<string, unknown> | undefined;
  const tasks = () =>
    taskCompleted
      ? []
      : [
          {
            id: 'task-focus',
            version: taskVersion,
            title: taskTitle,
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            isFlexible: true,
            preferredArea: 'WORK',
            estimatedMinutes: 180,
            dueAt: '2026-08-15T08:00:00.000Z',
          },
          {
            id: 'task-gym',
            version: 1,
            title: '健身',
            status: 'TODO',
            priority: 'NORMAL',
            isFlexible: false,
            preferredArea: 'LIFE',
            estimatedMinutes: 90,
            dueAt: '2026-08-15T12:00:00.000Z',
          },
        ];

  await freezeClock(page);
  await mockPeripheralCollections(page);
  await page.route('**/api/v1/setup/status', (route) =>
    route.fulfill({ json: envelope({ initialized: true, dataDirectory: null }) }),
  );
  await page.route('**/api/v1/settings*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/categories*', (route) =>
    route.fulfill({
      json: envelope([{ id: 'category-work', name: '工作', parentArea: 'WORK' }]),
    }),
  );
  await page.route('**/api/v1/tasks*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: envelope(tasks()) });
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/v1/schedules/warnings', (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route('**/api/v1/notifications*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/ai/providers*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/today*', (route) =>
    route.fulfill({
      json: envelope(
        taskCompleted
          ? {
              ...fixture,
              timelineVersion: 2 + rescheduleCount,
              pressure: { ...fixture.pressure, score: 12, level: 'RELAXED' },
              plan: fixture.plan.filter((item) => item.entityId !== 'task-focus'),
              blocks: fixture.blocks.filter((item) => item.targetEntityId !== 'task-focus'),
            }
          : { ...fixture, timelineVersion: 1 + rescheduleCount },
      ),
    }),
  );
  await page.route('**/api/v1/tasks/task-focus', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    updateBody = (await route.request().postDataJSON()) as Record<string, unknown>;
    taskTitle = String(updateBody.title);
    taskVersion += 1;
    await route.fulfill({
      json: envelope({ ...tasks()[0], title: taskTitle, version: taskVersion }),
    });
  });
  await page.route('**/api/v1/tasks/task-focus/complete', async (route) => {
    taskCompleted = true;
    await route.fulfill({
      json: envelope({
        id: 'task-focus',
        title: taskTitle,
        version: taskVersion + 1,
        status: 'COMPLETED',
      }),
    });
  });
  await page.route('**/api/v1/schedules:reschedule', async (route) => {
    rescheduleCount += 1;
    await route.fulfill({ json: envelope({ timelineVersion: 1 + rescheduleCount }) });
  });

  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await page.waitForTimeout(500);
  expect(runtimeErrors).toEqual([]);

  const scene = page.locator('.today-immersive');
  await expect(scene).toHaveAttribute('data-today-v3-phase', /^[789]$/);
  await expect(page.locator('.today-scene')).toHaveAttribute(
    'data-composition',
    /^v3-(business-reconnected|dynamic-performance|desktop-adaptive)$/,
  );
  await expect(page.getByLabel('天气暂不可用')).toBeVisible();
  await expect(
    page.getByLabel('今日压力与当前状态').getByText('35', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('section.today-timeline')).toBeVisible();
  await expect(page.getByLabel('AI 助手输入')).toBeEnabled();

  const sceneMedia = page.locator('.today-scene-media');
  await sceneMedia.evaluate((element) => {
    (element as HTMLElement).dataset.phase7Identity = 'stable';
  });

  const eventSegment = page.getByRole('button', { name: /晨会，/ }).last();
  await eventSegment.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '时间块详情' })).toContainText('晨会');
  await page.keyboard.press('Escape');
  await expect(eventSegment).toBeFocused();

  await page
    .locator('.today-plan__section--primary')
    .locator('.today-plan__main')
    .filter({ hasText: '开发今日页' })
    .click();
  const taskDialog = page.getByRole('dialog', { name: '任务详情' });
  await expect(taskDialog).toBeVisible();
  await taskDialog.getByLabel('标题').fill('开发今日页 · Phase 7');
  await taskDialog.getByRole('button', { name: '保存并重新安排' }).click();
  // Escape is harmless if the refresh already closed the panel and avoids racing a detached button.
  await page.keyboard.press('Escape');
  await expect(taskDialog).toBeHidden();
  // PATCH 由异步 route 捕获；若 Escape 先于刷新关掉弹层，断言需轮询等待捕获完成，避免时序竞态。
  await expect
    .poll(() => updateBody)
    .toMatchObject({
      title: '开发今日页 · Phase 7',
      expectedVersion: 1,
    });

  await page.getByRole('button', { name: '完成任务：开发今日页' }).click();
  await expect(page.getByRole('status')).toContainText('任务已完成，时间已释放');
  await expect(
    page.getByLabel('今日压力与当前状态').getByText('12', { exact: true }),
  ).toBeVisible();
  await expect(sceneMedia).toHaveAttribute('data-phase7-identity', 'stable');

  await page.getByRole('button', { name: '重新安排今日' }).click();
  await expect(page.getByRole('status')).toContainText('今日计划已重新安排');
  expect(rescheduleCount).toBe(1);
  await expect(sceneMedia).toHaveAttribute('data-phase7-identity', 'stable');

  await page.screenshot({ path: testInfo.outputPath('today-v3-phase7-business-flow.png') });
});

test('Final Scene media preserves the main flow and pauses for lifecycle constraints', async ({
  page,
}, testInfo) => {
  await freezeClock(page);
  await mockPeripheralCollections(page);
  await page.route('**/api/v1/setup/status', (route) =>
    route.fulfill({ json: envelope({ initialized: true, dataDirectory: null }) }),
  );
  await page.route('**/api/v1/settings*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/categories*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/tasks*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/schedules/warnings', (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route('**/api/v1/notifications*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/ai/providers*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/today*', (route) => route.fulfill({ json: envelope(fixture) }));
  await page.setViewportSize({ width: 1536, height: 1024 });

  await page.goto('/');
  const media = page.locator('.today-scene-media');
  const videos = page.locator('.today-scene-media__video');
  await expect(media).toHaveAttribute('data-media-ready', 'true', { timeout: 8_000 });
  await expect(videos).toHaveCount(2);
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

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(media).toHaveAttribute('data-reduced-motion', 'true');
  await expect(media).toHaveAttribute('data-media-ready', 'false');
  await expect(page.locator('.today-scene-media__master')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('today-final-scene-reduced-motion.png') });
});

test('V3 Phase 9 keeps the fountain dominant across the baseline and four desktop acceptance viewports', async ({
  page,
}, testInfo) => {
  await freezeClock(page);
  await mockPeripheralCollections(page);
  await page.route('**/api/v1/setup/status', (route) =>
    route.fulfill({ json: envelope({ initialized: true, dataDirectory: null }) }),
  );
  await page.route('**/api/v1/settings*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/categories*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/tasks*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/schedules/warnings', (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route('**/api/v1/notifications*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/ai/providers*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/today*', (route) => route.fulfill({ json: envelope(fixture) }));

  const viewports = [
    { width: 1920, height: 1080, sidebarWidth: 248 },
    { width: 1600, height: 900, sidebarWidth: 248 },
    { width: 1536, height: 1024, sidebarWidth: 248 },
    { width: 1440, height: 900, sidebarWidth: 248 },
    { width: 1366, height: 768, sidebarWidth: 248 },
  ] as const;
  const metrics: Record<string, unknown>[] = [];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.today-immersive')).toHaveAttribute('data-today-v3-phase', '9');
    await expect(page.locator('.today-scene')).toHaveAttribute(
      'data-composition',
      'v3-desktop-adaptive',
    );
    await expect(page.locator('.today-scene-media')).toHaveAttribute('data-media-ready', 'true', {
      timeout: 8_000,
    });
    await expect(page.locator('canvas')).toHaveCount(0);

    const sidebar = await page.locator('.sidebar').boundingBox();
    const scene = await page.locator('.today-scene').boundingBox();
    const stage = await page.locator('.today-scene__stage').boundingBox();
    const plan = await page.locator('.today-scene__plan').boundingBox();
    const timeline = await page.locator('.today-scene__timeline').boundingBox();
    const composer = await page.locator('.today-scene__ai').boundingBox();
    expect(sidebar).not.toBeNull();
    expect(stage).not.toBeNull();
    expect(plan).not.toBeNull();
    expect(timeline).not.toBeNull();
    expect(composer).not.toBeNull();
    if (
      sidebar === null ||
      scene === null ||
      stage === null ||
      plan === null ||
      timeline === null ||
      composer === null
    ) {
      continue;
    }

    expect(sidebar.width).toBeCloseTo(viewport.sidebarWidth, 0);
    const minimumStageWidth = viewport.width === 1366 ? 820 : viewport.width === 1440 ? 860 : 899;
    expect(stage.width).toBeGreaterThanOrEqual(minimumStageWidth);
    expect(stage.width).toBeGreaterThan(plan.width * 2.7);
    expect(stage.x + stage.width).toBeLessThanOrEqual(plan.x + 1);
    expect((timeline.x - scene.x) / scene.width).toBeCloseTo(0.05, 2);
    expect(plan.x - (timeline.x + timeline.width)).toBeCloseTo(60, 0);
    expect((composer.x - scene.x) / scene.width).toBeCloseTo(0.03, 2);
    expect(plan.x - (composer.x + composer.width)).toBeCloseTo(60, 0);
    expect(stage.y + stage.height).toBeLessThanOrEqual(timeline.y + 1);
    expect(timeline.y + timeline.height).toBeLessThanOrEqual(composer.y + 1);
    expect(plan.x + plan.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(plan.y + plan.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole('heading', { name: '今日计划' })).toBeVisible();
    await expect(page.locator('section.today-timeline')).toBeVisible();
    await expect(page.getByLabel('AI 助手输入')).toBeVisible();

    const key = `${String(viewport.width)}x${String(viewport.height)}`;
    metrics.push({ viewport, sidebar, scene, stage, plan, timeline, composer });
    await page.screenshot({ path: testInfo.outputPath(`today-v3-phase9-${key}.png`) });
  }

  await writeFile(
    testInfo.outputPath('today-v3-phase9-metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8',
  );
});
