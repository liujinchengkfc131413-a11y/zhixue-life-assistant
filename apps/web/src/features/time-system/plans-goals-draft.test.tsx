// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mutations = vi.hoisted(() => ({ createGoal: vi.fn(), createPlan: vi.fn() }));

vi.mock('../settings/api.js', () => ({
  useSetupStatus: () => ({ isLoading: false, data: { initialized: true } }),
  useCategories: () => ({
    data: { data: [{ id: 'category-work', name: '工作', parentArea: 'WORK', isArchived: false }] },
  }),
}));
vi.mock('../settings/setup-page.js', () => ({ SetupPage: () => <div>setup</div> }));
vi.mock('./planning-views.js', () => ({ PlanningViews: () => <div>planning views</div> }));
vi.mock('./api.js', () => ({
  useGoals: () => ({
    data: [{ id: 'goal-existing', title: '已有目标', categoryId: 'category-work' }],
  }),
  usePlans: () => ({ data: [] }),
  useTasks: () => ({ data: [] }),
  useCreateGoal: () => ({ mutate: mutations.createGoal }),
  useCreatePlan: () => ({ mutate: mutations.createPlan }),
  useUpdateGoal: () => ({ isPending: false, mutate: vi.fn() }),
  useUpdatePlan: () => ({ isPending: false, mutate: vi.fn() }),
  useDeleteGoal: () => ({ isPending: false, mutate: vi.fn() }),
  useDeletePlan: () => ({ isPending: false, mutate: vi.fn() }),
}));

import { PlansGoalsPage } from './plans-goals-page.js';

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PlansGoalsPage />
    </QueryClientProvider>,
  );
};

describe('PlansGoalsPage form drafts', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mutations.createGoal.mockReset();
    mutations.createPlan.mockReset();
    mutations.createGoal.mockImplementation(
      (_input: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.(),
    );
    mutations.createPlan.mockImplementation(
      (_input: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.(),
    );
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/v1/session')
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { csrfToken: 'test-csrf' } }),
        });
      if (init?.method === 'DELETE' || init?.method === 'PUT')
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
      const isGoal = url.includes('GOAL%3Acreate%3Anew');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: isGoal
              ? {
                  content: {
                    title: '恢复目标草稿',
                    categoryId: 'category-work',
                    endDate: '2026-10-01',
                  },
                  updatedAt: '2026-09-01T08:00:00.000Z',
                }
              : {
                  content: {
                    title: '恢复计划草稿',
                    goalId: 'goal-existing',
                    endDate: '2026-09-20',
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

  it.each([
    { kind: '目标', field: '目标名称', restored: '恢复目标草稿', mutation: mutations.createGoal },
    { kind: '计划', field: '计划名称', restored: '恢复计划草稿', mutation: mutations.createPlan },
  ])(
    'restores and clears the $kind draft after formal save',
    async ({ kind, field, restored, mutation }) => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByRole('button', { name: '＋ 新建' }));
      await user.click(screen.getByRole('button', { name: `新建${kind}` }));

      await waitFor(() => {
        expect(screen.getByLabelText<HTMLInputElement>(field).value).toBe(restored);
      });
      expect(screen.getByText(/已恢复 .* 的未保存草稿/)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: `创建${kind}` }));
      expect(mutation).toHaveBeenCalled();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining(`${kind === '目标' ? 'GOAL' : 'PLAN'}%3Acreate%3Anew`),
          expect.objectContaining({ method: 'DELETE' }),
        );
      });
    },
  );
});
