import { formatDateTime, formatTime } from '../../../shared/format.js';
import { useDialogA11y } from '../../../shared/use-dialog-a11y.js';
import {
  useTaskScheduleHistory,
  type ScheduleHistoryTimeSpan,
  type TaskScheduleHistoryEntry,
} from '../api.js';

const kindMeta: Record<TaskScheduleHistoryEntry['kind'], { label: string; hint: string }> = {
  RELEASED: { label: '已释放', hint: '原安排已释放' },
  SCHEDULED: { label: '已安排', hint: '安排到新时间' },
  RESCHEDULED: { label: '已重排', hint: '原时间失效，重新安排' },
  UNSCHEDULED: { label: '未排入', hint: '本次未能安排' },
};

const triggerLabel = (trigger: string): string =>
  ({
    TASK_CREATED: '任务创建',
    TASK_UPDATED: '任务更新',
    TASK_COMPLETED: '任务完成',
    TASK_CANCELLED: '任务取消',
    EVENT_CREATED: '日程创建',
    EVENT_UPDATED: '日程更新',
    ROUTINE_UPDATED: '作息更新',
    ROUTINE_DEFAULT_CHANGED: '默认作息变化',
    ROUTINE_OVERRIDE_CHANGED: '日期覆盖变化',
    OVERDUE: '逾期自动重排',
    USER_REQUEST: '用户请求重排',
    TEST_REPLAY: '测试重放',
    BACKGROUND_JOB: '后台任务',
  })[trigger] ?? trigger;

const reasonLabel = (reason: string): string =>
  triggerLabel(reason).endsWith('重排') ? triggerLabel(reason) : `${triggerLabel(reason)}释放`;

const timeSpanText = (span: ScheduleHistoryTimeSpan): string =>
  `${formatTime(span.startAt)}–${formatTime(span.endAt)}`;

export const ScheduleHistoryDrawer = ({
  taskId,
  taskTitle,
  onClose,
}: {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}) => {
  const panelRef = useDialogA11y<HTMLDivElement>(true, onClose);
  const history = useTaskScheduleHistory(taskId);

  return (
    <div
      className="detail-panel"
      role="dialog"
      aria-modal="true"
      aria-label="任务调度历史"
      ref={panelRef}
      tabIndex={-1}
    >
      <button className="detail-panel__close" type="button" onClick={onClose}>
        关闭
      </button>
      <p className="page__context">调度历史</p>
      <h2>{taskTitle}</h2>
      {history.isLoading ? (
        <p className="field-hint">正在读取调度历史…</p>
      ) : history.isError ? (
        <p className="field-hint">调度历史暂时无法加载，请重试。</p>
      ) : history.data === undefined ? (
        <p className="field-hint">暂无调度历史。</p>
      ) : history.data.entries.length === 0 ? (
        <p className="field-hint">暂无调度历史。</p>
      ) : (
        <ul>
          {history.data.entries.map((entry, index) => (
            <li
              key={`${entry.runId ?? 'none'}:${entry.occurredAt}:${String(index)}`}
              style={{ padding: '10px 0', borderBottom: '1px solid rgba(128,128,128,0.18)' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '8px',
                  alignItems: 'baseline',
                }}
              >
                <strong>{kindMeta[entry.kind].label}</strong>
                <span style={{ opacity: 0.72 }}>{formatDateTime(entry.occurredAt)}</span>
              </div>
              <p className="field-hint" style={{ marginTop: 4 }}>
                {kindMeta[entry.kind].hint} · {triggerLabel(entry.trigger)}
                {entry.reason === null ? '' : ` · ${reasonLabel(entry.reason)}`}
              </p>
              {entry.previousBlocks.length > 0 ? (
                <p className="field-hint" style={{ marginTop: 2 }}>
                  原时间：{entry.previousBlocks.map(timeSpanText).join('、')}
                </p>
              ) : null}
              {entry.newBlocks.length > 0 ? (
                <p className="field-hint" style={{ marginTop: 2 }}>
                  新时间：{entry.newBlocks.map(timeSpanText).join('、')}
                </p>
              ) : null}
              {entry.warnings.map((warning, warningIndex) => (
                <p className="field-hint" key={`${String(warningIndex)}:${warning.message}`}>
                  {warning.message}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
