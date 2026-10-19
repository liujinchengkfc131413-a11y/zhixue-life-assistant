import { z } from 'zod';

import { RequestMetaSchema } from './m1.js';

const EntitySchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ data: schema, meta: RequestMetaSchema });
export const ShoppingPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const ShoppingStatusSchema = z.enum([
  'WANTED',
  'RESEARCHING',
  'READY',
  'PURCHASED',
  'CANCELLED',
]);
export const ShoppingItemSchema = EntitySchema.extend({
  categoryId: z.string(),
  name: z.string(),
  productCategory: z.string().nullable(),
  quantity: z.number().positive(),
  unit: z.string().nullable(),
  plannedUnitPriceMinor: z.number().int().nonnegative().nullable(),
  budgetAmountMinor: z.number().int().nonnegative().nullable(),
  priority: ShoppingPrioritySchema,
  status: ShoppingStatusSchema,
  purchaseChannel: z.string().nullable(),
  taskId: z.string().nullable(),
});
export const CreateShoppingItemSchema = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(200),
  productCategory: z.string().max(100).nullable().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(40).nullable().optional(),
  plannedUnitPriceMinor: z.number().int().nonnegative().nullable().optional(),
  budgetAmountMinor: z.number().int().nonnegative().nullable().optional(),
  priority: ShoppingPrioritySchema.optional(),
  status: ShoppingStatusSchema.optional(),
  purchaseChannel: z.string().max(100).nullable().optional(),
  taskId: z.string().nullable().optional(),
});
export const UpdateShoppingItemSchema = CreateShoppingItemSchema.omit({ categoryId: true })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const PurchaseShoppingItemSchema = z.object({
  expectedVersion: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  purchasedAt: z.iso.datetime(),
  channel: z.string().max(100).nullable().optional(),
});
export const PurchaseRecordSchema = EntitySchema.extend({
  shoppingItemId: z.string().nullable(),
  categoryId: z.string(),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  totalAmountMinor: z.number().int().nonnegative(),
  plannedTotalMinor: z.number().int().nonnegative().nullable(),
  purchasedAt: z.iso.datetime(),
  channel: z.string().nullable(),
  expenseEntryId: z.string(),
});
export const BudgetSchema = EntitySchema.extend({
  categoryId: z.string().nullable(),
  moduleType: z.enum(['SHOPPING', 'DIET', 'ENTERTAINMENT']).nullable(),
  periodType: z.enum(['MONTH', 'QUARTER', 'YEAR', 'CUSTOM']),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string(),
  alertThresholdPercent: z.number().positive().max(100),
});
export const CreateBudgetSchema = z.object({
  categoryId: z.string().nullable().optional(),
  moduleType: z.enum(['SHOPPING', 'DIET', 'ENTERTAINMENT']).nullable().optional(),
  periodType: z.enum(['MONTH', 'QUARTER', 'YEAR', 'CUSTOM']),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  amountMinor: z.number().int().nonnegative(),
  alertThresholdPercent: z.number().positive().max(100).optional(),
});
export const LifeRangeQuerySchema = z.object({
  range: z.enum(['WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM']).default('MONTH'),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export const LifeOverviewSchema = z.object({
  range: z.object({ from: z.iso.date(), to: z.iso.date() }),
  expenses: z.object({
    totalMinor: z.number().int(),
    shoppingMinor: z.number().int(),
    dietMinor: z.number().int(),
    entertainmentMinor: z.number().int(),
  }),
  budgets: z.object({ totalMinor: z.number().int(), usedPercent: z.number() }),
  shopping: z.object({
    pending: z.number().int(),
    purchased: z.number().int(),
    plannedMinor: z.number().int(),
    actualMinor: z.number().int(),
  }),
  diet: z.object({
    meals: z.number().int(),
    caloriesKcal: z.number(),
    caloriesRecordedMeals: z.number().int(),
    nutritionMissingMeals: z.number().int(),
    hydrationMl: z.number().int(),
  }),
  fitness: z.object({
    sessions: z.number().int(),
    durationMinutes: z.number().int(),
    caloriesBurned: z.number(),
    latestWeightKg: z.number().nullable(),
    recoveryLevel: z.number().int().nullable(),
  }),
  entertainment: z.object({
    items: z.number().int(),
    completed: z.number().int(),
    durationMinutes: z.number().int(),
  }),
});
export const MealTypeSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']);
export const RecipeSchema = EntitySchema.extend({
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  servings: z.number().positive(),
  caloriesKcal: z.number().nonnegative().nullable(),
  proteinG: z.number().nonnegative().nullable(),
  carbsG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
});
export const CreateRecipeSchema = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(200),
  description: z.string().nullable().optional(),
  servings: z.number().positive().optional(),
  caloriesKcal: z.number().nonnegative().nullable().optional(),
  proteinG: z.number().nonnegative().nullable().optional(),
  carbsG: z.number().nonnegative().nullable().optional(),
  fatG: z.number().nonnegative().nullable().optional(),
});
export const UpdateRecipeSchema = CreateRecipeSchema.omit({ categoryId: true })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const MealPlanSchema = EntitySchema.extend({
  categoryId: z.string(),
  mealDate: z.iso.date(),
  mealType: MealTypeSchema,
  plannedAt: z.iso.datetime().nullable(),
  recipeId: z.string().nullable(),
  title: z.string(),
  eventId: z.string().nullable(),
  taskId: z.string().nullable(),
  status: z.enum(['PLANNED', 'COMPLETED', 'SKIPPED']),
});
export const CreateMealPlanSchema = z.object({
  categoryId: z.string(),
  mealDate: z.iso.date(),
  mealType: MealTypeSchema,
  plannedAt: z.iso.datetime().nullable().optional(),
  recipeId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  eventId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
});
export const UpdateMealPlanSchema = CreateMealPlanSchema.omit({ categoryId: true })
  .partial()
  .extend({
    expectedVersion: z.number().int().positive(),
    status: z.enum(['PLANNED', 'COMPLETED', 'SKIPPED']).optional(),
  });
