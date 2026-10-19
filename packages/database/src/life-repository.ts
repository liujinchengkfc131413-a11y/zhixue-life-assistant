import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import { CanonicalHistoryRepository } from './canonical-history-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import type { OperationContext } from './operation-context.js';
import type { CanonicalEntitySnapshot } from './snapshot-contract.js';
import type { SqliteDatabase } from './sqlite-database.js';

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type ShoppingStatus = 'WANTED' | 'RESEARCHING' | 'READY' | 'PURCHASED' | 'CANCELLED';
type Patch<T> = { [K in keyof T]?: T[K] | undefined };

export interface LifeEntity {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface ShoppingItem extends LifeEntity {
  categoryId: string;
  name: string;
  productCategory: string | null;
  quantity: number;
  unit: string | null;
  plannedUnitPriceMinor: number | null;
  budgetAmountMinor: number | null;
  priority: Priority;
  status: ShoppingStatus;
  purchaseChannel: string | null;
  taskId: string | null;
}
export interface PurchaseRecord extends LifeEntity {
  shoppingItemId: string | null;
  categoryId: string;
  productName: string;
  quantity: number;
  unitPriceMinor: number;
  totalAmountMinor: number;
  plannedTotalMinor: number | null;
  purchasedAt: string;
  channel: string | null;
  expenseEntryId: string;
}
export interface Budget extends LifeEntity {
  categoryId: string | null;
  moduleType: 'SHOPPING' | 'DIET' | 'ENTERTAINMENT' | null;
  periodType: 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  alertThresholdPercent: number;
}
export interface LifeOverview {
  range: { from: string; to: string };
  expenses: {
    totalMinor: number;
    shoppingMinor: number;
    dietMinor: number;
    entertainmentMinor: number;
  };
  budgets: { totalMinor: number; usedPercent: number };
  shopping: { pending: number; purchased: number; plannedMinor: number; actualMinor: number };
  diet: {
    meals: number;
    caloriesKcal: number;
    caloriesRecordedMeals: number;
    nutritionMissingMeals: number;
    hydrationMl: number;
  };
  fitness: {
    sessions: number;
    durationMinutes: number;
    caloriesBurned: number;
    latestWeightKg: number | null;
    recoveryLevel: number | null;
  };
  entertainment: { items: number; completed: number; durationMinutes: number };
}
type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export interface Recipe extends LifeEntity {
  categoryId: string;
  name: string;
  description: string | null;
  servings: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}
export interface MealPlan extends LifeEntity {
  categoryId: string;
  mealDate: string;
  mealType: MealType;
  plannedAt: string | null;
  recipeId: string | null;
  title: string;
  eventId: string | null;
  taskId: string | null;
  status: 'PLANNED' | 'COMPLETED' | 'SKIPPED';
}
export interface MealRecord extends LifeEntity {
  categoryId: string;
  mealPlanId: string | null;
  mealType: MealType;
  title: string;
  eatenAt: string;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  otherNutrition: Record<string, unknown>;
  expenseEntryId: string | null;
}
export interface HydrationRecord extends LifeEntity {
  recordedAt: string;
  amountMl: number;
  note: string | null;
}
export interface DietaryPreference extends LifeEntity {
  preferenceType: 'LIKE' | 'DISLIKE' | 'ALLERGY' | 'INTOLERANCE' | 'RESTRICTION';
  name: string;
  severity: string | null;
  note: string | null;
  isActive: boolean;
}
export interface Exercise extends LifeEntity {
  name: string;
  exerciseType: 'STRENGTH' | 'CARDIO' | 'MOBILITY' | 'SPORT' | 'OTHER';
  muscleGroups: string[];
  defaultUnit: string | null;
  instructions: string | null;
}
export interface WorkoutPlanItem {
  id: string;
  exerciseId: string;
  setsTarget: number | null;
  repsTarget: string | null;
  weightTarget: number | null;
  durationSecondsTarget: number | null;
  distanceTarget: number | null;
  sortOrder: number;
}
export interface WorkoutPlan extends LifeEntity {
  categoryId: string;
  name: string;
  description: string | null;
  goalId: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  items: WorkoutPlanItem[];
}
export interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  durationSeconds: number | null;
  distance: number | null;
  completed: boolean;
}
export interface WorkoutSession extends LifeEntity {
  categoryId: string;
  workoutPlanId: string | null;
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  caloriesBurned: number | null;
  perceivedEffort: number | null;
  note: string | null;
  sets: WorkoutSet[];
}
export interface BodyMeasurement extends LifeEntity {
  measuredAt: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipCm: number | null;
  note: string | null;
}
export interface PersonalRecord extends LifeEntity {
  exerciseId: string | null;
  recordType: 'WEIGHT' | 'REPS' | 'DURATION' | 'DISTANCE' | 'SPEED' | 'OTHER';
  value: number;
  unit: string;
  achievedAt: string;
  workoutSessionId: string | null;
}
export interface RecoveryRecord extends LifeEntity {
  recordedDate: string;
  recoveryLevel: number;
  sorenessLevel: number | null;
  energyLevel: number | null;
  note: string | null;
}
export interface EntertainmentItem extends LifeEntity {
  categoryId: string;
  title: string;
  itemType: 'MOVIE' | 'SERIES' | 'BOOK' | 'COMIC' | 'GAME' | 'ACTIVITY' | 'TRIP' | 'OTHER';
  listType: 'WANT_TO_WATCH' | 'WANT_TO_PLAY' | 'WANT_TO_GO' | 'OTHER';
  status: 'WISHLIST' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED';
  progressCurrent: number | null;
  progressTotal: number | null;
  progressUnit: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rating: number | null;
  note: string | null;
  tripDetails: ActivityTripDetails | null;
}
export interface ActivityTripDetails {
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  eventId: string | null;
  taskId: string | null;
  details: Record<string, unknown>;
}
export interface EntertainmentSession extends LifeEntity {
  itemId: string;
  sessionDate: string;
  durationMinutes: number;
  progressDelta: number | null;
  note: string | null;
}

const iso = (value: number) => new Date(value).toISOString();
const merge = <T extends object>(current: T, patch: Patch<T>): T =>
  Object.fromEntries(
    Object.entries(current).map(([key, value]) => [
      key,
      patch[key as keyof T] === undefined ? value : patch[key as keyof T],
    ]),
  ) as T;

