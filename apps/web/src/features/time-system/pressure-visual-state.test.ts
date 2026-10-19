import { describe, expect, it } from 'vitest';

import {
  toPressureVisualState,
  pressureLevelLabel,
  pressureLevelDescription,
  type PressureLevel,
} from './pressure-visual-state.js';

const levels: readonly PressureLevel[] = ['RELAXED', 'COMFORTABLE', 'ELEVATED', 'HIGH_PRESSURE'];

describe('toPressureVisualState', () => {
  it('覆盖四个等级边界分数（0 / 25 / 50 / 75）', () => {
    const relaxed = toPressureVisualState(0, 'RELAXED');
    expect(relaxed.intensity).toBe(0.2);
    expect(relaxed.turbulence).toBe(0.05);
    expect(relaxed.spray).toBe(0);
    expect(relaxed.flowSpeed).toBe(0.35);

    const comfortable = toPressureVisualState(25, 'COMFORTABLE');
    expect(comfortable.intensity).toBe(0.45);

    const elevated = toPressureVisualState(50, 'ELEVATED');
    expect(elevated.intensity).toBe(0.7);

    const high = toPressureVisualState(75, 'HIGH_PRESSURE');
    expect(high.intensity).toBe(0.95);
    expect(high.turbulence).toBe(0.9);
  });

  it('等级内分数越高，水流参数单调增强', () => {
    const low = toPressureVisualState(60, 'ELEVATED');
    const high = toPressureVisualState(74, 'ELEVATED');
    expect(high.intensity).toBeGreaterThan(low.intensity);
    expect(high.turbulence).toBeGreaterThanOrEqual(low.turbulence);
    expect(high.spray).toBeGreaterThanOrEqual(low.spray);
    expect(high.flowSpeed).toBeGreaterThan(low.flowSpeed);
  });

  it('高分端不越界（高压 100 分参数封顶于 1）', () => {
    const state = toPressureVisualState(100, 'HIGH_PRESSURE');
    expect(state.intensity).toBeLessThanOrEqual(1);
    expect(state.turbulence).toBeLessThanOrEqual(1);
    expect(state.spray).toBeLessThanOrEqual(1);
    expect(state.flowSpeed).toBeLessThanOrEqual(1);
    expect(state.intensity).toBeGreaterThan(toPressureVisualState(75, 'HIGH_PRESSURE').intensity);
  });

  it('分数越界被收敛到 0–100', () => {
    expect(toPressureVisualState(-10, 'RELAXED').score).toBe(0);
    expect(toPressureVisualState(150, 'HIGH_PRESSURE').score).toBe(100);
  });

  it('四等级水流状态呈阶梯递增（基准强度与湍流）', () => {
    const states = levels.map((level) =>
      toPressureVisualState(
        level === 'RELAXED' ? 0 : level === 'COMFORTABLE' ? 25 : level === 'ELEVATED' ? 50 : 75,
        level,
      ),
    );
    for (let index = 1; index < states.length; index += 1) {
      const current = states[index];
      const previous = states[index - 1];
      expect(current).toBeDefined();
      expect(previous).toBeDefined();
      if (current === undefined || previous === undefined) continue;
      expect(current.intensity).toBeGreaterThan(previous.intensity);
      expect(current.turbulence).toBeGreaterThan(previous.turbulence);
    }
  });

  it('等级标签与描述为产品语义', () => {
    expect(pressureLevelLabel('RELAXED')).toBe('轻松');
    expect(pressureLevelLabel('COMFORTABLE')).toBe('舒适');
    expect(pressureLevelLabel('ELEVATED')).toBe('偏高');
    expect(pressureLevelLabel('HIGH_PRESSURE')).toBe('高压');
    expect(pressureLevelDescription('RELAXED')).toBe('水流平缓、柔和');
    expect(pressureLevelDescription('HIGH_PRESSURE')).toBe('水流紊乱、喷溅增加');
  });
});
