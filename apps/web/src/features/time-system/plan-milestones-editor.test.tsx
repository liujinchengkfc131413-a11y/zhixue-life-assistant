// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: { isPending: false, mutate: vi.fn() },
  update: { isPending: false, mutate: vi.fn() },
  remove: { isPending: false, mutate: vi.fn() },
}));

vi.mock('./api.js', () => ({
  usePlanMilestones: () => ({
    data: [
      {
        id: 'milestone-1',
        version: 3,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        planId: 'plan-1',
        title: '首个里程碑',
        description: '完成核心任务',
        dueAt: '2026-09-30T10:00:00.000Z',
        status: 'PENDING',
        achievedAt: null,
        linkedEntityIds: ['task-1'],
      },
    ],
    isLoading: false,
    isError: false,
  }),
  useCreatePlanMilestone: () => mocks.create,
  useUpdatePlanMilestone: () => mocks.update,
  useDeletePlanMilestone: () => mocks.remove,
}));

import { PlanMilestonesEditor } from './plan-milestones-editor.js';

const tasks = [
  {
    id: 'task-1',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    categoryId: 'category-1',
    planId: 'plan-1',
    goalId: null,
    parentTaskId: null,
    title: '任务一',
    description: null,
    status: 'TODO' as const,
    priority: 'NORMAL' as const,
    dueAt: '2026-09-20T10:00:00.000Z',
    estimatedMinutes: 30,
    isFlexible: true,
    isSplittable: false,
    preferredArea: 'WORK' as const,
    completedAt: null,
  },
  {
    id: 'task-2',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    categoryId: 'category-1',
    planId: 'plan-1',
    goalId: null,
    parentTaskId: null,
    title: '任务二',
    description: null,
    status: 'TODO' as const,
    priority: 'NORMAL' as const,
    dueAt: '2026-09-21T10:00:00.000Z',
    estimatedMinutes: 30,
    isFlexible: true,
    isSplittable: false,
    preferredArea: 'WORK' as const,
    completedAt: null,
  },
];

describe('PlanMilestonesEditor', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('creates a milestone with multiple task links and can mark an existing milestone achieved', async () => {
    const user = userEvent.setup();
    render(<PlanMilestonesEditor planId="plan-1" tasks={tasks} />);
    const region = screen.getByRole('region', { name: '计划里程碑' });

    await user.type(within(region).getByPlaceholderText('里程碑名称'), '第二阶段');
    const taskCheckboxes = within(region).getAllByRole('checkbox');
    const secondTaskCheckbox = taskCheckboxes[1];
    if (secondTaskCheckbox === undefined) throw new Error('测试缺少第二项任务。');
    await user.click(secondTaskCheckbox);
    await user.click(within(region).getByRole('button', { name: '添加里程碑' }));
    expect(mocks.create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '第二阶段', linkedEntityIds: ['task-2'] }),
      expect.any(Object),
    );

    await user.click(within(region).getByRole('button', { name: '标记达成' }));
    expect(mocks.update.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'milestone-1',
        version: 3,
        status: 'ACHIEVED',
        linkedEntityIds: ['task-1'],
      }),
    );
  });

  it('edits milestone fields and confirms soft deletion', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PlanMilestonesEditor planId="plan-1" tasks={tasks} />);
    const region = screen.getByRole('region', { name: '计划里程碑' });

    await user.click(within(region).getByRole('button', { name: '编辑' }));
    const title = within(region).getByLabelText('里程碑名称');
    await user.clear(title);
    await user.type(title, '调整后的里程碑');
    const secondTaskCheckbox = within(region).getAllByLabelText('任务二')[0];
    if (secondTaskCheckbox === undefined) throw new Error('测试缺少第二项任务。');
    await user.click(secondTaskCheckbox);
    await user.click(within(region).getByRole('button', { name: '保存里程碑' }));
    expect(mocks.update.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'milestone-1',
        version: 3,
        title: '调整后的里程碑',
        linkedEntityIds: ['task-1', 'task-2'],
      }),
      expect.any(Object),
    );

    cleanup();
    render(<PlanMilestonesEditor planId="plan-1" tasks={tasks} />);
    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(mocks.remove.mutate).toHaveBeenCalledWith({ id: 'milestone-1', version: 3 });
  });
});
