import type { SqliteDatabase } from './sqlite-database.js';

interface MetricProgressRow {
  readonly id: string;
  readonly metricType: 'NUMBER' | 'COUNT' | 'DURATION' | 'PERCENTAGE' | 'BOOLEAN';
  readonly startValue: number | null;
  readonly targetValue: number;
  readonly direction: 'INCREASE' | 'DECREASE' | 'MAINTAIN';
  readonly weight: number;
  readonly latestValue: number | null;
  readonly firstValue: number | null;
}

const clampProgress = (value: number): number => Math.max(0, Math.min(100, value));

export const calculateMetricProgress = (metric: MetricProgressRow): number => {
  if (metric.latestValue === null) return 0;
  if (metric.metricType === 'BOOLEAN' || metric.direction === 'MAINTAIN') {
    return metric.latestValue === metric.targetValue ? 100 : 0;
  }
  const startValue = metric.startValue ?? (metric.direction === 'DECREASE' ? metric.firstValue : 0);
  if (startValue === null) return 0;
  if (metric.direction === 'INCREASE') {
    const distance = metric.targetValue - startValue;
    if (distance === 0) return metric.latestValue >= metric.targetValue ? 100 : 0;
    return clampProgress(((metric.latestValue - startValue) / distance) * 100);
  }
  const distance = startValue - metric.targetValue;
  if (distance === 0) return metric.latestValue <= metric.targetValue ? 100 : 0;
  return clampProgress(((startValue - metric.latestValue) / distance) * 100);
};

export const calculateGoalAutoProgress = (database: SqliteDatabase, goalId: string): number => {
  const metrics = database.raw
    .prepare(
      `SELECT metric.id,metric.metric_type metricType,metric.start_value startValue,
              metric.target_value targetValue,metric.direction,metric.weight,
              (SELECT entry.value FROM goal_progress_entries entry
               WHERE entry.metric_id=metric.id ORDER BY entry.recorded_at DESC,entry.id DESC LIMIT 1) latestValue,
              (SELECT entry.value FROM goal_progress_entries entry
               WHERE entry.metric_id=metric.id ORDER BY entry.recorded_at ASC,entry.id ASC LIMIT 1) firstValue
       FROM goal_metrics metric WHERE metric.goal_id=? ORDER BY metric.id`,
    )
    .all(goalId) as MetricProgressRow[];
  if (metrics.length > 0) {
    const totalWeight = metrics.reduce((total, metric) => total + metric.weight, 0);
    if (totalWeight <= 0) return 0;
    return (
      metrics.reduce(
        (total, metric) => total + calculateMetricProgress(metric) * metric.weight,
        0,
      ) / totalWeight
    );
  }
  const counts = database.raw
    .prepare(
      `SELECT COUNT(*) total,SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) completed
       FROM tasks WHERE (goal_id=? OR plan_id IN (SELECT id FROM plans WHERE goal_id=?)) AND status<>'CANCELLED'`,
    )
    .get(goalId, goalId) as { total: number; completed: number | null };
  return counts.total === 0 ? 0 : ((counts.completed ?? 0) / counts.total) * 100;
};

export const refreshGoalProgress = (database: SqliteDatabase, goalId: string): number => {
  const progress = calculateGoalAutoProgress(database, goalId);
  database.raw
    .prepare(
      `UPDATE goals SET auto_progress=?,display_progress=CASE WHEN progress_mode='AUTO' THEN ? ELSE display_progress END WHERE id=?`,
    )
    .run(progress, progress, goalId);
  return progress;
};
