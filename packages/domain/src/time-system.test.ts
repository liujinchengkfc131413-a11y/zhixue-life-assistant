import { describe, expect, it } from 'vitest';

import {
  assertEstimatedMinutes,
  assertNoDependencyCycle,
  assertTaskTransition,
  calculateGoalHorizon,
  overlaps,
} from './time-system.js';

describe('M2 time-system invariants', () => {
  it('classifies one month as short term and longer goals as long term', () => {
    expect(calculateGoalHorizon('2026-08-01', '2026-09-01')).toBe('SHORT_TERM');
    expect(calculateGoalHorizon('2026-08-01', '2026-09-02')).toBe('LONG_TERM');
    expect(calculateGoalHorizon('2026-08-01')).toBe('LONG_TERM');
  });

  it('enforces duration, status and dependency invariants', () => {
    expect(() => {
      assertEstimatedMinutes(25);
    }).toThrow('INVALID_ESTIMATED_MINUTES');
    expect(() => {
      assertTaskTransition('COMPLETED', 'IN_PROGRESS');
    }).toThrow('INVALID_TASK_STATUS_TRANSITION');
    expect(() => {
      assertNoDependencyCycle(
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
        ['c', 'a'],
      );
    }).toThrow('DEPENDENCY_CYCLE');
  });

  it('uses half-open time ranges for conflict checks', () => {
    expect(overlaps({ startAt: 0, endAt: 15 }, { startAt: 15, endAt: 30 })).toBe(false);
    expect(overlaps({ startAt: 0, endAt: 30 }, { startAt: 15, endAt: 45 })).toBe(true);
  });
});
