// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MealPlanCreateForm, MealRecordCreateForm } from './life-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('diet form drafts', () => {
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
      const isRecord = url.includes('MEAL_RECORD%3Acreate%3Anew');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              content: isRecord
                ? {
                    title: '恢复午餐记录',
                    date: '2026-09-02',
                    mealType: 'LUNCH',
                    calories: '520',
                    amount: '36.5',
                    merchant: '社区餐厅',
                  }
                : {
                    title: '恢复早餐计划',
                    date: '2026-09-03',
                    mealType: 'BREAKFAST',
                    recipeId: 'recipe-1',
                  },
              updatedAt: '2026-09-02T01:00:00.000Z',
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

  it('restores and clears a meal plan draft after successful creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <MealPlanCreateForm
        categoryId="diet-category"
        recipes={[{ id: 'recipe-1', name: '燕麦碗' }]}
        isPending={false}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText<HTMLInputElement>('餐食名称').value).toBe('恢复早餐计划');
    });
    await user.click(screen.getByRole('button', { name: '加入餐食计划' }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'diet-category',
        title: '恢复早餐计划',
        recipeId: 'recipe-1',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('MEAL_PLAN%3Acreate%3Anew'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('restores and clears a meal record draft after successful creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <MealRecordCreateForm categoryId="diet-category" isPending={false} onCreate={onCreate} />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText<HTMLInputElement>('吃了什么').value).toBe('恢复午餐记录');
    });
    expect(screen.getByPlaceholderText<HTMLInputElement>('餐饮支出（元）').value).toBe('36.5');
    await user.click(screen.getByRole('button', { name: '记录' }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'diet-category',
        title: '恢复午餐记录',
        calories: '520',
        amount: '36.5',
        merchant: '社区餐厅',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('MEAL_RECORD%3Acreate%3Anew'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
