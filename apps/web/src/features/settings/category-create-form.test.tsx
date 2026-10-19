// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryCreateForm } from './settings-page.js';

describe('CategoryCreateForm', () => {
  afterEach(() => {
    cleanup();
  });

  it('offers all eight templates and submits the selected stable code', () => {
    const onCreate = vi.fn();
    render(<CategoryCreateForm onCreate={onCreate} />);

    expect(screen.getByLabelText('分类模板').querySelectorAll('option')).toHaveLength(8);
    fireEvent.change(screen.getByLabelText('所属区域'), { target: { value: 'LIFE' } });
    fireEvent.change(screen.getByLabelText('分类模板'), { target: { value: 'FITNESS' } });
    fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: '力量训练' } });
    fireEvent.click(screen.getByRole('button', { name: '新增分类' }));

    expect(onCreate).toHaveBeenCalledWith(
      { parentArea: 'LIFE', moduleType: 'FITNESS', name: '力量训练' },
      expect.any(Function),
    );
  });

  it('defaults to Generic and clears only after a successful creation', () => {
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    render(<CategoryCreateForm onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: '其他事项' } });
    fireEvent.click(screen.getByRole('button', { name: '新增分类' }));

    expect(onCreate).toHaveBeenCalledWith(
      { parentArea: 'WORK', moduleType: 'GENERIC', name: '其他事项' },
      expect.any(Function),
    );
    expect(screen.getByLabelText('新分类名称')).toHaveValue('');
  });
});
