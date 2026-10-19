// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { toPressureVisualState } from '../pressure-visual-state.js';
import { TodayStateAxis } from './today-state-axis.js';

describe('TodayStateAxis', () => {
  it('opens pressure factors as an overlay region without replacing the axis', async () => {
    const user = userEvent.setup();
    render(
      <TodayStateAxis
        pressureVisual={toPressureVisualState(62, 'ELEVATED')}
        currentNow={Date.parse('2026-08-15T06:25:00.000+08:00')}
        currentStateLabel="工作 · 进行中"
        pressureFactors={[{ code: 'dense', points: 12, message: '任务较密集' }]}
      />,
    );

    const toggle = screen.getByRole('button', { name: '查看 1 项因素' });
    expect(screen.getByText('06:25')).toBeTruthy();
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('任务较密集')).toBeTruthy();
    expect(screen.getByText('06:25')).toBeTruthy();
  });
});
