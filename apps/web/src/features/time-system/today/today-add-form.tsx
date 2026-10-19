import { Plus, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';

import { useFormDraft } from '../../../shared/form-draft.js';
import { formatDateTime } from '../../../shared/format.js';

export interface TodayCategoryLike {
  readonly id: string;
  readonly name: string;
  readonly parentArea: 'WORK' | 'LIFE';
}

interface CreateTaskInput {
  categoryId: string;
  title: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt: string;
  estimatedMinutes: number;
  isFlexible: boolean;
  isSplittable: boolean;
  preferredArea: 'WORK' | 'LIFE';
}

interface CreateEventInput {
  categoryId: string;
  title: string;
  startAt: string;
  endAt: string;
  eventType: 'GENERAL' | 'MEETING' | 'MEDICAL' | 'TRAVEL' | 'REST';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isImmovable: boolean;
}

export interface TodayCreateTaskApi {
  mutate: (input: CreateTaskInput, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
  error?: Error | null;
}

export interface TodayCreateEventApi {
  mutate: (input: CreateEventInput, options?: { onSuccess?: () => void }) => void;
  isPending: boolean;
  error?: Error | null;
}

const toLocalInput = (timestamp: number): string => {
  const gridMs = 15 * 60_000;
  const roundedTimestamp = Math.ceil(timestamp / gridMs) * gridMs;
  const shifted = new Date(roundedTimestamp + 8 * 3_600_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}T${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
};

const localInputToIso = (value: string): string => new Date(`${value}:00+08:00`).toISOString();

interface TaskDraft {
  title: string;
  area: 'WORK' | 'LIFE';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  estimatedMinutes: number;
  dueAt: string;
}

interface EventDraft {
  title: string;
  area: 'WORK' | 'LIFE';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  eventStart: string;
  eventEnd: string;
}

const isArea = (value: unknown): value is TaskDraft['area'] => value === 'WORK' || value === 'LIFE';
const isPriority = (value: unknown): value is TaskDraft['priority'] =>
  value === 'LOW' || value === 'NORMAL' || value === 'HIGH' || value === 'URGENT';
const parseTaskDraft = (value: unknown): TaskDraft | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    !isArea(draft.area) ||
    !isPriority(draft.priority) ||
    typeof draft.estimatedMinutes !== 'number' ||
    typeof draft.dueAt !== 'string'
  )
    return undefined;
  return {
    title: draft.title,
    area: draft.area,
    priority: draft.priority,
    estimatedMinutes: draft.estimatedMinutes,
    dueAt: draft.dueAt,
  };
};
const parseEventDraft = (value: unknown): EventDraft | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.title !== 'string' ||
    !isArea(draft.area) ||
    !isPriority(draft.priority) ||
    typeof draft.eventStart !== 'string' ||
    typeof draft.eventEnd !== 'string'
  )
    return undefined;
  return {
    title: draft.title,
    area: draft.area,
    priority: draft.priority,
    eventStart: draft.eventStart,
    eventEnd: draft.eventEnd,
  };
};

