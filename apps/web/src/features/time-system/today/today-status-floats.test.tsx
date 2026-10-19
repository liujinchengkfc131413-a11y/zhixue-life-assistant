// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TodayStatusFloats } from './today-status-floats.js';

describe('TodayStatusFloats', () => {
  it('marks the current area with text as well as visual weight', () => {
    render(
      <TodayStatusFloats
        items={[
          { kind: 'SLEEP', label: '睡眠', minutes: 480, active: false },
          { kind: 'WORK', label: '工作', minutes: 360, active: true },
          { kind: 'LIFE', label: '生活', minutes: 120, active: false },
          { kind: 'FREE', label: '空闲', minutes: 480, active: false },
        ]}
      />,
    );

    expect(screen.getByText('当前')).toBeTruthy();
    expect(
      screen.getByText('6 小时 0 分').closest('[data-active]')?.getAttribute('data-active'),
    ).toBe('true');
  });
});
