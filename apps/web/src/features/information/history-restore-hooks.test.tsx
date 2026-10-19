// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { useExecuteRestore, useVersionPreview } from './api.js';

const confirmation = {
  id: '01J9CONF0000000000000000001',
  token: 'once-token',
  preview: {
    impact: '恢复到版本 2 会生成一个新的历史版本。',
    entityId: '01J5TASK000000000000000000',
    expectedVersion: 3,
    targetVersion: 2,
    changes: [{ field: 'title', before: '当前标题', after: '历史标题' }],
  },
};

const jsonResponse = (body: unknown): Response =>
  ({ ok: true, json: () => Promise.resolve(body) }) as Response;

describe('information history restore hooks', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/v1/session')
        return Promise.resolve(jsonResponse({ data: { csrfToken: 'test-csrf' } }));
      if (url.includes(':restore-preview'))
        return Promise.resolve(jsonResponse({ data: confirmation }));
      if (url.includes(':execute'))
        return Promise.resolve(jsonResponse({ data: { success: true } }));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a restore preview with field-level changes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useVersionPreview(), { wrapper });
    act(() => {
      result.current.mutate({
        entityId: confirmation.preview.entityId,
        targetVersion: confirmation.preview.targetVersion,
        expectedVersion: confirmation.preview.expectedVersion,
      });
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.preview.changes).toEqual([
      { field: 'title', before: '当前标题', after: '历史标题' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/entities/${confirmation.preview.entityId}/versions/2:restore-preview`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('executes restore through the confirmation endpoint and refreshes versions and change sets', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExecuteRestore(), { wrapper });
    act(() => {
      result.current.mutate(confirmation);
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/confirmations/${confirmation.id}:execute`,
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['entity-versions'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['change-sets'] });
    });
  });
});
