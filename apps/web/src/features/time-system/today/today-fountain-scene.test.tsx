// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TodayFountainScene } from './today-fountain-scene.js';

const renderStaticEnvironment = () => render(<TodayFountainScene dynamicWaterEnabled={false} />);

describe('TodayFountainScene asset ownership', () => {
  it('keeps only fountain-local water layers when Canvas motion is off', () => {
    const { container } = renderStaticEnvironment();

    expect(container.querySelector('[data-fountain-layer="environment"]')).toBeNull();
    expect(
      container.querySelector<HTMLImageElement>('[data-fountain-layer="pool"]')?.src,
    ).toContain('today-environment-v2.webp');
    expect(
      container.querySelector<HTMLImageElement>('[data-fountain-layer="water-surface"]')?.src,
    ).toContain('today-environment-v2.webp');
    expect(
      container.querySelector<HTMLImageElement>('[data-fountain-layer="static-fountain"]')?.src,
    ).toContain('fountain-water-photoreal-v2.png');
    expect(container.querySelector('[data-fountain-layer="scene-glow"]')).not.toBeNull();
    expect(container.querySelector('[data-fountain-layer="dynamic-water"]')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[aria-label^="今日状态场景："]')).not.toBeNull();
  });
});
