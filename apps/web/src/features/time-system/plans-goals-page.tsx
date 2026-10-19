import { useCallback, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import { formatDateTime } from '../../shared/format.js';
import { useFormDraft } from '../../shared/form-draft.js';
import { LocalDateInput } from '../../shared/product-fields.js';
import { readEntityDetailTarget } from '../../shared/entity-detail-target.js';

import { useCategories, useSetupStatus } from '../settings/api.js';
import { SetupPage } from '../settings/setup-page.js';
import {
  useCreateGoal,
  useCreatePlan,
  useDeleteGoal,
  useDeletePlan,
  useGoals,
  usePlans,
  useTasks,
  useUpdateGoal,
  useUpdatePlan,
  type GoalItem,
  type PlanItem,
  type PlanningFilters,
  type PlanningRange,
} from './api.js';
import { PlanningViews, type PlanningView } from './planning-views.js';
import { EntityTagsEditor } from './entity-tags-editor.js';
import { GoalMetricsEditor } from './goal-metrics-editor.js';
import { PlanMilestonesEditor } from './plan-milestones-editor.js';

const localDate = (offsetDays = 0): string => {
  const shifted = new Date(Date.now() + 8 * 3_600_000 + offsetDays * 86_400_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
};

interface GoalDraft {
  title: string;
  categoryId: string;
  endDate: string;
}

interface PlanDraft {
  title: string;
  goalId: string;
  endDate: string;
}

const parseGoalDraft = (value: unknown): GoalDraft | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.categoryId !== 'string' ||
    typeof draft.endDate !== 'string'
  )
    return undefined;
  return { title: draft.title, categoryId: draft.categoryId, endDate: draft.endDate };
};

const parsePlanDraft = (value: unknown): PlanDraft | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.goalId !== 'string' ||
    typeof draft.endDate !== 'string'
  )
    return undefined;
  return { title: draft.title, goalId: draft.goalId, endDate: draft.endDate };
};

interface GoalEditDraft {
  readonly title: string;
  readonly description: string;
  readonly status: GoalItem['status'];
  readonly startDate: string;
  readonly endDate: string;
}

interface PlanEditDraft {
  readonly title: string;
  readonly description: string;
  readonly status: PlanItem['status'];
  readonly priority: PlanItem['priority'];
  readonly startDate: string;
  readonly endDate: string;
}

const goalStatuses: readonly GoalItem['status'][] = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
];
const priorities: readonly PlanItem['priority'][] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const parseGoalEditDraft = (value: unknown): GoalEditDraft | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.description !== 'string' ||
    !goalStatuses.includes(draft.status as GoalItem['status']) ||
    typeof draft.startDate !== 'string' ||
    typeof draft.endDate !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    description: draft.description,
    status: draft.status as GoalItem['status'],
    startDate: draft.startDate,
    endDate: draft.endDate,
  };
};

const parsePlanEditDraft = (value: unknown): PlanEditDraft | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.description !== 'string' ||
    !goalStatuses.includes(draft.status as PlanItem['status']) ||
    !priorities.includes(draft.priority as PlanItem['priority']) ||
    typeof draft.startDate !== 'string' ||
    typeof draft.endDate !== 'string'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    description: draft.description,
    status: draft.status as PlanItem['status'],
    priority: draft.priority as PlanItem['priority'],
    startDate: draft.startDate,
    endDate: draft.endDate,
  };
};

const statusLabels: Record<GoalItem['status'], string> = {
  DRAFT: '草稿',
  ACTIVE: '进行中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const priorityLabels: Record<PlanItem['priority'], string> = {
  LOW: '低',
  NORMAL: '普通',
  HIGH: '高',
  URGENT: '紧急',
};

