import type { FountainSceneModel } from './fountain-types.js';

export interface WaterJetRenderProfile {
  readonly breatheSpeed: number;
  readonly breatheAmount: number;
  readonly swayAmount: number;
  readonly crownParticleCount: number;
}

export const resolveWaterJetProfile = (
  model: FountainSceneModel,
  lowPerformance: boolean,
): WaterJetRenderProfile => ({
  breatheSpeed: 1.1 * model.domain.rhythm,
  breatheAmount: 0.018 + (1 - model.domain.jetStability) * 0.04,
  swayAmount: 0.06 + (1 - model.domain.jetStability) * 0.18,
  crownParticleCount: lowPerformance
    ? 24
    : Math.round(model.pressure.particleBudget * 0.18 * model.domain.flowScale),
});
