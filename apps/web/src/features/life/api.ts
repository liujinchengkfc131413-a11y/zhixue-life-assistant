import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../../shared/api/client.js';

const lifeKey = ['life'] as const;
const data = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('本地服务没有返回数据。');
  return value;
};
const refresh = (client: ReturnType<typeof useQueryClient>) => async () => {
  await client.invalidateQueries({ queryKey: lifeKey });
};
export type LifeRange = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
export const useLifeOverview = (range: LifeRange, from?: string, to?: string) =>
  useQuery({
    queryKey: [...lifeKey, 'overview', range, from, to],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/life/overview', {
            params: { query: { range, ...(from ? { from } : {}), ...(to ? { to } : {}) } },
          })
        ).data,
      ).data,
  });
export const useShoppingItems = (status?: string) =>
  useQuery({
    queryKey: [...lifeKey, 'shopping', status],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/life/shopping/items', {
            params: { query: status ? { status: status as 'WANTED' } : {} },
          })
        ).data,
      ).data,
  });
export const usePurchases = () =>
  useQuery({
    queryKey: [...lifeKey, 'purchases'],
    queryFn: async () => data((await apiClient.GET('/api/v1/life/shopping/purchases')).data).data,
  });
export const useBudgets = () =>
  useQuery({
    queryKey: [...lifeKey, 'budgets'],
    queryFn: async () =>
      data(
        (await apiClient.GET('/api/v1/life/budgets', { params: { query: { range: 'YEAR' } } }))
          .data,
      ).data,
  });
export const useCreateShoppingItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      name: string;
      productCategory?: string;
      quantity: number;
      unit?: string;
      plannedUnitPriceMinor: number | null;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      purchaseChannel?: string;
    }) => data((await apiClient.POST('/api/v1/life/shopping/items', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateShoppingItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name: string;
      productCategory: string | null;
      quantity: number;
      unit: string | null;
      plannedUnitPriceMinor: number | null;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      status: 'WANTED' | 'RESEARCHING' | 'READY' | 'PURCHASED' | 'CANCELLED';
      purchaseChannel: string | null;
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/life/shopping/items/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              name: input.name,
              productCategory: input.productCategory,
              quantity: input.quantity,
              unit: input.unit,
              plannedUnitPriceMinor: input.plannedUnitPriceMinor,
              priority: input.priority,
              status: input.status,
              purchaseChannel: input.purchaseChannel,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteShoppingItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; version: number }) =>
      apiClient.DELETE('/api/v1/life/shopping/items/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      }),
    onSuccess: refresh(client),
  });
};
export const usePurchaseShoppingItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      quantity: number;
      unitPriceMinor: number;
      purchasedAt: string;
      channel: string | null;
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/life/shopping/items/{id}/purchase', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              quantity: input.quantity,
              unitPriceMinor: input.unitPriceMinor,
              purchasedAt: input.purchasedAt,
              channel: input.channel,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useCreateBudget = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      moduleType: 'SHOPPING';
      periodStart: string;
      periodEnd: string;
      amountMinor: number;
    }) =>
      data(
        (await apiClient.POST('/api/v1/life/budgets', { body: { ...input, periodType: 'MONTH' } }))
          .data,
      ).data,
    onSuccess: refresh(client),
  });
};

export const useRecipes = () =>
  useQuery({
    queryKey: [...lifeKey, 'recipes'],
    queryFn: async () => data((await apiClient.GET('/api/v1/life/diet/recipes')).data).data,
  });
export const useMealPlans = () =>
  useQuery({
    queryKey: [...lifeKey, 'meal-plans'],
    queryFn: async () => data((await apiClient.GET('/api/v1/life/diet/meal-plans')).data).data,
  });
export const useMeals = (
  filters: {
    from?: string;
    to?: string;
    mealType?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  } = {},
) =>
  useQuery({
    queryKey: [...lifeKey, 'meals', filters],
    queryFn: async () =>
      data((await apiClient.GET('/api/v1/life/diet/meals', { params: { query: filters } })).data)
        .data,
  });
export const useHydration = (filters: { from?: string; to?: string } = {}) =>
  useQuery({
    queryKey: [...lifeKey, 'hydration', filters],
    queryFn: async () =>
      data(
        (await apiClient.GET('/api/v1/life/diet/hydration', { params: { query: filters } })).data,
      ).data,
  });
export const useDietaryPreferences = () =>
  useQuery({
    queryKey: [...lifeKey, 'preferences'],
    queryFn: async () => data((await apiClient.GET('/api/v1/life/diet/preferences')).data).data,
  });
