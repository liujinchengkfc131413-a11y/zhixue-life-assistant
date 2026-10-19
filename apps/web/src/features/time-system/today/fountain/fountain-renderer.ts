import { drawCanvasArcStreams } from './fountain-canvas-arcs.js';
import { drawCanvasLighting, drawCanvasMist } from './fountain-canvas-atmosphere.js';
import { drawCanvasCrownSpray, drawCanvasMainJet } from './fountain-canvas-jet.js';
import { FountainCanvasParticleLayer } from './fountain-canvas-particles.js';
import type { FountainCanvasFrame } from './fountain-canvas-shared.js';
import { drawCanvasWaterSurface } from './fountain-canvas-surface.js';
import { buildFountainGeometry, type FountainGeometry } from './fountain-geometry.js';
import { SmoothValue } from './fountain-motion.js';
import {
  FOUNTAIN_DEGRADATION_ORDER,
  performanceMatrixRow,
  type FountainQualityTier,
} from './fountain-performance.js';
import type { FountainSceneModel } from './fountain-types.js';

interface StreamSmoothState {
  readonly width: SmoothValue;
  readonly opacity: SmoothValue;
  readonly activity: SmoothValue;
}

/**
 * Canvas 2D 兼容回退编排器。
 * WebGL 是默认水体主路径；本类仅在 WebGL 初始化失败时挂载，并把各层委托给独立模块。
 */
export class FountainCanvasRenderer {
  private canvas: HTMLCanvasElement | undefined;
  private context: CanvasRenderingContext2D | undefined;
  private model: FountainSceneModel | undefined;
  private width = 720;
  private height = 520;
  private time = 0;
  private lastFrame = 0;
  private raf = 0;
  private reducedMotion = false;
  private lowPerformance = false;
  private qualityTier: FountainQualityTier = 'high';
  private documentVisible = true;
  private intersecting = true;
  private cleanup: (() => void) | undefined;
  private readonly particles = new FountainCanvasParticleLayer();
  private readonly smooth = {
    columnHeight: new SmoothValue(0.7),
    columnWidth: new SmoothValue(0.7),
    crownSpread: new SmoothValue(0.5),
    turbulence: new SmoothValue(0.2),
    spray: new SmoothValue(0.1),
    flowSpeed: new SmoothValue(0.6),
    mistDensity: new SmoothValue(0.16),
    glowIntensity: new SmoothValue(0.46),
    highlightIntensity: new SmoothValue(0.58),
  };
  private readonly poolSmooth = {
    calmness: new SmoothValue(0.8),
    rippleStrength: new SmoothValue(0.2),
    rippleFrequency: new SmoothValue(0.2),
    waveSpeed: new SmoothValue(0.45),
    reflectionIntensity: new SmoothValue(0.5),
    distortion: new SmoothValue(0.2),
  };
  private readonly streamSmooth = new Map<string, StreamSmoothState>();

  public constructor(
    private readonly host: HTMLElement,
    private readonly debug = false,
  ) {}

