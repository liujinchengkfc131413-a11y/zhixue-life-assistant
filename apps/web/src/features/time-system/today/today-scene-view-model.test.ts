import { describe, expect, it } from 'vitest';
import type { TaskItem, TodayData, TodayPlanItem, WarningItem } from '../api.js';
import { toPressureVisualState } from '../pressure-visual-state.js';
import { buildTodayPlanRailViewModel, buildTodaySceneViewModel } from './today-scene-view-model.js';

const dayStart = Date.parse('2026-08-15T00:00:00+08:00');

const plan: TodayPlanItem[] = [
  {
    id: 'block-work',
    entityId: 'task-work',
    title: '专注工作',
    kind: 'TASK',
    area: 'WORK',
    startAt: '2026-08-15T01:00:00.000Z',
    endAt: '2026-08-15T02:00:00.000Z',
    priority: 'HIGH',
  },
  {
    id: 'block-life',
    entityId: 'task-life',
    title: '准备晚餐',
    kind: 'TASK',
    area: 'LIFE',
    startAt: '2026-08-15T10:00:00.000Z',
    endAt: '2026-08-15T11:00:00.000Z',
    priority: 'NORMAL',
  },
];

const today = {
  date: '2026-08-15',
  timeZone: 'Asia/Shanghai',
  serverNow: '2026-08-15T01:30:00.000Z',
  timelineVersion: 1,
  blocks: [
    {
      id: 'block-work',
      targetEntityId: 'task-work',
      title: '专注工作',
      blockType: 'TASK',
      area: 'WORK',
      startAt: '2026-08-15T01:00:00.000Z',
      endAt: '2026-08-15T02:00:00.000Z',
      source: 'RULE_ENGINE',
      isLocked: false,
      crossAreaWarning: false,
    },
    {
      id: 'block-life',
      targetEntityId: 'task-life',
      title: '准备晚餐',
      blockType: 'TASK',
      area: 'LIFE',
      startAt: '2026-08-15T10:00:00.000Z',
      endAt: '2026-08-15T11:00:00.000Z',
      source: 'RULE_ENGINE',
      isLocked: false,
      crossAreaWarning: false,
    },
  ],
  plan,
  freeTime: [],
  totals: { sleepMinutes: 480, workMinutes: 360, lifeMinutes: 60, freeMinutes: 540 },
  pressure: {
    score: 42,
    level: 'COMFORTABLE',
    algorithmVersion: 'pressure-v1',
    factors: [],
  },
  notifications: [],
  suggestions: [],
} as TodayData;

describe('buildTodaySceneViewModel', () => {
  it('derives current scene state and fountain input in one place', () => {
    const viewModel = buildTodaySceneViewModel({
      today,
      pressureVisual: toPressureVisualState(42, 'COMFORTABLE'),
      currentNow: Date.parse('2026-08-15T01:30:00.000Z'),
      dayStart,
    });

    expect(viewModel.activeArea).toBe('WORK');
    expect(viewModel.currentBlock?.id).toBe('block-work');
    expect(viewModel.currentPlanItem?.id).toBe('block-work');
    expect(viewModel.currentStateLabel).toBe('工作 · 进行中');
    expect(viewModel.statusSentence).toBe('节奏平稳，一切都在轨道上。');
    expect(viewModel.nowMinute).toBe(570);
    expect(viewModel.upcomingPlan.map((item) => item.id)).toEqual(['block-life']);
    expect(viewModel.fountainModel?.time.activeArea).toBe('WORK');
    expect(viewModel.statusItems).toHaveLength(4);
    expect(viewModel.statusItems.find((item) => item.kind === 'WORK')?.active).toBe(true);
    expect(viewModel.statusItems.reduce((sum, item) => sum + item.minutes, 0)).toBe(1_440);
  });

  it('uses end-exclusive block boundaries to avoid an overlap frame', () => {
    const viewModel = buildTodaySceneViewModel({
      today,
      currentNow: Date.parse('2026-08-15T02:00:00.000Z'),
      dayStart,
    });

    expect(viewModel.currentBlock).toBeUndefined();
    expect(viewModel.currentPlanItem).toBeUndefined();
    expect(viewModel.activeArea).toBe('FREE');
    expect(viewModel.currentStateLabel).toBe('空闲');
  });

  it('keeps a complete loading model before Today data arrives', () => {
    const viewModel = buildTodaySceneViewModel({ currentNow: dayStart, dayStart });

    expect(viewModel.activeArea).toBe('FREE');
    expect(viewModel.currentStateLabel).toBe('正在读取…');
    expect(viewModel.statusSentence).toBe('正在感知今天的节奏…');
    expect(viewModel.plan).toEqual([]);
    expect(viewModel.fountainModel).toBeUndefined();
    expect(viewModel.statusItems.every((item) => item.minutes === 0)).toBe(true);
  });

  it('honors the explicit plan projection supplied by the page', () => {
    const override: readonly TodayPlanItem[] = plan.slice(1, 2);
    const viewModel = buildTodaySceneViewModel({
      today,
      currentNow: Date.parse('2026-08-15T01:30:00.000Z'),
      dayStart,
      plan: override,
    });

    expect(viewModel.plan).toBe(override);
    expect(viewModel.currentPlanItem).toBeUndefined();
  });
});

describe('buildTodayPlanRailViewModel', () => {
  const currentNow = Date.parse('2026-08-15T01:30:00.000Z');
  const tasks = [
    {
      id: 'task-work',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      isFlexible: true,
      dueAt: '2026-08-15T04:00:00.000Z',
    },
    {
      id: 'flex-low',
      status: 'TODO',
      priority: 'LOW',
      isFlexible: true,
      dueAt: '2026-08-15T09:00:00.000Z',
    },
    {
      id: 'flex-urgent',
      status: 'TODO',
      priority: 'URGENT',
      isFlexible: true,
      dueAt: '2026-08-15T08:00:00.000Z',
    },
    {
      id: 'flex-completed',
      status: 'COMPLETED',
      priority: 'HIGH',
      isFlexible: true,
      dueAt: '2026-08-15T07:00:00.000Z',
    },
  ] as TaskItem[];
  const warnings = [
    {
      id: 'warning-work',
      entityId: 'task-work',
      warningType: 'CROSS_AREA',
      severity: 'INFO',
      message: '工作任务被安排到了生活时段。',
    },
    {
      id: 'warning-flex',
      entityId: 'flex-urgent',
      warningType: 'DEADLINE_RISK',
      severity: 'CRITICAL',
      message: '任务存在截止风险。',
    },
    {
      id: 'warning-global',
      entityId: null,
      warningType: 'OVERLAP',
      severity: 'WARNING',
      message: '存在未关联提醒。',
    },
  ] as WarningItem[];

  it('projects temporal state and keeps warnings beside their related actions', () => {
    const model = buildTodayPlanRailViewModel({ plan, tasks, warnings, currentNow });

    expect(model.primary[0]?.temporalState).toBe('CURRENT');
    expect(model.primary[0]?.warnings.map((warning) => warning.id)).toEqual(['warning-work']);
    expect(model.primary[1]?.temporalState).toBe('FUTURE');
    expect(model.flexible.map((entry) => entry.task.id)).toEqual(['flex-urgent', 'flex-low']);
    expect(model.flexible[0]?.warnings.map((warning) => warning.id)).toEqual(['warning-flex']);
    expect(model.unassignedWarnings.map((warning) => warning.id)).toEqual(['warning-global']);
  });

  it('limits upcoming actions to the next four hours', () => {
    const model = buildTodayPlanRailViewModel({ plan, currentNow });

    expect(model.upcoming).toEqual([]);
  });
});
