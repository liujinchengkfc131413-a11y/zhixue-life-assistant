import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCreateReminder, useRemoveReminder, useReminders } from '../reminders/reminder-api.js';
import { formatDateTime, formatLongDate } from '../../shared/format.js';
import { useFormDraft } from '../../shared/form-draft.js';
import { readEntityDetailTarget } from '../../shared/entity-detail-target.js';
import { useDialogA11y } from '../../shared/use-dialog-a11y.js';

import { useCategories, useSetupStatus } from '../settings/api.js';
import { SetupPage } from '../settings/setup-page.js';
import {
  shanghaiDayRange,
  useAddTaskDependency,
  useCompleteTask,
  useCreateEvent,
  useCreateSubtask,
  useCreateTask,
  useDeleteEvent,
  useDeleteTask,
  useEvents,
  useEvent,
  useGoals,
  usePlans,
  useReschedule,
  useRemoveTaskDependency,
  useScheduleWarnings,
  useTasks,
  useTaskDependencies,
  useToday,
  useUpdateEvent,
  useUpdateTask,
  type EventItem,
  type TodayBlock,
} from './api.js';
import { toPressureVisualState } from './pressure-visual-state.js';
import { TodayImmersiveLayout, type TodayCategoryLike } from './today/index.js';
import { ScheduleHistoryDrawer } from './today/schedule-history-drawer.js';
import { EntityTagsEditor } from './entity-tags-editor.js';
import { RecurrenceModifySelector } from './recurrence-modify-selector.js';
import '../../styles/today-immersive.css';

const toLocalInput = (timestamp: number): string => {
  const gridMs = 15 * 60_000;
  const roundedTimestamp = Math.ceil(timestamp / gridMs) * gridMs;
  const shifted = new Date(roundedTimestamp + 8 * 3_600_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}T${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
};

const localInputToIso = (value: string): string => new Date(`${value}:00+08:00`).toISOString();

const toExactLocalInput = (timestamp: number): string => {
  const shifted = new Date(timestamp + 8 * 3_600_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}T${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
};

interface EditableTask {
  id: string;
  version: number;
  title: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt: string;
  estimatedMinutes: number;
  status: string;
  goalId?: string | null;
  planId?: string | null;
  parentTaskId?: string | null;
  categoryId?: string;
  preferredArea?: 'WORK' | 'LIFE';
  isFlexible?: boolean;
  isSplittable?: boolean;
}

interface TaskRelationSummary {
  readonly goalTitle?: string | undefined;
  readonly planTitle?: string | undefined;
  readonly parentTaskTitle?: string | undefined;
  readonly subtasks?: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }[];
  readonly dependencyCandidates?: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  }[];
}

interface TodayOperationFeedback {
  readonly tone: 'progress' | 'success' | 'error';
  readonly message: string;
}

interface TaskEditDraft {
  title: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt: string;
  estimatedMinutes: number;
}

const isPriorityValue = (value: unknown): value is TaskEditDraft['priority'] =>
  value === 'LOW' || value === 'NORMAL' || value === 'HIGH' || value === 'URGENT';

const parseTaskEditDraft = (value: unknown): TaskEditDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    !isPriorityValue(draft.priority) ||
    typeof draft.dueAt !== 'string' ||
    typeof draft.estimatedMinutes !== 'number'
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    priority: draft.priority,
    dueAt: draft.dueAt,
    estimatedMinutes: draft.estimatedMinutes,
  };
};

interface EventEditDraft {
  readonly title: string;
  readonly description: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly eventType: EventItem['eventType'];
  readonly priority: EventItem['priority'];
  readonly isImmovable: boolean;
  readonly allowOverlap: boolean;
  readonly status: EventItem['status'];
}

const eventTypes: readonly EventItem['eventType'][] = [
  'GENERAL',
  'MEETING',
  'MEDICAL',
  'TRAVEL',
  'REST',
];
const eventPriorities: readonly EventItem['priority'][] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const eventStatuses: readonly EventItem['status'][] = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

const parseEventEditDraft = (value: unknown): EventEditDraft | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    typeof draft.description !== 'string' ||
    typeof draft.startAt !== 'string' ||
    typeof draft.endAt !== 'string' ||
    !eventTypes.includes(draft.eventType as EventItem['eventType']) ||
    !eventPriorities.includes(draft.priority as EventItem['priority']) ||
    typeof draft.isImmovable !== 'boolean' ||
    typeof draft.allowOverlap !== 'boolean' ||
    !eventStatuses.includes(draft.status as EventItem['status'])
  ) {
    return undefined;
  }
  return {
    title: draft.title,
    description: draft.description,
    startAt: draft.startAt,
    endAt: draft.endAt,
    eventType: draft.eventType as EventItem['eventType'],
    priority: draft.priority as EventItem['priority'],
    isImmovable: draft.isImmovable,
    allowOverlap: draft.allowOverlap,
    status: draft.status as EventItem['status'],
  };
};

