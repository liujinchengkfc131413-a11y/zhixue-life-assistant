// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { SystemStatusPanel } from './system-status-panel.js';

vi.mock('../shared/api/client.js', () => ({
  apiClient: {
    GET: vi.fn().mockResolvedValue({
      data: {
        data: {
          state: 'DEGRADED',
          appVersion: '0.1.0',
          serverTime: '2026-08-11T00:00:00.000Z',
          timeZone: 'Asia/Shanghai',
          database: { connected: false, dataDirectoryConfigured: false },
          capabilities: { aiConfigured: false, schedulerAvailable: false },
          backgroundJobs: { pending: 2, running: 1, failed: 0 },
          disk: { freeBytes: 1_048_576, totalBytes: 4_194_304 },
        },
        meta: { requestId: 'test-request' },
      },
    }),
  },
}));

describe('SystemStatusPanel', () => {
  it('renders the local service status returned by the generated API contract', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SystemStatusPanel />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('等待初始化')).toBeInTheDocument();
    expect(screen.getByText('应用与后台服务状态')).toBeInTheDocument();
    expect(screen.getByText('未连接')).toBeInTheDocument();
    expect(screen.getByText('待处理 2 · 运行中 1')).toBeInTheDocument();
    expect(screen.getByText('可用 1.0 MB / 共 4.0 MB')).toBeInTheDocument();
  });
});
