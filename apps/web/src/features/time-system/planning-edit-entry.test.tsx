// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const plan = {
  id: 'plan-1',
  version: 1,
  title: '季度计划',
  status: 'ACTIVE' as const,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  autoProgress: 25,
  manualProgress: null,
  progressMode: 'AUTO' as const,
  displayProgress: 25,
};

const goal = {
  id: 'goal-1',
  version: 1,
  title: '年度目标',
  status: 'ACTIVE' as const,
  horizon: 'LONG_TERM' as const,
  autoProgress: 30,
  manualProgress: null,
  progressMode: 'AUTO' as const,
  displayProgress: 30,
};

vi.mock('./api.js', () => ({
  usePlanningKanban: () => ({
    data: [{ status: 'ACTIVE', plans: [plan] }],
    isLoading: false,
    isError: false,
  }),
  usePlanningCalendar: () => ({ data: [], isLoading: false, isError: false }),
  usePlanningTimeline: () => ({ data: [], isLoading: false, isError: false }),
  usePlanningGoalTree: () => ({
    data: [{ goal, plans: [{ plan, tasks: [] }], directTasks: [] }],
    isLoading: false,
    isError: false,
  }),
  useSetGoalProgress: () => ({ isPending: false, mutate: vi.fn() }),
  useSetPlanProgress: () => ({ isPending: false, mutate: vi.fn() }),
}));

import { PlanningViews } from './planning-views.js';

afterEach(cleanup);

describe('planning edit entries', () => {
  it('opens a plan editor from the kanban card', async () => {
    const user = userEvent.setup();
    const onEditPlan = vi.fn();
    render(
      <PlanningViews
        view="KANBAN"
        filters={{ range: 'WEEK' }}
        onEditGoal={vi.fn()}
        onEditPlan={onEditPlan}
      />,
    );

    await user.click(screen.getByRole('button', { name: '编辑计划' }));
    expect(onEditPlan).toHaveBeenCalledWith('plan-1');
  });

  it('opens goal and plan editors from the goal tree', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn();
    const onEditPlan = vi.fn();
    render(
      <PlanningViews
        view="GOAL_TREE"
        filters={{ range: 'WEEK' }}
        onEditGoal={onEditGoal}
        onEditPlan={onEditPlan}
      />,
    );

    await user.click(screen.getByRole('button', { name: '编辑目标' }));
    await user.click(screen.getByRole('button', { name: '编辑计划' }));
    expect(onEditGoal).toHaveBeenCalledWith('goal-1');
    expect(onEditPlan).toHaveBeenCalledWith('plan-1');
  });
});
