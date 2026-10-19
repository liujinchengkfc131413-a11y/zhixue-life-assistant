import { describe, expect, it } from 'vitest';

import { toPressureVisualState } from '../../pressure-visual-state.js';
import { buildFountainSceneModel } from './fountain-model.js';
import {
  FOUNTAIN_STATE_TRANSITION_SECONDS,
  interpolateFountainSceneModel,
} from './fountain-scene-transition.js';

const model = (score: number) =>
  buildFountainSceneModel({
    pressure: toPressureVisualState(score, score < 50 ? 'COMFORTABLE' : 'HIGH_PRESSURE'),
    totals: { sleepMinutes: 480, workMinutes: 360, lifeMinutes: 180, freeMinutes: 420 },
    activeArea: 'WORK',
    nowMinute: 660,
    tasks: [],
  });

describe('fountain scene transition', () => {
  it('使用 700ms 状态过渡窗口', () => {
    expect(FOUNTAIN_STATE_TRANSITION_SECONDS).toBe(0.7);
  });

  it('过渡端点与目标模型一致，中间帧不跳变', () => {
    const calm = model(12);
    const intense = model(87);
    const start = interpolateFountainSceneModel(calm, intense, 0);
    const middle = interpolateFountainSceneModel(calm, intense, 0.5);
    const end = interpolateFountainSceneModel(calm, intense, 1);

    expect(start.pressure.columnHeight).toBe(calm.pressure.columnHeight);
    expect(end.pressure.columnHeight).toBe(intense.pressure.columnHeight);
    expect(middle.pressure.columnHeight).toBeGreaterThan(calm.pressure.columnHeight);
    expect(middle.pressure.columnHeight).toBeLessThan(intense.pressure.columnHeight);
    expect(middle.streams[0]?.width).toBeGreaterThan(calm.streams[0]?.width ?? 0);
    expect(middle.streams[0]?.width).toBeLessThan(intense.streams[0]?.width ?? 1);
    expect(middle.pool.rippleStrength).toBeGreaterThan(calm.pool.rippleStrength);
    expect(middle.pool.rippleStrength).toBeLessThan(intense.pool.rippleStrength);
  });

  it('超出进度会钳制到起止状态', () => {
    const calm = model(12);
    const intense = model(87);
    expect(interpolateFountainSceneModel(calm, intense, -1).pressure).toEqual(calm.pressure);
    expect(interpolateFountainSceneModel(calm, intense, 2).pressure).toEqual(intense.pressure);
  });
});
