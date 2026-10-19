// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RemindersPage } from './reminders-page.js';

vi.mock('./api.js', () => {
  const data = [
    {
      id: '01J9NOTIF000000000000000001',
      notificationType: 'REMINDER',
      targetEntityId: '01J5TASK000000000000000000',
      targetEntityType: 'TASK',
      title: '提醒：提交周报',
      body: '提前 30 分钟提醒。',
      severity: 'WARNING',
      scheduledAt: '2026-08-14T09:00:00.000Z',
      deliveredAt: '2026-08-14T09:00:00.000Z',
      readAt: null,
      snoozedUntil: null,
    },
    {
      id: '01J9NOTIF000000000000000002',
      notificationType: 'SYSTEM',
      targetEntityId: null,
      targetEntityType: null,
      title: '系统通知',
      body: '已生成备份。',
      severity: 'INFO',
      scheduledAt: '2026-08-14T08:00:00.000Z',
      deliveredAt: '2026-08-14T08:00:00.000Z',
      readAt: '2026-08-14T08:30:00.000Z',
      snoozedUntil: null,
    },
  ];
  return {
    useNotifications: () => ({
      data,
      isLoading: false,
      isError: false,
    }),
    useMarkNotificationRead: () => ({
      isPending: false,
      mutate: vi.fn(),
    }),
    useMarkAllNotificationsRead: () => ({
      isPending: false,
      mutate: vi.fn(),
    }),
    useSnoozeNotification: () => ({
      isPending: false,
      mutate: vi.fn(),
    }),
  };
});

describe('RemindersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unread and read notifications with actions', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RemindersPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('提醒：提交周报')).toBeInTheDocument();
      expect(screen.getByText('系统通知')).toBeInTheDocument();
      expect(screen.getByText('全部已读（1）')).toBeInTheDocument();
      expect(screen.getByText('标记已读')).toBeInTheDocument();
      expect(screen.getAllByText('稍后提醒')).toHaveLength(2);
      expect(screen.getByRole('link', { name: '查看详情' })).toHaveAttribute(
        'href',
        '/?entityType=TASK&entityId=01J5TASK000000000000000000',
      );
    });
  });
});
