import { useState } from 'react';

import { useModifyRecurrence, useRecurrenceOccurrences, useRecurrenceRule } from './api.js';

type RecurrenceAction =
  'ONLY_THIS' | 'THIS_AND_FUTURE' | 'ENTIRE_SERIES' | 'SKIP_ONCE' | 'END_RECURRENCE';

const labels: Record<RecurrenceAction, string> = {
  ONLY_THIS: '仅本次（使用当前表单内容）',
  THIS_AND_FUTURE: '本次及以后（应用下方重复规则）',
  ENTIRE_SERIES: '整个系列（保留已发生实例）',
  SKIP_ONCE: '跳过本次',
  END_RECURRENCE: '结束重复',
};

export const RecurrenceModifySelector = ({
  entityId,
  override,
  onApplied,
}: {
  entityId: string;
  override: Record<string, unknown>;
  onApplied: () => void;
}) => {
  const ruleQuery = useRecurrenceRule(entityId);
  const rule = ruleQuery.data ?? undefined;
  const occurrences = useRecurrenceOccurrences(rule?.id);
  if (ruleQuery.isLoading || rule === undefined) return null;
  const occurrence = occurrences.data?.find((item) => item.generatedEntityId === entityId);

  return (
    <LoadedRecurrenceModifySelector
      key={`${rule.id}:${String(rule.version)}`}
      entityId={entityId}
      rule={rule}
      recurrenceKey={occurrence?.recurrenceKey}
      occurrencesLoading={occurrences.isLoading}
      occurrencesError={occurrences.isError || (occurrences.isSuccess && occurrence === undefined)}
      override={override}
      onApplied={onApplied}
    />
  );
};

const LoadedRecurrenceModifySelector = ({
  entityId,
  rule,
  recurrenceKey,
  occurrencesLoading,
  occurrencesError,
  override,
  onApplied,
}: {
  entityId: string;
  rule: { id: string; version: number; rrule: string };
  recurrenceKey: string | undefined;
  occurrencesLoading: boolean;
  occurrencesError: boolean;
  override: Record<string, unknown>;
  onApplied: () => void;
}) => {
  const modify = useModifyRecurrence(entityId);
  const [action, setAction] = useState<RecurrenceAction>('ONLY_THIS');
  const [rrule, setRrule] = useState(rule.rrule);
  const needsRule = action === 'THIS_AND_FUTURE' || action === 'ENTIRE_SERIES';
  const disabled =
    modify.isPending || recurrenceKey === undefined || (needsRule && rrule.trim() === '');

  return (
    <section aria-label="修改重复事项">
      <h3>修改重复事项</h3>
      <p className="field-hint">当前实例属于重复系列。请先选择本次修改的作用范围。</p>
      <label>
        作用范围
        <select
          aria-label="重复修改范围"
          value={action}
          onChange={(event) => {
            setAction(event.target.value as RecurrenceAction);
          }}
        >
          {(Object.keys(labels) as RecurrenceAction[]).map((value) => (
            <option key={value} value={value}>
              {labels[value]}
            </option>
          ))}
        </select>
      </label>
      {needsRule ? (
        <label>
          重复规则（RRULE）
          <input
            aria-label="重复规则"
            value={rrule}
            onChange={(event) => {
              setRrule(event.target.value);
            }}
          />
        </label>
      ) : null}
      {occurrencesLoading ? <p className="field-hint">正在读取系列实例…</p> : null}
      {occurrencesError ? (
        <p className="form-error">无法确定当前实例在系列中的位置，请重新打开详情。</p>
      ) : null}
      <button
        className={`button button--small ${action === 'SKIP_ONCE' || action === 'END_RECURRENCE' ? 'button--danger' : 'button--secondary'}`}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (recurrenceKey === undefined) return;
          if (!window.confirm(`确定执行“${labels[action]}”？`)) return;
          modify.mutate(
            {
              id: rule.id,
              version: rule.version,
              action,
              recurrenceKey,
              ...(needsRule ? { rrule: rrule.trim() } : {}),
              ...(action === 'ONLY_THIS' ? { override } : {}),
            },
            { onSuccess: onApplied },
          );
        }}
      >
        {modify.isPending ? '正在应用…' : '应用重复修改'}
      </button>
      {modify.isError ? (
        <p className="form-error">修改失败。规则或数据版本可能已变化，请重新打开详情后再试。</p>
      ) : null}
    </section>
  );
};
