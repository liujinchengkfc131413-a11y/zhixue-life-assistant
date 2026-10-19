import type { CSSProperties } from 'react';
import { getSceneEnvironmentProfile } from './scene-environment-profile.js';
import type { TodayTimeState } from './today-scene-state.js';

type TodaySceneEnvironmentStyle = CSSProperties & {
  readonly '--today-scene-brightness': number;
  readonly '--today-scene-contrast': number;
  readonly '--today-scene-temperature-color': string;
  readonly '--today-scene-temperature-opacity': number;
  readonly '--today-scene-environment-opacity': number;
  readonly '--today-scene-vignette-opacity': number;
  readonly '--today-scene-readability-top-opacity': number;
  readonly '--today-scene-readability-bottom-opacity': number;
  readonly '--today-scene-environment-transition-ms': string;
};

export const getTodaySceneEnvironmentStyle = (
  timeState: TodayTimeState,
): TodaySceneEnvironmentStyle => {
  const profile = getSceneEnvironmentProfile(timeState);
  return {
    '--today-scene-brightness': profile.sceneBrightness,
    '--today-scene-contrast': profile.sceneContrast,
    '--today-scene-temperature-color': profile.temperatureColor,
    '--today-scene-temperature-opacity': profile.temperatureOpacity,
    '--today-scene-environment-opacity': profile.overlayOpacity,
    '--today-scene-vignette-opacity': profile.vignetteOpacity,
    '--today-scene-readability-top-opacity': profile.readabilityGradientTopOpacity,
    '--today-scene-readability-bottom-opacity': profile.readabilityGradientBottomOpacity,
    '--today-scene-environment-transition-ms': `${String(profile.transitionDurationMs)}ms`,
  };
};

export const TodaySceneEnvironment = ({ timeState }: { readonly timeState: TodayTimeState }) => (
  <div
    className="today-scene__environment-overlay"
    data-today-scene-layer="environment-overlay"
    data-time-state={timeState}
    aria-hidden="true"
  />
);
