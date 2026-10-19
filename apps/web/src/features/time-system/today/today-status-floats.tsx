import { Briefcase, Heart, Leaf, Moon } from 'lucide-react';

import type { FountainArea } from './fountain/fountain-types.js';

export interface TodayStatusFloatItem {
  readonly kind: FountainArea;
  readonly label: string;
  readonly minutes: number;
  readonly active: boolean;
}

const ICONS = { SLEEP: Moon, WORK: Briefcase, LIFE: Heart, FREE: Leaf } as const;

const formatDuration = (minutes: number): string =>
  `${String(Math.floor(minutes / 60))} 小时 ${String(minutes % 60)} 分`;

/** 围绕喷泉语义锚点分布的时间状态，不再使用同构 Chips 列表。 */
export const TodayStatusFloats = ({
  items,
}: {
  readonly items: readonly TodayStatusFloatItem[];
}) => (
  <div className="today-status-floats" aria-label="时间分布">
    {items.map((item) => {
      const Icon = ICONS[item.kind];
      return (
        <div
          className="today-status-floats__item"
          data-kind={item.kind}
          data-active={item.active}
          key={item.kind}
        >
          <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>{item.label}</span>
          <strong>{formatDuration(item.minutes)}</strong>
          {item.active ? <em>当前</em> : null}
        </div>
      );
    })}
  </div>
);
