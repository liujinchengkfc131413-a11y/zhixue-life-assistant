// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkoutPlanCreateForm, WorkoutSessionCreateForm } from './life-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('fitness form drafts', () => {
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
      const isSession = url.includes('WORKOUT_SESSION%3Acreate%3Anew');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              content: isSession
                ? {
                    date: '2026-09-02',
                    planId: 'plan-1',
                    exerciseId: 'exercise-1',
                    reps: '10',
                    weight: '32.5',
                    calories: '280',
                    effort: '7',
                    note: '恢复训练记录',
                  }
                : {
                    name: '恢复力量计划',
                    description: '每周三次',
                    exerciseId: 'exercise-1',
                    sets: '4',
                    reps: '8-10',
                    weight: '35',
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

  it('restores and clears a workout session draft after successful creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <WorkoutSessionCreateForm
        categoryId="fitness-category"
        plans={[{ id: 'plan-1', name: '力量计划' }]}
        exercises={[{ id: 'exercise-1', name: '深蹲' }]}
        isPending={false}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText<HTMLInputElement>('训练备注').value).toBe('恢复训练记录');
    });
    await user.click(screen.getByRole('button', { name: '保存训练' }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'fitness-category',
        planId: 'plan-1',
        exerciseId: 'exercise-1',
        reps: '10',
        weight: '32.5',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('WORKOUT_SESSION%3Acreate%3Anew'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('restores and clears a workout plan draft after successful creation', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((_input: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <WorkoutPlanCreateForm
        categoryId="fitness-category"
        exercises={[{ id: 'exercise-1', name: '深蹲' }]}
        planCount={2}
        isPending={false}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText<HTMLInputElement>('训练计划名称').value).toBe(
        '恢复力量计划',
      );
    });
    await user.click(screen.getByRole('button', { name: '创建计划' }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'fitness-category',
        name: '恢复力量计划',
        exerciseId: 'exercise-1',
        sets: '4',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('WORKOUT_PLAN%3Acreate%3Anew'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
