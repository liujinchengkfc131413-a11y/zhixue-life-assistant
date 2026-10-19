import { ChevronDown, ChevronUp, CircleCheck, Clock3, RefreshCcw } from 'lucide-react';
import { useState } from 'react';
import { formatTime } from '../../../shared/format.js';
import type { TaskItem, WarningItem } from '../api.js';
import {
  TodayAddForm,
  type TodayCategoryLike,
  type TodayCreateEventApi,
  type TodayCreateTaskApi,
} from './today-add-form.js';
import type {
  TodayFlexibleRailItem,
  TodayPlanRailItem,
  TodayPlanRailViewModel,
} from './today-scene-view-model.js';

const areaLabel = (area: 'WORK' | 'LIFE'): string => (area === 'WORK' ? '工作' : '生活');
const priorityLabel = (priority: TaskItem['priority']): string =>
  ({ LOW: '低', NORMAL: '普通', HIGH: '高', URGENT: '紧急' })[priority];
const durationLabel = (minutes: number): string =>
  minutes >= 60
    ? `${String(Math.floor(minutes / 60))} 小时${minutes % 60 === 0 ? '' : ` ${String(minutes % 60)} 分`}`
    : `${String(minutes)} 分`;

const RailWarnings = ({ warnings }: { warnings: readonly WarningItem[] }) =>
  warnings.length === 0 ? null : (
    <ul className="today-plan__warnings" aria-label="相关排程提醒">
      {warnings.map((warning) => (
        <li className="today-plan__warn" data-severity={warning.severity} key={warning.id}>
          {warning.message}
        </li>
      ))}
    </ul>
  );

const PlanRow = ({
  entry,
  onSelect,
  onComplete,
  completing = false,
  compact = false,
}: {
  entry: TodayPlanRailItem;
  onSelect: () => void;
  onComplete?: (() => void) | undefined;
  completing?: boolean | undefined;
  compact?: boolean | undefined;
}) => {
  const { item } = entry;
  const stateLabel =
    entry.completed || entry.temporalState === 'PAST'
      ? entry.completed
        ? '已完成'
        : '已结束'
      : entry.temporalState === 'CURRENT'
        ? '进行中'
        : undefined;

  return (
    <li
      className="today-plan__item"
      data-area={item.area}
      data-state={entry.completed ? 'COMPLETED' : entry.temporalState}
    >
      <div className="today-plan__row">
        <button type="button" className="today-plan__main" onClick={onSelect}>
          <span className="today-plan__title-line">
            <strong>{item.title}</strong>
            {stateLabel === undefined ? null : <em>{stateLabel}</em>}
          </span>
          <span>
            {compact
              ? formatTime(item.startAt)
              : `${formatTime(item.startAt)}–${formatTime(item.endAt)}`}
            {' · '}
            {compact
              ? `${durationLabel(Math.max(0, (Date.parse(item.endAt) - Date.parse(item.startAt)) / 60_000))} · `
              : ''}
            {areaLabel(item.area)} · {item.kind === 'EVENT' ? '固定日程' : '任务'}
          </span>
        </button>
        {onComplete === undefined || entry.completed ? null : (
          <button
            type="button"
            className="today-plan__done"
            aria-label={`完成任务：${item.title}`}
            disabled={completing}
            onClick={onComplete}
          >
            <CircleCheck aria-hidden="true" size={15} />
            <span>{completing ? '完成中…' : '完成'}</span>
          </button>
        )}
      </div>
      <RailWarnings warnings={entry.warnings} />
    </li>
  );
};

const FlexibleRow = ({
  entry,
  onSelect,
}: {
  entry: TodayFlexibleRailItem;
  onSelect: () => void;
}) => (
  <li className="today-plan__item today-plan__item--flexible" data-area={entry.task.preferredArea}>
    <button type="button" className="today-plan__main" onClick={onSelect}>
      <strong>{entry.task.title}</strong>
      <span>
        {priorityLabel(entry.task.priority)}优先级 · {areaLabel(entry.task.preferredArea)} ·{' '}
        {durationLabel(entry.task.estimatedMinutes)}
      </span>
    </button>
    <RailWarnings warnings={entry.warnings} />
  </li>
);

