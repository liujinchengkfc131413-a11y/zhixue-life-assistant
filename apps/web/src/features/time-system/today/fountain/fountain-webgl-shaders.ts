export const waterVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const waterFragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uPoolTexture;
  uniform sampler2D uSceneTexture;
  uniform sampler2D uDepthTexture;
  uniform float uHasSceneCapture;
  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uDistortion;
  uniform float uReflection;
  uniform float uEnergy;
  uniform float uWarmth;
  varying vec2 vUv;

  void main() {
    vec2 center = vec2(0.5, 0.665);
    vec2 radius = vec2(0.445, 0.105);
    vec2 poolUv = (vUv - center) / radius;
    float radial = length(poolUv);
    float edge = 1.0 - smoothstep(0.86, 1.0, radial);
    if (edge <= 0.001) discard;

    float speed = 0.3 + uWaveSpeed * 1.1;
    float waveA = sin(vUv.x * 62.0 + uTime * speed * 2.2 + vUv.y * 18.0);
    float waveB = cos(vUv.x * 37.0 - uTime * speed * 1.6 - vUv.y * 41.0);
    float waveC = sin((vUv.x + vUv.y) * 91.0 + uTime * speed * 0.8);
    vec2 distortion = vec2(waveA + waveC * 0.35, waveB + waveC * 0.24) *
      (0.0015 + uDistortion * 0.0065) * edge;
    vec2 refractedUv = clamp(vUv + distortion, 0.0, 1.0);
    vec4 poolSample = texture2D(uPoolTexture, refractedUv);
    vec4 sceneSample = texture2D(uSceneTexture, refractedUv);
    vec4 refracted = mix(poolSample, sceneSample, uHasSceneCapture);
    vec2 reflectedUv = vec2(refractedUv.x, clamp(center.y - (refractedUv.y - center.y), 0.0, 1.0));
    vec3 reflected = texture2D(uSceneTexture, reflectedUv).rgb;
    float sceneDepth = texture2D(uDepthTexture, refractedUv).r;

    vec3 normal = normalize(vec3(
      (waveA - waveC) * (0.12 + uDistortion * 0.3),
      (waveB + waveC) * (0.08 + uDistortion * 0.22),
      1.0
    ));
    vec3 viewDirection = normalize(vec3(poolUv.x * 0.34, poolUv.y * 0.58, 1.0));
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.6);
    float radialDepth = clamp(1.0 - radial, 0.0, 1.0);
    float depth = mix(radialDepth, radialDepth * (0.72 + (1.0 - sceneDepth) * 0.28), uHasSceneCapture);
    float caustic = pow(max(0.0, waveA * waveB), 2.0) * (0.18 + uEnergy * 0.24);

    vec3 coolWater = vec3(0.22, 0.75, 0.67);
    vec3 warmLight = vec3(1.0, 0.91, 0.66);
    vec3 lightColor = mix(coolWater, warmLight, uWarmth * 0.34);
    vec3 color = mix(refracted.rgb, reflected, fresnel * uReflection * 0.26 * uHasSceneCapture);
    color = mix(color, lightColor, 0.09 + fresnel * 0.34 + caustic * 0.2);
    color += lightColor * (fresnel * (0.22 + uReflection * 0.34) + depth * caustic * 0.18);
    float alpha = edge * (0.08 + uReflection * 0.1 + fresnel * 0.18 + caustic * 0.08);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const particleVertexShader = /* glsl */ `
  precision highp float;
  attribute float aSeed;
  attribute float aKind;
  attribute float aLanding;
  attribute float aRate;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uFlowSpeed;
  uniform float uSpread;
  uniform float uMist;
  uniform float uPointScale;
  uniform float uPaused;
  varying float vAlpha;
  varying float vKind;

  float hash(float value) { return fract(sin(value * 127.1) * 43758.5453); }

  void main() {
    float time = mix(uTime, 0.82, uPaused);
    float phaseOffset = hash(aSeed * 19.31 + 2.7);
    float phase = fract(phaseOffset + time * (0.055 + uFlowSpeed * 0.14) * aRate);
    float side = mod(floor(aSeed * 997.0), 2.0) < 1.0 ? -1.0 : 1.0;
    vec2 position2d;
    float size;

    if (aKind < 0.5) {
      float reach = abs(aLanding) + uSpread * 0.08;
      position2d.x = mix(side * 0.055, aLanding, phase) +
        (hash(aSeed + 4.0) - 0.5) * (0.018 + phase * 0.022);
      position2d.y = -0.31 + sin(phase * 3.14159265) *
        (0.3 + uEnergy * 0.25 + reach * 0.08) - phase * 0.018;
      vAlpha = sin(phase * 3.14159265) * (0.32 + uEnergy * 0.62);
      size = 1.8 + hash(aSeed + 8.0) * 3.2 + uEnergy * 2.0;
    } else if (aKind < 1.5) {
      float rise = fract(phase * 0.72 + hash(aSeed + 11.0) + time * 0.0061 * aRate);
      position2d.x = (hash(aSeed + 2.0) - 0.5) * (0.36 + uSpread * 0.52);
      position2d.y = -0.34 + rise * (0.22 + uMist * 0.2);
      vAlpha = (1.0 - rise) * (0.08 + uMist * 0.22);
      size = 4.0 + hash(aSeed + 5.0) * 7.0 + uMist * 6.0;
    } else {
      float splash = fract(phase * (1.35 + hash(aSeed + 17.0) * 0.72) + hash(aSeed + 3.0));
      position2d.x = aLanding + (hash(aSeed + 9.0) - 0.5) * splash * 0.08;
      position2d.y = -0.31 + sin(splash * 3.14159265) * (0.025 + uEnergy * 0.075);
      vAlpha = sin(splash * 3.14159265) * (0.18 + uEnergy * 0.6);
      size = 1.0 + hash(aSeed + 13.0) * 2.8;
    }

    vKind = aKind;
    gl_Position = vec4(position2d, 0.0, 1.0);
    gl_PointSize = size * uPointScale;
  }
`;

