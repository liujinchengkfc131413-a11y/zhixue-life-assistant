import type { FountainSceneModel } from './fountain-types.js';

export interface LightingUniformProfile {
  readonly reflection: number;
  readonly energy: number;
  readonly warmth: number;
  readonly keyColor: readonly [number, number, number];
}

export const resolveLightingProfile = (model: FountainSceneModel): LightingUniformProfile => {
  const warmth = model.lighting.warmth;
  return {
    reflection: model.pool.reflectionIntensity,
    energy: model.pressure.score / 100,
    warmth,
    keyColor: [
      Math.round(214 + warmth * 34),
      Math.round(255 - warmth * 7),
      Math.round(235 - warmth * 38),
    ],
  };
};
