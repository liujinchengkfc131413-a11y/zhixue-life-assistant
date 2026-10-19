import { useState } from 'react';

import {
  useCreatePlanMilestone,
  useDeletePlanMilestone,
  usePlanMilestones,
  useUpdatePlanMilestone,
  type PlanMilestoneItem,
  type TaskItem,
} from './api.js';

const statusLabels: Record<PlanMilestoneItem['status'], string> = {
  PENDING: '待完成',
  AT_RISK: '有风险',
  ACHIEVED: '已达成',
  MISSED: '已错过',
};

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
};

const initialDueAt = () => {
  const date = new Date(Date.now() + 7 * 86_400_000);
  date.setHours(18, 0, 0, 0);
  return toLocalInput(date.toISOString());
};

const TaskChoices = ({
  tasks,
  selected,
  onChange,
}: {
  readonly tasks: readonly TaskItem[];
  readonly selected: readonly string[];
  readonly onChange: (ids: string[]) => void;
}) => (
  <fieldset>
    <legend>关联任务</legend>
    {tasks.length === 0 ? <p className="field-hint">此计划尚无可关联任务。</p> : null}
    {tasks.map((task) => (
      <label key={task.id} className="checkbox-field">
        <input
          type="checkbox"
          checked={selected.includes(task.id)}
          onChange={(event) => {
            onChange(
              event.target.checked
                ? [...selected, task.id]
                : selected.filter((id) => id !== task.id),
            );
          }}
        />
        {task.title}
      </label>
    ))}
  </fieldset>
);

const MilestoneRow = ({
  milestone,
  tasks,
}: {
  milestone: PlanMilestoneItem;
  tasks: readonly TaskItem[];
}) => {
  const update = useUpdatePlanMilestone(milestone.planId);
  const remove = useDeletePlanMilestone(milestone.planId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? '');
  const [dueAt, setDueAt] = useState(() => toLocalInput(milestone.dueAt));
  const [status, setStatus] = useState(milestone.status);
  const [linkedEntityIds, setLinkedEntityIds] = useState<string[]>([...milestone.linkedEntityIds]);

  if (!editing)
    return (
      <li>
        <strong>{milestone.title}</strong>
        <p className="field-hint">
          {statusLabels[milestone.status]} · {new Date(milestone.dueAt).toLocaleString('zh-CN')} ·{' '}
          {milestone.linkedEntityIds.length} 项关联任务
        </p>
        {milestone.description === null ? null : <p>{milestone.description}</p>}
        <div className="form-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setEditing(true);
            }}
          >
            编辑
          </button>
          {milestone.status === 'ACHIEVED' ? null : (
            <button
              className="text-button"
              type="button"
              disabled={update.isPending}
              onClick={() => {
                update.mutate({
                  id: milestone.id,
                  version: milestone.version,
                  title: milestone.title,
                  description: milestone.description ?? '',
                  dueAt: milestone.dueAt,
                  status: 'ACHIEVED',
                  linkedEntityIds: [...milestone.linkedEntityIds],
                });
              }}
            >
              标记达成
            </button>
          )}
          <button
            className="text-button"
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm('确定将这个里程碑移入回收站？'))
                remove.mutate({ id: milestone.id, version: milestone.version });
            }}
          >
            删除
          </button>
        </div>
      </li>
    );

  return (
    <li>
      <label>
        里程碑名称
        <input
          value={title}
          required
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </label>
      <label>
        说明
        <textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </label>
      <div className="form-grid">
        <label>
          时间
          <input
            type="datetime-local"
            value={dueAt}
            required
            onChange={(event) => {
              setDueAt(event.target.value);
            }}
          />
        </label>
        <label>
          状态
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as PlanMilestoneItem['status']);
            }}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TaskChoices tasks={tasks} selected={linkedEntityIds} onChange={setLinkedEntityIds} />
      <div className="form-actions">
        <button
          className="button button--small"
          type="button"
          disabled={update.isPending || title.trim().length === 0}
          onClick={() => {
            update.mutate(
              {
                id: milestone.id,
                version: milestone.version,
                title,
                description,
                dueAt: new Date(dueAt).toISOString(),
                status,
                linkedEntityIds,
              },
              {
                onSuccess: () => {
                  setEditing(false);
                },
              },
            );
          }}
        >
          保存里程碑
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setEditing(false);
          }}
        >
          取消
        </button>
      </div>
    </li>
  );
};

export const PlanMilestonesEditor = ({
  planId,
  tasks,
}: {
  planId: string;
  tasks: readonly TaskItem[];
}) => {
  const milestones = usePlanMilestones(planId);
  const create = useCreatePlanMilestone(planId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState(initialDueAt);
  const [linkedEntityIds, setLinkedEntityIds] = useState<string[]>([]);

  const submit = () => {
    create.mutate(
      { title, description, dueAt: new Date(dueAt).toISOString(), linkedEntityIds },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setDueAt(initialDueAt());
          setLinkedEntityIds([]);
        },
      },
    );
  };

  return (
    <section aria-label="计划里程碑">
      <h3>里程碑 · {milestones.data?.length ?? 0}</h3>
      {milestones.isLoading ? <p className="field-hint">正在载入里程碑…</p> : null}
      {milestones.isError ? <p className="error-text">里程碑载入失败，请稍后重试。</p> : null}
      {milestones.data?.length === 0 ? <p className="field-hint">尚未设置里程碑。</p> : null}
      <ul>
        {milestones.data?.map((milestone) => (
          <MilestoneRow key={milestone.id} milestone={milestone} tasks={tasks} />
        ))}
      </ul>
      <div className="planning-form">
        <label>
          新里程碑
          <input
            placeholder="里程碑名称"
            value={title}
            required
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
        </label>
        <label>
          说明
          <textarea
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
          />
        </label>
        <label>
          时间
          <input
            type="datetime-local"
            value={dueAt}
            required
            onChange={(event) => {
              setDueAt(event.target.value);
            }}
          />
        </label>
        <TaskChoices tasks={tasks} selected={linkedEntityIds} onChange={setLinkedEntityIds} />
        <button
          className="button button--small"
          type="button"
          disabled={create.isPending || title.trim().length === 0}
          onClick={submit}
        >
          添加里程碑
        </button>
      </div>
    </section>
  );
};
