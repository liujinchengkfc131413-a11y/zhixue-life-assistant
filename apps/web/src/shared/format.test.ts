import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime } from './format.js';

describe('formatDateTime', () => {
  it('formats an instant in the fixed Asia/Shanghai timezone', () => {
    // 2026-08-14T00:00:00Z = 2026-08-14 08:00 东八区
    expect(formatDateTime('2026-08-14T00:00:00.000Z')).toBe('2026/8/14 08:00');
  });

  it('keeps the same instant across an UTC midnight boundary', () => {
    // 2026-08-13T16:00:00Z = 2026-08-14 00:00 东八区
    expect(formatDateTime('2026-08-13T16:00:00.000Z')).toBe('2026/8/14 00:00');
  });
});

describe('formatDate', () => {
  it('formats date-only output in the fixed timezone', () => {
    // 2026-08-13T17:30:00Z = 2026-08-14 01:30 东八区 → 日期为 14 日
    expect(formatDate('2026-08-13T17:30:00.000Z')).toBe('2026/8/14');
  });
});
