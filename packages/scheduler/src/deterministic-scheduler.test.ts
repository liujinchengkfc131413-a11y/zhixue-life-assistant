import { describe, expect, it } from 'vitest';

import { scheduleDeterministically } from './deterministic-scheduler.js';

const grid = 15 * 60_000;

describe('deterministic scheduler', () => {
  it('protects occupied time and places high priority work first', () => {
    const result = scheduleDeterministically({
      rangeStart: 0,
      rangeEnd: 8 * grid,
      availability: [{ startAt: 0, endAt: 8 * grid, area: 'WORK' }],
      occupied: [
        {
          id: 'meeting',
          startAt: 2 * grid,
          endAt: 4 * grid,
          area: 'WORK',
          blockType: 'EVENT',
          isLocked: true,
        },
      ],
      tasks: [
        {
          id: 'normal',
          priority: 'NORMAL',
          dueAt: 8 * grid,
          estimatedMinutes: 30,
          isSplittable: false,
          preferredArea: 'WORK',
        },
        {
          id: 'urgent',
          priority: 'URGENT',
          dueAt: 8 * grid,
          estimatedMinutes: 30,
          isSplittable: false,
          preferredArea: 'WORK',
        },
      ],
    });
    expect(result.blocks[0]).toMatchObject({ taskId: 'urgent', startAt: 0, endAt: 2 * grid });
    expect(result.blocks[1]).toMatchObject({
      taskId: 'normal',
      startAt: 4 * grid,
      endAt: 6 * grid,
    });
  });

  it('preserves legal blocks and emits dependency and cross-area warnings', () => {
    const result = scheduleDeterministically({
      rangeStart: 0,
      rangeEnd: 8 * grid,
      availability: [
        { startAt: 0, endAt: 2 * grid, area: 'WORK' },
        { startAt: 2 * grid, endAt: 8 * grid, area: 'LIFE' },
      ],
      occupied: [
        {
          id: 'old',
          targetEntityId: 'kept',
          startAt: 0,
          endAt: 2 * grid,
          area: 'WORK',
          blockType: 'TASK',
          isLocked: false,
        },
      ],
      tasks: [
        {
          id: 'kept',
          priority: 'HIGH',
          dueAt: 8 * grid,
          estimatedMinutes: 30,
          isSplittable: false,
          preferredArea: 'WORK',
        },
        {
          id: 'blocked',
          priority: 'URGENT',
          dueAt: 8 * grid,
          estimatedMinutes: 30,
          isSplittable: false,
          preferredArea: 'WORK',
          dependencyBlocked: true,
        },
        {
          id: 'cross',
          priority: 'NORMAL',
          dueAt: 8 * grid,
          estimatedMinutes: 30,
          isSplittable: false,
          preferredArea: 'WORK',
        },
      ],
    });
    expect(result.blocks).toContainEqual(expect.objectContaining({ id: 'old', preserved: true }));
    expect(result.warnings.map((warning) => warning.warningType)).toEqual(
      expect.arrayContaining(['DEPENDENCY_BLOCKED', 'CROSS_AREA']),
    );
  });

  it('places an overdue task after its deadline while keeping non-overdue tasks before due', () => {
    const result = scheduleDeterministically({
      rangeStart: 0,
      rangeEnd: 8 * grid,
      availability: [{ startAt: 0, endAt: 8 * grid, area: 'WORK' }],
      occupied: [],
      tasks: [
        {
          id: 'overdue',
          priority: 'HIGH',
          dueAt: -grid,
          estimatedMinutes: 60,
          isSplittable: false,
          preferredArea: 'WORK',
          effectiveDueAt: 8 * grid,
        },
        {
          id: 'ontime',
          priority: 'NORMAL',
          dueAt: 8 * grid,
          estimatedMinutes: 60,
          isSplittable: false,
          preferredArea: 'WORK',
        },
      ],
    });
    const overdue = result.blocks.find((block) => block.taskId === 'overdue');
    const ontime = result.blocks.find((block) => block.taskId === 'ontime');
    expect(overdue).toMatchObject({ startAt: 0, endAt: 4 * grid });
    expect(ontime).toMatchObject({ startAt: 4 * grid, endAt: 8 * grid });
    expect(result.warnings.some((warning) => warning.warningType === 'DEADLINE_RISK')).toBe(true);
  });

  it('keeps the deadline as a hard cap unless effectiveDueAt is provided', () => {
    const result = scheduleDeterministically({
      rangeStart: 0,
      rangeEnd: 8 * grid,
      availability: [{ startAt: 0, endAt: 8 * grid, area: 'WORK' }],
      occupied: [],
      tasks: [
        {
          id: 'overdue-without-relaxation',
          priority: 'URGENT',
          dueAt: -grid,
          estimatedMinutes: 30,
          isSplittable: false,
          preferredArea: 'WORK',
        },
      ],
    });
    expect(result.blocks.some((block) => block.taskId === 'overdue-without-relaxation')).toBe(
      false,
    );
    expect(result.warnings.some((warning) => warning.warningType === 'UNSCHEDULED')).toBe(true);
  });

  it('handles 10,000 tasks without overlaps or an unbounded loop', () => {
    const tasks = Array.from({ length: 10_000 }, (_, index) => ({
      id: `task-${String(index).padStart(5, '0')}`,
      priority: 'NORMAL' as const,
      dueAt: 96 * grid,
      estimatedMinutes: 15,
      isSplittable: false,
      preferredArea: 'WORK' as const,
    }));
    const result = scheduleDeterministically({
      rangeStart: 0,
      rangeEnd: 96 * grid,
      availability: [{ startAt: 0, endAt: 96 * grid, area: 'WORK' }],
      occupied: [],
      tasks,
    });
    expect(result.blocks).toHaveLength(96);
    expect(new Set(result.blocks.map((block) => block.startAt)).size).toBe(96);
    expect(result.warnings).toHaveLength(9_904);
  });
});
