import * as THREE from 'three';

import {
  FOUNTAIN_DEGRADATION_ORDER,
  FountainPerformanceMonitor,
  performanceMatrixRow,
  type FountainQualityTier,
} from './fountain-performance.js';
import {
  FOUNTAIN_STATE_TRANSITION_SECONDS,
  interpolateFountainSceneModel,
} from './fountain-scene-transition.js';
import type { FountainSceneModel } from './fountain-types.js';
import {
  createWebGLFountainLighting,
  setWebGLFountainLightingTime,
  updateWebGLFountainLighting,
  type WebGLFountainLighting,
} from './fountain-lighting-webgl.js';
import {
  createWebGLWaterArcs,
  setWebGLWaterArcTime,
  updateWebGLWaterArcs,
  type WebGLWaterArcs,
} from './water-arc-webgl.js';
import {
  createWebGLWaterJet,
  setWebGLWaterJetTime,
  updateWebGLWaterJet,
  type WebGLWaterJet,
} from './water-jet-webgl.js';
import {
  createWebGLParticleSystem,
  setWebGLParticleTime,
  updateWebGLParticleSystem,
  type WebGLParticleSystem,
} from './water-particle-webgl.js';
import {
  createWebGLWaterSurface,
  setWebGLWaterSceneCapture,
  setWebGLWaterTime,
  updateWebGLWaterSurface,
} from './water-surface-webgl.js';
import {
  createWebGLWaterSplash,
  setWebGLWaterSplashTime,
  updateWebGLWaterSplash,
  type WebGLWaterSplash,
} from './water-splash-webgl.js';
import {
  createWebGLMistVolume,
  setWebGLMistVolumeTime,
  updateWebGLMistVolume,
  type WebGLMistVolume,
} from './water-mist-volume-webgl.js';
import {
  createWebGLWaterRipples,
  setWebGLWaterRippleTime,
  updateWebGLWaterRipples,
  type WebGLWaterRipples,
} from './water-ripple-webgl.js';

let webglMountSequence = 0;

export class FountainWebGLRenderer {
  private renderer: THREE.WebGLRenderer | undefined;
  private scene: THREE.Scene | undefined;
  private camera: THREE.OrthographicCamera | undefined;
  private waterMaterial: THREE.ShaderMaterial | undefined;
  private waterMesh: THREE.Mesh | undefined;
  private particleMaterial: THREE.ShaderMaterial | undefined;
  private particles: THREE.Points | undefined;
  private particleSystem: WebGLParticleSystem | undefined;
  private waterJet: WebGLWaterJet | undefined;
  private waterArcs: WebGLWaterArcs | undefined;
  private waterSplash: WebGLWaterSplash | undefined;
  private waterRipples: WebGLWaterRipples | undefined;
  private mistVolume: WebGLMistVolume | undefined;
  private lightingLayer: WebGLFountainLighting | undefined;
  private poolTexture: THREE.Texture | undefined;
  private captureTarget: THREE.WebGLRenderTarget | undefined;
  private captureScene: THREE.Scene | undefined;
  private captureCamera: THREE.OrthographicCamera | undefined;
  private captureMaterial: THREE.MeshBasicMaterial | undefined;
  private captureGeometry: THREE.PlaneGeometry | undefined;
  private model: FountainSceneModel | undefined;
  private displayedModel: FountainSceneModel | undefined;
  private transitionFrom: FountainSceneModel | undefined;
  private transitionStartedAt = 0;
  private raf = 0;
  private time = 0;
  private lastFrame = 0;
  private reducedMotion = false;
  private qualityTier: FountainQualityTier = 'high';
  private qualityCeiling: FountainQualityTier = 'high';
  private visible = true;
  private reportedAtmosphereSecond = -1;
  private resizeObserver: ResizeObserver | undefined;
  private resizeFrame = 0;
  private resizeCount = 0;
  private readonly performanceMonitor: FountainPerformanceMonitor;
  private readonly mountToken: string;

