// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { buildFormDraftKey, useFormDraft } from './form-draft.js';

const jsonResponse = (body: unknown): Response =>
  ({ ok: true, json: () => Promise.resolve(body) }) as Response;

describe('form draft adapter', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/v1/session')
        return Promise.resolve(jsonResponse({ data: { csrfToken: 'test-csrf' } }));
      if (init?.method === 'PUT') return Promise.resolve(jsonResponse({ data: {} }));
      if (init?.method === 'DELETE') return Promise.resolve(jsonResponse({ data: null }));
      return Promise.resolve(
        jsonResponse({
          data: {
            draftKey: 'TASK:create:new',
            entityId: null,
            formType: 'TASK',
            content: { title: '恢复的任务' },
            updatedAt: '2026-09-01T08:00:00.000Z',
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds stable keys that separate create and edit drafts', () => {
    expect(buildFormDraftKey('TASK', 'create')).toBe('TASK:create:new');
    expect(buildFormDraftKey('TASK', 'edit', 'task-1')).toBe('TASK:edit:task-1');
  });

  it('restores once, debounces dirty saves, and clears the same key', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const onRestore = vi.fn();
    const { result, rerender } = renderHook(
      ({ title, dirty }) =>
        useFormDraft({
          formType: 'TASK',
          mode: 'create',
          enabled: true,
          dirty,
          value: { title },
          parse: (value) =>
            typeof value === 'object' && value !== null && 'title' in value
              ? { title: String(value.title) }
              : undefined,
          onRestore,
          debounceMs: 10,
        }),
      { initialProps: { title: '', dirty: false }, wrapper },
    );

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledWith({ title: '恢复的任务' }, '2026-09-01T08:00:00.000Z');
    });
    rerender({ title: '新的任务', dirty: true });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/drafts/TASK%3Acreate%3Anew',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            entityId: null,
            formType: 'TASK',
            content: { title: '新的任务' },
          }),
        }),
      );
    });
    expect(onRestore).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.clear();
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/drafts/TASK%3Acreate%3Anew',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
