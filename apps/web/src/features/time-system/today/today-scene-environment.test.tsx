// @vitest-environment jsdom

import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

import { TodaySceneEnvironment, getTodaySceneEnvironmentStyle } from './today-scene-environment.js';

describe('TodaySceneEnvironment', () => {
  it('maps a time profile to scene-scoped CSS variables', () => {
    expect(getTodaySceneEnvironmentStyle('night')).toMatchObject({
      '--today-scene-brightness': 0.82,
      '--today-scene-contrast': 1.03,
      '--today-scene-temperature-color': '20 55 66',
      '--today-scene-temperature-opacity': 0.12,
      '--today-scene-environment-opacity': 1,
      '--today-scene-vignette-opacity': 0.12,
      '--today-scene-readability-top-opacity': 0.2,
      '--today-scene-readability-bottom-opacity': 0.18,
      '--today-scene-environment-transition-ms': '5000ms',
    });
  });

  it('updates the environment state without replacing the overlay element', () => {
    const { container, rerender } = render(<TodaySceneEnvironment timeState="morning" />);
    const overlay = container.firstElementChild;

    expect(overlay).toHaveAttribute('data-time-state', 'morning');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');

    rerender(<TodaySceneEnvironment timeState="night" />);

    expect(container.firstElementChild).toBe(overlay);
    expect(overlay).toHaveAttribute('data-time-state', 'night');
  });
});
