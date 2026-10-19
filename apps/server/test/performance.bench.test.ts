import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BootstrapStore, DataDirectoryManager } from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

/**
 * M8-008 性能基准：在 10 万记录 / 5 万消息基准库上测量页面、查询、搜索与保存交互，
 * 校验设计书 §22.2 验收目标：
 * - 常规页面首次本地加载 ≤ 2 秒（today / work-overview / life-overview / 规划视图）
 * - 常规查询与保存交互 ≤ 300 毫秒（tasks / goals / plans / notifications / POST /tasks）
 * - 全局关键词搜索 ≤ 1 秒
 *
 * 前置条件：先生成基准库 `pnpm fixtures:benchmark --out fixtures/performance/life-assistant.benchmark.db`。
 * 基准库位于 fixtures/performance/ 而非 test-results/，避免被 Playwright 的 outputDir 清理误删。
 * 通过 `RUN_PERFORMANCE=1 pnpm vitest run apps/server/test/performance.bench.test.ts` 运行；
 * 未设置该环境变量时默认跳过，不进入常规测试门禁。
 */

const enabled = process.env.RUN_PERFORMANCE === '1';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const benchmarkDb = resolve(
  workspaceRoot,
  'fixtures',
  'performance',
  'life-assistant.benchmark.db',
);

const median = (samples: readonly number[]): number =>
  [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 0;

interface Measurement {
  readonly name: string;
  readonly p50: number;
  readonly samples: readonly number[];
}

const measure = async (
  run: () => Promise<void>,
  samples = 5,
): Promise<{ p50: number; samples: readonly number[] }> => {
  const values: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    await run();
    values.push(performance.now() - started);
  }
  return { p50: median(values), samples: values };
};

describe.skipIf(!enabled)('M8-008 performance baseline on 100k records', () => {
  it('keeps page, query, search and save interactions within the §22.2 targets', async () => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-14T09:00:00.000Z'));
    const manager = new DataDirectoryManager(
      new BootstrapStore(`${temporary.path}/bootstrap.json`),
      '0.1.0',
    );
    const layout = await manager.initialize(`${temporary.path}/data`);
    await mkdir(dirname(layout.database), { recursive: true });
    await copyFile(benchmarkDb, layout.database);

    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock,
    });
    await runtime.start();
    const app = await buildApp({ runtime });
    try {
      const inject = async (
        url: string,
        options?: { method?: 'GET' | 'POST'; payload?: unknown },
      ): Promise<{ statusCode: number; json(): unknown }> => {
        let response: Awaited<ReturnType<FastifyInstance['inject']>>;
        if (options?.method === 'POST') {
          const payload = JSON.stringify(options.payload) as never;
          response = await app.inject({
            method: 'POST',
            url,
            headers: { 'content-type': 'application/json' },
            payload,
          });
        } else {
          response = await app.inject({ method: 'GET', url });
        }
        return { statusCode: response.statusCode, json: () => response.json() };
      };

      const report: Measurement[] = [];
      const pages: [string, string][] = [
        ['today', '/api/v1/today?date=2026-08-14'],
        ['today-timeline', '/api/v1/today/timeline?date=2026-08-14'],
        ['kanban', '/api/v1/plans/views/kanban?range=WEEK'],
        ['calendar', '/api/v1/plans/views/calendar?range=WEEK'],
        ['plan-timeline', '/api/v1/plans/views/timeline?range=WEEK'],
        ['goal-tree', '/api/v1/plans/views/goal-tree?range=WEEK'],
        ['work-overview', '/api/v1/work/overview?range=MONTH'],
        ['life-overview', '/api/v1/life/overview?range=MONTH'],
      ];
      const queries: [string, string][] = [
        ['tasks', '/api/v1/tasks'],
        ['goals', '/api/v1/goals'],
        ['plans', '/api/v1/plans'],
        ['notifications', '/api/v1/notifications'],
      ];

      for (const [name, url] of pages) {
        const result = await measure(async () => {
          const response = await inject(url);
          expect(response.statusCode, `${name} HTTP`).toBe(200);
        });
        report.push({ name, ...result });
      }
      for (const [name, url] of queries) {
        const result = await measure(async () => {
          const response = await inject(url);
          expect(response.statusCode, `${name} HTTP`).toBe(200);
        });
        report.push({ name, ...result });
      }

      const search = await measure(async () => {
        const response = await inject('/api/v1/search?q=%E5%9F%BA%E5%87%86');
        expect(response.statusCode).toBe(200);
      });
      report.push({ name: 'search', ...search });

      const categoriesResponse = await inject('/api/v1/categories');
      const categoriesEnvelope: unknown = categoriesResponse.json();
      const categoriesData: { id: string; parentArea: string }[] = [];
      if (
        typeof categoriesEnvelope === 'object' &&
        categoriesEnvelope !== null &&
        'data' in categoriesEnvelope
      ) {
        const data = categoriesEnvelope.data;
        if (Array.isArray(data)) {
          for (const rawItem of data) {
            if (typeof rawItem !== 'object' || rawItem === null) continue;
            const record = rawItem as Record<string, unknown>;
            if (typeof record.id !== 'string' || typeof record.parentArea !== 'string') continue;
            categoriesData.push({ id: record.id, parentArea: record.parentArea });
          }
        }
      }
      const work = categoriesData.find((category) => category.parentArea === 'WORK');
      if (work === undefined) throw new Error('性能基准缺少工作分类。');
      const save = await measure(async () => {
        const response = await inject('/api/v1/tasks', {
          method: 'POST',
          payload: {
            categoryId: work.id,
            title: '性能基准保存交互',
            priority: 'NORMAL',
            dueAt: '2026-08-20T04:00:00.000Z',
            estimatedMinutes: 30,
            isFlexible: true,
            preferredArea: 'WORK',
          },
        });
        expect(response.statusCode).toBe(201);
      });
      report.push({ name: 'save-task', ...save });
      const pageViolations = report
        .filter((item) => pages.some(([name]) => name === item.name))
        .filter((item) => item.p50 > 2000);
      const queryViolations = report
        .filter((item) => [...queries.map(([name]) => name), 'save-task'].includes(item.name))
        .filter((item) => item.p50 > 300);
      const searchViolations = report
        .filter((item) => item.name === 'search')
        .filter((item) => item.p50 > 1000);

      const summary = report.map((item) => `${item.name}=${String(item.p50)}ms`).join(', ');
      console.log(`性能基准摘要：${summary}`);

      expect(pageViolations, `页面超 2 秒：${pageViolations.map((v) => v.name).join(',')}`).toEqual(
        [],
      );
      expect(
        queryViolations,
        `查询/保存超 300ms：${queryViolations.map((v) => `${v.name}=${String(v.p50)}ms`).join(',')}`,
      ).toEqual([]);
      expect(searchViolations, '搜索超 1 秒').toEqual([]);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  }, 300_000);
});
