import { useState, type CSSProperties } from 'react';

import {
  usePlanningCalendar,
  usePlanningGoalTree,
  usePlanningKanban,
  usePlanningTimeline,
  useSetGoalProgress,
  useSetPlanProgress,
  type PlanningFilters,
} from './api.js';

export type PlanningView = 'KANBAN' | 'CALENDAR' | 'TIMELINE' | 'GOAL_TREE';

interface ProgressEntity {
  readonly id: string;
  readonly version: number;
  readonly autoProgress: number;
  readonly manualProgress: number | null;
  readonly progressMode: 'AUTO' | 'MANUAL_OVERRIDE';
  readonly displayProgress: number;
}

const ProgressControl = ({ entity, type }: { entity: ProgressEntity; type: 'GOAL' | 'PLAN' }) => {
  const setGoalProgress = useSetGoalProgress();
  const setPlanProgress = useSetPlanProgress();
  const mutation = type === 'GOAL' ? setGoalProgress : setPlanProgress;
  const [value, setValue] = useState(entity.manualProgress ?? Math.round(entity.displayProgress));
  return (
    <div className="progress-control" data-progress-entity={type}>
      <div className="progress-track">
        <span style={{ width: `${String(entity.displayProgress)}%` }} />
      </div>
      <strong>{Math.round(entity.displayProgress)}%</strong>
      <span>
        {entity.progressMode === 'AUTO'
          ? `自动进度 ${String(Math.round(entity.autoProgress))}%`
          : '手动覆盖'}
      </span>
      <input
        aria-label="手动进度"
        type="number"
        min="0"
        max="100"
        value={value}
        onChange={(event) => {
          setValue(Number(event.target.value));
        }}
      />
      <button
        className="button button--small"
        type="button"
        disabled={mutation.isPending}
        onClick={() => {
          mutation.mutate({ id: entity.id, version: entity.version, value });
        }}
      >
        手动覆盖
      </button>
      <button
        className="button button--small"
        type="button"
        disabled={mutation.isPending || entity.progressMode === 'AUTO'}
        onClick={() => {
          mutation.mutate({ id: entity.id, version: entity.version, value: null });
        }}
      >
        恢复自动
      </button>
    </div>
  );
};

const statusName = {
  DRAFT: '草稿',
  ACTIVE: '进行中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
} as const;

const statusPresentation = {
  DRAFT: {
    subtitle: '想法与待明确事项',
    emptyTitle: '暂无草稿计划',
    emptyDescription: '把尚未展开的想法留在这里',
  },
  ACTIVE: {
    subtitle: '正在推进的计划',
    emptyTitle: '暂无进行中的计划',
    emptyDescription: '选定方向后，从第一步开始推进',
  },
  PAUSED: {
    subtitle: '暂缓推进的计划',
    emptyTitle: '暂无暂停的计划',
    emptyDescription: '需要时可随时继续推进',
  },
  COMPLETED: {
    subtitle: '已经抵达的阶段',
    emptyTitle: '暂无完成的计划',
    emptyDescription: '完成的足迹会在这里汇聚',
  },
  CANCELLED: {
    subtitle: '已经放下的计划',
    emptyTitle: '暂无已取消的计划',
    emptyDescription: '重新规划会更接近目标',
  },
} as const;

const KanbanEmptyState = ({ status }: { status: keyof typeof statusPresentation }) => {
  const presentation = statusPresentation[status];

  return (
    <div className="planning-kanban-empty" data-empty-status={status}>
      <div className="planning-empty-illustration" aria-hidden="true">
        <span className="planning-empty-shape planning-empty-shape--primary" />
        <span className="planning-empty-shape planning-empty-shape--secondary" />
        <span className="planning-empty-shape planning-empty-shape--detail" />
        <span className="planning-empty-spark planning-empty-spark--one" />
        <span className="planning-empty-spark planning-empty-spark--two" />
      </div>
      <strong>{presentation.emptyTitle}</strong>
      <p>{presentation.emptyDescription}</p>
    </div>
  );
};