export const GoalEditForm = ({
  goal,
  relatedPlans = [],
  relatedTasks = [],
  isPending,
  onSave,
  onDelete,
  tagEditor,
  metricEditor,
  onClose,
}: {
  readonly goal: GoalItem;
  readonly relatedPlans?: readonly Pick<PlanItem, 'id' | 'title' | 'status'>[];
  readonly relatedTasks?: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }[];
  readonly isPending: boolean;
  readonly onSave: (value: GoalEditDraft, onSuccess: () => void) => void;
  readonly onDelete: (onSuccess: () => void) => void;
  readonly tagEditor?: ReactNode;
  readonly metricEditor?: ReactNode;
  readonly onClose: () => void;
}) => {
  const [value, setValue] = useState<GoalEditDraft>(() => ({
    title: goal.title,
    description: goal.description ?? '',
    status: goal.status,
    startDate: goal.startDate,
    endDate: goal.endDate ?? '',
  }));
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: GoalEditDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'GOAL',
    mode: 'edit',
    entityId: goal.id,
    enabled: true,
    dirty,
    value,
    parse: parseGoalEditDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof GoalEditDraft>(key: K, next: GoalEditDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const close = () => {
    formDraft.saveNow();
    onClose();
  };

  return (
    <form
      className="planning-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value, () => {
          formDraft.clear();
          onClose();
        });
      }}
    >
      <header>
        <h2>编辑目标</h2>
        <button className="button button--small" type="button" onClick={close}>
          关闭
        </button>
      </header>
      {restoredAt === undefined ? null : (
        <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
      )}
      <label>
        目标名称
        <input
          value={value.title}
          required
          onChange={(event) => {
            change('title', event.target.value);
          }}
        />
      </label>
      <label>
        目标说明
        <textarea
          value={value.description}
          onChange={(event) => {
            change('description', event.target.value);
          }}
        />
      </label>
      <label>
        目标状态
        <select
          value={value.status}
          onChange={(event) => {
            change('status', event.target.value as GoalItem['status']);
          }}
        >
          {goalStatuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          开始日期
          <LocalDateInput
            value={value.startDate}
            required
            onChange={(event) => {
              change('startDate', event.target.value);
            }}
          />
        </label>
        <label>
          目标日期
          <LocalDateInput
            value={value.endDate}
            onChange={(event) => {
              change('endDate', event.target.value);
            }}
          />
        </label>
      </div>
      <section aria-label="目标关联详情">
        <h3>关联计划与任务</h3>
        <p className="field-hint">
          {relatedPlans.length} 个计划 · {relatedTasks.length} 个任务
        </p>
        {relatedPlans.length === 0 ? (
          <p className="field-hint">尚无关联计划。</p>
        ) : (
          <ul>
            {relatedPlans.map((plan) => (
              <li key={plan.id}>{plan.title}</li>
            ))}
          </ul>
        )}
        {relatedTasks.length === 0 ? (
          <p className="field-hint">尚无关联任务。</p>
        ) : (
          <ul>
            {relatedTasks.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
        )}
      </section>
      {metricEditor}
      {tagEditor}
      <div className="form-actions">
        <button className="button button--primary" disabled={isPending}>
          保存目标
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              formDraft.clear();
              onClose();
            }}
          >
            丢弃草稿
          </button>
        ) : null}
        <button
          className="button button--danger"
          type="button"
          disabled={isPending}
          onClick={() => {
            if (window.confirm('确定将这个目标移入回收站？')) {
              onDelete(() => {
                formDraft.clear();
                onClose();
              });
            }
          }}
        >
          移入回收站
        </button>
      </div>
    </form>
  );
};

