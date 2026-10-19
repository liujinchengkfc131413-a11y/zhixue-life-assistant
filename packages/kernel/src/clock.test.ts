import { describe, expect, it } from 'vitest';

import { FixedClock } from './clock.js';

describe('FixedClock', () => {
  it('returns an isolated copy of the configured instant', () => {
    const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));

    const first = clock.now();
    first.setUTCFullYear(2030);

    expect(clock.now().toISOString()).toBe('2026-08-11T00:00:00.000Z');
  });
});
