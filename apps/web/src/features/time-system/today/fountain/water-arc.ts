import type { FountainSceneModel } from './fountain-types.js';

export interface WaterArcRenderProfile {
  readonly warpScale: number;
  readonly cycleSpeed: number;
  readonly focus: number;
}

export const resolveWaterArcProfile = (model: FountainSceneModel): WaterArcRenderProfile => ({
  warpScale: 1.08 - model.domain.jetStability * 0.46,
  cycleSpeed: model.domain.rhythm,
  focus: model.domain.streamFocus,
});
