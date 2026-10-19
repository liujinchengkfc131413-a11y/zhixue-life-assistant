// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: { isPending: false, mutate: vi.fn() },
  update: { isPending: false, mutate: vi.fn() },
  remove: { isPending: false, mutate: vi.fn() },
  record: { isPending: false, mutate: vi.fn() },
}));

vi.mock('./api.js', () => ({
  useGoalMetrics: () => ({
    data: {
      goalId: 'goal-1',
      goalVersion: 4,
      autoProgress: 50,
      displayProgress: 80,
      progressMode: 'MANUAL_OVERRIDE',
      metrics: [
        {
          id: 'metric-1',
          goalId: 'goal-1',
          name: '累计减重',
          metricType: 'NUMBER',
          unit: 'kg',
          startValue: 0,
          targetValue: 2,
          direction: 'INCREASE',
          weight: 1,
          latestValue: 1,
          latestRecordedAt: '2026-09-01T00:00:00.000Z',
          progressPercent: 50,
        },
      ],
      entries: [],
    },
    isLoading: false,
    isError: false,
  }),
  useCreateGoalMetric: () => mocks.create,
  useUpdateGoalMetric: () => mocks.update,
  useDeleteGoalMetric: () => mocks.remove,
  useRecordGoalProgress: () => mocks.record,
}));

import { GoalMetricsEditor } from './goal-metrics-editor.js';

describe('GoalMetricsEditor', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('creates and edits a metric using the current goal aggregate version', async () => {
    const user = userEvent.setup();
    render(<GoalMetricsEditor goalId="goal-1" />);
    const region = screen.getByRole('region', { name: '目标量化指标' });

    await user.type(within(region).getByLabelText('指标名称'), '每周运动');
    await user.type(within(region).getByLabelText('目标值'), '3');
    await user.click(within(region).getByRole('button', { name: '添加指标' }));
    expect(mocks.create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4, name: '每周运动', targetValue: 3 }),
      expect.any(Object),
    );

    await user.click(within(region).getByRole('button', { name: '编辑' }));
    const names = within(region).getAllByLabelText('指标名称');
    const existingName = names[0];
    if (existingName === undefined) throw new Error('测试缺少现有指标名称。');
    await user.clear(existingName);
    await user.type(existingName, '累计减重（公斤）');
    await user.click(within(region).getByRole('button', { name: '保存指标' }));
    expect(mocks.update.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'metric-1', version: 4, name: '累计减重（公斤）' }),
      expect.any(Object),
    );
  });

  it('records progress and confirms metric deletion without changing manual progress mode', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<GoalMetricsEditor goalId="goal-1" />);
    const region = screen.getByRole('region', { name: '目标量化指标' });

    expect(within(region).getByText(/手动覆盖中/)).toBeTruthy();
    await user.type(within(region).getByLabelText('记录当前值'), '1.5');
    await user.type(within(region).getByLabelText('备注'), '第二周');
    await user.click(within(region).getByRole('button', { name: '记录进度' }));
    expect(mocks.record.mutate).toHaveBeenCalledWith(
      { version: 4, metricId: 'metric-1', value: 1.5, note: '第二周' },
      expect.any(Object),
    );

    await user.click(within(region).getByRole('button', { name: '删除' }));
    expect(mocks.remove.mutate).toHaveBeenCalledWith({ id: 'metric-1', version: 4 });
  });
});