  public constructor(
    private readonly host: HTMLElement,
    private readonly poolTextureUrl: string,
    private readonly onQualityChange?: (tier: FountainQualityTier) => void,
    private readonly options: { readonly geometryOnly?: boolean } = {},
  ) {
    this.mountToken = String(++webglMountSequence);
    this.host.dataset.webglMountToken = this.mountToken;
    this.performanceMonitor = new FountainPerformanceMonitor(
      'high',
      (snapshot) => {
        const matrix = performanceMatrixRow(this.qualityTier);
        this.host.dataset.fpsP50 = snapshot.fpsP50.toFixed(1);
        this.host.dataset.fpsP95 = snapshot.fpsP95.toFixed(1);
        this.host.dataset.frameP95 = snapshot.frameTimeP95.toFixed(1);
        this.host.dataset.performanceSamples = String(snapshot.sampleCount);
        this.host.dataset.performanceTargetFpsP95 = String(matrix.targetFpsP95);
        this.host.dataset.performanceMaxFrameP95 = String(matrix.maxFrameTimeP95);
        this.host.dataset.performanceMatrixStatus =
          snapshot.fpsP95 >= matrix.targetFpsP95 && snapshot.frameTimeP95 <= matrix.maxFrameTimeP95
            ? 'pass'
            : 'fail';
      },
      (tier) => {
        this.setQualityTier(tier);
      },
    );
  }

  public async mount(): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.className = 'fountain-webgl-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    this.camera.position.z = 1;
    this.poolTexture = await new THREE.TextureLoader().loadAsync(this.poolTextureUrl);
    this.poolTexture.colorSpace = THREE.SRGBColorSpace;
    this.poolTexture.minFilter = THREE.LinearFilter;
    this.poolTexture.magFilter = THREE.LinearFilter;

