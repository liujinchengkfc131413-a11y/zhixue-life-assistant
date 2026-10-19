import {
  CalendarEnvelopeSchema,
  CategoriesEnvelopeSchema,
  GoalEnvelopeSchema,
  GoalTreeEnvelopeSchema,
  KanbanEnvelopeSchema,
  PlanEnvelopeSchema,
  PlanTimelineEnvelopeSchema,
  TodayEnvelopeSchema,
} from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M3 today and planning API', () => {
  it('returns a 1440-minute dashboard and synchronized planning projections', async () => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-11T04:00:00.000Z'));
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json`, clock });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      );
      const work = categories.data.find((category) => category.parentArea === 'WORK');
      if (work === undefined) throw new Error('测试缺少工作分类。');
      const goal = GoalEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/goals',
            payload: {
              categoryId: work.id,
              title: '完成 M3',
              goalType: 'OUTCOME',
              startDate: '2026-08-11',
              endDate: '2026-08-31',
            },
          })
        ).json(),
      ).data;
      const plan = PlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/plans',
            payload: {
              goalId: goal.id,
              categoryId: work.id,
              title: '今日与计划目标',
              priority: 'HIGH',
              startDate: '2026-08-11',
              endDate: '2026-08-20',
            },
          })
        ).json(),
      ).data;
      await app.inject({
        method: 'POST',
        url: '/api/v1/tasks',
        payload: {
          categoryId: work.id,
          planId: plan.id,
          goalId: goal.id,
          title: 'Canvas 时间流',
          priority: 'URGENT',
          dueAt: '2026-08-11T12:00:00.000Z',
          estimatedMinutes: 120,
          isFlexible: true,
          isSplittable: false,
          preferredArea: 'WORK',
        },
      });

      const today = TodayEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/today?date=2026-08-11' })).json(),
      ).data;
      expect(today.serverNow).toBe('2026-08-11T04:00:00.000Z');
      expect(Object.values(today.totals).reduce((sum, minutes) => sum + minutes, 0)).toBe(1_440);
      expect(today.freeTime.reduce((sum, segment) => sum + segment.minutes, 0)).toBe(
        today.totals.freeMinutes,
      );
      expect(today.blocks.some((block) => block.title === 'Canvas 时间流')).toBe(true);
      expect(today.pressure.algorithmVersion).toBe('pressure-v1');

      expect(
        KanbanEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/plans/views/kanban' })).json(),
        ).data.flatMap((column) => column.plans),
      ).toHaveLength(1);
      expect(
        CalendarEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/plans/views/calendar' })).json(),
        ).data.length,
      ).toBeGreaterThan(0);
      expect(
        PlanTimelineEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/plans/views/timeline' })).json(),
        ).data[0]?.goal?.id,
      ).toBe(goal.id);
      expect(
        GoalTreeEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/plans/views/goal-tree' })).json(),
        ).data[0]?.plans[0]?.tasks,
      ).toHaveLength(1);

      const manual = PlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/plans/${plan.id}/set-progress`,
            headers: { 'if-match': `"${String(plan.version)}"` },
            payload: { expectedVersion: plan.version, value: 35 },
          })
        ).json(),
      ).data;
      expect(manual).toMatchObject({
        progressMode: 'MANUAL_OVERRIDE',
        displayProgress: 35,
        manualProgress: 35,
      });
      const automatic = PlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/plans/${plan.id}/set-progress`,
            headers: { 'if-match': `"${String(manual.version)}"` },
            payload: { expectedVersion: manual.version, value: null },
          })
        ).json(),
      ).data;
      expect(automatic.progressMode).toBe('AUTO');
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
});
