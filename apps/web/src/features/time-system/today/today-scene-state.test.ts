import { describe, expect, it } from 'vitest';
import { buildTodaySceneState, getTodayTimeState } from './today-scene-state.js';

const localTime = (hour: number, minute: number): number =>
  new Date(2026, 8, 14, hour, minute, 0, 0).getTime();

describe('getTodayTimeState', () => {
  it.each([
    [0, 0, 'night'],
    [4, 59, 'night'],
    [5, 0, 'morning'],
    [10, 59, 'morning'],
    [11, 0, 'day'],
    [16, 59, 'day'],
    [17, 0, 'sunset'],
    [19, 29, 'sunset'],
    [19, 30, 'night'],
    [23, 59, 'night'],
  ] as const)('maps %i:%i to %s', (hour, minute, expected) => {
    expect(getTodayTimeState(localTime(hour, minute))).toBe(expected);
  });
});

describe('buildTodaySceneState', () => {
  it('keeps pressure stable when only local time changes', () => {
    const morning = buildTodaySceneState({ pressure: 10, currentNow: localTime(9, 0) });
    const night = buildTodaySceneState({ pressure: 10, currentNow: localTime(22, 0) });

    expect(morning).toEqual({ pressureState: 'calm', timeState: 'morning' });
    expect(night).toEqual({ pressureState: 'calm', timeState: 'night' });
  });

  it.each([
    [0, 'calm'],
    [24, 'calm'],
    [25, 'balanced'],
    [49, 'balanced'],
    [50, 'busy'],
    [74, 'busy'],
    [75, 'intense'],
    [100, 'intense'],
  ] as const)('preserves the existing pressure mapping for %i', (pressure, expected) => {
    const state = buildTodaySceneState({ pressure, currentNow: localTime(12, 0) });

    expect(state).toEqual({ pressureState: expected, timeState: 'day' });
  });
});
