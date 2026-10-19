import * as THREE from 'three';

import type { FountainSceneModel } from './fountain-types.js';
import { particleFragmentShader, particleVertexShader } from './fountain-webgl-shaders.js';
import { resolveMistProfile } from './mist-system.js';

const MAX_GPU_PARTICLES = 1_000;

export interface WebGLParticleSystem {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
}

export const createWebGLParticleSystem = (): WebGLParticleSystem => {
  const positions = new Float32Array(MAX_GPU_PARTICLES * 3);
  const seeds = new Float32Array(MAX_GPU_PARTICLES);
  const kinds = new Float32Array(MAX_GPU_PARTICLES);
  const landing = new Float32Array(MAX_GPU_PARTICLES);
  const rates = new Float32Array(MAX_GPU_PARTICLES);
  for (let index = 0; index < MAX_GPU_PARTICLES; index += 1) {
    seeds[index] = (index * 0.61803398875) % 1;
    const bucket = index % 10;
    kinds[index] = bucket < 6 ? 0 : bucket < 8 ? 1 : 2;
    rates[index] = 0.71 + ((index * 0.754877666) % 1) * 0.67;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute('aLanding', new THREE.BufferAttribute(landing, 1));
  geometry.setAttribute('aRate', new THREE.BufferAttribute(rates, 1));
  geometry.setDrawRange(0, 350);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0.35 },
      uFlowSpeed: { value: 0.55 },
      uSpread: { value: 0.5 },
      uMist: { value: 0.2 },
      uPointScale: { value: 1 },
      uPaused: { value: 0 },
    },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return { points, material };
};

export const updateWebGLParticleSystem = (
  system: WebGLParticleSystem,
  model: FountainSceneModel,
  dropletScale: number,
  mistScale = 1,
): number => {
  const mist = resolveMistProfile(model);
  const landing = system.points.geometry.getAttribute('aLanding') as THREE.BufferAttribute;
  const landingPoints = model.pool.activeLandingPoints;
  for (let index = 0; index < MAX_GPU_PARTICLES; index += 1) {
    const point = landingPoints[index % Math.max(1, landingPoints.length)];
    const fallback = (index % 2 === 0 ? -1 : 1) * (0.22 + (index % 7) * 0.055);
    landing.setX(index, (point?.x ?? fallback) * 0.76);
  }
  landing.needsUpdate = true;
  system.material.uniforms.uEnergy = { value: model.pressure.score / 100 };
  system.material.uniforms.uFlowSpeed = {
    value: model.pressure.flowSpeed * model.domain.rhythm,
  };
  system.material.uniforms.uSpread = { value: model.pressure.crownSpread };
  system.material.uniforms.uMist = { value: mist.density * mistScale };
  const budget = Math.max(120, Math.round(model.pressure.particleBudget * dropletScale));
  system.points.geometry.setDrawRange(0, budget);
  return budget;
};

export const setWebGLParticleTime = (
  system: WebGLParticleSystem,
  time: number,
  paused: boolean,
): void => {
  system.material.uniforms.uTime = { value: time };
  system.material.uniforms.uPaused = { value: paused ? 1 : 0 };
};