export const particleFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vKind;
  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float distanceToCenter = length(centered);
    if (distanceToCenter > 0.5) discard;
    float softness = vKind > 0.5 && vKind < 1.5 ? 1.8 : 4.5;
    float alpha = pow(max(0.0, 1.0 - distanceToCenter * 2.0), softness) * vAlpha;
    vec3 color = vKind > 0.5 && vKind < 1.5
      ? vec3(0.72, 0.95, 0.88)
      : vec3(0.94, 1.0, 0.96);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const jetVertexShader = /* glsl */ `
  precision highp float;
  attribute float aProgress;
  attribute float aEdge;
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uTurbulence;
  uniform float uPaused;
  varying float vProgress;
  varying float vEdge;
  void main() {
    float time = mix(uTime, 0.75, uPaused);
    vec3 displaced = position;
    float envelope = sin(aProgress * 3.14159265);
    float slowBend = sin(time * (0.72 + uFlowSpeed * 0.4) + aProgress * 5.4);
    float fineBreakup = sin(time * (2.1 + uFlowSpeed) - aProgress * 19.0);
    displaced.x += (slowBend * 0.72 + fineBreakup * 0.28) *
      envelope * (0.0025 + uTurbulence * 0.014);
    vProgress = aProgress;
    vEdge = aEdge;
    gl_Position = vec4(displaced, 1.0);
  }
`;

