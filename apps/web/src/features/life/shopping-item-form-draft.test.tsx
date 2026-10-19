// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShoppingItemCreateForm, ShoppingItemEditor } from './life-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('shopping item form drafts', () => {
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
      const isEdit = url.includes('SHOPPING_ITEM%3Aedit%3Aitem-1');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              content: isEdit
                ? {
                    name: '恢复编辑咖啡豆',
                    productCategory: '食品',
                    quantity: '2',
                    unit: '袋',
                    price: '68.5',
                    priority: 'HIGH',
                    status: 'RESEARCHING',
                    channel: '线下店',
                  }
                : {
                    name: '恢复待购键盘',
                    productCategory: '数码',
                    quantity: '1',
                    unit: '个',
                    price: '599',
                    priority: 'URGENT',
                    channel: '官网',
                  },
              updatedAt: '2026-09-01T13:00:00.000Z',
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

  it('restores the create draft and clears it after item creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <ShoppingItemCreateForm
        categoryId="category-shopping"
        isPending={false}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('新增待购商品').value).toBe('恢复待购键盘');
    });
    expect(screen.getByLabelText<HTMLInputElement>('新增待购计划单价').value).toBe('599');
    expect(screen.getByLabelText<HTMLSelectElement>('新增待购优先级').value).toBe('URGENT');
    await user.click(screen.getByRole('button', { name: '加入清单' }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'category-shopping',
        name: '恢复待购键盘',
        productCategory: '数码',
        price: '599',
        channel: '官网',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('SHOPPING_ITEM%3Acreate%3Anew'),
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
      <ShoppingItemEditor
        item={{
          id: 'item-1',
          version: 3,
          name: '原商品',
          productCategory: null,
          quantity: 1,
          unit: null,
          plannedUnitPriceMinor: null,
          priority: 'NORMAL',
          status: 'WANTED',
          purchaseChannel: null,
        }}
        isPending={false}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('编辑待购商品名称').value).toBe(
        '恢复编辑咖啡豆',
      );
    });
    expect(screen.getByLabelText<HTMLInputElement>('编辑待购数量').value).toBe('2');
    expect(screen.getByLabelText<HTMLSelectElement>('编辑待购状态').value).toBe('RESEARCHING');
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        version: 3,
        name: '恢复编辑咖啡豆',
        quantity: '2',
        price: '68.5',
        priority: 'HIGH',
        status: 'RESEARCHING',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('SHOPPING_ITEM%3Aedit%3Aitem-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