const NutritionSchema = z.object({
  caloriesKcal: z.number().nonnegative().nullable().optional(),
  proteinG: z.number().nonnegative().nullable().optional(),
  carbsG: z.number().nonnegative().nullable().optional(),
  fatG: z.number().nonnegative().nullable().optional(),
});
export const CompleteMealPlanSchema = NutritionSchema.extend({
  expectedVersion: z.number().int().positive(),
  eatenAt: z.iso.datetime(),
  expenseAmountMinor: z.number().int().nonnegative().nullable().optional(),
  merchant: z.string().nullable().optional(),
});
export const MealRecordSchema = EntitySchema.extend({
  categoryId: z.string(),
  mealPlanId: z.string().nullable(),
  mealType: MealTypeSchema,
  title: z.string(),
  eatenAt: z.iso.datetime(),
  caloriesKcal: z.number().nonnegative().nullable(),
  proteinG: z.number().nonnegative().nullable(),
  carbsG: z.number().nonnegative().nullable(),
  fatG: z.number().nonnegative().nullable(),
  fiberG: z.number().nonnegative().nullable(),
  sodiumMg: z.number().nonnegative().nullable(),
  otherNutrition: z.record(z.string(), z.unknown()),
  expenseEntryId: z.string().nullable(),
});
export const CreateMealSchema = NutritionSchema.extend({
  categoryId: z.string(),
  mealPlanId: z.string().nullable().optional(),
  mealType: MealTypeSchema,
  title: z.string().trim().min(1).max(200),
  eatenAt: z.iso.datetime(),
  fiberG: z.number().nonnegative().nullable().optional(),
  sodiumMg: z.number().nonnegative().nullable().optional(),
  otherNutrition: z.record(z.string(), z.unknown()).optional(),
  expenseAmountMinor: z.number().int().nonnegative().nullable().optional(),
  merchant: z.string().nullable().optional(),
});
export const UpdateMealSchema = NutritionSchema.extend({
  expectedVersion: z.number().int().positive(),
  mealType: MealTypeSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  eatenAt: z.iso.datetime().optional(),
  fiberG: z.number().nonnegative().nullable().optional(),
  sodiumMg: z.number().nonnegative().nullable().optional(),
  otherNutrition: z.record(z.string(), z.unknown()).optional(),
});
export const HydrationRecordSchema = EntitySchema.extend({
  recordedAt: z.iso.datetime(),
  amountMl: z.number().int().positive(),
  note: z.string().nullable(),
});
export const CreateHydrationSchema = z.object({
  recordedAt: z.iso.datetime(),
  amountMl: z.number().int().positive(),
  note: z.string().nullable().optional(),
});
export const UpdateHydrationSchema = CreateHydrationSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const DietaryPreferenceSchema = EntitySchema.extend({
  preferenceType: z.enum(['LIKE', 'DISLIKE', 'ALLERGY', 'INTOLERANCE', 'RESTRICTION']),
  name: z.string(),
  severity: z.string().nullable(),
  note: z.string().nullable(),
  isActive: z.boolean(),
});
export const CreateDietaryPreferenceSchema = z.object({
  preferenceType: z.enum(['LIKE', 'DISLIKE', 'ALLERGY', 'INTOLERANCE', 'RESTRICTION']),
  name: z.string().trim().min(1).max(200),
  severity: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const UpdateDietaryPreferenceSchema = CreateDietaryPreferenceSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
  isActive: z.boolean().optional(),
});
export const ExerciseTypeSchema = z.enum(['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT', 'OTHER']);
export const ExerciseSchema = EntitySchema.extend({
  name: z.string(),
  exerciseType: ExerciseTypeSchema,
  muscleGroups: z.array(z.string()),
  defaultUnit: z.string().nullable(),
  instructions: z.string().nullable(),
});
export const CreateExerciseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  exerciseType: ExerciseTypeSchema,
  muscleGroups: z.array(z.string()).optional(),
  defaultUnit: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
});
export const UpdateExerciseSchema = CreateExerciseSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const WorkoutPlanSchema = EntitySchema.extend({
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  goalId: z.string().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']),
  items: z.array(
    z.object({
      id: z.string(),
      exerciseId: z.string(),
      setsTarget: z.number().int().nullable(),
      repsTarget: z.string().nullable(),
      weightTarget: z.number().nullable(),
      durationSecondsTarget: z.number().int().nullable(),
      distanceTarget: z.number().nullable(),
      sortOrder: z.number().int(),
    }),
  ),
});
export const CreateWorkoutPlanSchema = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(200),
  description: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  items: z
    .array(
      z.object({
        exerciseId: z.string(),
        setsTarget: z.number().int().positive().nullable(),
        repsTarget: z.string().nullable(),
        weightTarget: z.number().nonnegative().nullable(),
        durationSecondsTarget: z.number().int().nonnegative().nullable(),
        distanceTarget: z.number().nonnegative().nullable(),
        sortOrder: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});
export const UpdateWorkoutPlanSchema = CreateWorkoutPlanSchema.omit({ categoryId: true })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const WorkoutSetSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().nullable(),
  weight: z.number().nullable(),
  durationSeconds: z.number().int().nullable(),
  distance: z.number().nullable(),
  completed: z.boolean(),
});
const CreateWorkoutSetSchema = WorkoutSetSchema.omit({ id: true });
export const WorkoutSessionSchema = EntitySchema.extend({
  categoryId: z.string(),
  workoutPlanId: z.string().nullable(),
  taskId: z.string().nullable(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  durationMinutes: z.number().int().nonnegative(),
  caloriesBurned: z.number().nonnegative().nullable(),
  perceivedEffort: z.number().int().min(1).max(10).nullable(),
  note: z.string().nullable(),
  sets: z.array(WorkoutSetSchema),
});
export const CreateWorkoutSessionSchema = z.object({
  categoryId: z.string(),
  workoutPlanId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  caloriesBurned: z.number().nonnegative().nullable().optional(),
  perceivedEffort: z.number().int().min(1).max(10).nullable().optional(),
  note: z.string().nullable().optional(),
  sets: z.array(CreateWorkoutSetSchema).optional(),
});
export const UpdateWorkoutSessionSchema = CreateWorkoutSessionSchema.omit({ categoryId: true })
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const BodyMeasurementSchema = EntitySchema.extend({
  measuredAt: z.iso.datetime(),
  weightKg: z.number().positive().nullable(),
  bodyFatPercent: z.number().nonnegative().nullable(),
  waistCm: z.number().positive().nullable(),
  chestCm: z.number().positive().nullable(),
  hipCm: z.number().positive().nullable(),
  note: z.string().nullable(),
});
export const CreateBodyMeasurementSchema = z.object({
  measuredAt: z.iso.datetime(),
  weightKg: z.number().positive().nullable().optional(),
  bodyFatPercent: z.number().nonnegative().nullable().optional(),
  waistCm: z.number().positive().nullable().optional(),
  chestCm: z.number().positive().nullable().optional(),
  hipCm: z.number().positive().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const UpdateBodyMeasurementSchema = CreateBodyMeasurementSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const PersonalRecordSchema = EntitySchema.extend({
  exerciseId: z.string().nullable(),
  recordType: z.enum(['WEIGHT', 'REPS', 'DURATION', 'DISTANCE', 'SPEED', 'OTHER']),
  value: z.number(),
  unit: z.string(),
  achievedAt: z.iso.datetime(),
  workoutSessionId: z.string().nullable(),
});
export const CreatePersonalRecordSchema = z.object({
  exerciseId: z.string().nullable().optional(),
  recordType: z.enum(['WEIGHT', 'REPS', 'DURATION', 'DISTANCE', 'SPEED', 'OTHER']),
  value: z.number(),
  unit: z.string().trim().min(1),
  achievedAt: z.iso.datetime(),
  workoutSessionId: z.string().nullable().optional(),
});
export const UpdatePersonalRecordSchema = CreatePersonalRecordSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const RecoveryRecordSchema = EntitySchema.extend({
  recordedDate: z.iso.date(),
  recoveryLevel: z.number().int().min(1).max(5),
  sorenessLevel: z.number().int().min(1).max(5).nullable(),
  energyLevel: z.number().int().min(1).max(5).nullable(),
  note: z.string().nullable(),
});
export const CreateRecoverySchema = z.object({
  recordedDate: z.iso.date(),
  recoveryLevel: z.number().int().min(1).max(5),
  sorenessLevel: z.number().int().min(1).max(5).nullable().optional(),
  energyLevel: z.number().int().min(1).max(5).nullable().optional(),
  note: z.string().nullable().optional(),
});
export const UpdateRecoverySchema = CreateRecoverySchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const ShoppingItemEnvelopeSchema = envelope(ShoppingItemSchema);
export const ShoppingItemsEnvelopeSchema = envelope(z.array(ShoppingItemSchema));
export const PurchaseRecordEnvelopeSchema = envelope(PurchaseRecordSchema);
export const PurchaseRecordsEnvelopeSchema = envelope(z.array(PurchaseRecordSchema));
export const BudgetEnvelopeSchema = envelope(BudgetSchema);
export const BudgetsEnvelopeSchema = envelope(z.array(BudgetSchema));
export const LifeOverviewEnvelopeSchema = envelope(LifeOverviewSchema);
export const RecipeEnvelopeSchema = envelope(RecipeSchema);
export const RecipesEnvelopeSchema = envelope(z.array(RecipeSchema));
export const MealPlanEnvelopeSchema = envelope(MealPlanSchema);
export const MealPlansEnvelopeSchema = envelope(z.array(MealPlanSchema));
export const MealRecordEnvelopeSchema = envelope(MealRecordSchema);
export const MealRecordsEnvelopeSchema = envelope(z.array(MealRecordSchema));
export const MealRecordFiltersSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  mealType: MealTypeSchema.optional(),
});
export const HydrationRecordEnvelopeSchema = envelope(HydrationRecordSchema);
export const HydrationRecordsEnvelopeSchema = envelope(z.array(HydrationRecordSchema));
export const DietaryPreferenceEnvelopeSchema = envelope(DietaryPreferenceSchema);
export const DietaryPreferencesEnvelopeSchema = envelope(z.array(DietaryPreferenceSchema));
export const ExerciseEnvelopeSchema = envelope(ExerciseSchema);
export const ExercisesEnvelopeSchema = envelope(z.array(ExerciseSchema));
export const WorkoutPlanEnvelopeSchema = envelope(WorkoutPlanSchema);
export const WorkoutPlansEnvelopeSchema = envelope(z.array(WorkoutPlanSchema));
export const WorkoutSessionEnvelopeSchema = envelope(WorkoutSessionSchema);
export const WorkoutSessionsEnvelopeSchema = envelope(z.array(WorkoutSessionSchema));
export const BodyMeasurementEnvelopeSchema = envelope(BodyMeasurementSchema);
export const BodyMeasurementsEnvelopeSchema = envelope(z.array(BodyMeasurementSchema));
export const DateRangeFilterSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export const PersonalRecordEnvelopeSchema = envelope(PersonalRecordSchema);
export const PersonalRecordsEnvelopeSchema = envelope(z.array(PersonalRecordSchema));
export const RecoveryRecordEnvelopeSchema = envelope(RecoveryRecordSchema);
export const RecoveryRecordsEnvelopeSchema = envelope(z.array(RecoveryRecordSchema));
export const EntertainmentItemTypeSchema = z.enum([
  'MOVIE',
  'SERIES',
  'BOOK',
  'COMIC',
  'GAME',
  'ACTIVITY',
  'TRIP',
  'OTHER',
]);
export const EntertainmentStatusSchema = z.enum([
  'WISHLIST',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'DROPPED',
]);
const ActivityTripDetailsSchema = z.object({
  startAt: z.iso.datetime().nullable(),
  endAt: z.iso.datetime().nullable(),
  location: z.string().nullable(),
  eventId: z.string().nullable(),
  taskId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
});
export const EntertainmentItemSchema = EntitySchema.extend({
  categoryId: z.string(),
  title: z.string(),
  itemType: EntertainmentItemTypeSchema,
  listType: z.enum(['WANT_TO_WATCH', 'WANT_TO_PLAY', 'WANT_TO_GO', 'OTHER']),
  status: EntertainmentStatusSchema,
  progressCurrent: z.number().nullable(),
  progressTotal: z.number().nullable(),
  progressUnit: z.string().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  rating: z.number().min(0).max(10).nullable(),
  note: z.string().nullable(),
  tripDetails: ActivityTripDetailsSchema.nullable(),
});
export const CreateEntertainmentItemSchema = z.object({
  categoryId: z.string(),
  title: z.string().trim().min(1).max(200),
  itemType: EntertainmentItemTypeSchema,
  listType: z.enum(['WANT_TO_WATCH', 'WANT_TO_PLAY', 'WANT_TO_GO', 'OTHER']),
  status: EntertainmentStatusSchema.optional(),
  progressTotal: z.number().positive().nullable().optional(),
  progressUnit: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const EntertainmentItemFiltersSchema = z.object({
  itemType: EntertainmentItemTypeSchema.optional(),
  listType: z.enum(['WANT_TO_WATCH', 'WANT_TO_PLAY', 'WANT_TO_GO', 'OTHER']).optional(),
  status: EntertainmentStatusSchema.optional(),
});
export const UpdateEntertainmentItemSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  itemType: EntertainmentItemTypeSchema.optional(),
  listType: z.enum(['WANT_TO_WATCH', 'WANT_TO_PLAY', 'WANT_TO_GO', 'OTHER']).optional(),
  status: EntertainmentStatusSchema.optional(),
  progressTotal: z.number().positive().nullable().optional(),
  progressUnit: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const SetEntertainmentProgressSchema = z.object({
  expectedVersion: z.number().int().positive(),
  progressCurrent: z.number().nonnegative(),
  status: EntertainmentStatusSchema.optional(),
  rating: z.number().min(0).max(10).nullable().optional(),
});
export const EntertainmentSessionSchema = EntitySchema.extend({
  itemId: z.string(),
  sessionDate: z.iso.date(),
  durationMinutes: z.number().int().nonnegative(),
  progressDelta: z.number().nullable(),
  note: z.string().nullable(),
});
export const CreateEntertainmentSessionSchema = z.object({
  itemId: z.string(),
  sessionDate: z.iso.date(),
  durationMinutes: z.number().int().nonnegative(),
  progressDelta: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const UpdateEntertainmentSessionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  sessionDate: z.iso.date().optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
  progressDelta: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const PutTripDetailsSchema = z.object({
  startAt: z.iso.datetime().nullable().optional(),
  endAt: z.iso.datetime().nullable().optional(),
  location: z.string().nullable().optional(),
  eventId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export const CreateEntertainmentExpenseSchema = z.object({
  occurredAt: z.iso.datetime(),
  amountMinor: z.number().int().nonnegative(),
  merchant: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});
export const EntertainmentItemEnvelopeSchema = envelope(EntertainmentItemSchema);
export const EntertainmentItemsEnvelopeSchema = envelope(z.array(EntertainmentItemSchema));
export const EntertainmentSessionEnvelopeSchema = envelope(EntertainmentSessionSchema);
export const EntertainmentSessionsEnvelopeSchema = envelope(z.array(EntertainmentSessionSchema));
