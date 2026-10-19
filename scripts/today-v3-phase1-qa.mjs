/* global console, process, document, window, HTMLElement, getComputedStyle */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium } from '@playwright/test';

const base = process.env.TODAY_V3_QA_BASE ?? 'http://127.0.0.1:43124';
const phase = process.env.TODAY_V3_QA_PHASE ?? '1';
const outputDirectory = resolve(`docs/design/today/v3/phase${phase}`);
const output = resolve(outputDirectory, 'implementation.png');
const reference = resolve(outputDirectory, 'reference.png');
const comparison = resolve(outputDirectory, 'comparison.png');
const browserPath =
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe';

const browser = await chromium.launch({ executablePath: browserPath });
const context = await browser.newContext({
  viewport: { width: 1536, height: 1024 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const fixture = JSON.parse(
  await readFile(resolve('docs/design/today/fixtures/6-in-progress.json'), 'utf8'),
);
let activeFixture =
  phase === '6'
    ? { ...fixture, pressure: { ...fixture.pressure, score: 37, level: 'COMFORTABLE' } }
    : fixture;
const fixedTimestamp = Date.parse(fixture.serverNow);
await page.addInitScript((timestamp) => {
  const NativeDate = Date;
  class FixedDate extends NativeDate {
    constructor(...arguments_) {
      super(...(arguments_.length === 0 ? [timestamp] : arguments_));
    }
    static now() {
      return timestamp;
    }
  }
  Object.setPrototypeOf(FixedDate, NativeDate);
  window.Date = FixedDate;
}, fixedTimestamp);
await page.route('**/api/v1/today*', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: activeFixture, meta: { requestId: 'today-v3-phase1-qa' } }),
  }),
);
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

await page.goto(phase === '8' ? `${base}/?fountainTier=high` : base, { waitUntil: 'networkidle' });
await page.waitForSelector(`[data-today-v3-phase="${phase}"]`, { timeout: 20_000 });
if (
  phase === '4' ||
  phase === '5' ||
  phase === '6' ||
  phase === '7' ||
  phase === '8' ||
  phase === '9'
) {
  await page.waitForSelector('.fountain-stage[data-webgl-active="true"]', { timeout: 20_000 });
  await page.waitForTimeout(600);
}
if (phase === '8') {
  await page.waitForSelector('.fountain-stage__webgl[data-webgl-performance="high"]', {
    timeout: 20_000,
  });
  await page.waitForSelector('.fountain-stage__webgl[data-performance-samples="90"]', {
    timeout: 10_000,
  });
}
if (phase === '5') {
  const webglHost = '.fountain-stage__webgl[data-webgl-mode="full"]';
  await page.waitForSelector(webglHost, { timeout: 20_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('.fountain-stage__webgl')
        ?.getAttribute('data-webgl-atmosphere')
        ?.includes('reflection') === true,
  );
  for (const second of [0, 10, 20]) {
    await page.screenshot({
      path: resolve(outputDirectory, `motion-${String(second).padStart(2, '0')}.png`),
      fullPage: false,
    });
    await page.waitForTimeout(10_000);
  }
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector('.fountain-stage__webgl')?.getAttribute('data-atmosphere-elapsed') ??
          '0',
      ) >= 30,
    undefined,
    { timeout: 12_000 },
  );
  await page.screenshot({ path: resolve(outputDirectory, 'motion-30.png'), fullPage: false });
}
await page.screenshot({ path: output, fullPage: false });

