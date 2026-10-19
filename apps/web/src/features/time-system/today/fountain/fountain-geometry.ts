import type { FountainSceneModel } from './fountain-types.js';

/**
 * 今日喷泉几何（T3）。
 * 把 FountainSceneModel 映射为渲染坐标系（viewBox）中的几何：
 * 水池椭圆、梯形水柱、展开点、贝塞尔水弧路径、落水点。
 * 几何只依赖模型与视口尺寸，输出确定。
 */

export interface FountainGeometry {
  readonly pool: { cx: number; cy: number; rx: number; ry: number };
  readonly column: {
    readonly baseY: number;
    readonly topY: number;
    readonly topX: number;
    readonly baseWidth: number;
    readonly topWidth: number;
  };
  readonly crown: { x: number; y: number };
  readonly streams: readonly {
    index: number;
    role: 'PRIMARY_ARC' | 'MID_STREAM' | 'FINE_STREAM';
    layer: 'BACK' | 'MID' | 'FRONT';
    side: 'LEFT' | 'RIGHT';
    path: string;
    width: number;
    opacity: number;
    activity: number;
    colorHint: 'WORK' | 'LIFE' | 'NEUTRAL';
  }[];
  readonly landingPoints: readonly { x: number; y: number; intensity: number }[];
}

export interface FountainViewport {
  readonly width: number;
  readonly height: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

const fmt = (value: number): string => String(Math.round(value * 100) / 100);

export const buildFountainGeometry = (
  model: FountainSceneModel,
  view: FountainViewport,
): FountainGeometry => {
  const cx = view.width / 2;
  // 与 V2 环境资产的水面和中央喷口对齐：水面约在画面 76%，柱顶约在 8%–11%。
  const cy = view.height * 0.76;
  const rx = view.width * 0.365;
  const ry = view.height * 0.068;

  // 水柱的可用高度覆盖低压到高压的明显轮廓差异，同时守住资产中的喷口与画面顶边。
  const columnMaxTopY = view.height * 0.055;
  const columnMinTopY = view.height * 0.235;
  const topY = columnMinTopY - model.pressure.columnHeight * (columnMinTopY - columnMaxTopY);
  const baseWidth = 22 + model.pressure.columnWidth * 42;
  const topWidth = 8 + model.pressure.columnWidth * 20;
  const crownY = topY + view.height * 0.016;

  const streams = model.streams.map((stream, index) => {
    const side = stream.side === 'LEFT' ? -1 : 1;
    const ring = Math.floor(index / 2);
    const startRadius =
      rx * (0.018 + stream.startY * 0.11 + ring * 0.005 + model.pressure.crownSpread * 0.016);
    const startX = cx + side * startRadius;
    const startY = crownY + stream.startY * (cy - crownY);
    const landX = cx + side * stream.landX * rx;
    const baseLift =
      stream.layer === 'BACK'
        ? -view.height * 0.19
        : stream.layer === 'MID'
          ? -view.height * 0.155
          : -view.height * 0.12;
    const lift =
      baseLift * (0.86 + stream.activity * 0.5 + model.pressure.crownSpread * 0.2) -
      (ring % 2) * view.height * 0.012;
    const controlY = Math.min(startY, (startY + cy) / 2 + lift);
    const path = `M ${fmt(startX)} ${fmt(startY)} Q ${fmt((startX + landX) / 2)} ${fmt(controlY)} ${fmt(landX)} ${fmt(cy)}`;
    return {
      index,
      role: stream.role,
      layer: stream.layer,
      side: stream.side,
      path,
      width: round(4 + stream.width * 18),
      opacity: stream.opacity,
      activity: stream.activity,
      colorHint: stream.colorHint,
    };
  });

  const landingPoints = model.pool.activeLandingPoints.map((point) => ({
    x: round(cx + point.x * rx),
    y: round(cy),
    intensity: point.intensity,
  }));

  return {
    pool: { cx, cy, rx, ry },
    column: {
      baseY: cy,
      topY: round(topY),
      topX: cx,
      baseWidth: round(baseWidth),
      topWidth: round(topWidth),
    },
    crown: { x: cx, y: round(crownY) },
    streams,
    landingPoints,
  };
};
