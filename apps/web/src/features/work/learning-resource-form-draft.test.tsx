// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearningResourceCreateForm, LearningResourceEditor } from './work-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('learning resource form drafts', () => {
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
      const isEdit = url.includes('LEARNING_RESOURCE%3Aedit%3Aresource-1');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: isEdit
              ? {
                  content: {
                    title: '恢复编辑课程',
                    author: '恢复讲师',
                    status: 'IN_PROGRESS',
                    progressCurrent: '8',
                    progressTotal: '20',
                    progressUnit: '章节',
                  },
                  updatedAt: '2026-09-01T12:00:00.000Z',
                }
              : {
                  content: { title: '恢复新书', resourceType: 'BOOK' },
                  updatedAt: '2026-09-01T11:30:00.000Z',
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

  it('restores the create draft and clears it after resource creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <LearningResourceCreateForm
        categoryId="category-learning"
        isPending={false}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('新学习资源名称').value).toBe('恢复新书');
    });
    expect(screen.getByLabelText<HTMLSelectElement>('新学习资源类型').value).toBe('BOOK');
    await user.click(screen.getByRole('button', { name: '新增' }));
    expect(onCreate).toHaveBeenCalledWith(
      { categoryId: 'category-learning', title: '恢复新书', resourceType: 'BOOK' },
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('LEARNING_RESOURCE%3Acreate%3Anew'),
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
      <LearningResourceEditor
        resource={{
          id: 'resource-1',
          version: 2,
          title: '原课程',
          author: null,
          status: 'PLANNED',
          progressCurrent: null,
          progressTotal: null,
          progressUnit: null,
        }}
        isPending={false}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('编辑学习资源名称').value).toBe(
        '恢复编辑课程',
      );
    });
    expect(screen.getByLabelText<HTMLInputElement>('编辑当前进度').value).toBe('8');
    expect(screen.getByLabelText<HTMLInputElement>('编辑总进度').value).toBe('20');
    await user.click(screen.getByRole('button', { name: '保存资源' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'resource-1',
        version: 2,
        title: '恢复编辑课程',
        author: '恢复讲师',
        status: 'IN_PROGRESS',
        progressCurrent: '8',
        progressTotal: '20',
        progressUnit: '章节',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('LEARNING_RESOURCE%3Aedit%3Aresource-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
