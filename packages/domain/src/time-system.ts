export const GRID_MINUTES = 15;
export const GRID_MILLISECONDS = GRID_MINUTES * 60_000;

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type GoalStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type PreferredArea = 'WORK' | 'LIFE';

export const priorityWeight: Readonly<Record<Priority, number>> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 4,
  URGENT: 8,
};

export const assertGridAligned = (timestamp: number): void => {
  if (!Number.isInteger(timestamp) || timestamp % GRID_MILLISECONDS !== 0) {
    throw new Error('TIME_NOT_GRID_ALIGNED');
  }
};

export const assertEstimatedMinutes = (minutes: number): void => {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes % GRID_MINUTES !== 0) {
    throw new Error('INVALID_ESTIMATED_MINUTES');
  }
};

export const calculateGoalHorizon = (
  startDate: string,
  endDate?: string | null,
): 'SHORT_TERM' | 'LONG_TERM' => {
  if (endDate === undefined || endDate === null) return 'LONG_TERM';
  const start = Date.parse(`${startDate}T00:00:00+08:00`);
  const end = Date.parse(`${endDate}T00:00:00+08:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('INVALID_DATE_RANGE');
  }
  return end - start <= 31 * 86_400_000 ? 'SHORT_TERM' : 'LONG_TERM';
};

const taskTransitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  TODO: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['TODO'],
  CANCELLED: ['TODO'],
};

export const assertTaskTransition = (from: TaskStatus, to: TaskStatus): void => {
  if (from === to) return;
  if (!taskTransitions[from].includes(to)) throw new Error('INVALID_TASK_STATUS_TRANSITION');
};

export const assertNoDependencyCycle = (
  edges: readonly (readonly [string, string])[],
  nextEdge: readonly [string, string],
): void => {
  const [predecessor, successor] = nextEdge;
  if (predecessor === successor) throw new Error('DEPENDENCY_CYCLE');
  const adjacency = new Map<string, string[]>();
  for (const [from, to] of [...edges, nextEdge]) {
    const targets = adjacency.get(from) ?? [];
    targets.push(to);
    adjacency.set(from, targets);
  }
  const pending = [successor];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    if (current === predecessor) throw new Error('DEPENDENCY_CYCLE');
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
};

export interface TimeRange {
  readonly startAt: number;
  readonly endAt: number;
}

export const overlaps = (left: TimeRange, right: TimeRange): boolean =>
  left.startAt < right.endAt && right.startAt < left.endAt;

export const assertValidRange = (range: TimeRange): void => {
  assertGridAligned(range.startAt);
  assertGridAligned(range.endAt);
  if (range.endAt <= range.startAt) throw new Error('INVALID_TIME_RANGE');
};