export const PlanEditForm = ({
  plan,
  relatedGoal,
  relatedTasks = [],
  isPending,
  onSave,
  onDelete,
  tagEditor,
  milestoneEditor,
  onClose,
}: {
  readonly plan: PlanItem;
  readonly relatedGoal?: Pick<GoalItem, 'id' | 'title'> | undefined;
  readonly relatedTasks?: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }[];
  readonly isPending: boolean;
  readonly onSave: (value: PlanEditDraft, onSuccess: () => void) => void;
  readonly onDelete: (onSuccess: () => void) => void;
  readonly tagEditor?: ReactNode;
  readonly milestoneEditor?: ReactNode;
  readonly onClose: () => void;
}) => {
  const [value, setValue] = useState<PlanEditDraft>(() => ({
    title: plan.title,
    description: plan.description ?? '',
    status: plan.status,
    priority: plan.priority,
    startDate: plan.startDate,
    endDate: plan.endDate,
  }));
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: PlanEditDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'PLAN',
    mode: 'edit',
    entityId: plan.id,
    enabled: true,
    dirty,
    value,
    parse: parsePlanEditDraft,
    onRestore: restoreDraft,
  });
  const change = <K extends keyof PlanEditDraft>(key: K, next: PlanEditDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };
  const close = () => {
    formDraft.saveNow();
    onClose();
  };

  return (
    <>
      <form
        className="planning-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(value, () => {
            formDraft.clear();
            onClose();
          });
        }}
      >
        <header>
          <h2>编辑计划</h2>
          <button className="button button--small" type="button" onClick={close}>
            关闭
          </button>
        </header>
        {restoredAt === undefined ? null : (
          <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
        )}
        <label>
          计划名称
          <input
            value={value.title}
            required
            onChange={(event) => {
              change('title', event.target.value);
            }}
          />
        </label>
        <label>
          计划说明
          <textarea
            value={value.description}
            onChange={(event) => {
              change('description', event.target.value);
            }}
          />
        </label>
        <div className="form-grid">
          <label>
            计划状态
            <select
              value={value.status}
              onChange={(event) => {
                change('status', event.target.value as PlanItem['status']);
              }}
            >
              {goalStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            优先级
            <select
              value={value.priority}
              onChange={(event) => {
                change('priority', event.target.value as PlanItem['priority']);
              }}
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            开始日期
            <LocalDateInput
              value={value.startDate}
              required
              onChange={(event) => {
                change('startDate', event.target.value);
              }}
            />
          </label>
          <label>
            截止日期
            <LocalDateInput
              value={value.endDate}
              required
              onChange={(event) => {
                change('endDate', event.target.value);
              }}
            />
          </label>
        </div>
        <section aria-label="计划关联详情">
          <h3>关联目标与任务</h3>
          <p className="field-hint">
            所属目标：{relatedGoal?.title ?? '无'} · {relatedTasks.length} 个任务
          </p>
          {relatedTasks.length === 0 ? (
            <p className="field-hint">尚无关联任务。</p>
          ) : (
            <ul>
              {relatedTasks.map((task) => (
                <li key={task.id}>{task.title}</li>
              ))}
            </ul>
          )}
        </section>
        <div className="form-actions">
          <button className="button button--primary" disabled={isPending}>
            保存计划
          </button>
          {dirty || formDraft.hasDraft ? (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                formDraft.clear();
                onClose();
              }}
            >
              丢弃草稿
            </button>
          ) : null}
          <button
            className="button button--danger"
            type="button"
            disabled={isPending}
            onClick={() => {
              if (window.confirm('确定将这个计划移入回收站？')) {
                onDelete(() => {
                  formDraft.clear();
                  onClose();
                });
              }
            }}
          >
            移入回收站
          </button>
        </div>
      </form>
      {milestoneEditor}
      {tagEditor}
    </>
  );
};

