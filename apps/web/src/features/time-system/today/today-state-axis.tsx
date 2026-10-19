import { useEffect, useId, useRef, useState } from 'react';

import { formatTime } from '../../../shared/format.js';
import type { PressureVisualState } from '../pressure-visual-state.js';

export interface TodayStateAxisProps {
  readonly pressureVisual?: PressureVisualState | undefined;
  readonly currentNow: number;
  readonly currentStateLabel: string;
  readonly pressureFactors?:
    readonly { code: string; points: number; message: string }[] | undefined;
}

/** 喷泉、水池、压力、当前状态与时间轴 Cursor 之间的共享状态中轴。 */
export const TodayStateAxis = ({
  pressureVisual,
  currentNow,
  currentStateLabel,
  pressureFactors = [],
}: TodayStateAxisProps) => {
  const [factorsOpen, setFactorsOpen] = useState(false);
  const factorsId = useId();
  const factorsTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!factorsOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setFactorsOpen(false);
      queueMicrotask(() => factorsTriggerRef.current?.focus());
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [factorsOpen]);

  return (
    <section
      className="today-state-axis"
      data-level={pressureVisual?.level ?? 'UNKNOWN'}
      aria-label="今日压力与当前状态"
    >
      <div className="today-state-axis__pressure">
        <span className="today-state-axis__label">压力指数</span>
        <strong className="today-state-axis__score">{pressureVisual?.score ?? '--'}</strong>
        <span className="today-state-axis__level">{pressureVisual?.label ?? '读取中'}</span>
        <span className="today-state-axis__description">
          {pressureVisual?.description ?? '正在读取今日状态…'}
          <small>节奏刚刚好</small>
        </span>
      </div>
      {pressureFactors.length > 0 ? (
        <div className="today-state-axis__factors">
          <button
            ref={factorsTriggerRef}
            type="button"
            className="today-state-axis__factors-toggle"
            aria-expanded={factorsOpen}
            aria-controls={factorsId}
            onClick={() => {
              setFactorsOpen((open) => !open);
            }}
          >
            {factorsOpen ? '收起因素' : `查看 ${String(pressureFactors.length)} 项因素`}
          </button>
          {factorsOpen ? (
            <div className="today-state-axis__popover" id={factorsId} role="region">
              <p>压力贡献因素</p>
              <ul>
                {pressureFactors.map((factor) => (
                  <li key={factor.code}>
                    <span>{factor.message}</span>
                    <strong>+{factor.points}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="today-state-axis__now">
        <span>当前时间</span>
        <strong>{formatTime(currentNow)}</strong>
        <span>{currentStateLabel}</span>
      </div>
      <span className="today-state-axis__guide" aria-hidden="true">
        <span />
      </span>
    </section>
  );
};