export const jetFragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uHighlight;
  uniform float uWarmth;
  varying float vProgress;
  varying float vEdge;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    float core = pow(max(0.0, 1.0 - abs(vEdge)), 0.44);
    float edgeSheen = pow(max(0.0, abs(vEdge)), 5.0) * 0.42;
    float flow = 0.5 + 0.5 * sin(vProgress * 46.0 - uTime * 5.4 + vEdge * 2.2);
    float breakup = noise(vec2(vProgress * 22.0 - uTime * 1.7, vEdge * 3.2));
    vec3 cool = vec3(0.58, 0.96, 0.88);
    vec3 warm = vec3(1.0, 0.91, 0.68);
    vec3 color = mix(cool, warm, uWarmth * 0.28);
    color += vec3(0.88, 1.0, 0.96) * (flow * 0.3 + edgeSheen) * uHighlight;
    float base = 0.42 + uEnergy * 0.34;
    float crownFade = 1.0 - smoothstep(0.94, 1.0, vProgress);
    float brokenEdge = smoothstep(0.12, 0.5, breakup + core * 0.45);
    float alpha = (base + flow * 0.22) * (core + edgeSheen) * brokenEdge *
      smoothstep(0.0, 0.045, vProgress) * crownFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const mistVolumeFragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uMist;
  uniform float uEnergy;
  uniform float uWarmth;
  uniform float uPaused;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float time = mix(uTime, 0.64, uPaused);
    vec2 pool = (vUv - vec2(0.5, 0.665)) / vec2(0.43, 0.12);
    vec2 crown = (vUv - vec2(0.5, 0.38 - uEnergy * 0.07)) / vec2(0.19 + uEnergy * 0.1, 0.11);
    float poolMask = 1.0 - smoothstep(0.22, 1.0, length(pool));
    float crownMask = 1.0 - smoothstep(0.18, 1.0, length(crown));
    float vapor = noise(vUv * vec2(8.0, 15.0) + vec2(time * 0.08, -time * 0.05));
    vapor = mix(vapor, noise(vUv * vec2(17.0, 23.0) - time * 0.04), 0.42);
    float density = (poolMask * 0.62 + crownMask * (0.28 + uEnergy * 0.42)) *
      smoothstep(0.24, 0.86, vapor) * (0.12 + uMist * 0.34);
    vec3 cool = vec3(0.58, 0.88, 0.82);
    vec3 warm = vec3(0.95, 0.82, 0.62);
    gl_FragColor = vec4(mix(cool, warm, uWarmth * 0.28), density);
  }
`;

export const arcVertexShader = /* glsl */ `
  precision highp float;
  attribute float aProgress;
  attribute float aEdge;
  attribute float aSeed;
  attribute float aOpacity;
  attribute float aWarmth;
  uniform float uTime;
  uniform float uWarp;
  uniform float uSpeed;
  uniform float uPaused;
  varying float vProgress;
  varying float vEdge;
  varying float vOpacity;
  varying float vWarmth;
  varying float vSeed;
  void main() {
    float time = mix(uTime, 0.64, uPaused);
    float rate = 0.72 + fract(aSeed * 13.731 + 0.17) * 0.63;
    vec3 displaced = position;
    float envelope = sin(aProgress * 3.14159265);
    displaced.x += sin(aSeed * 17.0 + aProgress * 14.0 + time * uSpeed * rate) *
      envelope * uWarp * 0.006;
    displaced.y += cos(aSeed * 11.0 + aProgress * 18.0 - time * uSpeed * (0.47 + rate * 0.31)) *
      envelope * uWarp * 0.003;
    vProgress = aProgress;
    vEdge = aEdge;
    vOpacity = aOpacity;
    vWarmth = aWarmth;
    vSeed = aSeed;
    gl_Position = vec4(displaced, 1.0);
  }