export const TodayAddForm = ({
  categories,
  createTask,
  createEvent,
}: {
  categories: readonly TodayCategoryLike[];
  createTask: TodayCreateTaskApi;
  createEvent: TodayCreateEventApi;
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'TASK' | 'EVENT'>('TASK');
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<'WORK' | 'LIFE'>('WORK');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [dueAt, setDueAt] = useState(() => toLocalInput(Date.now() + 4 * 3_600_000));
  const [eventStart, setEventStart] = useState(() => toLocalInput(Date.now() + 3_600_000));
  const [eventEnd, setEventEnd] = useState(() => toLocalInput(Date.now() + 2 * 3_600_000));
  const [taskDirty, setTaskDirty] = useState(false);
  const [eventDirty, setEventDirty] = useState(false);
  const [taskRestoredAt, setTaskRestoredAt] = useState<string>();
  const [eventRestoredAt, setEventRestoredAt] = useState<string>();
  const [validationError, setValidationError] = useState<string>();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pending = createTask.isPending || createEvent.isPending;
  const taskDraftValue = useMemo(
    () => ({ title, area, priority, estimatedMinutes, dueAt }),
    [area, dueAt, estimatedMinutes, priority, title],
  );
  const eventDraftValue = useMemo(
    () => ({ title, area, priority, eventStart, eventEnd }),
    [area, eventEnd, eventStart, priority, title],
  );
  const restoreTaskDraft = useCallback((draft: TaskDraft, updatedAt: string) => {
    setTitle(draft.title);
    setArea(draft.area);
    setPriority(draft.priority);
    setEstimatedMinutes(draft.estimatedMinutes);
    setDueAt(draft.dueAt);
    setTaskDirty(true);
    setTaskRestoredAt(updatedAt);
  }, []);
  const restoreEventDraft = useCallback((draft: EventDraft, updatedAt: string) => {
    setTitle(draft.title);
    setArea(draft.area);
    setPriority(draft.priority);
    setEventStart(draft.eventStart);
    setEventEnd(draft.eventEnd);
    setEventDirty(true);
    setEventRestoredAt(updatedAt);
  }, []);
  const taskDraft = useFormDraft({
    formType: 'TASK',
    mode: 'create',
    enabled: open && mode === 'TASK',
    dirty: taskDirty,
    value: taskDraftValue,
    parse: parseTaskDraft,
    onRestore: restoreTaskDraft,
  });
  const eventDraft = useFormDraft({
    formType: 'EVENT',
    mode: 'create',
    enabled: open && mode === 'EVENT',
    dirty: eventDirty,
    value: eventDraftValue,
    parse: parseEventDraft,
    onRestore: restoreEventDraft,
  });

  const close = useCallback(
    (preserveDraft = true): void => {
      if (preserveDraft) {
        if (mode === 'TASK') taskDraft.saveNow();
        else eventDraft.saveNow();
      }
      setOpen(false);
      setValidationError(undefined);
      queueMicrotask(() => {
        triggerRef.current?.focus();
      });
    },
    [eventDraft, mode, taskDraft],
  );

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !pending) close();
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (dialog === null) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open, pending]);

  const areaCategories = categories.filter((category) => category.parentArea === area);
  const selectedCategory = areaCategories.at(0);

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (selectedCategory === undefined || title.trim() === '') return;
    if (
      mode === 'EVENT' &&
      Date.parse(localInputToIso(eventEnd)) <= Date.parse(localInputToIso(eventStart))
    ) {
      setValidationError('结束时间必须晚于开始时间。');
      return;
    }
    if (mode === 'TASK') {
      createTask.mutate(
        {
          categoryId: selectedCategory.id,
          title: title.trim(),
          priority,
          dueAt: localInputToIso(dueAt),
          estimatedMinutes,
          isFlexible: true,
          isSplittable: estimatedMinutes >= 120,
          preferredArea: area,
        },
        {
          onSuccess: () => {
            taskDraft.clear();
            setTaskDirty(false);
            setTaskRestoredAt(undefined);
            setTitle('');
            close(false);
          },
        },
      );
    } else {
      createEvent.mutate(
        {
          categoryId: selectedCategory.id,
          title: title.trim(),
          startAt: localInputToIso(eventStart),
          endAt: localInputToIso(eventEnd),
          eventType: 'GENERAL',
          priority,
          isImmovable: true,
        },
        {
          onSuccess: () => {
            eventDraft.clear();
            setEventDirty(false);
            setEventRestoredAt(undefined);
            setTitle('');
            close(false);
          },
        },
      );
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        className="today-add__trigger"
        type="button"
        aria-label="添加事项"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus aria-hidden="true" size={14} />
        <span>添加</span>
      </button>
      {open ? (
        <div className="today-add" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            className="today-add__backdrop"
            aria-hidden="true"
            tabIndex={-1}
            disabled={pending}
            onClick={() => {
              close();
            }}
          />
          <div ref={dialogRef} className="today-add__panel">
            <div className="today-add__header">
              <div>
                <h2 id={titleId}>添加事项</h2>
                <p>加入今天的行动流</p>
              </div>
              <button
                className="today-add__close"
                type="button"
                aria-label="关闭添加事项"
                disabled={pending}
                onClick={() => {
                  close();
                }}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            <div className="today-add__tabs" role="tablist" aria-label="事项类型">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'TASK'}
                data-selected={mode === 'TASK'}
                onClick={() => {
                  if (mode === 'TASK') return;
                  eventDraft.saveNow();
                  setMode('TASK');
                  setTitle('');
                  setValidationError(undefined);
                }}
              >
                弹性任务
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'EVENT'}
                data-selected={mode === 'EVENT'}
                onClick={() => {
                  if (mode === 'EVENT') return;
                  taskDraft.saveNow();
                  setMode('EVENT');
                  setTitle('');
                  setValidationError(undefined);
                }}
              >
                固定日程
              </button>
            </div>
            <form className="today-add__form" onSubmit={submit}>
              {(mode === 'TASK' ? taskRestoredAt : eventRestoredAt) === undefined ? null : (
                <p className="draft-restored">
                  已恢复{' '}
                  {formatDateTime((mode === 'TASK' ? taskRestoredAt : eventRestoredAt) ?? '')}{' '}
                  的未保存草稿
                </p>
              )}
              <input
                ref={titleRef}
                className="today-add__title"
                aria-label="事项标题"
                placeholder={mode === 'TASK' ? '要完成什么？' : '固定安排是什么？'}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (mode === 'TASK') setTaskDirty(true);
                  else setEventDirty(true);
                }}
                required
              />
              <div className="today-add__inline-fields">
                <label className="today-add__field">
                  领域
                  <select
                    value={area}
                    aria-label="所属区域"
                    onChange={(event) => {
                      setArea(event.target.value as 'WORK' | 'LIFE');
                      if (mode === 'TASK') setTaskDirty(true);
                      else setEventDirty(true);
                    }}
                  >
                    <option value="WORK">工作</option>
                    <option value="LIFE">生活</option>
                  </select>
                </label>
                <label className="today-add__field">
                  优先级
                  <select
                    value={priority}
                    aria-label="优先级"
                    onChange={(event) => {
                      setPriority(event.target.value as typeof priority);
                      if (mode === 'TASK') setTaskDirty(true);
                      else setEventDirty(true);
                    }}
                  >
                    <option value="LOW">低</option>
                    <option value="NORMAL">普通</option>
                    <option value="HIGH">高</option>
                    <option value="URGENT">紧急</option>
                  </select>
                </label>
              </div>
              {mode === 'TASK' ? (
                <div className="today-add__inline-fields">
                  <label className="today-add__field">
                    截止
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(event) => {
                        setDueAt(event.target.value);
                        setTaskDirty(true);
                      }}
                    />
                  </label>
                  <label className="today-add__field">
                    时长
                    <select
                      value={estimatedMinutes}
                      onChange={(event) => {
                        setEstimatedMinutes(Number(event.target.value));
                        setTaskDirty(true);
                      }}
                    >
                      <option value="30">30 分钟</option>
                      <option value="60">1 小时</option>
                      <option value="90">1.5 小时</option>
                      <option value="120">2 小时</option>
                      <option value="180">3 小时</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div className="today-add__inline-fields">
                  <label className="today-add__field">
                    开始
                    <input
                      type="datetime-local"
                      value={eventStart}
                      onChange={(event) => {
                        setEventStart(event.target.value);
                        setEventDirty(true);
                      }}
                    />
                  </label>
                  <label className="today-add__field">
                    结束
                    <input
                      type="datetime-local"
                      value={eventEnd}
                      onChange={(event) => {
                        setEventEnd(event.target.value);
                        setEventDirty(true);
                      }}
                    />
                  </label>
                </div>
              )}
              <button
                className="button button--primary today-add__submit"
                type="submit"
                disabled={selectedCategory === undefined || pending}
              >
                {pending ? '正在添加…' : '添加并自动安排'}
              </button>
              {(
                mode === 'TASK'
                  ? taskDirty || taskDraft.hasDraft
                  : eventDirty || eventDraft.hasDraft
              ) ? (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    if (mode === 'TASK') {
                      taskDraft.clear();
                      setTaskDirty(false);
                      setTaskRestoredAt(undefined);
                    } else {
                      eventDraft.clear();
                      setEventDirty(false);
                      setEventRestoredAt(undefined);
                    }
                    setTitle('');
                    close(false);
                  }}
                >
                  丢弃草稿
                </button>
              ) : null}
            </form>
            {validationError || createTask.error || createEvent.error ? (
              <p className="form-error" role="alert">
                {validationError ?? (createTask.error ?? createEvent.error)?.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
