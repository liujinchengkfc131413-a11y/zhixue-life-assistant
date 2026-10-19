import * as THREE from 'three';

import type { FountainSceneModel } from './fountain-types.js';
import { waterFragmentShader, waterVertexShader } from './fountain-webgl-shaders.js';
import { resolveLightingProfile } from './lighting.js';

export interface WebGLWaterSurface {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
}

export const createWebGLWaterSurface = (poolTexture: THREE.Texture): WebGLWaterSurface => {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
      uPoolTexture: { value: poolTexture },
      uSceneTexture: { value: poolTexture },
      uDepthTexture: { value: poolTexture },
      uHasSceneCapture: { value: 0 },
      uTime: { value: 0 },
      uWaveSpeed: { value: 0.45 },
      uDistortion: { value: 0.2 },
      uReflection: { value: 0.5 },
      uEnergy: { value: 0.35 },
      uWarmth: { value: 0.1 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.renderOrder = 0;
  return { material, mesh };
};

export const setWebGLWaterSceneCapture = (
  material: THREE.ShaderMaterial,
  colorTexture: THREE.Texture,
  depthTexture: THREE.DepthTexture,
): void => {
  material.uniforms.uSceneTexture = { value: colorTexture };
  material.uniforms.uDepthTexture = { value: depthTexture };
  material.uniforms.uHasSceneCapture = { value: 1 };
};

export const updateWebGLWaterSurface = (
  material: THREE.ShaderMaterial,
  model: FountainSceneModel,
): void => {
  const lighting = resolveLightingProfile(model);
  material.uniforms.uWaveSpeed = { value: model.pool.waveSpeed };
  material.uniforms.uDistortion = { value: model.pool.distortion };
  material.uniforms.uReflection = { value: lighting.reflection };
  material.uniforms.uEnergy = { value: lighting.energy };
  material.uniforms.uWarmth = { value: lighting.warmth };
};

export const setWebGLWaterTime = (material: THREE.ShaderMaterial, time: number): void => {
  material.uniforms.uTime = { value: time };
};