export const TodayPlanColumn = ({
  model,
  onSelectBlock,
  onSelectTask,
  onCompleteTask,
  completingTaskId,
  categories,
  createTask,
  createEvent,
  onReschedule,
  reschedulePending = false,
}: {
  model: TodayPlanRailViewModel;
  onSelectBlock: (id: string) => void;
  onSelectTask: (id: string) => void;
  onCompleteTask: (id: string, version: number) => void;
  completingTaskId?: string | undefined;
  categories: readonly TodayCategoryLike[];
  createTask: TodayCreateTaskApi;
  createEvent: TodayCreateEventApi;
  onReschedule?: (() => void) | undefined;
  reschedulePending?: boolean | undefined;
}) => {
  const [showAll, setShowAll] = useState(false);
  const [flexibleOpen, setFlexibleOpen] = useState(true);
  const visiblePlan = showAll ? model.primary : model.primary.slice(0, 6);

  return (
    <aside className="today-plan" aria-label="今日计划与事项">
      <section className="today-plan__section today-plan__section--primary">
        <div className="today-plan__heading">
          <div>
            <h2>今日计划</h2>
            <p>{String(model.primary.length)} 项行动</p>
          </div>
          <div className="today-plan__actions">
            {onReschedule === undefined ? null : (
              <button
                type="button"
                className="today-plan__reschedule"
                aria-label={reschedulePending ? '正在重新安排今日' : '重新安排今日'}
                disabled={reschedulePending}
                onClick={onReschedule}
              >
                <RefreshCcw aria-hidden="true" size={12} />
                <span>{reschedulePending ? '安排中…' : '重新安排'}</span>
              </button>
            )}
            {model.primary.length > 6 ? (
              <button
                type="button"
                className="today-plan__more"
                aria-expanded={showAll}
                onClick={() => {
                  setShowAll((value) => !value);
                }}
              >
                {showAll ? '收起' : '查看全部'}
              </button>
            ) : null}
            <TodayAddForm
              categories={categories}
              createTask={createTask}
              createEvent={createEvent}
            />
          </div>
        </div>
        {visiblePlan.length === 0 ? (
          <div className="today-plan__empty">
            <p>今天还没有安排。</p>
            <span>添加一项行动，让今天开始流动。</span>
          </div>
        ) : (
          <ul className="today-plan__list today-plan__list--primary">
            {visiblePlan.map((entry) => {
              const task = entry.task;
              return (
                <PlanRow
                  entry={entry}
                  key={entry.item.id}
                  onSelect={() => {
                    onSelectBlock(entry.item.id);
                  }}
                  onComplete={
                    task === undefined
                      ? undefined
                      : () => {
                          onCompleteTask(task.id, task.version);
                        }
                  }
                  completing={task?.id === completingTaskId}
                />
              );
            })}
          </ul>
        )}
      </section>

      <section className="today-plan__section today-plan__section--upcoming">
        <div className="today-plan__heading today-plan__heading--compact">
          <h2>即将开始</h2>
          <span className="today-plan__window">
            <Clock3 aria-hidden="true" size={12} />
            未来 4 小时
          </span>
        </div>
        {model.upcoming.length === 0 ? (
          <p className="today-plan__empty today-plan__empty--compact">接下来四小时没有安排。</p>
        ) : (
          <ul className="today-plan__list today-plan__list--upcoming">
            {model.upcoming.map((entry) => (
              <PlanRow
                compact
                entry={entry}
                key={entry.item.id}
                onSelect={() => {
                  onSelectBlock(entry.item.id);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="today-plan__section today-plan__section--flexible">
        <button
          type="button"
          className="today-plan__disclosure"
          aria-expanded={flexibleOpen}
          onClick={() => {
            setFlexibleOpen((value) => !value);
          }}
        >
          <span>
            弹性任务 <small>{String(model.flexible.length)}</small>
          </span>
          {flexibleOpen ? (
            <ChevronUp aria-hidden="true" size={15} />
          ) : (
            <ChevronDown aria-hidden="true" size={15} />
          )}
        </button>
        {flexibleOpen ? (
          model.flexible.length > 0 ? (
            <ul className="today-plan__list today-plan__list--flexible">
              {model.flexible.map((entry) => (
                <FlexibleRow
                  entry={entry}
                  key={entry.task.id}
                  onSelect={() => {
                    onSelectTask(entry.task.id);
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="today-plan__empty today-plan__empty--compact">暂无可灵活安排的任务。</p>
          )
        ) : null}
      </section>

      <RailWarnings warnings={model.unassignedWarnings} />
    </aside>
  );
};
