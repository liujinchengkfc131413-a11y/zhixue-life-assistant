import { describe, expect, it } from 'vitest';

import { calculatePressure } from './pressure.js';

describe('pressure-v1', () => {
  it('keeps the score explainable and inside the stable levels', () => {
    const result = calculatePressure({
      dayEnd: Date.parse('2026-08-11T16:00:00.000Z'),
      awakeMinutes: 960,
      workMinutes: 720,
      lifeMinutes: 120,
      freeMinutes: 120,
      longestContinuousWorkMinutes: 150,
      tasks: [
        {
          priority: 'URGENT',
          dueAt: Date.parse('2026-08-11T12:00:00.000Z'),
          estimatedMinutes: 60,
          scheduledMinutes: 60,
        },
      ],
    });
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.algorithmVersion).toBe('pressure-v1');
    expect(result.factors.some((factor) => factor.code === 'CONTINUOUS_WORK')).toBe(true);
  });

  it('maps exact score ranges to stable codes', () => {
    const relaxed = calculatePressure({
      dayEnd: 86_400_000,
      awakeMinutes: 960,
      workMinutes: 0,
      lifeMinutes: 0,
      freeMinutes: 960,
      longestContinuousWorkMinutes: 0,
      tasks: [],
    });
    expect(relaxed).toMatchObject({ score: 0, level: 'RELAXED' });
  });
});
