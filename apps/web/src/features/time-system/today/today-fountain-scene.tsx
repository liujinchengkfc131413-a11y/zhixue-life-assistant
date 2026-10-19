import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import fountainWaterTextureAsset from '../../../assets/today/fountain-water-photoreal-v2.png';
import todayPoolAsset from '../../../assets/today/today-environment-v2.webp';
import { FountainCanvasRenderer } from './fountain/fountain-renderer.js';
import { applyFountainBlindState, parseFountainBlindCode } from './fountain/fountain-blind-test.js';
import {
  parseFountainQualityOverride,
  type FountainQualityTier,
} from './fountain/fountain-performance.js';
import type { FountainSceneModel } from './fountain/fountain-types.js';

interface FountainWebGLController {
  mount(): Promise<void>;
  render(model: FountainSceneModel): void;
  setReducedMotion(enabled: boolean): void;
  setLowPerformance(enabled: boolean): void;
  setQualityTier(tier: FountainQualityTier): void;
  destroy(): void;
}

/**
 * 今日中央场景（T4）：
 *   - 环境层：仅空间、雾与环境光，不包含池体
 *   - 水池层：池壁、池沿与静态水面材质
 *   - WebGL 动态层：默认承担水面、中央水柱、多层水弧、落水、飞溅与水雾
 *   - Canvas 动态层：只在 WebGL 初始化失败时作为完整兼容回退
 * 数据由 TodayImmersiveLayout 构造的 FountainSceneModel 驱动。
 */

