import { useState } from 'react';

import {
  useCreateGoalMetric,
  useDeleteGoalMetric,
  useGoalMetrics,
  useRecordGoalProgress,
  useUpdateGoalMetric,
  type GoalMetricItem,
} from './api.js';

const typeLabels: Record<GoalMetricItem['metricType'], string> = {
  NUMBER: '数值',
  COUNT: '次数',
  DURATION: '时长',
  PERCENTAGE: '百分比',
  BOOLEAN: '是否达成',
};

const directionLabels: Record<GoalMetricItem['direction'], string> = {
  INCREASE: '增加至目标',
  DECREASE: '降低至目标',
  MAINTAIN: '维持目标值',
};

interface MetricValue {
  name: string;
  metricType: GoalMetricItem['metricType'];
  unit: string;
  startValue: string;
  targetValue: string;
  direction: GoalMetricItem['direction'];
  weight: string;
}

const emptyMetric = (): MetricValue => ({
  name: '',
  metricType: 'NUMBER',
  unit: '',
  startValue: '',
  targetValue: '',
  direction: 'INCREASE',
  weight: '1',
});

const metricValue = (metric: GoalMetricItem): MetricValue => ({
  name: metric.name,
  metricType: metric.metricType,
  unit: metric.unit ?? '',
  startValue: metric.startValue === null ? '' : String(metric.startValue),
  targetValue: String(metric.targetValue),
  direction: metric.direction,
  weight: String(metric.weight),
});

const parseMetric = (value: MetricValue) => ({
  name: value.name,
  metricType: value.metricType,
  unit: value.unit.trim() || null,
  startValue: value.startValue === '' ? null : Number(value.startValue),
  targetValue: Number(value.targetValue),
  direction: value.direction,
  weight: Number(value.weight),
});

