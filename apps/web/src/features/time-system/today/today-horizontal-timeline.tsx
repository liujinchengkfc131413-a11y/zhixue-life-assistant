import { formatTime } from '../../../shared/format.js';
import type { TodayBlock } from '../api.js';

const DAY_MINUTES = 1_440;

export const minuteOf = (timestamp: string, dayStart: number): number =>
  Math.min(DAY_MINUTES, Math.max(0, (Date.parse(timestamp) - dayStart) / 60_000));

export const minutePosition = (minute: number): number =>
  (Math.min(DAY_MINUTES, Math.max(0, minute)) / DAY_MINUTES) * 100;

export const timelineSegment = (block: TodayBlock, dayStart: number) => {
  const start = minuteOf(block.startAt, dayStart);
  const end = minuteOf(block.endAt, dayStart);
  return {
    start,
    end: Math.max(start, end),
    left: minutePosition(start),
    width: minutePosition(Math.max(0, end - start)),
  };
};

export type TimelineDisplayKind = 'SLEEP' | 'WORK' | 'LIFE' | 'FREE';

export interface TimelineDisplaySegment {
  readonly key: string;
  readonly kind: TimelineDisplayKind;
  readonly start: number;
  readonly end: number;
  readonly blockId?: string | undefined;
}

const kindOf = (block: TodayBlock): Exclude<TimelineDisplayKind, 'FREE'> => {
  if (block.blockType === 'SLEEP') return 'SLEEP';
  return block.area === 'WORK' ? 'WORK' : 'LIFE';
};

/**
 * 把真实 blocks 投影为无缺口的 00:00–24:00 显示带。
 * 重叠数据按开始时间稳定裁剪，真实 Block 的交互层仍完整保留。
 */
export const buildDisplaySegments = (
  blocks: readonly TodayBlock[],
  dayStart: number,
): TimelineDisplaySegment[] => {
  const visible = blocks
    .map((block, index) => ({ block, index, ...timelineSegment(block, dayStart) }))
    .filter((segment) => segment.end > segment.start)
    .toSorted((left, right) => left.start - right.start || left.index - right.index);
  const segments: TimelineDisplaySegment[] = [];
  let cursor = 0;

  for (const segment of visible) {
    if (segment.start > cursor) {
      segments.push({
        key: `free-${String(cursor)}-${String(segment.start)}`,
        kind: 'FREE',
        start: cursor,
        end: segment.start,
      });
    }
    const start = Math.max(cursor, segment.start);
    if (segment.end > start) {
      segments.push({
        key: `block-${segment.block.id}-${String(start)}`,
        kind: kindOf(segment.block),
        start,
        end: segment.end,
        blockId: segment.block.id,
      });
      cursor = segment.end;
    }
  }
  if (cursor < DAY_MINUTES) {
    segments.push({
      key: `free-${String(cursor)}-${String(DAY_MINUTES)}`,
      kind: 'FREE',
      start: cursor,
      end: DAY_MINUTES,
    });
  }
  return segments;
};

const blockColor = (block: TodayBlock): string => {
  if (block.blockType === 'SLEEP') return '#7b8fc4';
  if (block.blockType === 'REST') return '#7fb3a2';
  if (block.area === 'WORK') return '#4fa3a0';
  return '#e09a6d';
};

const displayKindLabel: Readonly<Record<TimelineDisplayKind, string>> = {
  SLEEP: '睡眠',
  WORK: '工作',
  LIFE: '生活',
  FREE: '空闲',
};

export const TodayHorizontalTimeline = ({
  dayStart,
  serverNow,
  blocks,
  onSelect,
}: {
  dayStart: number;
  serverNow: number;
  blocks: readonly TodayBlock[];
  onSelect: (id: string) => void;
}) => {
  const nowMinute = Math.min(DAY_MINUTES, Math.max(0, (serverNow - dayStart) / 60_000));
  const displaySegments = buildDisplaySegments(blocks, dayStart);

  return (
    <section className="today-timeline" aria-label="24 小时时间轴">
      <p className="today-visually-hidden" id="today-timeline-instructions">
        时间轴覆盖完整二十四小时。逐段聚焦后按 Enter 或空格查看详情。
      </p>
      <div className="today-timeline__ticks" aria-hidden="true">
        {[0, 6, 12, 18, 24].map((hour) => (
          <span style={{ left: `${String((hour / 24) * 100)}%` }} key={hour}>
            {String(hour).padStart(2, '0')}:00
          </span>
        ))}
      </div>
      <div
        className="today-timeline__row"
        role="group"
        aria-describedby="today-timeline-instructions"
      >
        <div className="today-timeline__band" aria-hidden="true">
          {displaySegments.map((segment) => (
            <span
              className="today-timeline__band-segment"
              data-kind={segment.kind}
              style={{
                left: `${minutePosition(segment.start).toFixed(3)}%`,
                width: `${minutePosition(segment.end - segment.start).toFixed(3)}%`,
              }}
              key={segment.key}
            >
              {segment.end - segment.start >= 120 ? displayKindLabel[segment.kind] : null}
            </span>
          ))}
        </div>
        {blocks.map((block) => {
          const segment = timelineSegment(block, dayStart);
          const state =
            nowMinute >= segment.end ? 'past' : nowMinute >= segment.start ? 'active' : 'future';
          return (
            <button
              type="button"
              className="today-timeline__segment"
              data-block={block.blockType.toLowerCase()}
              data-state={state}
              style={{
                left: `${segment.left.toFixed(3)}%`,
                width: `${Math.max(0.4, segment.width).toFixed(3)}%`,
                color: blockColor(block),
              }}
              key={block.id}
              aria-label={`${block.title}，${formatTime(block.startAt)}至${formatTime(block.endAt)}，${state === 'active' ? '进行中' : state === 'past' ? '已过去' : '尚未开始'}。按 Enter 或空格查看详情。`}
              title={`${block.title} ${formatTime(block.startAt)}–${formatTime(block.endAt)}`}
              onClick={() => {
                onSelect(block.id);
              }}
            />
          );
        })}
        <div className="today-timeline__nodes" aria-hidden="true">
          {blocks.map((block) => {
            const segment = timelineSegment(block, dayStart);
            const active = nowMinute >= segment.start && nowMinute < segment.end;
            if (!active && !block.isLocked && block.blockType !== 'EVENT') return null;
            return (
              <span
                data-active={active}
                data-kind={kindOf(block)}
                style={{ left: `${minutePosition((segment.start + segment.end) / 2).toFixed(3)}%` }}
                key={block.id}
              />
            );
          })}
        </div>
        <span
          className="today-timeline__cursor"
          style={{ left: `${minutePosition(nowMinute).toFixed(3)}%` }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
};
