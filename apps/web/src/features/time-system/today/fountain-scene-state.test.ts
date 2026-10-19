import { describe, expect, it } from 'vitest';
import { buildFountainSceneMediaState, getFountainSceneState } from './fountain-scene-state.js';

describe('getFountainSceneState', () => {
  it.each([
    [0, 'calm'],
    [10, 'calm'],
    [24, 'calm'],
    [25, 'balanced'],
    [35, 'balanced'],
    [49, 'balanced'],
    [50, 'busy'],
    [60, 'busy'],
    [74, 'busy'],
    [75, 'intense'],
    [85, 'intense'],
    [100, 'intense'],
  ] as const)('maps pressure %i to %s', (pressure, expected) => {
    expect(getFountainSceneState(pressure)).toBe(expected);
  });

  it('clamps values before mapping them', () => {
    expect(getFountainSceneState(-20)).toBe('calm');
    expect(getFountainSceneState(120)).toBe('intense');
  });

  it.each([
    [10, 'calm', 'fountain-balanced-loop-seamless.mp4'],
    [35, 'balanced', 'fountain-calm-loop-seamless.mp4'],
    [58, 'busy', 'fountain-intense-loop-seamless.mp4'],
    [85, 'intense', 'fountain-busy-loop-seamless.mp4'],
  ] as const)('maps pressure %i to %s using %s', (pressure, expectedState, expectedVideo) => {
    const model = buildFountainSceneMediaState(pressure);
    expect(model).toMatchObject({ state: expectedState, pressure });
    expect(model.videoSrc).toContain(expectedVideo);
  });
});