export const useCreateRecipe = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      name: string;
      servings: number;
      caloriesKcal: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
    }) => data((await apiClient.POST('/api/v1/life/diet/recipes', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateRecipe = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name: string;
      description: string | null;
      servings: number;
      caloriesKcal: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/diet/recipes/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
export const useCreateMealPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      mealDate: string;
      mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
      recipeId?: string;
      title: string;
    }) => data((await apiClient.POST('/api/v1/life/diet/meal-plans', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useCompleteMealPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      eatenAt: string;
      expenseAmountMinor: number | null;
      merchant: string | null;
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/life/diet/meal-plans/{id}/complete', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              eatenAt: input.eatenAt,
              expenseAmountMinor: input.expenseAmountMinor,
              merchant: input.merchant,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useCreateMeal = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
      title: string;
      eatenAt: string;
      caloriesKcal: number | null;
      expenseAmountMinor: number | null;
      merchant: string | null;
    }) => data((await apiClient.POST('/api/v1/life/diet/meals', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateMeal = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
      title: string;
      eatenAt: string;
      caloriesKcal: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
      fiberG: number | null;
      sodiumMg: number | null;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/diet/meals/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
const useDeleteDietRecord = (
  path:
    | '/api/v1/life/diet/meals/{id}'
    | '/api/v1/life/diet/hydration/{id}'
    | '/api/v1/life/diet/preferences/{id}',
) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; version: number }) =>
      apiClient.DELETE(path, {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      }),
    onSuccess: refresh(client),
  });
};
export const useDeleteMeal = () => useDeleteDietRecord('/api/v1/life/diet/meals/{id}');
export const useCreateHydration = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { recordedAt: string; amountMl: number; note?: string }) =>
      data((await apiClient.POST('/api/v1/life/diet/hydration', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateHydration = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      recordedAt: string;
      amountMl: number;
      note: string | null;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/diet/hydration/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
export const useDeleteHydration = () => useDeleteDietRecord('/api/v1/life/diet/hydration/{id}');
export const useCreateDietaryPreference = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      preferenceType: 'LIKE' | 'DISLIKE' | 'ALLERGY' | 'INTOLERANCE' | 'RESTRICTION';
      name: string;
      severity?: string;
    }) => data((await apiClient.POST('/api/v1/life/diet/preferences', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateDietaryPreference = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      preferenceType: 'LIKE' | 'DISLIKE' | 'ALLERGY' | 'INTOLERANCE' | 'RESTRICTION';
      name: string;
      severity: string | null;
      note: string | null;
      isActive: boolean;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/diet/preferences/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
export const useDeleteDietaryPreference = () =>
  useDeleteDietRecord('/api/v1/life/diet/preferences/{id}');
export const useExercises = () =>
  useQuery({
    queryKey: [...lifeKey, 'exercises'],
    queryFn: async () => data((await apiClient.GET('/api/v1/life/fitness/exercises')).data).data,
  });
export const useWorkoutPlans = () =>
  useQuery({
    queryKey: [...lifeKey, 'workout-plans'],
    queryFn: async () => data((await apiClient.GET('/api/v1/life/fitness/plans')).data).data,
  });
export const useWorkoutSessions = (filters: { from?: string; to?: string } = {}) =>
  useQuery({
    queryKey: [...lifeKey, 'workout-sessions', filters],
    queryFn: async () =>
      data(
        (await apiClient.GET('/api/v1/life/fitness/sessions', { params: { query: filters } })).data,
      ).data,
  });
export const useBodyMeasurements = (filters: { from?: string; to?: string } = {}) =>
  useQuery({
    queryKey: [...lifeKey, 'body-measurements', filters],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/life/fitness/body-measurements', {
            params: { query: filters },
          })
        ).data,
      ).data,
  });
export const usePersonalRecords = () =>
  useQuery({
    queryKey: [...lifeKey, 'personal-records'],
    queryFn: async () =>
      data((await apiClient.GET('/api/v1/life/fitness/personal-records')).data).data,
  });
export const useRecovery = () =>
  useQuery({
    queryKey: [...lifeKey, 'recovery'],
    queryFn: async () => data((await apiClient.GET('/api/v1/life/fitness/recovery')).data).data,
  });
