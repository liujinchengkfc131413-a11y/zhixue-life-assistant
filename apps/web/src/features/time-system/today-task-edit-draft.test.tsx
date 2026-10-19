// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateTask: {
    isPending: false,
    isError: false,
    mutate: vi.fn<(input: unknown, options?: { onSuccess?: () => void }) => void>(),
  },
  deleteTask: {
    isPending: false,
    isError: false,
    mutate: vi.fn<(input: unknown, options?: { onSuccess?: () => void }) => void>(),
  },
  addDependency: {
    isPending: false,
    isError: false,
    mutate: vi.fn<(input: unknown, options?: { onSuccess?: () => void }) => void>(),
  },
  removeDependency: {
    isPending: false,
    isError: false,
    mutate: vi.fn<(input: unknown) => void>(),
  },
  createSubtask: {
    isPending: false,
    mutate: vi.fn<(input: unknown, options?: { onSuccess?: () => void }) => void>(),
  },
  completeTask: {
    isPending: false,
    mutate: vi.fn<(input: unknown, options?: { onSuccess?: () => void }) => void>(),
  },
}));

vi.mock('./api.js', () => ({
  useEvent: () => ({ data: undefined }),
  useUpdateTask: () => mocks.updateTask,
  useDeleteTask: () => mocks.deleteTask,
  useTaskDependencies: () => ({
    data: {
      taskId: 'task-42',
      predecessorTaskIds: ['task-before'],
      successorTaskIds: ['task-after'],
    },
  }),
  useAddTaskDependency: () => mocks.addDependency,
  useRemoveTaskDependency: () => mocks.removeDependency,
  useCreateSubtask: () => mocks.createSubtask,
  useCompleteTask: () => mocks.completeTask,
}));

vi.mock('../reminders/reminder-api.js', () => ({
  useReminders: () => ({ data: [], isLoading: false, isError: false }),
  useCreateReminder: () => ({ isPending: false, mutate: vi.fn() }),
  useRemoveReminder: () => ({ isPending: false, mutate: vi.fn() }),
}));

import { TaskDetail } from './today-page.js';

const renderWithClient = (node: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe('task edit draft', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mocks.updateTask.mutate.mockReset();
    mocks.deleteTask.mutate.mockReset();
    mocks.addDependency.mutate.mockReset();
    mocks.removeDependency.mutate.mockReset();
    mocks.createSubtask.mutate.mockReset();
    mocks.completeTask.mutate.mockReset();
    mocks.updateTask.mutate.mockImplementation(
      (_input: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );
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
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              content: {
                title: '恢复后的任务标题',
                priority: 'HIGH',
                dueAt: '2026-09-03T20:00',
                estimatedMinutes: 90,
              },
              updatedAt: '2026-09-02T02:00:00.000Z',
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

  it('restores the entity-specific edit draft and clears it after a successful save', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenTask = vi.fn();
    renderWithClient(
      <TaskDetail
        task={{
          id: 'task-42',
          version: 3,
          title: '原任务标题',
          priority: 'NORMAL',
          dueAt: '2026-09-03T10:00:00.000Z',
          estimatedMinutes: 30,
          status: 'TODO',
          categoryId: 'category-1',
          goalId: 'goal-1',
          preferredArea: 'WORK',
          isFlexible: true,
          isSplittable: false,
        }}
        relations={{
          goalTitle: '年度目标',
          planTitle: '九月计划',
          parentTaskTitle: '父任务',
          subtasks: [{ id: 'task-child', title: '一层子任务', status: 'TODO' }],
          dependencyCandidates: [
            { id: 'task-before', title: '前置任务', status: 'TODO' },
            { id: 'task-after', title: '后继任务', status: 'TODO' },
            { id: 'task-new', title: '可选前置任务', status: 'TODO' },
          ],
        }}
        onClose={onClose}
        onOpenHistory={vi.fn()}
        onOpenTask={onOpenTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>('标题').value).toBe('恢复后的任务标题');
    });
    expect(screen.getByLabelText<HTMLSelectElement>('优先级').value).toBe('HIGH');
    expect(screen.getByText(/已恢复/u)).toBeTruthy();
    const relationText = screen.getByRole('region', { name: '任务关联详情' }).textContent;
    expect(relationText).toContain('所属目标：年度目标');
    expect(relationText).toContain('所属计划：九月计划');
    expect(relationText).toContain('父任务：父任务');
    expect(relationText).toContain('一层子任务');
    await user.click(screen.getByRole('button', { name: '打开子任务' }));
    expect(onOpenTask).toHaveBeenCalledWith('task-child');

    await user.type(screen.getByLabelText('新建子任务'), '新增子任务');
    await user.click(screen.getByRole('button', { name: '新增子任务' }));
    const [subtaskInput] = mocks.createSubtask.mutate.mock.calls[0] ?? [];
    expect(subtaskInput).toEqual(
      expect.objectContaining({
        categoryId: 'category-1',
        goalId: 'goal-1',
        title: '新增子任务',
        dueAt: '2026-09-03T10:00:00.000Z',
      }),
    );
    expect(screen.getByRole('region', { name: '任务依赖' }).textContent).toContain('前置任务');
    expect(screen.getByRole('region', { name: '任务依赖' }).textContent).toContain(
      '后继任务：后继任务',
    );

    await user.selectOptions(screen.getByLabelText('选择前置任务'), 'task-new');
    await user.click(screen.getByRole('button', { name: '添加依赖' }));
    expect(mocks.addDependency.mutate).toHaveBeenCalledWith(
      { id: 'task-42', version: 3, predecessorTaskId: 'task-new' },
      expect.any(Object),
    );
    await user.click(screen.getByRole('button', { name: '解除依赖' }));
    expect(mocks.removeDependency.mutate).toHaveBeenCalledWith({
      id: 'task-42',
      version: 3,
      predecessorTaskId: 'task-before',
    });

    await user.click(screen.getByRole('button', { name: '完成任务' }));
    expect(mocks.completeTask.mutate).toHaveBeenCalledWith(
      { id: 'task-42', version: 3 },
      expect.any(Object),
    );

    await user.click(screen.getByRole('button', { name: '保存并重新安排' }));

    const [input, options] = mocks.updateTask.mutate.mock.calls[0] ?? [];
    expect(input).toEqual(
      expect.objectContaining({
        id: 'task-42',
        version: 3,
        title: '恢复后的任务标题',
        priority: 'HIGH',
        estimatedMinutes: 90,
      }),
    );
    expect(options?.onSuccess).toBeTypeOf('function');
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('TASK%3Aedit%3Atask-42'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '移入回收站' }));
    const [deleteInput, deleteOptions] = mocks.deleteTask.mutate.mock.calls[0] ?? [];
    expect(deleteInput).toEqual({ id: 'task-42', version: 3 });
    expect(deleteOptions?.onSuccess).toBeTypeOf('function');
  });
});
