import type { FountainSceneModel } from './fountain-types.js';
import { interpolateFountainVisualState } from './fountain-visual-state.js';

const clamp = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export const FOUNTAIN_STATE_TRANSITION_SECONDS = 0.7;

export const interpolateFountainSceneModel = (
  from: FountainSceneModel,
  to: FountainSceneModel,
  amount: number,
): FountainSceneModel => {
  const progress = clamp(amount);
  const targetSide = progress < 0.5 ? from : to;
  return {
    visualState: interpolateFountainVisualState(from.visualState, to.visualState, progress),
    pressure: {
      score: lerp(from.pressure.score, to.pressure.score, progress),
      level: targetSide.pressure.level,
      columnHeight: lerp(from.pressure.columnHeight, to.pressure.columnHeight, progress),
      columnWidth: lerp(from.pressure.columnWidth, to.pressure.columnWidth, progress),
      crownSpread: lerp(from.pressure.crownSpread, to.pressure.crownSpread, progress),
      turbulence: lerp(from.pressure.turbulence, to.pressure.turbulence, progress),
      spray: lerp(from.pressure.spray, to.pressure.spray, progress),
      flowSpeed: lerp(from.pressure.flowSpeed, to.pressure.flowSpeed, progress),
      mistDensity: lerp(from.pressure.mistDensity, to.pressure.mistDensity, progress),
      glowIntensity: lerp(from.pressure.glowIntensity, to.pressure.glowIntensity, progress),
      highlightIntensity: lerp(
        from.pressure.highlightIntensity,
        to.pressure.highlightIntensity,
        progress,
      ),
      particleBudget: Math.round(
        lerp(from.pressure.particleBudget, to.pressure.particleBudget, progress),
      ),
    },
    domain: {
      area: targetSide.domain.area,
      streamFocus: lerp(from.domain.streamFocus, to.domain.streamFocus, progress),
      jetStability: lerp(from.domain.jetStability, to.domain.jetStability, progress),
      rhythm: lerp(from.domain.rhythm, to.domain.rhythm, progress),
      warmth: lerp(from.domain.warmth, to.domain.warmth, progress),
      mistBoost: lerp(from.domain.mistBoost, to.domain.mistBoost, progress),
      flowScale: lerp(from.domain.flowScale, to.domain.flowScale, progress),
      breathingSpace: lerp(from.domain.breathingSpace, to.domain.breathingSpace, progress),
      rippleSoftness: lerp(from.domain.rippleSoftness, to.domain.rippleSoftness, progress),
    },
    lighting: {
      keyLight: lerp(from.lighting.keyLight, to.lighting.keyLight, progress),
      ambientLight: lerp(from.lighting.ambientLight, to.lighting.ambientLight, progress),
      reflectedLight: lerp(from.lighting.reflectedLight, to.lighting.reflectedLight, progress),
      warmth: lerp(from.lighting.warmth, to.lighting.warmth, progress),
    },
    streams: to.streams.map((stream, index) => {
      const previous = from.streams[index] ?? stream;
      return {
        ...stream,
        startY: lerp(previous.startY, stream.startY, progress),
        landX: lerp(previous.landX, stream.landX, progress),
        width: lerp(previous.width, stream.width, progress),
        opacity: lerp(previous.opacity, stream.opacity, progress),
        activity: lerp(previous.activity, stream.activity, progress),
      };
    }),
    pool: {
      calmness: lerp(from.pool.calmness, to.pool.calmness, progress),
      rippleStrength: lerp(from.pool.rippleStrength, to.pool.rippleStrength, progress),
      rippleFrequency: lerp(from.pool.rippleFrequency, to.pool.rippleFrequency, progress),
      waveSpeed: lerp(from.pool.waveSpeed, to.pool.waveSpeed, progress),
      reflectionIntensity: lerp(
        from.pool.reflectionIntensity,
        to.pool.reflectionIntensity,
        progress,
      ),
      distortion: lerp(from.pool.distortion, to.pool.distortion, progress),
      activeLandingPoints: to.pool.activeLandingPoints.map((point, index) => {
        const previous = from.pool.activeLandingPoints[index] ?? point;
        return {
          ...point,
          x: lerp(previous.x, point.x, progress),
          intensity: lerp(previous.intensity, point.intensity, progress),
        };
      }),
    },
    time: {
      nowMinute: lerp(from.time.nowMinute, to.time.nowMinute, progress),
      activeArea: targetSide.time.activeArea,
    },
    taskSignals: to.taskSignals,
  };
};
