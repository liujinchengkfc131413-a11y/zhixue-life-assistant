import {
  CategoriesEnvelopeSchema,
  DietaryPreferencesEnvelopeSchema,
  BodyMeasurementsEnvelopeSchema,
  ExercisesEnvelopeSchema,
  EntertainmentItemsEnvelopeSchema,
  EntertainmentSessionsEnvelopeSchema,
  HydrationRecordsEnvelopeSchema,
  LifeOverviewEnvelopeSchema,
  MealPlanEnvelopeSchema,
  MealRecordEnvelopeSchema,
  PersonalRecordsEnvelopeSchema,
  RecoveryRecordsEnvelopeSchema,
  WorkoutSessionsEnvelopeSchema,
  PurchaseRecordEnvelopeSchema,
  ShoppingItemEnvelopeSchema,
} from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M5 shopping and life overview API', () => {
  it('creates, updates and purchases an item in one accounting transaction', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock: new FixedClock(new Date('2026-08-12T04:00:00.000Z')),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data;
      const category = categories.find((item) => item.moduleType === 'SHOPPING');
      if (!category) throw new Error('缺少购物分类');
      const item = ShoppingItemEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/life/shopping/items',
            payload: {
              categoryId: category.id,
              name: '人体工学椅',
              quantity: 1,
              plannedUnitPriceMinor: 120000,
              priority: 'HIGH',
            },
          })
        ).json(),
      ).data;
      const updated = ShoppingItemEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/v1/life/shopping/items/${item.id}`,
            headers: { 'if-match': `"${String(item.version)}"` },
            payload: {
              expectedVersion: item.version,
              status: 'READY',
              purchaseChannel: '线下门店',
            },
          })
        ).json(),
      ).data;
      expect(updated.status).toBe('READY');
      const purchase = PurchaseRecordEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/life/shopping/items/${item.id}/purchase`,
            headers: { 'if-match': `"${String(updated.version)}"` },
            payload: {
              expectedVersion: updated.version,
              quantity: 1,
              unitPriceMinor: 109900,
              purchasedAt: '2026-08-12T05:00:00.000Z',
              channel: '线下门店',
            },
          })
        ).json(),
      ).data;
      expect(purchase).toMatchObject({ totalAmountMinor: 109900, plannedTotalMinor: 120000 });
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/life/budgets',
            payload: {
              moduleType: 'SHOPPING',
              periodType: 'MONTH',
              periodStart: '2026-08-01',
              periodEnd: '2026-08-31',
              amountMinor: 200000,
            },
          })
        ).statusCode,
      ).toBe(201);
      const overview = LifeOverviewEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/life/overview?range=MONTH' })).json(),
      ).data;
      expect(overview.shopping).toMatchObject({ pending: 0, purchased: 1, actualMinor: 109900 });
      expect(overview.budgets).toMatchObject({ totalMinor: 200000, usedPercent: 55 });
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
  it('completes a meal plan with nutrition, hydration, preference and dining expense', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({
      bootstrapPath: `${temporary.path}/bootstrap.json`,
      clock: new FixedClock(new Date('2026-08-12T04:00:00.000Z')),
    });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data;
      const category = categories.find((item) => item.moduleType === 'DIET');
      if (!category) throw new Error('缺少饮食分类');
      const recipeResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/life/diet/recipes',
        payload: {
          categoryId: category.id,
          name: '番茄鸡蛋面',
          servings: 1,
          caloriesKcal: 520,
          proteinG: 22,
        },
      });
      expect(recipeResponse.statusCode).toBe(201);
      const recipe = recipeResponse.json<{ data: { id: string } }>().data;
      const plan = MealPlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/life/diet/meal-plans',
            payload: {
              categoryId: category.id,
              mealDate: '2026-08-12',
              mealType: 'LUNCH',
              recipeId: recipe.id,
              title: '番茄鸡蛋面',
            },
          })
        ).json(),
      ).data;
      const mealResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/life/diet/meal-plans/${plan.id}/complete`,
        headers: { 'if-match': `"${String(plan.version)}"` },
        payload: {
          expectedVersion: plan.version,
          eatenAt: '2026-08-12T05:00:00.000Z',
          expenseAmountMinor: 2800,
          merchant: '街角小店',
        },
      });
      expect(mealResponse.statusCode, mealResponse.body).toBe(201);
      const meal = MealRecordEnvelopeSchema.parse(mealResponse.json()).data;
      expect(meal).toMatchObject({ caloriesKcal: 520, proteinG: 22 });
      expect(meal.expenseEntryId).toBeTypeOf('string');
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/life/diet/meal-plans/${plan.id}/complete`,
            headers: { 'if-match': `"${String(plan.version)}"` },
            payload: { expectedVersion: plan.version, eatenAt: '2026-08-12T05:00:00.000Z' },
          })
        ).statusCode,
      ).toBe(409);
      const hydration = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/life/diet/hydration',
          payload: { recordedAt: '2026-08-12T06:00:00.000Z', amountMl: 350 },
        })
      ).json<{ data: { id: string; version: number } }>().data;
      const preference = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/life/diet/preferences',
          payload: { preferenceType: 'ALLERGY', name: '花生', severity: '严重' },
        })
      ).json<{ data: { id: string; version: number } }>().data;
      const updatedMealResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/life/diet/meals/${meal.id}`,
        headers: { 'if-match': `"${String(meal.version)}"` },
        payload: {
          expectedVersion: meal.version,
          title: '番茄鸡蛋面（少盐）',
          caloriesKcal: null,
          sodiumMg: 430,
        },
      });
      expect(updatedMealResponse.statusCode, updatedMealResponse.body).toBe(200);
      const updatedMeal = MealRecordEnvelopeSchema.parse(updatedMealResponse.json()).data;
      expect(updatedMeal).toMatchObject({
        title: '番茄鸡蛋面（少盐）',
        caloriesKcal: null,
        sodiumMg: 430,
        proteinG: 22,
      });
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/v1/life/diet/meals/${meal.id}`,
            headers: { 'if-match': `"${String(meal.version)}"` },
            payload: { expectedVersion: meal.version, title: '陈旧修改' },
          })
        ).statusCode,
      ).toBe(409);
      const updatedHydration = await app.inject({
        method: 'PATCH',
        url: `/api/v1/life/diet/hydration/${hydration.id}`,
        headers: { 'if-match': `"${String(hydration.version)}"` },
        payload: { expectedVersion: hydration.version, amountMl: 500, note: '训练后' },
      });
      expect(updatedHydration.statusCode, updatedHydration.body).toBe(200);
      const updatedPreference = await app.inject({
        method: 'PATCH',
        url: `/api/v1/life/diet/preferences/${preference.id}`,
        headers: { 'if-match': `"${String(preference.version)}"` },
        payload: {
          expectedVersion: preference.version,
          severity: '中等',
          note: '避免接触',
          isActive: false,
        },
      });
      expect(updatedPreference.statusCode, updatedPreference.body).toBe(200);
      expect(
        HydrationRecordsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/life/diet/hydration' })).json(),
        ).data[0],
      ).toMatchObject({ amountMl: 500, note: '训练后' });
      expect(
        DietaryPreferencesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/life/diet/preferences' })).json(),
        ).data[0],
      ).toMatchObject({ name: '花生', severity: '中等', note: '避免接触', isActive: false });
      const overview = LifeOverviewEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/life/overview?range=MONTH' })).json(),
      ).data;
      expect(overview.diet).toEqual({
        meals: 1,
        caloriesKcal: 0,
        caloriesRecordedMeals: 0,
        nutritionMissingMeals: 1,
        hydrationMl: 500,
      });
      expect(overview.expenses.dietMinor).toBe(2800);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/life/diet/meals?from=2026-08-12&to=2026-08-12&mealType=LUNCH',
          })
        ).json<{ data: unknown[] }>().data,
      ).toHaveLength(1);
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/diet/meals?from=2026-08-13' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(0);
      expect(
        (
          await app.inject({ method: 'GET', url: '/api/v1/life/diet/hydration?to=2026-08-11' })
        ).json<{ data: unknown[] }>().data,
      ).toHaveLength(0);
      for (const record of [
        updatedMeal,
        updatedHydration.json<{ data: { id: string; version: number } }>().data,
        updatedPreference.json<{ data: { id: string; version: number } }>().data,
      ]) {
        const deleted = await app.inject({
          method: 'DELETE',
          url:
            record.id === updatedMeal.id
              ? `/api/v1/life/diet/meals/${record.id}`
              : record.id === hydration.id
                ? `/api/v1/life/diet/hydration/${record.id}`
                : `/api/v1/life/diet/preferences/${record.id}`,
          headers: { 'if-match': `"${String(record.version)}"` },
          payload: { expectedVersion: record.version },
        });
        expect(deleted.statusCode, deleted.body).toBe(204);
      }
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/diet/meals' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(0);
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/diet/hydration' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(0);
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/diet/preferences' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(0);
      const recycle = (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json<{
        data: { id: string; version: number; title: string }[];
      }>().data;
      expect(recycle.find((item) => item.id === updatedMeal.id)?.title).toBe('番茄鸡蛋面（少盐）');
      expect(recycle.find((item) => item.id === hydration.id)?.title).toBe('训练后');
      expect(recycle.find((item) => item.id === preference.id)?.title).toBe('花生');
      for (const record of [updatedMeal, hydration, preference]) {
        const deleted = recycle.find((item) => item.id === record.id);
        expect(deleted).toBeDefined();
        if (!deleted) continue;
        const restored = await app.inject({
          method: 'POST',
          url: `/api/v1/recycle-bin/${deleted.id}:restore`,
          payload: { expectedVersion: deleted.version },
        });
        expect(restored.statusCode, restored.body).toBe(200);
      }
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/diet/meals' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(1);
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/diet/hydration' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(1);
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/diet/preferences' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(1);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
  it('records a workout with sets, body metrics, personal record and recovery', async () => {
    const temporary = await createTestDataDirectory(),
      runtime = new LocalRuntime({
        bootstrapPath: `${temporary.path}/bootstrap.json`,
        clock: new FixedClock(new Date('2026-08-12T04:00:00.000Z')),
      }),
      app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
        ).data,
        category = categories.find((x) => x.moduleType === 'FITNESS');
      if (!category) throw new Error('缺少健身分类');
      const exerciseResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/life/fitness/exercises',
        payload: {
          name: '深蹲',
          exerciseType: 'STRENGTH',
          muscleGroups: ['腿部'],
          defaultUnit: 'kg',
        },
      });
      expect(exerciseResponse.statusCode).toBe(201);
      const exercise = exerciseResponse.json<{ data: { id: string; version: number } }>().data;
      const planResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/life/fitness/plans',
        payload: {
          categoryId: category.id,
          name: '下肢力量',
          status: 'ACTIVE',
          items: [
            {
              exerciseId: exercise.id,
              setsTarget: 3,
              repsTarget: '5',
              weightTarget: 80,
              durationSecondsTarget: null,
              distanceTarget: null,
              sortOrder: 0,
            },
          ],
        },
      });
      expect(planResponse.statusCode).toBe(201);
      const plan = planResponse.json<{ data: { id: string; version: number } }>().data;
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/fitness/plans' })).json<{
          data: { items: unknown[] }[];
        }>().data[0]?.items,
      ).toHaveLength(1);
      const updatedPlanResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/life/fitness/plans/${plan.id}`,
        headers: { 'if-match': `"${String(plan.version)}"` },
        payload: {
          expectedVersion: plan.version,
          name: '下肢力量进阶',
          description: '保持原有动作编排',
          status: 'PAUSED',
        },
      });
      expect(updatedPlanResponse.statusCode, updatedPlanResponse.body).toBe(200);
      expect(
        updatedPlanResponse.json<{
          data: { name: string; status: string; items: unknown[] };
        }>().data,
      ).toMatchObject({ name: '下肢力量进阶', status: 'PAUSED', items: [{}] });
      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/life/fitness/sessions',
        payload: {
          categoryId: category.id,
          workoutPlanId: plan.id,
          startedAt: '2026-08-12T10:00:00.000Z',
          endedAt: '2026-08-12T11:00:00.000Z',
          caloriesBurned: 420,
          perceivedEffort: 8,
          sets: [
            {
              exerciseId: exercise.id,
              setNumber: 1,
              reps: 5,
              weight: 80,
              durationSeconds: null,
              distance: null,
              completed: true,
            },
          ],
        },
      });
      expect(sessionResponse.statusCode, sessionResponse.body).toBe(201);
      const session = sessionResponse.json<{ data: { id: string; version: number } }>().data;
      const measurement = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/life/fitness/body-measurements',
          payload: {
            measuredAt: '2026-08-12T02:00:00.000Z',
            weightKg: 65.5,
            bodyFatPercent: 20,
            waistCm: 72,
          },
        })
      ).json<{ data: { id: string; version: number } }>().data;
      const personalRecord = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/life/fitness/personal-records',
          payload: {
            exerciseId: exercise.id,
            recordType: 'WEIGHT',
            value: 80,
            unit: 'kg',
            achievedAt: '2026-08-12T11:00:00.000Z',
          },
        })
      ).json<{ data: { id: string; version: number } }>().data;
      const recoveryRecord = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/life/fitness/recovery',
          payload: {
            recordedDate: '2026-08-12',
            recoveryLevel: 4,
            sorenessLevel: 2,
            energyLevel: 4,
          },
        })
      ).json<{ data: { id: string; version: number } }>().data;
      const updates = await Promise.all([
        app.inject({
          method: 'PATCH',
          url: `/api/v1/life/fitness/exercises/${exercise.id}`,
          headers: { 'if-match': `"${String(exercise.version)}"` },
          payload: {
            expectedVersion: exercise.version,
            name: '杠铃深蹲',
            instructions: '保持核心稳定',
          },
        }),
        app.inject({
          method: 'PATCH',
          url: `/api/v1/life/fitness/sessions/${session.id}`,
          headers: { 'if-match': `"${String(session.version)}"` },
          payload: {
            expectedVersion: session.version,
            endedAt: '2026-08-12T11:30:00.000Z',
            caloriesBurned: 500,
            note: '进阶训练',
          },
        }),
        app.inject({
          method: 'PATCH',
          url: `/api/v1/life/fitness/body-measurements/${measurement.id}`,
          headers: { 'if-match': `"${String(measurement.version)}"` },
          payload: {
            expectedVersion: measurement.version,
            weightKg: 65.1,
            chestCm: 88,
            note: '晨起',
          },
        }),
        app.inject({
          method: 'PATCH',
          url: `/api/v1/life/fitness/personal-records/${personalRecord.id}`,
          headers: { 'if-match': `"${String(personalRecord.version)}"` },
          payload: { expectedVersion: personalRecord.version, value: 85, unit: 'kg' },
        }),
        app.inject({
          method: 'PATCH',
          url: `/api/v1/life/fitness/recovery/${recoveryRecord.id}`,
          headers: { 'if-match': `"${String(recoveryRecord.version)}"` },
          payload: {
            expectedVersion: recoveryRecord.version,
            recoveryLevel: 5,
            energyLevel: 5,
            note: '状态良好',
          },
        }),
      ]);
      expect(updates.map((response) => response.statusCode)).toEqual([200, 200, 200, 200, 200]);
      const updated = updates.map(
        (response) => response.json<{ data: { id: string; version: number } }>().data,
      );
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/v1/life/fitness/exercises/${exercise.id}`,
            headers: { 'if-match': `"${String(exercise.version)}"` },
            payload: { expectedVersion: exercise.version, name: '陈旧动作名' },
          })
        ).statusCode,
      ).toBe(409);
      expect(
        ExercisesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/life/fitness/exercises' })).json(),
        ).data,
      ).toMatchObject([{ name: '杠铃深蹲', instructions: '保持核心稳定' }]);
      const sessions = WorkoutSessionsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/life/fitness/sessions' })).json(),
      ).data;
      expect(sessions[0]).toMatchObject({
        durationMinutes: 90,
        caloriesBurned: 500,
        note: '进阶训练',
        sets: [{ reps: 5, weight: 80 }],
      });
      expect(
        BodyMeasurementsEnvelopeSchema.parse(
          (
            await app.inject({ method: 'GET', url: '/api/v1/life/fitness/body-measurements' })
          ).json(),
        ).data[0]?.weightKg,
      ).toBe(65.1);
      expect(
        PersonalRecordsEnvelopeSchema.parse(
          (
            await app.inject({ method: 'GET', url: '/api/v1/life/fitness/personal-records' })
          ).json(),
        ).data,
      ).toMatchObject([{ value: 85, unit: 'kg' }]);
      expect(
        RecoveryRecordsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/life/fitness/recovery' })).json(),
        ).data[0]?.recoveryLevel,
      ).toBe(5);
      const overview = LifeOverviewEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/life/overview?range=MONTH' })).json(),
      ).data;
      expect(overview.fitness).toEqual({
        sessions: 1,
        durationMinutes: 90,
        caloriesBurned: 500,
        latestWeightKg: 65.1,
        recoveryLevel: 5,
      });
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/life/fitness/sessions?from=2026-08-12&to=2026-08-12',
          })
        ).json<{ data: unknown[] }>().data,
      ).toHaveLength(1);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/life/fitness/body-measurements?from=2026-08-13',
          })
        ).json<{ data: unknown[] }>().data,
      ).toHaveLength(0);
      const updatedPlan = updatedPlanResponse.json<{ data: { id: string; version: number } }>()
        .data;
      const deleteTargets = [
        ['/api/v1/life/fitness/exercises', updated[0]],
        ['/api/v1/life/fitness/plans', updatedPlan],
        ['/api/v1/life/fitness/sessions', updated[1]],
        ['/api/v1/life/fitness/body-measurements', updated[2]],
        ['/api/v1/life/fitness/personal-records', updated[3]],
        ['/api/v1/life/fitness/recovery', updated[4]],
      ] as const;
      for (const [path, record] of deleteTargets) {
        if (!record) throw new Error('健身更新结果缺失');
        const response = await app.inject({
          method: 'DELETE',
          url: `${path}/${record.id}`,
          headers: { 'if-match': `"${String(record.version)}"` },
          payload: { expectedVersion: record.version },
        });
        expect(response.statusCode, response.body).toBe(204);
      }
      const recycle = (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json<{
        data: { id: string; version: number; title: string }[];
      }>().data;
      expect(recycle.find((item) => item.id === updated[0]?.id)?.title).toBe('杠铃深蹲');
      expect(recycle.find((item) => item.id === updatedPlan.id)?.title).toBe('下肢力量进阶');
      expect(recycle.find((item) => item.id === updated[1]?.id)?.title).toBe('进阶训练');
      expect(recycle.find((item) => item.id === updated[2]?.id)?.title).toBe('晨起');
      expect(recycle.find((item) => item.id === updated[3]?.id)?.title).toBe('85.0 kg');
      expect(recycle.find((item) => item.id === updated[4]?.id)?.title).toBe('状态良好');
      for (const [, record] of deleteTargets) {
        if (!record) continue;
        const deleted = recycle.find((item) => item.id === record.id);
        expect(deleted).toBeDefined();
        if (deleted)
          expect(
            (
              await app.inject({
                method: 'POST',
                url: `/api/v1/recycle-bin/${deleted.id}:restore`,
                payload: { expectedVersion: deleted.version },
              })
            ).statusCode,
          ).toBe(200);
      }
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/fitness/exercises' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(1);
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/fitness/plans' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(1);
      expect(
        (await app.inject({ method: 'GET', url: '/api/v1/life/fitness/sessions' })).json<{
          data: unknown[];
        }>().data,
      ).toHaveLength(1);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
  it('tracks entertainment progress, trip details, time and repeated expenses', async () => {
    const temporary = await createTestDataDirectory(),
      runtime = new LocalRuntime({
        bootstrapPath: `${temporary.path}/bootstrap.json`,
        clock: new FixedClock(new Date('2026-08-12T04:00:00.000Z')),
      }),
      app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
        ).data,
        category = categories.find((x) => x.moduleType === 'ENTERTAINMENT');
      if (!category) throw new Error('缺少娱乐分类');
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/life/entertainment/items',
        payload: {
          categoryId: category.id,
          title: '城市艺术节',
          itemType: 'ACTIVITY',
          listType: 'WANT_TO_GO',
          progressTotal: 1,
          progressUnit: '次',
        },
      });
      expect(created.statusCode).toBe(201);
      const item = created.json<{ data: { id: string; version: number } }>().data;
      const trip = await app.inject({
        method: 'PUT',
        url: `/api/v1/life/entertainment/items/${item.id}/trip-details`,
        payload: {
          startAt: '2026-08-12T08:00:00.000Z',
          endAt: '2026-08-12T10:00:00.000Z',
          location: '城市美术馆',
        },
      });
      expect(trip.statusCode).toBe(200);
      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/life/entertainment/sessions',
        payload: {
          itemId: item.id,
          sessionDate: '2026-08-12',
          durationMinutes: 120,
          progressDelta: 1,
        },
      });
      expect(sessionResponse.statusCode, sessionResponse.body).toBe(201);
      const session = sessionResponse.json<{ data: { id: string; version: number } }>().data;
      const updated = EntertainmentItemsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/life/entertainment/items' })).json(),
      ).data[0];
      if (!updated) throw new Error('缺少娱乐条目');
      const progress = await app.inject({
        method: 'POST',
        url: `/api/v1/life/entertainment/items/${item.id}/set-progress`,
        headers: { 'if-match': `"${String(updated.version)}"` },
        payload: {
          expectedVersion: updated.version,
          progressCurrent: 1,
          status: 'COMPLETED',
          rating: 9,
        },
      });
      expect(progress.statusCode, progress.body).toBe(200);
      const progressed = progress.json<{ data: { version: number } }>().data;
      const itemUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/life/entertainment/items/${item.id}`,
        headers: { 'if-match': `"${String(progressed.version)}"` },
        payload: {
          expectedVersion: progressed.version,
          title: '城市艺术节·夜场',
          note: '记得提前入场',
          progressTotal: 2,
        },
      });
      expect(itemUpdate.statusCode, itemUpdate.body).toBe(200);
      const sessionUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/life/entertainment/sessions/${session.id}`,
        headers: { 'if-match': `"${String(session.version)}"` },
        payload: {
          expectedVersion: session.version,
          durationMinutes: 150,
          progressDelta: 2,
          note: '夜场观展',
        },
      });
      expect(sessionUpdate.statusCode, sessionUpdate.body).toBe(200);
      const updatedSession = sessionUpdate.json<{ data: { id: string; version: number } }>().data;
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/v1/life/entertainment/sessions/${session.id}`,
            headers: { 'if-match': `"${String(session.version)}"` },
            payload: { expectedVersion: session.version, durationMinutes: 30 },
          })
        ).statusCode,
      ).toBe(409);
      for (const amountMinor of [6800, 1200])
        expect(
          (
            await app.inject({
              method: 'POST',
              url: `/api/v1/life/entertainment/items/${item.id}/expense`,
              payload: { occurredAt: '2026-08-12T09:00:00.000Z', amountMinor, merchant: '艺术节' },
            })
          ).statusCode,
        ).toBe(201);
      const list = EntertainmentItemsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/life/entertainment/items' })).json(),
      ).data;
      expect(list[0]).toMatchObject({
        title: '城市艺术节·夜场',
        status: 'COMPLETED',
        progressCurrent: 2,
        progressTotal: 2,
        rating: 9,
        note: '记得提前入场',
        tripDetails: { location: '城市美术馆' },
      });
      expect(
        EntertainmentItemsEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'GET',
              url: '/api/v1/life/entertainment/items?itemType=ACTIVITY&listType=WANT_TO_GO&status=COMPLETED',
            })
          ).json(),
        ).data,
      ).toHaveLength(1);
      expect(
        EntertainmentItemsEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'GET',
              url: '/api/v1/life/entertainment/items?status=DROPPED',
            })
          ).json(),
        ).data,
      ).toHaveLength(0);
      expect(
        EntertainmentSessionsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/life/entertainment/sessions' })).json(),
        ).data[0],
      ).toMatchObject({ durationMinutes: 150, progressDelta: 2, note: '夜场观展' });
      const overview = LifeOverviewEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/life/overview?range=MONTH' })).json(),
      ).data;
      expect(overview.entertainment).toEqual({ items: 1, completed: 1, durationMinutes: 150 });
      expect(overview.expenses.entertainmentMinor).toBe(8000);
      const latestItem = list[0];
      if (!latestItem) throw new Error('缺少更新后的娱乐条目');
      for (const [path, record] of [
        ['/api/v1/life/entertainment/sessions', updatedSession],
        ['/api/v1/life/entertainment/items', latestItem],
      ] as const) {
        const response = await app.inject({
          method: 'DELETE',
          url: `${path}/${record.id}`,
          headers: { 'if-match': `"${String(record.version)}"` },
          payload: { expectedVersion: record.version },
        });
        expect(response.statusCode, response.body).toBe(204);
      }
      const recycle = (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json<{
        data: { id: string; version: number; title: string }[];
      }>().data;
      expect(recycle.find((x) => x.id === latestItem.id)?.title).toBe('城市艺术节·夜场');
      expect(recycle.find((x) => x.id === updatedSession.id)?.title).toBe('夜场观展');
      for (const record of [updatedSession, latestItem]) {
        const deleted = recycle.find((x) => x.id === record.id);
        expect(deleted).toBeDefined();
        if (!deleted) continue;
        expect(
          (
            await app.inject({
              method: 'POST',
              url: `/api/v1/recycle-bin/${deleted.id}:restore`,
              payload: { expectedVersion: deleted.version },
            })
          ).statusCode,
        ).toBe(200);
      }
      expect(
        EntertainmentItemsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/v1/life/entertainment/items' })).json(),
        ).data[0]?.title,
      ).toBe('城市艺术节·夜场');
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
});
