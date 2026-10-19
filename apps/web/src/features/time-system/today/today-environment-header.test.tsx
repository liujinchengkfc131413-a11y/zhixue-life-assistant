// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

import { TodayEnvironmentHeader } from './today-environment-header.js';

describe('TodayEnvironmentHeader', () => {
  it('renders the lunar day with Chinese numerals', () => {
    render(
      <TodayEnvironmentHeader todayLabel="2026年8月28日星期五" statusSentence="时间在流动。" />,
    );

    expect(screen.getByText(/农历七月十六/)).toBeInTheDocument();
    expect(screen.queryByText(/农历七月16日/)).not.toBeInTheDocument();
  });
});