export const TodayFountainScene = ({
  model,
  debug = false,
  dynamicWaterEnabled = true,
  geometryOnly = false,
  stateDescription = '正在读取今日状态',
}: {
  model?: FountainSceneModel | undefined;
  debug?: boolean;
  dynamicWaterEnabled?: boolean;
  geometryOnly?: boolean;
  /** 提供给辅助技术的简洁状态摘要；装饰性水体本身不逐条朗读。 */
  stateDescription?: string;
}) => {
  const blindCode =
    typeof window === 'undefined' ? undefined : parseFountainBlindCode(window.location.search);
  const renderedModel = useMemo(
    () => (model === undefined ? undefined : applyFountainBlindState(model, blindCode)),
    [blindCode, model],
  );
  const dynamicHost = useRef<HTMLDivElement>(null);
  const webglHost = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<FountainCanvasRenderer | null>(null);
  const webglRendererRef = useRef<FountainWebGLController | null>(null);
  const modelRef = useRef(renderedModel);
  const [webglState, setWebglState] = useState<'pending' | 'ready' | 'fallback'>('pending');
  const waterTextureStyle = {
    '--fountain-texture-opacity': String(
      0.12 + (renderedModel?.pressure.glowIntensity ?? 0.46) * 0.78,
    ),
    '--fountain-texture-scale-x': String(
      0.65 + (renderedModel?.pressure.crownSpread ?? 0.5) * 0.35,
    ),
    '--fountain-texture-scale-y': String(
      0.48 + (renderedModel?.pressure.columnHeight ?? 0.7) * 0.52,
    ),
    '--fountain-pressure-energy': String((renderedModel?.pressure.score ?? 35) / 100),
    '--fountain-pool-reflection': String(renderedModel?.pool.reflectionIntensity ?? 0.5),
    '--fountain-domain-warmth': String(renderedModel?.domain.warmth ?? 0.1),
  } as CSSProperties;

  useEffect(() => {
    modelRef.current = renderedModel;
  }, [renderedModel]);

  useEffect(() => {
    if (!dynamicWaterEnabled) return;
    let disposed = false;
    let effectRenderer: FountainWebGLController | null = null;
    const lowPerformance = navigator.hardwareConcurrency <= 4;
    const qualityOverride = parseFountainQualityOverride(window.location.search);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = (event: MediaQueryListEvent) => {
      webglRendererRef.current?.setReducedMotion(event.matches);
      rendererRef.current?.setReducedMotion(event.matches);
    };
    motion.addEventListener('change', updateMotion);
    const mountWebGL = async () => {
      const host = webglHost.current;
      if (host === null) return;
      try {
        const { FountainWebGLRenderer } = await import('./fountain/fountain-webgl-renderer.js');
        const webglRenderer = new FountainWebGLRenderer(
          host,
          todayPoolAsset,
          (tier) => {
            rendererRef.current?.setQualityTier(tier);
          },
          { geometryOnly },
        );
        effectRenderer = webglRenderer;
        await webglRenderer.mount();
        if (disposed) {
          webglRenderer.destroy();
          return;
        }
        if (qualityOverride === undefined) webglRenderer.setLowPerformance(lowPerformance);
        else webglRenderer.setQualityTier(qualityOverride);
        webglRenderer.setReducedMotion(motion.matches);
        if (modelRef.current !== undefined) webglRenderer.render(modelRef.current);
        webglRendererRef.current = webglRenderer;
        setWebglState('ready');
      } catch (error) {
        if (disposed) return;
        if (error instanceof Error && error.message === 'WebGL mount superseded') return;
        host.dataset.webglState = 'fallback';
        host.dataset.webglError = error instanceof Error ? error.message.slice(0, 160) : 'unknown';
        setWebglState('fallback');
      }
    };
    void mountWebGL();
    return () => {
      disposed = true;
      motion.removeEventListener('change', updateMotion);
      effectRenderer?.destroy();
      if (webglRendererRef.current === effectRenderer) webglRendererRef.current = null;
    };
  }, [dynamicWaterEnabled, geometryOnly]);

  useEffect(() => {
    const host = dynamicHost.current;
    if (!dynamicWaterEnabled || webglState === 'ready' || host === null) {
      rendererRef.current?.destroy();
      rendererRef.current = null;
      return;
    }
    const renderer = new FountainCanvasRenderer(host, debug);
    const qualityOverride = parseFountainQualityOverride(window.location.search);
    if (qualityOverride === undefined)
      renderer.setLowPerformance(navigator.hardwareConcurrency <= 4);
    else renderer.setQualityTier(qualityOverride);
    renderer.mount();
    renderer.setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (modelRef.current !== undefined) renderer.render(modelRef.current);
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [debug, dynamicWaterEnabled, webglState]);

  useEffect(() => {
    if (renderedModel !== undefined) {
      rendererRef.current?.render(renderedModel);
      webglRendererRef.current?.render(renderedModel);
    }
  }, [renderedModel]);

  return (
    <section className="fountain-scene" aria-label={`今日状态场景：${stateDescription}`}>
      <div className="fountain-scene__fountain">
        <div
          className="fountain-stage"
          data-blind-test={blindCode}
          data-webgl-active={webglState === 'ready'}
          data-geometry-only={geometryOnly}
        >
          <div
            className="fountain-stage__scene-glow"
            data-fountain-layer="scene-glow"
            aria-hidden="true"
          />
          {dynamicWaterEnabled ? (
            <div
              className="fountain-stage__webgl"
              data-fountain-layer="webgl-water"
              ref={webglHost}
            />
          ) : null}
          <img
            className="fountain-stage__pool"
            src={todayPoolAsset}
            alt=""
            aria-hidden="true"
            data-fountain-layer="pool"
            style={waterTextureStyle}
          />
          <img
            className="fountain-stage__water-surface"
            src={todayPoolAsset}
            alt=""
            aria-hidden="true"
            data-fountain-layer="water-surface"
            style={waterTextureStyle}
          />
          <img
            className="fountain-stage__static-fountain"
            src={fountainWaterTextureAsset}
            alt=""
            aria-hidden="true"
            data-fountain-layer="static-fountain"
            style={waterTextureStyle}
          />
          {dynamicWaterEnabled ? (
            <div
              className="fountain-stage__dynamic"
              data-fountain-layer="dynamic-water"
              ref={dynamicHost}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
};