const metrics = await page.evaluate(() => {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) return null;
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  };
  const style = (selector, properties) => {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) return null;
    const computed = getComputedStyle(element);
    return Object.fromEntries(
      properties.map((property) => [property, computed.getPropertyValue(property)]),
    );
  };
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    phase: document.querySelector('.today-immersive')?.getAttribute('data-today-v3-phase'),
    composition: document.querySelector('.today-scene')?.getAttribute('data-composition'),
    sidebar: rect('.sidebar--today'),
    scene: rect('.today-immersive'),
    environment: rect('.today-env'),
    fountain: rect('.fountain-scene'),
    pressure: rect('.today-state-axis__pressure'),
    statuses: rect('.today-status-floats'),
    plan: rect('.today-plan'),
    timeline: rect('.today-timeline'),
    composer: rect('.today-ai'),
    planCards: document.querySelectorAll('.today-plan__section').length,
    fountainLayers: [...document.querySelectorAll('[data-fountain-layer]')].map((element) =>
      element.getAttribute('data-fountain-layer'),
    ),
    canvasCount: document.querySelectorAll('.today-water-canvas').length,
    webglCanvasCount: document.querySelectorAll('.fountain-webgl-canvas').length,
    webglMode: document.querySelector('.fountain-stage__webgl')?.getAttribute('data-webgl-mode'),
    webglOwnership: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-webgl-water-ownership'),
    webglAtmosphere: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-webgl-atmosphere'),
    atmosphereElapsed: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-atmosphere-elapsed') ??
        '0',
    ),
    gpuParticles: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-gpu-particles') ?? '0',
    ),
    gpuSplashParticles: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-gpu-splash-particles') ??
        '0',
    ),
    gpuRipples: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-gpu-ripples') ?? '0',
    ),
    geometryStreams: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-webgl-geometry-streams'),
    fountainProfile: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-fountain-profile'),
    fountainProfileBlend: Number(
      document
        .querySelector('.fountain-stage__webgl')
        ?.getAttribute('data-fountain-profile-blend') ?? '0',
    ),
    fountainVisualState: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-fountain-visual-state'),
    fountainVisualTransition: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-fountain-visual-transition'),
    performanceTier: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-webgl-performance'),
    fpsP50: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-fps-p50') ?? '0',
    ),
    fpsP95: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-fps-p95') ?? '0',
    ),
    frameP95: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-frame-p95') ?? '0',
    ),
    performanceStatus: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-performance-matrix-status'),
    degradationOrder: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-performance-degradation-order'),
    degradationScales: {
      droplets: Number(
        document
          .querySelector('.fountain-stage__webgl')
          ?.getAttribute('data-performance-droplet-scale') ?? '0',
      ),
      ripple: Number(
        document
          .querySelector('.fountain-stage__webgl')
          ?.getAttribute('data-performance-ripple-scale') ?? '0',
      ),
      mist: Number(
        document
          .querySelector('.fountain-stage__webgl')
          ?.getAttribute('data-performance-mist-scale') ?? '0',
      ),
      resolution: Number(
        document
          .querySelector('.fountain-stage__webgl')
          ?.getAttribute('data-performance-resolution-scale') ?? '0',
      ),
    },
    mainFlow: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-performance-main-flow'),
    resizeStrategy: document
      .querySelector('.fountain-stage__webgl')
      ?.getAttribute('data-webgl-resize-strategy'),
    resizeCount: Number(
      document.querySelector('.fountain-stage__webgl')?.getAttribute('data-webgl-resize-count') ??
        '0',
    ),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    uiStyles: {
      heading: style('.today-env__heading', ['font-size', 'font-weight', 'line-height']),
      pressure: style('.today-state-axis__pressure', [
        'background-image',
        'border-radius',
        'backdrop-filter',
      ]),
      status: style('.today-status-floats__item', ['min-height', 'font-family', 'backdrop-filter']),
      planCard: style('.today-plan__section', [
        'background-image',
        'border-radius',
        'backdrop-filter',
      ]),
      composer: style('.today-ai', ['height', 'border-radius', 'background-color']),
    },
    visibleHeadings: [...document.querySelectorAll('h1, h2')]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
      .map((element) => element.textContent?.trim()),
  };
});

