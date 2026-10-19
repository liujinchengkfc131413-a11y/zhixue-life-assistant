import { describe, expect, it } from 'vitest';

import { resolveRuntimeState } from './readiness.js';

describe('resolveRuntimeState', () => {
  it('reports degraded until the local data core is configured', () => {
    expect(
      resolveRuntimeState({
        serverStarted: true,
        databaseConnected: false,
        dataDirectoryConfigured: false,
      }),
    ).toBe('DEGRADED');
  });

  it('reports ready when the complete local core is available', () => {
    expect(
      resolveRuntimeState({
        serverStarted: true,
        databaseConnected: true,
        dataDirectoryConfigured: true,
      }),
    ).toBe('READY');
  });
});
