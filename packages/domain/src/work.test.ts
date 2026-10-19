import { describe, expect, it } from 'vitest';

import { assertContentTransition, assertProgressRange, calculateProgressPercent } from './work.js';

describe('work domain rules', () => {
  it('allows forward and explicit rollback transitions while rejecting skipped production stages', () => {
    expect(() => {
      assertContentTransition('CREATING', 'READY');
    }).not.toThrow();
    expect(() => {
      assertContentTransition('READY', 'CREATING');
    }).not.toThrow();
    expect(() => {
      assertContentTransition('IDEA', 'PUBLISHED');
    }).toThrow('INVALID_CONTENT_TRANSITION');
  });
  it('validates and explains learning progress', () => {
    expect(calculateProgressPercent(25, 100)).toBe(25);
    expect(calculateProgressPercent(null, 100)).toBeNull();
    expect(() => {
      assertProgressRange(120, 100);
    }).toThrow('INVALID_PROGRESS');
  });
});
