import { describe, expect, it } from 'vitest';

import type { FountainVisualStateInput } from './fountain-types.js';
import {
  buildFountainVisualState,
  interpolateFountainVisualState,
} from './fountain-visual-state.js';

const input = (pressure: number, overrides: Partial<FountainVisualStateInput> = {}) => ({
  pressure,
  workRatio: 0.25,
  lifeRatio: 0.2,
  sleepRatio: 0.33,
  freeRatio: 0.22,
  currentMode: 'WORK' as const,
  timeProgress: 0.5,
  priorityState: 0,
  ...overrides,
});

const numericKeys = [
  'mainJetHeight',
  'mainJetWidth',
  'streamDensity',
  'streamSpread',
  'streamSpeed',
  'dropletRate',
  'mistDensity',
  'rippleStrength',
  'lightingIntensity',
  'warmth',
  'stability',
] as const;

describe('FountainVisualState', () => {
  it.each([
    [0, 'CALM'],
    [24, 'CALM'],
    [25, 'BALANCED'],
    [49, 'BALANCED'],
    [50, 'BUSY'],
    [74, 'BUSY'],
    [75, 'INTENSE'],
    [100, 'INTENSE'],
  ] as const)('压力 %i 映射到 %s 档', (pressure, profile) => {
    expect(buildFountainVisualState(input(pressure)).profile).toBe(profile);
  });

  it('全部统一输出在标准化范围内', () => {
    for (let pressure = 0; pressure <= 100; pressure += 1) {
      const state = buildFountainVisualState(
        input(pressure, { priorityState: 1, timeProgress: pressure / 100 }),
      );
      for (const key of numericKeys) {
        expect(state[key]).toBeGreaterThanOrEqual(0);
        expect(state[key]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('压力增加时主要动势连续增强，稳定性连续减弱', () => {
    const states = Array.from({ length: 101 }, (_, pressure) =>
      buildFountainVisualState(input(pressure)),
    );
    for (let index = 1; index < states.length; index += 1) {
      const previous = states[index - 1];
      const current = states[index];
      if (previous === undefined || current === undefined) continue;
      for (const key of [
        'mainJetHeight',
        'mainJetWidth',
        'streamDensity',
        'streamSpread',
        'streamSpeed',
        'dropletRate',
        'mistDensity',
        'rippleStrength',
        'lightingIntensity',
      ] as const) {
        expect(current[key]).toBeGreaterThanOrEqual(previous[key]);
      }
      expect(current.stability).toBeLessThanOrEqual(previous.stability);
    }
    for (const [before, after] of [
      [24, 25],
      [49, 50],
      [74, 75],
    ] as const) {
      const lower = buildFountainVisualState(input(before));
      const upper = buildFountainVisualState(input(after));
      expect(Math.abs(upper.mainJetHeight - lower.mainJetHeight)).toBeLessThan(0.025);
      expect(Math.abs(upper.streamSpeed - lower.streamSpeed)).toBeLessThan(0.035);
      expect(Math.abs(upper.stability - lower.stability)).toBeLessThan(0.035);
    }
  });

  it('业务上下文对统一状态产生可辨识但受控的修正', () => {
    const work = buildFountainVisualState(input(50, { currentMode: 'WORK' }));
    const life = buildFountainVisualState(input(50, { currentMode: 'LIFE' }));
    const sleep = buildFountainVisualState(input(50, { currentMode: 'SLEEP' }));
    const free = buildFountainVisualState(input(50, { currentMode: 'FREE' }));
    const urgent = buildFountainVisualState(input(50, { priorityState: 1 }));

    expect(work.streamSpeed).toBeGreaterThan(life.streamSpeed);
    expect(life.warmth).toBeGreaterThan(work.warmth);
    expect(sleep.mistDensity).toBeGreaterThan(work.mistDensity);
    expect(free.streamDensity).toBeLessThan(work.streamDensity);
    expect(urgent.dropletRate).toBeGreaterThan(work.dropletRate);
  });

  it('状态过渡在端点精确收敛，并在中间帧保持连续', () => {
    const calm = buildFountainVisualState(input(12));
    const intense = buildFountainVisualState(input(87));
    const start = interpolateFountainVisualState(calm, intense, 0);
    const middle = interpolateFountainVisualState(calm, intense, 0.5);
    const end = interpolateFountainVisualState(calm, intense, 1);

    expect(start).toEqual(calm);
    expect(end).toEqual(intense);
    expect(middle.mainJetHeight).toBeGreaterThan(calm.mainJetHeight);
    expect(middle.mainJetHeight).toBeLessThan(intense.mainJetHeight);
    expect(middle.stability).toBeLessThan(calm.stability);
    expect(middle.stability).toBeGreaterThan(intense.stability);
  });
});
