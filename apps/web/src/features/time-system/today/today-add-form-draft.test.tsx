// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TodayAddForm } from './today-add-form.js';

describe('TodayAddForm drafts', () => {
  const fetchMock = vi.fn();
  const createTask = vi.fn();
  const createEvent = vi.fn();

  beforeEach(() => {
    createTask.mockReset();
    createEvent.mockReset();
    createTask.mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );
    createEvent.mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/v1/session')
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { csrfToken: 'test-csrf' } }),
        });
      if (init?.method === 'DELETE' || init?.method === 'PUT')
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
      const isTask = url.includes('TASK%3Acreate%3Anew');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              content: isTask
                ? {
                    title: '恢复任务草稿',
                    area: 'WORK',
                    priority: 'HIGH',
                    estimatedMinutes: 90,
                    dueAt: '2026-09-02T12:00',
                  }
                : {
                    title: '恢复日程草稿',
                    area: 'WORK',
                    priority: 'NORMAL',
                    eventStart: '2026-09-02T10:00',
                    eventEnd: '2026-09-02T11:00',
                  },
              updatedAt: '2026-09-01T08:00:00.000Z',
            },
          }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    { mode: 'TASK', tab: '弹性任务', title: '恢复任务草稿', mutation: createTask },
    { mode: 'EVENT', tab: '固定日程', title: '恢复日程草稿', mutation: createEvent },
  ])(
    'restores and clears the $mode draft after formal save',
    async ({ mode, tab, title, mutation }) => {
      const user = userEvent.setup();
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={client}>
          <TodayAddForm
            categories={[{ id: 'category-work', name: '工作', parentArea: 'WORK' }]}
            createTask={{ mutate: createTask, isPending: false }}
            createEvent={{ mutate: createEvent, isPending: false }}
          />
        </QueryClientProvider>,
      );
      await user.click(screen.getByRole('button', { name: '添加事项' }));
      if (mode === 'EVENT') await user.click(screen.getByRole('tab', { name: tab }));

      await waitFor(() => {
        expect(screen.getByLabelText<HTMLInputElement>('事项标题').value).toBe(title);
      });
      expect(screen.getByText(/已恢复 .* 的未保存草稿/)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: '添加并自动安排' }));
      expect(mutation).toHaveBeenCalled();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(`${mode}%3Acreate%3Anew`),
          expect.objectContaining({ method: 'DELETE' }),
        );
      });
    },
  );
});
