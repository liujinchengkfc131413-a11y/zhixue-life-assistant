export type FountainQualityTier = 'high' | 'balanced' | 'low';

export const FOUNTAIN_DEGRADATION_ORDER = ['droplets', 'ripple', 'mist', 'resolution'] as const;

export const parseFountainQualityOverride = (search: string): FountainQualityTier | undefined => {
  const value = new URLSearchParams(search).get('fountainTier');
  return value === 'high' || value === 'balanced' || value === 'low' ? value : undefined;
};

export interface FountainPerformanceMatrixRow {
  readonly tier: FountainQualityTier;
  readonly targetFpsP95: number;
  readonly maxFrameTimeP95: number;
  /** 第一降级项：水滴与落水飞溅。 */
  readonly particleScale: number;
  /** 第二降级项：落水波纹数量。 */
  readonly rippleScale: number;
  /** 第三降级项：体积雾密度。 */
  readonly mistScale: number;
  /** 最后降级项：主渲染分辨率。 */
  readonly resolutionScale: number;
  readonly captureScale: number;
}

export const FOUNTAIN_PERFORMANCE_MATRIX: readonly FountainPerformanceMatrixRow[] = [
  {
    tier: 'high',
    targetFpsP95: 55,
    maxFrameTimeP95: 18.2,
    particleScale: 1,
    rippleScale: 1,
    mistScale: 1,
    resolutionScale: 1,
    captureScale: 1,
  },
  {
    tier: 'balanced',
    targetFpsP95: 50,
    maxFrameTimeP95: 20,
    particleScale: 0.68,
    rippleScale: 0.82,
    mistScale: 0.9,
    resolutionScale: 0.96,
    captureScale: 0.7,
  },
  {
    tier: 'low',
    targetFpsP95: 45,
    maxFrameTimeP95: 22.3,
    particleScale: 0.28,
    rippleScale: 0.52,
    mistScale: 0.68,
    resolutionScale: 0.76,
    captureScale: 0.45,
  },
] as const;

export const performanceMatrixRow = (tier: FountainQualityTier): FountainPerformanceMatrixRow =>
  FOUNTAIN_PERFORMANCE_MATRIX.find((row) => row.tier === tier) ?? {
    tier: 'low',
    targetFpsP95: 45,
    maxFrameTimeP95: 22.3,
    particleScale: 0.28,
    rippleScale: 0.52,
    mistScale: 0.68,
    resolutionScale: 0.58,
    captureScale: 0.45,
  };

export interface FountainPerformanceSnapshot {
  readonly sampleCount: number;
  readonly frameTimeP50: number;
  readonly frameTimeP95: number;
  readonly fpsP50: number;
  readonly fpsP95: number;
  readonly recommendedTier: FountainQualityTier;
}

const percentile = (sorted: readonly number[], ratio: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
};

export const summarizeFrameTimes = (samples: readonly number[]): FountainPerformanceSnapshot => {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample) && sample > 0 && sample <= 250)
    .toSorted((left, right) => left - right);
  const frameTimeP50 = percentile(sorted, 0.5);
  const frameTimeP95 = percentile(sorted, 0.95);
  const recommendedTier: FountainQualityTier =
    frameTimeP95 > 25 ? 'low' : frameTimeP95 > 18.5 ? 'balanced' : 'high';
  return {
    sampleCount: sorted.length,
    frameTimeP50,
    frameTimeP95,
    fpsP50: frameTimeP50 <= 0 ? 0 : 1000 / frameTimeP50,
    fpsP95: frameTimeP95 <= 0 ? 0 : 1000 / frameTimeP95,
    recommendedTier,
  };
};

/**
 * 只保留最近约两秒的帧耗时，并要求连续两次窗口都建议降级/升级，避免质量档位抖动。
 */
export class FountainPerformanceMonitor {
  private samples: number[] = [];
  private pendingTier: FountainQualityTier | undefined;
  private pendingCount = 0;
  private currentTier: FountainQualityTier;

  public constructor(
    initialTier: FountainQualityTier,
    private readonly onSnapshot: (snapshot: FountainPerformanceSnapshot) => void,
    private readonly onTierChange: (tier: FountainQualityTier) => void,
  ) {
    this.currentTier = initialTier;
  }

  public push(frameTime: number): void {
    if (!Number.isFinite(frameTime) || frameTime <= 0 || frameTime > 250) return;
    this.samples.push(frameTime);
    if (this.samples.length < 90) return;
    const snapshot = summarizeFrameTimes(this.samples);
    this.samples = this.samples.slice(-30);
    this.onSnapshot(snapshot);
    if (snapshot.recommendedTier === this.currentTier) {
      this.pendingTier = undefined;
      this.pendingCount = 0;
      return;
    }
    if (snapshot.recommendedTier !== this.pendingTier) {
      this.pendingTier = snapshot.recommendedTier;
      this.pendingCount = 1;
      return;
    }
    this.pendingCount += 1;
    if (this.pendingCount < 2) return;
    this.currentTier = snapshot.recommendedTier;
    this.pendingTier = undefined;
    this.pendingCount = 0;
    this.onTierChange(this.currentTier);
  }

  public tier(): FountainQualityTier {
    return this.currentTier;
  }

  public setTier(tier: FountainQualityTier): void {
    this.currentTier = tier;
    this.pendingTier = undefined;
    this.pendingCount = 0;
  }
}
