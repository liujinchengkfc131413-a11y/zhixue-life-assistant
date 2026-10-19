import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';

const fixture = JSON.parse(
  readFileSync(resolve('docs/design/today/fixtures/6-in-progress.json'), 'utf8'),
) as Record<string, unknown> & {
  readonly pressure: { readonly score: number; readonly level: string };
  readonly serverNow: string;
};
const evidenceDirectory = evidenceDirectoryFor('docs/design/today/final-integration');
const v31EvidenceDirectory = evidenceDirectoryFor('docs/design/today/v3.1-scene-state');
const envelope = (data: unknown) => ({ data, meta: { requestId: 'today-scene-video-qa' } });

const levelFor = (pressure: number): string => {
  if (pressure <= 24) return 'RELAXED';
  if (pressure <= 49) return 'COMFORTABLE';
  if (pressure <= 74) return 'ELEVATED';
  return 'HIGH_PRESSURE';
};

const installRoutes = async (
  page: Page,
  getPressure: () => number,
  getServerNow: () => string = () => fixture.serverNow,
): Promise<void> => {
  await page.route('**/api/v1/setup/status', (route) =>
    route.fulfill({ json: envelope({ initialized: true, dataDirectory: null }) }),
  );
  await page.route('**/api/v1/settings*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/categories*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/events*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/goals*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/plans*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/tags*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/tasks*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/schedules/warnings', (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route('**/api/v1/notifications*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/ai/providers*', (route) => route.fulfill({ json: envelope([]) }));
  await page.route('**/api/v1/schedules:reschedule', (route) =>
    route.fulfill({ json: envelope({ timelineVersion: 2 }) }),
  );
  await page.route('**/api/v1/today*', (route) => {
    const pressure = getPressure();
    return route.fulfill({
      json: envelope({
        ...fixture,
        serverNow: getServerNow(),
        timelineVersion: pressure,
        pressure: { ...fixture.pressure, score: pressure, level: levelFor(pressure) },
      }),
    });
  });
};

const serverNowForLocalTime = (hour: number, minute = 0): string =>
  new Date(2026, 7, 15, hour, minute, 0, 0).toISOString();

const waitForScene = async (page: Page, state: string): Promise<void> => {
  const media = page.locator('.today-scene-media');
  await expect(media).toHaveAttribute('data-scene-state', state);
  await expect(media).toHaveAttribute('data-active-state', state, { timeout: 8_000 });
  await expect(media).toHaveAttribute('data-media-ready', 'true');
  await expect(media).toHaveAttribute('data-transitioning', 'false', { timeout: 4_000 });
};

const expectActiveVideo = async (page: Page, fileStem: string): Promise<void> => {
  await expect(page.locator('.today-scene-media__video[data-visible="true"]')).toHaveAttribute(
    'src',
    new RegExp(`${fileStem}(?:-[^/]+)?\\.mp4(?:\\?.*)?$`),
  );
};

test('Today Scene integrates four pressure videos with crossfade, fallback and stable UI', async ({
  page,
}) => {
  await mkdir(evidenceDirectory, { recursive: true });
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      runtimeErrors.push(`${String(response.status())} ${response.url()}`);
  });

  let activePressure = 35;
  await installRoutes(page, () => activePressure);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await waitForScene(page, 'balanced');
  await expectActiveVideo(page, 'fountain-calm-loop-seamless');

  const media = page.locator('.today-scene-media');
  const videos = page.locator('.today-scene-media__video');
  await expect(videos).toHaveCount(2);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.today-plan__section')).toHaveCount(3);
  await expect(page.locator('section.today-timeline')).toBeVisible();
  await expect(page.getByLabel('AI 助手输入')).toBeEnabled();
  const mediaBox = await media.boundingBox();
  const sceneBox = await page.locator('.today-scene').boundingBox();
  expect(mediaBox).toEqual(sceneBox);
  expect(sceneBox?.x).toBeCloseTo(248, 0);
  expect(
    await videos.evaluateAll(
      (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
    ),
  ).toBe(1);
  await page.screenshot({ path: resolve(evidenceDirectory, 'state-balanced-1536x1024.png') });

  const aiInput = page.getByLabel('AI 助手输入');
  await aiInput.fill('视频切换期间保留这段输入');

  const reschedule = page.getByRole('button', { name: '重新安排今日' });
  activePressure = 60;
  await reschedule.click();
  await expect(media).toHaveAttribute('data-scene-state', 'busy');
  await expect(media).toHaveAttribute('data-transitioning', 'true', { timeout: 4_000 });
  expect(
    await videos.evaluateAll(
      (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
    ),
  ).toBe(2);
  await page.screenshot({
    path: resolve(evidenceDirectory, 'crossfade-balanced-to-busy-1536x1024.png'),
  });
  await aiInput.focus();
  await expect(aiInput).toHaveValue('视频切换期间保留这段输入');
  await waitForScene(page, 'busy');
  await expect(aiInput).toBeFocused();
  await page.reload();
  await waitForScene(page, 'busy');
  await expectActiveVideo(page, 'fountain-intense-loop-seamless');
  await page.screenshot({ path: resolve(evidenceDirectory, 'state-busy-1536x1024.png') });

  activePressure = 85;
  await reschedule.click();
  await waitForScene(page, 'intense');
  await page.reload();
  await waitForScene(page, 'intense');
  await expectActiveVideo(page, 'fountain-busy-loop-seamless');
  await page.screenshot({ path: resolve(evidenceDirectory, 'state-intense-1536x1024.png') });

  // A second update during a crossfade is queued; the newest pressure state wins.
  activePressure = 60;
  await reschedule.click();
  await expect(media).toHaveAttribute('data-transitioning', 'true', { timeout: 4_000 });
  activePressure = 10;
  await reschedule.click();
  await waitForScene(page, 'calm');
  expect(
    await videos.evaluateAll(
      (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
    ),
  ).toBe(1);
  await page.reload();
  await waitForScene(page, 'calm');
  await expectActiveVideo(page, 'fountain-balanced-loop-seamless');
  await page.screenshot({ path: resolve(evidenceDirectory, 'state-calm-1536x1024.png') });

  activePressure = 20;
  await reschedule.click();
  await expect(media).toHaveAttribute('data-scene-state', 'calm');
  await expect(media).toHaveAttribute('data-transitioning', 'false');

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
  await expect
    .poll(() =>
      videos.evaluateAll(
        (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
      ),
    )
    .toBe(0);
  await expect(page.locator('.today-scene-media__master')).toBeVisible();
  await expect(page.locator('.today-scene')).toHaveAttribute('data-time-state', 'day');
  await expect(page.locator('.today-scene__environment-overlay')).toHaveAttribute(
    'data-time-state',
    'day',
  );
  await expect(page.getByLabel('AI 助手输入')).toHaveValue('');

  expect(runtimeErrors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(
    false,
  );
});

test('Today Scene keeps its master frame and UI when the initial video cannot load', async ({
  page,
}) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await installRoutes(page, () => 35);
  await page.route('**/*fountain-calm-loop-seamless*.mp4', (route) => route.abort('failed'));
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');

  const media = page.locator('.today-scene-media');
  await expect(media).toHaveAttribute('data-scene-state', 'balanced');
  await expect(media).toHaveAttribute('data-media-ready', 'false');
  await expect(page.locator('.today-scene-media__master')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.today-scene')).toHaveAttribute('data-time-state', 'day');
  await expect(page.locator('.today-scene__environment-overlay')).toHaveAttribute(
    'data-time-state',
    'day',
  );
  await expect(page.locator('.today-plan__section')).toHaveCount(3);
  await expect(page.locator('section.today-timeline')).toBeVisible();
  await expect(page.getByLabel('AI 助手输入')).toBeEnabled();
  await page.screenshot({ path: resolve(evidenceDirectory, 'fallback-master-1536x1024.png') });
});

test('Today Scene pauses its active video when the Today route unmounts', async ({ page }) => {
  await installRoutes(page, () => 35);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await waitForScene(page, 'balanced');

  const activeVideo = await page
    .locator('.today-scene-media__video[data-visible="true"]')
    .elementHandle();
  expect(activeVideo).not.toBeNull();
  await page.getByRole('link', { name: '工作' }).click();
  await page.waitForURL('**/work');

  expect(await activeVideo.evaluate((video) => (video as HTMLVideoElement).paused)).toBe(true);
});

test('Today Scene composes all pressure and time states without remounting the UI', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      runtimeErrors.push(`${String(response.status())} ${response.url()}`);
  });

  let activePressure = 10;
  let activeServerNow = serverNowForLocalTime(9);
  await installRoutes(
    page,
    () => activePressure,
    () => activeServerNow,
  );
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');

  const scene = page.locator('.today-scene');
  const media = page.locator('.today-scene-media');
  const overlay = page.locator('.today-scene__environment-overlay');
  const videos = page.locator('.today-scene-media__video');
  const aiInput = page.getByLabel('AI 助手输入');
  const timeline = page.locator('section.today-timeline');
  const reschedule = page.getByRole('button', { name: '重新安排今日' });

  await waitForScene(page, 'calm');
  await expect(scene).toHaveAttribute('data-pressure-state', 'calm');
  await expect(scene).toHaveAttribute('data-time-state', 'morning');
  await aiInput.fill('时间环境切换期间保留这段输入');
  await timeline.evaluate((element) => {
    element.setAttribute('data-node-stability', 'preserve');
  });

  const pressureStates = [
    [10, 'calm'],
    [35, 'balanced'],
    [60, 'busy'],
    [85, 'intense'],
  ] as const;
  const timeStates = [
    [9, 0, 'morning'],
    [12, 0, 'day'],
    [18, 0, 'sunset'],
    [22, 0, 'night'],
  ] as const;

  for (const [pressure, pressureState] of pressureStates) {
    for (const [hour, minute, timeState] of timeStates) {
      activePressure = pressure;
      activeServerNow = serverNowForLocalTime(hour, minute);
      await reschedule.click();
      await waitForScene(page, pressureState);
      await expect(scene).toHaveAttribute('data-pressure-state', pressureState);
      await expect(scene).toHaveAttribute('data-time-state', timeState);
      await expect(overlay).toHaveAttribute('data-time-state', timeState);
      expect(
        await videos.evaluateAll(
          (elements) => elements.filter((video) => !(video as HTMLVideoElement).paused).length,
        ),
      ).toBeLessThanOrEqual(2);
    }
  }

  activePressure = 10;
  activeServerNow = serverNowForLocalTime(9);
  await reschedule.click();
  await expect(media).toHaveAttribute('data-transitioning', 'true', { timeout: 4_000 });
  await expect(scene).toHaveAttribute('data-time-state', 'morning');
  await aiInput.focus();
  await waitForScene(page, 'calm');
  await page.waitForTimeout(5_200);

  await expect(aiInput).toHaveValue('时间环境切换期间保留这段输入');
  await expect(aiInput).toBeFocused();
  await expect(timeline).toHaveAttribute('data-node-stability', 'preserve');
  await expect(page.locator('.today-plan__section')).toHaveCount(3);
  await expect(videos).toHaveCount(2);
  expect(await media.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
    '5s',
  );
  expect(
    await overlay.evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toContain('5s');
  expect(runtimeErrors).toEqual([]);
});

test('Today Scene captures four time environments at the same balanced pressure', async ({
  page,
}) => {
  await mkdir(v31EvidenceDirectory, { recursive: true });
  let activeServerNow = serverNowForLocalTime(9);
  await installRoutes(
    page,
    () => 35,
    () => activeServerNow,
  );
  await page.setViewportSize({ width: 1536, height: 1024 });

  const timeStates = [
    [9, 0, 'morning'],
    [12, 0, 'day'],
    [18, 0, 'sunset'],
    [22, 0, 'night'],
  ] as const;

  for (const [hour, minute, timeState] of timeStates) {
    activeServerNow = serverNowForLocalTime(hour, minute);
    await page.goto('/');
    await waitForScene(page, 'balanced');
    await expect(page.locator('.today-scene')).toHaveAttribute('data-time-state', timeState);
    await page.screenshot({
      path: resolve(v31EvidenceDirectory, `balanced-${timeState}-1536x1024.png`),
    });
  }
});

test('Today V1 keeps one focus axis and stable content rails across three desktop sizes', async ({
  page,
}) => {
  const v1EvidenceDirectory = evidenceDirectoryFor('docs/design/today/v1-calibration');
  await mkdir(v1EvidenceDirectory, { recursive: true });
  await installRoutes(page, () => 35);

  const viewports = [
    { width: 1536, height: 1024 },
    { width: 1654, height: 960 },
    { width: 1920, height: 1080 },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await waitForScene(page, 'balanced');

    const metrics = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const element = document.querySelector(selector);
        if (element === null) throw new Error(`Missing visual calibration target: ${selector}`);
        const box = element.getBoundingClientRect();
        return {
          x: box.x,
          width: box.width,
          right: box.right,
          centerX: box.x + box.width / 2,
        };
      };
      const master = document.querySelector('.today-scene-media__master');
      const video = document.querySelector('.today-scene-media__video[data-visible="true"]');
      const overlay = document.querySelector('.today-scene__environment-overlay');
      if (master === null || video === null || overlay === null)
        throw new Error('Missing active scene media');
      const masterStyle = getComputedStyle(master);
      const videoStyle = getComputedStyle(video);
      const overlayStyle = getComputedStyle(overlay);
      const masterBox = master.getBoundingClientRect();
      const videoBox = video.getBoundingClientRect();
      return {
        scene: bounds('.today-scene'),
        now: bounds('.today-state-axis__now'),
        pressure: bounds('.today-state-axis__pressure'),
        status: bounds('.today-status-floats'),
        plan: bounds('.today-scene__plan'),
        timeline: bounds('.today-scene__timeline'),
        composer: bounds('.today-scene__ai'),
        media: {
          x: videoBox.x,
          width: videoBox.width,
          objectPosition: videoStyle.objectPosition,
          transform: videoStyle.transform,
          filter: videoStyle.filter,
        },
        master: {
          x: masterBox.x,
          width: masterBox.width,
          objectPosition: masterStyle.objectPosition,
          transform: masterStyle.transform,
          filter: masterStyle.filter,
        },
        overlay: {
          filter: overlayStyle.filter,
          backdropFilter: overlayStyle.backdropFilter,
        },
      };
    });

    const sceneFocusX = metrics.scene.x + metrics.scene.width * 0.39;
    expect(Math.abs(metrics.now.centerX - sceneFocusX)).toBeLessThanOrEqual(2);
    expect((metrics.pressure.x - metrics.scene.x) / metrics.scene.width).toBeCloseTo(0.05, 2);
    expect((metrics.status.x - metrics.scene.x) / metrics.scene.width).toBeCloseTo(0.56, 2);
    expect(viewport.width - metrics.plan.right).toBeCloseTo(32, 0);
    expect((metrics.timeline.x - metrics.scene.x) / metrics.scene.width).toBeCloseTo(0.05, 2);
    expect(metrics.plan.x - metrics.timeline.right).toBeCloseTo(60, 0);
    expect((metrics.composer.x - metrics.scene.x) / metrics.scene.width).toBeCloseTo(0.03, 2);
    expect(metrics.plan.x - metrics.composer.right).toBeCloseTo(60, 0);
    // 最终底图/状态视频使用 106.66% 预扩展、-11cqw 位移和 0.94 缩放，
    // 实际包围盒轴约为 -0.118；旧 Canvas 的 -0.11 基线不再适用。
    expect((metrics.media.x - metrics.scene.x) / metrics.scene.width).toBeCloseTo(-0.118, 2);
    expect(metrics.media.width).toBeCloseTo(metrics.scene.width * 1.0026, 0);
    expect(metrics.media.objectPosition).toBe('50% 50%');
    expect(metrics.media.transform).not.toBe('none');
    expect(metrics.media.filter).toBe('none');
    expect(metrics.master.x).toBeCloseTo(metrics.media.x, 0);
    expect(metrics.master.width).toBeCloseTo(metrics.media.width, 0);
    expect(metrics.master.objectPosition).toBe(metrics.media.objectPosition);
    expect(metrics.master.transform).toBe(metrics.media.transform);
    expect(metrics.master.filter).toBe('none');
    expect(metrics.overlay).toEqual({ filter: 'none', backdropFilter: 'none' });
    await expect(page.getByRole('button', { name: '重新安排今日' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);

    await page.screenshot({
      path: resolve(
        v1EvidenceDirectory,
        `after-${String(viewport.width)}x${String(viewport.height)}.png`,
      ),
    });
  }
});
