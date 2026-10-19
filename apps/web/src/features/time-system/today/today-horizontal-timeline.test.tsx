// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  buildDisplaySegments,
  minuteOf,
  minutePosition,
  timelineSegment,
  TodayHorizontalTimeline,
} from './today-horizontal-timeline.js';

const dayStart = Date.parse('2026-08-15T00:00:00+08:00');

describe('today horizontal timeline math', () => {
  it('maps day boundaries to the full timeline extent', () => {
    expect(minuteOf('2026-08-15T00:00:00.000+08:00', dayStart)).toBe(0);
    expect(minuteOf('2026-08-16T00:00:00.000+08:00', dayStart)).toBe(1_440);
    expect(minutePosition(0)).toBe(0);
    expect(minutePosition(1_440)).toBe(100);
    expect(minutePosition(14 * 60 + 25)).toBeCloseTo(60.069, 3);
  });

  it('clips cross-boundary blocks while preserving their visible duration', () => {
    const segment = timelineSegment(
      {
        id: 'overnight',
        title: '睡眠',
        startAt: '2026-08-14T23:00:00.000+08:00',
        endAt: '2026-08-15T07:00:00.000+08:00',
        blockType: 'SLEEP',
        area: 'SLEEP',
        targetEntityId: null,
        source: 'ROUTINE',
        isLocked: false,
        crossAreaWarning: false,
      },
      dayStart,
    );
    expect(segment).toMatchObject({ start: 0, end: 420, left: 0 });
    expect(segment.width).toBeCloseTo((420 / 1_440) * 100);
  });

  it('fills a sparse day with explicit free segments covering 0–1440', () => {
    const blocks = [
      {
        id: 'work',
        title: '专注工作',
        startAt: '2026-08-15T01:00:00.000Z',
        endAt: '2026-08-15T03:00:00.000Z',
        blockType: 'TASK',
        area: 'WORK',
        targetEntityId: 'task-1',
        source: 'RULE_ENGINE',
        isLocked: false,
        crossAreaWarning: false,
      },
    ] as const;
    const segments = buildDisplaySegments(blocks, dayStart);

    expect(segments.map(({ kind, start, end }) => ({ kind, start, end }))).toEqual([
      { kind: 'FREE', start: 0, end: 540 },
      { kind: 'WORK', start: 540, end: 660 },
      { kind: 'FREE', start: 660, end: 1_440 },
    ]);
    expect(segments[0]?.start).toBe(0);
    expect(segments.at(-1)?.end).toBe(1_440);
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]?.start).toBe(segments[index - 1]?.end);
    }
  });

  it('defensively clips overlapping display projections without gaps or negative widths', () => {
    const block = (id: string, startAt: string, endAt: string) => ({
      id,
      title: id,
      startAt,
      endAt,
      blockType: 'EVENT' as const,
      area: 'LIFE' as const,
      targetEntityId: id,
      source: 'MANUAL' as const,
      isLocked: true,
      crossAreaWarning: false,
    });
    const segments = buildDisplaySegments(
      [
        block('first', '2026-08-15T01:00:00.000Z', '2026-08-15T04:00:00.000Z'),
        block('overlap', '2026-08-15T03:00:00.000Z', '2026-08-15T05:00:00.000Z'),
      ],
      dayStart,
    );

    expect(segments.every((segment) => segment.end > segment.start)).toBe(true);
    expect(segments[0]?.start).toBe(0);
    expect(segments.at(-1)?.end).toBe(1_440);
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]?.start).toBe(segments[index - 1]?.end);
    }
  });

  it('exposes each segment as a keyboard-operable detail control', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <TodayHorizontalTimeline
        dayStart={dayStart}
        serverNow={Date.parse('2026-08-15T06:30:00+08:00')}
        onSelect={onSelect}
        blocks={[
          {
            id: 'morning-work',
            title: '专注工作',
            startAt: '2026-08-15T06:00:00.000+08:00',
            endAt: '2026-08-15T07:00:00.000+08:00',
            blockType: 'TASK',
            area: 'WORK',
            targetEntityId: 'task-1',
            source: 'MANUAL',
            isLocked: false,
            crossAreaWarning: false,
          },
        ]}
      />,
    );
    const segmentButton = screen.getByRole('button', { name: /专注工作/ });
    await user.click(segmentButton);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith('morning-work');
    expect(screen.getAllByText(/00:00|06:00|12:00|18:00|24:00/)).toHaveLength(5);
    expect(
      container.querySelector('.today-timeline__nodes span[data-active="true"]'),
    ).not.toBeNull();
  });
});
