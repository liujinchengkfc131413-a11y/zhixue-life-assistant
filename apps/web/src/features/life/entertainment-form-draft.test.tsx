// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntertainmentItemCreateForm } from './life-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('entertainment form draft', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
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
                title: '恢复旅行清单',
                itemType: 'TRIP',
                total: '1',
                unit: '次',
                note: '秋天去海边',
              },
              updatedAt: '2026-09-02T01:00:00.000Z',
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

  it('restores and clears an entertainment item draft after successful creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <EntertainmentItemCreateForm
        categoryId="entertainment-category"
        isPending={false}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText<HTMLInputElement>('娱乐条目名称').value).toBe(
        '恢复旅行清单',
      );
    });
    expect(screen.getByPlaceholderText<HTMLInputElement>('备注').value).toBe('秋天去海边');
    await user.click(screen.getByRole('button', { name: '加入清单' }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'entertainment-category',
        title: '恢复旅行清单',
        itemType: 'TRIP',
        total: '1',
        unit: '次',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('ENTERTAINMENT_ITEM%3Acreate%3Anew'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
