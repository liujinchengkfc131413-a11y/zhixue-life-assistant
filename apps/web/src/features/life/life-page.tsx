import { Link } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { formatDateTime } from '../../shared/format.js';
import { useFormDraft } from '../../shared/form-draft.js';
import { LocalDateInput } from '../../shared/product-fields.js';
import { readEntityDetailTarget } from '../../shared/entity-detail-target.js';

import { ErrorState } from '../../shared/state-panel.js';
import { useCategories } from '../settings/api.js';
import {
  useBudgets,
  useCreateBudget,
  useCompleteMealPlan,
  useBodyMeasurements,
  useCreateDietaryPreference,
  useCreateBodyMeasurement,
  useCreateExercise,
  useCreateEntertainmentExpense,
  useCreateEntertainmentItem,
  useCreateEntertainmentSession,
  useCreateHydration,
  useCreateMeal,
  useCreateMealPlan,
  useCreateRecipe,
  useCreatePersonalRecord,
  useCreateRecovery,
  useCreateWorkoutPlan,
  useCreateWorkoutSession,
  useCreateShoppingItem,
  useDeleteDietaryPreference,
  useDeleteHydration,
  useDeleteMeal,
  useDeleteExercise,
  useDeleteWorkoutPlan,
  useDeleteWorkoutSession,
  useDeleteBodyMeasurement,
  useDeletePersonalRecord,
  useDeleteRecovery,
  useDeleteEntertainmentItem,
  useDeleteEntertainmentSession,
  useDeleteShoppingItem,
  useDietaryPreferences,
  useExercises,
  useEntertainmentItems,
  useEntertainmentSessions,
  useHydration,
  useLifeOverview,
  useMealPlans,
  useMeals,
  usePurchaseShoppingItem,
  usePurchases,
  useRecipes,
  usePersonalRecords,
  useRecovery,
  useSetEntertainmentProgress,
  useShoppingItems,
  useUpdateShoppingItem,
  useUpdateDietaryPreference,
  useUpdateHydration,
  useUpdateMeal,
  useUpdateExercise,
  useUpdateWorkoutSession,
  useUpdateBodyMeasurement,
  useUpdatePersonalRecord,
  useUpdateRecovery,
  useUpdateEntertainmentItem,
  useUpdateEntertainmentSession,
  useUpdateRecipe,
  useUpdateWorkoutPlan,
  usePutTripDetails,
  useWorkoutPlans,
  useWorkoutSessions,
  type LifeRange,
} from './api.js';

