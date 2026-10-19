import { describe, expect, it } from 'vitest';

import { SystemStatusSchema } from './system-status.js';

describe('SystemStatusSchema', () => {
  it('accepts the stable M0 status contract', () => {
    const result = SystemStatusSchema.safeParse({
      state: 'READY',
      appVersion: '0.1.0',
      serverTime: '2026-08-11T00:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      database: { connected: false, dataDirectoryConfigured: false },
      capabilities: { aiConfigured: false, schedulerAvailable: false },
      backgroundJobs: { pending: 0, running: 0, failed: 0 },
      disk: { freeBytes: 1_024, totalBytes: 4_096 },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a negative background job or disk summary', () => {
    const result = SystemStatusSchema.safeParse({
      state: 'READY',
      appVersion: '0.1.0',
      serverTime: '2026-08-11T00:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      database: { connected: true, dataDirectoryConfigured: true },
      capabilities: { aiConfigured: false, schedulerAvailable: true },
      backgroundJobs: { pending: -1, running: 0, failed: 0 },
      disk: { freeBytes: 0, totalBytes: 0 },
    });

    expect(result.success).toBe(false);
  });
});
