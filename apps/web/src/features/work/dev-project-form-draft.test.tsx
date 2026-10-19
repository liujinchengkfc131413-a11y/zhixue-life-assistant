// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevProjectCreateForm, DevProjectEditor } from './work-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('development project form drafts', () => {
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
      const isEdit = url.includes('DEV_PROJECT%3Aedit%3Aproject-1');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: isEdit
              ? {
                  content: {
                    name: '恢复编辑项目',
                    summary: '恢复的项目长概览',
                    status: 'ACTIVE',
                    targetDate: '2026-10-15',
                  },
                  updatedAt: '2026-09-01T11:00:00.000Z',
                }
              : {
                  content: { name: '恢复新项目', summary: '恢复的一句话概览' },
                  updatedAt: '2026-09-01T10:30:00.000Z',
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

  it('restores the create draft and clears it after project creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <DevProjectCreateForm
        categoryId="category-development"
        isPending={false}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('新项目名称').value).toBe('恢复新项目');
    });
    expect(screen.getByLabelText<HTMLInputElement>('新项目概览').value).toBe('恢复的一句话概览');
    await user.click(screen.getByRole('button', { name: '新增项目' }));
    expect(onCreate).toHaveBeenCalledWith(
      {
        categoryId: 'category-development',
        name: '恢复新项目',
        summary: '恢复的一句话概览',
      },
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('DEV_PROJECT%3Acreate%3Anew'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('restores an entity-specific edit draft and clears it after saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <DevProjectEditor
        project={{
          id: 'project-1',
          version: 4,
          name: '原项目',
          summary: null,
          status: 'PLANNING',
          targetDate: null,
        }}
        isPending={false}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('编辑项目名称').value).toBe('恢复编辑项目');
    });
    expect(screen.getByLabelText<HTMLSelectElement>('编辑项目状态').value).toBe('ACTIVE');
    expect(screen.getByLabelText<HTMLInputElement>('编辑项目目标日期').value).toBe('2026-10-15');
    await user.click(screen.getByRole('button', { name: '保存项目' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'project-1',
        version: 4,
        name: '恢复编辑项目',
        summary: '恢复的项目长概览',
        status: 'ACTIVE',
        targetDate: '2026-10-15',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('DEV_PROJECT%3Aedit%3Aproject-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
