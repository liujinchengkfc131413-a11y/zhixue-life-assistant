// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { DiagnosticsPanel } from './diagnostics-panel.js';

vi.mock('../features/settings/api.js', () => ({
  useDiagnostics: () => ({
    isPending: false,
    isError: false,
    data: {
      appVersion: '0.1.0',
      schemaVersion: 17,
      dataDirectoryId: '01K26T7Y000000000000000000',
      generatedAt: '2026-08-11T00:00:00.000Z',
      uptimeSeconds: 7_200,
      backgroundJobs: { pending: 1, running: 0, failed: 2 },
      disk: { freeBytes: 1_048_576, totalBytes: 4_194_304 },
      logs: [
        { name: 'app.log', bytes: 5_242_880 },
        { name: 'app.log.1', bytes: 1_024 },
      ],
      logTail: '{"time":"2026-08-11T00:00:00.000Z","category":"database","msg":"数据库迁移完成"}',
    },
  }),
  useExportDiagnostics: () => ({
    isPending: false,
    data: undefined,
    mutate: vi.fn(),
  }),
}));

describe('DiagnosticsPanel', () => {
  it('renders sanitized diagnostics and exposes copy/export actions', () => {
    render(<DiagnosticsPanel />);

    expect(screen.getByText('诊断信息')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByText('01K26T7Y000000000000000000')).toBeInTheDocument();
    expect(screen.getByText('2 小时 0 分钟')).toBeInTheDocument();
    expect(screen.getByText('待处理 1 · 运行中 0 · 失败 2')).toBeInTheDocument();
    expect(screen.getByText('复制诊断信息')).toBeInTheDocument();
    expect(screen.getByText('导出诊断包')).toBeInTheDocument();
    expect(screen.getByText('查看脱敏日志尾部')).toBeInTheDocument();
    expect(screen.getByText(/数据库迁移完成/)).toBeInTheDocument();
  });
});
