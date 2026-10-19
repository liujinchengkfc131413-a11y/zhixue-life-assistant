// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateEvent: {
    isPending: false,
    isError: false,
    mutate: vi.fn<(input: unknown, options?: { onSuccess?: () => void }) => void>(),
  },
  deleteEvent: {
    isPending: false,
    isError: false,
    mutate: vi.fn<(input: unknown, options?: { onSuccess?: () => void }) => void>(),
  },
  createReminder: { isPending: false, isError: false, mutate: vi.fn() },
  removeReminder: { isPending: false, isError: false, mutate: vi.fn() },
}));

vi.mock('./api.js', () => ({
  useEvent: () => ({ data: undefined }),
  useUpdateEvent: () => mocks.updateEvent,
  useDeleteEvent: () => mocks.deleteEvent,
}));

vi.mock('../reminders/reminder-api.js', () => ({
  useReminders: () => ({
    data: [
      {
        id: 'reminder-1',
        triggerMode: 'OFFSET_BEFORE_START',
        triggerAt: null,
        offsetMinutes: 10,
        isEnabled: true,
        version: 2,
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateReminder: () => mocks.createReminder,
  useRemoveReminder: () => mocks.removeReminder,
}));

import { EventDetail } from './today-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('event lifecycle edit form', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mocks.updateEvent.mutate.mockReset();
    mocks.deleteEvent.mutate.mockReset();
    mocks.createReminder.mutate.mockReset();
    mocks.removeReminder.mutate.mockReset();
    mocks.updateEvent.mutate.mockImplementation(
      (_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/v1/session') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { csrfToken: 'test-csrf' } }),
        });
      }
      if (init?.method === 'PUT' || init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              content: {
                title: '恢复后的日程',
                description: '恢复说明',
                startAt: '2026-09-03T09:30',
                endAt: '2026-09-03T10:30',
                eventType: 'MEETING',
                priority: 'HIGH',
                isImmovable: true,
                allowOverlap: true,
                status: 'COMPLETED',
              },
              updatedAt: '2026-09-02T04:00:00.000Z',
            },
          }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('restores all editable fields and clears the entity draft after save', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithClient(
      <EventDetail
        event={{
          id: 'event-1',
          version: 5,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          categoryId: 'category-1',
          title: '原日程',
          description: null,
          startAt: '2026-09-03T01:00:00.000Z',
          endAt: '2026-09-03T02:00:00.000Z',
          timeZone: 'Asia/Shanghai',
          eventType: 'GENERAL',
          priority: 'NORMAL',
          isImmovable: false,
          allowOverlap: false,
          status: 'SCHEDULED',
        }}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('日程标题').value).toBe('恢复后的日程');
    });
    expect(screen.getByLabelText<HTMLSelectElement>('日程状态').value).toBe('COMPLETED');
    expect(screen.getByLabelText<HTMLInputElement>('不可移动').checked).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('明确允许与其他日程重叠').checked).toBe(true);

    await user.click(screen.getByRole('button', { name: '保存日程' }));
    const [input, options] = mocks.updateEvent.mutate.mock.calls[0] ?? [];
    expect(input).toEqual(
      expect.objectContaining({
        id: 'event-1',
        version: 5,
        title: '恢复后的日程',
        startAt: '2026-09-03T01:30:00.000Z',
        endAt: '2026-09-03T02:30:00.000Z',
        status: 'COMPLETED',
        isImmovable: true,
        allowOverlap: true,
      }),
    );
    expect(options?.onSuccess).toBeTypeOf('function');
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('EVENT%3Aedit%3Aevent-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '移入回收站' }));
    const [deleteInput, deleteOptions] = mocks.deleteEvent.mutate.mock.calls[0] ?? [];
    expect(deleteInput).toEqual({ id: 'event-1', version: 5 });
    expect(deleteOptions?.onSuccess).toBeTypeOf('function');
  });

  it('adds multiple event reminder modes and removes an existing reminder', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <EventDetail
        event={{
          id: 'event-1',
          version: 5,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          categoryId: 'category-1',
          title: '提醒验收日程',
          description: null,
          startAt: '2026-09-03T01:00:00.000Z',
          endAt: '2026-09-03T02:00:00.000Z',
          timeZone: 'Asia/Shanghai',
          eventType: 'GENERAL',
          priority: 'NORMAL',
          isImmovable: false,
          allowOverlap: false,
          status: 'SCHEDULED',
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('提前 10 分钟')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('日程提醒提前时间'), '60');
    await user.click(screen.getByRole('button', { name: '添加提醒' }));
    expect(mocks.createReminder.mutate).toHaveBeenLastCalledWith({
      targetEntityId: 'event-1',
      triggerMode: 'OFFSET_BEFORE_START',
      offsetMinutes: 60,
    });

    await user.selectOptions(screen.getByLabelText('日程提醒模式'), 'ABSOLUTE');
    const absoluteInput = screen.getByLabelText('日程提醒绝对时间');
    await user.clear(absoluteInput);
    await user.type(absoluteInput, '2026-09-03T08:30');
    await user.click(screen.getByRole('button', { name: '添加提醒' }));
    expect(mocks.createReminder.mutate).toHaveBeenLastCalledWith({
      targetEntityId: 'event-1',
      triggerMode: 'ABSOLUTE',
      triggerAt: '2026-09-03T00:30:00.000Z',
    });

    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(mocks.removeReminder.mutate).toHaveBeenCalledWith({
      id: 'reminder-1',
      expectedVersion: 2,
    });
  });
});