export const TaskDetail = ({
  task,
  relations,
  onClose,
  onOpenHistory,
  onOpenTask,
  tagEditor,
  renderRecurrenceEditor,
}: {
  task: EditableTask;
  relations?: TaskRelationSummary;
  onClose: () => void;
  onOpenHistory: () => void;
  onOpenTask?: (taskId: string) => void;
  tagEditor?: ReactNode;
  renderRecurrenceEditor?: (override: Record<string, unknown>, onApplied: () => void) => ReactNode;
}) => {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const dependencies = useTaskDependencies(task.id);
  const addDependency = useAddTaskDependency();
  const removeDependency = useRemoveTaskDependency();
  const createSubtask = useCreateSubtask(task.id);
  const completeTask = useCompleteTask();
  const reminders = useReminders(task.id);
  const createReminder = useCreateReminder(task.id);
  const removeReminder = useRemoveReminder(task.id);
  const [reminderMinutes, setReminderMinutes] = useState(10);
  const [predecessorTaskId, setPredecessorTaskId] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [reminderMode, setReminderMode] = useState<'OFFSET' | 'ABSOLUTE'>('OFFSET');
  const [reminderAt, setReminderAt] = useState(() => toLocalInput(Date.now() - 3_600_000));
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [dueAt, setDueAt] = useState(() => toLocalInput(Date.parse(task.dueAt)));
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimatedMinutes);
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const draftValue = useMemo(
    () => ({ title, priority, dueAt, estimatedMinutes }),
    [dueAt, estimatedMinutes, priority, title],
  );
  const restoreDraft = useCallback((draft: TaskEditDraft, updatedAt: string) => {
    setTitle(draft.title);
    setPriority(draft.priority);
    setDueAt(draft.dueAt);
    setEstimatedMinutes(draft.estimatedMinutes);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'TASK',
    mode: 'edit',
    entityId: task.id,
    enabled: true,
    dirty,
    value: draftValue,
    parse: parseTaskEditDraft,
    onRestore: restoreDraft,
  });
  const saveDraftRef = useRef(formDraft.saveNow);
  useEffect(() => {
    saveDraftRef.current = formDraft.saveNow;
  }, [formDraft.saveNow]);
  const close = useCallback(() => {
    saveDraftRef.current();
    onClose();
  }, [onClose]);
  const panelRef = useDialogA11y<HTMLDivElement>(true, close);

  return (
    <div className="detail-panel" role="dialog" aria-label="任务详情" ref={panelRef} tabIndex={-1}>
      <button className="detail-panel__close" type="button" onClick={close}>
        关闭
      </button>
      <h2>编辑任务</h2>
      <button
        className="button button--secondary button--small"
        type="button"
        onClick={onOpenHistory}
      >
        调度历史
      </button>
      <div className="detail-form">
        {restoredAt === undefined ? null : (
          <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
        )}
        <label>
          标题
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          优先级
          <select
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value as typeof priority);
              setDirty(true);
            }}
          >
            <option value="LOW">低</option>
            <option value="NORMAL">普通</option>
            <option value="HIGH">高</option>
            <option value="URGENT">紧急</option>
          </select>
        </label>
        <label>
          截止时间
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => {
              setDueAt(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          预计时长
          <select
            value={estimatedMinutes}
            onChange={(event) => {
              setEstimatedMinutes(Number(event.target.value));
              setDirty(true);
            }}
          >
            <option value="30">30 分钟</option>
            <option value="60">1 小时</option>
            <option value="90">1.5 小时</option>
            <option value="120">2 小时</option>
            <option value="180">3 小时</option>
          </select>
        </label>
        <p className="field-hint">
          当前状态：
          {
            { TODO: '待办', IN_PROGRESS: '进行中', COMPLETED: '已完成', CANCELLED: '已取消' }[
              task.status
            ]
          }{' '}
          · 数据版本 {task.version}
        </p>
        <section aria-label="任务关联详情">
          <h3>关联详情</h3>
          <p className="field-hint">所属目标：{relations?.goalTitle ?? '无'}</p>
          <p className="field-hint">所属计划：{relations?.planTitle ?? '无'}</p>
          <p className="field-hint">父任务：{relations?.parentTaskTitle ?? '无'}</p>
          {(relations?.subtasks?.length ?? 0) === 0 ? (
            <p className="field-hint">暂无一层子任务。</p>
          ) : (
            <ul>
              {relations?.subtasks?.map((subtask) => (
                <li key={subtask.id}>
                  {subtask.title}
                  {onOpenTask === undefined ? null : (
                    <button
                      className="button button--small"
                      type="button"
                      onClick={() => {
                        onOpenTask(subtask.id);
                      }}
                    >
                      打开子任务
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="inline-create">
            <input
              aria-label="新建子任务"
              value={subtaskTitle}
              placeholder="子任务名称"
              onChange={(event) => {
                setSubtaskTitle(event.target.value);
              }}
            />
            <button
              className="button button--small"
              type="button"
              disabled={
                createSubtask.isPending ||
                subtaskTitle.trim() === '' ||
                task.categoryId === undefined ||
                task.preferredArea === undefined
              }
              onClick={() => {
                if (task.categoryId === undefined || task.preferredArea === undefined) return;
                createSubtask.mutate(
                  {
                    categoryId: task.categoryId,
                    goalId: task.goalId ?? null,
                    title: subtaskTitle.trim(),
                    priority: task.priority,
                    dueAt: task.dueAt,
                    estimatedMinutes: Math.min(task.estimatedMinutes, 60),
                    isFlexible: task.isFlexible ?? true,
                    isSplittable: task.isSplittable ?? false,
                    preferredArea: task.preferredArea,
                  },
                  {
                    onSuccess: () => {
                      setSubtaskTitle('');
                    },
                  },
                );
              }}
            >
              新增子任务
            </button>
          </div>
        </section>
        {tagEditor}
        {renderRecurrenceEditor?.({ title, dueAt: localInputToIso(dueAt) }, () => {
          formDraft.clear();
          onClose();
        })}
        <section aria-label="任务依赖">
          <h3>任务依赖</h3>
          <p className="field-hint">前置任务必须完成后，本任务才会进入自动排程。</p>
          {(dependencies.data?.predecessorTaskIds.length ?? 0) === 0 ? (
            <p className="field-hint">暂无前置任务。</p>
          ) : (
            <ul>
              {dependencies.data?.predecessorTaskIds.map((id) => (
                <li key={id}>
                  {relations?.dependencyCandidates?.find((candidate) => candidate.id === id)
                    ?.title ?? id}
                  <button
                    className="button button--small button--danger"
                    type="button"
                    disabled={removeDependency.isPending}
                    onClick={() => {
                      removeDependency.mutate({
                        id: task.id,
                        version: task.version,
                        predecessorTaskId: id,
                      });
                    }}
                  >
                    解除依赖
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(dependencies.data?.successorTaskIds.length ?? 0) > 0 ? (
            <p className="field-hint">
              后继任务：
              {dependencies.data?.successorTaskIds
                .map(
                  (id) =>
                    relations?.dependencyCandidates?.find((candidate) => candidate.id === id)
                      ?.title ?? id,
                )
                .join('、')}
            </p>
          ) : null}
          <div className="inline-create">
            <select
              aria-label="选择前置任务"
              value={predecessorTaskId}
              onChange={(event) => {
                setPredecessorTaskId(event.target.value);
              }}
            >
              <option value="">选择前置任务</option>
              {(relations?.dependencyCandidates ?? [])
                .filter(
                  (candidate) =>
                    candidate.id !== task.id &&
                    !dependencies.data?.predecessorTaskIds.includes(candidate.id),
                )
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
            </select>
            <button
              className="button button--small"
              type="button"
              disabled={addDependency.isPending || predecessorTaskId === ''}
              onClick={() => {
                if (predecessorTaskId === '') return;
                addDependency.mutate(
                  { id: task.id, version: task.version, predecessorTaskId },
                  {
                    onSuccess: () => {
                      setPredecessorTaskId('');
                    },
                  },
                );
              }}
            >
              添加依赖
            </button>
          </div>
          {addDependency.isError || removeDependency.isError ? (
            <p className="form-error">依赖更新失败。请检查是否形成循环，或重新打开详情后再试。</p>
          ) : null}
        </section>
        <div className="reminder-editor">
          <h3>提醒</h3>
          {reminders.data?.length ? (
            <ul className="reminder-editor__list">
              {reminders.data.map((reminder) => (
                <li key={reminder.id}>
                  <span>
                    {reminder.triggerMode === 'ABSOLUTE'
                      ? `固定时间 ${reminder.triggerAt !== null ? formatDateTime(reminder.triggerAt) : ''}`
                      : `提前 ${String(reminder.offsetMinutes ?? 0)} 分钟`}
                    {reminder.isEnabled ? '' : '（已停用）'}
                  </span>
                  <button
                    className="button button--small button--danger"
                    type="button"
                    disabled={removeReminder.isPending}
                    onClick={() => {
                      removeReminder.mutate({
                        id: reminder.id,
                        expectedVersion: reminder.version,
                      });
                    }}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">尚未设置提醒。</p>
          )}
          <div className="inline-create">
            <select
              aria-label="提醒模式"
              value={reminderMode}
              onChange={(event) => {
                setReminderMode(event.target.value as 'OFFSET' | 'ABSOLUTE');
              }}
            >
              <option value="OFFSET">提前提醒</option>
              <option value="ABSOLUTE">固定时间</option>
            </select>
            {reminderMode === 'OFFSET' ? (
              <select
                aria-label="提醒提前时间"
                value={reminderMinutes}
                onChange={(event) => {
                  setReminderMinutes(Number(event.target.value));
                }}
              >
                <option value="10">10 分钟</option>
                <option value="60">1 小时</option>
                <option value="1440">1 天</option>
              </select>
            ) : (
              <input
                aria-label="提醒绝对时间"
                type="datetime-local"
                value={reminderAt}
                onChange={(event) => {
                  setReminderAt(event.target.value);
                }}
              />
            )}
            <button
              className="button button--small"
              type="button"
              disabled={createReminder.isPending}
              onClick={() => {
                if (reminderMode === 'OFFSET') {
                  createReminder.mutate({
                    targetEntityId: task.id,
                    triggerMode: 'OFFSET_BEFORE_DUE',
                    offsetMinutes: reminderMinutes,
                  });
                } else {
                  createReminder.mutate({
                    targetEntityId: task.id,
                    triggerMode: 'ABSOLUTE',
                    triggerAt: localInputToIso(reminderAt),
                  });
                }
              }}
            >
              添加提醒
            </button>
          </div>
        </div>
        <button
          className="button button--primary"
          type="button"
          disabled={updateTask.isPending || title.trim() === ''}
          onClick={() => {
            updateTask.mutate(
              {
                id: task.id,
                version: task.version,
                title,
                priority,
                dueAt: localInputToIso(dueAt),
                estimatedMinutes,
              },
              {
                onSuccess: () => {
                  formDraft.clear();
                  setDirty(false);
                  setRestoredAt(undefined);
                  onClose();
                },
              },
            );
          }}
        >
          {updateTask.isPending ? '保存并重排中…' : '保存并重新安排'}
        </button>
        {task.status === 'COMPLETED' || task.status === 'CANCELLED' ? null : (
          <button
            className="button button--secondary"
            type="button"
            disabled={completeTask.isPending}
            onClick={() => {
              completeTask.mutate(
                { id: task.id, version: task.version },
                {
                  onSuccess: () => {
                    formDraft.clear();
                    onClose();
                  },
                },
              );
            }}
          >
            {completeTask.isPending ? '正在完成…' : '完成任务'}
          </button>
        )}
        <button
          className="button button--danger"
          type="button"
          disabled={deleteTask.isPending}
          onClick={() => {
            if (window.confirm('确定将这个任务移入回收站？')) {
              deleteTask.mutate(
                { id: task.id, version: task.version },
                {
                  onSuccess: () => {
                    formDraft.clear();
                    onClose();
                  },
                },
              );
            }
          }}
        >
          {deleteTask.isPending ? '正在移入回收站…' : '移入回收站'}
        </button>
        {dirty || formDraft.hasDraft ? (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              formDraft.clear();
              setTitle(task.title);
              setPriority(task.priority);
              setDueAt(toLocalInput(Date.parse(task.dueAt)));
              setEstimatedMinutes(task.estimatedMinutes);
              setDirty(false);
              setRestoredAt(undefined);
            }}
          >
            丢弃草稿
          </button>
        ) : null}
        {updateTask.isError ? (
          <p className="form-error">保存失败。数据可能已被其他页面更新，请关闭后重新打开再试。</p>
        ) : null}
        {deleteTask.isError ? (
          <p className="form-error">删除失败。数据版本可能已变化，请关闭后重新打开再试。</p>
        ) : null}
      </div>
    </div>
  );
};

export const EventDetail = ({
  event,
  onClose,
  tagEditor,
  renderRecurrenceEditor,
}: {
  event: EventItem;
  onClose: () => void;
  tagEditor?: ReactNode;
  renderRecurrenceEditor?: (override: Record<string, unknown>, onApplied: () => void) => ReactNode;
}) => {
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const reminders = useReminders(event.id);
  const createReminder = useCreateReminder(event.id);
  const removeReminder = useRemoveReminder(event.id);
  const [reminderMinutes, setReminderMinutes] = useState(10);
  const [reminderMode, setReminderMode] = useState<'OFFSET' | 'ABSOLUTE'>('OFFSET');
  const [reminderAt, setReminderAt] = useState(() => toLocalInput(Date.now() - 3_600_000));
  const [value, setValue] = useState<EventEditDraft>(() => ({
    title: event.title,
    description: event.description ?? '',
    startAt: toExactLocalInput(Date.parse(event.startAt)),
    endAt: toExactLocalInput(Date.parse(event.endAt)),
    eventType: event.eventType,
    priority: event.priority,
    isImmovable: event.isImmovable,
    allowOverlap: event.allowOverlap,
    status: event.status,
  }));
  const [dirty, setDirty] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string>();
  const restoreDraft = useCallback((draft: EventEditDraft, updatedAt: string) => {
    setValue(draft);
    setDirty(true);
    setRestoredAt(updatedAt);
  }, []);
  const formDraft = useFormDraft({
    formType: 'EVENT',
    mode: 'edit',
    entityId: event.id,
    enabled: true,
    dirty,
    value,
    parse: parseEventEditDraft,
    onRestore: restoreDraft,
  });
  const saveDraftRef = useRef(formDraft.saveNow);
  useEffect(() => {
    saveDraftRef.current = formDraft.saveNow;
  }, [formDraft.saveNow]);
  const close = useCallback(() => {
    saveDraftRef.current();
    onClose();
  }, [onClose]);
  const panelRef = useDialogA11y<HTMLDivElement>(true, close);
  const change = <K extends keyof EventEditDraft>(key: K, next: EventEditDraft[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
    setDirty(true);
  };

  return (
    <div className="detail-panel" role="dialog" aria-label="日程详情" ref={panelRef} tabIndex={-1}>
      <button className="detail-panel__close" type="button" onClick={close}>
        关闭
      </button>
      <h2>编辑日程</h2>
      <form
        className="detail-form"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          updateEvent.mutate(
            {
              id: event.id,
              version: event.version,
              title: value.title,
              description: value.description,
              startAt: localInputToIso(value.startAt),
              endAt: localInputToIso(value.endAt),
              eventType: value.eventType,
              priority: value.priority,
              isImmovable: value.isImmovable,
              allowOverlap: value.allowOverlap,
              status: value.status,
            },
            {
              onSuccess: () => {
                formDraft.clear();
                setDirty(false);
                setRestoredAt(undefined);
                onClose();
              },
            },
          );
        }}
      >
        {restoredAt === undefined ? null : (
          <p className="draft-restored">已恢复 {formatDateTime(restoredAt)} 的未保存草稿</p>
        )}
        <label>
          日程标题
          <input
            value={value.title}
            required
            onChange={(changeEvent) => {
              change('title', changeEvent.target.value);
            }}
          />
        </label>
        <label>
          日程说明
          <textarea
            value={value.description}
            onChange={(changeEvent) => {
              change('description', changeEvent.target.value);
            }}
          />
        </label>
        <label>
          开始时间
          <input
            type="datetime-local"
            value={value.startAt}
            required
            onChange={(changeEvent) => {
              change('startAt', changeEvent.target.value);
            }}
          />
        </label>
        <label>
          结束时间
          <input
            type="datetime-local"
            value={value.endAt}
            required
            onChange={(changeEvent) => {
              change('endAt', changeEvent.target.value);
            }}
          />
        </label>
        <div className="form-grid">
          <label>
            日程类型
            <select
              value={value.eventType}
              onChange={(changeEvent) => {
                change('eventType', changeEvent.target.value as EventItem['eventType']);
              }}
            >
              <option value="GENERAL">普通</option>
              <option value="MEETING">会议</option>
              <option value="MEDICAL">就医</option>
              <option value="TRAVEL">出行</option>
              <option value="REST">休息</option>
            </select>
          </label>
          <label>
            优先级
            <select
              value={value.priority}
              onChange={(changeEvent) => {
                change('priority', changeEvent.target.value as EventItem['priority']);
              }}
            >
              <option value="LOW">低</option>
              <option value="NORMAL">普通</option>
              <option value="HIGH">高</option>
              <option value="URGENT">紧急</option>
            </select>
          </label>
        </div>
        <label>
          日程状态
          <select
            value={value.status}
            onChange={(changeEvent) => {
              change('status', changeEvent.target.value as EventItem['status']);
            }}
          >
            <option value="SCHEDULED">已安排</option>
            <option value="COMPLETED">已完成</option>
            <option value="CANCELLED">已取消</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value.isImmovable}
            onChange={(changeEvent) => {
              change('isImmovable', changeEvent.target.checked);
            }}
          />
          不可移动
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value.allowOverlap}
            onChange={(changeEvent) => {
              change('allowOverlap', changeEvent.target.checked);
            }}
          />
          明确允许与其他日程重叠
        </label>
        {tagEditor}
        <div className="reminder-editor">
          <h3>提醒</h3>
          {reminders.data?.length ? (
            <ul className="reminder-editor__list">
              {reminders.data.map((reminder) => (
                <li key={reminder.id}>
                  <span>
                    {reminder.triggerMode === 'ABSOLUTE'
                      ? `固定时间 ${reminder.triggerAt !== null ? formatDateTime(reminder.triggerAt) : ''}`
                      : `提前 ${String(reminder.offsetMinutes ?? 0)} 分钟`}
                    {reminder.isEnabled ? '' : '（已停用）'}
                  </span>
                  <button
                    className="button button--small button--danger"
                    type="button"
                    disabled={removeReminder.isPending}
                    onClick={() => {
                      removeReminder.mutate({
                        id: reminder.id,
                        expectedVersion: reminder.version,
                      });
                    }}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-hint">尚未设置提醒。</p>
          )}
          <div className="inline-create">
            <select
              aria-label="日程提醒模式"
              value={reminderMode}
              onChange={(changeEvent) => {
                setReminderMode(changeEvent.target.value as 'OFFSET' | 'ABSOLUTE');
              }}
            >
              <option value="OFFSET">提前提醒</option>
              <option value="ABSOLUTE">固定时间</option>
            </select>
            {reminderMode === 'OFFSET' ? (
              <select
                aria-label="日程提醒提前时间"
                value={reminderMinutes}
                onChange={(changeEvent) => {
                  setReminderMinutes(Number(changeEvent.target.value));
                }}
              >
                <option value="10">10 分钟</option>
                <option value="60">1 小时</option>
                <option value="1440">1 天</option>
              </select>
            ) : (
              <input
                aria-label="日程提醒绝对时间"
                type="datetime-local"
                value={reminderAt}
                onChange={(changeEvent) => {
                  setReminderAt(changeEvent.target.value);
                }}
              />
            )}
            <button
              className="button button--small"
              type="button"
              disabled={createReminder.isPending}
              onClick={() => {
                if (reminderMode === 'OFFSET') {
                  createReminder.mutate({
                    targetEntityId: event.id,
                    triggerMode: 'OFFSET_BEFORE_START',
                    offsetMinutes: reminderMinutes,
                  });
                } else {
                  createReminder.mutate({
                    targetEntityId: event.id,
                    triggerMode: 'ABSOLUTE',
                    triggerAt: localInputToIso(reminderAt),
                  });
                }
              }}
            >
              添加提醒
            </button>
          </div>
          {reminders.isError || createReminder.isError || removeReminder.isError ? (
            <p className="form-error">提醒更新失败。请关闭日程详情后重新打开再试。</p>
          ) : null}
        </div>
        {renderRecurrenceEditor?.(
          {
            title: value.title,
            description: value.description,
            startAt: localInputToIso(value.startAt),
            endAt: localInputToIso(value.endAt),
          },
          () => {
            formDraft.clear();
            onClose();
          },
        )}
        <div className="form-actions">
          <button
            className="button button--primary"
            disabled={updateEvent.isPending || value.title.trim() === ''}
          >
            {updateEvent.isPending ? '保存并重排中…' : '保存日程'}
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
            disabled={deleteEvent.isPending}
            onClick={() => {
              if (window.confirm('确定将这个日程移入回收站？')) {
                deleteEvent.mutate(
                  { id: event.id, version: event.version },
                  {
                    onSuccess: () => {
                      formDraft.clear();
                      onClose();
                    },
                  },
                );
              }
            }}
          >
            {deleteEvent.isPending ? '正在移入回收站…' : '移入回收站'}
          </button>
        </div>
        {updateEvent.isError ? (
          <p className="form-error">
            保存失败。请检查时间范围、日程冲突或数据版本；需要重叠时请显式勾选允许重叠。
          </p>
        ) : null}
        {deleteEvent.isError ? (
          <p className="form-error">删除失败。数据版本可能已变化，请关闭后重新打开再试。</p>
        ) : null}
      </form>
    </div>
  );
};

const BlockDetail = ({ block, onClose }: { block: TodayBlock; onClose: () => void }) => {
  const panelRef = useDialogA11y<HTMLDivElement>(true, onClose);
  return (
    <div
      className="detail-panel"
      role="dialog"
      aria-modal="true"
      aria-label="时间块详情"
      ref={panelRef}
      tabIndex={-1}
    >
      <button className="detail-panel__close" type="button" onClick={onClose}>
        关闭
      </button>
      <p className="page__context">
        {block.blockType === 'EVENT' ? '固定日程' : block.blockType === 'SLEEP' ? '睡眠' : '休息'}
      </p>
      <h2>{block.title}</h2>
      <p>
        {formatTimeLabel(block.startAt)}–{formatTimeLabel(block.endAt)}
      </p>
      <p>{block.area === 'WORK' ? '工作安排' : block.area === 'LIFE' ? '生活安排' : '睡眠时段'}</p>
    </div>
  );
};

export const TodayPage = () => {
  const target = readEntityDetailTarget(window.location.search);
  const targetEventId = target?.entityType === 'EVENT' ? target.entityId : undefined;
  const setup = useSetupStatus();
  const categories = useCategories();
  const range = shanghaiDayRange();
  const today = useToday(range.localDate);
  const tasks = useTasks(false);
  const allTasks = useTasks(true);
  const events = useEvents(range.from, range.to);
  const targetEvent = useEvent(targetEventId);
  const goals = useGoals();
  const plans = usePlans();
  const warnings = useScheduleWarnings();
  const createTask = useCreateTask();
  const createEvent = useCreateEvent();
  const completeTask = useCompleteTask();
  const reschedule = useReschedule();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    target?.entityType === 'TASK' ? target.entityId : null,
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(targetEventId ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [historyTask, setHistoryTask] = useState<{ id: string; title: string } | null>(null);
  const [currentNow, setCurrentNow] = useState(0);
  const [operationFeedback, setOperationFeedback] = useState<TodayOperationFeedback | undefined>();

  useEffect(() => {
    const serverNow = today.data?.serverNow;
    if (serverNow === undefined) return;
    const offset = Date.parse(serverNow) - Date.now();
    const update = () => {
      setCurrentNow(Date.now() + offset);
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [today.data?.serverNow]);

  const selectTimelineBlock = useCallback(
    (id: string) => {
      const block = today.data?.blocks.find((item) => item.id === id);
      if (block?.blockType === 'TASK' && block.targetEntityId !== null) {
        setSelectedTaskId(block.targetEntityId);
        setSelectedEventId(null);
        setSelectedBlockId(null);
      } else if (block?.blockType === 'EVENT' && block.targetEntityId !== null) {
        setSelectedEventId(block.targetEntityId);
        setSelectedTaskId(null);
        setSelectedBlockId(id);
      } else {
        setSelectedBlockId(id);
        setSelectedTaskId(null);
        setSelectedEventId(null);
      }
    },
    [today.data?.blocks],
  );

  if (setup.isLoading) return <main className="page">正在连接本地数据服务…</main>;
  if (!setup.data?.initialized) return <SetupPage />;
  if (today.isError && today.data === undefined) {
    return (
      <main className="page page--error" role="alert">
        <h1>今日状态暂时无法读取</h1>
        <p>本地数据仍然安全，请检查服务后重试。</p>
        <button
          className="button button--primary"
          type="button"
          onClick={() => void today.refetch()}
        >
          重新读取
        </button>
      </main>
    );
  }

  const categoriesLike: readonly TodayCategoryLike[] = (categories.data?.data ?? [])
    .filter((category) => !category.isArchived)
    .map((category) => ({
      id: category.id,
      name: category.name,
      parentArea: category.parentArea,
    }));
  const selectedTask = allTasks.data?.find((task) => task.id === selectedTaskId);
  const selectedEvent =
    events.data?.find((event) => event.id === selectedEventId) ??
    (targetEvent.data?.id === selectedEventId ? targetEvent.data : undefined);
  const selectedBlock = today.data?.blocks.find((block) => block.id === selectedBlockId);
  const pressureVisual =
    today.data === undefined
      ? undefined
      : toPressureVisualState(today.data.pressure.score, today.data.pressure.level);
  const todayLabel = formatLongDate(new Date());

  return (
    <>
      <TodayImmersiveLayout
        today={today.data}
        todayLoading={today.isLoading}
        tasks={tasks.data}
        warnings={warnings.data}
        pressureVisual={pressureVisual}
        currentNow={currentNow}
        range={range}
        todayLabel={todayLabel}
        onSelectBlock={selectTimelineBlock}
        onSelectTask={(id) => {
          setSelectedTaskId(id);
          setSelectedEventId(null);
          setSelectedBlockId(null);
        }}
        onReschedule={() => {
          setOperationFeedback({ tone: 'progress', message: '正在重新安排今日计划…' });
          reschedule.mutate(
            { from: range.from, to: range.to },
            {
              onSuccess: () => {
                setOperationFeedback({ tone: 'success', message: '今日计划已重新安排。' });
              },
              onError: () => {
                setOperationFeedback({ tone: 'error', message: '重新安排失败，请稍后重试。' });
              },
            },
          );
        }}
        reschedulePending={reschedule.isPending}
        onCompleteTask={(id, version) => {
          setOperationFeedback({ tone: 'progress', message: '正在完成任务并释放时间…' });
          completeTask.mutate(
            { id, version },
            {
              onSuccess: () => {
                setSelectedTaskId(null);
                setOperationFeedback({ tone: 'success', message: '任务已完成，时间已释放。' });
              },
              onError: () => {
                setOperationFeedback({
                  tone: 'error',
                  message: '任务完成失败，请重新打开后再试。',
                });
              },
            },
          );
        }}
        completingTaskId={completeTask.isPending ? completeTask.variables.id : undefined}
        operationFeedback={operationFeedback}
        categories={categoriesLike}
        createTask={createTask}
        createEvent={createEvent}
      />
      {selectedTask ? (
        <TaskDetail
          key={`${selectedTask.id}:${String(selectedTask.version)}`}
          task={selectedTask}
          relations={{
            goalTitle: goals.data?.find((goal) => goal.id === selectedTask.goalId)?.title,
            planTitle: plans.data?.find((plan) => plan.id === selectedTask.planId)?.title,
            parentTaskTitle: allTasks.data?.find((task) => task.id === selectedTask.parentTaskId)
              ?.title,
            subtasks: allTasks.data?.filter((task) => task.parentTaskId === selectedTask.id) ?? [],
            dependencyCandidates: allTasks.data ?? [],
          }}
          onClose={() => {
            setSelectedTaskId(null);
          }}
          onOpenHistory={() => {
            setHistoryTask({ id: selectedTask.id, title: selectedTask.title });
          }}
          onOpenTask={(taskId) => {
            setSelectedTaskId(taskId);
          }}
          tagEditor={<EntityTagsEditor entityId={selectedTask.id} version={selectedTask.version} />}
          renderRecurrenceEditor={(override, onApplied) => (
            <RecurrenceModifySelector
              entityId={selectedTask.id}
              override={override}
              onApplied={onApplied}
            />
          )}
        />
      ) : null}
      {selectedEvent ? (
        <EventDetail
          key={`${selectedEvent.id}:${String(selectedEvent.version)}`}
          event={selectedEvent}
          tagEditor={
            <EntityTagsEditor entityId={selectedEvent.id} version={selectedEvent.version} />
          }
          renderRecurrenceEditor={(override, onApplied) => (
            <RecurrenceModifySelector
              entityId={selectedEvent.id}
              override={override}
              onApplied={onApplied}
            />
          )}
          onClose={() => {
            setSelectedEventId(null);
          }}
        />
      ) : null}
      {selectedBlock && selectedEvent === undefined ? (
        <BlockDetail
          block={selectedBlock}
          onClose={() => {
            setSelectedBlockId(null);
          }}
        />
      ) : null}
      {historyTask ? (
        <ScheduleHistoryDrawer
          taskId={historyTask.id}
          taskTitle={historyTask.title}
          onClose={() => {
            setHistoryTask(null);
          }}
        />
      ) : null}
    </>
  );
};

const formatTimeLabel = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
