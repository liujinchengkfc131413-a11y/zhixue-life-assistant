import { writeFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { SystemStatusEnvelopeSchema, SystemStatusSchema } from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M0 server contract', () => {
  it('exposes a stable system status envelope', async () => {
    const app = await buildApp({
      clock: new FixedClock(new Date('2026-08-11T00:00:00.000Z')),
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/system/status' });

    expect(response.statusCode).toBe(200);
    const body = SystemStatusEnvelopeSchema.parse(response.json());
    expect(body).toMatchObject({
      data: {
        state: 'DEGRADED',
        appVersion: '0.1.0',
        serverTime: '2026-08-11T00:00:00.000Z',
        timeZone: 'Asia/Shanghai',
      },
    });
    expect(body.meta.requestId).not.toHaveLength(0);

    await app.close();
  });

  it('keeps the process readiness endpoint independent of AI configuration', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(200);
    expect(SystemStatusSchema.parse(response.json())).toMatchObject({
      state: 'DEGRADED',
      capabilities: { aiConfigured: false, schedulerAvailable: false },
    });

    await app.close();
  });

  it('keeps API validation errors as problem+json when serving the production web root', async () => {
    const temporary = await createTestDataDirectory();
    await writeFile(`${temporary.path}/index.html`, '<!doctype html><title>test</title>');
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime, webRoot: temporary.path });

    try {
      const response = await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: {} });

      expect(response.statusCode).toBe(422);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.json()).toMatchObject({
        status: 422,
        code: 'VALIDATION_ERROR',
        instance: '/api/v1/tasks',
      });
    } finally {
      await app.close();
      await temporary.cleanup();
    }
  });
});
