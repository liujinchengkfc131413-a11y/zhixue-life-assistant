import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';

import { GetSystemStatus, type RuntimeProbe } from './get-system-status.js';

const probe: RuntimeProbe = {
  isDatabaseConnected: () => false,
  isDataDirectoryConfigured: () => false,
  isAiConfigured: () => false,
  isSchedulerAvailable: () => false,
  getBackgroundJobSummary: () => ({ pending: 0, running: 0, failed: 0 }),
  getDiskSpace: () => ({ freeBytes: 0, totalBytes: 0 }),
};

describe('GetSystemStatus', () => {
  it('combines the domain state and transport contract without infrastructure access', () => {
    const useCase = new GetSystemStatus(
      new FixedClock(new Date('2026-08-11T00:00:00.000Z')),
      probe,
      '0.1.0',
    );

    expect(useCase.execute()).toEqual({
      state: 'DEGRADED',
      appVersion: '0.1.0',
      serverTime: '2026-08-11T00:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      database: { connected: false, dataDirectoryConfigured: false },
      capabilities: { aiConfigured: false, schedulerAvailable: false },
      backgroundJobs: { pending: 0, running: 0, failed: 0 },
      disk: { freeBytes: 0, totalBytes: 0 },
    });
  });

  it('exposes the background job and disk summaries provided by the probe', () => {
    const useCase = new GetSystemStatus(
      new FixedClock(new Date('2026-08-11T00:00:00.000Z')),
      {
        ...probe,
        getBackgroundJobSummary: () => ({ pending: 2, running: 1, failed: 0 }),
        getDiskSpace: () => ({ freeBytes: 1_024, totalBytes: 4_096 }),
      },
      '0.2.0',
    );

    expect(useCase.execute()).toMatchObject({
      backgroundJobs: { pending: 2, running: 1, failed: 0 },
      disk: { freeBytes: 1_024, totalBytes: 4_096 },
    });
  });
});
