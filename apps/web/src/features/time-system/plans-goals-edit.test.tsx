// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GoalEditForm, PlanEditForm } from './plans-goals-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('goal and plan lifecycle edit forms', () => {
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
      const isGoal = url.includes('GOAL%3Aedit%3Agoal-1');
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              content: isGoal
                ? {
                    title: '恢复目标编辑',
                    description: '恢复后的目标说明',
                    status: 'PAUSED',
                    startDate: '2026-09-01',
                    endDate: '2026-12-31',
                  }
                : {
                    title: '恢复计划编辑',
                    description: '恢复后的计划说明',
                    status: 'COMPLETED',
                    priority: 'HIGH',
                    startDate: '2026-09-01',
                    endDate: '2026-10-31',
                  },
              updatedAt: '2026-09-02T03:00:00.000Z',
            },
          }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('restores goal fields and status, then clears the entity draft after save', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDelete = vi.fn();
    const onSave = vi.fn((_value: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <GoalEditForm
        goal={{
          id: 'goal-1',
          version: 2,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          categoryId: 'category-1',
          title: '原目标',
          description: null,
          goalType: 'OUTCOME',
          status: 'ACTIVE',
          startDate: '2026-09-01',
          endDate: null,
          horizon: 'SHORT_TERM',
          autoProgress: 10,
          manualProgress: null,
          progressMode: 'AUTO',
          displayProgress: 10,
        }}
        relatedPlans={[{ id: 'plan-1', title: '关联计划', status: 'ACTIVE' }]}
        relatedTasks={[{ id: 'task-1', title: '关联任务', status: 'TODO' }]}
        isPending={false}
        onSave={onSave}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('目标名称').value).toBe('恢复目标编辑');
    });
    expect(screen.getByLabelText<HTMLSelectElement>('目标状态').value).toBe('PAUSED');
    expect(screen.getByRole('region', { name: '目标关联详情' }).textContent).toContain('关联计划');
    expect(screen.getByRole('region', { name: '目标关联详情' }).textContent).toContain('关联任务');
    await user.click(screen.getByRole('button', { name: '保存目标' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: '恢复目标编辑', status: 'PAUSED' }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('GOAL%3Aedit%3Agoal-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '移入回收站' }));
    expect(onDelete).toHaveBeenCalledWith(expect.any(Function));
  });

  it('restores plan fields, status and priority, then clears the entity draft after save', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDelete = vi.fn();
    const onSave = vi.fn((_value: unknown, onSuccess: () => void) => {
      onSuccess();
    });
    renderWithClient(
      <PlanEditForm
        plan={{
          id: 'plan-1',
          version: 4,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          goalId: 'goal-1',
          categoryId: 'category-1',
          title: '原计划',
          description: null,
          status: 'ACTIVE',
          priority: 'NORMAL',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          autoProgress: 20,
          manualProgress: null,
          progressMode: 'AUTO',
          displayProgress: 20,
        }}
        relatedGoal={{ id: 'goal-1', title: '所属目标' }}
        relatedTasks={[{ id: 'task-2', title: '计划任务', status: 'IN_PROGRESS' }]}
        isPending={false}
        onSave={onSave}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('计划名称').value).toBe('恢复计划编辑');
    });
    expect(screen.getByLabelText<HTMLSelectElement>('计划状态').value).toBe('COMPLETED');
    expect(screen.getByLabelText<HTMLSelectElement>('优先级').value).toBe('HIGH');
    expect(screen.getByRole('region', { name: '计划关联详情' }).textContent).toContain(
      '所属目标：所属目标 · 1 个任务',
    );
    expect(screen.getByRole('region', { name: '计划关联详情' }).textContent).toContain('计划任务');
    await user.click(screen.getByRole('button', { name: '保存计划' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '恢复计划编辑',
        status: 'COMPLETED',
        priority: 'HIGH',
      }),
      expect.any(Function),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('PLAN%3Aedit%3Aplan-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '移入回收站' }));
    expect(onDelete).toHaveBeenCalledWith(expect.any(Function));
  });
});
