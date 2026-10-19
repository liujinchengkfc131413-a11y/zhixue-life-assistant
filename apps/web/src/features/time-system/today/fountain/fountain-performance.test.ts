import { describe, expect, it, vi } from 'vitest';

import {
  FOUNTAIN_DEGRADATION_ORDER,
  FOUNTAIN_PERFORMANCE_MATRIX,
  FountainPerformanceMonitor,
  parseFountainQualityOverride,
  performanceMatrixRow,
  summarizeFrameTimes,
} from './fountain-performance.js';

describe('fountain performance monitor', () => {
  it('computes P50/P95 FPS and maps frame budgets to quality tiers', () => {
    const high = summarizeFrameTimes(Array.from({ length: 100 }, () => 16));
    const balanced = summarizeFrameTimes(Array.from({ length: 100 }, () => 20));
    const low = summarizeFrameTimes(Array.from({ length: 100 }, () => 30));

    expect(high.recommendedTier).toBe('high');
    expect(high.fpsP50).toBeCloseTo(62.5);
    expect(balanced.recommendedTier).toBe('balanced');
    expect(low.recommendedTier).toBe('low');
    expect(low.fpsP95).toBeCloseTo(33.33, 1);
  });

  it('requires two consecutive windows before changing quality', () => {
    const snapshots = vi.fn();
    const changes = vi.fn();
    const monitor = new FountainPerformanceMonitor('high', snapshots, changes);

    for (let index = 0; index < 150; index += 1) monitor.push(31);

    expect(snapshots).toHaveBeenCalledTimes(2);
    expect(changes).toHaveBeenCalledWith('low');
    expect(monitor.tier()).toBe('low');
  });

  it('exposes deterministic high, balanced and low QA profiles', () => {
    expect(FOUNTAIN_PERFORMANCE_MATRIX.map((row) => row.tier)).toEqual(['high', 'balanced', 'low']);
    expect(performanceMatrixRow('high').particleScale).toBe(1);
    expect(performanceMatrixRow('low').captureScale).toBe(0.45);
    expect(parseFountainQualityOverride('?fountainTier=balanced')).toBe('balanced');
    expect(parseFountainQualityOverride('?fountainTier=invalid')).toBeUndefined();
  });

  it('degrades droplets, ripple, mist, then resolution without disabling main flow', () => {
    expect(FOUNTAIN_DEGRADATION_ORDER).toEqual(['droplets', 'ripple', 'mist', 'resolution']);
    for (const tier of ['balanced', 'low'] as const) {
      const row = performanceMatrixRow(tier);
      expect(row.particleScale).toBeLessThan(row.rippleScale);
      expect(row.rippleScale).toBeLessThan(row.mistScale);
      expect(row.mistScale).toBeLessThan(row.resolutionScale);
      expect(row.particleScale).toBeGreaterThan(0);
    }
    expect(FOUNTAIN_DEGRADATION_ORDER).not.toContain('main-flow');
  });
});
