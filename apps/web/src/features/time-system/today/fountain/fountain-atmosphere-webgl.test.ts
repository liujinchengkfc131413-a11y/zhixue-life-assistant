import { describe, expect, it } from 'vitest';

import { toPressureVisualState } from '../../pressure-visual-state.js';
import {
  createWebGLFountainLighting,
  updateWebGLFountainLighting,
} from './fountain-lighting-webgl.js';
import { buildFountainSceneModel } from './fountain-model.js';
import { createWebGLParticleSystem, updateWebGLParticleSystem } from './water-particle-webgl.js';
import { createWebGLWaterRipples, updateWebGLWaterRipples } from './water-ripple-webgl.js';
import { createWebGLWaterSplash, updateWebGLWaterSplash } from './water-splash-webgl.js';

const model = buildFountainSceneModel({
  pressure: toPressureVisualState(35, 'COMFORTABLE'),
  totals: { sleepMinutes: 480, workMinutes: 300, lifeMinutes: 90, freeMinutes: 570 },
  activeArea: 'FREE',
  nowMinute: 900,
  tasks: [],
});

const uniqueValues = (values: ArrayLike<number>) =>
  new Set(Array.from(values, (value) => value.toFixed(4)));

describe('Today V3 Phase 5 WebGL atmosphere', () => {
  it('binds droplets and splash to real stream landing points with varied cycle rates', () => {
    const particles = createWebGLParticleSystem();
    const splash = createWebGLWaterSplash();

    expect(updateWebGLParticleSystem(particles, model, 1)).toBeGreaterThan(100);
    expect(updateWebGLWaterSplash(splash, model, 1)).toBeGreaterThan(20);

    const particleLandings = particles.points.geometry.getAttribute('aLanding').array;
    const particleRates = particles.points.geometry.getAttribute('aRate').array;
    const splashLandings = splash.geometry.getAttribute('aLanding').array;
    const splashRates = splash.geometry.getAttribute('aRate').array;
    expect(uniqueValues(particleLandings).size).toBeGreaterThanOrEqual(8);
    expect(uniqueValues(splashLandings).size).toBeGreaterThanOrEqual(8);
    expect(uniqueValues(particleRates).size).toBeGreaterThan(100);
    expect(uniqueValues(splashRates).size).toBeGreaterThan(100);

    particles.points.geometry.dispose();
    particles.material.dispose();
    splash.geometry.dispose();
    splash.material.dispose();
  });

  it('creates staggered causal ripples for the active landing points', () => {
    const ripples = createWebGLWaterRipples();
    const budget = updateWebGLWaterRipples(ripples, model, 1);
    const landings = ripples.geometry.getAttribute('aLanding').array;
    const poolDepths = ripples.geometry.getAttribute('aPoolY').array;
    const rates = ripples.geometry.getAttribute('aRate').array;

    expect(budget).toBeGreaterThanOrEqual(model.pool.activeLandingPoints.length);
    expect(uniqueValues(landings).size).toBeGreaterThanOrEqual(8);
    expect(uniqueValues(poolDepths).size).toBeGreaterThanOrEqual(8);
    expect(uniqueValues(rates).size).toBeGreaterThan(50);
    expect(ripples.material.uniforms.uStrength?.value).toBeGreaterThan(0);

    ripples.geometry.dispose();
    ripples.material.dispose();
  });

  it('reduces droplets before ripples while retaining both effects', () => {
    const particles = createWebGLParticleSystem();
    const ripples = createWebGLWaterRipples();
    const highParticles = updateWebGLParticleSystem(particles, model, 1, 1);
    const highRipples = updateWebGLWaterRipples(ripples, model, 1);
    const lowParticles = updateWebGLParticleSystem(particles, model, 0.28, 0.68);
    const lowRipples = updateWebGLWaterRipples(ripples, model, 0.52);

    expect(lowParticles).toBeLessThan(highParticles);
    expect(lowRipples).toBeLessThan(highRipples);
    expect(lowParticles).toBeGreaterThan(0);
    expect(lowRipples).toBeGreaterThan(0);
    expect(particles.material.uniforms.uMist?.value).toBeLessThan(model.pressure.mistDensity);

    particles.points.geometry.dispose();
    particles.material.dispose();
    ripples.geometry.dispose();
    ripples.material.dispose();
  });

  it('maps the shared scene lighting model into key, ambient and reflected light', () => {
    const lighting = createWebGLFountainLighting();
    updateWebGLFountainLighting(lighting, model);

    expect(lighting.material.uniforms.uKeyLight?.value).toBe(model.lighting.keyLight);
    expect(lighting.material.uniforms.uAmbientLight?.value).toBe(model.lighting.ambientLight);
    expect(lighting.material.uniforms.uReflectedLight?.value).toBe(model.lighting.reflectedLight);
    expect(lighting.material.uniforms.uWarmth?.value).toBe(model.lighting.warmth);

    lighting.geometry.dispose();
    lighting.material.dispose();
  });
});
