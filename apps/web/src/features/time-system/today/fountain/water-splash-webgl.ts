import * as THREE from 'three';

import type { FountainSceneModel } from './fountain-types.js';
import { splashFragmentShader, splashVertexShader } from './fountain-webgl-shaders.js';

const MAX_SPLASH_PARTICLES = 240;

export interface WebGLWaterSplash {
  readonly points: THREE.Points;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
}

export const createWebGLWaterSplash = (): WebGLWaterSplash => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(MAX_SPLASH_PARTICLES * 3), 3),
  );
  const seeds = new Float32Array(MAX_SPLASH_PARTICLES);
  const landing = new Float32Array(MAX_SPLASH_PARTICLES);
  const rates = new Float32Array(MAX_SPLASH_PARTICLES);
  for (let index = 0; index < MAX_SPLASH_PARTICLES; index += 1) {
    seeds[index] = index / MAX_SPLASH_PARTICLES;
    rates[index] = 0.68 + ((index * 0.569840291) % 1) * 0.79;
  }
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aLanding', new THREE.BufferAttribute(landing, 1));
  geometry.setAttribute('aRate', new THREE.BufferAttribute(rates, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: splashVertexShader,
    fragmentShader: splashFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0.4 },
      uPointScale: { value: 1 },
      uPaused: { value: 0 },
    },
  });
  geometry.setDrawRange(0, 0);
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 4;
  return { geometry, material, points };
};

export const updateWebGLWaterSplash = (
  splash: WebGLWaterSplash,
  model: FountainSceneModel,
  qualityScale: number,
): number => {
  const landings = splash.geometry.getAttribute('aLanding') as THREE.BufferAttribute;
  const points = model.pool.activeLandingPoints;
  const budget = Math.min(
    MAX_SPLASH_PARTICLES,
    Math.max(24, Math.round(model.pressure.particleBudget * 0.24 * qualityScale)),
  );
  for (let index = 0; index < MAX_SPLASH_PARTICLES; index += 1) {
    const point = points[index % Math.max(1, points.length)];
    const normalized = point?.x ?? (index % 2 === 0 ? -1 : 1) * (0.24 + (index % 7) * 0.055);
    landings.setX(index, normalized * 0.76);
  }
  landings.needsUpdate = true;
  splash.geometry.setDrawRange(0, budget);
  splash.material.uniforms.uEnergy = { value: model.pressure.spray };
  return budget;
};

export const setWebGLWaterSplashTime = (
  splash: WebGLWaterSplash,
  time: number,
  paused: boolean,
): void => {
  splash.material.uniforms.uTime = { value: time };
  splash.material.uniforms.uPaused = { value: paused ? 1 : 0 };
};