export const PlansGoalsPage = () => {
  const target = readEntityDetailTarget(window.location.search);
  const setup = useSetupStatus();
  const categories = useCategories();
  const goals = useGoals();
  const plans = usePlans();
  const tasks = useTasks(true);
  const createGoal = useCreateGoal();
  const createPlan = useCreatePlan();
  const updateGoal = useUpdateGoal();
  const updatePlan = useUpdatePlan();
  const deleteGoal = useDeleteGoal();
  const deletePlan = useDeletePlan();
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategoryId, setGoalCategoryId] = useState('');
  const [goalEndDate, setGoalEndDate] = useState(() => localDate(30));
  const [planTitle, setPlanTitle] = useState('');
  const [planGoalId, setPlanGoalId] = useState('');
  const [planEndDate, setPlanEndDate] = useState(() => localDate(14));
  const [goalDirty, setGoalDirty] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const [goalRestoredAt, setGoalRestoredAt] = useState<string>();
  const [planRestoredAt, setPlanRestoredAt] = useState<string>();
  const [view, setView] = useState<PlanningView>('KANBAN');
  const [range, setRange] = useState<PlanningRange>('WEEK');
  const [filterArea, setFilterArea] = useState<'ALL' | 'WORK' | 'LIFE'>('ALL');
  const [creation, setCreation] = useState<'closed' | 'menu' | 'goal' | 'plan'>('closed');
  const [editing, setEditing] = useState<
    { readonly type: 'GOAL' | 'PLAN'; readonly id: string } | undefined
  >(
    target?.entityType === 'GOAL' || target?.entityType === 'PLAN'
      ? { type: target.entityType, id: target.entityId }
      : undefined,
  );
  const goalDraftValue = useMemo(
    () => ({ title: goalTitle, categoryId: goalCategoryId, endDate: goalEndDate }),
    [goalCategoryId, goalEndDate, goalTitle],
  );
  const planDraftValue = useMemo(
    () => ({ title: planTitle, goalId: planGoalId, endDate: planEndDate }),
    [planEndDate, planGoalId, planTitle],
  );
  const restoreGoalDraft = useCallback((draft: GoalDraft, updatedAt: string) => {
    setGoalTitle(draft.title);
    setGoalCategoryId(draft.categoryId);
    setGoalEndDate(draft.endDate);
    setGoalDirty(true);
    setGoalRestoredAt(updatedAt);
  }, []);
  const restorePlanDraft = useCallback((draft: PlanDraft, updatedAt: string) => {
    setPlanTitle(draft.title);
    setPlanGoalId(draft.goalId);
    setPlanEndDate(draft.endDate);
    setPlanDirty(true);
    setPlanRestoredAt(updatedAt);
  }, []);
  const goalDraft = useFormDraft({
    formType: 'GOAL',
    mode: 'create',
    enabled: creation === 'goal',
    dirty: goalDirty,
    value: goalDraftValue,
    parse: parseGoalDraft,
    onRestore: restoreGoalDraft,
  });
  const planDraft = useFormDraft({
    formType: 'PLAN',
    mode: 'create',
    enabled: creation === 'plan',
    dirty: planDirty,
    value: planDraftValue,
    parse: parsePlanDraft,
    onRestore: restorePlanDraft,
  });
  const closeCreation = () => {
    if (creation === 'goal') goalDraft.saveNow();
    if (creation === 'plan') planDraft.saveNow();
    setCreation('closed');
  };

  if (setup.isLoading) return <main className="page">正在读取计划数据…</main>;
  if (!setup.data?.initialized) return <SetupPage />;

  const activeCategories = categories.data?.data.filter((category) => !category.isArchived) ?? [];
  const effectiveGoalCategory =
    goalCategoryId === '' ? (activeCategories.at(0)?.id ?? '') : goalCategoryId;
  const selectedGoal = goals.data?.find((goal) => goal.id === planGoalId);
  const planCategoryId = selectedGoal?.categoryId ?? effectiveGoalCategory;
  const filters: PlanningFilters = { range, ...(filterArea === 'ALL' ? {} : { area: filterArea }) };

  const submitGoal = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (effectiveGoalCategory === '') return;
    createGoal.mutate(
      {
        categoryId: effectiveGoalCategory,
        title: goalTitle,
        goalType: 'OUTCOME',
        startDate: localDate(),
        endDate: goalEndDate,
      },
      {
        onSuccess: () => {
          goalDraft.clear();
          setGoalDirty(false);
          setGoalRestoredAt(undefined);
          setGoalTitle('');
          setCreation('closed');
        },
      },
    );
  };

  const submitPlan = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (planCategoryId === '') return;
    createPlan.mutate(
      {
        goalId: planGoalId || null,
        categoryId: planCategoryId,
        title: planTitle,
        priority: 'NORMAL',
        startDate: localDate(),
        endDate: planEndDate,
      },
      {
        onSuccess: () => {
          planDraft.clear();
          setPlanDirty(false);
          setPlanRestoredAt(undefined);
          setPlanTitle('');
          setCreation('closed');
        },
      },
    );
  };
  return (
    <main className="page plans-page">
      <header className="page__header planning-page-header">
        <div>
          <p className="eyebrow">VISION · 方向与时间</p>
          <h1>计划与目标</h1>
          <p className="page__positioning">我正在朝哪里走？</p>
          <p>明确方向，用计划承接阶段成果，让每一步都靠近理想的未来。</p>
        </div>
        <div className="planning-create-menu">
          <button
            className="button button--primary"
            type="button"
            aria-expanded={creation === 'menu'}
            onClick={() => {
              setCreation((value) => (value === 'menu' ? 'closed' : 'menu'));
            }}
          >
            ＋ 新建
          </button>
          {creation === 'menu' ? (
            <div className="planning-create-menu__popover">
              <button
                type="button"
                onClick={() => {
                  setCreation('goal');
                }}
              >
                新建目标
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreation('plan');
                }}
              >
                新建计划
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <section className="goal-tree-section planning-workspace" data-vision-view={view}>
        <div className="section-heading">
          <div>
            <h2>统一计划视图</h2>
            <p>四种视图共享同一份目标、计划和任务数据，修改进度后同步刷新。</p>
          </div>
        </div>
        <div className="planning-toolbar">
          <div className="segmented-control">
            {(
              [
                ['KANBAN', '看板'],
                ['CALENDAR', '日历'],
                ['TIMELINE', '时间轴'],
                ['GOAL_TREE', '目标树'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-selected={view === id}
                onClick={() => {
                  setView(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label="计划范围"
            value={range}
            onChange={(event) => {
              setRange(event.target.value as PlanningRange);
            }}
          >
            <option value="TODAY">今日</option>
            <option value="WEEK">本周</option>
            <option value="SHORT_TERM">短期</option>
            <option value="LONG_TERM">长期</option>
          </select>
          <select
            aria-label="计划区域"
            value={filterArea}
            onChange={(event) => {
              setFilterArea(event.target.value as typeof filterArea);
            }}
          >
            <option value="ALL">工作与生活</option>
            <option value="WORK">仅工作</option>
            <option value="LIFE">仅生活</option>
          </select>
        </div>
        <PlanningViews
          view={view}
          filters={filters}
          onEditGoal={(id) => {
            setEditing({ type: 'GOAL', id });
          }}
          onEditPlan={(id) => {
            setEditing({ type: 'PLAN', id });
          }}
        />
      </section>

      <section className="planning-direction-section" aria-labelledby="planning-direction-heading">
        <div className="planning-direction-heading">
          <p className="eyebrow">延伸方向</p>
          <h2 id="planning-direction-heading">建立新的方向</h2>
          <p>先确定想抵达的位置，再把它拆成可以执行的计划。</p>
        </div>
        <div className="planning-direction-grid">
          <button
            className="planning-direction-card"
            data-creation-kind="goal"
            type="button"
            aria-label="新建目标：确定一个长期想靠近的方向"
            onClick={() => {
              setCreation('goal');
            }}
          >
            <span className="planning-direction-card__copy">
              <strong>新建目标</strong>
              <span>确定一个长期想靠近的方向</span>
              <span className="planning-direction-card__action">建立目标 →</span>
            </span>
          </button>
          <button
            className="planning-direction-card"
            data-creation-kind="plan"
            type="button"
            aria-label="新建计划：把目标拆成可以执行的阶段"
            onClick={() => {
              setCreation('plan');
            }}
          >
            <span className="planning-direction-card__copy">
              <strong>新建计划</strong>
              <span>把目标拆成可以执行的阶段</span>
              <span className="planning-direction-card__action">建立计划 →</span>
            </span>
          </button>
        </div>
      </section>

      {creation === 'goal' || creation === 'plan' ? (
        <div
          className="planning-create-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeCreation();
          }}
        >
          <section
            className="planning-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-create-dialog-heading"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeCreation();
            }}
          >
            <header>
              <div>
                <p className="eyebrow">延伸方向</p>
                <h2 id="planning-create-dialog-heading">
                  {creation === 'goal' ? '新建目标' : '新建计划'}
                </h2>
              </div>
              <button
                className="button button--small"
                type="button"
                onClick={() => {
                  closeCreation();
                }}
              >
                关闭
              </button>
            </header>
            <div className="planning-composer">
              {creation === 'goal' ? (
                <form className="planning-form" data-creation-kind="goal" onSubmit={submitGoal}>
                  <p className="planning-form__description">确立方向，长期价值的指引。</p>
                  {goalRestoredAt === undefined ? null : (
                    <p className="draft-restored">
                      已恢复 {formatDateTime(goalRestoredAt)} 的未保存草稿
                    </p>
                  )}
                  <input
                    aria-label="目标名称"
                    placeholder="例如：一个月内完成核心时间系统"
                    value={goalTitle}
                    onChange={(event) => {
                      setGoalTitle(event.target.value);
                      setGoalDirty(true);
                    }}
                    required
                  />
                  <select
                    aria-label="目标分类"
                    value={effectiveGoalCategory}
                    onChange={(event) => {
                      setGoalCategoryId(event.target.value);
                      setGoalDirty(true);
                    }}
                  >
                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.parentArea === 'WORK' ? '工作' : '生活'} · {category.name}
                      </option>
                    ))}
                  </select>
                  <label>
                    目标日期
                    <LocalDateInput
                      value={goalEndDate}
                      onChange={(event) => {
                        setGoalEndDate(event.target.value);
                        setGoalDirty(true);
                      }}
                    />
                  </label>
                  <button className="button button--primary" type="submit">
                    创建目标
                  </button>
                  {goalDirty || goalDraft.hasDraft ? (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        goalDraft.clear();
                        setGoalTitle('');
                        setGoalCategoryId('');
                        setGoalEndDate(localDate(30));
                        setGoalDirty(false);
                        setGoalRestoredAt(undefined);
                        setCreation('closed');
                      }}
                    >
                      丢弃草稿
                    </button>
                  ) : null}
                </form>
              ) : null}
              {creation === 'plan' ? (
                <form className="planning-form" data-creation-kind="plan" onSubmit={submitPlan}>
                  <p className="planning-form__description">拆解目标，制定可执行的步骤。</p>
                  {planRestoredAt === undefined ? null : (
                    <p className="draft-restored">
                      已恢复 {formatDateTime(planRestoredAt)} 的未保存草稿
                    </p>
                  )}
                  <input
                    aria-label="计划名称"
                    placeholder="计划要交付什么结果？"
                    value={planTitle}
                    onChange={(event) => {
                      setPlanTitle(event.target.value);
                      setPlanDirty(true);
                    }}
                    required
                  />
                  <select
                    aria-label="关联目标"
                    value={planGoalId}
                    onChange={(event) => {
                      setPlanGoalId(event.target.value);
                      setPlanDirty(true);
                    }}
                  >
                    <option value="">暂不关联目标</option>
                    {(goals.data ?? []).map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                  <label>
                    计划截止日期
                    <LocalDateInput
                      value={planEndDate}
                      onChange={(event) => {
                        setPlanEndDate(event.target.value);
                        setPlanDirty(true);
                      }}
                    />
                  </label>
                  <button className="button button--primary" type="submit">
                    创建计划
                  </button>
                  {planDirty || planDraft.hasDraft ? (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        planDraft.clear();
                        setPlanTitle('');
                        setPlanGoalId('');
                        setPlanEndDate(localDate(14));
                        setPlanDirty(false);
                        setPlanRestoredAt(undefined);
                        setCreation('closed');
                      }}
                    >
                      丢弃草稿
                    </button>
                  ) : null}
                </form>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
      {editing === undefined ? null : (
        <div className="planning-create-backdrop" role="presentation">
          <section
            className="planning-create-dialog"
            role="dialog"
            aria-label={editing.type === 'GOAL' ? '编辑目标' : '编辑计划'}
          >
            {editing.type === 'GOAL'
              ? (() => {
                  const goal = goals.data?.find((item) => item.id === editing.id);
                  return goal === undefined ? (
                    <p className="form-error">目标不存在或已被更新。</p>
                  ) : (
                    <GoalEditForm
                      key={`${goal.id}:${String(goal.version)}`}
                      goal={goal}
                      relatedPlans={(plans.data ?? []).filter((plan) => plan.goalId === goal.id)}
                      relatedTasks={(tasks.data ?? []).filter(
                        (task) =>
                          task.goalId === goal.id ||
                          (task.planId !== null &&
                            (plans.data ?? []).some(
                              (plan) => plan.id === task.planId && plan.goalId === goal.id,
                            )),
                      )}
                      tagEditor={<EntityTagsEditor entityId={goal.id} version={goal.version} />}
                      metricEditor={<GoalMetricsEditor goalId={goal.id} />}
                      isPending={updateGoal.isPending || deleteGoal.isPending}
                      onClose={() => {
                        setEditing(undefined);
                      }}
                      onSave={(value, onSuccess) => {
                        updateGoal.mutate(
                          {
                            id: goal.id,
                            version: goal.version,
                            ...value,
                            endDate: value.endDate || null,
                          },
                          { onSuccess },
                        );
                      }}
                      onDelete={(onSuccess) => {
                        deleteGoal.mutate({ id: goal.id, version: goal.version }, { onSuccess });
                      }}
                    />
                  );
                })()
              : (() => {
                  const plan = plans.data?.find((item) => item.id === editing.id);
                  return plan === undefined ? (
                    <p className="form-error">计划不存在或已被更新。</p>
                  ) : (
                    <PlanEditForm
                      key={`${plan.id}:${String(plan.version)}`}
                      plan={plan}
                      relatedGoal={goals.data?.find((goal) => goal.id === plan.goalId)}
                      relatedTasks={(tasks.data ?? []).filter((task) => task.planId === plan.id)}
                      milestoneEditor={
                        <PlanMilestonesEditor
                          planId={plan.id}
                          tasks={(tasks.data ?? []).filter((task) => task.planId === plan.id)}
                        />
                      }
                      tagEditor={<EntityTagsEditor entityId={plan.id} version={plan.version} />}
                      isPending={updatePlan.isPending || deletePlan.isPending}
                      onClose={() => {
                        setEditing(undefined);
                      }}
                      onSave={(value, onSuccess) => {
                        updatePlan.mutate(
                          { id: plan.id, version: plan.version, ...value },
                          { onSuccess },
                        );
                      }}
                      onDelete={(onSuccess) => {
                        deletePlan.mutate({ id: plan.id, version: plan.version }, { onSuccess });
                      }}
                    />
                  );
                })()}
          </section>
        </div>
      )}
    </main>
  );
};
