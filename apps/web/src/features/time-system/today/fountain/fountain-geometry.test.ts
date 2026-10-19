import { describe, expect, it } from 'vitest';

import { toPressureVisualState } from '../../pressure-visual-state.js';
import { buildFountainSceneModel, type FountainModelInput } from './fountain-model.js';
import { buildFountainGeometry } from './fountain-geometry.js';

const VIEW = { width: 720, height: 520 };

const baseInput = (overrides: Partial<FountainModelInput> = {}): FountainModelInput => ({
  pressure: toPressureVisualState(30, 'COMFORTABLE'),
  totals: { sleepMinutes: 480, workMinutes: 360, lifeMinutes: 120, freeMinutes: 480 },
  activeArea: 'WORK',
  nowMinute: 660,
  tasks: [],
  ...overrides,
});

describe('buildFountainGeometry', () => {
  it('相同输入输出完全确定', () => {
    const model = buildFountainSceneModel(baseInput());
    expect(buildFountainGeometry(model, VIEW)).toEqual(buildFountainGeometry(model, VIEW));
  });

  it('水柱、展开点与水弧坐标落在有效范围内', () => {
    const model = buildFountainSceneModel(baseInput());
    const geometry = buildFountainGeometry(model, VIEW);
    const cx = VIEW.width / 2;
    const rx = VIEW.width * 0.42;
    // 柱顶与正式资产的中央喷口对齐，并在低压/高压之间保留足够轮廓差。
    expect(geometry.column.topY).toBeGreaterThanOrEqual(VIEW.height * 0.055);
    expect(geometry.column.topY).toBeLessThanOrEqual(VIEW.height * 0.235);
    expect(geometry.column.baseY).toBe(geometry.pool.cy);
    // 水弧落点在池内（|x-cx| <= rx），落水 y 在池面
    for (const stream of geometry.streams) {
      const parts = stream.path.split(' ');
      const landX = Number(parts.at(-2));
      const landY = Number(parts.at(-1));
      expect(Math.abs(landX - cx)).toBeLessThanOrEqual(rx);
      expect(Math.abs(landY - geometry.pool.cy)).toBeLessThan(0.01);
    }
    for (const point of geometry.landingPoints) {
      expect(Math.abs(point.x - cx)).toBeLessThanOrEqual(rx);
      expect(Math.abs(point.y - geometry.pool.cy)).toBeLessThan(0.01);
    }
    // 六圈左右对称水弧 + 对应落点
    expect(geometry.streams).toHaveLength(12);
    expect(geometry.landingPoints).toHaveLength(12);
    expect(geometry.streams.filter((stream) => stream.role === 'PRIMARY_ARC')).toHaveLength(2);
    expect(geometry.streams.filter((stream) => stream.role === 'MID_STREAM')).toHaveLength(6);
    expect(geometry.streams.filter((stream) => stream.role === 'FINE_STREAM')).toHaveLength(4);
    const widestPrimary = Math.max(
      ...geometry.streams
        .filter((stream) => stream.role === 'PRIMARY_ARC')
        .map((stream) => stream.width),
    );
    const widestFine = Math.max(
      ...geometry.streams
        .filter((stream) => stream.role === 'FINE_STREAM')
        .map((stream) => stream.width),
    );
    expect(widestPrimary).toBeGreaterThan(widestFine * 1.8);
  });

  it('压力越高水柱越高（柱顶 y 越小）', () => {
    const relaxed = buildFountainSceneModel(
      baseInput({ pressure: toPressureVisualState(0, 'RELAXED') }),
    );
    const high = buildFountainSceneModel(
      baseInput({ pressure: toPressureVisualState(100, 'HIGH_PRESSURE') }),
    );
    const geometryRelaxed = buildFountainGeometry(relaxed, VIEW);
    const geometryHigh = buildFountainGeometry(high, VIEW);
    expect(geometryHigh.column.topY).toBeLessThan(geometryRelaxed.column.topY);
    expect(geometryHigh.column.baseWidth).toBeGreaterThan(geometryRelaxed.column.baseWidth);
    // 展开点跟随柱顶
    expect(geometryHigh.crown.y).toBeLessThan(geometryRelaxed.crown.y);
    // V2 的平静档也保留约 60% 水柱高度，因此档位差异以清晰但不塌陷的 6% 画面高度为下限。
    expect(geometryRelaxed.column.topY - geometryHigh.column.topY).toBeGreaterThan(
      VIEW.height * 0.06,
    );
  });

  it('工作/生活密集状态会抬升并加粗对应水弧', () => {
    const workHeavy = buildFountainGeometry(
      buildFountainSceneModel(
        baseInput({
          totals: { sleepMinutes: 360, workMinutes: 900, lifeMinutes: 60, freeMinutes: 120 },
        }),
      ),
      VIEW,
    );
    const lifeHeavy = buildFountainGeometry(
      buildFountainSceneModel(
        baseInput({
          totals: { sleepMinutes: 360, workMinutes: 60, lifeMinutes: 900, freeMinutes: 120 },
        }),
      ),
      VIEW,
    );
    const stream = (geometry: typeof workHeavy, layer: 'MID' | 'FRONT') =>
      geometry.streams.find((item) => item.layer === layer && item.side === 'LEFT');
    expect(stream(workHeavy, 'MID')?.width ?? 0).toBeGreaterThan(
      stream(lifeHeavy, 'MID')?.width ?? 0,
    );
    expect(stream(lifeHeavy, 'FRONT')?.width ?? 0).toBeGreaterThan(
      stream(workHeavy, 'FRONT')?.width ?? 0,
    );
  });

  it('空状态仍生成完整水池与水弧几何', () => {
    const model = buildFountainSceneModel(
      baseInput({
        totals: { sleepMinutes: 480, workMinutes: 0, lifeMinutes: 0, freeMinutes: 960 },
        pressure: toPressureVisualState(0, 'RELAXED'),
      }),
    );
    const geometry = buildFountainGeometry(model, VIEW);
    expect(geometry.pool.rx).toBeGreaterThan(0);
    expect(geometry.streams).toHaveLength(12);
    expect(geometry.landingPoints).toHaveLength(12);
  });
});
