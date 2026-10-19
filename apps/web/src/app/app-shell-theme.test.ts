import { describe, expect, it } from 'vitest';

import { resolveAppTheme } from './app-shell.js';

describe('resolveAppTheme', () => {
  it.each([
    ['/', 'today'],
    ['/work', 'work'],
    ['/work/learning', 'work'],
    ['/life', 'life'],
    ['/life/shopping', 'life'],
    ['/plans-goals', 'vision'],
    ['/assistant', 'ai'],
    ['/inbox', 'system'],
    ['/data-management', 'system'],
    ['/reminders', 'system'],
    ['/settings', 'system'],
    ['/setup', 'system'],
  ] as const)('maps %s to %s', (pathname, expected) => {
    expect(resolveAppTheme(pathname)).toBe(expected);
  });

  it('uses the system theme as the safe fallback', () => {
    expect(resolveAppTheme('/unknown')).toBe('system');
  });
});
