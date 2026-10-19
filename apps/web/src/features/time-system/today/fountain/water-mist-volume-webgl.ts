import * as THREE from 'three';

import type { FountainSceneModel } from './fountain-types.js';
import { mistVolumeFragmentShader, waterVertexShader } from './fountain-webgl-shaders.js';

export interface WebGLMistVolume {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly geometry: THREE.PlaneGeometry;
}

export const createWebGLMistVolume = (): WebGLMistVolume => {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: waterVertexShader,
    fragmentShader: mistVolumeFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uMist: { value: 0.3 },
      uEnergy: { value: 0.5 },
      uWarmth: { value: 0.1 },
      uPaused: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return { mesh, material, geometry };
};

export const updateWebGLMistVolume = (
  mist: WebGLMistVolume,
  model: FountainSceneModel,
  qualityScale = 1,
): void => {
  mist.material.uniforms.uMist = {
    value: Math.min(1, (model.pressure.mistDensity + model.domain.mistBoost * 0.35) * qualityScale),
  };
  mist.material.uniforms.uEnergy = { value: model.pressure.glowIntensity };
  mist.material.uniforms.uWarmth = { value: model.lighting.warmth };
};

export const setWebGLMistVolumeTime = (
  mist: WebGLMistVolume,
  time: number,
  paused: boolean,
): void => {
  mist.material.uniforms.uTime = { value: time };
  mist.material.uniforms.uPaused = { value: paused ? 1 : 0 };
};
