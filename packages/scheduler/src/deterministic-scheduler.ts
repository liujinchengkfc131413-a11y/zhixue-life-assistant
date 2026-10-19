import { createHash } from 'node:crypto';

import {
  GRID_MILLISECONDS,
  priorityWeight,
  type PreferredArea,
  type Priority,
} from '@life-assistant/domain';

export const SCHEDULER_RULE_VERSION = 'comfortable-v1';

export interface SchedulableTask {
  readonly id: string;
  readonly priority: Priority;
  readonly dueAt: number;
  readonly estimatedMinutes: number;
  readonly isSplittable: boolean;
  readonly preferredArea: PreferredArea;
  readonly dependencyBlocked?: boolean | undefined;
  /**
   * 仅用于 overdue task：dueAt 已被违反后不再作为硬性上限，改为窗口内任意合法时间。
   * 未提供时保持原语义（必须安排在 dueAt 之前）。
   */
  readonly effectiveDueAt?: number | undefined;
}

export interface AvailabilitySlot {
  readonly startAt: number;
  readonly endAt: number;
  readonly area: PreferredArea;
}

export interface OccupiedBlock {
  readonly id: string;
  readonly targetEntityId?: string | null | undefined;
  readonly startAt: number;
  readonly endAt: number;
  readonly area: PreferredArea | 'SLEEP';
  readonly blockType: 'TASK' | 'EVENT' | 'SLEEP' | 'REST';
  readonly isLocked: boolean;
}

export interface ProposedBlock {
  readonly id?: string | undefined;
  readonly taskId: string;
  readonly startAt: number;
  readonly endAt: number;
  readonly area: PreferredArea;
  readonly preserved: boolean;
  readonly crossAreaWarning: boolean;
  readonly reasonCode: 'PRESERVED' | 'PRIORITY_DEADLINE_FIT' | 'CROSS_AREA_FIT';
}

export interface ScheduleWarning {
  readonly entityId: string;
  readonly warningType: 'UNSCHEDULED' | 'CROSS_AREA' | 'DEPENDENCY_BLOCKED' | 'DEADLINE_RISK';
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readonly message: string;
}

export interface ScheduleResult {
  readonly blocks: readonly ProposedBlock[];
  readonly warnings: readonly ScheduleWarning[];
  readonly inputHash: string;
}

interface GridSlot {
  readonly startAt: number;
  readonly endAt: number;
  readonly area: PreferredArea;
  occupied: boolean;
}

const intersects = (
  startAt: number,
  endAt: number,
  otherStart: number,
  otherEnd: number,
): boolean => startAt < otherEnd && otherStart < endAt;

const taskSort = (left: SchedulableTask, right: SchedulableTask): number =>
  priorityWeight[right.priority] - priorityWeight[left.priority] ||
  left.dueAt - right.dueAt ||
  right.estimatedMinutes - left.estimatedMinutes ||
  left.id.localeCompare(right.id);

const contiguousWindows = (
  slots: readonly GridSlot[],
  indexes: readonly number[],
): readonly number[][] => {
  const windows: number[][] = [];
  let current: number[] = [];
  for (const index of indexes) {
    const previous = current.at(-1);
    if (previous === undefined || slots[previous]?.endAt === slots[index]?.startAt)
      current.push(index);
    else {
      windows.push(current);
      current = [index];
    }
  }
  if (current.length > 0) windows.push(current);
  return windows;
};

