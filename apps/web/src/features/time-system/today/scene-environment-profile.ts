import type { TodayTimeState } from './today-scene-state.js';

export interface SceneEnvironmentProfile {
  readonly sceneBrightness: number;
  readonly sceneContrast: number;
  readonly temperatureColor: string;
  readonly temperatureOpacity: number;
  readonly overlayOpacity: number;
  readonly vignetteOpacity: number;
  readonly readabilityGradientTopOpacity: number;
  readonly readabilityGradientBottomOpacity: number;
  readonly transitionDurationMs: number;
}

const profile = (value: SceneEnvironmentProfile): SceneEnvironmentProfile => Object.freeze(value);

export const SCENE_ENVIRONMENT_PROFILES: Readonly<Record<TodayTimeState, SceneEnvironmentProfile>> =
  Object.freeze({
    morning: profile({
      sceneBrightness: 1.04,
      sceneContrast: 0.97,
      temperatureColor: '205 232 229',
      temperatureOpacity: 0.035,
      overlayOpacity: 0.88,
      vignetteOpacity: 0.04,
      readabilityGradientTopOpacity: 0.09,
      readabilityGradientBottomOpacity: 0.08,
      transitionDurationMs: 5000,
    }),
    day: profile({
      sceneBrightness: 1,
      sceneContrast: 1,
      temperatureColor: '255 255 255',
      temperatureOpacity: 0,
      overlayOpacity: 1,
      vignetteOpacity: 0.05,
      readabilityGradientTopOpacity: 0.11,
      readabilityGradientBottomOpacity: 0.1,
      transitionDurationMs: 5000,
    }),
    sunset: profile({
      sceneBrightness: 0.96,
      sceneContrast: 1,
      temperatureColor: '224 157 102',
      temperatureOpacity: 0.065,
      overlayOpacity: 0.96,
      vignetteOpacity: 0.065,
      readabilityGradientTopOpacity: 0.12,
      readabilityGradientBottomOpacity: 0.11,
      transitionDurationMs: 5000,
    }),
    night: profile({
      sceneBrightness: 0.82,
      sceneContrast: 1.03,
      temperatureColor: '20 55 66',
      temperatureOpacity: 0.12,
      overlayOpacity: 1,
      vignetteOpacity: 0.12,
      readabilityGradientTopOpacity: 0.2,
      readabilityGradientBottomOpacity: 0.18,
      transitionDurationMs: 5000,
    }),
  });

export const getSceneEnvironmentProfile = (timeState: TodayTimeState): SceneEnvironmentProfile =>
  SCENE_ENVIRONMENT_PROFILES[timeState];
