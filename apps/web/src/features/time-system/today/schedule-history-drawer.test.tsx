// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScheduleHistoryDrawer } from './schedule-history-drawer.js';

vi.mock('../api.js', () => ({
  useTaskScheduleHistory: () => ({
    data: {
      taskId: '01J5TASK000000000000000000',
      entries: [
        {
          runId: 'run-overdue',
          trigger: 'OVERDUE',
          occurredAt: '2026-08-11T06:00:00.000Z',
          kind: 'RESCHEDULED',
          reason: null,
          previousBlocks: [
            { startAt: '2026-08-11T04:00:00.000Z', endAt: '2026-08-11T05:00:00.000Z' },
          ],
          newBlocks: [{ startAt: '2026-08-11T07:00:00.000Z', endAt: '2026-08-11T08:00:00.000Z' }],
          warnings: [],
        },
        {
          runId: 'run-completed',
          trigger: 'TASK_COMPLETED',
          occurredAt: '2026-08-11T09:00:00.000Z',
          kind: 'RELEASED',
          reason: 'TASK_COMPLETED',
          previousBlocks: [
            { startAt: '2026-08-11T07:00:00.000Z', endAt: '2026-08-11T08:00:00.000Z' },
          ],
          newBlocks: [],
          warnings: [],
        },
        {
          runId: 'run-unscheduled',
          trigger: 'OVERDUE',
          occurredAt: '2026-08-11T10:00:00.000Z',
          kind: 'UNSCHEDULED',
          reason: null,
          previousBlocks: [],
          newBlocks: [],
          warnings: [
            { type: 'UNSCHEDULED', severity: 'WARNING', message: '仍有 60 分钟无法在截止前排入。' },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
}));

describe('ScheduleHistoryDrawer', () => {
  afterEach(() => {
    cleanup();
  });

  const renderDrawer = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ScheduleHistoryDrawer
          taskId="01J5TASK000000000000000000"
          taskTitle="逾期示例任务"
          onClose={() => undefined}
        />
      </QueryClientProvider>,
    );
  };

  it('renders a reschedule entry with previous and new block times and the overdue trigger', () => {
    renderDrawer();
    expect(screen.getByText('逾期示例任务')).toBeInTheDocument();
    expect(screen.getByText('已重排')).toBeInTheDocument();
    expect(screen.getAllByText(/逾期自动重排/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/原时间：/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/新时间：/)).toBeInTheDocument();
  });

  it('renders a completion release entry with the release reason', () => {
    renderDrawer();
    expect(screen.getByText('已释放')).toBeInTheDocument();
    expect(screen.getByText(/任务完成释放/)).toBeInTheDocument();
  });

  it('renders the failure warning of an unscheduled entry', () => {
    renderDrawer();
    expect(screen.getByText('未排入')).toBeInTheDocument();
    expect(screen.getByText('仍有 60 分钟无法在截止前排入。')).toBeInTheDocument();
  });
});