  public mount(): void {
    const canvas = document.createElement('canvas');
    canvas.className = 'fountain-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.host.replaceChildren(canvas);
    const context = canvas.getContext('2d');
    if (context === null) return;
    this.canvas = canvas;
    this.context = context;
    this.resize();
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        this.resize();
      });
    });
    resizeObserver.observe(this.host);
    const visibility = () => {
      this.documentVisible = document.visibilityState === 'visible';
      this.resumeIfNeeded();
      this.syncRuntimeState();
    };
    document.addEventListener('visibilitychange', visibility);
    let intersectionObserver: IntersectionObserver | undefined;
    if (this.host.isConnected) {
      intersectionObserver = new IntersectionObserver(([entry]) => {
        this.intersecting = entry?.isIntersecting ?? true;
        this.resumeIfNeeded();
        this.syncRuntimeState();
      });
      intersectionObserver.observe(this.host);
    }
    this.particles.reset(this.lowPerformance);
    this.documentVisible = document.visibilityState === 'visible';
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    this.syncRuntimeState();
    this.cleanup = () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }

  public render(model: FountainSceneModel): void {
    this.model = model;
    this.host.dataset.particleBudget = String(model.pressure.particleBudget);
    this.host.dataset.fountainDomain = model.domain.area.toLowerCase();
    for (const key of Object.keys(this.smooth) as (keyof typeof this.smooth)[]) {
      this.smooth[key].setTarget(model.pressure[key]);
    }
    for (const key of Object.keys(this.poolSmooth) as (keyof typeof this.poolSmooth)[]) {
      this.poolSmooth[key].setTarget(model.pool[key]);
    }
    model.streams.forEach((stream, index) => {
      const key = `${String(index)}-${stream.layer}-${stream.side}`;
      let state = this.streamSmooth.get(key);
      if (state === undefined) {
        state = {
          width: new SmoothValue(stream.width),
          opacity: new SmoothValue(stream.opacity),
          activity: new SmoothValue(stream.activity),
        };
        this.streamSmooth.set(key, state);
      }
      state.width.setTarget(stream.width);
      state.opacity.setTarget(stream.opacity);
      state.activity.setTarget(stream.activity);
    });
    if (this.reducedMotion) this.draw(800);
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.draw(800);
    } else this.resumeIfNeeded();
    this.syncRuntimeState();
  }

  public setLowPerformance(enabled: boolean): void {
    this.setQualityTier(enabled ? 'low' : 'high');
  }

  public setQualityTier(tier: FountainQualityTier): void {
    const matrix = performanceMatrixRow(tier);
    this.host.dataset.performanceMode = tier;
    this.host.dataset.performanceDegradationOrder = FOUNTAIN_DEGRADATION_ORDER.join(',');
    this.host.dataset.performanceDropletScale = String(matrix.particleScale);
    this.host.dataset.performanceRippleScale = String(matrix.rippleScale);
    this.host.dataset.performanceMistScale = String(matrix.mistScale);
    this.host.dataset.performanceResolutionScale = String(matrix.resolutionScale);
    this.host.dataset.performanceMainFlow = 'preserved';
    if (this.qualityTier === tier) return;
    this.qualityTier = tier;
    this.lowPerformance = tier === 'low';
    this.particles.reset(this.lowPerformance);
    this.resize();
  }

  public destroy(): void {
    cancelAnimationFrame(this.raf);
    this.cleanup?.();
    this.canvas?.remove();
    this.canvas = undefined;
    this.context = undefined;
    this.host.dataset.animationState = 'destroyed';
  }

  private readonly tick = (timestamp: number): void => {
    const delta = Math.min(100, timestamp - this.lastFrame);
    this.lastFrame = timestamp;
    if (this.reducedMotion || !this.documentVisible || !this.intersecting) {
      this.raf = 0;
      this.syncRuntimeState();
      return;
    }
    this.time += delta / 1000;
    this.draw(delta);
    this.raf = requestAnimationFrame(this.tick);
    this.syncRuntimeState();
  };

  private draw(deltaMs: number): void {
    const ctx = this.context;
    const current = this.currentGeometry(deltaMs);
    if (ctx === undefined || current === undefined) return;
    const frame: FountainCanvasFrame = {
      ctx,
      geometry: current.geometry,
      model: current.model,
      time: this.time,
      deltaMs,
      reducedMotion: this.reducedMotion,
      lowPerformance: this.lowPerformance,
      width: this.width,
      height: this.height,
    };
    ctx.clearRect(0, 0, this.width, this.height);
    drawCanvasWaterSurface(frame);
    drawCanvasArcStreams(frame);
    drawCanvasMainJet(frame);
    drawCanvasCrownSpray(frame);
    drawCanvasMist(frame);
    this.particles.draw(frame);
    drawCanvasLighting(frame);
    if (this.debug) this.drawDebug(frame);
  }

  private currentGeometry(
    deltaMs: number,
  ): { geometry: FountainGeometry; model: FountainSceneModel } | undefined {
    const model = this.model;
    if (model === undefined || this.context === undefined) return undefined;
    const streams = model.streams.map((stream, index) => {
      const state = this.streamSmooth.get(`${String(index)}-${stream.layer}-${stream.side}`);
      return state === undefined
        ? stream
        : {
            ...stream,
            width: state.width.update(deltaMs),
            opacity: state.opacity.update(deltaMs),
            activity: state.activity.update(deltaMs),
          };
    });
    const smoothModel: FountainSceneModel = {
      ...model,
      pressure: {
        ...model.pressure,
        columnHeight: this.smooth.columnHeight.update(deltaMs),
        columnWidth: this.smooth.columnWidth.update(deltaMs),
        crownSpread: this.smooth.crownSpread.update(deltaMs),
        turbulence: this.smooth.turbulence.update(deltaMs),
        spray: this.smooth.spray.update(deltaMs),
        flowSpeed: this.smooth.flowSpeed.update(deltaMs),
        mistDensity: this.smooth.mistDensity.update(deltaMs),
        glowIntensity: this.smooth.glowIntensity.update(deltaMs),
        highlightIntensity: this.smooth.highlightIntensity.update(deltaMs),
      },
      streams,
      pool: {
        ...model.pool,
        calmness: this.poolSmooth.calmness.update(deltaMs),
        rippleStrength: this.poolSmooth.rippleStrength.update(deltaMs),
        rippleFrequency: this.poolSmooth.rippleFrequency.update(deltaMs),
        waveSpeed: this.poolSmooth.waveSpeed.update(deltaMs),
        reflectionIntensity: this.poolSmooth.reflectionIntensity.update(deltaMs),
        distortion: this.poolSmooth.distortion.update(deltaMs),
        activeLandingPoints: model.pool.activeLandingPoints.map((point, index) => ({
          ...point,
          intensity: streams[index]?.activity ?? point.intensity,
        })),
      },
    };
    return {
      geometry: buildFountainGeometry(smoothModel, { width: this.width, height: this.height }),
      model: smoothModel,
    };
  }

  private resize(): void {
    if (this.canvas === undefined) return;
    const rect = this.host.getBoundingClientRect();
    const ratio = Math.max(
      0.5,
      Math.min(window.devicePixelRatio || 1, 2) *
        performanceMatrixRow(this.qualityTier).resolutionScale,
    );
    this.width = Math.max(240, rect.width);
    this.height = Math.max(180, rect.height);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.canvas.style.width = `${String(this.width)}px`;
    this.canvas.style.height = `${String(this.height)}px`;
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private resumeIfNeeded(): void {
    if (this.reducedMotion || !this.documentVisible || !this.intersecting || this.raf !== 0) return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private syncRuntimeState(): void {
    this.host.dataset.animationState = this.reducedMotion
      ? 'reduced-motion'
      : !this.documentVisible
        ? 'hidden'
        : !this.intersecting
          ? 'offscreen'
          : this.raf === 0
            ? 'idle'
            : 'running';
  }

  private drawDebug({ ctx, geometry, model }: FountainCanvasFrame): void {
    ctx.fillStyle = 'rgba(255,90,90,0.9)';
    ctx.beginPath();
    ctx.arc(geometry.crown.x, geometry.crown.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(
      `p${String(model.pressure.score)} h${model.pressure.columnHeight.toFixed(2)} w${model.pressure.columnWidth.toFixed(2)}`,
      10,
      14,
    );
  }
}