export const useCreateExercise = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      exerciseType: 'STRENGTH' | 'CARDIO' | 'MOBILITY' | 'SPORT' | 'OTHER';
      muscleGroups: string[];
      defaultUnit: string | null;
    }) => data((await apiClient.POST('/api/v1/life/fitness/exercises', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateExercise = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name: string;
      exerciseType: 'STRENGTH' | 'CARDIO' | 'MOBILITY' | 'SPORT' | 'OTHER';
      muscleGroups: string[];
      defaultUnit: string | null;
      instructions: string | null;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/fitness/exercises/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
const useDeleteFitnessRecord = (
  path:
    | '/api/v1/life/fitness/exercises/{id}'
    | '/api/v1/life/fitness/plans/{id}'
    | '/api/v1/life/fitness/sessions/{id}'
    | '/api/v1/life/fitness/body-measurements/{id}'
    | '/api/v1/life/fitness/personal-records/{id}'
    | '/api/v1/life/fitness/recovery/{id}',
) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; version: number }) =>
      apiClient.DELETE(path, {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      }),
    onSuccess: refresh(client),
  });
};
export const useDeleteExercise = () =>
  useDeleteFitnessRecord('/api/v1/life/fitness/exercises/{id}');
export const useCreateWorkoutPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      name: string;
      description?: string;
      status: 'ACTIVE';
      items: {
        exerciseId: string;
        setsTarget: number | null;
        repsTarget: string | null;
        weightTarget: number | null;
        durationSecondsTarget: number | null;
        distanceTarget: number | null;
        sortOrder: number;
      }[];
    }) => data((await apiClient.POST('/api/v1/life/fitness/plans', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateWorkoutPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name: string;
      description: string | null;
      status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/life/fitness/plans/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              name: input.name,
              description: input.description,
              status: input.status,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteWorkoutPlan = () => useDeleteFitnessRecord('/api/v1/life/fitness/plans/{id}');
export const useCreateWorkoutSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      workoutPlanId: string | null;
      startedAt: string;
      endedAt: string;
      caloriesBurned: number | null;
      perceivedEffort: number | null;
      note: string | null;
      sets: {
        exerciseId: string;
        setNumber: number;
        reps: number | null;
        weight: number | null;
        durationSeconds: number | null;
        distance: number | null;
        completed: boolean;
      }[];
    }) => data((await apiClient.POST('/api/v1/life/fitness/sessions', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateWorkoutSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      workoutPlanId: string | null;
      startedAt: string;
      endedAt: string;
      caloriesBurned: number | null;
      perceivedEffort: number | null;
      note: string | null;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/fitness/sessions/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
export const useDeleteWorkoutSession = () =>
  useDeleteFitnessRecord('/api/v1/life/fitness/sessions/{id}');
export const useCreateBodyMeasurement = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      measuredAt: string;
      weightKg: number | null;
      bodyFatPercent: number | null;
      waistCm: number | null;
    }) =>
      data((await apiClient.POST('/api/v1/life/fitness/body-measurements', { body: input })).data)
        .data,
    onSuccess: refresh(client),
  });
};
export const useUpdateBodyMeasurement = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      measuredAt: string;
      weightKg: number | null;
      bodyFatPercent: number | null;
      waistCm: number | null;
      chestCm: number | null;
      hipCm: number | null;
      note: string | null;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/fitness/body-measurements/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
export const useDeleteBodyMeasurement = () =>
  useDeleteFitnessRecord('/api/v1/life/fitness/body-measurements/{id}');
export const useCreatePersonalRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      exerciseId: string | null;
      recordType: 'WEIGHT' | 'REPS' | 'DURATION' | 'DISTANCE' | 'SPEED' | 'OTHER';
      value: number;
      unit: string;
      achievedAt: string;
    }) =>
      data((await apiClient.POST('/api/v1/life/fitness/personal-records', { body: input })).data)
        .data,
    onSuccess: refresh(client),
  });
};
export const useUpdatePersonalRecord = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      exerciseId: string | null;
      recordType: 'WEIGHT' | 'REPS' | 'DURATION' | 'DISTANCE' | 'SPEED' | 'OTHER';
      value: number;
      unit: string;
      achievedAt: string;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/fitness/personal-records/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
export const useDeletePersonalRecord = () =>
  useDeleteFitnessRecord('/api/v1/life/fitness/personal-records/{id}');
