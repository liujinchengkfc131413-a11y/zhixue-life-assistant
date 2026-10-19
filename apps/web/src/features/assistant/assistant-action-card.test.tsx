// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiActionCard } from './assistant-page.js';

describe('AI action confirmation card', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the persisted preview and confirms through the action endpoint', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const confirmed = init?.method === 'POST';
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: confirmed
              ? {
                  action: {
                    id: 'action-1',
                    actionType: 'DELETE_RECORD',
                    preview: { count: 1 },
                    status: 'EXECUTED',
                    errorCode: null,
                  },
                }
              : {
                  id: 'action-1',
                  actionType: 'DELETE_RECORD',
                  preview: { count: 1 },
                  status: 'AWAITING_CONFIRMATION',
                  errorCode: null,
                },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AiActionCard actionId="action-1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('DELETE_RECORD')).toBeInTheDocument();
    expect(screen.getByText('{"count":1}')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确认执行' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/ai/actions/action-1:confirm', {
        method: 'POST',
      });
    });
  });
});
