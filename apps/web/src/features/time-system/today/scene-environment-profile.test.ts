import { describe, expect, it } from 'vitest';
import {
  SCENE_ENVIRONMENT_PROFILES,
  getSceneEnvironmentProfile,
} from './scene-environment-profile.js';

describe('SCENE_ENVIRONMENT_PROFILES', () => {
  it('defines one complete profile for every time state', () => {
    expect(Object.keys(SCENE_ENVIRONMENT_PROFILES)).toEqual(['morning', 'day', 'sunset', 'night']);

    for (const profile of Object.values(SCENE_ENVIRONMENT_PROFILES)) {
      expect(Object.keys(profile)).toEqual([
        'sceneBrightness',
        'sceneContrast',
        'temperatureColor',
        'temperatureOpacity',
        'overlayOpacity',
        'vignetteOpacity',
        'readabilityGradientTopOpacity',
        'readabilityGradientBottomOpacity',
        'transitionDurationMs',
      ]);
      expect(typeof profile.sceneBrightness).toBe('number');
      expect(typeof profile.sceneContrast).toBe('number');
      expect(profile.temperatureColor).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
      expect(typeof profile.temperatureOpacity).toBe('number');
      expect(typeof profile.overlayOpacity).toBe('number');
      expect(typeof profile.vignetteOpacity).toBe('number');
      expect(typeof profile.readabilityGradientTopOpacity).toBe('number');
      expect(typeof profile.readabilityGradientBottomOpacity).toBe('number');
      expect(typeof profile.transitionDurationMs).toBe('number');
      expect(profile.transitionDurationMs).toBeGreaterThanOrEqual(3000);
      expect(profile.transitionDurationMs).toBeLessThanOrEqual(8000);
    }
  });

  it('uses day as the unfiltered V2 scene baseline', () => {
    expect(getSceneEnvironmentProfile('day')).toMatchObject({
      sceneBrightness: 1,
      sceneContrast: 1,
      temperatureOpacity: 0,
      overlayOpacity: 1,
    });
  });

  it('keeps the other states as restrained adjustments around day', () => {
    const morning = getSceneEnvironmentProfile('morning');
    const sunset = getSceneEnvironmentProfile('sunset');
    const night = getSceneEnvironmentProfile('night');

    expect(morning.sceneBrightness).toBeGreaterThan(1);
    expect(morning.sceneContrast).toBeLessThan(1);
    expect(sunset.sceneBrightness).toBeLessThan(1);
    expect(night.sceneBrightness).toBeLessThan(sunset.sceneBrightness);

    for (const profile of [morning, sunset, night]) {
      expect(profile.sceneBrightness).toBeGreaterThanOrEqual(0.8);
      expect(profile.sceneBrightness).toBeLessThanOrEqual(1.05);
      expect(profile.sceneContrast).toBeGreaterThanOrEqual(0.95);
      expect(profile.sceneContrast).toBeLessThanOrEqual(1.05);
      expect(profile.temperatureOpacity).toBeGreaterThan(0);
      expect(profile.temperatureOpacity).toBeLessThanOrEqual(0.12);
      expect(profile.vignetteOpacity).toBeLessThanOrEqual(0.12);
      expect(profile.readabilityGradientTopOpacity).toBeLessThanOrEqual(0.2);
      expect(profile.readabilityGradientBottomOpacity).toBeLessThanOrEqual(0.18);
    }
  });

  it('freezes the profile map and its entries', () => {
    expect(Object.isFrozen(SCENE_ENVIRONMENT_PROFILES)).toBe(true);
    expect(Object.values(SCENE_ENVIRONMENT_PROFILES).every((value) => Object.isFrozen(value))).toBe(
      true,
    );
  });
});
