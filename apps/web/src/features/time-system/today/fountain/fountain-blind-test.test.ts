import { describe, expect, it } from 'vitest';

import { toPressureVisualState } from '../../pressure-visual-state.js';
import { buildFountainSceneModel } from './fountain-model.js';
import {
  applyFountainBlindState,
  fountainBlindAnswer,
  parseFountainBlindCode,
} from './fountain-blind-test.js';

describe('fountain blind test states', () => {
  const base = buildFountainSceneModel({
    pressure: toPressureVisualState(50, 'ELEVATED'),
    activeArea: 'WORK',
    totals: {
      workMinutes: 360,
      lifeMinutes: 180,
      sleepMinutes: 480,
      freeMinutes: 420,
    },
    nowMinute: 600,
    tasks: [],
  });

  it('parses only anonymous A/B/C codes', () => {
    expect(parseFountainBlindCode('?fountainBlind=b')).toBe('B');
    expect(parseFountainBlindCode('?fountainBlind=busy')).toBeUndefined();
  });

  it('keeps the answer order hidden and produces clearly separated silhouettes', () => {
    expect(fountainBlindAnswer('A')).toBe('balanced');
    expect(fountainBlindAnswer('B')).toBe('busy');
    expect(fountainBlindAnswer('C')).toBe('calm');
    const calm = applyFountainBlindState(base, 'C');
    const balanced = applyFountainBlindState(base, 'A');
    const busy = applyFountainBlindState(base, 'B');
    expect(calm.pressure.columnHeight).toBeLessThan(balanced.pressure.columnHeight);
    expect(balanced.pressure.columnHeight).toBeLessThan(busy.pressure.columnHeight);
    expect(calm.pressure.particleBudget).toBeLessThan(balanced.pressure.particleBudget);
    expect(balanced.pressure.particleBudget).toBeLessThan(busy.pressure.particleBudget);
    expect(calm.pool.calmness).toBeGreaterThan(balanced.pool.calmness);
    expect(balanced.pool.calmness).toBeGreaterThan(busy.pool.calmness);
  });
});
