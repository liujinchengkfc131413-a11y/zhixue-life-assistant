import balancedVideo from '../../../assets/today/scene-video/fountain-balanced-loop-seamless.mp4';
import busyVideo from '../../../assets/today/scene-video/fountain-busy-loop-seamless.mp4';
import calmVideo from '../../../assets/today/scene-video/fountain-calm-loop-seamless.mp4';
import intenseVideo from '../../../assets/today/scene-video/fountain-intense-loop-seamless.mp4';

export type FountainSceneState = 'calm' | 'balanced' | 'busy' | 'intense';

export interface FountainSceneMediaState {
  readonly state: FountainSceneState;
  readonly pressure: number;
  readonly videoSrc: string;
}

export const FOUNTAIN_SCENE_VIDEO_SOURCES: Readonly<Record<FountainSceneState, string>> = {
  calm: balancedVideo,
  balanced: calmVideo,
  busy: intenseVideo,
  intense: busyVideo,
};

const clampPressure = (pressure: number): number =>
  Math.min(100, Math.max(0, Math.round(Number.isFinite(pressure) ? pressure : 0)));

export const getFountainSceneState = (pressure: number): FountainSceneState => {
  const score = clampPressure(pressure);
  if (score <= 24) return 'calm';
  if (score <= 49) return 'balanced';
  if (score <= 74) return 'busy';
  return 'intense';
};

export const buildFountainSceneMediaState = (pressure: number): FountainSceneMediaState => {
  const score = clampPressure(pressure);
  const state = getFountainSceneState(score);
  return { state, pressure: score, videoSrc: FOUNTAIN_SCENE_VIDEO_SOURCES[state] };
};