export class LifeRepository {
  private readonly canonicalHistory: CanonicalHistoryRepository;

  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    recorder: ConsistencyRepository = new ConsistencyRepository(database, clock),
  ) {
    this.canonicalHistory = new CanonicalHistoryRepository(database, clock, recorder);
  }

  public listShoppingItems(status?: ShoppingStatus): readonly ShoppingItem[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at
       FROM shopping_items item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL
       WHERE (? IS NULL OR item.status=?)
       ORDER BY CASE item.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, entity.updated_at DESC`,
      )
      .all(status ?? null, status ?? null) as Record<string, unknown>[];
    return rows.map((row) => this.mapShoppingItem(row));
  }

  public createShoppingItem(
    input: {
      categoryId: string;
      name: string;
      productCategory?: string | null;
      quantity?: number;
      unit?: string | null;
      plannedUnitPriceMinor?: number | null;
      budgetAmountMinor?: number | null;
      priority?: Priority;
      status?: ShoppingStatus;
      purchaseChannel?: string | null;
      taskId?: string | null;
    },
    context?: OperationContext,
  ): ShoppingItem {
    this.assertCategory(input.categoryId, 'SHOPPING');
    const quantity = input.quantity ?? 1;
    if (quantity <= 0) throw new Error('INVALID_QUANTITY');
    const id = this.createEntity('SHOPPING_ITEM');
    this.database.raw
      .prepare(
        `INSERT INTO shopping_items(id,category_id,name,product_category,quantity,unit,planned_unit_price_minor,budget_amount_minor,priority,status,purchase_channel,task_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.categoryId,
        input.name.trim(),
        input.productCategory ?? null,
        quantity,
        input.unit ?? null,
        input.plannedUnitPriceMinor ?? null,
        input.budgetAmountMinor ?? null,
        input.priority ?? 'NORMAL',
        input.status ?? 'WANTED',
        input.purchaseChannel ?? null,
        input.taskId ?? null,
      );
    this.recordCreate(id, 'ShoppingItemCreated', input, context);
    return this.requireShoppingItem(id);
  }

  public updateShoppingItem(
    id: string,
    expectedVersion: number,
    patch: Patch<Omit<ShoppingItem, keyof LifeEntity | 'categoryId'>>,
    context?: OperationContext,
  ): ShoppingItem {
    const current = this.requireShoppingItem(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch);
    if (value.quantity <= 0) throw new Error('INVALID_QUANTITY');
    const before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        `UPDATE shopping_items SET name=?,product_category=?,quantity=?,unit=?,planned_unit_price_minor=?,budget_amount_minor=?,priority=?,status=?,purchase_channel=?,task_id=? WHERE id=?`,
      )
      .run(
        value.name.trim(),
        value.productCategory,
        value.quantity,
        value.unit,
        value.plannedUnitPriceMinor,
        value.budgetAmountMinor,
        value.priority,
        value.status,
        value.purchaseChannel,
        value.taskId,
        id,
      );
    this.changed(id, 'ShoppingItemUpdated', patch, before, context);
    return this.requireShoppingItem(id);
  }

  public purchaseShoppingItem(
    id: string,
    expectedVersion: number,
    input: {
      quantity: number;
      unitPriceMinor: number;
      purchasedAt: string;
      channel?: string | null;
    },
    context?: OperationContext,
  ): PurchaseRecord {
    const item = this.requireShoppingItem(id);
    this.assertVersion(item.version, expectedVersion);
    if (item.status === 'PURCHASED' || item.status === 'CANCELLED')
      throw new Error('INVALID_SHOPPING_STATUS');
    if (input.quantity <= 0 || input.unitPriceMinor < 0) throw new Error('INVALID_PURCHASE_AMOUNT');
    const purchaseId = ulid(),
      expenseId = ulid(),
      now = this.clock.now().getTime();
    const purchasedAt = Date.parse(input.purchasedAt),
      total = Math.round(input.quantity * input.unitPriceMinor);
    if (!Number.isFinite(purchasedAt)) throw new Error('INVALID_PURCHASE_DATE');
    const planned =
      item.plannedUnitPriceMinor === null
        ? null
        : Math.round(item.quantity * item.plannedUnitPriceMinor);
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      for (const [entityId, type] of [
        [purchaseId, 'PURCHASE_RECORD'],
        [expenseId, 'EXPENSE_ENTRY'],
      ] as const)
        this.database.raw
          .prepare(
            'INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)',
          )
          .run(entityId, type, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO expense_entries(id,module_type,category_id,source_entity_id,occurred_at,amount_minor,currency,merchant,note)
         VALUES (?,'SHOPPING',?,?,?,?, 'CNY',?,NULL)`,
        )
        .run(
          expenseId,
          item.categoryId,
          purchaseId,
          purchasedAt,
          total,
          input.channel ?? item.purchaseChannel,
        );
      this.database.raw
        .prepare(
          `INSERT INTO purchase_records(id,shopping_item_id,category_id,product_name,quantity,unit_price_minor,total_amount_minor,planned_total_minor,purchased_at,channel,expense_entry_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          purchaseId,
          id,
          item.categoryId,
          item.name,
          input.quantity,
          input.unitPriceMinor,
          total,
          planned,
          purchasedAt,
          input.channel ?? item.purchaseChannel,
          expenseId,
        );
      this.database.raw.prepare("UPDATE shopping_items SET status='PURCHASED' WHERE id=?").run(id);
      this.bump(id);
      if (context !== undefined && before !== undefined)
        this.canonicalHistory.recordUpdate(id, before, context, 'ShoppingItemPurchased');
      else this.audit(purchaseId, 1, 'ShoppingItemPurchased', input);
    });
    return this.requirePurchase(purchaseId);
  }

  public listPurchases(from?: string, to?: string): readonly PurchaseRecord[] {
    const min = from === undefined ? null : Date.parse(`${from}T00:00:00+08:00`);
    const max = to === undefined ? null : Date.parse(`${to}T23:59:59.999+08:00`);
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at FROM purchase_records item
       JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL
       WHERE (? IS NULL OR item.purchased_at>=?) AND (? IS NULL OR item.purchased_at<=?) ORDER BY item.purchased_at DESC`,
      )
      .all(min, min, max, max) as Record<string, unknown>[];
    return rows.map((row) => this.mapPurchase(row));
  }

  public createBudget(input: {
    categoryId?: string | null;
    moduleType?: Budget['moduleType'];
    periodType: Budget['periodType'];
    periodStart: string;
    periodEnd: string;
    amountMinor: number;
    alertThresholdPercent?: number;
  }): Budget {
    if (input.periodStart > input.periodEnd || input.amountMinor < 0)
      throw new Error('INVALID_BUDGET');
    const id = this.createEntity('BUDGET');
    this.database.raw
      .prepare(
        `INSERT INTO budgets(id,category_id,module_type,period_type,period_start,period_end,amount_minor,currency,alert_threshold_percent)
       VALUES (?,?,?,?,?,?,?,'CNY',?)`,
      )
      .run(
        id,
        input.categoryId ?? null,
        input.moduleType ?? null,
        input.periodType,
        input.periodStart,
        input.periodEnd,
        input.amountMinor,
        input.alertThresholdPercent ?? 80,
      );
    this.audit(id, 1, 'BudgetCreated', input);
    return this.requireBudget(id);
  }

  public listBudgets(from?: string, to?: string): readonly Budget[] {
    const rows = this.database.raw
      .prepare(
        `SELECT item.*, entity.version, entity.created_at, entity.updated_at FROM budgets item
       JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL
       WHERE (? IS NULL OR item.period_end>=?) AND (? IS NULL OR item.period_start<=?) ORDER BY item.period_start DESC`,
      )
      .all(from ?? null, from ?? null, to ?? null, to ?? null) as Record<string, unknown>[];
    return rows.map((row) => this.mapBudget(row));
  }

  public createRecipe(
    input: {
      categoryId: string;
      name: string;
      description?: string | null;
      servings?: number;
      caloriesKcal?: number | null;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
    },
    context?: OperationContext,
  ): Recipe {
    this.assertCategory(input.categoryId, 'DIET');
    const id = this.createEntity('RECIPE');
    this.database.raw
      .prepare(
        `INSERT INTO recipes(id,category_id,name,description,servings,calories_kcal,protein_g,carbs_g,fat_g) VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.categoryId,
        input.name.trim(),
        input.description ?? null,
        input.servings ?? 1,
        input.caloriesKcal ?? null,
        input.proteinG ?? null,
        input.carbsG ?? null,
        input.fatG ?? null,
      );
    this.recordCreate(id, 'RecipeCreated', input, context);
    return this.requireRecipe(id);
  }
  public listRecipes(): readonly Recipe[] {
    return (
      this.database.raw
        .prepare(
          `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM recipes item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL ORDER BY item.name`,
        )
        .all() as Record<string, unknown>[]
    ).map((row) => this.mapRecipe(row));
  }
  public updateRecipe(
    id: string,
    expectedVersion: number,
    patch: Patch<Omit<Recipe, keyof LifeEntity | 'categoryId'>>,
    context?: OperationContext,
  ): Recipe {
    const current = this.requireRecipe(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch);
    const before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        `UPDATE recipes SET name=?,description=?,servings=?,calories_kcal=?,protein_g=?,carbs_g=?,fat_g=? WHERE id=?`,
      )
      .run(
        value.name.trim(),
        value.description,
        value.servings,
        value.caloriesKcal,
        value.proteinG,
        value.carbsG,
        value.fatG,
        id,
      );
    this.changed(id, 'RecipeUpdated', patch, before, context);
    return this.requireRecipe(id);
  }
  public createMealPlan(input: {
    categoryId: string;
    mealDate: string;
    mealType: MealType;
    plannedAt?: string | null;
    recipeId?: string | null;
    title: string;
    eventId?: string | null;
    taskId?: string | null;
  }): MealPlan {
    this.assertCategory(input.categoryId, 'DIET');
    if (input.recipeId) this.requireRecipe(input.recipeId);
    const id = this.createEntity('MEAL_PLAN');
    this.database.raw
      .prepare(
        `INSERT INTO meal_plans(id,category_id,meal_date,meal_type,planned_at,recipe_id,title,event_id,task_id,status) VALUES (?,?,?,?,?,?,?,?,?,'PLANNED')`,
      )
      .run(
        id,
        input.categoryId,
        input.mealDate,
        input.mealType,
        input.plannedAt ? Date.parse(input.plannedAt) : null,
        input.recipeId ?? null,
        input.title.trim(),
        input.eventId ?? null,
        input.taskId ?? null,
      );
    this.audit(id, 1, 'MealPlanCreated', input);
    return this.requireMealPlan(id);
  }
  public listMealPlans(from?: string, to?: string): readonly MealPlan[] {
    return (
      this.database.raw
        .prepare(
          `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM meal_plans item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR meal_date>=?) AND (? IS NULL OR meal_date<=?) ORDER BY meal_date,meal_type`,
        )
        .all(from ?? null, from ?? null, to ?? null, to ?? null) as Record<string, unknown>[]
    ).map((row) => this.mapMealPlan(row));
  }
  public updateMealPlan(
    id: string,
    expectedVersion: number,
    patch: Patch<Omit<MealPlan, keyof LifeEntity | 'categoryId'>>,
  ): MealPlan {
    const current = this.requireMealPlan(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch);
    this.database.raw
      .prepare(
        `UPDATE meal_plans SET meal_date=?,meal_type=?,planned_at=?,recipe_id=?,title=?,event_id=?,task_id=?,status=? WHERE id=?`,
      )
      .run(
        value.mealDate,
        value.mealType,
        value.plannedAt ? Date.parse(value.plannedAt) : null,
        value.recipeId,
        value.title.trim(),
        value.eventId,
        value.taskId,
        value.status,
        id,
      );
    this.changed(id, 'MealPlanUpdated', patch);
    return this.requireMealPlan(id);
  }
  public createMeal(input: {
    categoryId: string;
    mealPlanId?: string | null;
    mealType: MealType;
    title: string;
    eatenAt: string;
    caloriesKcal?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
    sodiumMg?: number | null;
    expenseAmountMinor?: number | null;
    merchant?: string | null;
  }): MealRecord {
    this.assertCategory(input.categoryId, 'DIET');
    const id = ulid(),
      expenseId =
        input.expenseAmountMinor === undefined || input.expenseAmountMinor === null ? null : ulid(),
      now = this.clock.now().getTime(),
      eatenAt = Date.parse(input.eatenAt);
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'MEAL_RECORD',?,?)",
        )
        .run(id, now, now);
      if (expenseId) {
        this.database.raw
          .prepare(
            "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'EXPENSE_ENTRY',?,?)",
          )
          .run(expenseId, now, now);
        this.database.raw
          .prepare(
            `INSERT INTO expense_entries(id,module_type,category_id,source_entity_id,occurred_at,amount_minor,currency,merchant,note) VALUES (?,'DIET',?,?,?,?, 'CNY',?,NULL)`,
          )
          .run(
            expenseId,
            input.categoryId,
            id,
            eatenAt,
            input.expenseAmountMinor,
            input.merchant ?? null,
          );
      }
      this.database.raw
        .prepare(
          `INSERT INTO meal_records(id,category_id,meal_plan_id,meal_type,title,eaten_at,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,sodium_mg,other_nutrition_json,expense_entry_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'{}',?)`,
        )
        .run(
          id,
          input.categoryId,
          input.mealPlanId ?? null,
          input.mealType,
          input.title.trim(),
          eatenAt,
          input.caloriesKcal ?? null,
          input.proteinG ?? null,
          input.carbsG ?? null,
          input.fatG ?? null,
          input.fiberG ?? null,
          input.sodiumMg ?? null,
          expenseId,
        );
      if (input.mealPlanId) {
        const plan = this.requireMealPlan(input.mealPlanId);
        if (plan.status !== 'PLANNED') throw new Error('INVALID_MEAL_PLAN_STATUS');
        this.database.raw
          .prepare("UPDATE meal_plans SET status='COMPLETED' WHERE id=?")
          .run(plan.id);
        this.bump(plan.id);
      }
      this.audit(id, 1, 'MealRecorded', input);
    });
    return this.requireMeal(id);
  }
  public completeMealPlan(
    id: string,
    expectedVersion: number,
    input: {
      eatenAt: string;
      caloriesKcal?: number | null;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
      expenseAmountMinor?: number | null;
      merchant?: string | null;
    },
  ): MealRecord {
    const plan = this.requireMealPlan(id);
    this.assertVersion(plan.version, expectedVersion);
    const recipe = plan.recipeId ? this.requireRecipe(plan.recipeId) : undefined;
    return this.createMeal({
      categoryId: plan.categoryId,
      mealPlanId: id,
      mealType: plan.mealType,
      title: plan.title,
      eatenAt: input.eatenAt,
      caloriesKcal: input.caloriesKcal ?? recipe?.caloriesKcal ?? null,
      proteinG: input.proteinG ?? recipe?.proteinG ?? null,
      carbsG: input.carbsG ?? recipe?.carbsG ?? null,
      fatG: input.fatG ?? recipe?.fatG ?? null,
      expenseAmountMinor: input.expenseAmountMinor ?? null,
      merchant: input.merchant ?? null,
    });
  }
  public listMeals(from?: string, to?: string, mealType?: MealType): readonly MealRecord[] {
    const min = from ? Date.parse(`${from}T00:00:00+08:00`) : null,
      max = to ? Date.parse(`${to}T23:59:59.999+08:00`) : null;
    return (
      this.database.raw
        .prepare(
          `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM meal_records item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR eaten_at>=?) AND (? IS NULL OR eaten_at<=?) AND (? IS NULL OR meal_type=?) ORDER BY eaten_at DESC`,
        )
        .all(min, min, max, max, mealType ?? null, mealType ?? null) as Record<string, unknown>[]
    ).map((row) => this.mapMeal(row));
  }
  public updateMeal(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<
        MealRecord,
        | 'mealType'
        | 'title'
        | 'eatenAt'
        | 'caloriesKcal'
        | 'proteinG'
        | 'carbsG'
        | 'fatG'
        | 'fiberG'
        | 'sodiumMg'
        | 'otherNutrition'
      >
    >,
    context?: OperationContext,
  ): MealRecord {
    const current = this.requireMeal(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        `UPDATE meal_records SET meal_type=?,title=?,eaten_at=?,calories_kcal=?,protein_g=?,carbs_g=?,fat_g=?,fiber_g=?,sodium_mg=?,other_nutrition_json=? WHERE id=?`,
      )
      .run(
        value.mealType,
        value.title.trim(),
        Date.parse(value.eatenAt),
        value.caloriesKcal,
        value.proteinG,
        value.carbsG,
        value.fatG,
        value.fiberG,
        value.sodiumMg,
        JSON.stringify(value.otherNutrition),
        id,
      );
    this.changed(id, 'MealUpdated', patch, before, context);
    return this.requireMeal(id);
  }
  public createHydration(input: {
    recordedAt: string;
    amountMl: number;
    note?: string | null;
  }): HydrationRecord {
    const id = this.createEntity('HYDRATION_RECORD');
    this.database.raw
      .prepare('INSERT INTO hydration_records(id,recorded_at,amount_ml,note) VALUES (?,?,?,?)')
      .run(id, Date.parse(input.recordedAt), input.amountMl, input.note ?? null);
    this.audit(id, 1, 'HydrationRecorded', input);
    return this.requireHydration(id);
  }
  public listHydration(from?: string, to?: string): readonly HydrationRecord[] {
    const min = from ? Date.parse(`${from}T00:00:00+08:00`) : null,
      max = to ? Date.parse(`${to}T23:59:59.999+08:00`) : null;
    return (
      this.database.raw
        .prepare(
          `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM hydration_records item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR recorded_at>=?) AND (? IS NULL OR recorded_at<=?) ORDER BY recorded_at DESC`,
        )
        .all(min, min, max, max) as Record<string, unknown>[]
    ).map((row) => this.mapHydration(row));
  }
  public updateHydration(
    id: string,
    expectedVersion: number,
    patch: Patch<Pick<HydrationRecord, 'recordedAt' | 'amountMl' | 'note'>>,
    context?: OperationContext,
  ): HydrationRecord {
    const current = this.requireHydration(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    this.database.raw
      .prepare('UPDATE hydration_records SET recorded_at=?,amount_ml=?,note=? WHERE id=?')
      .run(Date.parse(value.recordedAt), value.amountMl, value.note, id);
    this.changed(id, 'HydrationUpdated', patch, before, context);
    return this.requireHydration(id);
  }
  public createPreference(input: {
    preferenceType: DietaryPreference['preferenceType'];
    name: string;
    severity?: string | null;
    note?: string | null;
  }): DietaryPreference {
    const id = this.createEntity('DIETARY_PREFERENCE');
    this.database.raw
      .prepare(
        'INSERT INTO dietary_preferences(id,preference_type,name,severity,note,is_active) VALUES (?,?,?,?,?,1)',
      )
      .run(id, input.preferenceType, input.name.trim(), input.severity ?? null, input.note ?? null);
    this.audit(id, 1, 'DietaryPreferenceCreated', input);
    return this.requirePreference(id);
  }
  public listPreferences(): readonly DietaryPreference[] {
    return (
      this.database.raw
        .prepare(
          `SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM dietary_preferences item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL ORDER BY is_active DESC,preference_type,name`,
        )
        .all() as Record<string, unknown>[]
    ).map((row) => this.mapPreference(row));
  }
  public updatePreference(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<DietaryPreference, 'preferenceType' | 'name' | 'severity' | 'note' | 'isActive'>
    >,
    context?: OperationContext,
  ): DietaryPreference {
    const current = this.requirePreference(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        'UPDATE dietary_preferences SET preference_type=?,name=?,severity=?,note=?,is_active=? WHERE id=?',
      )
      .run(
        value.preferenceType,
        value.name.trim(),
        value.severity,
        value.note,
        value.isActive ? 1 : 0,
        id,
      );
    this.changed(id, 'DietaryPreferenceUpdated', patch, before, context);
    return this.requirePreference(id);
  }

  public overview(from: string, to: string): LifeOverview {
    const min = Date.parse(`${from}T00:00:00+08:00`),
      max = Date.parse(`${to}T23:59:59.999+08:00`);
    const expenses = this.database.raw
      .prepare(
        `SELECT COALESCE(SUM(amount_minor),0) total,
       COALESCE(SUM(CASE WHEN module_type='SHOPPING' THEN amount_minor ELSE 0 END),0) shopping,
       COALESCE(SUM(CASE WHEN module_type='DIET' THEN amount_minor ELSE 0 END),0) diet,
       COALESCE(SUM(CASE WHEN module_type='ENTERTAINMENT' THEN amount_minor ELSE 0 END),0) entertainment
       FROM expense_entries expense JOIN entity_index entity ON entity.id=expense.id AND entity.deleted_at IS NULL
       WHERE occurred_at BETWEEN ? AND ?`,
      )
      .get(min, max) as { total: number; shopping: number; diet: number; entertainment: number };
    const budgetTotal = this.listBudgets(from, to).reduce(
      (sum, budget) => sum + budget.amountMinor,
      0,
    );
    const items = this.listShoppingItems(),
      purchases = this.listPurchases(from, to);
    const planned = items.reduce(
      (sum, item) =>
        sum +
        (item.budgetAmountMinor ??
          (item.plannedUnitPriceMinor === null
            ? 0
            : Math.round(item.quantity * item.plannedUnitPriceMinor))),
      0,
    );
    const sessions = this.listWorkoutSessions(from, to),
      latestBody = this.listBodyMeasurements()[0],
      latestRecovery = this.listRecovery()[0];
    return {
      range: { from, to },
      expenses: {
        totalMinor: expenses.total,
        shoppingMinor: expenses.shopping,
        dietMinor: expenses.diet,
        entertainmentMinor: expenses.entertainment,
      },
      budgets: {
        totalMinor: budgetTotal,
        usedPercent: budgetTotal === 0 ? 0 : Math.round((expenses.total / budgetTotal) * 1000) / 10,
      },
      shopping: {
        pending: items.filter((item) => !['PURCHASED', 'CANCELLED'].includes(item.status)).length,
        purchased: purchases.length,
        plannedMinor: planned,
        actualMinor: purchases.reduce((sum, item) => sum + item.totalAmountMinor, 0),
      },
      diet: {
        meals: this.listMeals(from, to).length,
        caloriesKcal: this.listMeals(from, to).reduce(
          (sum, item) => sum + (item.caloriesKcal ?? 0),
          0,
        ),
        caloriesRecordedMeals: this.listMeals(from, to).filter((x) => x.caloriesKcal !== null)
          .length,
        nutritionMissingMeals: this.listMeals(from, to).filter((x) => x.caloriesKcal === null)
          .length,
        hydrationMl: this.listHydration(from, to).reduce((sum, item) => sum + item.amountMl, 0),
      },
      fitness: {
        sessions: sessions.length,
        durationMinutes: sessions.reduce((sum, x) => sum + x.durationMinutes, 0),
        caloriesBurned: sessions.reduce((sum, x) => sum + (x.caloriesBurned ?? 0), 0),
        latestWeightKg: latestBody?.weightKg ?? null,
        recoveryLevel: latestRecovery?.recoveryLevel ?? null,
      },
      entertainment: {
        items: this.listEntertainmentItems().length,
        completed: this.listEntertainmentItems().filter((x) => x.status === 'COMPLETED').length,
        durationMinutes: this.listEntertainmentSessions(from, to).reduce(
          (sum, x) => sum + x.durationMinutes,
          0,
        ),
      },
    };
  }

  public createEntertainmentItem(
    input: {
      categoryId: string;
      title: string;
      itemType: EntertainmentItem['itemType'];
      listType: EntertainmentItem['listType'];
      status?: EntertainmentItem['status'];
      progressTotal?: number | null;
      progressUnit?: string | null;
      note?: string | null;
    },
    context?: OperationContext,
  ): EntertainmentItem {
    this.assertCategory(input.categoryId, 'ENTERTAINMENT');
    const id = this.createEntity('ENTERTAINMENT_ITEM');
    this.database.raw
      .prepare(
        'INSERT INTO entertainment_items(id,category_id,title,item_type,list_type,status,progress_current,progress_total,progress_unit,note) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        input.categoryId,
        input.title.trim(),
        input.itemType,
        input.listType,
        input.status ?? 'WISHLIST',
        0,
        input.progressTotal ?? null,
        input.progressUnit ?? null,
        input.note ?? null,
      );
    this.recordCreate(id, 'EntertainmentItemCreated', input, context);
    return this.requireEntertainmentItem(id);
  }
  public listEntertainmentItems(
    filters: {
      itemType?: EntertainmentItem['itemType'];
      listType?: EntertainmentItem['listType'];
      status?: EntertainmentItem['status'];
    } = {},
  ): readonly EntertainmentItem[] {
    return (
      this.database.raw
        .prepare(
          `SELECT item.*,entity.version,entity.created_at,entity.updated_at
           FROM entertainment_items item
           JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL
           WHERE (? IS NULL OR item.item_type=?)
             AND (? IS NULL OR item.list_type=?)
             AND (? IS NULL OR item.status=?)
           ORDER BY entity.updated_at DESC`,
        )
        .all(
          filters.itemType ?? null,
          filters.itemType ?? null,
          filters.listType ?? null,
          filters.listType ?? null,
          filters.status ?? null,
          filters.status ?? null,
        ) as Record<string, unknown>[]
    ).map((x) => this.mapEntertainmentItem(x));
  }
  public updateEntertainmentItem(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<
        EntertainmentItem,
        'title' | 'itemType' | 'listType' | 'status' | 'progressTotal' | 'progressUnit' | 'note'
      >
    >,
    context?: OperationContext,
  ): EntertainmentItem {
    const current = this.requireEntertainmentItem(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        'UPDATE entertainment_items SET title=?,item_type=?,list_type=?,status=?,progress_total=?,progress_unit=?,note=? WHERE id=?',
      )
      .run(
        value.title,
        value.itemType,
        value.listType,
        value.status,
        value.progressTotal,
        value.progressUnit,
        value.note,
        id,
      );
    this.changed(id, 'EntertainmentItemUpdated', patch, before, context);
    return this.requireEntertainmentItem(id);
  }
  public setEntertainmentProgress(
    id: string,
    expectedVersion: number,
    input: {
      progressCurrent: number;
      status?: EntertainmentItem['status'];
      rating?: number | null;
    },
    context?: OperationContext,
  ): EntertainmentItem {
    const current = this.requireEntertainmentItem(id);
    this.assertVersion(current.version, expectedVersion);
    const status = input.status ?? (input.progressCurrent > 0 ? 'IN_PROGRESS' : current.status),
      now = this.clock.now().getTime(),
      completed = status === 'COMPLETED' ? now : null;
    const before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        'UPDATE entertainment_items SET progress_current=?,status=?,rating=?,started_at=COALESCE(started_at,?),completed_at=? WHERE id=?',
      )
      .run(
        input.progressCurrent,
        status,
        input.rating ?? current.rating,
        status === 'IN_PROGRESS' ? now : null,
        completed,
        id,
      );
    this.changed(id, 'EntertainmentProgressUpdated', input, before, context);
    return this.requireEntertainmentItem(id);
  }
  public createEntertainmentSession(
    input: {
      itemId: string;
      sessionDate: string;
      durationMinutes: number;
      progressDelta?: number | null;
      note?: string | null;
    },
    context?: OperationContext,
  ): EntertainmentSession {
    const item = this.requireEntertainmentItem(input.itemId),
      id = ulid(),
      now = this.clock.now().getTime();
    this.database.transaction(() => {
      const before = this.captureBefore(input.itemId, context);
      this.database.raw
        .prepare(
          "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'ENTERTAINMENT_SESSION',?,?)",
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          'INSERT INTO entertainment_sessions(id,item_id,session_date,duration_minutes,progress_delta,note) VALUES (?,?,?,?,?,?)',
        )
        .run(
          id,
          input.itemId,
          input.sessionDate,
          input.durationMinutes,
          input.progressDelta ?? null,
          input.note ?? null,
        );
      if (input.progressDelta) {
        this.database.raw
          .prepare(
            "UPDATE entertainment_items SET progress_current=COALESCE(progress_current,0)+?,status=CASE WHEN status='WISHLIST' THEN 'IN_PROGRESS' ELSE status END WHERE id=?",
          )
          .run(input.progressDelta, item.id);
        this.bump(item.id);
        if (context !== undefined && before !== undefined)
          this.canonicalHistory.recordUpdate(
            item.id,
            before,
            context,
            'EntertainmentSessionProgressApplied',
          );
      }
      if (context === undefined) this.audit(id, 1, 'EntertainmentSessionRecorded', input);
    });
    return this.requireEntertainmentSession(id);
  }
  public listEntertainmentSessions(from?: string, to?: string): readonly EntertainmentSession[] {
    return (
      this.database.raw
        .prepare(
          'SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM entertainment_sessions item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR session_date>=?) AND (? IS NULL OR session_date<=?) ORDER BY session_date DESC',
        )
        .all(from ?? null, from ?? null, to ?? null, to ?? null) as Record<string, unknown>[]
    ).map((x) => this.mapEntertainmentSession(x));
  }
  public updateEntertainmentSession(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<EntertainmentSession, 'sessionDate' | 'durationMinutes' | 'progressDelta' | 'note'>
    >,
    context?: OperationContext,
  ): EntertainmentSession {
    const current = this.requireEntertainmentSession(id),
      item = this.requireEntertainmentItem(current.itemId);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context),
      itemBefore = this.captureBefore(item.id, context),
      deltaChange = (value.progressDelta ?? 0) - (current.progressDelta ?? 0);
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          'UPDATE entertainment_sessions SET session_date=?,duration_minutes=?,progress_delta=?,note=? WHERE id=?',
        )
        .run(value.sessionDate, value.durationMinutes, value.progressDelta, value.note, id);
      this.changed(id, 'EntertainmentSessionUpdated', patch, before, context);
      if (deltaChange !== 0) {
        this.database.raw
          .prepare(
            'UPDATE entertainment_items SET progress_current=MAX(0,COALESCE(progress_current,0)+?) WHERE id=?',
          )
          .run(deltaChange, item.id);
        this.changed(
          item.id,
          'EntertainmentSessionProgressAdjusted',
          { sessionId: id, deltaChange },
          itemBefore,
          context,
        );
      }
    });
    return this.requireEntertainmentSession(id);
  }
  public putTripDetails(
    id: string,
    input: {
      startAt?: string | null;
      endAt?: string | null;
      location?: string | null;
      eventId?: string | null;
      taskId?: string | null;
      details?: Record<string, unknown>;
    },
    context?: OperationContext,
  ): EntertainmentItem {
    const item = this.requireEntertainmentItem(id);
    if (!['ACTIVITY', 'TRIP'].includes(item.itemType))
      throw new Error('INVALID_ENTERTAINMENT_TYPE');
    const before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        'INSERT INTO activity_trip_details(entertainment_item_id,start_at,end_at,location,event_id,task_id,details_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(entertainment_item_id) DO UPDATE SET start_at=excluded.start_at,end_at=excluded.end_at,location=excluded.location,event_id=excluded.event_id,task_id=excluded.task_id,details_json=excluded.details_json',
      )
      .run(
        id,
        input.startAt ? Date.parse(input.startAt) : null,
        input.endAt ? Date.parse(input.endAt) : null,
        input.location ?? null,
        input.eventId ?? null,
        input.taskId ?? null,
        JSON.stringify(input.details ?? {}),
      );
    this.changed(id, 'TripDetailsUpdated', input, before, context);
    return this.requireEntertainmentItem(id);
  }
  public createEntertainmentExpense(
    id: string,
    input: {
      occurredAt: string;
      amountMinor: number;
      merchant?: string | null;
      note?: string | null;
    },
  ): EntertainmentItem {
    const item = this.requireEntertainmentItem(id),
      expenseId = this.createEntity('EXPENSE_ENTRY');
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          "INSERT INTO expense_entries(id,module_type,category_id,source_entity_id,occurred_at,amount_minor,currency,merchant,note) VALUES (?,'ENTERTAINMENT',?,?,?,?, 'CNY',?,?)",
        )
        .run(
          expenseId,
          item.categoryId,
          expenseId,
          Date.parse(input.occurredAt),
          input.amountMinor,
          input.merchant ?? null,
          input.note ?? null,
        );
      this.database.raw
        .prepare(
          'INSERT INTO entertainment_expenses(expense_entry_id,entertainment_item_id) VALUES (?,?)',
        )
        .run(expenseId, id);
      this.audit(expenseId, 1, 'EntertainmentExpenseRecorded', input);
    });
    return item;
  }

  public createExercise(input: {
    name: string;
    exerciseType: Exercise['exerciseType'];
    muscleGroups?: string[];
    defaultUnit?: string | null;
    instructions?: string | null;
  }): Exercise {
    const id = this.createEntity('EXERCISE');
    this.database.raw
      .prepare(
        'INSERT INTO exercise_catalog(id,name,exercise_type,muscle_groups_json,default_unit,instructions) VALUES (?,?,?,?,?,?)',
      )
      .run(
        id,
        input.name.trim(),
        input.exerciseType,
        JSON.stringify(input.muscleGroups ?? []),
        input.defaultUnit ?? null,
        input.instructions ?? null,
      );
    this.audit(id, 1, 'ExerciseCreated', input);
    return this.requireExercise(id);
  }
  public listExercises(): readonly Exercise[] {
    return (
      this.database.raw
        .prepare(
          'SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM exercise_catalog item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL ORDER BY item.name',
        )
        .all() as Record<string, unknown>[]
    ).map((x) => this.mapExercise(x));
  }
  public updateExercise(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<Exercise, 'name' | 'exerciseType' | 'muscleGroups' | 'defaultUnit' | 'instructions'>
    >,
    context?: OperationContext,
  ): Exercise {
    const current = this.requireExercise(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        'UPDATE exercise_catalog SET name=?,exercise_type=?,muscle_groups_json=?,default_unit=?,instructions=? WHERE id=?',
      )
      .run(
        value.name.trim(),
        value.exerciseType,
        JSON.stringify(value.muscleGroups),
        value.defaultUnit,
        value.instructions,
        id,
      );
    this.changed(id, 'ExerciseUpdated', patch, before, context);
    return this.requireExercise(id);
  }
  public createWorkoutPlan(
    input: {
      categoryId: string;
      name: string;
      description?: string | null;
      goalId?: string | null;
      status?: WorkoutPlan['status'];
      items?: Omit<WorkoutPlanItem, 'id'>[];
    },
    context?: OperationContext,
  ): WorkoutPlan {
    this.assertCategory(input.categoryId, 'FITNESS');
    const id = this.createEntity('WORKOUT_PLAN');
    this.database.raw
      .prepare(
        'INSERT INTO workout_plans(id,category_id,name,description,goal_id,status) VALUES (?,?,?,?,?,?)',
      )
      .run(
        id,
        input.categoryId,
        input.name.trim(),
        input.description ?? null,
        input.goalId ?? null,
        input.status ?? 'ACTIVE',
      );
    for (const item of input.items ?? [])
      this.database.raw
        .prepare(
          'INSERT INTO workout_plan_items(id,workout_plan_id,exercise_id,sets_target,reps_target,weight_target,duration_seconds_target,distance_target,sort_order) VALUES (?,?,?,?,?,?,?,?,?)',
        )
        .run(
          ulid(),
          id,
          item.exerciseId,
          item.setsTarget,
          item.repsTarget,
          item.weightTarget,
          item.durationSecondsTarget,
          item.distanceTarget,
          item.sortOrder,
        );
    this.recordCreate(id, 'WorkoutPlanCreated', input, context);
    return this.requireWorkoutPlan(id);
  }
  public listWorkoutPlans(): readonly WorkoutPlan[] {
    return (
      this.database.raw
        .prepare(
          'SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM workout_plans item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL ORDER BY entity.updated_at DESC',
        )
        .all() as Record<string, unknown>[]
    ).map((x) => this.mapWorkoutPlan(x));
  }
  public updateWorkoutPlan(
    id: string,
    expectedVersion: number,
    patch: Patch<Pick<WorkoutPlan, 'name' | 'description' | 'goalId' | 'status' | 'items'>>,
    context?: OperationContext,
  ): WorkoutPlan {
    const current = this.requireWorkoutPlan(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch);
    return this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare('UPDATE workout_plans SET name=?,description=?,goal_id=?,status=? WHERE id=?')
        .run(value.name.trim(), value.description, value.goalId, value.status, id);
      if (patch.items !== undefined) {
        this.database.raw.prepare('DELETE FROM workout_plan_items WHERE workout_plan_id=?').run(id);
        for (const item of patch.items) {
          this.requireExercise(item.exerciseId);
          this.database.raw
            .prepare(
              `INSERT INTO workout_plan_items(id,workout_plan_id,exercise_id,sets_target,reps_target,weight_target,duration_seconds_target,distance_target,sort_order)
               VALUES (?,?,?,?,?,?,?,?,?)`,
            )
            .run(
              item.id || ulid(),
              id,
              item.exerciseId,
              item.setsTarget,
              item.repsTarget,
              item.weightTarget,
              item.durationSecondsTarget,
              item.distanceTarget,
              item.sortOrder,
            );
        }
      }
      this.changed(id, 'WorkoutPlanUpdated', patch, before, context);
      return this.requireWorkoutPlan(id);
    });
  }
  public createWorkoutSession(input: {
    categoryId: string;
    workoutPlanId?: string | null;
    taskId?: string | null;
    startedAt: string;
    endedAt: string;
    caloriesBurned?: number | null;
    perceivedEffort?: number | null;
    note?: string | null;
    sets?: Omit<WorkoutSet, 'id'>[];
  }): WorkoutSession {
    this.assertCategory(input.categoryId, 'FITNESS');
    const start = Date.parse(input.startedAt),
      end = Date.parse(input.endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      throw new Error('INVALID_WORKOUT_RANGE');
    const id = ulid(),
      now = this.clock.now().getTime(),
      duration = Math.round((end - start) / 60000);
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'WORKOUT_SESSION',?,?)",
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          'INSERT INTO workout_sessions(id,category_id,workout_plan_id,task_id,started_at,ended_at,duration_minutes,calories_burned,perceived_effort,note) VALUES (?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          id,
          input.categoryId,
          input.workoutPlanId ?? null,
          input.taskId ?? null,
          start,
          end,
          duration,
          input.caloriesBurned ?? null,
          input.perceivedEffort ?? null,
          input.note ?? null,
        );
      for (const set of input.sets ?? [])
        this.database.raw
          .prepare(
            'INSERT INTO workout_sets(id,session_id,exercise_id,set_number,reps,weight,duration_seconds,distance,completed) VALUES (?,?,?,?,?,?,?,?,?)',
          )
          .run(
            ulid(),
            id,
            set.exerciseId,
            set.setNumber,
            set.reps,
            set.weight,
            set.durationSeconds,
            set.distance,
            set.completed ? 1 : 0,
          );
      this.audit(id, 1, 'WorkoutSessionRecorded', input);
    });
    return this.requireWorkoutSession(id);
  }
  public listWorkoutSessions(from?: string, to?: string): readonly WorkoutSession[] {
    const min = from ? Date.parse(`${from}T00:00:00+08:00`) : null,
      max = to ? Date.parse(`${to}T23:59:59.999+08:00`) : null;
    return (
      this.database.raw
        .prepare(
          'SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM workout_sessions item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR started_at>=?) AND (? IS NULL OR started_at<=?) ORDER BY started_at DESC',
        )
        .all(min, min, max, max) as Record<string, unknown>[]
    ).map((x) => this.mapWorkoutSession(x));
  }
  public updateWorkoutSession(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<
        WorkoutSession,
        | 'workoutPlanId'
        | 'taskId'
        | 'startedAt'
        | 'endedAt'
        | 'caloriesBurned'
        | 'perceivedEffort'
        | 'note'
        | 'sets'
      >
    >,
    context?: OperationContext,
  ): WorkoutSession {
    const current = this.requireWorkoutSession(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      start = Date.parse(value.startedAt),
      end = Date.parse(value.endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      throw new Error('INVALID_WORKOUT_RANGE');
    if (value.workoutPlanId) this.requireWorkoutPlan(value.workoutPlanId);
    return this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          'UPDATE workout_sessions SET workout_plan_id=?,task_id=?,started_at=?,ended_at=?,duration_minutes=?,calories_burned=?,perceived_effort=?,note=? WHERE id=?',
        )
        .run(
          value.workoutPlanId,
          value.taskId,
          start,
          end,
          Math.round((end - start) / 60000),
          value.caloriesBurned,
          value.perceivedEffort,
          value.note,
          id,
        );
      if (patch.sets !== undefined) {
        this.database.raw.prepare('DELETE FROM workout_sets WHERE session_id=?').run(id);
        for (const set of patch.sets) {
          this.requireExercise(set.exerciseId);
          this.database.raw
            .prepare(
              'INSERT INTO workout_sets(id,session_id,exercise_id,set_number,reps,weight,duration_seconds,distance,completed) VALUES (?,?,?,?,?,?,?,?,?)',
            )
            .run(
              set.id || ulid(),
              id,
              set.exerciseId,
              set.setNumber,
              set.reps,
              set.weight,
              set.durationSeconds,
              set.distance,
              set.completed ? 1 : 0,
            );
        }
      }
      this.changed(id, 'WorkoutSessionUpdated', patch, before, context);
      return this.requireWorkoutSession(id);
    });
  }
  public createBodyMeasurement(input: {
    measuredAt: string;
    weightKg?: number | null;
    bodyFatPercent?: number | null;
    waistCm?: number | null;
    chestCm?: number | null;
    hipCm?: number | null;
    note?: string | null;
  }): BodyMeasurement {
    const id = this.createEntity('BODY_MEASUREMENT');
    this.database.raw
      .prepare(
        "INSERT INTO body_measurements(id,measured_at,weight_kg,body_fat_percent,waist_cm,chest_cm,hip_cm,other_measurements_json,note) VALUES (?,?,?,?,?,?,?,'{}',?)",
      )
      .run(
        id,
        Date.parse(input.measuredAt),
        input.weightKg ?? null,
        input.bodyFatPercent ?? null,
        input.waistCm ?? null,
        input.chestCm ?? null,
        input.hipCm ?? null,
        input.note ?? null,
      );
    this.audit(id, 1, 'BodyMeasurementRecorded', input);
    return this.requireBodyMeasurement(id);
  }
  public listBodyMeasurements(from?: string, to?: string): readonly BodyMeasurement[] {
    const min = from ? Date.parse(`${from}T00:00:00+08:00`) : null,
      max = to ? Date.parse(`${to}T23:59:59.999+08:00`) : null;
    return (
      this.database.raw
        .prepare(
          'SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM body_measurements item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL WHERE (? IS NULL OR measured_at>=?) AND (? IS NULL OR measured_at<=?) ORDER BY measured_at DESC',
        )
        .all(min, min, max, max) as Record<string, unknown>[]
    ).map((x) => this.mapBodyMeasurement(x));
  }
  public updateBodyMeasurement(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<
        BodyMeasurement,
        'measuredAt' | 'weightKg' | 'bodyFatPercent' | 'waistCm' | 'chestCm' | 'hipCm' | 'note'
      >
    >,
    context?: OperationContext,
  ): BodyMeasurement {
    const current = this.requireBodyMeasurement(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        'UPDATE body_measurements SET measured_at=?,weight_kg=?,body_fat_percent=?,waist_cm=?,chest_cm=?,hip_cm=?,note=? WHERE id=?',
      )
      .run(
        Date.parse(value.measuredAt),
        value.weightKg,
        value.bodyFatPercent,
        value.waistCm,
        value.chestCm,
        value.hipCm,
        value.note,
        id,
      );
    this.changed(id, 'BodyMeasurementUpdated', patch, before, context);
    return this.requireBodyMeasurement(id);
  }
  public createPersonalRecord(input: {
    exerciseId?: string | null;
    recordType: PersonalRecord['recordType'];
    value: number;
    unit: string;
    achievedAt: string;
    workoutSessionId?: string | null;
  }): PersonalRecord {
    const id = this.createEntity('PERSONAL_RECORD');
    this.database.raw
      .prepare(
        'INSERT INTO personal_records(id,exercise_id,record_type,value,unit,achieved_at,workout_session_id) VALUES (?,?,?,?,?,?,?)',
      )
      .run(
        id,
        input.exerciseId ?? null,
        input.recordType,
        input.value,
        input.unit,
        Date.parse(input.achievedAt),
        input.workoutSessionId ?? null,
      );
    this.audit(id, 1, 'PersonalRecordCreated', input);
    return this.requirePersonalRecord(id);
  }
  public listPersonalRecords(): readonly PersonalRecord[] {
    return (
      this.database.raw
        .prepare(
          'SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM personal_records item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL ORDER BY achieved_at DESC',
        )
        .all() as Record<string, unknown>[]
    ).map((x) => this.mapPersonalRecord(x));
  }
  public updatePersonalRecord(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<
        PersonalRecord,
        'exerciseId' | 'recordType' | 'value' | 'unit' | 'achievedAt' | 'workoutSessionId'
      >
    >,
    context?: OperationContext,
  ): PersonalRecord {
    const current = this.requirePersonalRecord(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    if (value.exerciseId) this.requireExercise(value.exerciseId);
    if (value.workoutSessionId) this.requireWorkoutSession(value.workoutSessionId);
    this.database.raw
      .prepare(
        'UPDATE personal_records SET exercise_id=?,record_type=?,value=?,unit=?,achieved_at=?,workout_session_id=? WHERE id=?',
      )
      .run(
        value.exerciseId,
        value.recordType,
        value.value,
        value.unit.trim(),
        Date.parse(value.achievedAt),
        value.workoutSessionId,
        id,
      );
    this.changed(id, 'PersonalRecordUpdated', patch, before, context);
    return this.requirePersonalRecord(id);
  }
  public createRecovery(input: {
    recordedDate: string;
    recoveryLevel: number;
    sorenessLevel?: number | null;
    energyLevel?: number | null;
    note?: string | null;
  }): RecoveryRecord {
    const id = this.createEntity('RECOVERY_RECORD');
    this.database.raw
      .prepare(
        'INSERT INTO recovery_records(id,recorded_date,recovery_level,soreness_level,energy_level,note) VALUES (?,?,?,?,?,?)',
      )
      .run(
        id,
        input.recordedDate,
        input.recoveryLevel,
        input.sorenessLevel ?? null,
        input.energyLevel ?? null,
        input.note ?? null,
      );
    this.audit(id, 1, 'RecoveryRecorded', input);
    return this.requireRecovery(id);
  }
  public listRecovery(): readonly RecoveryRecord[] {
    return (
      this.database.raw
        .prepare(
          'SELECT item.*,entity.version,entity.created_at,entity.updated_at FROM recovery_records item JOIN entity_index entity ON entity.id=item.id AND entity.deleted_at IS NULL ORDER BY recorded_date DESC',
        )
        .all() as Record<string, unknown>[]
    ).map((x) => this.mapRecovery(x));
  }
  public updateRecovery(
    id: string,
    expectedVersion: number,
    patch: Patch<
      Pick<
        RecoveryRecord,
        'recordedDate' | 'recoveryLevel' | 'sorenessLevel' | 'energyLevel' | 'note'
      >
    >,
    context?: OperationContext,
  ): RecoveryRecord {
    const current = this.requireRecovery(id);
    this.assertVersion(current.version, expectedVersion);
    const value = merge(current, patch),
      before = this.captureBefore(id, context);
    this.database.raw
      .prepare(
        'UPDATE recovery_records SET recorded_date=?,recovery_level=?,soreness_level=?,energy_level=?,note=? WHERE id=?',
      )
      .run(
        value.recordedDate,
        value.recoveryLevel,
        value.sorenessLevel,
        value.energyLevel,
        value.note,
        id,
      );
    this.changed(id, 'RecoveryUpdated', patch, before, context);
    return this.requireRecovery(id);
  }

  public softDelete(id: string, expectedVersion: number, context?: OperationContext): void {
    const row = this.database.raw
      .prepare('SELECT version,entity_type FROM entity_index WHERE id=? AND deleted_at IS NULL')
      .get(id) as { version: number; entity_type: string } | undefined;
    if (row === undefined) throw new Error('ENTITY_NOT_FOUND');
    this.assertVersion(row.version, expectedVersion);
    this.database.transaction(() => {
      const before =
        context === undefined || !this.canonicalHistory.supports(row.entity_type)
          ? undefined
          : this.canonicalHistory.captureCurrentState(id);
      const now = this.clock.now().getTime();
      this.database.raw
        .prepare(
          'UPDATE entity_index SET version=version+1,updated_at=?,deleted_at=?,purge_after=? WHERE id=?',
        )
        .run(now, now, now + 30 * 86_400_000, id);
      if (context !== undefined && before !== undefined)
        this.canonicalHistory.recordLifecycleChange({
          entityId: id,
          before,
          context,
          summary: 'LifeEntityDeleted',
          operation: 'SOFT_DELETE',
        });
      else this.audit(id, expectedVersion + 1, 'LifeEntityDeleted', { id });
    });
  }

  private createEntity(type: string): string {
    const id = ulid(),
      now = this.clock.now().getTime();
    this.database.raw
      .prepare('INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)')
      .run(id, type, now, now);
    return id;
  }
  private bump(id: string): number {
    this.database.raw
      .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
      .run(this.clock.now().getTime(), id);
    return (
      this.database.raw.prepare('SELECT version FROM entity_index WHERE id=?').get(id) as {
        version: number;
      }
    ).version;
  }
  private captureBefore(
    id: string,
    context: OperationContext | undefined,
  ): CanonicalEntitySnapshot | undefined {
    if (context === undefined) return undefined;
    const row = this.database.raw
      .prepare('SELECT entity_type FROM entity_index WHERE id=?')
      .get(id) as { entity_type: string } | undefined;
    return row !== undefined && this.canonicalHistory.supports(row.entity_type)
      ? this.canonicalHistory.captureCurrentState(id)
      : undefined;
  }
  private recordCreate(
    id: string,
    event: string,
    snapshot: unknown,
    context: OperationContext | undefined,
  ): void {
    if (context === undefined) this.audit(id, 1, event, snapshot);
    else this.canonicalHistory.recordCreate(id, context, event);
  }
  private changed(
    id: string,
    event: string,
    snapshot: unknown,
    before?: CanonicalEntitySnapshot,
    context?: OperationContext,
  ): void {
    const version = this.bump(id);
    if (context === undefined || before === undefined) this.audit(id, version, event, snapshot);
    else this.canonicalHistory.recordUpdate(id, before, context, event);
  }
  private audit(id: string, version: number, event: string, snapshot: unknown): void {
    const now = this.clock.now().getTime(),
      change = ulid();
    this.database.raw
      .prepare(
        `INSERT INTO change_sets(id,source,summary,risk_level,status,created_at,applied_at) VALUES (?,'USER',?,'LOW_WRITE','APPLIED',?,?)`,
      )
      .run(change, event, now, now);
    this.database.raw
      .prepare(
        `INSERT INTO entity_versions(id,entity_id,entity_version,change_set_id,source,snapshot_json,patch_json,created_at) VALUES (?,?,?,?, 'USER',?,'{}',?)`,
      )
      .run(ulid(), id, version, change, JSON.stringify(snapshot), now);
  }
  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) throw new Error('VERSION_CONFLICT');
  }
  private assertCategory(id: string, type: string): void {
    const row = this.database.raw
      .prepare('SELECT module_type,is_archived FROM categories WHERE id=?')
      .get(id) as { module_type: string; is_archived: number } | undefined;
    if (row?.module_type !== type || row.is_archived === 1) throw new Error('INVALID_CATEGORY');
  }
  private requireShoppingItem(id: string): ShoppingItem {
    const item = this.listShoppingItems().find((x) => x.id === id);
    if (!item) throw new Error('SHOPPING_ITEM_NOT_FOUND');
    return item;
  }
  private requirePurchase(id: string): PurchaseRecord {
    const item = this.listPurchases().find((x) => x.id === id);
    if (!item) throw new Error('PURCHASE_NOT_FOUND');
    return item;
  }
  private requireBudget(id: string): Budget {
    const item = this.listBudgets().find((x) => x.id === id);
    if (!item) throw new Error('BUDGET_NOT_FOUND');
    return item;
  }
  private requireRecipe(id: string): Recipe {
    const item = this.listRecipes().find((x) => x.id === id);
    if (!item) throw new Error('RECIPE_NOT_FOUND');
    return item;
  }
  private requireMealPlan(id: string): MealPlan {
    const item = this.listMealPlans().find((x) => x.id === id);
    if (!item) throw new Error('MEAL_PLAN_NOT_FOUND');
    return item;
  }
  private requireMeal(id: string): MealRecord {
    const item = this.listMeals().find((x) => x.id === id);
    if (!item) throw new Error('MEAL_NOT_FOUND');
    return item;
  }
  private requireHydration(id: string): HydrationRecord {
    const item = this.listHydration().find((x) => x.id === id);
    if (!item) throw new Error('HYDRATION_NOT_FOUND');
    return item;
  }
  private requirePreference(id: string): DietaryPreference {
    const item = this.listPreferences().find((x) => x.id === id);
    if (!item) throw new Error('DIETARY_PREFERENCE_NOT_FOUND');
    return item;
  }
  private requireExercise(id: string): Exercise {
    const item = this.listExercises().find((x) => x.id === id);
    if (!item) throw new Error('EXERCISE_NOT_FOUND');
    return item;
  }
  private requireWorkoutPlan(id: string): WorkoutPlan {
    const item = this.listWorkoutPlans().find((x) => x.id === id);
    if (!item) throw new Error('WORKOUT_PLAN_NOT_FOUND');
    return item;
  }
  private requireWorkoutSession(id: string): WorkoutSession {
    const item = this.listWorkoutSessions().find((x) => x.id === id);
    if (!item) throw new Error('WORKOUT_SESSION_NOT_FOUND');
    return item;
  }
  private requireBodyMeasurement(id: string): BodyMeasurement {
    const item = this.listBodyMeasurements().find((x) => x.id === id);
    if (!item) throw new Error('BODY_MEASUREMENT_NOT_FOUND');
    return item;
  }
  private requirePersonalRecord(id: string): PersonalRecord {
    const item = this.listPersonalRecords().find((x) => x.id === id);
    if (!item) throw new Error('PERSONAL_RECORD_NOT_FOUND');
    return item;
  }
  private requireRecovery(id: string): RecoveryRecord {
    const item = this.listRecovery().find((x) => x.id === id);
    if (!item) throw new Error('RECOVERY_RECORD_NOT_FOUND');
    return item;
  }
  private requireEntertainmentItem(id: string): EntertainmentItem {
    const item = this.listEntertainmentItems().find((x) => x.id === id);
    if (!item) throw new Error('ENTERTAINMENT_ITEM_NOT_FOUND');
    return item;
  }
  private requireEntertainmentSession(id: string): EntertainmentSession {
    const item = this.listEntertainmentSessions().find((x) => x.id === id);
    if (!item) throw new Error('ENTERTAINMENT_SESSION_NOT_FOUND');
    return item;
  }
  private base(row: Record<string, unknown>): LifeEntity {
    return {
      id: row.id as string,
      version: row.version as number,
      createdAt: iso(row.created_at as number),
      updatedAt: iso(row.updated_at as number),
    };
  }
  private mapShoppingItem(row: Record<string, unknown>): ShoppingItem {
    return {
      ...this.base(row),
      categoryId: row.category_id as string,
      name: row.name as string,
      productCategory: row.product_category as string | null,
      quantity: row.quantity as number,
      unit: row.unit as string | null,
      plannedUnitPriceMinor: row.planned_unit_price_minor as number | null,
      budgetAmountMinor: row.budget_amount_minor as number | null,
      priority: row.priority as Priority,
      status: row.status as ShoppingStatus,
      purchaseChannel: row.purchase_channel as string | null,
      taskId: row.task_id as string | null,
    };
  }
  private mapPurchase(row: Record<string, unknown>): PurchaseRecord {
    return {
      ...this.base(row),
      shoppingItemId: row.shopping_item_id as string | null,
      categoryId: row.category_id as string,
      productName: row.product_name as string,
      quantity: row.quantity as number,
      unitPriceMinor: row.unit_price_minor as number,
      totalAmountMinor: row.total_amount_minor as number,
      plannedTotalMinor: row.planned_total_minor as number | null,
      purchasedAt: iso(row.purchased_at as number),
      channel: row.channel as string | null,
      expenseEntryId: row.expense_entry_id as string,
    };
  }
  private mapBudget(row: Record<string, unknown>): Budget {
    return {
      ...this.base(row),
      categoryId: row.category_id as string | null,
      moduleType: row.module_type as Budget['moduleType'],
      periodType: row.period_type as Budget['periodType'],
      periodStart: row.period_start as string,
      periodEnd: row.period_end as string,
      amountMinor: row.amount_minor as number,
      currency: row.currency as string,
      alertThresholdPercent: row.alert_threshold_percent as number,
    };
  }
  private mapRecipe(row: Record<string, unknown>): Recipe {
    return {
      ...this.base(row),
      categoryId: row.category_id as string,
      name: row.name as string,
      description: row.description as string | null,
      servings: row.servings as number,
      caloriesKcal: row.calories_kcal as number | null,
      proteinG: row.protein_g as number | null,
      carbsG: row.carbs_g as number | null,
      fatG: row.fat_g as number | null,
    };
  }
  private mapMealPlan(row: Record<string, unknown>): MealPlan {
    return {
      ...this.base(row),
      categoryId: row.category_id as string,
      mealDate: row.meal_date as string,
      mealType: row.meal_type as MealType,
      plannedAt: row.planned_at === null ? null : iso(row.planned_at as number),
      recipeId: row.recipe_id as string | null,
      title: row.title as string,
      eventId: row.event_id as string | null,
      taskId: row.task_id as string | null,
      status: row.status as MealPlan['status'],
    };
  }
  private mapMeal(row: Record<string, unknown>): MealRecord {
    return {
      ...this.base(row),
      categoryId: row.category_id as string,
      mealPlanId: row.meal_plan_id as string | null,
      mealType: row.meal_type as MealType,
      title: row.title as string,
      eatenAt: iso(row.eaten_at as number),
      caloriesKcal: row.calories_kcal as number | null,
      proteinG: row.protein_g as number | null,
      carbsG: row.carbs_g as number | null,
      fatG: row.fat_g as number | null,
      fiberG: row.fiber_g as number | null,
      sodiumMg: row.sodium_mg as number | null,
      otherNutrition: JSON.parse(row.other_nutrition_json as string) as Record<string, unknown>,
      expenseEntryId: row.expense_entry_id as string | null,
    };
  }
  private mapHydration(row: Record<string, unknown>): HydrationRecord {
    return {
      ...this.base(row),
      recordedAt: iso(row.recorded_at as number),
      amountMl: row.amount_ml as number,
      note: row.note as string | null,
    };
  }
  private mapPreference(row: Record<string, unknown>): DietaryPreference {
    return {
      ...this.base(row),
      preferenceType: row.preference_type as DietaryPreference['preferenceType'],
      name: row.name as string,
      severity: row.severity as string | null,
      note: row.note as string | null,
      isActive: (row.is_active as number) === 1,
    };
  }
  private mapExercise(row: Record<string, unknown>): Exercise {
    return {
      ...this.base(row),
      name: row.name as string,
      exerciseType: row.exercise_type as Exercise['exerciseType'],
      muscleGroups: JSON.parse(row.muscle_groups_json as string) as string[],
      defaultUnit: row.default_unit as string | null,
      instructions: row.instructions as string | null,
    };
  }
  private mapWorkoutPlan(row: Record<string, unknown>): WorkoutPlan {
    const items = (
      this.database.raw
        .prepare('SELECT * FROM workout_plan_items WHERE workout_plan_id=? ORDER BY sort_order')
        .all(row.id) as Record<string, unknown>[]
    ).map((x) => ({
      id: x.id as string,
      exerciseId: x.exercise_id as string,
      setsTarget: x.sets_target as number | null,
      repsTarget: x.reps_target as string | null,
      weightTarget: x.weight_target as number | null,
      durationSecondsTarget: x.duration_seconds_target as number | null,
      distanceTarget: x.distance_target as number | null,
      sortOrder: x.sort_order as number,
    }));
    return {
      ...this.base(row),
      categoryId: row.category_id as string,
      name: row.name as string,
      description: row.description as string | null,
      goalId: row.goal_id as string | null,
      status: row.status as WorkoutPlan['status'],
      items,
    };
  }
  private mapWorkoutSession(row: Record<string, unknown>): WorkoutSession {
    const sets = (
      this.database.raw
        .prepare('SELECT * FROM workout_sets WHERE session_id=? ORDER BY set_number')
        .all(row.id) as Record<string, unknown>[]
    ).map((x) => ({
      id: x.id as string,
      exerciseId: x.exercise_id as string,
      setNumber: x.set_number as number,
      reps: x.reps as number | null,
      weight: x.weight as number | null,
      durationSeconds: x.duration_seconds as number | null,
      distance: x.distance as number | null,
      completed: (x.completed as number) === 1,
    }));
    return {
      ...this.base(row),
      categoryId: row.category_id as string,
      workoutPlanId: row.workout_plan_id as string | null,
      taskId: row.task_id as string | null,
      startedAt: iso(row.started_at as number),
      endedAt: iso(row.ended_at as number),
      durationMinutes: row.duration_minutes as number,
      caloriesBurned: row.calories_burned as number | null,
      perceivedEffort: row.perceived_effort as number | null,
      note: row.note as string | null,
      sets,
    };
  }
  private mapBodyMeasurement(row: Record<string, unknown>): BodyMeasurement {
    return {
      ...this.base(row),
      measuredAt: iso(row.measured_at as number),
      weightKg: row.weight_kg as number | null,
      bodyFatPercent: row.body_fat_percent as number | null,
      waistCm: row.waist_cm as number | null,
      chestCm: row.chest_cm as number | null,
      hipCm: row.hip_cm as number | null,
      note: row.note as string | null,
    };
  }
  private mapPersonalRecord(row: Record<string, unknown>): PersonalRecord {
    return {
      ...this.base(row),
      exerciseId: row.exercise_id as string | null,
      recordType: row.record_type as PersonalRecord['recordType'],
      value: row.value as number,
      unit: row.unit as string,
      achievedAt: iso(row.achieved_at as number),
      workoutSessionId: row.workout_session_id as string | null,
    };
  }
  private mapRecovery(row: Record<string, unknown>): RecoveryRecord {
    return {
      ...this.base(row),
      recordedDate: row.recorded_date as string,
      recoveryLevel: row.recovery_level as number,
      sorenessLevel: row.soreness_level as number | null,
      energyLevel: row.energy_level as number | null,
      note: row.note as string | null,
    };
  }
  private mapEntertainmentItem(row: Record<string, unknown>): EntertainmentItem {
    const trip = this.database.raw
      .prepare('SELECT * FROM activity_trip_details WHERE entertainment_item_id=?')
      .get(row.id) as Record<string, unknown> | undefined;
    return {
      ...this.base(row),
      categoryId: row.category_id as string,
      title: row.title as string,
      itemType: row.item_type as EntertainmentItem['itemType'],
      listType: row.list_type as EntertainmentItem['listType'],
      status: row.status as EntertainmentItem['status'],
      progressCurrent: row.progress_current as number | null,
      progressTotal: row.progress_total as number | null,
      progressUnit: row.progress_unit as string | null,
      startedAt: row.started_at === null ? null : iso(row.started_at as number),
      completedAt: row.completed_at === null ? null : iso(row.completed_at as number),
      rating: row.rating as number | null,
      note: row.note as string | null,
      tripDetails: trip
        ? {
            startAt: trip.start_at === null ? null : iso(trip.start_at as number),
            endAt: trip.end_at === null ? null : iso(trip.end_at as number),
            location: trip.location as string | null,
            eventId: trip.event_id as string | null,
            taskId: trip.task_id as string | null,
            details: JSON.parse(trip.details_json as string) as Record<string, unknown>,
          }
        : null,
    };
  }
  private mapEntertainmentSession(row: Record<string, unknown>): EntertainmentSession {
    return {
      ...this.base(row),
      itemId: row.item_id as string,
      sessionDate: row.session_date as string,
      durationMinutes: row.duration_minutes as number,
      progressDelta: row.progress_delta as number | null,
      note: row.note as string | null,
    };
  }
}
