// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskItem, TodayPlanItem, WarningItem } from '../api.js';
import { TodayPlanColumn } from './today-plan-column.js';
import type { TodayPlanRailViewModel } from './today-scene-view-model.js';

const task = {
  id: 'task-1',
  version: 3,
  title: '完成 Phase 5',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  isFlexible: true,
  preferredArea: 'WORK',
  estimatedMinutes: 90,
  dueAt: '2026-08-15T06:00:00.000Z',
} as TaskItem;

const planItem = {
  id: 'block-1',
  entityId: task.id,
  title: task.title,
  kind: 'TASK',
  area: 'WORK',
  startAt: '2026-08-15T01:00:00.000Z',
  endAt: '2026-08-15T02:30:00.000Z',
  priority: 'HIGH',
} as TodayPlanItem;

const warning = {
  id: 'warning-1',
  entityId: task.id,
  warningType: 'DEADLINE_RISK',
  severity: 'WARNING',
  message: '距离截止时间较近。',
} as WarningItem;

const model: TodayPlanRailViewModel = {
  primary: [
    {
      item: planItem,
      task,
      temporalState: 'CURRENT',
      completed: false,
      warnings: [warning],
    },
  ],
  upcoming: [],
  flexible: [],
  unassignedWarnings: [],
};

const renderRail = ({ onReschedule }: { onReschedule?: () => void } = {}) => {
  const onSelectBlock = vi.fn();
  const onCompleteTask = vi.fn();
  const createTaskMutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) =>
    options?.onSuccess?.(),
  );
  const createEventMutate = vi.fn((_input: unknown, options?: { onSuccess?: () => void }) =>
    options?.onSuccess?.(),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TodayPlanColumn
        model={model}
        onSelectBlock={onSelectBlock}
        onSelectTask={vi.fn()}
        onCompleteTask={onCompleteTask}
        categories={[{ id: 'category-work', name: '工作', parentArea: 'WORK' }]}
        createTask={{ mutate: createTaskMutate, isPending: false }}
        createEvent={{ mutate: createEventMutate, isPending: false }}
        onReschedule={onReschedule}
      />
    </QueryClientProvider>,
  );
  return { onSelectBlock, onCompleteTask, createTaskMutate, createEventMutate };
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === '/api/v1/session')
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { csrfToken: 'test' } }),
        });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TodayPlanColumn', () => {
  it('keeps rescheduling as a secondary action in the Today Plan header', async () => {
    const user = userEvent.setup();
    const onReschedule = vi.fn();
    renderRail({ onReschedule });

    await user.click(screen.getByRole('button', { name: '重新安排今日' }));
    expect(onReschedule).toHaveBeenCalledTimes(1);
  });

  it('keeps primary actions and related warnings together', async () => {
    const user = userEvent.setup();
    const { onSelectBlock, onCompleteTask } = renderRail();

    expect(screen.getByText('进行中')).toBeTruthy();
    expect(screen.getByText(warning.message)).toBeTruthy();
    const planButton = screen.getByText(task.title).closest('button');
    expect(planButton).not.toBeNull();
    if (planButton === null) return;
    await user.click(planButton);
    expect(onSelectBlock).toHaveBeenCalledWith(planItem.id);
    await user.click(screen.getByRole('button', { name: '完成任务：完成 Phase 5' }));
    expect(onCompleteTask).toHaveBeenCalledWith(task.id, task.version);
  });

  it('opens the add form as a dialog and restores focus after Escape', async () => {
    const user = userEvent.setup();
    renderRail();
    const trigger = screen.getByRole('button', { name: '添加事项' });

    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: '添加事项' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '事项标题' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '添加事项' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps both task and fixed-event creation wired through the overlay', async () => {
    const user = userEvent.setup();
    const { createTaskMutate, createEventMutate } = renderRail();
    const trigger = screen.getByRole('button', { name: '添加事项' });

    await user.click(trigger);
    await user.type(screen.getByRole('textbox', { name: '事项标题' }), '整理发布清单');
    await user.click(screen.getByRole('button', { name: '添加并自动安排' }));
    expect(createTaskMutate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        categoryId: 'category-work',
        title: '整理发布清单',
        isFlexible: true,
      }),
    );
    expect(typeof createTaskMutate.mock.calls[0]?.[1]?.onSuccess).toBe('function');

    await user.click(trigger);
    await user.click(screen.getByRole('tab', { name: '固定日程' }));
    await user.type(screen.getByRole('textbox', { name: '事项标题' }), '阶段验收会议');
    await user.click(screen.getByRole('button', { name: '添加并自动安排' }));
    expect(createEventMutate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        categoryId: 'category-work',
        title: '阶段验收会议',
        isImmovable: true,
      }),
    );
    expect(typeof createEventMutate.mock.calls[0]?.[1]?.onSuccess).toBe('function');
  });
});
