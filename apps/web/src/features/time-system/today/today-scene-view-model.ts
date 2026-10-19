import type { TaskItem, TodayData, TodayPlanItem, WarningItem } from '../api.js';
import type { PressureLevel, PressureVisualState } from '../pressure-visual-state.js';
import { buildFountainSceneModel } from './fountain/fountain-model.js';
import type { FountainArea, FountainSceneModel } from './fountain/fountain-types.js';
import type { TodayStatusFloatItem } from './today-status-floats.js';

const STATUS_SENTENCES: Record<PressureLevel, string> = {
  RELAXED: '时间在流动，生活也在自我塑造。',
  COMFORTABLE: '节奏平稳，一切都在轨道上。',
  ELEVATED: '今天有些紧凑，记得留一点缓冲。',
  HIGH_PRESSURE: '今天任务密集，先照顾好最重要的事。',
};

export interface TodaySceneViewModel {
  readonly activeArea: FountainArea;
  readonly currentBlock: TodayData['blocks'][number] | undefined;
  readonly currentPlanItem: TodayPlanItem | undefined;
  readonly currentStateLabel: string;
  readonly statusSentence: string;
  readonly nowMinute: number;
  readonly plan: readonly TodayPlanItem[];
  readonly upcomingPlan: readonly TodayPlanItem[];
  readonly planRail: TodayPlanRailViewModel;
  readonly fountainModel: FountainSceneModel | undefined;
  readonly statusItems: readonly TodayStatusFloatItem[];
}

export interface BuildTodaySceneViewModelInput {
  readonly today?: TodayData | undefined;
  readonly pressureVisual?: PressureVisualState | undefined;
  readonly currentNow: number;
  readonly dayStart: number;
  readonly plan?: readonly TodayPlanItem[] | undefined;
  readonly tasks?: readonly TaskItem[] | undefined;
  readonly warnings?: readonly WarningItem[] | undefined;
}

export type TodayPlanTemporalState = 'CURRENT' | 'PAST' | 'FUTURE';

export interface TodayPlanRailItem {
  readonly item: TodayPlanItem;
  readonly task: TaskItem | undefined;
  readonly temporalState: TodayPlanTemporalState;
  readonly completed: boolean;
  readonly warnings: readonly WarningItem[];
}

export interface TodayFlexibleRailItem {
  readonly task: TaskItem;
  readonly warnings: readonly WarningItem[];
}

export interface TodayPlanRailViewModel {
  readonly primary: readonly TodayPlanRailItem[];
  readonly upcoming: readonly TodayPlanRailItem[];
  readonly flexible: readonly TodayFlexibleRailItem[];
  readonly unassignedWarnings: readonly WarningItem[];
}

const priorityRank: Record<TaskItem['priority'], number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export const buildTodayPlanRailViewModel = ({
  plan,
  tasks = [],
  warnings = [],
  currentNow,
}: {
  readonly plan: readonly TodayPlanItem[];
  readonly tasks?: readonly TaskItem[] | undefined;
  readonly warnings?: readonly WarningItem[] | undefined;
  readonly currentNow: number;
}): TodayPlanRailViewModel => {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const warningsByEntityId = new Map<string, WarningItem[]>();
  for (const warning of warnings) {
    if (warning.entityId === null) continue;
    const relatedWarnings = warningsByEntityId.get(warning.entityId) ?? [];
    relatedWarnings.push(warning);
    warningsByEntityId.set(warning.entityId, relatedWarnings);
  }
  const warningsFor = (entityId: string | null): readonly WarningItem[] =>
    entityId === null ? [] : (warningsByEntityId.get(entityId) ?? []);
  const primary = plan.map((item): TodayPlanRailItem => {
    const task = item.entityId === null ? undefined : taskById.get(item.entityId);
    const startAt = Date.parse(item.startAt);
    const endAt = Date.parse(item.endAt);
    return {
      item,
      task,
      temporalState:
        currentNow >= startAt && currentNow < endAt
          ? 'CURRENT'
          : endAt <= currentNow
            ? 'PAST'
            : 'FUTURE',
      completed: task?.status === 'COMPLETED',
      warnings: warningsFor(item.entityId),
    };
  });
  const upcomingCutoff = currentNow + 4 * 60 * 60_000;
  const upcoming = primary
    .filter(({ item }) => {
      const startAt = Date.parse(item.startAt);
      return startAt > currentNow && startAt <= upcomingCutoff;
    })
    .toSorted((left, right) => Date.parse(left.item.startAt) - Date.parse(right.item.startAt))
    .slice(0, 4);
  const scheduledEntityIds = new Set(
    plan.flatMap((item) => (item.entityId === null ? [] : [item.entityId])),
  );
  const flexible = tasks
    .filter(
      (task) =>
        task.isFlexible &&
        task.status !== 'COMPLETED' &&
        task.status !== 'CANCELLED' &&
        !scheduledEntityIds.has(task.id),
    )
    .toSorted(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        Date.parse(left.dueAt) - Date.parse(right.dueAt),
    )
    .slice(0, 5)
    .map((task) => ({ task, warnings: warningsFor(task.id) }));
  const assignedWarningIds = new Set(
    [
      ...primary.flatMap((entry) => entry.warnings),
      ...flexible.flatMap((entry) => entry.warnings),
    ].map((warning) => warning.id),
  );

  return {
    primary,
    upcoming,
    flexible,
    unassignedWarnings: warnings.filter((warning) => !assignedWarningIds.has(warning.id)),
  };
};

