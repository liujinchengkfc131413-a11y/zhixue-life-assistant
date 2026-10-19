import { CircleAlert, CircleDashed, LoaderCircle } from 'lucide-react';

/**
 * M8-004 统一状态组件：
 * - ErrorState：简体中文错误 + 恢复建议 + 可选重试；不依赖颜色表达（含图标）。
 * - EmptyState：明确告诉用户下一步。
 */

interface StateProps {
  readonly title?: string;
  readonly children?: React.ReactNode;
  readonly action?: React.ReactNode;
}

export const ErrorState = ({ title = '加载失败', children, action }: StateProps) => (
  <section className="state-panel state-panel--error" role="alert">
    <span className="state-panel__icon" aria-hidden="true">
      <CircleAlert size={20} strokeWidth={2} />
    </span>
    <div className="state-panel__body">
      <strong>{title}</strong>
      <p>{children ?? '本地服务暂时无法完成此操作。请确认服务仍在运行，然后重试。'}</p>
    </div>
    {action === undefined ? null : <div className="state-panel__action">{action}</div>}
  </section>
);

export const EmptyState = ({ title, children, action }: StateProps) => (
  <section className="state-panel state-panel--empty">
    <span className="state-panel__icon" aria-hidden="true">
      <CircleDashed size={20} strokeWidth={2} />
    </span>
    <div className="state-panel__body">
      <strong>{title ?? '暂无内容'}</strong>
      <p>{children ?? '这里还没有记录。'}</p>
    </div>
    {action === undefined ? null : <div className="state-panel__action">{action}</div>}
  </section>
);

export const LoadingState = ({ title = '正在加载', children }: StateProps) => (
  <section className="state-panel state-panel--loading" aria-busy="true" aria-live="polite">
    <span className="state-panel__icon" aria-hidden="true">
      <LoaderCircle size={20} strokeWidth={2} />
    </span>
    <div className="state-panel__body">
      <strong>{title}</strong>
      <p>{children ?? '正在读取本地数据，请稍候。'}</p>
    </div>
  </section>
);
