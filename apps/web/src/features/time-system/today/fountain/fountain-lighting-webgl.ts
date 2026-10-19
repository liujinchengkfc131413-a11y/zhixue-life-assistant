import * as THREE from 'three';

import type { FountainSceneModel } from './fountain-types.js';
import { lightingFragmentShader, waterVertexShader } from './fountain-webgl-shaders.js';

export interface WebGLFountainLighting {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.ShaderMaterial;
}

export const createWebGLFountainLighting = (): WebGLFountainLighting => {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: waterVertexShader,
    fragmentShader: lightingFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uKeyLight: { value: 0.5 },
      uAmbientLight: { value: 0.35 },
      uReflectedLight: { value: 0.4 },
      uWarmth: { value: 0.1 },
      uPaused: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 6;
  return { mesh, geometry, material };
};

export const updateWebGLFountainLighting = (
  lighting: WebGLFountainLighting,
  model: FountainSceneModel,
): void => {
  lighting.material.uniforms.uKeyLight = { value: model.lighting.keyLight };
  lighting.material.uniforms.uAmbientLight = { value: model.lighting.ambientLight };
  lighting.material.uniforms.uReflectedLight = { value: model.lighting.reflectedLight };
  lighting.material.uniforms.uWarmth = { value: model.lighting.warmth };
};

export const setWebGLFountainLightingTime = (
  lighting: WebGLFountainLighting,
  time: number,
  paused: boolean,
): void => {
  lighting.material.uniforms.uTime = { value: time };
  lighting.material.uniforms.uPaused = { value: paused ? 1 : 0 };
};