export const scheduleDeterministically = (input: {
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly tasks: readonly SchedulableTask[];
  readonly availability: readonly AvailabilitySlot[];
  readonly occupied: readonly OccupiedBlock[];
}): ScheduleResult => {
  const inputHash = createHash('sha256')
    .update(
      JSON.stringify({
        ...input,
        tasks: input.tasks.toSorted(taskSort),
        rule: SCHEDULER_RULE_VERSION,
      }),
    )
    .digest('hex');
  const slots: GridSlot[] = [];
  for (let startAt = input.rangeStart; startAt < input.rangeEnd; startAt += GRID_MILLISECONDS) {
    const availability = input.availability.find(
      (window) => window.startAt <= startAt && window.endAt >= startAt + GRID_MILLISECONDS,
    );
    if (availability === undefined) continue;
    const occupied = input.occupied.some((block) =>
      intersects(startAt, startAt + GRID_MILLISECONDS, block.startAt, block.endAt),
    );
    slots.push({ startAt, endAt: startAt + GRID_MILLISECONDS, area: availability.area, occupied });
  }

  const taskIds = new Set(input.tasks.map((task) => task.id));
  const blocks: ProposedBlock[] = input.occupied.flatMap((block) => {
    const taskId = block.targetEntityId;
    if (
      block.blockType !== 'TASK' ||
      taskId === undefined ||
      taskId === null ||
      !taskIds.has(taskId)
    ) {
      return [];
    }
    return [
      {
        id: block.id,
        taskId,
        startAt: block.startAt,
        endAt: block.endAt,
        area: block.area === 'SLEEP' ? 'LIFE' : block.area,
        preserved: true,
        crossAreaWarning: false,
        reasonCode: 'PRESERVED',
      },
    ];
  });
  const warnings: ScheduleWarning[] = [];

  for (const task of input.tasks.toSorted(taskSort)) {
    if (task.dependencyBlocked === true) {
      warnings.push({
        entityId: task.id,
        warningType: 'DEPENDENCY_BLOCKED',
        severity: 'WARNING',
        message: '前置任务尚未完成，当前任务暂不排程。',
      });
      continue;
    }
    const preservedMinutes = blocks
      .filter((block) => block.taskId === task.id)
      .reduce((total, block) => total + (block.endAt - block.startAt) / 60_000, 0);
    let remainingSlots = Math.max(0, (task.estimatedMinutes - preservedMinutes) / 15);
    if (remainingSlots === 0) continue;

    const freeIndexes = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => !slot.occupied && slot.startAt < (task.effectiveDueAt ?? task.dueAt))
      .map(({ index }) => index);
    const preferred = freeIndexes.filter((index) => slots[index]?.area === task.preferredArea);
    const crossArea = freeIndexes.filter((index) => slots[index]?.area !== task.preferredArea);
    const allocate = (indexes: readonly number[], requestedSlots: number): number => {
      let allocated = 0;
      for (const window of contiguousWindows(slots, indexes)) {
        if (remainingSlots === 0) break;
        if (!task.isSplittable || task.estimatedMinutes < 30) {
          if (window.length < remainingSlots) continue;
          const chosen = window.slice(0, remainingSlots);
          allocated += markBlock(chosen);
          break;
        }
        const minimum = 2;
        if (window.length < minimum) continue;
        const chosen = window.slice(
          0,
          Math.min(window.length, remainingSlots, requestedSlots - allocated),
        );
        if (chosen.length < minimum) continue;
        allocated += markBlock(chosen);
        if (allocated >= requestedSlots) break;
      }
      return allocated;
    };

    const markBlock = (indexes: readonly number[]): number => {
      const first = slots[indexes[0] ?? -1];
      const last = slots[indexes.at(-1) ?? -1];
      if (first === undefined || last === undefined) return 0;
      indexes.forEach((index) => {
        const slot = slots[index];
        if (slot !== undefined) slot.occupied = true;
      });
      const cross = first.area !== task.preferredArea;
      blocks.push({
        taskId: task.id,
        startAt: first.startAt,
        endAt: last.endAt,
        area: first.area,
        preserved: false,
        crossAreaWarning: cross,
        reasonCode: cross ? 'CROSS_AREA_FIT' : 'PRIORITY_DEADLINE_FIT',
      });
      remainingSlots -= indexes.length;
      return indexes.length;
    };

    allocate(preferred, remainingSlots);
    if (remainingSlots > 0) allocate(crossArea, remainingSlots);
    if (blocks.some((block) => block.taskId === task.id && block.crossAreaWarning)) {
      warnings.push({
        entityId: task.id,
        warningType: 'CROSS_AREA',
        severity: 'INFO',
        message: '为满足截止时间，任务被安排到了其他类型时段。',
      });
    }
    if (remainingSlots > 0) {
      warnings.push({
        entityId: task.id,
        warningType: 'UNSCHEDULED',
        severity: task.priority === 'URGENT' ? 'CRITICAL' : 'WARNING',
        message: `仍有 ${String(remainingSlots * 15)} 分钟无法在截止前排入。`,
      });
    }
    const taskBlocks = blocks.filter((block) => block.taskId === task.id);
    if (taskBlocks.some((block) => block.endAt > task.dueAt)) {
      warnings.push({
        entityId: task.id,
        warningType: 'DEADLINE_RISK',
        severity: 'CRITICAL',
        message: '任务存在超过截止时间的安排。',
      });
    }
  }
  return { blocks, warnings, inputHash };
};
