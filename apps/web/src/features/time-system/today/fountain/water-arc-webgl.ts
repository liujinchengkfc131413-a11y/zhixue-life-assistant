import * as THREE from 'three';

import type { FountainSceneModel, FountainStreamParams } from './fountain-types.js';
import { arcFragmentShader, arcVertexShader } from './fountain-webgl-shaders.js';
import { resolveWaterArcProfile } from './water-arc.js';

const SEGMENTS = 32;
const MAX_STREAMS = 12;

export interface WebGLWaterArcs {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly geometry: THREE.BufferGeometry;
}

const quadratic = (start: THREE.Vector2, control: THREE.Vector2, end: THREE.Vector2, t: number) => {
  const inverse = 1 - t;
  return new THREE.Vector2(
    inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  );
};

const streamGeometry = (stream: FountainStreamParams, model: FountainSceneModel, index: number) => {
  const side = stream.side === 'LEFT' ? -1 : 1;
  const poolY = -0.32;
  const jetTop = 0.34 + model.pressure.columnHeight * 0.56;
  const start = new THREE.Vector2(
    side * (0.018 + stream.startY * 0.09),
    THREE.MathUtils.lerp(jetTop - 0.04, poolY + 0.34, stream.startY),
  );
  const end = new THREE.Vector2(side * stream.landX * 0.76, poolY);
  const roleLift =
    stream.role === 'PRIMARY_ARC' ? 0.37 : stream.role === 'MID_STREAM' ? 0.25 : 0.16;
  const depthLift = stream.layer === 'BACK' ? 0.035 : stream.layer === 'MID' ? 0.015 : 0;
  const control = new THREE.Vector2(
    THREE.MathUtils.lerp(start.x, end.x, 0.48) * (0.9 + model.domain.streamFocus * 0.1),
    Math.max(start.y, poolY) + roleLift + depthLift + stream.activity * 0.08,
  );
  const roleWidth = stream.role === 'PRIMARY_ARC' ? 1.55 : stream.role === 'MID_STREAM' ? 1 : 0.58;
  const width = (0.0035 + stream.width * 0.012) * roleWidth * (0.78 + stream.activity * 0.34);
  return { start, control, end, width, index };
};

export const createWebGLWaterArcs = (): WebGLWaterArcs => {
  const verticesPerStream = (SEGMENTS + 1) * 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(MAX_STREAMS * verticesPerStream * 3), 3),
  );
  for (const [name, array] of [
    ['aProgress', new Float32Array(MAX_STREAMS * verticesPerStream)],
    ['aEdge', new Float32Array(MAX_STREAMS * verticesPerStream)],
    ['aSeed', new Float32Array(MAX_STREAMS * verticesPerStream)],
    ['aOpacity', new Float32Array(MAX_STREAMS * verticesPerStream)],
    ['aWarmth', new Float32Array(MAX_STREAMS * verticesPerStream)],
  ] as const)
    geometry.setAttribute(name, new THREE.BufferAttribute(array, 1));
  const indices: number[] = [];
  for (let stream = 0; stream < MAX_STREAMS; stream += 1) {
    const base = stream * verticesPerStream;
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const offset = base + segment * 2;
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    }
  }
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: arcVertexShader,
    fragmentShader: arcFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWarp: { value: 0.25 },
      uSpeed: { value: 1 },
      uHighlight: { value: 0.7 },
      uPaused: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return { geometry, material, mesh };
};

export const updateWebGLWaterArcs = (arcs: WebGLWaterArcs, model: FountainSceneModel): void => {
  const verticesPerStream = (SEGMENTS + 1) * 2;
  const position = arcs.geometry.getAttribute('position') as THREE.BufferAttribute;
  const progress = arcs.geometry.getAttribute('aProgress') as THREE.BufferAttribute;
  const edge = arcs.geometry.getAttribute('aEdge') as THREE.BufferAttribute;
  const seed = arcs.geometry.getAttribute('aSeed') as THREE.BufferAttribute;
  const opacity = arcs.geometry.getAttribute('aOpacity') as THREE.BufferAttribute;
  const warmth = arcs.geometry.getAttribute('aWarmth') as THREE.BufferAttribute;
  for (let streamIndex = 0; streamIndex < MAX_STREAMS; streamIndex += 1) {
    const stream = model.streams[streamIndex];
    for (let segment = 0; segment <= SEGMENTS; segment += 1) {
      const vertex = streamIndex * verticesPerStream + segment * 2;
      const t = segment / SEGMENTS;
      if (stream === undefined) {
        position.setXYZ(vertex, 0, -2, 0);
        position.setXYZ(vertex + 1, 0, -2, 0);
        continue;
      }
      const curve = streamGeometry(stream, model, streamIndex);
      const point = quadratic(curve.start, curve.control, curve.end, t);
      const ahead = quadratic(curve.start, curve.control, curve.end, Math.min(1, t + 0.01));
      const tangent = ahead.sub(point).normalize();
      const normal = new THREE.Vector2(-tangent.y, tangent.x).multiplyScalar(curve.width);
      position.setXYZ(vertex, point.x - normal.x, point.y - normal.y, 0);
      position.setXYZ(vertex + 1, point.x + normal.x, point.y + normal.y, 0);
      progress.setX(vertex, t);
      progress.setX(vertex + 1, t);
      edge.setX(vertex, -1);
      edge.setX(vertex + 1, 1);
      seed.setX(vertex, streamIndex / MAX_STREAMS);
      seed.setX(vertex + 1, streamIndex / MAX_STREAMS);
      opacity.setX(vertex, stream.opacity);
      opacity.setX(vertex + 1, stream.opacity);
      const warm = stream.colorHint === 'LIFE' ? 1 : model.domain.warmth;
      warmth.setX(vertex, warm);
      warmth.setX(vertex + 1, warm);
    }
  }
  for (const attribute of [position, progress, edge, seed, opacity, warmth])
    attribute.needsUpdate = true;
  const profile = resolveWaterArcProfile(model);
  arcs.material.uniforms.uWarp = { value: profile.warpScale * model.pressure.turbulence };
  arcs.material.uniforms.uSpeed = { value: profile.cycleSpeed };
  arcs.material.uniforms.uHighlight = { value: model.pressure.highlightIntensity };
};

export const setWebGLWaterArcTime = (arcs: WebGLWaterArcs, time: number, paused: boolean): void => {
  arcs.material.uniforms.uTime = { value: time };
  arcs.material.uniforms.uPaused = { value: paused ? 1 : 0 };
};
