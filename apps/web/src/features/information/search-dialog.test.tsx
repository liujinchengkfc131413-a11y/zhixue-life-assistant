// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSearch: vi.fn(),
}));

vi.mock('./api.js', () => ({
  useSearch: (query: string, filters: Record<string, string>) => {
    mocks.useSearch(query, filters);
    return {
      data: [
        {
          entityId: 'task-1',
          entityType: 'TASK',
          categoryId: 'category-1',
          title: 'Aurora 任务',
          snippet: '命中摘要',
          eventAt: '2026-09-10T01:00:00.000Z',
          updatedAt: '2026-09-03T00:00:00.000Z',
        },
        {
          entityId: 'attachment-1',
          entityType: 'ATTACHMENT',
          categoryId: null,
          title: 'Aurora.pdf',
          snippet: '附件描述',
          eventAt: null,
          updatedAt: '2026-09-03T00:00:00.000Z',
        },
      ],
      isFetching: false,
      isError: false,
    };
  },
}));

vi.mock('../settings/api.js', () => ({
  useCategories: () => ({
    data: {
      data: [
        {
          id: 'category-1',
          name: '生活项目',
          moduleType: 'GENERIC',
        },
      ],
    },
  }),
  useTags: () => ({ data: [{ id: 'tag-1', name: '重要' }] }),
}));

import { SearchDialog } from './search-dialog.js';

describe('A8 global search filters', () => {
  afterEach(() => {
    cleanup();
    mocks.useSearch.mockClear();
  });

  it('passes five filter dimensions and keeps a stable detail target', async () => {
    const user = userEvent.setup();
    render(<SearchDialog open onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/搜索任务/), 'Aurora');
    await user.click(screen.getByRole('button', { name: '任务' }));
    await user.selectOptions(screen.getByLabelText('模块'), 'GENERIC');
    await user.selectOptions(screen.getByLabelText('分类'), 'category-1');
    await user.type(screen.getByLabelText('状态'), 'todo');
    await user.selectOptions(screen.getByLabelText('标签'), 'tag-1');
    await user.type(screen.getByLabelText('开始日期'), '2026-09-01');
    await user.type(screen.getByLabelText('结束日期'), '2026-09-10');

    expect(mocks.useSearch).toHaveBeenLastCalledWith('Aurora', {
      entityType: 'TASK',
      module: 'GENERIC',
      categoryId: 'category-1',
      status: 'TODO',
      tagId: 'tag-1',
      from: '2026-08-31T16:00:00.000Z',
      to: '2026-09-10T16:00:00.000Z',
    });
    expect(screen.getByRole('button', { name: '全部' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Aurora 任务/ }).getAttribute('href')).toBe(
      '/?entityType=TASK&entityId=task-1',
    );
  });
});
