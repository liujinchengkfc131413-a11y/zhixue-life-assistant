import type { FountainGeometry } from './fountain-geometry.js';
import type { FountainSceneModel } from './fountain-types.js';

export interface FountainCanvasFrame {
  readonly ctx: CanvasRenderingContext2D;
  readonly geometry: FountainGeometry;
  readonly model: FountainSceneModel;
  readonly time: number;
  readonly deltaMs: number;
  readonly reducedMotion: boolean;
  readonly lowPerformance: boolean;
  readonly width: number;
  readonly height: number;
}

export const WATER_COLORS = {
  WORK: { base: '#72c9bf', light: '#e5fff7' },
  LIFE: { base: '#a8d6c8', light: '#fff5db' },
  NEUTRAL: { base: '#bfe8dd', light: '#f4fffc' },
} as const;

export const parseFountainPath = (path: string): number[] =>
  (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

export const withAlpha = (hex: string, alpha: number): string => {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${String(red)}, ${String(green)}, ${String(blue)}, ${String(Math.min(1, Math.max(0, alpha)))})`;
};

export const quadraticPoint = (
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  progress: number,
) => {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * startX + 2 * inverse * progress * controlX + progress * progress * endX,
    y: inverse * inverse * startY + 2 * inverse * progress * controlY + progress * progress * endY,
  };
};