const MetricFields = ({
  value,
  onChange,
}: {
  value: MetricValue;
  onChange: (value: MetricValue) => void;
}) => (
  <>
    <label>
      指标名称
      <input
        value={value.name}
        onChange={(event) => {
          onChange({ ...value, name: event.target.value });
        }}
      />
    </label>
    <div className="form-grid">
      <label>
        指标类型
        <select
          value={value.metricType}
          onChange={(event) => {
            const metricType = event.target.value as GoalMetricItem['metricType'];
            onChange({
              ...value,
              metricType,
              ...(metricType === 'BOOLEAN'
                ? { unit: '', startValue: '0', targetValue: '1', direction: 'INCREASE' as const }
                : {}),
            });
          }}
        >
          {Object.entries(typeLabels).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        方向
        <select
          value={value.direction}
          onChange={(event) => {
            onChange({ ...value, direction: event.target.value as GoalMetricItem['direction'] });
          }}
        >
          {Object.entries(directionLabels).map(([direction, label]) => (
            <option key={direction} value={direction}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        起点
        <input
          type="number"
          step="any"
          value={value.startValue}
          onChange={(event) => {
            onChange({ ...value, startValue: event.target.value });
          }}
        />
      </label>
      <label>
        目标值
        <input
          type="number"
          step="any"
          value={value.targetValue}
          required
          onChange={(event) => {
            onChange({ ...value, targetValue: event.target.value });
          }}
        />
      </label>
      <label>
        单位
        <input
          value={value.unit}
          disabled={value.metricType === 'BOOLEAN'}
          onChange={(event) => {
            onChange({ ...value, unit: event.target.value });
          }}
        />
      </label>
      <label>
        权重
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={value.weight}
          required
          onChange={(event) => {
            onChange({ ...value, weight: event.target.value });
          }}
        />
      </label>
    </div>
  </>
);

const MetricRow = ({ metric, goalVersion }: { metric: GoalMetricItem; goalVersion: number }) => {
  const update = useUpdateGoalMetric(metric.goalId);
  const remove = useDeleteGoalMetric(metric.goalId);
  const record = useRecordGoalProgress(metric.goalId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => metricValue(metric));
  const [progressValue, setProgressValue] = useState('');
  const [note, setNote] = useState('');

  return (
    <li>
      {editing ? (
        <div className="planning-form">
          <MetricFields value={value} onChange={setValue} />
          <div className="form-actions">
            <button
              className="button button--small"
              type="button"
              disabled={
                update.isPending || value.name.trim().length === 0 || value.targetValue === ''
              }
              onClick={() => {
                update.mutate(
                  { id: metric.id, version: goalVersion, ...parseMetric(value) },
                  {
                    onSuccess: () => {
                      setEditing(false);
                    },
                  },
                );
              }}
            >
              保存指标
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
        </div>
      ) : (
        <>
          <strong>{metric.name}</strong>
          <p className="field-hint">
            {typeLabels[metric.metricType]} · 当前 {metric.latestValue ?? '未记录'}
            {metric.unit ?? ''} / 目标 {metric.targetValue}
            {metric.unit ?? ''} · 自动贡献 {Math.round(metric.progressPercent)}%
          </p>
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
            <button
              className="text-button"
              type="button"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm('确定删除这个目标指标？历史进度记录会保留。'))
                  remove.mutate({ id: metric.id, version: goalVersion });
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
      <div className="form-grid">
        <label>
          记录当前值
          {metric.metricType === 'BOOLEAN' ? (
            <select
              value={progressValue}
              onChange={(event) => {
                setProgressValue(event.target.value);
              }}
            >
              <option value="">请选择</option>
              <option value="1">已达成</option>
              <option value="0">未达成</option>
            </select>
          ) : (
            <input
              type="number"
              step="any"
              value={progressValue}
              onChange={(event) => {
                setProgressValue(event.target.value);
              }}
            />
          )}
        </label>
        <label>
          备注
          <input
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </label>
      </div>
      <button
        className="button button--small"
        type="button"
        disabled={record.isPending || progressValue === ''}
        onClick={() => {
          record.mutate(
            {
              version: goalVersion,
              metricId: metric.id,
              value: Number(progressValue),
              ...(note.trim() === '' ? {} : { note }),
            },
            {
              onSuccess: () => {
                setProgressValue('');
                setNote('');
              },
            },
          );
        }}
      >
        记录进度
      </button>
    </li>
  );
};

export const GoalMetricsEditor = ({ goalId }: { goalId: string }) => {
  const state = useGoalMetrics(goalId);
  const create = useCreateGoalMetric(goalId);
  const [value, setValue] = useState(emptyMetric);
  const goalVersion = state.data?.goalVersion;

  return (
    <section aria-label="目标量化指标">
      <h3>量化指标 · {state.data?.metrics.length ?? 0}</h3>
      {state.data === undefined ? null : (
        <p className="field-hint">
          自动进度 {Math.round(state.data.autoProgress)}% · 当前显示{' '}
          {Math.round(state.data.displayProgress)}% ·{' '}
          {state.data.progressMode === 'AUTO' ? '自动模式' : '手动覆盖中'}
        </p>
      )}
      {state.isLoading ? <p className="field-hint">正在载入指标…</p> : null}
      {state.isError ? <p className="error-text">目标指标载入失败，请稍后重试。</p> : null}
      {state.data?.metrics.length === 0 ? <p className="field-hint">尚未设置量化指标。</p> : null}
      <ul>
        {state.data?.metrics.map((metric) => (
          <MetricRow key={metric.id} metric={metric} goalVersion={state.data.goalVersion} />
        ))}
      </ul>
      <div className="planning-form">
        <MetricFields value={value} onChange={setValue} />
        <button
          className="button button--small"
          type="button"
          disabled={
            create.isPending ||
            goalVersion === undefined ||
            value.name.trim().length === 0 ||
            value.targetValue === ''
          }
          onClick={() => {
            if (goalVersion === undefined) return;
            create.mutate(
              { version: goalVersion, ...parseMetric(value) },
              {
                onSuccess: () => {
                  setValue(emptyMetric());
                },
              },
            );
          }}
        >
          添加指标
        </button>
      </div>
    </section>
  );
};
