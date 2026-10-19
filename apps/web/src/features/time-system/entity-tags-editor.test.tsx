// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  add: { isPending: false, isError: false, mutate: vi.fn() },
  remove: { isPending: false, isError: false, mutate: vi.fn() },
}));

vi.mock('../settings/api.js', () => ({
  useTags: () => ({
    data: [
      { id: 'tag-current', name: '当前标签', colorToken: null, description: null, version: 1 },
      { id: 'tag-new', name: '可选标签', colorToken: null, description: null, version: 1 },
    ],
  }),
}));

vi.mock('./api.js', () => ({
  useEntityTags: () => ({
    data: [
      { id: 'tag-current', name: '当前标签', colorToken: null, description: null, version: 1 },
    ],
  }),
  useAddEntityTag: () => mocks.add,
  useRemoveEntityTag: () => mocks.remove,
}));

import { EntityTagsEditor } from './entity-tags-editor.js';

describe('EntityTagsEditor', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows assigned tags and wires add and remove with the current entity version', async () => {
    const user = userEvent.setup();
    render(<EntityTagsEditor entityId="task-1" version={4} />);

    expect(screen.getByRole('region', { name: '对象标签' }).textContent).toContain('当前标签');
    await user.selectOptions(screen.getByLabelText('选择标签'), 'tag-new');
    await user.click(screen.getByRole('button', { name: '添加标签' }));
    expect(mocks.add.mutate).toHaveBeenCalledWith(
      { entityId: 'task-1', version: 4, tagId: 'tag-new' },
      expect.any(Object),
    );

    await user.click(screen.getByRole('button', { name: '移除标签' }));
    expect(mocks.remove.mutate).toHaveBeenCalledWith({
      entityId: 'task-1',
      version: 4,
      tagId: 'tag-current',
    });
  });
});
