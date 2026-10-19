import { describe, expect, it } from 'vitest';

import { SmoothValue } from './fountain-motion.js';

describe('SmoothValue', () => {
  it('moves continuously and reaches its target within the 600ms transition budget', () => {
    const value = new SmoothValue(0.2);
    value.setTarget(1);

    const firstFrame = value.update(16);
    const middle = value.update(284);
    const final = value.update(300);

    expect(firstFrame).toBeGreaterThan(0.2);
    expect(firstFrame).toBeLessThan(middle);
    expect(middle).toBeLessThan(1);
    expect(final).toBe(1);
  });

  it('continues from the current interpolated value when the target changes', () => {
    const value = new SmoothValue(0, 600);
    value.setTarget(1);
    const beforeRetarget = value.update(200);
    value.setTarget(0.4);
    const afterRetarget = value.update(16);

    expect(Math.abs(afterRetarget - beforeRetarget)).toBeLessThan(0.1);
    expect(value.update(584)).toBe(0.4);
  });
});