const profileMetrics = [];
const performanceMetrics = [];
if (phase === '6') {
  const profiles = [
    { name: 'CALM', score: 12, level: 'RELAXED' },
    { name: 'BALANCED', score: 37, level: 'COMFORTABLE' },
    { name: 'BUSY', score: 62, level: 'ELEVATED' },
    { name: 'INTENSE', score: 87, level: 'HIGH_PRESSURE' },
  ];
  for (const profile of profiles) {
    activeFixture = {
      ...fixture,
      pressure: { ...fixture.pressure, score: profile.score, level: profile.level },
    };
    await page.goto(`${base}/?fountainProfile=${profile.name.toLowerCase()}`, {
      waitUntil: 'networkidle',
    });
    const host = `.fountain-stage__webgl[data-fountain-profile="${profile.name.toLowerCase()}"]`;
    await page.waitForSelector(host, { timeout: 20_000 });
    await page.waitForTimeout(900);
    await page.screenshot({
      path: resolve(outputDirectory, `profile-${profile.name.toLowerCase()}.png`),
      fullPage: false,
    });
    profileMetrics.push(
      await page.locator(host).evaluate((element) => ({
        profile: element.getAttribute('data-fountain-profile'),
        blend: Number(element.getAttribute('data-fountain-profile-blend') ?? '0'),
        visualState: element.getAttribute('data-fountain-visual-state'),
        transition: element.getAttribute('data-fountain-visual-transition'),
        gpuParticles: Number(element.getAttribute('data-gpu-particles') ?? '0'),
        gpuSplashParticles: Number(element.getAttribute('data-gpu-splash-particles') ?? '0'),
        gpuRipples: Number(element.getAttribute('data-gpu-ripples') ?? '0'),
      })),
    );
  }
}
if (phase === '8') {
  for (const tier of ['balanced', 'low']) {
    await page.goto(`${base}/?fountainTier=${tier}`, { waitUntil: 'networkidle' });
    const host = `.fountain-stage__webgl[data-webgl-performance="${tier}"]`;
    await page.waitForSelector(host, { timeout: 20_000 });
    await page.waitForTimeout(500);
    performanceMetrics.push(
      await page.locator(host).evaluate((element) => ({
        tier: element.getAttribute('data-webgl-performance'),
        droplets: Number(element.getAttribute('data-performance-droplet-scale') ?? '0'),
        ripple: Number(element.getAttribute('data-performance-ripple-scale') ?? '0'),
        mist: Number(element.getAttribute('data-performance-mist-scale') ?? '0'),
        resolution: Number(element.getAttribute('data-performance-resolution-scale') ?? '0'),
        gpuParticles: Number(element.getAttribute('data-gpu-particles') ?? '0'),
        gpuSplashParticles: Number(element.getAttribute('data-gpu-splash-particles') ?? '0'),
        gpuRipples: Number(element.getAttribute('data-gpu-ripples') ?? '0'),
        mainFlow: element.getAttribute('data-performance-main-flow'),
        geometryStreams: element.getAttribute('data-webgl-geometry-streams'),
      })),
    );
    await page.screenshot({
      path: resolve(outputDirectory, `${tier}.png`),
      fullPage: false,
    });
  }
}

await writeFile(
  resolve(outputDirectory, 'metrics.json'),
  `${JSON.stringify({ metrics, profileMetrics, performanceMetrics, pageErrors, consoleErrors }, null, 2)}\n`,
);
if (phase === '2') {
  await page.goto(`${base}/?todayV3Gate=2`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-today-v3-gate="2"]', { timeout: 20_000 });
  await page.screenshot({ path: resolve(outputDirectory, 'scene-only.png'), fullPage: false });
}
const comparisonPage = await context.newPage();
await comparisonPage.setViewportSize({ width: 3072, height: 1024 });
const [referenceBytes, implementationBytes] = await Promise.all([
  readFile(reference),
  readFile(output),
]);
await comparisonPage.setContent(`
  <style>*{box-sizing:border-box}html,body{margin:0;width:3072px;height:1024px;background:#062f32;overflow:hidden}main{display:flex;width:100%;height:100%}img{display:block;width:1536px;height:1024px;object-fit:cover}</style>
  <main>
    <img alt="reference" src="data:image/png;base64,${referenceBytes.toString('base64')}">
    <img alt="implementation" src="data:image/png;base64,${implementationBytes.toString('base64')}">
  </main>
`);
await comparisonPage.screenshot({ path: comparison, fullPage: false });
if (phase === '6') {
  const profileImages = await Promise.all(
    ['calm', 'balanced', 'busy', 'intense'].map((name) =>
      readFile(resolve(outputDirectory, `profile-${name}.png`)),
    ),
  );
  await comparisonPage.setViewportSize({ width: 3072, height: 2048 });
  await comparisonPage.setContent(`
    <style>*{box-sizing:border-box}html,body{margin:0;width:3072px;height:2048px;background:#062f32;overflow:hidden}main{display:grid;grid-template-columns:repeat(2,1536px);grid-template-rows:repeat(2,1024px)}figure{position:relative;margin:0}img{display:block;width:1536px;height:1024px;object-fit:cover}figcaption{position:absolute;top:24px;left:24px;padding:8px 14px;border-radius:999px;background:#062f32cc;color:#e8ffff;font:600 20px system-ui;letter-spacing:.08em}</style>
    <main>${profileImages
      .map(
        (bytes, index) =>
          `<figure><img alt="${['calm', 'balanced', 'busy', 'intense'][index]}" src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>${['CALM · 12', 'BALANCED · 37', 'BUSY · 62', 'INTENSE · 87'][index]}</figcaption></figure>`,
      )
      .join('')}</main>
  `);
  await comparisonPage.screenshot({
    path: resolve(outputDirectory, 'profiles-comparison.png'),
    fullPage: false,
  });
}
console.log(
  JSON.stringify(
    { output, metrics, profileMetrics, performanceMetrics, pageErrors, consoleErrors },
    null,
    2,
  ),
);
await browser.close();