const areaOfBlock = (block: TodayData['blocks'][number]): FountainArea => {
  if (block.blockType === 'SLEEP') return 'SLEEP';
  return block.area === 'WORK' ? 'WORK' : 'LIFE';
};

const stateLabelOf = (area: FountainArea): string => {
  if (area === 'SLEEP') return '睡眠中';
  if (area === 'FREE') return '空闲';
  return area === 'WORK' ? '工作 · 进行中' : '生活 · 进行中';
};

export const buildTodaySceneViewModel = ({
  today,
  pressureVisual,
  currentNow,
  dayStart,
  plan,
  tasks,
  warnings,
}: BuildTodaySceneViewModelInput): TodaySceneViewModel => {
  const scenePlan = plan ?? today?.plan ?? [];
  const currentBlock = today?.blocks.find(
    (block) => currentNow >= Date.parse(block.startAt) && currentNow < Date.parse(block.endAt),
  );
  const activeArea = currentBlock === undefined ? 'FREE' : areaOfBlock(currentBlock);
  const currentPlanItem = scenePlan.find(
    (item) => currentNow >= Date.parse(item.startAt) && currentNow < Date.parse(item.endAt),
  );
  const upcomingPlan = scenePlan
    .filter((item) => Date.parse(item.startAt) > currentNow)
    .toSorted((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt));
  const nowMinute = (currentNow - dayStart) / 60_000;
  const statusItems: readonly TodayStatusFloatItem[] = [
    {
      kind: 'SLEEP',
      label: '睡眠',
      minutes: today?.totals.sleepMinutes ?? 0,
      active: activeArea === 'SLEEP',
    },
    {
      kind: 'WORK',
      label: '工作',
      minutes: today?.totals.workMinutes ?? 0,
      active: activeArea === 'WORK',
    },
    {
      kind: 'LIFE',
      label: '生活',
      minutes: today?.totals.lifeMinutes ?? 0,
      active: activeArea === 'LIFE',
    },
    {
      kind: 'FREE',
      label: '空闲',
      minutes: today?.totals.freeMinutes ?? 0,
      active: activeArea === 'FREE',
    },
  ];

  return {
    activeArea,
    currentBlock,
    currentPlanItem,
    currentStateLabel: today === undefined ? '正在读取…' : stateLabelOf(activeArea),
    statusSentence:
      pressureVisual === undefined ? '正在感知今天的节奏…' : STATUS_SENTENCES[pressureVisual.level],
    nowMinute,
    plan: scenePlan,
    upcomingPlan,
    planRail: buildTodayPlanRailViewModel({ plan: scenePlan, tasks, warnings, currentNow }),
    statusItems,
    fountainModel:
      today === undefined || pressureVisual === undefined
        ? undefined
        : buildFountainSceneModel({
            pressure: pressureVisual,
            totals: today.totals,
            activeArea,
            nowMinute,
            tasks: scenePlan.map((item) => ({
              id: item.entityId ?? item.id,
              priority: item.priority,
            })),
          }),
  };
};
