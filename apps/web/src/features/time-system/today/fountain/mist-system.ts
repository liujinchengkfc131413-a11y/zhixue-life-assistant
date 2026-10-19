import type { FountainSceneModel } from './fountain-types.js';

export interface MistRenderProfile {
  readonly density: number;
  readonly riseSpeed: number;
  readonly spread: number;
}

export const resolveMistProfile = (model: FountainSceneModel): MistRenderProfile => ({
  density: Math.min(1, model.pressure.mistDensity + model.domain.mistBoost * 0.34),
  riseSpeed: 0.018 + model.domain.mistBoost * 0.028,
  spread: 0.2 + model.domain.breathingSpace * 0.18,
});
