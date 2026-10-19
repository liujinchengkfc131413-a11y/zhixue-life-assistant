import * as THREE from 'three';

import type { FountainSceneModel } from './fountain-types.js';
import { jetFragmentShader, jetVertexShader } from './fountain-webgl-shaders.js';

const SEGMENTS = 48;

export interface WebGLWaterJet {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly geometry: THREE.BufferGeometry;
}

export const createWebGLWaterJet = (): WebGLWaterJet => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const progress = new Float32Array((SEGMENTS + 1) * 2);
  const edge = new Float32Array((SEGMENTS + 1) * 2);
  const indices: number[] = [];
  for (let index = 0; index <= SEGMENTS; index += 1) {
    const offset = index * 2;
    progress[offset] = index / SEGMENTS;
    progress[offset + 1] = index / SEGMENTS;
    edge[offset] = -1;
    edge[offset + 1] = 1;
    if (index < SEGMENTS)
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1));
  geometry.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: jetVertexShader,
    fragmentShader: jetFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: 0.7 },
      uTurbulence: { value: 0.2 },
      uEnergy: { value: 0.4 },
      uHighlight: { value: 0.7 },
      uWarmth: { value: 0.1 },
      uPaused: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  return { geometry, material, mesh };
};

export const updateWebGLWaterJet = (jet: WebGLWaterJet, model: FountainSceneModel): void => {
  const position = jet.geometry.getAttribute('position') as THREE.BufferAttribute;
  const baseY = -0.31;
  const topY = 0.34 + model.pressure.columnHeight * 0.56;
  const baseWidth = 0.046 + model.pressure.columnWidth * 0.066;
  const topWidth = 0.018 + model.pressure.columnWidth * 0.03;
  for (let index = 0; index <= SEGMENTS; index += 1) {
    const progress = index / SEGMENTS;
    const y = baseY + (topY - baseY) * progress;
    const width =
      THREE.MathUtils.lerp(baseWidth, topWidth, progress) *
      (1 + Math.sin(progress * Math.PI * 5) * 0.045) *
      (1 + Math.sin(progress * Math.PI) * model.pressure.turbulence * 0.08) *
      (progress > 0.94 ? Math.pow((1 - progress) / 0.06, 0.72) : 1);
    position.setXYZ(index * 2, -width, y, 0);
    position.setXYZ(index * 2 + 1, width, y, 0);
  }
  position.needsUpdate = true;
  jet.material.uniforms.uFlowSpeed = { value: model.pressure.flowSpeed };
  jet.material.uniforms.uTurbulence = { value: model.pressure.turbulence };
  jet.material.uniforms.uEnergy = { value: model.pressure.glowIntensity };
  jet.material.uniforms.uHighlight = { value: model.pressure.highlightIntensity };
  jet.material.uniforms.uWarmth = { value: model.domain.warmth };
};

export const setWebGLWaterJetTime = (jet: WebGLWaterJet, time: number, paused: boolean): void => {
  jet.material.uniforms.uTime = { value: time };
  jet.material.uniforms.uPaused = { value: paused ? 1 : 0 };
};
