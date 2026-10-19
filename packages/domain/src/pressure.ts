import { priorityWeight, type Priority } from './time-system.js';

export const PRESSURE_ALGORITHM_VERSION = 'pressure-v1' as const;

export interface PressureTaskInput {
  readonly priority: Priority;
  readonly dueAt: number;
  readonly estimatedMinutes: number;
  readonly scheduledMinutes: number;
}

export interface PressureInput {
  readonly dayEnd: number;
  readonly awakeMinutes: number;
  readonly workMinutes: number;
  readonly lifeMinutes: number;
  readonly freeMinutes: number;
  readonly longestContinuousWorkMinutes: number;
  readonly tasks: readonly PressureTaskInput[];
  /**
   * 10 万级任务量下的聚合计数：提供后不再遍历 tasks 计算逾期/今日到期/紧急数量。
   * 与 tasks 中的 scheduledMinutes 加权互不影响，默认未提供时保持原有遍历语义。
   */
  readonly overdueCount?: number | undefined;
  readonly dueTodayCount?: number | undefined;
  readonly urgentCount?: number | undefined;
}

export interface PressureFactor {
  readonly code: string;
  readonly points: number;
  readonly message: string;
}

export interface PressureResult {
  readonly score: number;
  readonly level: 'RELAXED' | 'COMFORTABLE' | 'ELEVATED' | 'HIGH_PRESSURE';
  readonly algorithmVersion: typeof PRESSURE_ALGORITHM_VERSION;
  readonly factors: readonly PressureFactor[];
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const calculatePressure = (input: PressureInput): PressureResult => {
  const occupied = input.workMinutes + input.lifeMinutes;
  const loadPoints = Math.round(clamp(occupied / Math.max(1, input.awakeMinutes), 0, 1) * 35);
  const weightedPriorityMinutes = input.tasks.reduce(
    (total, task) => total + task.scheduledMinutes * priorityWeight[task.priority],
    0,
  );
  const priorityPoints = Math.round(
    clamp(weightedPriorityMinutes / Math.max(1, input.awakeMinutes * 4), 0, 1) * 25,
  );
  const overdue =
    input.overdueCount ??
    input.tasks.filter((task) => task.dueAt < input.dayEnd - 86_400_000).length;
  const dueToday =
    input.dueTodayCount ??
    input.tasks.filter(
      (task) => task.dueAt >= input.dayEnd - 86_400_000 && task.dueAt < input.dayEnd,
    ).length;
  const urgencyPoints = clamp(overdue * 6 + dueToday * 3, 0, 20);
  const continuousPoints =
    input.longestContinuousWorkMinutes > 180
      ? 10
      : input.longestContinuousWorkMinutes > 120
        ? 7
        : input.longestContinuousWorkMinutes > 90
          ? 4
          : 0;
  const awakeFree = Math.min(input.freeMinutes, input.awakeMinutes);
  const bufferPoints = Math.round(
    (1 - clamp(awakeFree / Math.max(1, input.awakeMinutes), 0, 1)) * 10,
  );
  const score = clamp(
    loadPoints + priorityPoints + urgencyPoints + continuousPoints + bufferPoints,
    0,
    100,
  );
  const level =
    score < 25 ? 'RELAXED' : score < 50 ? 'COMFORTABLE' : score < 75 ? 'ELEVATED' : 'HIGH_PRESSURE';
  const urgentTasks =
    input.urgentCount ?? input.tasks.filter((task) => task.priority === 'URGENT').length;
  const factors: PressureFactor[] = [
    { code: 'LOAD', points: loadPoints, message: `清醒时间已安排 ${String(occupied)} 分钟` },
    {
      code: 'PRIORITY',
      points: priorityPoints,
      message: `今日有 ${String(urgentTasks)} 项紧急任务`,
    },
    {
      code: 'DEADLINE',
      points: urgencyPoints,
      message: `今日到期 ${String(dueToday)} 项，逾期 ${String(overdue)} 项`,
    },
    {
      code: 'CONTINUOUS_WORK',
      points: continuousPoints,
      message: `最长连续工作 ${String(input.longestContinuousWorkMinutes)} 分钟`,
    },
    { code: 'BUFFER', points: bufferPoints, message: `可用缓冲 ${String(awakeFree)} 分钟` },
  ];
  return {
    score,
    level,
    algorithmVersion: PRESSURE_ALGORITHM_VERSION,
    factors: factors.filter((factor) => factor.points > 0),
  };
};
