import type { FountainSceneModel } from './fountain-types.js';

export type FountainBlindCode = 'A' | 'B' | 'C';
type FountainBlindState = 'balanced' | 'busy' | 'calm';

const BLIND_STATE_BY_CODE: Readonly<Record<FountainBlindCode, FountainBlindState>> = {
  A: 'balanced',
  B: 'busy',
  C: 'calm',
};

export const parseFountainBlindCode = (search: string): FountainBlindCode | undefined => {
  const value = new URLSearchParams(search).get('fountainBlind')?.toUpperCase();
  return value === 'A' || value === 'B' || value === 'C' ? value : undefined;
};

/**
 * QA-only anonymous fountain states. The public URL exposes A/B/C rather than a semantic label,
 * so reviewers can judge the water silhouette before seeing the answer key.
 */
export const applyFountainBlindState = (
  model: FountainSceneModel,
  code: FountainBlindCode | undefined,
): FountainSceneModel => {
  if (code === undefined) return model;
  const state = BLIND_STATE_BY_CODE[code];
  const preset =
    state === 'calm'
      ? {
          score: 22,
          level: 'RELAXED' as const,
          columnHeight: 0.38,
          columnWidth: 0.32,
          crownSpread: 0.28,
          turbulence: 0.08,
          spray: 0.08,
          flowSpeed: 0.3,
          mistDensity: 0.2,
          glowIntensity: 0.4,
          highlightIntensity: 0.5,
          particleBudget: 220,
          calmness: 0.92,
          rippleStrength: 0.18,
          rippleFrequency: 0.18,
          waveSpeed: 0.24,
          reflectionIntensity: 0.42,
          distortion: 0.18,
          streamScale: 0.58,
        }
      : state === 'busy'
        ? {
            score: 88,
            level: 'HIGH_PRESSURE' as const,
            columnHeight: 0.96,
            columnWidth: 0.9,
            crownSpread: 0.9,
            turbulence: 0.88,
            spray: 0.94,
            flowSpeed: 1,
            mistDensity: 0.76,
            glowIntensity: 0.94,
            highlightIntensity: 1,
            particleBudget: 1000,
            calmness: 0.18,
            rippleStrength: 0.9,
            rippleFrequency: 0.9,
            waveSpeed: 0.92,
            reflectionIntensity: 0.9,
            distortion: 0.82,
            streamScale: 1,
          }
        : {
            score: 55,
            level: 'ELEVATED' as const,
            columnHeight: 0.68,
            columnWidth: 0.6,
            crownSpread: 0.58,
            turbulence: 0.36,
            spray: 0.38,
            flowSpeed: 0.66,
            mistDensity: 0.44,
            glowIntensity: 0.66,
            highlightIntensity: 0.72,
            particleBudget: 520,
            calmness: 0.62,
            rippleStrength: 0.52,
            rippleFrequency: 0.54,
            waveSpeed: 0.56,
            reflectionIntensity: 0.66,
            distortion: 0.46,
            streamScale: 0.8,
          };

  return {
    ...model,
    visualState: {
      ...model.visualState,
      profile: state === 'calm' ? 'CALM' : state === 'busy' ? 'INTENSE' : 'BALANCED',
      lowerProfile: state === 'calm' ? 'CALM' : state === 'busy' ? 'INTENSE' : 'BALANCED',
      upperProfile: state === 'calm' ? 'CALM' : state === 'busy' ? 'INTENSE' : 'BALANCED',
      blend: 0,
      mainJetHeight: preset.columnHeight,
      mainJetWidth: preset.columnWidth,
      streamDensity: preset.streamScale,
      streamSpread: preset.crownSpread,
      streamSpeed: preset.flowSpeed,
      dropletRate: preset.spray,
      mistDensity: preset.mistDensity,
      rippleStrength: preset.rippleStrength,
      lightingIntensity: preset.glowIntensity,
      stability: 1 - preset.turbulence,
    },
    pressure: {
      ...model.pressure,
      score: preset.score,
      level: preset.level,
      columnHeight: preset.columnHeight,
      columnWidth: preset.columnWidth,
      crownSpread: preset.crownSpread,
      turbulence: preset.turbulence,
      spray: preset.spray,
      flowSpeed: preset.flowSpeed,
      mistDensity: preset.mistDensity,
      glowIntensity: preset.glowIntensity,
      highlightIntensity: preset.highlightIntensity,
      particleBudget: preset.particleBudget,
    },
    streams: model.streams.map((stream) => ({
      ...stream,
      activity: Math.min(1, stream.activity * preset.streamScale),
      opacity: Math.min(1, stream.opacity * (0.55 + preset.streamScale * 0.45)),
      width: Math.min(1, stream.width * (0.7 + preset.streamScale * 0.3)),
    })),
    pool: {
      ...model.pool,
      calmness: preset.calmness,
      rippleStrength: preset.rippleStrength,
      rippleFrequency: preset.rippleFrequency,
      waveSpeed: preset.waveSpeed,
      reflectionIntensity: preset.reflectionIntensity,
      distortion: preset.distortion,
    },
  };
};

export const fountainBlindAnswer = (code: FountainBlindCode): FountainBlindState =>
  BLIND_STATE_BY_CODE[code];