export const PlanningViews = ({
  view,
  filters,
  onEditGoal,
  onEditPlan,
}: {
  view: PlanningView;
  filters: PlanningFilters;
  onEditGoal: (id: string) => void;
  onEditPlan: (id: string) => void;
}) => {
  const kanban = usePlanningKanban(filters);
  const calendar = usePlanningCalendar(filters);
  const timeline = usePlanningTimeline(filters);
  const tree = usePlanningGoalTree(filters);

  if ([kanban, calendar, timeline, tree].some((query) => query.isError)) {
    return <p className="form-error">计划视图加载失败，请稍后重试。</p>;
  }
  if ([kanban, calendar, timeline, tree].some((query) => query.isLoading)) {
    return <p className="status-line">正在读取计划数据…</p>;
  }
  if (view === 'KANBAN') {
    return (
      <div className="planning-kanban" data-planning-view="kanban">
        {(kanban.data ?? []).map((column) => (
          <section key={column.status}>
            <header>
              <div>
                <h3>{statusName[column.status]}</h3>
                <p>{statusPresentation[column.status].subtitle}</p>
              </div>
              <span>{column.plans.length}</span>
            </header>
            {column.plans.map((plan) => (
              <article key={plan.id}>
                <strong>{plan.title}</strong>
                <small>
                  {plan.startDate} → {plan.endDate}
                </small>
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => {
                    onEditPlan(plan.id);
                  }}
                >
                  编辑计划
                </button>
                <ProgressControl entity={plan} type="PLAN" />
              </article>
            ))}
            {column.plans.length === 0 ? <KanbanEmptyState status={column.status} /> : null}
          </section>
        ))}
      </div>
    );
  }
  if (view === 'CALENDAR') {
    return (
      <div className="planning-calendar" data-planning-view="calendar">
        {(calendar.data ?? []).map((day) => (
          <section key={day.date}>
            <time>{day.date}</time>
            <div>
              {day.plans.map((plan) => (
                <p className="planning-calendar__plan" key={plan.id}>
                  <strong>{plan.title}</strong>
                  <span>计划边界</span>
                  <button
                    className="button button--small"
                    type="button"
                    onClick={() => {
                      onEditPlan(plan.id);
                    }}
                  >
                    编辑计划
                  </button>
                </p>
              ))}
            </div>
            <div>
              {day.tasks.map((task) => (
                <p className="planning-calendar__task" key={task.id}>
                  <strong>{task.title}</strong>
                  <span>
                    {
                      {
                        TODO: '待办',
                        IN_PROGRESS: '进行中',
                        COMPLETED: '已完成',
                        CANCELLED: '已取消',
                      }[task.status]
                    }
                  </span>
                </p>
              ))}
            </div>
          </section>
        ))}
        {!calendar.isLoading && calendar.data?.length === 0 ? (
          <p className="empty-copy">当前范围没有计划日期。</p>
        ) : null}
      </div>
    );
  }
  if (view === 'TIMELINE') {
    const rows = timeline.data ?? [];
    const minimum =
      rows.length === 0
        ? 0
        : Math.min(...rows.map((row) => Date.parse(`${row.plan.startDate}T00:00:00+08:00`)));
    const maximum = Math.max(
      ...rows.map((row) => Date.parse(`${row.plan.endDate}T00:00:00+08:00`)),
      minimum + 86_400_000,
    );
    return (
      <div className="planning-timeline" data-planning-view="timeline">
        {rows.map(({ goal, plan }) => {
          const start = Date.parse(`${plan.startDate}T00:00:00+08:00`);
          const end = Date.parse(`${plan.endDate}T00:00:00+08:00`);
          const style = {
            '--timeline-left': `${String(((start - minimum) / (maximum - minimum)) * 100)}%`,
            '--timeline-width': `${String(Math.max(3, ((end - start) / (maximum - minimum)) * 100))}%`,
          } as CSSProperties;
          return (
            <section key={plan.id}>
              <header>
                <strong>{plan.title}</strong>
                <span>{goal?.title ?? '未关联目标'}</span>
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => {
                    onEditPlan(plan.id);
                  }}
                >
                  编辑计划
                </button>
              </header>
              <div className="timeline-track">
                <span style={style}>
                  {plan.startDate} → {plan.endDate}
                </span>
              </div>
            </section>
          );
        })}
        {!timeline.isLoading && rows.length === 0 ? (
          <p className="empty-copy">当前范围没有计划。</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="goal-tree-list" data-planning-view="goal-tree">
      {(tree.data ?? []).map(({ goal, plans, directTasks }) => (
        <article className="goal-node" key={goal.id}>
          <header>
            <div>
              <h3>{goal.title}</h3>
              <p>
                {goal.horizon === 'SHORT_TERM' ? '短期目标' : '长期目标'} ·{' '}
                {statusName[goal.status]}
              </p>
            </div>
            <button
              className="button button--small"
              type="button"
              onClick={() => {
                onEditGoal(goal.id);
              }}
            >
              编辑目标
            </button>
          </header>
          <ProgressControl entity={goal} type="GOAL" />
          <ul>
            {plans.map(({ plan, tasks }) => (
              <li className="goal-tree-plan" key={plan.id}>
                <strong>{plan.title}</strong>
                <small>
                  {plan.startDate} → {plan.endDate}
                </small>
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => {
                    onEditPlan(plan.id);
                  }}
                >
                  编辑计划
                </button>
                <ProgressControl entity={plan} type="PLAN" />
                <ul className="tree-tasks">
                  {tasks
                    .filter((task) => task.parentTaskId === null)
                    .map((task) => (
                      <li className="goal-tree-task" key={task.id}>
                        {task.title}
                        <ul>
                          {tasks
                            .filter((child) => child.parentTaskId === task.id)
                            .map((child) => (
                              <li className="goal-tree-task goal-tree-task--child" key={child.id}>
                                {child.title}
                              </li>
                            ))}
                        </ul>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
          {directTasks.length ? (
            <div className="direct-tasks">
              <strong>直接关联任务</strong>
              {directTasks.map((task) => (
                <span key={task.id}>{task.title}</span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
      {!tree.isLoading && tree.data?.length === 0 ? (
        <p className="empty-copy">当前范围没有目标。</p>
      ) : null}
    </div>
  );
};
