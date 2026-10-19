import { describe, expect, it } from 'vitest';

import { toPressureVisualState } from '../../pressure-visual-state.js';
import { buildFountainSceneModel } from './fountain-model.js';
import { createWebGLWaterArcs, updateWebGLWaterArcs } from './water-arc-webgl.js';
import { createWebGLWaterJet, updateWebGLWaterJet } from './water-jet-webgl.js';
import { createWebGLMistVolume, updateWebGLMistVolume } from './water-mist-volume-webgl.js';
import { createWebGLWaterSplash, updateWebGLWaterSplash } from './water-splash-webgl.js';

const model = buildFountainSceneModel({
  pressure: toPressureVisualState(82, 'HIGH_PRESSURE'),
  totals: { sleepMinutes: 420, workMinutes: 520, lifeMinutes: 180, freeMinutes: 320 },
  activeArea: 'WORK',
  nowMinute: 840,
  tasks: [],
});

describe('WebGL fountain water ownership', () => {
  it('builds a state-driven main jet ribbon', () => {
    const jet = createWebGLWaterJet();
    updateWebGLWaterJet(jet, model);
    const position = jet.geometry.getAttribute('position');

    expect(position.count).toBeGreaterThan(90);
    expect(position.getY(position.count - 1)).toBeGreaterThan(0.7);
    expect(jet.material.uniforms.uEnergy?.value).toBe(model.pressure.glowIntensity);
  });

  it('builds twelve state-driven arc ribbons', () => {
    const arcs = createWebGLWaterArcs();
    updateWebGLWaterArcs(arcs, model);
    const position = arcs.geometry.getAttribute('position');
    const visibleVertices = Array.from({ length: position.count }, (_, index) =>
      position.getY(index),
    ).filter((value) => value > -1).length;

    expect(model.streams).toHaveLength(12);
    expect(visibleVertices).toBe((32 + 1) * 2 * 12);
    expect(arcs.material.uniforms.uHighlight?.value).toBe(model.pressure.highlightIntensity);
  });

  it('allocates landing-point splash particles within the GPU budget', () => {
    const splash = createWebGLWaterSplash();
    const budget = updateWebGLWaterSplash(splash, model, 1);

    expect(budget).toBeGreaterThanOrEqual(24);
    expect(budget).toBeLessThanOrEqual(240);
    expect(splash.geometry.drawRange.count).toBe(budget);
  });

  it('drives the volumetric mist layer from pressure and domain state', () => {
    const mist = createWebGLMistVolume();
    updateWebGLMistVolume(mist, model);
    const highDensity = Number(mist.material.uniforms.uMist?.value);

    expect(mist.material.uniforms.uMist?.value).toBeGreaterThanOrEqual(model.pressure.mistDensity);
    updateWebGLMistVolume(mist, model, 0.68);
    expect(mist.material.uniforms.uMist?.value).toBeLessThan(highDensity);
    expect(mist.material.uniforms.uEnergy?.value).toBe(model.pressure.glowIntensity);
  });
});