export const useCreateRecovery = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recordedDate: string;
      recoveryLevel: number;
      sorenessLevel: number | null;
      energyLevel: number | null;
      note: string | null;
    }) => data((await apiClient.POST('/api/v1/life/fitness/recovery', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateRecovery = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      recordedDate: string;
      recoveryLevel: number;
      sorenessLevel: number | null;
      energyLevel: number | null;
      note: string | null;
    }) => {
      const { id, version, ...patch } = input;
      return data(
        (
          await apiClient.PATCH('/api/v1/life/fitness/recovery/{id}', {
            params: { path: { id } },
            headers: { 'If-Match': `"${String(version)}"` },
            body: { expectedVersion: version, ...patch },
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};
export const useDeleteRecovery = () => useDeleteFitnessRecord('/api/v1/life/fitness/recovery/{id}');
export const useEntertainmentItems = (
  filters: {
    itemType?: 'MOVIE' | 'SERIES' | 'BOOK' | 'COMIC' | 'GAME' | 'ACTIVITY' | 'TRIP' | 'OTHER';
    listType?: 'WANT_TO_WATCH' | 'WANT_TO_PLAY' | 'WANT_TO_GO' | 'OTHER';
    status?: 'WISHLIST' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED';
  } = {},
) =>
  useQuery({
    queryKey: [...lifeKey, 'entertainment-items', filters],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/life/entertainment/items', {
            params: { query: filters },
          })
        ).data,
      ).data,
  });
export const useEntertainmentSessions = () =>
  useQuery({
    queryKey: [...lifeKey, 'entertainment-sessions'],
    queryFn: async () =>
      data((await apiClient.GET('/api/v1/life/entertainment/sessions')).data).data,
  });
export const useCreateEntertainmentItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      title: string;
      itemType: 'MOVIE' | 'SERIES' | 'BOOK' | 'COMIC' | 'GAME' | 'ACTIVITY' | 'TRIP' | 'OTHER';
      listType: 'WANT_TO_WATCH' | 'WANT_TO_PLAY' | 'WANT_TO_GO' | 'OTHER';
      progressTotal: number | null;
      progressUnit: string | null;
      note: string | null;
    }) =>
      data((await apiClient.POST('/api/v1/life/entertainment/items', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateEntertainmentItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      itemType: 'MOVIE' | 'SERIES' | 'BOOK' | 'COMIC' | 'GAME' | 'ACTIVITY' | 'TRIP' | 'OTHER';
      listType: 'WANT_TO_WATCH' | 'WANT_TO_PLAY' | 'WANT_TO_GO' | 'OTHER';
      status: 'WISHLIST' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED';
      progressTotal: number | null;
      progressUnit: string | null;
      note: string | null;
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/life/entertainment/items/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: { ...input, expectedVersion: input.version },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteEntertainmentItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) =>
      apiClient.DELETE('/api/v1/life/entertainment/items/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      }),
    onSuccess: refresh(client),
  });
};
export const useSetEntertainmentProgress = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      progressCurrent: number;
      status: 'WISHLIST' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED';
      rating: number | null;
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/life/entertainment/items/{id}/set-progress', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              progressCurrent: input.progressCurrent,
              status: input.status,
              rating: input.rating,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useCreateEntertainmentSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      itemId: string;
      sessionDate: string;
      durationMinutes: number;
      progressDelta: number | null;
      note: string | null;
    }) =>
      data((await apiClient.POST('/api/v1/life/entertainment/sessions', { body: input })).data)
        .data,
    onSuccess: refresh(client),
  });
};
export const useUpdateEntertainmentSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      sessionDate: string;
      durationMinutes: number;
      progressDelta: number | null;
      note: string | null;
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/life/entertainment/sessions/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: { ...input, expectedVersion: input.version },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteEntertainmentSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) =>
      apiClient.DELETE('/api/v1/life/entertainment/sessions/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      }),
    onSuccess: refresh(client),
  });
};
export const usePutTripDetails = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      startAt: string | null;
      endAt: string | null;
      location: string | null;
      eventId: string | null;
      taskId: string | null;
    }) =>
      data(
        (
          await apiClient.PUT('/api/v1/life/entertainment/items/{id}/trip-details', {
            params: { path: { id: input.id } },
            body: {
              startAt: input.startAt,
              endAt: input.endAt,
              location: input.location,
              eventId: input.eventId,
              taskId: input.taskId,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useCreateEntertainmentExpense = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      occurredAt: string;
      amountMinor: number;
      merchant: string | null;
      note: string | null;
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/life/entertainment/items/{id}/expense', {
            params: { path: { id: input.id } },
            body: {
              occurredAt: input.occurredAt,
              amountMinor: input.amountMinor,
              merchant: input.merchant,
              note: input.note,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
