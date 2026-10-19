import { describe, expect, it } from 'vitest';

import { toPressureVisualState } from '../../pressure-visual-state.js';
import { buildFountainSceneModel, type FountainModelInput } from './fountain-model.js';

const baseInput = (overrides: Partial<FountainModelInput> = {}): FountainModelInput => ({
  pressure: toPressureVisualState(30, 'COMFORTABLE'),
  totals: { sleepMinutes: 480, workMinutes: 360, lifeMinutes: 120, freeMinutes: 480 },
  activeArea: 'WORK',
  nowMinute: 660,
  tasks: [],
  ...overrides,
});

describe('buildFountainSceneModel', () => {
  it('相同输入输出完全确定', () => {
    expect(buildFountainSceneModel(baseInput())).toEqual(buildFountainSceneModel(baseInput()));
  });

  it('压力从 0 到 100：全部强度参数单调不减且不越界', () => {
    const scores = Array.from({ length: 101 }, (_, score) => score);
    const models = scores.map((score) =>
      buildFountainSceneModel(baseInput({ pressure: toPressureVisualState(score, 'ELEVATED') })),
    );
    for (let index = 1; index < models.length; index += 1) {
      const current = models[index];
      const previous = models[index - 1];
      expect(current).toBeDefined();
      expect(previous).toBeDefined();
      if (current === undefined || previous === undefined) continue;
      expect(current.pressure.columnHeight).toBeGreaterThanOrEqual(previous.pressure.columnHeight);
      expect(current.pressure.columnWidth).toBeGreaterThanOrEqual(previous.pressure.columnWidth);
      expect(current.pressure.crownSpread).toBeGreaterThanOrEqual(previous.pressure.crownSpread);
      expect(current.pressure.turbulence).toBeGreaterThanOrEqual(previous.pressure.turbulence);
      expect(current.pressure.spray).toBeGreaterThanOrEqual(previous.pressure.spray);
      expect(current.pressure.flowSpeed).toBeGreaterThanOrEqual(previous.pressure.flowSpeed);
      expect(current.pressure.mistDensity).toBeGreaterThanOrEqual(previous.pressure.mistDensity);
      expect(current.pressure.glowIntensity).toBeGreaterThanOrEqual(
        previous.pressure.glowIntensity,
      );
      expect(current.pressure.highlightIntensity).toBeGreaterThanOrEqual(
        previous.pressure.highlightIntensity,
      );
      expect(current.pressure.particleBudget).toBeGreaterThanOrEqual(
        previous.pressure.particleBudget,
      );
    }
    for (const model of models) {
      expect(model.pressure.columnHeight).toBeGreaterThanOrEqual(0.34);
      expect(model.pressure.columnHeight).toBeLessThanOrEqual(0.96);
      expect(model.pressure.columnWidth).toBeGreaterThanOrEqual(0.3);
      expect(model.pressure.columnWidth).toBeLessThanOrEqual(0.94);
      expect(model.pressure.turbulence).toBeGreaterThanOrEqual(0);
      expect(model.pressure.turbulence).toBeLessThanOrEqual(1);
      expect(model.pressure.spray).toBeGreaterThanOrEqual(0);
      expect(model.pressure.spray).toBeLessThanOrEqual(1);
      expect(model.pressure.flowSpeed).toBeGreaterThanOrEqual(0.2);
      expect(model.pressure.flowSpeed).toBeLessThanOrEqual(1);
      expect(model.pressure.mistDensity).toBeGreaterThanOrEqual(0);
      expect(model.pressure.mistDensity).toBeLessThanOrEqual(1);
      expect(model.pressure.particleBudget).toBeGreaterThanOrEqual(200);
      expect(model.pressure.particleBudget).toBeLessThanOrEqual(1000);
      expect(model.pool.rippleFrequency).toBeGreaterThanOrEqual(0);
      expect(model.pool.rippleFrequency).toBeLessThanOrEqual(1);
      expect(model.pool.waveSpeed).toBeGreaterThanOrEqual(0);
      expect(model.pool.waveSpeed).toBeLessThanOrEqual(1);
      expect(model.pool.reflectionIntensity).toBeGreaterThanOrEqual(0);
      expect(model.pool.reflectionIntensity).toBeLessThanOrEqual(1);
      expect(model.pool.distortion).toBeGreaterThanOrEqual(0);
      expect(model.pool.distortion).toBeLessThanOrEqual(1);
    }
  });

  it('四等级边界分数输出对应等级与差异化参数', () => {
    const cases = [
      [12, 'RELAXED'],
      [37, 'COMFORTABLE'],
      [62, 'ELEVATED'],
      [87, 'HIGH_PRESSURE'],
    ] as const;
    const models = cases.map(([score, level]) =>
      buildFountainSceneModel(baseInput({ pressure: toPressureVisualState(score, level) })),
    );
    for (let index = 0; index < cases.length; index += 1) {
      const model = models[index];
      const entry = cases[index];
      expect(model).toBeDefined();
      expect(entry).toBeDefined();
      if (model === undefined || entry === undefined) continue;
      expect(model.pressure.level).toBe(entry[1]);
      expect(model.pressure.score).toBe(entry[0]);
    }
    const relaxed = models[0]?.pressure;
    const high = models[3]?.pressure;
    expect(relaxed).toBeDefined();
    expect(high).toBeDefined();
    if (relaxed === undefined || high === undefined) return;
    expect(high.columnHeight).toBeGreaterThan(relaxed.columnHeight);
    expect(high.columnWidth).toBeGreaterThan(relaxed.columnWidth);
    expect(high.crownSpread).toBeGreaterThan(relaxed.crownSpread);
    expect(high.mistDensity - relaxed.mistDensity).toBeGreaterThanOrEqual(0.4);
    expect(high.spray - relaxed.spray).toBeGreaterThanOrEqual(0.5);
  });

  it('常态粒子预算不超过约 500，高压态保持在 1000 以内', () => {
    const normal = buildFountainSceneModel(
      baseInput({ pressure: toPressureVisualState(37, 'COMFORTABLE') }),
    ).pressure.particleBudget;
    const intense = buildFountainSceneModel(
      baseInput({ pressure: toPressureVisualState(87, 'HIGH_PRESSURE') }),
    ).pressure.particleBudget;

    expect(normal).toBeLessThanOrEqual(500);
    expect(intense).toBeGreaterThan(normal);
    expect(intense).toBeLessThanOrEqual(1000);
  });

  it('压力等级边界两侧保持连续，不产生几何跳变', () => {
    for (const [before, after] of [
      [24, 25],
      [49, 50],
      [74, 75],
    ] as const) {
      const lower = buildFountainSceneModel(
        baseInput({ pressure: toPressureVisualState(before, 'RELAXED') }),
      ).pressure;
      const upper = buildFountainSceneModel(
        baseInput({ pressure: toPressureVisualState(after, 'HIGH_PRESSURE') }),
      ).pressure;
      expect(upper.columnHeight - lower.columnHeight).toBeLessThan(0.025);
      expect(upper.columnWidth - lower.columnWidth).toBeLessThan(0.025);
      expect(upper.crownSpread - lower.crownSpread).toBeLessThan(0.025);
      expect(upper.turbulence - lower.turbulence).toBeLessThan(0.025);
    }
  });

  it('工作占比高 → MID 层活跃度高；生活占比高 → FRONT 层活跃度高', () => {
    const workHeavy = buildFountainSceneModel(
      baseInput({
        totals: { sleepMinutes: 480, workMinutes: 720, lifeMinutes: 60, freeMinutes: 180 },
      }),
    );
    const lifeHeavy = buildFountainSceneModel(
      baseInput({
        totals: { sleepMinutes: 480, workMinutes: 60, lifeMinutes: 720, freeMinutes: 180 },
      }),
    );
    const workMid = (model: typeof workHeavy) =>
      model.streams.find((stream) => stream.layer === 'MID' && stream.side === 'LEFT');
    const lifeFront = (model: typeof workHeavy) =>
      model.streams.find((stream) => stream.layer === 'FRONT' && stream.side === 'LEFT');
    expect(workMid(workHeavy)?.activity ?? 0).toBeGreaterThan(workMid(lifeHeavy)?.activity ?? 0);
    expect(lifeFront(lifeHeavy)?.activity ?? 0).toBeGreaterThan(
      lifeFront(workHeavy)?.activity ?? 0,
    );
    expect(
      (workMid(workHeavy)?.activity ?? 0) - (workMid(lifeHeavy)?.activity ?? 0),
    ).toBeGreaterThan(0.35);
    expect(
      (lifeFront(lifeHeavy)?.activity ?? 0) - (lifeFront(workHeavy)?.activity ?? 0),
    ).toBeGreaterThan(0.35);
  });

  it('睡眠占比与当前领域会增强对应水弧层', () => {
    const sleepHeavy = buildFountainSceneModel(
      baseInput({
        totals: { sleepMinutes: 720, workMinutes: 120, lifeMinutes: 120, freeMinutes: 480 },
        activeArea: 'SLEEP',
      }),
    );
    const workActive = buildFountainSceneModel(baseInput({ activeArea: 'WORK' }));
    const lifeActive = buildFountainSceneModel(baseInput({ activeArea: 'LIFE' }));
    const activity = (model: typeof sleepHeavy, layer: 'BACK' | 'MID' | 'FRONT') =>
      model.streams.find((stream) => stream.layer === layer && stream.side === 'LEFT')?.activity ??
      0;

    expect(activity(sleepHeavy, 'BACK')).toBeGreaterThan(activity(workActive, 'BACK'));
    expect(activity(workActive, 'MID')).toBeGreaterThan(activity(lifeActive, 'MID'));
    expect(activity(lifeActive, 'FRONT')).toBeGreaterThan(activity(workActive, 'FRONT'));
  });

  it('工作、生活、睡眠、空闲输出可辨识的领域视觉语义', () => {
    const work = buildFountainSceneModel(baseInput({ activeArea: 'WORK' }));
    const life = buildFountainSceneModel(baseInput({ activeArea: 'LIFE' }));
    const sleep = buildFountainSceneModel(baseInput({ activeArea: 'SLEEP' }));
    const free = buildFountainSceneModel(baseInput({ activeArea: 'FREE' }));

    expect(work.domain.streamFocus).toBeGreaterThan(life.domain.streamFocus);
    expect(work.domain.jetStability).toBeGreaterThan(life.domain.jetStability);
    expect(work.domain.rhythm).toBeGreaterThan(life.domain.rhythm);
    expect(life.domain.warmth).toBeGreaterThan(work.domain.warmth);
    expect(life.domain.rippleSoftness).toBeGreaterThan(work.domain.rippleSoftness);
    expect(sleep.domain.mistBoost).toBeGreaterThan(work.domain.mistBoost);
    expect(sleep.domain.flowScale).toBeLessThan(work.domain.flowScale);
    expect(free.domain.flowScale).toBeLessThan(sleep.domain.flowScale);
    expect(free.domain.breathingSpace).toBeGreaterThan(sleep.domain.breathingSpace);
    expect(work.streams[0]?.landX ?? 1).toBeLessThan(free.streams[0]?.landX ?? 0);
  });

  it('空状态（只有睡眠与空闲）仍输出完整平静的喷泉', () => {
    const model = buildFountainSceneModel(
      baseInput({
        totals: { sleepMinutes: 480, workMinutes: 0, lifeMinutes: 0, freeMinutes: 960 },
        pressure: toPressureVisualState(0, 'RELAXED'),
      }),
    );
    expect(model.streams).toHaveLength(12);
    expect(model.taskSignals).toHaveLength(0);
    expect(model.pool.calmness).toBeGreaterThanOrEqual(0.7);
    for (const stream of model.streams) {
      expect(stream.activity).toBeGreaterThanOrEqual(0.1);
      expect(stream.opacity).toBeGreaterThanOrEqual(0.1);
    }
    expect(model.pool.activeLandingPoints).toHaveLength(12);
  });

  it('任务优先级 → 脉冲强度单调（紧急 > 高 > 普通 > 低）', () => {
    const model = buildFountainSceneModel(
      baseInput({
        tasks: [
          { id: 't1', priority: 'URGENT' },
          { id: 't2', priority: 'HIGH' },
          { id: 't3', priority: 'NORMAL' },
          { id: 't4', priority: 'LOW' },
        ],
      }),
    );
    const pulse = (id: string) => model.taskSignals.find((signal) => signal.id === id)?.pulse ?? 0;
    expect(pulse('t1')).toBe(1);
    expect(pulse('t2')).toBe(0.7);
    expect(pulse('t3')).toBe(0.45);
    expect(pulse('t4')).toBe(0.25);
  });

  it('当前时刻越界被收敛到 0–1440', () => {
    expect(buildFountainSceneModel(baseInput({ nowMinute: -30 })).time.nowMinute).toBe(0);
    expect(buildFountainSceneModel(baseInput({ nowMinute: 2_000 })).time.nowMinute).toBe(1_440);
  });
});
