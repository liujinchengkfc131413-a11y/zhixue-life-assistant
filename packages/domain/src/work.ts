export type ContentProductionStatus =
  'IDEA' | 'PLANNING' | 'CREATING' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

const contentTransitions: Record<ContentProductionStatus, readonly ContentProductionStatus[]> = {
  IDEA: ['PLANNING', 'ARCHIVED'],
  PLANNING: ['IDEA', 'CREATING', 'ARCHIVED'],
  CREATING: ['PLANNING', 'READY', 'ARCHIVED'],
  READY: ['CREATING', 'PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['READY', 'ARCHIVED'],
  ARCHIVED: ['IDEA', 'PLANNING', 'CREATING', 'READY', 'PUBLISHED'],
};

export const assertContentTransition = (
  from: ContentProductionStatus,
  to: ContentProductionStatus,
): void => {
  if (from !== to && !contentTransitions[from].includes(to))
    throw new Error('INVALID_CONTENT_TRANSITION');
};

export const assertProgressRange = (current: number | null, total: number | null): void => {
  if (
    (current !== null && (!Number.isFinite(current) || current < 0)) ||
    (total !== null && (!Number.isFinite(total) || total <= 0)) ||
    (current !== null && total !== null && current > total)
  )
    throw new Error('INVALID_PROGRESS');
};

export const calculateProgressPercent = (
  current: number | null,
  total: number | null,
): number | null =>
  current === null || total === null ? null : Math.round((current / total) * 100);