export type LifeSection = 'overview' | 'shopping' | 'diet' | 'fitness' | 'entertainment';
const links = [
  ['overview', '/life', '生活总览'],
  ['shopping', '/life/shopping', '购物'],
  ['diet', '/life/diet', '饮食'],
  ['fitness', '/life/fitness', '健身'],
  ['entertainment', '/life/entertainment', '娱乐'],
] as const;
const today = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};
const money = (minor: number) =>
  `¥${(minor / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusText: Record<string, string> = {
  WANTED: '想买',
  RESEARCHING: '比价中',
  READY: '待购买',
  PURCHASED: '已购买',
  CANCELLED: '已取消',
};
const priorityText = { LOW: '低', NORMAL: '普通', HIGH: '高', URGENT: '紧急' } as const;
type ShoppingPriority = keyof typeof priorityText;
type ShoppingStatus = 'WANTED' | 'RESEARCHING' | 'READY' | 'PURCHASED' | 'CANCELLED';

interface ShoppingCreateDraft {
  readonly name: string;
  readonly productCategory: string;
  readonly quantity: string;
  readonly unit: string;
  readonly price: string;
  readonly priority: ShoppingPriority;
  readonly channel: string;
}

interface ShoppingEditDraft extends ShoppingCreateDraft {
  readonly status: ShoppingStatus;
}

interface ShoppingEditableItem {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly productCategory: string | null;
  readonly quantity: number;
  readonly unit: string | null;
  readonly plannedUnitPriceMinor: number | null;
  readonly priority: ShoppingPriority;
  readonly status: ShoppingStatus;
  readonly purchaseChannel: string | null;
}

const shoppingPriorities = Object.keys(priorityText) as ShoppingPriority[];
const shoppingStatuses: readonly ShoppingStatus[] = [
  'WANTED',
  'RESEARCHING',
  'READY',
  'PURCHASED',
  'CANCELLED',
];

const parseShoppingCreateDraft = (value: unknown): ShoppingCreateDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.name !== 'string' ||
    typeof draft.productCategory !== 'string' ||
    typeof draft.quantity !== 'string' ||
    typeof draft.unit !== 'string' ||
    typeof draft.price !== 'string' ||
    typeof draft.priority !== 'string' ||
    !shoppingPriorities.includes(draft.priority as ShoppingPriority) ||
    typeof draft.channel !== 'string'
  ) {
    return undefined;
  }
  return {
    name: draft.name,
    productCategory: draft.productCategory,
    quantity: draft.quantity,
    unit: draft.unit,
    price: draft.price,
    priority: draft.priority as ShoppingPriority,
    channel: draft.channel,
  };
};

const parseShoppingEditDraft = (value: unknown): ShoppingEditDraft | undefined => {
  const draft = parseShoppingCreateDraft(value);
  if (draft === undefined || typeof value !== 'object' || value === null) return undefined;
  const status = (value as Record<string, unknown>).status;
  if (typeof status !== 'string' || !shoppingStatuses.includes(status as ShoppingStatus)) {
    return undefined;
  }
  return { ...draft, status: status as ShoppingStatus };
};

const newShoppingDraft = (): ShoppingCreateDraft => ({
  name: '',
  productCategory: '',
  quantity: '1',
  unit: '',
  price: '',
  priority: 'NORMAL',
  channel: '',
});

export const ShoppingItemCreateForm = ({
  categoryId,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly isPending: boolean;
  readonly onCreate: (
    input: ShoppingCreateDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
}) => {
  const [value, setValue] = useState<ShoppingCreateDraft>(newShoppingDraft);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: ShoppingCreateDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'SHOPPING_ITEM',
    mode: 'create',
    enabled: true,
    dirty,
    value,
    parse: parseShoppingCreateDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof ShoppingCreateDraft>(key: K, next: ShoppingCreateDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const reset = () => {
    setValue(newShoppingDraft());
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      id="life-create-panel"
      className="inline-work-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...value, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="新增待购商品"
        placeholder="新增待购商品"
        value={value.name}
        required
        onChange={(event) => {
          change('name', event.target.value);
        }}
      />
      <input
        aria-label="新增待购商品分类"
        placeholder="商品分类"
        value={value.productCategory}
        onChange={(event) => {
          change('productCategory', event.target.value);
        }}
      />
      <div className="form-grid">
        <input
          aria-label="新增待购数量"
          type="number"
          min="0.01"
          step="0.01"
          value={value.quantity}
          onChange={(event) => {
            change('quantity', event.target.value);
          }}
        />
        <input
          aria-label="新增待购单位"
          placeholder="单位"
          value={value.unit}
          onChange={(event) => {
            change('unit', event.target.value);
          }}
        />
        <input
          aria-label="新增待购计划单价"
          type="number"
          min="0"
          step="0.01"
          placeholder="计划单价（元）"
          value={value.price}
          onChange={(event) => {
            change('price', event.target.value);
          }}
        />
      </div>
      <select
        aria-label="新增待购优先级"
        value={value.priority}
        onChange={(event) => {
          change('priority', event.target.value as ShoppingPriority);
        }}
      >
        <option value="NORMAL">普通优先级</option>
        <option value="HIGH">高优先级</option>
        <option value="URGENT">紧急</option>
        <option value="LOW">低优先级</option>
      </select>
      <input
        aria-label="新增待购购买渠道"
        placeholder="购买渠道（可选）"
        value={value.channel}
        onChange={(event) => {
          change('channel', event.target.value);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={categoryId === undefined || isPending}>
          加入清单
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

export const ShoppingItemEditor = ({
  item,
  isPending,
  onSave,
  onDelete,
}: {
  readonly item: ShoppingEditableItem;
  readonly isPending: boolean;
  readonly onSave: (
    input: ShoppingEditDraft & { id: string; version: number },
    onSuccess: () => void,
  ) => void;
  readonly onDelete: (input: { id: string; version: number }, onSuccess: () => void) => void;
}) => {
  const initialValue = useMemo<ShoppingEditDraft>(
    () => ({
      name: item.name,
      productCategory: item.productCategory ?? '',
      quantity: String(item.quantity),
      unit: item.unit ?? '',
      price: item.plannedUnitPriceMinor === null ? '' : String(item.plannedUnitPriceMinor / 100),
      priority: item.priority,
      status: item.status,
      channel: item.purchaseChannel ?? '',
    }),
    [item],
  );
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: ShoppingEditDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'SHOPPING_ITEM',
    mode: 'edit',
    entityId: item.id,
    enabled: true,
    dirty,
    value,
    parse: parseShoppingEditDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof ShoppingEditDraft>(key: K, next: ShoppingEditDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const reset = () => {
    setValue(initialValue);
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      className="compact-form compact-form--flush"
      data-version={item.version}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...value, id: item.id, version: item.version }, () => {
          formDraft.clear();
          setDirty(false);
          setRestoredAt(undefined);
        });
      }}
    >
      <h2>待购详情</h2>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        aria-label="编辑待购商品名称"
        value={value.name}
        required
        onChange={(event) => {
          change('name', event.target.value);
        }}
      />
      <input
        aria-label="编辑待购商品分类"
        value={value.productCategory}
        placeholder="商品分类"
        onChange={(event) => {
          change('productCategory', event.target.value);
        }}
      />
      <div className="form-grid">
        <input
          aria-label="编辑待购数量"
          type="number"
          min="0.01"
          step="0.01"
          value={value.quantity}
          onChange={(event) => {
            change('quantity', event.target.value);
          }}
        />
        <input
          aria-label="编辑待购单位"
          value={value.unit}
          placeholder="单位"
          onChange={(event) => {
            change('unit', event.target.value);
          }}
        />
      </div>
      <input
        aria-label="编辑待购计划单价"
        type="number"
        step="0.01"
        value={value.price}
        placeholder="计划单价（元）"
        onChange={(event) => {
          change('price', event.target.value);
        }}
      />
      <select
        aria-label="编辑待购优先级"
        value={value.priority}
        onChange={(event) => {
          change('priority', event.target.value as ShoppingPriority);
        }}
      >
        {shoppingPriorities.map((priority) => (
          <option key={priority} value={priority}>
            {priorityText[priority]}
          </option>
        ))}
      </select>
      <select
        aria-label="编辑待购状态"
        value={value.status}
        onChange={(event) => {
          change('status', event.target.value as ShoppingStatus);
        }}
      >
        {shoppingStatuses.map((status) => (
          <option key={status} value={status}>
            {statusText[status]}
          </option>
        ))}
      </select>
      <input
        aria-label="编辑待购购买渠道"
        value={value.channel}
        placeholder="购买渠道"
        onChange={(event) => {
          change('channel', event.target.value);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={isPending}>
          保存修改
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
        <button
          type="button"
          className="button button--danger"
          onClick={() => {
            if (window.confirm('确定删除该待购项？')) {
              onDelete({ id: item.id, version: item.version }, formDraft.clear);
            }
          }}
        >
          删除
        </button>
      </div>
    </form>
  );
};

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
const mealTypes: readonly MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const isMealType = (value: unknown): value is MealType => mealTypes.includes(value as MealType);

interface MealPlanDraft {
  readonly title: string;
  readonly date: string;
  readonly mealType: MealType;
  readonly recipeId: string;
}

const parseMealPlanDraft = (value: unknown): MealPlanDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.date !== 'string' ||
    !isMealType(draft.mealType) ||
    typeof draft.recipeId !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    date: draft.date,
    mealType: draft.mealType,
    recipeId: draft.recipeId,
  };
};

const newMealPlanDraft = (): MealPlanDraft => ({
  title: '',
  date: today(),
  mealType: 'BREAKFAST',
  recipeId: '',
});

export const MealPlanCreateForm = ({
  categoryId,
  recipes,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly recipes: readonly { readonly id: string; readonly name: string }[];
  readonly isPending: boolean;
  readonly onCreate: (input: MealPlanDraft & { categoryId: string }, onSuccess: () => void) => void;
}) => {
  const [value, setValue] = useState<MealPlanDraft>(newMealPlanDraft);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: MealPlanDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'MEAL_PLAN',
    mode: 'create',
    enabled: true,
    dirty,
    value,
    parse: parseMealPlanDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof MealPlanDraft>(key: K, next: MealPlanDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const reset = () => {
    setValue(newMealPlanDraft());
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      id="life-create-panel"
      className="inline-work-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...value, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      <h3>安排一餐</h3>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        name="title"
        placeholder="餐食名称"
        value={value.title}
        required
        onChange={(event) => {
          change('title', event.target.value);
        }}
      />
      <div className="form-grid">
        <LocalDateInput
          name="date"
          value={value.date}
          required
          onChange={(event) => {
            change('date', event.target.value);
          }}
        />
        <select
          name="mealType"
          value={value.mealType}
          onChange={(event) => {
            change('mealType', event.target.value as MealType);
          }}
        >
          <option value="BREAKFAST">早餐</option>
          <option value="LUNCH">午餐</option>
          <option value="DINNER">晚餐</option>
          <option value="SNACK">加餐</option>
        </select>
      </div>
      <select
        name="recipeId"
        value={value.recipeId}
        onChange={(event) => {
          change('recipeId', event.target.value);
        }}
      >
        <option value="">不关联食谱</option>
        {recipes.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <div className="form-actions">
        <button className="button button--primary" disabled={categoryId === undefined || isPending}>
          加入餐食计划
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

interface MealRecordDraft {
  readonly title: string;
  readonly date: string;
  readonly mealType: MealType;
  readonly calories: string;
  readonly amount: string;
  readonly merchant: string;
}

const parseMealRecordDraft = (value: unknown): MealRecordDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.date !== 'string' ||
    !isMealType(draft.mealType) ||
    typeof draft.calories !== 'string' ||
    typeof draft.amount !== 'string' ||
    typeof draft.merchant !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    date: draft.date,
    mealType: draft.mealType,
    calories: draft.calories,
    amount: draft.amount,
    merchant: draft.merchant,
  };
};

const newMealRecordDraft = (): MealRecordDraft => ({
  title: '',
  date: today(),
  mealType: 'BREAKFAST',
  calories: '',
  amount: '',
  merchant: '',
});

export const MealRecordCreateForm = ({
  categoryId,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly isPending: boolean;
  readonly onCreate: (
    input: MealRecordDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
}) => {
  const [value, setValue] = useState<MealRecordDraft>(newMealRecordDraft);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: MealRecordDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'MEAL_RECORD',
    mode: 'create',
    enabled: true,
    dirty,
    value,
    parse: parseMealRecordDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof MealRecordDraft>(key: K, next: MealRecordDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const reset = () => {
    setValue(newMealRecordDraft());
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      className="compact-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...value, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      <h3>直接记录一餐</h3>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        name="title"
        placeholder="吃了什么"
        value={value.title}
        required
        onChange={(event) => {
          change('title', event.target.value);
        }}
      />
      <div className="form-grid">
        <LocalDateInput
          name="date"
          value={value.date}
          required
          onChange={(event) => {
            change('date', event.target.value);
          }}
        />
        <select
          name="mealType"
          value={value.mealType}
          onChange={(event) => {
            change('mealType', event.target.value as MealType);
          }}
        >
          <option value="BREAKFAST">早餐</option>
          <option value="LUNCH">午餐</option>
          <option value="DINNER">晚餐</option>
          <option value="SNACK">加餐</option>
        </select>
      </div>
      <input
        name="calories"
        type="number"
        min="0"
        placeholder="热量 kcal"
        value={value.calories}
        onChange={(event) => {
          change('calories', event.target.value);
        }}
      />
      <div className="form-grid">
        <input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="餐饮支出（元）"
          value={value.amount}
          onChange={(event) => {
            change('amount', event.target.value);
          }}
        />
        <input
          name="merchant"
          placeholder="商家"
          value={value.merchant}
          onChange={(event) => {
            change('merchant', event.target.value);
          }}
        />
      </div>
      <div className="form-actions">
        <button className="button" disabled={categoryId === undefined || isPending}>
          记录
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

interface WorkoutSessionDraft {
  readonly date: string;
  readonly planId: string;
  readonly exerciseId: string;
  readonly reps: string;
  readonly weight: string;
  readonly calories: string;
  readonly effort: string;
  readonly note: string;
}

const parseWorkoutSessionDraft = (value: unknown): WorkoutSessionDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.date !== 'string' ||
    typeof draft.planId !== 'string' ||
    typeof draft.exerciseId !== 'string' ||
    typeof draft.reps !== 'string' ||
    typeof draft.weight !== 'string' ||
    typeof draft.calories !== 'string' ||
    typeof draft.effort !== 'string' ||
    typeof draft.note !== 'string'
  ) {
    return undefined;
  }
  return {
    date: draft.date,
    planId: draft.planId,
    exerciseId: draft.exerciseId,
    reps: draft.reps,
    weight: draft.weight,
    calories: draft.calories,
    effort: draft.effort,
    note: draft.note,
  };
};

const newWorkoutSessionDraft = (): WorkoutSessionDraft => ({
  date: today(),
  planId: '',
  exerciseId: '',
  reps: '',
  weight: '',
  calories: '',
  effort: '',
  note: '',
});

export const WorkoutSessionCreateForm = ({
  categoryId,
  plans,
  exercises,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly plans: readonly { readonly id: string; readonly name: string }[];
  readonly exercises: readonly { readonly id: string; readonly name: string }[];
  readonly isPending: boolean;
  readonly onCreate: (
    input: WorkoutSessionDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
}) => {
  const [value, setValue] = useState<WorkoutSessionDraft>(newWorkoutSessionDraft);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: WorkoutSessionDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'WORKOUT_SESSION',
    mode: 'create',
    enabled: true,
    dirty,
    value,
    parse: parseWorkoutSessionDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof WorkoutSessionDraft>(key: K, next: WorkoutSessionDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const reset = () => {
    setValue(newWorkoutSessionDraft());
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      id="life-create-panel"
      className="inline-work-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...value, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      <h3>完成一次训练</h3>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <div className="form-grid">
        <LocalDateInput
          name="date"
          value={value.date}
          required
          onChange={(event) => {
            change('date', event.target.value);
          }}
        />
        <select
          name="planId"
          value={value.planId}
          onChange={(event) => {
            change('planId', event.target.value);
          }}
        >
          <option value="">自由训练</option>
          {plans.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
      <select
        name="exerciseId"
        value={value.exerciseId}
        onChange={(event) => {
          change('exerciseId', event.target.value);
        }}
      >
        <option value="">不记录动作组</option>
        {exercises.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <div className="form-grid">
        <input
          name="reps"
          type="number"
          min="0"
          placeholder="次数"
          value={value.reps}
          onChange={(event) => {
            change('reps', event.target.value);
          }}
        />
        <input
          name="weight"
          type="number"
          min="0"
          step="0.1"
          placeholder="重量 kg"
          value={value.weight}
          onChange={(event) => {
            change('weight', event.target.value);
          }}
        />
      </div>
      <div className="form-grid">
        <input
          name="calories"
          type="number"
          min="0"
          placeholder="消耗 kcal"
          value={value.calories}
          onChange={(event) => {
            change('calories', event.target.value);
          }}
        />
        <input
          name="effort"
          type="number"
          min="1"
          max="10"
          placeholder="主观强度 1–10"
          value={value.effort}
          onChange={(event) => {
            change('effort', event.target.value);
          }}
        />
      </div>
      <input
        name="note"
        placeholder="训练备注"
        value={value.note}
        onChange={(event) => {
          change('note', event.target.value);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={categoryId === undefined || isPending}>
          保存训练
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

interface WorkoutPlanDraft {
  readonly name: string;
  readonly description: string;
  readonly exerciseId: string;
  readonly sets: string;
  readonly reps: string;
  readonly weight: string;
}

const parseWorkoutPlanDraft = (value: unknown): WorkoutPlanDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.name !== 'string' ||
    typeof draft.description !== 'string' ||
    typeof draft.exerciseId !== 'string' ||
    typeof draft.sets !== 'string' ||
    typeof draft.reps !== 'string' ||
    typeof draft.weight !== 'string'
  ) {
    return undefined;
  }
  return {
    name: draft.name,
    description: draft.description,
    exerciseId: draft.exerciseId,
    sets: draft.sets,
    reps: draft.reps,
    weight: draft.weight,
  };
};

const newWorkoutPlanDraft = (): WorkoutPlanDraft => ({
  name: '',
  description: '',
  exerciseId: '',
  sets: '',
  reps: '',
  weight: '',
});

export const WorkoutPlanCreateForm = ({
  categoryId,
  exercises,
  planCount,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly exercises: readonly { readonly id: string; readonly name: string }[];
  readonly planCount: number;
  readonly isPending: boolean;
  readonly onCreate: (
    input: WorkoutPlanDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
}) => {
  const [value, setValue] = useState<WorkoutPlanDraft>(newWorkoutPlanDraft);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: WorkoutPlanDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'WORKOUT_PLAN',
    mode: 'create',
    enabled: true,
    dirty,
    value,
    parse: parseWorkoutPlanDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof WorkoutPlanDraft>(key: K, next: WorkoutPlanDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const reset = () => {
    setValue(newWorkoutPlanDraft());
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      className="compact-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...value, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      <h3>训练计划 · {planCount}</h3>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        name="name"
        placeholder="训练计划名称"
        value={value.name}
        required
        onChange={(event) => {
          change('name', event.target.value);
        }}
      />
      <input
        name="description"
        placeholder="计划说明"
        value={value.description}
        onChange={(event) => {
          change('description', event.target.value);
        }}
      />
      <select
        name="exerciseId"
        value={value.exerciseId}
        onChange={(event) => {
          change('exerciseId', event.target.value);
        }}
      >
        <option value="">暂不添加动作</option>
        {exercises.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <div className="form-grid">
        <input
          name="sets"
          type="number"
          min="1"
          placeholder="目标组数"
          value={value.sets}
          onChange={(event) => {
            change('sets', event.target.value);
          }}
        />
        <input
          name="reps"
          placeholder="目标次数，如 8–10"
          value={value.reps}
          onChange={(event) => {
            change('reps', event.target.value);
          }}
        />
      </div>
      <input
        name="weight"
        type="number"
        min="0"
        step="0.1"
        placeholder="目标重量 kg"
        value={value.weight}
        onChange={(event) => {
          change('weight', event.target.value);
        }}
      />
      <div className="form-actions">
        <button className="button" disabled={categoryId === undefined || isPending}>
          创建计划
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

type EntertainmentItemType =
  'MOVIE' | 'SERIES' | 'BOOK' | 'COMIC' | 'GAME' | 'ACTIVITY' | 'TRIP' | 'OTHER';
const entertainmentItemTypes: readonly EntertainmentItemType[] = [
  'MOVIE',
  'SERIES',
  'BOOK',
  'COMIC',
  'GAME',
  'ACTIVITY',
  'TRIP',
  'OTHER',
];

interface EntertainmentItemDraft {
  readonly title: string;
  readonly itemType: EntertainmentItemType;
  readonly total: string;
  readonly unit: string;
  readonly note: string;
}

const parseEntertainmentItemDraft = (value: unknown): EntertainmentItemDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    !entertainmentItemTypes.includes(draft.itemType as EntertainmentItemType) ||
    typeof draft.total !== 'string' ||
    typeof draft.unit !== 'string' ||
    typeof draft.note !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    itemType: draft.itemType as EntertainmentItemType,
    total: draft.total,
    unit: draft.unit,
    note: draft.note,
  };
};

const newEntertainmentItemDraft = (): EntertainmentItemDraft => ({
  title: '',
  itemType: 'MOVIE',
  total: '',
  unit: '',
  note: '',
});

export const EntertainmentItemCreateForm = ({
  categoryId,
  isPending,
  onCreate,
}: {
  readonly categoryId?: string;
  readonly isPending: boolean;
  readonly onCreate: (
    input: EntertainmentItemDraft & { categoryId: string },
    onSuccess: () => void,
  ) => void;
}) => {
  const [value, setValue] = useState<EntertainmentItemDraft>(newEntertainmentItemDraft);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: EntertainmentItemDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'ENTERTAINMENT_ITEM',
    mode: 'create',
    enabled: true,
    dirty,
    value,
    parse: parseEntertainmentItemDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof EntertainmentItemDraft>(
    key: K,
    next: EntertainmentItemDraft[K],
  ) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const reset = () => {
    setValue(newEntertainmentItemDraft());
    setDirty(false);
    setRestoredAt(undefined);
  };

  return (
    <form
      id="life-create-panel"
      className="inline-work-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (categoryId === undefined) return;
        onCreate({ ...value, categoryId }, () => {
          formDraft.clear();
          reset();
        });
      }}
    >
      <h3>加入想看、想玩或想去</h3>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <input
        name="title"
        placeholder="娱乐条目名称"
        value={value.title}
        required
        onChange={(event) => {
          change('title', event.target.value);
        }}
      />
      <select
        name="itemType"
        value={value.itemType}
        onChange={(event) => {
          change('itemType', event.target.value as EntertainmentItemType);
        }}
      >
        <option value="MOVIE">电影</option>
        <option value="SERIES">剧集</option>
        <option value="BOOK">休闲书籍</option>
        <option value="COMIC">漫画</option>
        <option value="GAME">游戏</option>
        <option value="ACTIVITY">活动</option>
        <option value="TRIP">旅行</option>
        <option value="OTHER">其他</option>
      </select>
      <div className="form-grid">
        <input
          name="total"
          type="number"
          min="0"
          step="0.1"
          placeholder="总进度"
          value={value.total}
          onChange={(event) => {
            change('total', event.target.value);
          }}
        />
        <input
          name="unit"
          placeholder="进度单位，如集/章"
          value={value.unit}
          onChange={(event) => {
            change('unit', event.target.value);
          }}
        />
      </div>
      <input
        name="note"
        placeholder="备注"
        value={value.note}
        onChange={(event) => {
          change('note', event.target.value);
        }}
      />
      <div className="form-actions">
        <button className="button button--primary" disabled={categoryId === undefined || isPending}>
          加入清单
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              formDraft.clear();
              reset();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
      </div>
    </form>
  );
};

const LifeNav = ({ section }: { section: LifeSection }) => (
  <nav className="module-tabs work-tabs" aria-label="生活模块">
    {links.map(([id, to, label]) => (
      <Link key={id} to={to} className="work-tabs__link" data-selected={id === section}>
        {label}
      </Link>
    ))}
  </nav>
);
const Overview = () => {
  const [range, setRange] = useState<LifeRange>('MONTH'),
    query = useLifeOverview(range),
    value = query.data;
  return (
    <>
      {
        <div className="module-toolbar work-toolbar">
          <div className="range-control">
            {(['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const).map((x) => (
              <button
                key={x}
                className="button button--small"
                data-selected={range === x}
                onClick={() => {
                  setRange(x);
                }}
              >
                {{ WEEK: '本周', MONTH: '本月', QUARTER: '本季度', YEAR: '本年' }[x]}
              </button>
            ))}
          </div>
          <span>
            {value?.range.from} — {value?.range.to}
          </span>
        </div>
      }{' '}
      {query.isLoading ? (
        <p className="status-line">正在汇总生活数据…</p>
      ) : query.isError ? (
        <ErrorState>生活数据暂时无法加载。请确认本地服务运行正常后重试。</ErrorState>
      ) : value ? (
        <>
          <section className="metric-strip life-highlights work-metrics" aria-label="近期生活概览">
            <article>
              <span>生活支出</span>
              <strong>{money(value.expenses.totalMinor)}</strong>
              <small>范围内实际消费</small>
            </article>
            <article>
              <span>预算使用</span>
              <strong>{value.budgets.usedPercent}%</strong>
              <small>{money(value.budgets.totalMinor)} 总预算</small>
            </article>
            <article>
              <span>待购事项</span>
              <strong>{value.shopping.pending}</strong>
              <small>项待处理</small>
            </article>
            <article>
              <span>已完成购买</span>
              <strong>{value.shopping.purchased}</strong>
              <small>{money(value.shopping.actualMinor)}</small>
            </article>
          </section>
          <div className="life-overview-grid overview-grid work-overview-grid">
            <section className="life-overview-card module-surface work-module">
              <div className="section-heading">
                <h2>购物</h2>
                <Link to="/life/shopping">进入明细</Link>
              </div>
              <p className="work-module__number">{value.shopping.pending} 项待购</p>
              <dl>
                <div>
                  <dt>计划金额</dt>
                  <dd>{money(value.shopping.plannedMinor)}</dd>
                </div>
                <div>
                  <dt>实际金额</dt>
                  <dd>{money(value.shopping.actualMinor)}</dd>
                </div>
              </dl>
            </section>
            <section className="life-overview-card module-surface work-module">
              <div className="section-heading">
                <h2>饮食</h2>
                <Link to="/life/diet">进入明细</Link>
              </div>
              <p className="work-module__number">
                {value.diet.meals} 餐 · {value.diet.caloriesKcal} kcal
              </p>
              <dl>
                <div>
                  <dt>饮水</dt>
                  <dd>{value.diet.hydrationMl} ml</dd>
                </div>
                <div>
                  <dt>餐饮支出</dt>
                  <dd>{money(value.expenses.dietMinor)}</dd>
                </div>
              </dl>
            </section>
            <section className="life-overview-card module-surface work-module">
              <div className="section-heading">
                <h2>健身</h2>
                <Link to="/life/fitness">进入明细</Link>
              </div>
              <p className="work-module__number">
                {value.fitness.sessions} 次 · {value.fitness.durationMinutes} 分钟
              </p>
              <dl>
                <div>
                  <dt>消耗</dt>
                  <dd>{value.fitness.caloriesBurned} kcal</dd>
                </div>
                <div>
                  <dt>最近体重</dt>
                  <dd>{value.fitness.latestWeightKg ?? '—'} kg</dd>
                </div>
              </dl>
            </section>
            <section className="life-overview-card module-surface work-module">
              <div className="section-heading">
                <h2>娱乐</h2>
                <Link to="/life/entertainment">进入明细</Link>
              </div>
              <p className="work-module__number">
                {value.entertainment.items} 项 · {value.entertainment.durationMinutes} 分钟
              </p>
              <dl>
                <div>
                  <dt>已完成</dt>
                  <dd>{value.entertainment.completed} 项</dd>
                </div>
                <div>
                  <dt>娱乐支出</dt>
                  <dd>{money(value.expenses.entertainmentMinor)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
};
const Shopping = ({ targetId }: { readonly targetId?: string }) => {
  const category = useCategories().data?.data.find(
      (x) => x.moduleType === 'SHOPPING' && !x.isArchived,
    ),
    [filter, setFilter] = useState(''),
    items = useShoppingItems(filter),
    purchases = usePurchases(),
    budgets = useBudgets(),
    create = useCreateShoppingItem(),
    update = useUpdateShoppingItem(),
    remove = useDeleteShoppingItem(),
    purchase = usePurchaseShoppingItem(),
    createBudget = useCreateBudget(),
    [selected, setSelected] = useState<string | undefined>(targetId),
    item = items.data?.find((x) => x.id === selected) ?? items.data?.[0];
  return (
    <div className="master-detail-layout work-split">
      <section>
        <div className="section-heading">
          <h2>待购清单</h2>
          <select
            aria-label="购买状态筛选"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
            }}
          >
            <option value="">全部状态</option>
            {Object.entries(statusText).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="shopping-list">
          {items.isLoading ? <p className="status-line">正在读取待购清单…</p> : null}
          {items.isError ? <ErrorState>待购清单暂时无法加载，请重试。</ErrorState> : null}
          {!items.isLoading && !items.isError && items.data?.length === 0 ? (
            <p className="empty-copy">还没有待购商品，点击“添加待购”加入第一件。</p>
          ) : null}
          {items.data?.map((x) => (
            <button
              key={x.id}
              data-life-open-editor="true"
              data-selected={item?.id === x.id}
              onClick={() => {
                setSelected(x.id);
              }}
            >
              <span>
                <strong>{x.name}</strong>
                <small>
                  {x.productCategory ?? '未分类'} · {x.quantity}
                  {x.unit ?? '件'}
                </small>
              </span>
              <span>
                <strong>
                  {x.plannedUnitPriceMinor === null
                    ? '待定'
                    : money(x.plannedUnitPriceMinor * x.quantity)}
                </strong>
                <small>{statusText[x.status]}</small>
              </span>
            </button>
          ))}
        </div>
        <ShoppingItemCreateForm
          {...(category === undefined ? {} : { categoryId: category.id })}
          isPending={create.isPending}
          onCreate={(input, onSuccess) => {
            create.mutate(
              {
                categoryId: input.categoryId,
                name: input.name,
                productCategory: input.productCategory,
                quantity: Number(input.quantity || 1),
                unit: input.unit,
                plannedUnitPriceMinor: input.price ? Math.round(Number(input.price) * 100) : null,
                priority: input.priority,
                purchaseChannel: input.channel,
              },
              { onSuccess },
            );
          }}
        />
        <section className="purchase-history">
          <h3>最近购买</h3>
          {purchases.isError ? <ErrorState>购买记录暂时无法加载。</ErrorState> : null}
          {!purchases.isLoading && !purchases.isError && purchases.data?.length === 0 ? (
            <p className="empty-copy">还没有购买记录。</p>
          ) : null}
          <ul className="work-list">
            {purchases.data?.slice(0, 5).map((x) => (
              <li key={x.id}>
                <span>
                  {x.productName}
                  <small>
                    {x.purchasedAt.slice(0, 10)} · {x.channel ?? '未填写渠道'}
                  </small>
                </span>
                <strong>{money(x.totalAmountMinor)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </section>
      <aside id="life-manage-panel" className="work-editor">
        {item ? (
          <>
            <ShoppingItemEditor
              key={`${item.id}:${String(item.version)}`}
              item={item}
              isPending={update.isPending}
              onSave={(input, onSuccess) => {
                update.mutate(
                  {
                    id: input.id,
                    version: input.version,
                    name: input.name,
                    productCategory: input.productCategory || null,
                    quantity: Number(input.quantity),
                    unit: input.unit || null,
                    plannedUnitPriceMinor: input.price
                      ? Math.round(Number(input.price) * 100)
                      : null,
                    priority: input.priority,
                    status: input.status,
                    purchaseChannel: input.channel || null,
                  },
                  { onSuccess },
                );
              }}
              onDelete={(input, onSuccess) => {
                remove.mutate(input, {
                  onSuccess: () => {
                    onSuccess();
                    setSelected(undefined);
                  },
                });
              }}
            />
            {!['PURCHASED', 'CANCELLED'].includes(item.status) && (
              <form
                className="compact-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  purchase.mutate({
                    id: item.id,
                    version: item.version,
                    quantity: Number(field(f, 'actualQuantity')),
                    unitPriceMinor: Math.round(Number(field(f, 'actualPrice')) * 100),
                    purchasedAt: new Date(`${field(f, 'date')}T12:00:00+08:00`).toISOString(),
                    channel: field(f, 'actualChannel') || null,
                  });
                }}
              >
                <h3>完成购买并记账</h3>
                <LocalDateInput name="date" defaultValue={today()} required />
                <input
                  name="actualQuantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={item.quantity}
                  required
                />
                <input
                  name="actualPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="实际单价（元）"
                  required
                />
                <input
                  name="actualChannel"
                  defaultValue={item.purchaseChannel ?? ''}
                  placeholder="实际渠道"
                />
                <button className="button button--primary">确认购买</button>
              </form>
            )}
          </>
        ) : (
          <p>创建或选择一项待购商品。</p>
        )}
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              start = field(f, 'month');
            const end = new Date(`${start}-01T00:00:00+08:00`);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            createBudget.mutate({
              moduleType: 'SHOPPING',
              periodStart: `${start}-01`,
              periodEnd: new Date(end.getTime() + 8 * 3_600_000).toISOString().slice(0, 10),
              amountMinor: Math.round(Number(field(f, 'amount')) * 100),
            });
            e.currentTarget.reset();
          }}
        >
          <h3>购物预算 · {budgets.data?.length ?? 0}</h3>
          <input name="month" type="month" required />
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="预算金额（元）"
            required
          />
          <button className="button">添加预算</button>
        </form>
      </aside>
    </div>
  );
};
const Diet = ({ targetId }: { readonly targetId?: string }) => {
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [mealType, setMealType] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | ''>(''),
    filters = { ...(from ? { from } : {}), ...(to ? { to } : {}) },
    category = useCategories().data?.data.find((x) => x.moduleType === 'DIET' && !x.isArchived),
    recipes = useRecipes(),
    plans = useMealPlans(),
    meals = useMeals({ ...filters, ...(mealType ? { mealType } : {}) }),
    hydration = useHydration(filters),
    preferences = useDietaryPreferences(),
    createRecipe = useCreateRecipe(),
    updateRecipe = useUpdateRecipe(),
    createPlan = useCreateMealPlan(),
    completePlan = useCompleteMealPlan(),
    createMeal = useCreateMeal(),
    updateMeal = useUpdateMeal(),
    deleteMeal = useDeleteMeal(),
    createHydration = useCreateHydration(),
    updateHydration = useUpdateHydration(),
    deleteHydration = useDeleteHydration(),
    createPreference = useCreateDietaryPreference(),
    updatePreference = useUpdateDietaryPreference(),
    deletePreference = useDeleteDietaryPreference(),
    [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>(targetId),
    [selectedMealId, setSelectedMealId] = useState<string>(),
    [selectedHydrationId, setSelectedHydrationId] = useState<string>(),
    [selectedPreferenceId, setSelectedPreferenceId] = useState<string>(),
    selectedRecipe = recipes.data?.find((recipe) => recipe.id === selectedRecipeId),
    selectedMeal = meals.data?.find((meal) => meal.id === selectedMealId),
    selectedHydration = hydration.data?.find((record) => record.id === selectedHydrationId),
    selectedPreference = preferences.data?.find((item) => item.id === selectedPreferenceId);
  const dateTime = (date: string) => new Date(`${date}T12:00:00+08:00`).toISOString();
  return (
    <div className="master-detail-layout work-split">
      <section>
        <div className="section-heading">
          <h2>今日饮食</h2>
          <span>
            {meals.data?.length ?? 0} 条记录 ·{' '}
            {hydration.data?.reduce((sum, x) => sum + x.amountMl, 0) ?? 0} ml
          </span>
        </div>
        <div className="form-grid" aria-label="饮食趋势筛选">
          <LocalDateInput
            name="dietFrom"
            aria-label="饮食开始日期"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
            }}
          />
          <LocalDateInput
            name="dietTo"
            aria-label="饮食结束日期"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
            }}
          />
          <select
            aria-label="按餐次筛选"
            value={mealType}
            onChange={(e) => {
              setMealType(e.target.value as typeof mealType);
            }}
          >
            <option value="">全部餐次</option>
            <option value="BREAKFAST">早餐</option>
            <option value="LUNCH">午餐</option>
            <option value="DINNER">晚餐</option>
            <option value="SNACK">加餐</option>
          </select>
        </div>
        <div className="shopping-list">
          {plans.isLoading ? <p className="status-line">正在读取饮食安排…</p> : null}
          {plans.isError ? <ErrorState>饮食安排暂时无法加载，请重试。</ErrorState> : null}
          {!plans.isLoading && !plans.isError && plans.data?.length === 0 ? (
            <p className="empty-copy">今天还没有饮食安排。</p>
          ) : null}
          {plans.data?.map((plan) => (
            <article key={plan.id} className="diet-row">
              <span>
                <strong>{plan.title}</strong>
                <small>
                  {plan.mealDate} · {plan.mealType}
                </small>
              </span>
              <span>
                <small>
                  {
                    {
                      PLANNED: '已计划',
                      COMPLETED: '已用餐',
                      SKIPPED: '已跳过',
                    }[plan.status]
                  }
                </small>
                {plan.status === 'PLANNED' && (
                  <button
                    className="button button--small"
                    onClick={() => {
                      completePlan.mutate({
                        id: plan.id,
                        version: plan.version,
                        eatenAt: new Date().toISOString(),
                        expenseAmountMinor: null,
                        merchant: null,
                      });
                    }}
                  >
                    完成用餐
                  </button>
                )}
              </span>
            </article>
          ))}
        </div>
        <MealPlanCreateForm
          {...(category === undefined ? {} : { categoryId: category.id })}
          recipes={recipes.data ?? []}
          isPending={createPlan.isPending}
          onCreate={(input, onSuccess) => {
            createPlan.mutate(
              {
                categoryId: input.categoryId,
                mealDate: input.date,
                mealType: input.mealType,
                ...(input.recipeId ? { recipeId: input.recipeId } : {}),
                title: input.title,
              },
              { onSuccess },
            );
          }}
        />
        <section className="purchase-history">
          <h3>最近实吃</h3>
          <ul className="work-list">
            {meals.data?.slice(0, 6).map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  data-life-open-editor="true"
                  onClick={() => {
                    setSelectedMealId(x.id);
                  }}
                >
                  {x.title}
                  <small>
                    {x.eatenAt.slice(0, 10)} · {x.mealType}
                  </small>
                </button>
                <strong>{x.caloriesKcal ?? '—'} kcal</strong>
              </li>
            ))}
          </ul>
        </section>
      </section>
      <aside id="life-manage-panel" className="work-editor">
        <section className="compact-form compact-form--flush">
          <h2>食谱库 · {recipes.data?.length ?? 0}</h2>
          <ul className="work-list">
            {recipes.data?.map((recipe) => (
              <li key={recipe.id}>
                <button
                  data-life-open-editor="true"
                  type="button"
                  onClick={() => {
                    setSelectedRecipeId(recipe.id);
                  }}
                >
                  {recipe.name}
                </button>
                <small>{recipe.caloriesKcal ?? '—'} kcal</small>
              </li>
            ))}
          </ul>
        </section>
        {selectedRecipe ? (
          <form
            key={selectedRecipe.id}
            className="compact-form"
            aria-label="编辑食谱"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateRecipe.mutate({
                id: selectedRecipe.id,
                version: selectedRecipe.version,
                name: field(f, 'name'),
                description: field(f, 'description') || null,
                servings: Number(field(f, 'servings')),
                caloriesKcal: field(f, 'calories') ? Number(field(f, 'calories')) : null,
                proteinG: selectedRecipe.proteinG,
                carbsG: selectedRecipe.carbsG,
                fatG: selectedRecipe.fatG,
              });
            }}
          >
            <h3>编辑食谱</h3>
            <input name="name" aria-label="食谱名称" defaultValue={selectedRecipe.name} required />
            <textarea
              name="description"
              aria-label="食谱说明"
              defaultValue={selectedRecipe.description ?? ''}
              placeholder="食谱说明"
            />
            <div className="form-grid">
              <input
                name="servings"
                aria-label="份数"
                type="number"
                min="0.1"
                step="0.1"
                defaultValue={selectedRecipe.servings}
              />
              <input
                name="calories"
                aria-label="热量"
                type="number"
                min="0"
                defaultValue={selectedRecipe.caloriesKcal ?? ''}
              />
            </div>
            <button className="button button--primary" disabled={updateRecipe.isPending}>
              保存修改
            </button>
          </form>
        ) : null}
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!category) return;
            const f = new FormData(e.currentTarget);
            createRecipe.mutate({
              categoryId: category.id,
              name: field(f, 'name'),
              servings: Number(field(f, 'servings') || 1),
              caloriesKcal: field(f, 'calories') ? Number(field(f, 'calories')) : null,
              proteinG: null,
              carbsG: null,
              fatG: null,
            });
            e.currentTarget.reset();
          }}
        >
          <h3>添加食谱</h3>
          <input name="name" placeholder="食谱名称" required />
          <div className="form-grid">
            <input name="servings" type="number" min="0.1" step="0.1" defaultValue="1" />
            <input name="calories" type="number" min="0" placeholder="热量 kcal" />
          </div>
          <button className="button button--primary" disabled={!category}>
            保存食谱
          </button>
        </form>
        <MealRecordCreateForm
          {...(category === undefined ? {} : { categoryId: category.id })}
          isPending={createMeal.isPending}
          onCreate={(input, onSuccess) => {
            createMeal.mutate(
              {
                categoryId: input.categoryId,
                mealType: input.mealType,
                title: input.title,
                eatenAt: dateTime(input.date),
                caloriesKcal: input.calories ? Number(input.calories) : null,
                expenseAmountMinor: input.amount ? Math.round(Number(input.amount) * 100) : null,
                merchant: input.merchant || null,
              },
              { onSuccess },
            );
          }}
        />
        {selectedMeal ? (
          <form
            key={selectedMeal.id}
            className="compact-form"
            aria-label="编辑餐食记录"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                nullableNumber = (name: string) => (field(f, name) ? Number(field(f, name)) : null);
              updateMeal.mutate({
                id: selectedMeal.id,
                version: selectedMeal.version,
                mealType: field(f, 'mealType') as typeof selectedMeal.mealType,
                title: field(f, 'title'),
                eatenAt: dateTime(field(f, 'date')),
                caloriesKcal: nullableNumber('caloriesKcal'),
                proteinG: nullableNumber('proteinG'),
                carbsG: nullableNumber('carbsG'),
                fatG: nullableNumber('fatG'),
                fiberG: nullableNumber('fiberG'),
                sodiumMg: nullableNumber('sodiumMg'),
              });
            }}
          >
            <h3>编辑餐食记录</h3>
            <input name="title" aria-label="餐食名称" defaultValue={selectedMeal.title} required />
            <div className="form-grid">
              <LocalDateInput
                name="date"
                defaultValue={selectedMeal.eatenAt.slice(0, 10)}
                required
              />
              <select name="mealType" defaultValue={selectedMeal.mealType} aria-label="餐次">
                <option value="BREAKFAST">早餐</option>
                <option value="LUNCH">午餐</option>
                <option value="DINNER">晚餐</option>
                <option value="SNACK">加餐</option>
              </select>
            </div>
            <div className="form-grid">
              {[
                ['caloriesKcal', '热量 kcal', selectedMeal.caloriesKcal],
                ['proteinG', '蛋白质 g', selectedMeal.proteinG],
                ['carbsG', '碳水 g', selectedMeal.carbsG],
                ['fatG', '脂肪 g', selectedMeal.fatG],
                ['fiberG', '膳食纤维 g', selectedMeal.fiberG],
                ['sodiumMg', '钠 mg', selectedMeal.sodiumMg],
              ].map(([name, placeholder, value]) => (
                <input
                  key={String(name)}
                  name={String(name)}
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder={String(placeholder)}
                  defaultValue={value === null ? '' : String(value)}
                />
              ))}
            </div>
            <div className="button-row">
              <button className="button button--primary" disabled={updateMeal.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleteMeal.isPending}
                onClick={() => {
                  if (window.confirm('确定将这条餐食记录移入回收站？'))
                    deleteMeal.mutate(
                      { id: selectedMeal.id, version: selectedMeal.version },
                      {
                        onSuccess: () => {
                          setSelectedMealId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createHydration.mutate({
              recordedAt: new Date().toISOString(),
              amountMl: Number(field(f, 'amountMl')),
              note: field(f, 'note'),
            });
            e.currentTarget.reset();
          }}
        >
          <h3>饮水</h3>
          <div className="form-grid">
            <input name="amountMl" type="number" min="1" defaultValue="250" required />
            <input name="note" placeholder="备注" />
          </div>
          <button className="button">记一杯水</button>
        </form>
        <section className="compact-form">
          <h3>饮水记录 · {hydration.data?.length ?? 0}</h3>
          <ul className="work-list">
            {hydration.data?.slice(0, 8).map((record) => (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHydrationId(record.id);
                  }}
                >
                  {record.amountMl} ml
                  <small>
                    {record.recordedAt.slice(0, 10)} · {record.note ?? '无备注'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selectedHydration ? (
          <form
            key={selectedHydration.id}
            className="compact-form"
            aria-label="编辑饮水记录"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateHydration.mutate({
                id: selectedHydration.id,
                version: selectedHydration.version,
                recordedAt: dateTime(field(f, 'date')),
                amountMl: Number(field(f, 'amountMl')),
                note: field(f, 'note') || null,
              });
            }}
          >
            <h3>编辑饮水记录</h3>
            <div className="form-grid">
              <LocalDateInput
                name="date"
                defaultValue={selectedHydration.recordedAt.slice(0, 10)}
                required
              />
              <input
                name="amountMl"
                type="number"
                min="1"
                defaultValue={selectedHydration.amountMl}
                required
              />
            </div>
            <input name="note" defaultValue={selectedHydration.note ?? ''} placeholder="备注" />
            <div className="button-row">
              <button className="button button--primary" disabled={updateHydration.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleteHydration.isPending}
                onClick={() => {
                  if (window.confirm('确定将这条饮水记录移入回收站？'))
                    deleteHydration.mutate(
                      { id: selectedHydration.id, version: selectedHydration.version },
                      {
                        onSuccess: () => {
                          setSelectedHydrationId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createPreference.mutate({
              preferenceType: field(f, 'type') as 'LIKE',
              name: field(f, 'name'),
              severity: field(f, 'severity'),
            });
            e.currentTarget.reset();
          }}
        >
          <h3>偏好与限制 · {preferences.data?.length ?? 0}</h3>
          <div className="form-grid">
            <select name="type">
              <option value="LIKE">喜欢</option>
              <option value="DISLIKE">不喜欢</option>
              <option value="ALLERGY">过敏</option>
              <option value="INTOLERANCE">不耐受</option>
              <option value="RESTRICTION">饮食限制</option>
            </select>
            <input name="name" placeholder="食物或规则" required />
          </div>
          <input name="severity" placeholder="严重程度（可选）" />
          <button className="button">添加偏好</button>
        </form>
        <section className="compact-form">
          <h3>现有偏好与限制</h3>
          <ul className="work-list">
            {preferences.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPreferenceId(item.id);
                  }}
                >
                  {item.name}
                  <small>
                    {item.preferenceType} · {item.isActive ? '启用' : '停用'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selectedPreference ? (
          <form
            key={selectedPreference.id}
            className="compact-form"
            aria-label="编辑饮食偏好"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updatePreference.mutate({
                id: selectedPreference.id,
                version: selectedPreference.version,
                preferenceType: field(f, 'type') as typeof selectedPreference.preferenceType,
                name: field(f, 'name'),
                severity: field(f, 'severity') || null,
                note: field(f, 'note') || null,
                isActive: f.get('isActive') === 'on',
              });
            }}
          >
            <h3>编辑饮食偏好</h3>
            <div className="form-grid">
              <select name="type" defaultValue={selectedPreference.preferenceType}>
                <option value="LIKE">喜欢</option>
                <option value="DISLIKE">不喜欢</option>
                <option value="ALLERGY">过敏</option>
                <option value="INTOLERANCE">不耐受</option>
                <option value="RESTRICTION">饮食限制</option>
              </select>
              <input name="name" defaultValue={selectedPreference.name} required />
            </div>
            <input
              name="severity"
              defaultValue={selectedPreference.severity ?? ''}
              placeholder="严重程度"
            />
            <textarea name="note" defaultValue={selectedPreference.note ?? ''} placeholder="备注" />
            <label className="checkbox-line">
              <input name="isActive" type="checkbox" defaultChecked={selectedPreference.isActive} />{' '}
              启用
            </label>
            <div className="button-row">
              <button className="button button--primary" disabled={updatePreference.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deletePreference.isPending}
                onClick={() => {
                  if (window.confirm('确定将这条饮食偏好移入回收站？'))
                    deletePreference.mutate(
                      { id: selectedPreference.id, version: selectedPreference.version },
                      {
                        onSuccess: () => {
                          setSelectedPreferenceId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
      </aside>
    </div>
  );
};
const Fitness = ({ targetId }: { readonly targetId?: string }) => {
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    filters = { ...(from ? { from } : {}), ...(to ? { to } : {}) },
    category = useCategories().data?.data.find((x) => x.moduleType === 'FITNESS' && !x.isArchived),
    exercises = useExercises(),
    plans = useWorkoutPlans(),
    sessions = useWorkoutSessions(filters),
    measurements = useBodyMeasurements(filters),
    records = usePersonalRecords(),
    recovery = useRecovery(),
    createExercise = useCreateExercise(),
    updateExercise = useUpdateExercise(),
    deleteExercise = useDeleteExercise(),
    createPlan = useCreateWorkoutPlan(),
    updatePlan = useUpdateWorkoutPlan(),
    deletePlan = useDeleteWorkoutPlan(),
    createSession = useCreateWorkoutSession(),
    updateSession = useUpdateWorkoutSession(),
    deleteSession = useDeleteWorkoutSession(),
    createMeasurement = useCreateBodyMeasurement(),
    updateMeasurement = useUpdateBodyMeasurement(),
    deleteMeasurement = useDeleteBodyMeasurement(),
    createRecord = useCreatePersonalRecord(),
    updateRecord = useUpdatePersonalRecord(),
    deleteRecord = useDeletePersonalRecord(),
    createRecovery = useCreateRecovery(),
    updateRecovery = useUpdateRecovery(),
    deleteRecovery = useDeleteRecovery(),
    [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(targetId),
    [selectedExerciseId, setSelectedExerciseId] = useState<string>(),
    [selectedSessionId, setSelectedSessionId] = useState<string>(),
    [selectedMeasurementId, setSelectedMeasurementId] = useState<string>(),
    [selectedRecordId, setSelectedRecordId] = useState<string>(),
    [selectedRecoveryId, setSelectedRecoveryId] = useState<string>(),
    selectedPlan = plans.data?.find((plan) => plan.id === selectedPlanId),
    selectedExercise = exercises.data?.find((item) => item.id === selectedExerciseId),
    selectedSession = sessions.data?.find((item) => item.id === selectedSessionId),
    selectedMeasurement = measurements.data?.find((item) => item.id === selectedMeasurementId),
    selectedRecord = records.data?.find((item) => item.id === selectedRecordId),
    selectedRecovery = recovery.data?.find((item) => item.id === selectedRecoveryId);
  const numberOrNull = (value: string) => (value ? Number(value) : null),
    isoAt = (date: string, hour: number) =>
      new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`).toISOString();
  return (
    <div className="master-detail-layout work-split">
      <section>
        <div className="section-heading">
          <h2>训练记录</h2>
          <span>
            {sessions.data?.length ?? 0} 次 ·{' '}
            {sessions.data?.reduce((sum, x) => sum + x.durationMinutes, 0) ?? 0} 分钟
          </span>
        </div>
        <div className="form-grid" aria-label="健身趋势筛选">
          <LocalDateInput
            name="fitnessFrom"
            aria-label="健身开始日期"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
            }}
          />
          <LocalDateInput
            name="fitnessTo"
            aria-label="健身结束日期"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
            }}
          />
        </div>
        <ul className="work-list fitness-session-list">
          {sessions.data?.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionId(x.id);
                }}
              >
                <strong>
                  {plans.data?.find((p) => p.id === x.workoutPlanId)?.name ?? '自由训练'}
                </strong>
                <small>
                  {x.startedAt.slice(0, 10)} · 强度 {x.perceivedEffort ?? '—'} · {x.sets.length} 组
                </small>
              </button>
              <strong>{x.durationMinutes} 分钟</strong>
            </li>
          ))}
        </ul>
        <WorkoutSessionCreateForm
          {...(category === undefined ? {} : { categoryId: category.id })}
          plans={plans.data ?? []}
          exercises={exercises.data ?? []}
          isPending={createSession.isPending}
          onCreate={(input, onSuccess) => {
            createSession.mutate(
              {
                categoryId: input.categoryId,
                workoutPlanId: input.planId || null,
                startedAt: isoAt(input.date, 18),
                endedAt: isoAt(input.date, 19),
                caloriesBurned: numberOrNull(input.calories),
                perceivedEffort: numberOrNull(input.effort),
                note: input.note || null,
                sets: input.exerciseId
                  ? [
                      {
                        exerciseId: input.exerciseId,
                        setNumber: 1,
                        reps: numberOrNull(input.reps),
                        weight: numberOrNull(input.weight),
                        durationSeconds: null,
                        distance: null,
                        completed: true,
                      },
                    ]
                  : [],
              },
              { onSuccess },
            );
          }}
        />
        <section className="purchase-history">
          <h3>身体趋势</h3>
          {measurements.isError ? <ErrorState>身体指标暂时无法加载。</ErrorState> : null}
          {!measurements.isLoading && !measurements.isError && measurements.data?.length === 0 ? (
            <p className="empty-copy">还没有身体指标记录。</p>
          ) : null}
          <ul className="work-list">
            {measurements.data?.slice(0, 5).map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMeasurementId(x.id);
                  }}
                >
                  {x.measuredAt.slice(0, 10)}
                  <small>
                    体脂 {x.bodyFatPercent ?? '—'}% · 腰围 {x.waistCm ?? '—'}cm
                  </small>
                </button>
                <strong>{x.weightKg ?? '—'} kg</strong>
              </li>
            ))}
          </ul>
        </section>
      </section>
      <aside id="life-manage-panel" className="work-editor">
        <section className="compact-form compact-form--flush">
          <h2>训练计划 · {plans.data?.length ?? 0}</h2>
          <ul className="work-list">
            {plans.data?.map((plan) => (
              <li key={plan.id}>
                <button
                  data-life-open-editor="true"
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                  }}
                >
                  {plan.name}
                </button>
                <small>{plan.status}</small>
              </li>
            ))}
          </ul>
        </section>
        {selectedPlan ? (
          <form
            key={selectedPlan.id}
            className="compact-form"
            aria-label="编辑训练计划"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updatePlan.mutate({
                id: selectedPlan.id,
                version: selectedPlan.version,
                name: field(f, 'name'),
                description: field(f, 'description') || null,
                status: field(f, 'status') as typeof selectedPlan.status,
              });
            }}
          >
            <h3>编辑训练计划</h3>
            <input
              name="name"
              aria-label="训练计划名称"
              defaultValue={selectedPlan.name}
              required
            />
            <textarea
              name="description"
              aria-label="训练计划说明"
              defaultValue={selectedPlan.description ?? ''}
              placeholder="训练计划说明"
            />
            <select name="status" aria-label="训练计划状态" defaultValue={selectedPlan.status}>
              <option value="DRAFT">草稿</option>
              <option value="ACTIVE">进行中</option>
              <option value="PAUSED">已暂停</option>
              <option value="COMPLETED">已完成</option>
            </select>
            <div className="button-row">
              <button className="button button--primary" disabled={updatePlan.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deletePlan.isPending}
                onClick={() => {
                  if (window.confirm('确定将这个训练计划移入回收站？'))
                    deletePlan.mutate(
                      { id: selectedPlan.id, version: selectedPlan.version },
                      {
                        onSuccess: () => {
                          setSelectedPlanId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
        {selectedSession ? (
          <form
            key={selectedSession.id}
            className="compact-form"
            aria-label="编辑训练记录"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                date = field(f, 'date');
              updateSession.mutate({
                id: selectedSession.id,
                version: selectedSession.version,
                workoutPlanId: field(f, 'planId') || null,
                startedAt: isoAt(date, Number(field(f, 'startHour'))),
                endedAt: isoAt(date, Number(field(f, 'endHour'))),
                caloriesBurned: numberOrNull(field(f, 'calories')),
                perceivedEffort: numberOrNull(field(f, 'effort')),
                note: field(f, 'note') || null,
              });
            }}
          >
            <h3>编辑训练记录</h3>
            <LocalDateInput
              name="date"
              defaultValue={selectedSession.startedAt.slice(0, 10)}
              required
            />
            <select name="planId" defaultValue={selectedSession.workoutPlanId ?? ''}>
              <option value="">自由训练</option>
              {plans.data?.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            <div className="form-grid">
              <input
                name="startHour"
                type="number"
                min="0"
                max="23"
                defaultValue={new Date(selectedSession.startedAt).getHours()}
                aria-label="开始小时"
              />
              <input
                name="endHour"
                type="number"
                min="0"
                max="23"
                defaultValue={new Date(selectedSession.endedAt).getHours()}
                aria-label="结束小时"
              />
            </div>
            <div className="form-grid">
              <input
                name="calories"
                type="number"
                min="0"
                defaultValue={selectedSession.caloriesBurned ?? ''}
                placeholder="消耗 kcal"
              />
              <input
                name="effort"
                type="number"
                min="1"
                max="10"
                defaultValue={selectedSession.perceivedEffort ?? ''}
                placeholder="强度 1–10"
              />
            </div>
            <textarea
              name="note"
              defaultValue={selectedSession.note ?? ''}
              placeholder="训练说明"
            />
            <div className="button-row">
              <button className="button button--primary" disabled={updateSession.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleteSession.isPending}
                onClick={() => {
                  if (window.confirm('确定将这条训练记录移入回收站？'))
                    deleteSession.mutate(
                      { id: selectedSession.id, version: selectedSession.version },
                      {
                        onSuccess: () => {
                          setSelectedSessionId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
        <section className="compact-form">
          <h3>动作列表</h3>
          <ul className="work-list">
            {exercises.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExerciseId(item.id);
                  }}
                >
                  {item.name}
                  <small>
                    {item.exerciseType} · {item.muscleGroups.join('、') || '未设肌群'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selectedExercise ? (
          <form
            key={selectedExercise.id}
            className="compact-form"
            aria-label="编辑动作"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateExercise.mutate({
                id: selectedExercise.id,
                version: selectedExercise.version,
                name: field(f, 'name'),
                exerciseType: field(f, 'type') as typeof selectedExercise.exerciseType,
                muscleGroups: field(f, 'muscles').split('、').filter(Boolean),
                defaultUnit: field(f, 'unit') || null,
                instructions: field(f, 'instructions') || null,
              });
            }}
          >
            <h3>编辑动作</h3>
            <input name="name" defaultValue={selectedExercise.name} required />
            <select name="type" defaultValue={selectedExercise.exerciseType}>
              <option value="STRENGTH">力量</option>
              <option value="CARDIO">有氧</option>
              <option value="MOBILITY">灵活性</option>
              <option value="SPORT">运动</option>
              <option value="OTHER">其他</option>
            </select>
            <div className="form-grid">
              <input
                name="muscles"
                defaultValue={selectedExercise.muscleGroups.join('、')}
                placeholder="肌群，用顿号分隔"
              />
              <input
                name="unit"
                defaultValue={selectedExercise.defaultUnit ?? ''}
                placeholder="默认单位"
              />
            </div>
            <textarea
              name="instructions"
              defaultValue={selectedExercise.instructions ?? ''}
              placeholder="动作说明"
            />
            <div className="button-row">
              <button className="button button--primary" disabled={updateExercise.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleteExercise.isPending}
                onClick={() => {
                  if (window.confirm('确定将这个动作移入回收站？'))
                    deleteExercise.mutate(
                      { id: selectedExercise.id, version: selectedExercise.version },
                      {
                        onSuccess: () => {
                          setSelectedExerciseId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createExercise.mutate({
              name: field(f, 'name'),
              exerciseType: field(f, 'type') as 'STRENGTH',
              muscleGroups: field(f, 'muscles').split('、').filter(Boolean),
              defaultUnit: field(f, 'unit') || null,
            });
            e.currentTarget.reset();
          }}
        >
          <h2>动作库 · {exercises.data?.length ?? 0}</h2>
          <input name="name" placeholder="动作名称" required />
          <select name="type">
            <option value="STRENGTH">力量</option>
            <option value="CARDIO">有氧</option>
            <option value="MOBILITY">灵活性</option>
            <option value="SPORT">运动</option>
            <option value="OTHER">其他</option>
          </select>
          <div className="form-grid">
            <input name="muscles" placeholder="肌群，用顿号分隔" />
            <input name="unit" placeholder="默认单位" />
          </div>
          <button className="button button--primary">添加动作</button>
        </form>
        <WorkoutPlanCreateForm
          {...(category === undefined ? {} : { categoryId: category.id })}
          exercises={exercises.data ?? []}
          planCount={plans.data?.length ?? 0}
          isPending={createPlan.isPending}
          onCreate={(input, onSuccess) => {
            createPlan.mutate(
              {
                categoryId: input.categoryId,
                name: input.name,
                description: input.description,
                status: 'ACTIVE',
                items: input.exerciseId
                  ? [
                      {
                        exerciseId: input.exerciseId,
                        setsTarget: numberOrNull(input.sets),
                        repsTarget: input.reps || null,
                        weightTarget: numberOrNull(input.weight),
                        durationSecondsTarget: null,
                        distanceTarget: null,
                        sortOrder: 0,
                      },
                    ]
                  : [],
              },
              { onSuccess },
            );
          }}
        />
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createMeasurement.mutate({
              measuredAt: new Date().toISOString(),
              weightKg: numberOrNull(field(f, 'weight')),
              bodyFatPercent: numberOrNull(field(f, 'fat')),
              waistCm: numberOrNull(field(f, 'waist')),
            });
            e.currentTarget.reset();
          }}
        >
          <h3>身体指标</h3>
          <div className="form-grid">
            <input name="weight" type="number" step="0.1" min="1" placeholder="体重 kg" />
            <input name="fat" type="number" step="0.1" min="0" placeholder="体脂 %" />
          </div>
          <input name="waist" type="number" step="0.1" min="1" placeholder="腰围 cm" />
          <button className="button">记录指标</button>
        </form>
        {selectedMeasurement ? (
          <form
            key={selectedMeasurement.id}
            className="compact-form"
            aria-label="编辑身体指标"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateMeasurement.mutate({
                id: selectedMeasurement.id,
                version: selectedMeasurement.version,
                measuredAt: isoAt(field(f, 'date'), 12),
                weightKg: numberOrNull(field(f, 'weight')),
                bodyFatPercent: numberOrNull(field(f, 'fat')),
                waistCm: numberOrNull(field(f, 'waist')),
                chestCm: numberOrNull(field(f, 'chest')),
                hipCm: numberOrNull(field(f, 'hip')),
                note: field(f, 'note') || null,
              });
            }}
          >
            <h3>编辑身体指标</h3>
            <LocalDateInput
              name="date"
              defaultValue={selectedMeasurement.measuredAt.slice(0, 10)}
              required
            />
            <div className="form-grid">
              <input
                name="weight"
                type="number"
                step="0.1"
                min="1"
                defaultValue={selectedMeasurement.weightKg ?? ''}
                placeholder="体重 kg"
              />
              <input
                name="fat"
                type="number"
                step="0.1"
                min="0"
                defaultValue={selectedMeasurement.bodyFatPercent ?? ''}
                placeholder="体脂 %"
              />
            </div>
            <div className="form-grid">
              <input
                name="waist"
                type="number"
                step="0.1"
                min="1"
                defaultValue={selectedMeasurement.waistCm ?? ''}
                placeholder="腰围 cm"
              />
              <input
                name="chest"
                type="number"
                step="0.1"
                min="1"
                defaultValue={selectedMeasurement.chestCm ?? ''}
                placeholder="胸围 cm"
              />
              <input
                name="hip"
                type="number"
                step="0.1"
                min="1"
                defaultValue={selectedMeasurement.hipCm ?? ''}
                placeholder="臀围 cm"
              />
            </div>
            <input
              name="note"
              defaultValue={selectedMeasurement.note ?? ''}
              placeholder="指标备注"
            />
            <div className="button-row">
              <button className="button button--primary" disabled={updateMeasurement.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleteMeasurement.isPending}
                onClick={() => {
                  if (window.confirm('确定将这条身体指标移入回收站？'))
                    deleteMeasurement.mutate(
                      { id: selectedMeasurement.id, version: selectedMeasurement.version },
                      {
                        onSuccess: () => {
                          setSelectedMeasurementId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createRecord.mutate({
              exerciseId: field(f, 'exerciseId') || null,
              recordType: field(f, 'type') as 'WEIGHT',
              value: Number(field(f, 'value')),
              unit: field(f, 'unit'),
              achievedAt: new Date().toISOString(),
            });
            e.currentTarget.reset();
          }}
        >
          <h3>个人纪录 · {records.data?.length ?? 0}</h3>
          <select name="exerciseId">
            <option value="">通用纪录</option>
            {exercises.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <div className="form-grid">
            <select name="type">
              <option value="WEIGHT">重量</option>
              <option value="REPS">次数</option>
              <option value="DURATION">时长</option>
              <option value="DISTANCE">距离</option>
              <option value="SPEED">速度</option>
            </select>
            <input name="value" type="number" step="0.01" required />
          </div>
          <input name="unit" placeholder="单位" required />
          <button className="button">保存纪录</button>
        </form>
        <section className="compact-form">
          <h3>纪录列表</h3>
          <ul className="work-list">
            {records.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecordId(item.id);
                  }}
                >
                  {item.value} {item.unit}
                  <small>
                    {item.recordType} · {item.achievedAt.slice(0, 10)}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selectedRecord ? (
          <form
            key={selectedRecord.id}
            className="compact-form"
            aria-label="编辑个人纪录"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateRecord.mutate({
                id: selectedRecord.id,
                version: selectedRecord.version,
                exerciseId: field(f, 'exerciseId') || null,
                recordType: field(f, 'type') as typeof selectedRecord.recordType,
                value: Number(field(f, 'value')),
                unit: field(f, 'unit'),
                achievedAt: isoAt(field(f, 'date'), 12),
              });
            }}
          >
            <h3>编辑个人纪录</h3>
            <LocalDateInput
              name="date"
              defaultValue={selectedRecord.achievedAt.slice(0, 10)}
              required
            />
            <select name="exerciseId" defaultValue={selectedRecord.exerciseId ?? ''}>
              <option value="">通用纪录</option>
              {exercises.data?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <div className="form-grid">
              <select name="type" defaultValue={selectedRecord.recordType}>
                <option value="WEIGHT">重量</option>
                <option value="REPS">次数</option>
                <option value="DURATION">时长</option>
                <option value="DISTANCE">距离</option>
                <option value="SPEED">速度</option>
                <option value="OTHER">其他</option>
              </select>
              <input
                name="value"
                type="number"
                step="0.01"
                defaultValue={selectedRecord.value}
                required
              />
            </div>
            <input name="unit" defaultValue={selectedRecord.unit} required />
            <div className="button-row">
              <button className="button button--primary" disabled={updateRecord.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleteRecord.isPending}
                onClick={() => {
                  if (window.confirm('确定将这项个人纪录移入回收站？'))
                    deleteRecord.mutate(
                      { id: selectedRecord.id, version: selectedRecord.version },
                      {
                        onSuccess: () => {
                          setSelectedRecordId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
        <form
          className="compact-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            createRecovery.mutate({
              recordedDate: today(),
              recoveryLevel: Number(field(f, 'recovery')),
              sorenessLevel: numberOrNull(field(f, 'soreness')),
              energyLevel: numberOrNull(field(f, 'energy')),
              note: field(f, 'note') || null,
            });
            e.currentTarget.reset();
          }}
        >
          <h3>今日恢复 · {recovery.data?.[0]?.recoveryLevel ?? '—'}/5</h3>
          <div className="form-grid">
            <input name="recovery" type="number" min="1" max="5" placeholder="恢复 1–5" required />
            <input name="energy" type="number" min="1" max="5" placeholder="精力 1–5" />
          </div>
          <input name="soreness" type="number" min="1" max="5" placeholder="酸痛 1–5" />
          <input name="note" placeholder="恢复备注" />
          <button className="button">记录恢复</button>
        </form>
        <section className="compact-form">
          <h3>恢复记录</h3>
          <ul className="work-list">
            {recovery.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRecoveryId(item.id);
                  }}
                >
                  {item.recordedDate} · {item.recoveryLevel}/5<small>{item.note ?? '无备注'}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selectedRecovery ? (
          <form
            key={selectedRecovery.id}
            className="compact-form"
            aria-label="编辑恢复状态"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateRecovery.mutate({
                id: selectedRecovery.id,
                version: selectedRecovery.version,
                recordedDate: field(f, 'date'),
                recoveryLevel: Number(field(f, 'recovery')),
                sorenessLevel: numberOrNull(field(f, 'soreness')),
                energyLevel: numberOrNull(field(f, 'energy')),
                note: field(f, 'note') || null,
              });
            }}
          >
            <h3>编辑恢复状态</h3>
            <LocalDateInput name="date" defaultValue={selectedRecovery.recordedDate} required />
            <div className="form-grid">
              <input
                name="recovery"
                type="number"
                min="1"
                max="5"
                defaultValue={selectedRecovery.recoveryLevel}
                required
              />
              <input
                name="energy"
                type="number"
                min="1"
                max="5"
                defaultValue={selectedRecovery.energyLevel ?? ''}
                placeholder="精力 1–5"
              />
            </div>
            <input
              name="soreness"
              type="number"
              min="1"
              max="5"
              defaultValue={selectedRecovery.sorenessLevel ?? ''}
              placeholder="酸痛 1–5"
            />
            <input name="note" defaultValue={selectedRecovery.note ?? ''} placeholder="恢复备注" />
            <div className="button-row">
              <button className="button button--primary" disabled={updateRecovery.isPending}>
                保存修改
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleteRecovery.isPending}
                onClick={() => {
                  if (window.confirm('确定将这条恢复状态移入回收站？'))
                    deleteRecovery.mutate(
                      { id: selectedRecovery.id, version: selectedRecovery.version },
                      {
                        onSuccess: () => {
                          setSelectedRecoveryId(undefined);
                        },
                      },
                    );
                }}
              >
                移入回收站
              </button>
            </div>
          </form>
        ) : null}
      </aside>
    </div>
  );
};
const Entertainment = ({ targetId }: { readonly targetId?: string }) => {
  const [itemTypeFilter, setItemTypeFilter] = useState<EntertainmentItemType | ''>(''),
    [listTypeFilter, setListTypeFilter] = useState<
      'WANT_TO_WATCH' | 'WANT_TO_PLAY' | 'WANT_TO_GO' | 'OTHER' | ''
    >(''),
    [statusFilter, setStatusFilter] = useState<
      'WISHLIST' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED' | ''
    >(''),
    category = useCategories().data?.data.find(
      (x) => x.moduleType === 'ENTERTAINMENT' && !x.isArchived,
    ),
    items = useEntertainmentItems({
      ...(itemTypeFilter ? { itemType: itemTypeFilter } : {}),
      ...(listTypeFilter ? { listType: listTypeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    sessions = useEntertainmentSessions(),
    createItem = useCreateEntertainmentItem(),
    updateItem = useUpdateEntertainmentItem(),
    deleteItem = useDeleteEntertainmentItem(),
    setProgress = useSetEntertainmentProgress(),
    createSession = useCreateEntertainmentSession(),
    updateSession = useUpdateEntertainmentSession(),
    deleteSession = useDeleteEntertainmentSession(),
    putTrip = usePutTripDetails(),
    createExpense = useCreateEntertainmentExpense(),
    [selected, setSelected] = useState<string | undefined>(targetId),
    [selectedSessionId, setSelectedSessionId] = useState<string>(),
    item = items.data?.find((x) => x.id === selected) ?? items.data?.[0],
    selectedSession = sessions.data?.find((x) => x.id === selectedSessionId);
  const numberOrNull = (value: string) => (value ? Number(value) : null),
    dateIso = (value: string) => new Date(`${value}T12:00:00+08:00`).toISOString();
  return (
    <div className="master-detail-layout work-split">
      <section>
        <div className="section-heading">
          <h2>娱乐清单</h2>
          <span>
            {items.data?.length ?? 0} 项 ·{' '}
            {sessions.data?.reduce((sum, x) => sum + x.durationMinutes, 0) ?? 0} 分钟
          </span>
        </div>
        <div className="form-grid" aria-label="娱乐筛选">
          <select
            aria-label="按娱乐类型筛选"
            value={itemTypeFilter}
            onChange={(event) => {
              setItemTypeFilter(event.target.value as EntertainmentItemType | '');
            }}
          >
            <option value="">全部类型</option>
            {entertainmentItemTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            aria-label="按清单类型筛选"
            value={listTypeFilter}
            onChange={(event) => {
              setListTypeFilter(event.target.value as typeof listTypeFilter);
            }}
          >
            <option value="">全部清单</option>
            <option value="WANT_TO_WATCH">想看</option>
            <option value="WANT_TO_PLAY">想玩</option>
            <option value="WANT_TO_GO">想去</option>
            <option value="OTHER">其他</option>
          </select>
          <select
            aria-label="按状态筛选"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter);
            }}
          >
            <option value="">全部状态</option>
            <option value="WISHLIST">愿望清单</option>
            <option value="PLANNED">已计划</option>
            <option value="IN_PROGRESS">进行中</option>
            <option value="COMPLETED">已完成</option>
            <option value="DROPPED">已放弃</option>
          </select>
        </div>
        <div className="shopping-list">
          {items.isLoading ? <p className="status-line">正在读取娱乐清单…</p> : null}
          {items.isError ? <ErrorState>娱乐清单暂时无法加载，请重试。</ErrorState> : null}
          {!items.isLoading && !items.isError && items.data?.length === 0 ? (
            <p className="empty-copy">还没有娱乐内容，点击“添加娱乐”加入第一项。</p>
          ) : null}
          {items.data?.map((x) => (
            <button
              key={x.id}
              data-life-open-editor="true"
              data-selected={item?.id === x.id}
              onClick={() => {
                setSelected(x.id);
              }}
            >
              <span>
                <strong>{x.title}</strong>
                <small>
                  {
                    {
                      MOVIE: '电影',
                      SERIES: '剧集',
                      BOOK: '书籍',
                      COMIC: '漫画',
                      GAME: '游戏',
                      ACTIVITY: '活动',
                      TRIP: '旅行',
                      OTHER: '其他',
                    }[x.itemType]
                  }{' '}
                  ·{' '}
                  {
                    {
                      WISHLIST: '想清单',
                      PLANNED: '已计划',
                      IN_PROGRESS: '进行中',
                      COMPLETED: '已完成',
                      DROPPED: '已弃',
                    }[x.status]
                  }
                </small>
              </span>
              <span>
                <strong>
                  {x.progressCurrent ?? 0}
                  {x.progressTotal ? ` / ${String(x.progressTotal)}` : ''}
                </strong>
                <small>{x.progressUnit ?? '进度'}</small>
              </span>
            </button>
          ))}
        </div>
        <EntertainmentItemCreateForm
          {...(category === undefined ? {} : { categoryId: category.id })}
          isPending={createItem.isPending}
          onCreate={(input, onSuccess) => {
            createItem.mutate(
              {
                categoryId: input.categoryId,
                title: input.title,
                itemType: input.itemType,
                listType:
                  input.itemType === 'GAME'
                    ? 'WANT_TO_PLAY'
                    : input.itemType === 'ACTIVITY' || input.itemType === 'TRIP'
                      ? 'WANT_TO_GO'
                      : 'WANT_TO_WATCH',
                progressTotal: numberOrNull(input.total),
                progressUnit: input.unit || null,
                note: input.note || null,
              },
              { onSuccess },
            );
          }}
        />
        <section className="purchase-history">
          <h3>最近娱乐时间</h3>
          <ul className="work-list">
            {sessions.data?.slice(0, 6).map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionId(x.id);
                  }}
                >
                  {items.data?.find((i) => i.id === x.itemId)?.title ?? '娱乐记录'}
                  <small>
                    {x.sessionDate} · 进度 +{x.progressDelta ?? 0}
                  </small>
                  <strong>{x.durationMinutes} 分钟</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </section>
      <aside id="life-manage-panel" className="work-editor">
        {item ? (
          <>
            <form
              className="compact-form compact-form--flush"
              aria-label="编辑娱乐条目"
              key={`details:${item.id}:${String(item.version)}`}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                updateItem.mutate({
                  id: item.id,
                  version: item.version,
                  title: field(f, 'title'),
                  itemType: field(f, 'itemType') as typeof item.itemType,
                  listType: field(f, 'listType') as typeof item.listType,
                  status: field(f, 'status') as typeof item.status,
                  progressTotal: numberOrNull(field(f, 'total')),
                  progressUnit: field(f, 'unit') || null,
                  note: field(f, 'note') || null,
                });
              }}
            >
              <h2>编辑娱乐条目</h2>
              <input name="title" defaultValue={item.title} required />
              <div className="form-grid">
                <select name="itemType" defaultValue={item.itemType}>
                  {entertainmentItemTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select name="listType" defaultValue={item.listType}>
                  <option value="WANT_TO_WATCH">想看</option>
                  <option value="WANT_TO_PLAY">想玩</option>
                  <option value="WANT_TO_GO">想去</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <select name="status" defaultValue={item.status}>
                <option value="WISHLIST">愿望清单</option>
                <option value="PLANNED">已计划</option>
                <option value="IN_PROGRESS">进行中</option>
                <option value="COMPLETED">已完成</option>
                <option value="DROPPED">已放弃</option>
              </select>
              <div className="form-grid">
                <input
                  name="total"
                  type="number"
                  min="0.1"
                  step="0.1"
                  defaultValue={item.progressTotal ?? ''}
                  placeholder="总进度"
                />
                <input name="unit" defaultValue={item.progressUnit ?? ''} placeholder="进度单位" />
              </div>
              <textarea name="note" defaultValue={item.note ?? ''} placeholder="备注" />
              <div className="button-row">
                <button className="button button--primary" disabled={updateItem.isPending}>
                  保存修改
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  disabled={deleteItem.isPending}
                  onClick={() => {
                    if (window.confirm('确定将这个娱乐条目移入回收站？'))
                      deleteItem.mutate(
                        { id: item.id, version: item.version },
                        {
                          onSuccess: () => {
                            setSelected(undefined);
                          },
                        },
                      );
                  }}
                >
                  移入回收站
                </button>
              </div>
            </form>
            <form
              className="compact-form compact-form--flush"
              data-version={item.version}
              key={`${item.id}:${String(item.version)}`}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setProgress.mutate({
                  id: item.id,
                  version: item.version,
                  progressCurrent: Number(field(f, 'progress')),
                  status: field(f, 'status') as typeof item.status,
                  rating: numberOrNull(field(f, 'rating')),
                });
              }}
            >
              <h2>{item.title}</h2>
              <select name="status" defaultValue={item.status}>
                <option value="WISHLIST">愿望清单</option>
                <option value="PLANNED">已计划</option>
                <option value="IN_PROGRESS">进行中</option>
                <option value="COMPLETED">已完成</option>
                <option value="DROPPED">已放弃</option>
              </select>
              <div className="form-grid">
                <input
                  name="progress"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={item.progressCurrent ?? 0}
                />
                <input
                  name="rating"
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  defaultValue={item.rating ?? ''}
                  placeholder="评分 0–10"
                />
              </div>
              <button className="button button--primary">更新进度</button>
            </form>
            <form
              className="compact-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                createSession.mutate({
                  itemId: item.id,
                  sessionDate: field(f, 'date'),
                  durationMinutes: Number(field(f, 'duration')),
                  progressDelta: numberOrNull(field(f, 'delta')),
                  note: field(f, 'note') || null,
                });
                e.currentTarget.reset();
              }}
            >
              <h3>记录娱乐时间</h3>
              <LocalDateInput name="date" defaultValue={today()} required />
              <div className="form-grid">
                <input name="duration" type="number" min="0" placeholder="分钟" required />
                <input name="delta" type="number" step="0.1" placeholder="进度增量" />
              </div>
              <input name="note" placeholder="本次记录" />
              <button className="button">保存时间</button>
            </form>
            {selectedSession ? (
              <form
                className="compact-form"
                aria-label="编辑娱乐时长记录"
                key={`${selectedSession.id}:${String(selectedSession.version)}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  updateSession.mutate({
                    id: selectedSession.id,
                    version: selectedSession.version,
                    sessionDate: field(f, 'date'),
                    durationMinutes: Number(field(f, 'duration')),
                    progressDelta: numberOrNull(field(f, 'delta')),
                    note: field(f, 'note') || null,
                  });
                }}
              >
                <h3>编辑娱乐时长</h3>
                <LocalDateInput name="date" defaultValue={selectedSession.sessionDate} required />
                <div className="form-grid">
                  <input
                    name="duration"
                    type="number"
                    min="0"
                    defaultValue={selectedSession.durationMinutes}
                    required
                  />
                  <input
                    name="delta"
                    type="number"
                    step="0.1"
                    defaultValue={selectedSession.progressDelta ?? ''}
                    placeholder="进度增量"
                  />
                </div>
                <input
                  name="note"
                  defaultValue={selectedSession.note ?? ''}
                  placeholder="本次记录"
                />
                <div className="button-row">
                  <button className="button button--primary" disabled={updateSession.isPending}>
                    保存修改
                  </button>
                  <button
                    type="button"
                    className="button button--danger"
                    disabled={deleteSession.isPending}
                    onClick={() => {
                      if (window.confirm('确定将这条娱乐时长记录移入回收站？'))
                        deleteSession.mutate(
                          { id: selectedSession.id, version: selectedSession.version },
                          {
                            onSuccess: () => {
                              setSelectedSessionId(undefined);
                            },
                          },
                        );
                    }}
                  >
                    移入回收站
                  </button>
                </div>
              </form>
            ) : null}
            {['ACTIVITY', 'TRIP'].includes(item.itemType) && (
              <form
                className="compact-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  putTrip.mutate({
                    id: item.id,
                    startAt: field(f, 'start') ? dateIso(field(f, 'start')) : null,
                    endAt: field(f, 'end') ? dateIso(field(f, 'end')) : null,
                    location: field(f, 'location') || null,
                    eventId: null,
                    taskId: null,
                  });
                }}
              >
                <h3>活动 / 旅行详情</h3>
                <div className="form-grid">
                  <LocalDateInput name="start" />
                  <LocalDateInput name="end" />
                </div>
                <input name="location" placeholder="地点" />
                <button className="button">保存详情</button>
              </form>
            )}
            <form
              className="compact-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                createExpense.mutate({
                  id: item.id,
                  occurredAt: dateIso(field(f, 'date')),
                  amountMinor: Math.round(Number(field(f, 'amount')) * 100),
                  merchant: field(f, 'merchant') || null,
                  note: field(f, 'note') || null,
                });
                e.currentTarget.reset();
              }}
            >
              <h3>娱乐支出</h3>
              <LocalDateInput name="date" defaultValue={today()} required />
              <div className="form-grid">
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="金额（元）"
                  required
                />
                <input name="merchant" placeholder="商家" />
              </div>
              <input name="note" placeholder="支出备注" />
              <button className="button">记录支出</button>
            </form>
          </>
        ) : (
          <p>先创建或选择一个娱乐条目。</p>
        )}
      </aside>
    </div>
  );
};
const lifeCreateLabel: Record<Exclude<LifeSection, 'overview'>, string> = {
  shopping: '添加待购',
  diet: '记录一餐',
  fitness: '记录一次训练',
  entertainment: '添加娱乐',
};

const lifeManageLabel: Record<Exclude<LifeSection, 'overview'>, string> = {
  shopping: '管理购物',
  diet: '管理饮食资料',
  fitness: '管理训练资料',
  entertainment: '管理娱乐详情',
};

export const LifePage = ({ section = 'overview' }: { section?: LifeSection }) => {
  const target = readEntityDetailTarget(window.location.search);
  const [panel, setPanel] = useState<{
    readonly section: LifeSection;
    readonly mode: 'browse' | 'create' | 'manage';
  }>({ section, mode: target === undefined ? 'browse' : 'manage' });
  const mode = panel.section === section ? panel.mode : 'browse';
  const setMode = (nextMode: typeof panel.mode) => {
    setPanel({ section, mode: nextMode });
  };
  const actionableSection = section === 'overview' ? null : section;

  return (
    <div
      className="page life-page work-page"
      data-life-section={section}
      data-life-mode={mode}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('[data-life-open-editor="true"]') !== null) {
          setMode('manage');
        }
      }}
      onSubmitCapture={() => {
        setMode('browse');
      }}
    >
      <header className="page__header life-page__header">
        <div>
          <p className="page__context">生活</p>
          <h1>{links.find(([id]) => id === section)?.[2]}</h1>
          <p className="page__positioning">我的生活正在怎么进行？</p>
          <p>把消费、饮食、训练与休闲放回同一套本地生活记录中。</p>
        </div>
        {actionableSection === null ? null : (
          <div className="life-page__actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setMode('manage');
              }}
            >
              {lifeManageLabel[actionableSection]}
            </button>
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                setMode('create');
              }}
            >
              ＋ {lifeCreateLabel[actionableSection]}
            </button>
          </div>
        )}
      </header>
      <LifeNav section={section} />
      {section === 'overview' ? (
        <Overview />
      ) : section === 'shopping' ? (
        <Shopping
          {...(target?.entityType === 'SHOPPING_ITEM' ? { targetId: target.entityId } : {})}
        />
      ) : section === 'diet' ? (
        <Diet {...(target?.entityType === 'RECIPE' ? { targetId: target.entityId } : {})} />
      ) : section === 'fitness' ? (
        <Fitness
          {...(target?.entityType === 'WORKOUT_PLAN' ? { targetId: target.entityId } : {})}
        />
      ) : (
        <Entertainment
          {...(target?.entityType === 'ENTERTAINMENT_ITEM' ? { targetId: target.entityId } : {})}
        />
      )}
      {mode === 'browse' ? null : (
        <>
          <button
            className="life-drawer__scrim"
            type="button"
            aria-label="关闭编辑面板"
            onClick={() => {
              setMode('browse');
            }}
          />
          <div
            className="life-drawer__chrome"
            role="dialog"
            aria-modal="true"
            aria-label="生活编辑面板"
            aria-owns={mode === 'create' ? 'life-create-panel' : 'life-manage-panel'}
          >
            <span>{mode === 'create' ? '创建记录' : '管理详情'}</span>
            <button
              className="button button--small"
              type="button"
              onClick={() => {
                setMode('browse');
              }}
            >
              关闭
            </button>
          </div>
        </>
      )}
    </div>
  );
};