`;

export const arcFragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uHighlight;
  varying float vProgress;
  varying float vEdge;
  varying float vOpacity;
  varying float vWarmth;
  varying float vSeed;
  void main() {
    float core = pow(max(0.0, 1.0 - abs(vEdge)), 0.7);
    float rate = 0.76 + fract(vSeed * 17.17 + 0.31) * 0.58;
    float moving = pow(max(0.0, sin(vProgress * (43.0 + vSeed * 19.0) - uTime * 4.6 * rate + vSeed * 9.7)), 7.0);
    float ends = smoothstep(0.0, 0.045, vProgress) * smoothstep(0.0, 0.05, 1.0 - vProgress);
    vec3 cool = vec3(0.46, 0.92, 0.83);
    vec3 warm = vec3(1.0, 0.78, 0.5);
    vec3 color = mix(cool, warm, vWarmth * 0.36);
    color += vec3(0.9, 1.0, 0.97) * moving * uHighlight * 0.42;
    float alpha = vOpacity * ends * core * (0.34 + moving * 0.5);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const splashVertexShader = /* glsl */ `
  precision highp float;
  attribute float aSeed;
  attribute float aLanding;
  attribute float aPoolY;
  attribute float aRate;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uPointScale;
  uniform float uPaused;
  varying float vAlpha;
  void main() {
    float time = mix(uTime, 0.58, uPaused);
    float phase = fract(aSeed * 1.6180339 + time * (0.22 + uEnergy * 0.34) * aRate);
    float direction = fract(aSeed * 97.13) < 0.5 ? -1.0 : 1.0;
    float spread = (0.018 + fract(aSeed * 43.7) * 0.045) * direction;
    vec2 p = vec2(
      aLanding + spread * phase,
      -0.32 + sin(phase * 3.14159265) * (0.025 + uEnergy * 0.085) - phase * 0.012
    );
    vAlpha = sin(phase * 3.14159265) * (0.28 + uEnergy * 0.62);
    gl_Position = vec4(p, 0.0, 1.0);
    gl_PointSize = (1.7 + fract(aSeed * 71.0) * 3.6 + uEnergy * 2.0) * uPointScale;
  }
`;

export const rippleVertexShader = /* glsl */ `
  precision highp float;
  attribute float aSeed;
  attribute float aLanding;
  attribute float aPoolY;
  attribute float aRate;
  uniform float uTime;
  uniform float uStrength;
  uniform float uPointScale;
  uniform float uPaused;
  varying float vAlpha;
  varying float vPhase;
  void main() {
    float time = mix(uTime, 0.71, uPaused);
    float phase = fract(aSeed * 1.41421356 + time * (0.085 + uStrength * 0.08) * aRate);
    vec2 p = vec2(aLanding, aPoolY);
    gl_Position = vec4(p, 0.0, 1.0);
    gl_PointSize = (18.0 + phase * (46.0 + uStrength * 34.0)) * uPointScale;
    vAlpha = sin(phase * 3.14159265) * (0.07 + uStrength * 0.21);
    vPhase = phase;
  }
`;

export const rippleFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vPhase;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    p.y *= 3.8;
    float radius = length(p);
    float ringWidth = mix(0.075, 0.035, vPhase);
    float ring = 1.0 - smoothstep(ringWidth, ringWidth + 0.024, abs(radius - 0.42));
    float edge = 1.0 - smoothstep(0.46, 0.5, radius);
    float alpha = ring * edge * vAlpha;
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(0.72, 1.0, 0.91, alpha * 0.68);
  }
`;

export const lightingFragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uKeyLight;
  uniform float uAmbientLight;
  uniform float uReflectedLight;
  uniform float uWarmth;
  uniform float uPaused;
  varying vec2 vUv;
  void main() {
    float time = mix(uTime, 0.63, uPaused);
    float breath = 0.965 + sin(time * 0.37) * 0.018 + sin(time * 0.173 + 1.2) * 0.012;
    vec2 keyUv = (vUv - vec2(0.5, 0.43)) / vec2(0.24, 0.48);
    float key = (1.0 - smoothstep(0.08, 1.0, length(keyUv))) * uKeyLight * breath;
    vec2 reflectionUv = (vUv - vec2(0.5, 0.665)) / vec2(0.42, 0.105);
    float reflection = (1.0 - smoothstep(0.16, 1.0, length(reflectionUv))) * uReflectedLight;
    float ambient = (1.0 - smoothstep(0.0, 0.78, distance(vUv, vec2(0.5, 0.46)))) *
      uAmbientLight * 0.18;
    vec3 cool = vec3(0.43, 0.92, 0.82);
    vec3 warm = vec3(1.0, 0.86, 0.62);
    vec3 color = mix(cool, warm, uWarmth * 0.42);
    float alpha = key * 0.09 + reflection * 0.07 + ambient * 0.04;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const splashFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float distanceToCenter = length(p);
    if (distanceToCenter > 0.5) discard;
    float alpha = pow(max(0.0, 1.0 - distanceToCenter * 2.0), 3.8) * vAlpha;
    gl_FragColor = vec4(0.9, 1.0, 0.97, alpha);
  }
`;
