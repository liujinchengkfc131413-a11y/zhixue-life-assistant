import type { FastifyInstance, FastifyRequest } from 'fastify';

import * as C from '@life-assistant/contracts';
import { createUserOperationContext } from '@life-assistant/database';

import type { LocalRuntime } from './runtime-probe.js';

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});
const life = (runtime: LocalRuntime) => {
  if (!runtime.life) throw new Error('APP_NOT_INITIALIZED');
  return runtime.life;
};
const expectedVersion = (request: FastifyRequest, bodyVersion: number) => {
  const header = request.headers['if-match'];
  if (typeof header !== 'string') throw new Error('PRECONDITION_REQUIRED');
  const parsed = Number(header.replace(/^W\//, '').replaceAll('"', ''));
  if (parsed !== bodyVersion) throw new Error('VERSION_CONFLICT');
  return parsed;
};
const removeUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const range = (runtime: LocalRuntime, query: unknown) => {
  const parsed = C.LifeRangeQuerySchema.parse(query),
    shifted = new Date(runtime.clock.now().getTime() + 8 * 3_600_000);
  const today = shifted.toISOString().slice(0, 10);
  if (parsed.range === 'CUSTOM') {
    if (!parsed.from || !parsed.to || parsed.from > parsed.to)
      throw new Error('INVALID_DATE_RANGE');
    return { from: parsed.from, to: parsed.to };
  }
  const end = new Date(`${today}T00:00:00+08:00`),
    start = new Date(end);
  if (parsed.range === 'WEEK') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (parsed.range === 'MONTH') start.setDate(1);
  if (parsed.range === 'QUARTER') start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  if (parsed.range === 'YEAR') start.setMonth(0, 1);
  const from = new Date(start.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
  return { from, to: today };
};

export const registerM5Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  app.get(
    '/api/v1/life/overview',
    { schema: { response: { 200: C.LifeOverviewEnvelopeSchema } } },
    (request) => {
      const dates = range(runtime, request.query);
      return envelope(request, life(runtime).overview(dates.from, dates.to));
    },
  );
  app.get(
    '/api/v1/life/statistics',
    { schema: { response: { 200: C.LifeOverviewEnvelopeSchema } } },
    (request) => {
      const dates = range(runtime, request.query);
      return envelope(request, life(runtime).overview(dates.from, dates.to));
    },
  );
  app.get(
    '/api/v1/life/shopping/items',
    { schema: { response: { 200: C.ShoppingItemsEnvelopeSchema } } },
    (request) =>
      envelope(
        request,
        life(runtime).listShoppingItems(
          (
            request.query as {
              status?: Parameters<ReturnType<typeof life>['listShoppingItems']>[0];
            }
          ).status,
        ),
      ),
  );
  app.post(
    '/api/v1/life/shopping/items',
    {
      schema: { body: C.CreateShoppingItemSchema, response: { 201: C.ShoppingItemEnvelopeSchema } },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createShoppingItem(
              removeUndefined(C.CreateShoppingItemSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createShoppingItem']
              >[0],
              createUserOperationContext({ requestId: request.id }),
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/shopping/items/:id',
    {
      schema: { body: C.UpdateShoppingItemSchema, response: { 200: C.ShoppingItemEnvelopeSchema } },
    },
    (request) => {
      const body = C.UpdateShoppingItemSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateShoppingItem(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/shopping/items/:id',
    { schema: { body: C.UpdateShoppingItemSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateShoppingItemSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/life/shopping/items/:id/purchase',
    {
      schema: {
        body: C.PurchaseShoppingItemSchema,
        response: { 201: C.PurchaseRecordEnvelopeSchema },
      },
    },
    (request, reply) => {
      const body = C.PurchaseShoppingItemSchema.parse(request.body),
        { expectedVersion: version, ...input } = body;
      return reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).purchaseShoppingItem(
              (request.params as { id: string }).id,
              expectedVersion(request, version),
              removeUndefined(input) as Parameters<
                ReturnType<typeof life>['purchaseShoppingItem']
              >[2],
              createUserOperationContext({ requestId: request.id }),
            ),
          ),
        );
    },
  );
  app.get(
    '/api/v1/life/shopping/purchases',
    { schema: { response: { 200: C.PurchaseRecordsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { from?: string; to?: string };
      return envelope(request, life(runtime).listPurchases(query.from, query.to));
    },
  );
  app.get(
    '/api/v1/life/budgets',
    { schema: { response: { 200: C.BudgetsEnvelopeSchema } } },
    (request) => {
      const dates = range(runtime, request.query);
      return envelope(request, life(runtime).listBudgets(dates.from, dates.to));
    },
  );
  app.post(
    '/api/v1/life/budgets',
    { schema: { body: C.CreateBudgetSchema, response: { 201: C.BudgetEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createBudget(
              removeUndefined(C.CreateBudgetSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createBudget']
              >[0],
            ),
          ),
        ),
  );

  app.get(
    '/api/v1/life/diet/recipes',
    { schema: { response: { 200: C.RecipesEnvelopeSchema } } },
    (request) => envelope(request, life(runtime).listRecipes()),
  );
  app.post(
    '/api/v1/life/diet/recipes',
    { schema: { body: C.CreateRecipeSchema, response: { 201: C.RecipeEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createRecipe(
              removeUndefined(C.CreateRecipeSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createRecipe']
              >[0],
              createUserOperationContext({ requestId: request.id }),
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/diet/recipes/:id',
    { schema: { body: C.UpdateRecipeSchema, response: { 200: C.RecipeEnvelopeSchema } } },
    (request) => {
      const body = C.UpdateRecipeSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateRecipe(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/diet/recipes/:id',
    { schema: { body: C.UpdateRecipeSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateRecipeSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/diet/meal-plans',
    { schema: { response: { 200: C.MealPlansEnvelopeSchema } } },
    (request) => {
      const query = request.query as { from?: string; to?: string };
      return envelope(request, life(runtime).listMealPlans(query.from, query.to));
    },
  );
  app.post(
    '/api/v1/life/diet/meal-plans',
    { schema: { body: C.CreateMealPlanSchema, response: { 201: C.MealPlanEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createMealPlan(
              removeUndefined(C.CreateMealPlanSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createMealPlan']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/diet/meal-plans/:id',
    { schema: { body: C.UpdateMealPlanSchema, response: { 200: C.MealPlanEnvelopeSchema } } },
    (request) => {
      const body = C.UpdateMealPlanSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateMealPlan(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/diet/meal-plans/:id',
    { schema: { body: C.UpdateMealPlanSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateMealPlanSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/life/diet/meal-plans/:id/complete',
    { schema: { body: C.CompleteMealPlanSchema, response: { 201: C.MealRecordEnvelopeSchema } } },
    (request, reply) => {
      const body = C.CompleteMealPlanSchema.parse(request.body),
        { expectedVersion: version, ...input } = body;
      return reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).completeMealPlan(
              (request.params as { id: string }).id,
              expectedVersion(request, version),
              removeUndefined(input) as Parameters<ReturnType<typeof life>['completeMealPlan']>[2],
            ),
          ),
        );
    },
  );
  app.get(
    '/api/v1/life/diet/meals',
    {
      schema: {
        querystring: C.MealRecordFiltersSchema,
        response: { 200: C.MealRecordsEnvelopeSchema },
      },
    },
    (request) => {
      const query = C.MealRecordFiltersSchema.parse(request.query);
      return envelope(request, life(runtime).listMeals(query.from, query.to, query.mealType));
    },
  );
  app.post(
    '/api/v1/life/diet/meals',
    { schema: { body: C.CreateMealSchema, response: { 201: C.MealRecordEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createMeal(
              removeUndefined(C.CreateMealSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createMeal']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/diet/meals/:id',
    { schema: { body: C.UpdateMealSchema, response: { 200: C.MealRecordEnvelopeSchema } } },
    (request) => {
      const body = C.UpdateMealSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateMeal(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/diet/meals/:id',
    { schema: { body: C.UpdateMealSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateMealSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/diet/hydration',
    { schema: { response: { 200: C.HydrationRecordsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { from?: string; to?: string };
      return envelope(request, life(runtime).listHydration(query.from, query.to));
    },
  );
  app.post(
    '/api/v1/life/diet/hydration',
    {
      schema: { body: C.CreateHydrationSchema, response: { 201: C.HydrationRecordEnvelopeSchema } },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createHydration(
              removeUndefined(C.CreateHydrationSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createHydration']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/diet/hydration/:id',
    {
      schema: { body: C.UpdateHydrationSchema, response: { 200: C.HydrationRecordEnvelopeSchema } },
    },
    (request) => {
      const body = C.UpdateHydrationSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateHydration(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/diet/hydration/:id',
    { schema: { body: C.UpdateHydrationSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateHydrationSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/diet/preferences',
    { schema: { response: { 200: C.DietaryPreferencesEnvelopeSchema } } },
    (request) => envelope(request, life(runtime).listPreferences()),
  );
  app.post(
    '/api/v1/life/diet/preferences',
    {
      schema: {
        body: C.CreateDietaryPreferenceSchema,
        response: { 201: C.DietaryPreferenceEnvelopeSchema },
      },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createPreference(
              removeUndefined(C.CreateDietaryPreferenceSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createPreference']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/diet/preferences/:id',
    {
      schema: {
        body: C.UpdateDietaryPreferenceSchema,
        response: { 200: C.DietaryPreferenceEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.UpdateDietaryPreferenceSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updatePreference(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/diet/preferences/:id',
    { schema: { body: C.UpdateDietaryPreferenceSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateDietaryPreferenceSchema.pick({ expectedVersion: true }).parse(
        request.body,
      );
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/diet/nutrition-summary',
    { schema: { response: { 200: C.LifeOverviewEnvelopeSchema } } },
    (request) => {
      const dates = range(runtime, request.query);
      return envelope(request, life(runtime).overview(dates.from, dates.to));
    },
  );
  app.get(
    '/api/v1/life/fitness/exercises',
    { schema: { response: { 200: C.ExercisesEnvelopeSchema } } },
    (request) => envelope(request, life(runtime).listExercises()),
  );
  app.post(
    '/api/v1/life/fitness/exercises',
    { schema: { body: C.CreateExerciseSchema, response: { 201: C.ExerciseEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createExercise(
              removeUndefined(C.CreateExerciseSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createExercise']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/fitness/exercises/:id',
    { schema: { body: C.UpdateExerciseSchema, response: { 200: C.ExerciseEnvelopeSchema } } },
    (request) => {
      const body = C.UpdateExerciseSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateExercise(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/fitness/exercises/:id',
    { schema: { body: C.UpdateExerciseSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateExerciseSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/fitness/plans',
    { schema: { response: { 200: C.WorkoutPlansEnvelopeSchema } } },
    (request) => envelope(request, life(runtime).listWorkoutPlans()),
  );
  app.post(
    '/api/v1/life/fitness/plans',
    { schema: { body: C.CreateWorkoutPlanSchema, response: { 201: C.WorkoutPlanEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createWorkoutPlan(
              removeUndefined(C.CreateWorkoutPlanSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createWorkoutPlan']
              >[0],
              createUserOperationContext({ requestId: request.id }),
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/fitness/plans/:id',
    {
      schema: { body: C.UpdateWorkoutPlanSchema, response: { 200: C.WorkoutPlanEnvelopeSchema } },
    },
    (request) => {
      const body = C.UpdateWorkoutPlanSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateWorkoutPlan(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/fitness/plans/:id',
    { schema: { body: C.UpdateWorkoutPlanSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateWorkoutPlanSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/fitness/sessions',
    { schema: { response: { 200: C.WorkoutSessionsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { from?: string; to?: string };
      return envelope(request, life(runtime).listWorkoutSessions(query.from, query.to));
    },
  );
  app.post(
    '/api/v1/life/fitness/sessions',
    {
      schema: {
        body: C.CreateWorkoutSessionSchema,
        response: { 201: C.WorkoutSessionEnvelopeSchema },
      },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createWorkoutSession(
              removeUndefined(C.CreateWorkoutSessionSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createWorkoutSession']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/fitness/sessions/:id',
    {
      schema: {
        body: C.UpdateWorkoutSessionSchema,
        response: { 200: C.WorkoutSessionEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.UpdateWorkoutSessionSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateWorkoutSession(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/fitness/sessions/:id',
    { schema: { body: C.UpdateWorkoutSessionSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateWorkoutSessionSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/fitness/body-measurements',
    {
      schema: {
        querystring: C.DateRangeFilterSchema,
        response: { 200: C.BodyMeasurementsEnvelopeSchema },
      },
    },
    (request) => {
      const query = C.DateRangeFilterSchema.parse(request.query);
      return envelope(request, life(runtime).listBodyMeasurements(query.from, query.to));
    },
  );
  app.post(
    '/api/v1/life/fitness/body-measurements',
    {
      schema: {
        body: C.CreateBodyMeasurementSchema,
        response: { 201: C.BodyMeasurementEnvelopeSchema },
      },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createBodyMeasurement(
              removeUndefined(C.CreateBodyMeasurementSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createBodyMeasurement']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/fitness/body-measurements/:id',
    {
      schema: {
        body: C.UpdateBodyMeasurementSchema,
        response: { 200: C.BodyMeasurementEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.UpdateBodyMeasurementSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateBodyMeasurement(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/fitness/body-measurements/:id',
    { schema: { body: C.UpdateBodyMeasurementSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateBodyMeasurementSchema.pick({ expectedVersion: true }).parse(
        request.body,
      );
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/fitness/personal-records',
    { schema: { response: { 200: C.PersonalRecordsEnvelopeSchema } } },
    (request) => envelope(request, life(runtime).listPersonalRecords()),
  );
  app.post(
    '/api/v1/life/fitness/personal-records',
    {
      schema: {
        body: C.CreatePersonalRecordSchema,
        response: { 201: C.PersonalRecordEnvelopeSchema },
      },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createPersonalRecord(
              removeUndefined(C.CreatePersonalRecordSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createPersonalRecord']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/fitness/personal-records/:id',
    {
      schema: {
        body: C.UpdatePersonalRecordSchema,
        response: { 200: C.PersonalRecordEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.UpdatePersonalRecordSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updatePersonalRecord(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/fitness/personal-records/:id',
    { schema: { body: C.UpdatePersonalRecordSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdatePersonalRecordSchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/fitness/recovery',
    { schema: { response: { 200: C.RecoveryRecordsEnvelopeSchema } } },
    (request) => envelope(request, life(runtime).listRecovery()),
  );
  app.post(
    '/api/v1/life/fitness/recovery',
    { schema: { body: C.CreateRecoverySchema, response: { 201: C.RecoveryRecordEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createRecovery(
              removeUndefined(C.CreateRecoverySchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createRecovery']
              >[0],
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/fitness/recovery/:id',
    { schema: { body: C.UpdateRecoverySchema, response: { 200: C.RecoveryRecordEnvelopeSchema } } },
    (request) => {
      const body = C.UpdateRecoverySchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateRecovery(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/fitness/recovery/:id',
    { schema: { body: C.UpdateRecoverySchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateRecoverySchema.pick({ expectedVersion: true }).parse(request.body);
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/life/entertainment/items',
    {
      schema: {
        querystring: C.EntertainmentItemFiltersSchema,
        response: { 200: C.EntertainmentItemsEnvelopeSchema },
      },
    },
    (request) =>
      envelope(
        request,
        life(runtime).listEntertainmentItems(
          removeUndefined(C.EntertainmentItemFiltersSchema.parse(request.query)),
        ),
      ),
  );
  app.patch(
    '/api/v1/life/entertainment/items/:id',
    {
      schema: {
        body: C.UpdateEntertainmentItemSchema,
        response: { 200: C.EntertainmentItemEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.UpdateEntertainmentItemSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateEntertainmentItem(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/entertainment/items/:id',
    { schema: { body: C.UpdateEntertainmentItemSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateEntertainmentItemSchema.pick({ expectedVersion: true }).parse(
        request.body,
      );
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/life/entertainment/items',
    {
      schema: {
        body: C.CreateEntertainmentItemSchema,
        response: { 201: C.EntertainmentItemEnvelopeSchema },
      },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createEntertainmentItem(
              removeUndefined(C.CreateEntertainmentItemSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createEntertainmentItem']
              >[0],
              createUserOperationContext({ requestId: request.id }),
            ),
          ),
        ),
  );
  app.patch(
    '/api/v1/life/entertainment/sessions/:id',
    {
      schema: {
        body: C.UpdateEntertainmentSessionSchema,
        response: { 200: C.EntertainmentSessionEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.UpdateEntertainmentSessionSchema.parse(request.body),
        { expectedVersion: version, ...patch } = body;
      return envelope(
        request,
        life(runtime).updateEntertainmentSession(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/life/entertainment/sessions/:id',
    { schema: { body: C.UpdateEntertainmentSessionSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateEntertainmentSessionSchema.pick({ expectedVersion: true }).parse(
        request.body,
      );
      life(runtime).softDelete(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/life/entertainment/items/:id/set-progress',
    {
      schema: {
        body: C.SetEntertainmentProgressSchema,
        response: { 200: C.EntertainmentItemEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.SetEntertainmentProgressSchema.parse(request.body),
        { expectedVersion: version, ...input } = body;
      return envelope(
        request,
        life(runtime).setEntertainmentProgress(
          (request.params as { id: string }).id,
          expectedVersion(request, version),
          removeUndefined(input) as Parameters<
            ReturnType<typeof life>['setEntertainmentProgress']
          >[2],
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.get(
    '/api/v1/life/entertainment/sessions',
    { schema: { response: { 200: C.EntertainmentSessionsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { from?: string; to?: string };
      return envelope(request, life(runtime).listEntertainmentSessions(query.from, query.to));
    },
  );
  app.post(
    '/api/v1/life/entertainment/sessions',
    {
      schema: {
        body: C.CreateEntertainmentSessionSchema,
        response: { 201: C.EntertainmentSessionEnvelopeSchema },
      },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createEntertainmentSession(
              removeUndefined(C.CreateEntertainmentSessionSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createEntertainmentSession']
              >[0],
              createUserOperationContext({ requestId: request.id }),
            ),
          ),
        ),
  );
  app.put(
    '/api/v1/life/entertainment/items/:id/trip-details',
    {
      schema: {
        body: C.PutTripDetailsSchema,
        response: { 200: C.EntertainmentItemEnvelopeSchema },
      },
    },
    (request) =>
      envelope(
        request,
        life(runtime).putTripDetails(
          (request.params as { id: string }).id,
          removeUndefined(C.PutTripDetailsSchema.parse(request.body)) as Parameters<
            ReturnType<typeof life>['putTripDetails']
          >[1],
          createUserOperationContext({ requestId: request.id }),
        ),
      ),
  );
  app.post(
    '/api/v1/life/entertainment/items/:id/expense',
    {
      schema: {
        body: C.CreateEntertainmentExpenseSchema,
        response: { 201: C.EntertainmentItemEnvelopeSchema },
      },
    },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(
            request,
            life(runtime).createEntertainmentExpense(
              (request.params as { id: string }).id,
              removeUndefined(C.CreateEntertainmentExpenseSchema.parse(request.body)) as Parameters<
                ReturnType<typeof life>['createEntertainmentExpense']
              >[1],
            ),
          ),
        ),
  );
};
