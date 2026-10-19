// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelfMediaContentEditor, SelfMediaCreateForm } from './work-page.js';

const createClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const renderWithClient = (node: React.ReactNode) => {
  const client = createClient();
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('self-media form drafts', () => {
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
      const isEdit = url.includes('SELF_MEDIA_CONTENT%3Aedit%3Acontent-1');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: isEdit
              ? {
                  content: {
                    title: '恢复编辑标题',
                    platform: '视频平台',
                    plannedPublishAt: '2026-09-20',
                    idea: '恢复选题说明',
                    script: '恢复的长脚本正文',
                  },
                  updatedAt: '2026-09-01T10:00:00.000Z',
                }
              : {
                  content: {
                    title: '恢复创建标题',
                    contentType: 'ARTICLE',
                    platform: '文章平台',
                    idea: '恢复灵感',
                  },
                  updatedAt: '2026-09-01T09:00:00.000Z',
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

  it('restores the create draft and clears it after a successful create', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <SelfMediaCreateForm
        visible
        categoryId="category-media"
        isPending={false}
        onCreate={onCreate}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('内容标题').value).toBe('恢复创建标题');
    });
    expect(screen.getByLabelText<HTMLSelectElement>('内容类型').value).toBe('ARTICLE');
    await user.click(screen.getByRole('button', { name: '创建内容' }));
    expect(onCreate).toHaveBeenCalledWith(
      {
        categoryId: 'category-media',
        title: '恢复创建标题',
        contentType: 'ARTICLE',
        platform: '文章平台',
        idea: '恢复灵感',
      },
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('SELF_MEDIA_CONTENT%3Acreate%3Anew'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('saves the dirty create form immediately when it is collapsed', async () => {
    const user = userEvent.setup();
    const props = {
      categoryId: 'category-media',
      isPending: false,
      onCreate: vi.fn(),
      onClose: vi.fn(),
    };
    const view = renderWithClient(<SelfMediaCreateForm {...props} visible />);
    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('内容标题').value).toBe('恢复创建标题');
    });
    await user.clear(screen.getByLabelText('内容标题'));
    await user.type(screen.getByLabelText('内容标题'), '关闭前保存');
    fetchMock.mockClear();
    view.rerender(
      <QueryClientProvider client={createClient()}>
        <SelfMediaCreateForm {...props} visible={false} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('SELF_MEDIA_CONTENT%3Acreate%3Anew'),
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(JSON.stringify(fetchMock.mock.calls)).toContain('关闭前保存');
    });
  });

  it('uses an entity-specific edit key and clears after a successful save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <SelfMediaContentEditor
        item={{
          id: 'content-1',
          version: 3,
          title: '原标题',
          platform: null,
          plannedPublishAt: null,
          idea: null,
          script: null,
        }}
        isPending={false}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('编辑内容标题').value).toBe('恢复编辑标题');
    });
    expect(screen.getByLabelText<HTMLTextAreaElement>('编辑脚本正文').value).toBe(
      '恢复的长脚本正文',
    );
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'content-1',
        version: 3,
        title: '恢复编辑标题',
        script: '恢复的长脚本正文',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('SELF_MEDIA_CONTENT%3Aedit%3Acontent-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
