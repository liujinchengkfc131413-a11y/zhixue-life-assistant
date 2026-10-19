import * as THREE from 'three';

import type { FountainSceneModel } from './fountain-types.js';
import { rippleFragmentShader, rippleVertexShader } from './fountain-webgl-shaders.js';

const MAX_RIPPLES = 96;

export interface WebGLWaterRipples {
  readonly points: THREE.Points;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
}

export const createWebGLWaterRipples = (): WebGLWaterRipples => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(MAX_RIPPLES * 3), 3),
  );
  const seeds = new Float32Array(MAX_RIPPLES);
  const landings = new Float32Array(MAX_RIPPLES);
  const poolY = new Float32Array(MAX_RIPPLES);
  const rates = new Float32Array(MAX_RIPPLES);
  for (let index = 0; index < MAX_RIPPLES; index += 1) {
    seeds[index] = (index * 0.61803398875) % 1;
    rates[index] = 0.64 + ((index * 0.41421356237) % 1) * 0.82;
  }
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aLanding', new THREE.BufferAttribute(landings, 1));
  geometry.setAttribute('aPoolY', new THREE.BufferAttribute(poolY, 1));
  geometry.setAttribute('aRate', new THREE.BufferAttribute(rates, 1));
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: rippleVertexShader,
    fragmentShader: rippleFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0.35 },
      uPointScale: { value: 1 },
      uPaused: { value: 0 },
    },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 1;
  return { points, geometry, material };
};

export const updateWebGLWaterRipples = (
  ripples: WebGLWaterRipples,
  model: FountainSceneModel,
  qualityScale: number,
): number => {
  const landingPoints = model.pool.activeLandingPoints;
  const landingAttribute = ripples.geometry.getAttribute('aLanding') as THREE.BufferAttribute;
  const poolYAttribute = ripples.geometry.getAttribute('aPoolY') as THREE.BufferAttribute;
  const visibleLandingCount = Math.max(1, landingPoints.length);
  const fullBudget = Math.min(MAX_RIPPLES, visibleLandingCount * 3);
  const budget = Math.min(
    MAX_RIPPLES,
    Math.max(8, Math.round(fullBudget * Math.max(0.45, qualityScale))),
  );
  for (let index = 0; index < MAX_RIPPLES; index += 1) {
    const point = landingPoints[index % visibleLandingCount];
    const fallback = (index % 2 === 0 ? -1 : 1) * (0.22 + (index % 5) * 0.09);
    landingAttribute.setX(index, (point?.x ?? fallback) * 0.76);
    const layerY = point?.layer === 'BACK' ? -0.292 : point?.layer === 'MID' ? -0.318 : -0.342;
    poolYAttribute.setX(index, layerY + (((index * 0.381966) % 1) - 0.5) * 0.009);
  }
  landingAttribute.needsUpdate = true;
  poolYAttribute.needsUpdate = true;
  ripples.geometry.setDrawRange(0, budget);
  ripples.material.uniforms.uStrength = {
    value: model.pool.rippleStrength * (0.72 + model.pressure.spray * 0.28),
  };
  return budget;
};

export const setWebGLWaterRippleTime = (
  ripples: WebGLWaterRipples,
  time: number,
  paused: boolean,
): void => {
  ripples.material.uniforms.uTime = { value: time };
  ripples.material.uniforms.uPaused = { value: paused ? 1 : 0 };
};