    this.captureTarget = new THREE.WebGLRenderTarget(768, 512, {
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.captureTarget.depthTexture = new THREE.DepthTexture(768, 512, THREE.UnsignedShortType);
    this.captureScene = new THREE.Scene();
    this.captureCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    this.captureCamera.position.z = 1;
    this.captureMaterial = new THREE.MeshBasicMaterial({ map: this.poolTexture });
    this.captureGeometry = new THREE.PlaneGeometry(2, 2);
    this.captureScene.add(new THREE.Mesh(this.captureGeometry, this.captureMaterial));
    this.renderSceneCapture();

    if (!this.options.geometryOnly) {
      const waterSurface = createWebGLWaterSurface(this.poolTexture);
      this.waterMaterial = waterSurface.material;
      this.waterMesh = waterSurface.mesh;
      this.scene.add(waterSurface.mesh);
      setWebGLWaterSceneCapture(
        waterSurface.material,
        this.captureTarget.texture,
        this.captureTarget.depthTexture,
      );
      this.mistVolume = createWebGLMistVolume();
      this.scene.add(this.mistVolume.mesh);
      this.waterRipples = createWebGLWaterRipples();
      this.scene.add(this.waterRipples.points);
      this.lightingLayer = createWebGLFountainLighting();
      this.scene.add(this.lightingLayer.mesh);
    }
    this.waterArcs = createWebGLWaterArcs();
    this.scene.add(this.waterArcs.mesh);
    this.waterJet = createWebGLWaterJet();
    this.scene.add(this.waterJet.mesh);
    if (!this.options.geometryOnly) {
      this.waterSplash = createWebGLWaterSplash();
      this.scene.add(this.waterSplash.points);
      const particleSystem = createWebGLParticleSystem();
      this.particleSystem = particleSystem;
      this.particleMaterial = particleSystem.material;
      this.particles = particleSystem.points;
      this.scene.add(particleSystem.points);
    }
    if (this.host.dataset.webglMountToken !== this.mountToken) {
      this.destroy();
      throw new Error('WebGL mount superseded');
    }
    this.host.replaceChildren(canvas);
    this.host.dataset.webglState = 'running';
    this.host.dataset.webglMode = this.options.geometryOnly ? 'geometry' : 'full';
    this.host.dataset.webglPhase = this.options.geometryOnly ? '4' : '5';
    this.host.dataset.webglOptics = 'render-target-reflection,refraction,depth-texture';
    this.resize();
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeFrame !== 0) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        this.resize();
      });
    });
    this.resizeObserver.observe(this.host);
    this.visible = document.visibilityState === 'visible';
    this.lastFrame = performance.now();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.raf = requestAnimationFrame(this.tick);
  }

  public render(model: FountainSceneModel): void {
    this.model = model;
    if (this.displayedModel === undefined || this.reducedMotion) {
      this.displayedModel = model;
      this.transitionFrom = undefined;
      this.applyModel(model);
      if (this.reducedMotion) this.drawFrame();
      return;
    }
    this.transitionFrom = this.displayedModel;
    this.transitionStartedAt = this.time;
    this.host.dataset.visualTransition = 'active';
  }

  private applyModel(model: FountainSceneModel): void {
    const matrix = performanceMatrixRow(this.qualityTier);
    if (this.waterMaterial !== undefined) updateWebGLWaterSurface(this.waterMaterial, model);
    if (this.waterJet !== undefined) updateWebGLWaterJet(this.waterJet, model);
    if (this.waterArcs !== undefined) updateWebGLWaterArcs(this.waterArcs, model);
    if (this.mistVolume !== undefined)
      updateWebGLMistVolume(this.mistVolume, model, matrix.mistScale);
    if (this.lightingLayer !== undefined) updateWebGLFountainLighting(this.lightingLayer, model);
    const budget =
      this.particleSystem === undefined
        ? 0
        : updateWebGLParticleSystem(
            this.particleSystem,
            model,
            matrix.particleScale,
            matrix.mistScale,
          );
    this.host.dataset.gpuParticles = String(budget);
    const splashBudget =
      this.waterSplash === undefined
        ? 0
        : updateWebGLWaterSplash(this.waterSplash, model, matrix.particleScale);
    this.host.dataset.gpuSplashParticles = String(splashBudget);
    const rippleBudget =
      this.waterRipples === undefined
        ? 0
        : updateWebGLWaterRipples(this.waterRipples, model, matrix.rippleScale);
    this.host.dataset.gpuRipples = String(rippleBudget);
    this.host.dataset.webglWaterOwnership = this.options.geometryOnly
      ? 'main-jet,primary-arcs,mid-streams,fine-streams'
      : 'surface,main-jet,arc-streams,droplets,splash,ripple,mist,lighting,reflection';
    this.host.dataset.webglAtmosphere = this.options.geometryOnly
      ? 'disabled'
      : 'droplets,splash,ripple,mist,lighting,reflection';
    this.host.dataset.webglGeometryStreams = ['PRIMARY_ARC', 'MID_STREAM', 'FINE_STREAM']
      .map(
        (role) =>
          `${role.toLowerCase()}:${String(model.streams.filter((stream) => stream.role === role).length)}`,
      )
      .join(',');
    this.host.dataset.webglDomain = model.domain.area.toLowerCase();
    this.host.dataset.fountainProfile = model.visualState.profile.toLowerCase();
    this.host.dataset.fountainProfileBlend = model.visualState.blend.toFixed(3);
    this.host.dataset.fountainVisualState = [
      `jet:${model.visualState.mainJetHeight.toFixed(3)}`,
      `width:${model.visualState.mainJetWidth.toFixed(3)}`,
      `density:${model.visualState.streamDensity.toFixed(3)}`,
      `spread:${model.visualState.streamSpread.toFixed(3)}`,
      `speed:${model.visualState.streamSpeed.toFixed(3)}`,
      `droplets:${model.visualState.dropletRate.toFixed(3)}`,
      `mist:${model.visualState.mistDensity.toFixed(3)}`,
      `ripple:${model.visualState.rippleStrength.toFixed(3)}`,
      `light:${model.visualState.lightingIntensity.toFixed(3)}`,
      `warmth:${model.visualState.warmth.toFixed(3)}`,
      `stability:${model.visualState.stability.toFixed(3)}`,
    ].join(',');
    this.host.dataset.performanceDegradationOrder = FOUNTAIN_DEGRADATION_ORDER.join(',');
    this.host.dataset.performanceDropletScale = String(matrix.particleScale);
    this.host.dataset.performanceRippleScale = String(matrix.rippleScale);
    this.host.dataset.performanceMistScale = String(matrix.mistScale);
    this.host.dataset.performanceResolutionScale = String(matrix.resolutionScale);
    this.host.dataset.performanceMainFlow = 'preserved';
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (this.particleSystem !== undefined) {
      setWebGLParticleTime(this.particleSystem, this.time, enabled);
    }
    if (enabled) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.drawFrame();
      this.host.dataset.webglState = 'reduced-motion';
    } else {
      this.resume();
    }
  }

  public setLowPerformance(enabled: boolean): void {
    this.qualityCeiling = enabled ? 'low' : 'high';
    this.setQualityTier(this.qualityCeiling);
  }

  public setQualityTier(tier: FountainQualityTier): void {
    const rank: Record<FountainQualityTier, number> = { low: 0, balanced: 1, high: 2 };
    const effectiveTier = rank[tier] > rank[this.qualityCeiling] ? this.qualityCeiling : tier;
    if (
      this.qualityTier === effectiveTier &&
      this.host.dataset.webglPerformance === effectiveTier
    ) {
      return;
    }
    this.qualityTier = effectiveTier;
    this.performanceMonitor.setTier(effectiveTier);
    this.host.dataset.webglPerformance = effectiveTier;
    const matrix = performanceMatrixRow(effectiveTier);
    this.host.dataset.performanceTargetFpsP95 = String(matrix.targetFpsP95);
    this.host.dataset.performanceMaxFrameP95 = String(matrix.maxFrameTimeP95);
    this.host.dataset.performanceParticleScale = String(matrix.particleScale);
    this.host.dataset.performanceCaptureScale = String(matrix.captureScale);
    this.resize();
    const activeModel = this.displayedModel ?? this.model;
    if (activeModel !== undefined) this.applyModel(activeModel);
    this.onQualityChange?.(effectiveTier);
  }

  public destroy(): void {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.resizeFrame);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver?.disconnect();
    this.waterMesh?.geometry.dispose();
    this.waterMaterial?.dispose();
    this.waterJet?.geometry.dispose();
    this.waterJet?.material.dispose();
    this.waterArcs?.geometry.dispose();
    this.waterArcs?.material.dispose();
    this.waterSplash?.geometry.dispose();
    this.waterSplash?.material.dispose();
    this.waterRipples?.geometry.dispose();
    this.waterRipples?.material.dispose();
    this.mistVolume?.geometry.dispose();
    this.mistVolume?.material.dispose();
    this.lightingLayer?.geometry.dispose();
    this.lightingLayer?.material.dispose();
    this.particles?.geometry.dispose();
    this.particleMaterial?.dispose();
    this.poolTexture?.dispose();
    this.captureMaterial?.dispose();
    this.captureGeometry?.dispose();
    this.captureTarget?.depthTexture?.dispose();
    this.captureTarget?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    if (this.host.dataset.webglMountToken === this.mountToken) {
      this.host.dataset.webglState = 'destroyed';
    }
  }

  private resize(): void {
    const renderer = this.renderer;
    if (renderer === undefined) return;
    const rect = this.host.getBoundingClientRect();
    const matrix = performanceMatrixRow(this.qualityTier);
    const pixelRatio = Math.max(
      0.5,
      Math.min(window.devicePixelRatio || 1, 1.65) * matrix.resolutionScale,
    );
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    const captureScale = matrix.captureScale;
    this.captureTarget?.setSize(
      Math.max(256, Math.round(rect.width * captureScale)),
      Math.max(160, Math.round(rect.height * captureScale)),
    );
    this.renderSceneCapture();
    if (this.particleMaterial !== undefined) {
      this.particleMaterial.uniforms.uPointScale = { value: pixelRatio };
    }
    if (this.waterSplash !== undefined) {
      this.waterSplash.material.uniforms.uPointScale = { value: pixelRatio };
    }
    if (this.waterRipples !== undefined) {
      this.waterRipples.material.uniforms.uPointScale = { value: pixelRatio };
    }
    this.resizeCount += 1;
    this.host.dataset.webglResizeStrategy = 'request-animation-frame';
    this.host.dataset.webglResizeCount = String(this.resizeCount);
  }

  private readonly tick = (timestamp: number): void => {
    const delta = Math.min(100, timestamp - this.lastFrame);
    this.lastFrame = timestamp;
    if (!this.visible || this.reducedMotion) {
      this.raf = 0;
      return;
    }
    this.time += delta / 1000;
    const atmosphereSecond = Math.floor(this.time);
    if (!this.options.geometryOnly && atmosphereSecond !== this.reportedAtmosphereSecond) {
      this.reportedAtmosphereSecond = atmosphereSecond;
      this.host.dataset.atmosphereElapsed = String(atmosphereSecond);
    }
    this.performanceMonitor.push(delta);
    this.drawFrame();
    this.raf = requestAnimationFrame(this.tick);
  };

  private drawFrame(): void {
    if (this.transitionFrom !== undefined && this.model !== undefined) {
      const amount = Math.min(
        1,
        (this.time - this.transitionStartedAt) / FOUNTAIN_STATE_TRANSITION_SECONDS,
      );
      this.displayedModel = interpolateFountainSceneModel(this.transitionFrom, this.model, amount);
      this.applyModel(this.displayedModel);
      if (amount >= 1) {
        this.transitionFrom = undefined;
        this.host.dataset.visualTransition = 'stable';
      }
    }
    if (this.waterMaterial !== undefined) setWebGLWaterTime(this.waterMaterial, this.time);
    if (this.waterJet !== undefined)
      setWebGLWaterJetTime(this.waterJet, this.time, this.reducedMotion);
    if (this.waterArcs !== undefined)
      setWebGLWaterArcTime(this.waterArcs, this.time, this.reducedMotion);
    if (this.waterSplash !== undefined)
      setWebGLWaterSplashTime(this.waterSplash, this.time, this.reducedMotion);
    if (this.waterRipples !== undefined)
      setWebGLWaterRippleTime(this.waterRipples, this.time, this.reducedMotion);
    if (this.mistVolume !== undefined)
      setWebGLMistVolumeTime(this.mistVolume, this.time, this.reducedMotion);
    if (this.lightingLayer !== undefined)
      setWebGLFountainLightingTime(this.lightingLayer, this.time, this.reducedMotion);
    if (this.particleSystem !== undefined) {
      setWebGLParticleTime(this.particleSystem, this.time, this.reducedMotion);
    }
    if (this.scene !== undefined && this.camera !== undefined) {
      this.renderer?.render(this.scene, this.camera);
    }
  }

  private readonly onVisibilityChange = (): void => {
    this.visible = document.visibilityState === 'visible';
    if (this.visible) this.resume();
    else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.host.dataset.webglState = 'hidden';
    }
  };

  private renderSceneCapture(): void {
    if (
      this.renderer === undefined ||
      this.captureTarget === undefined ||
      this.captureScene === undefined ||
      this.captureCamera === undefined
    )
      return;
    this.renderer.setRenderTarget(this.captureTarget);
    this.renderer.clear();
    this.renderer.render(this.captureScene, this.captureCamera);
    this.renderer.setRenderTarget(null);
  }

  private resume(): void {
    if (!this.visible || this.reducedMotion || this.raf !== 0) return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    this.host.dataset.webglState = 'running';
  }
}
