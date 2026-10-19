import { ulid } from 'ulid';

import {
  assertEstimatedMinutes,
  assertNoDependencyCycle,
  assertTaskTransition,
  assertValidRange,
  calculateGoalHorizon,
  overlaps,
  type GoalStatus,
  type PreferredArea,
  type Priority,
  type TaskStatus,
} from '@life-assistant/domain';
import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';
import { CanonicalHistoryRepository } from './canonical-history-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import { calculateMetricProgress, refreshGoalProgress } from './goal-progress.js';
import type { OperationContext } from './operation-context.js';
import type { CanonicalEntitySnapshot } from './snapshot-contract.js';

interface EntityFields {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type OptionalPatch<T> = { [Key in keyof T]?: T[Key] | undefined };

const optionalTrimmed = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
};

export interface GoalRecord extends EntityFields {
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | null;
  readonly goalType: 'OUTCOME' | 'HABIT';
  readonly status: GoalStatus;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly horizon: 'SHORT_TERM' | 'LONG_TERM';
  readonly autoProgress: number;
  readonly manualProgress: number | null;
  readonly progressMode: 'AUTO' | 'MANUAL_OVERRIDE';
  readonly displayProgress: number;
}

export interface GoalMetricRecord {
  readonly id: string;
  readonly goalId: string;
  readonly name: string;
  readonly metricType: 'NUMBER' | 'COUNT' | 'DURATION' | 'PERCENTAGE' | 'BOOLEAN';
  readonly unit: string | null;
  readonly startValue: number | null;
  readonly targetValue: number;
  readonly direction: 'INCREASE' | 'DECREASE' | 'MAINTAIN';
  readonly weight: number;
  readonly latestValue: number | null;
  readonly latestRecordedAt: string | null;
  readonly progressPercent: number;
}

export interface GoalProgressEntryRecord {
  readonly id: string;
  readonly goalId: string;
  readonly metricId: string | null;
  readonly value: number;
  readonly recordedAt: string;
  readonly source: 'USER' | 'TASKS' | 'HEALTH' | 'SYSTEM' | 'AI';
  readonly sourceEntityId: string | null;
  readonly note: string | null;
}

export interface GoalMetricsState {
  readonly goalId: string;
  readonly goalVersion: number;
  readonly autoProgress: number;
  readonly displayProgress: number;
  readonly progressMode: GoalRecord['progressMode'];
  readonly metrics: readonly GoalMetricRecord[];
  readonly entries: readonly GoalProgressEntryRecord[];
}

export interface PlanRecord extends EntityFields {
  readonly goalId: string | null;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: GoalStatus;
  readonly priority: Priority;
  readonly startDate: string;
  readonly endDate: string;
  readonly autoProgress: number;
  readonly manualProgress: number | null;
  readonly progressMode: 'AUTO' | 'MANUAL_OVERRIDE';
  readonly displayProgress: number;
}

export interface PlanMilestoneRecord extends EntityFields {
  readonly planId: string;
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: string;
  readonly status: 'PENDING' | 'AT_RISK' | 'ACHIEVED' | 'MISSED';
  readonly achievedAt: string | null;
  readonly linkedEntityIds: readonly string[];
}

export interface TaskRecord extends EntityFields {
  readonly categoryId: string;
  readonly planId: string | null;
  readonly goalId: string | null;
  readonly parentTaskId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly dueAt: string;
  readonly estimatedMinutes: number;
  readonly isFlexible: boolean;
  readonly isSplittable: boolean;
  readonly preferredArea: PreferredArea;
  readonly completedAt: string | null;
}

export interface EventRecord extends EntityFields {
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | null;
  readonly startAt: string;
  readonly endAt: string;
  readonly timeZone: string;
  readonly eventType: 'GENERAL' | 'MEETING' | 'MEDICAL' | 'TRAVEL' | 'REST';
  readonly priority: Priority;
  readonly isImmovable: boolean;
  readonly allowOverlap: boolean;
  readonly status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
}

export interface EntityTagRecord {
  readonly id: string;
  readonly name: string;
  readonly colorToken: string | null;
  readonly description: string | null;
  readonly version: number;
}

interface GoalRow {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  category_id: string;
  title: string;
  description: string | null;
  goal_type: GoalRecord['goalType'];
  status: GoalStatus;
  start_date: string;
  end_date: string | null;
  horizon: GoalRecord['horizon'];
  auto_progress: number;
  manual_progress: number | null;
  progress_mode: GoalRecord['progressMode'];
  display_progress: number;
}

interface GoalMetricRow {
  id: string;
  goal_id: string;
  name: string;
  metric_type: GoalMetricRecord['metricType'];
  unit: string | null;
  start_value: number | null;
  target_value: number;
  direction: GoalMetricRecord['direction'];
  weight: number;
  latest_value: number | null;
  latest_recorded_at: number | null;
  first_value: number | null;
}

interface GoalProgressEntryRow {
  id: string;
  goal_id: string;
  metric_id: string | null;
  value: number;
  recorded_at: number;
  source: GoalProgressEntryRecord['source'];
  source_entity_id: string | null;
  note: string | null;
}

interface PlanRow {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  goal_id: string | null;
  category_id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  priority: Priority;
  start_date: string;
  end_date: string;
  auto_progress: number;
  manual_progress: number | null;
  progress_mode: PlanRecord['progressMode'];
  display_progress: number;
}

interface TaskRow {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  category_id: string;
  plan_id: string | null;
  goal_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_at: number;
  estimated_minutes: number;
  is_flexible: number;
  is_splittable: number;
  preferred_area: PreferredArea;
  completed_at: number | null;
}

interface PlanMilestoneRow {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  plan_id: string;
  title: string;
  description: string | null;
  due_at: number;
  status: PlanMilestoneRecord['status'];
  achieved_at: number | null;
}

interface EventRow {
  id: string;
  version: number;
  created_at: number;
  updated_at: number;
  category_id: string;
  title: string;
  description: string | null;
  start_at: number;
  end_at: number;
  time_zone: string;
  event_type: EventRecord['eventType'];
  priority: Priority;
  is_immovable: number;
  allow_overlap: number;
  status: EventRecord['status'];
}

const activeEntityJoin = `JOIN entity_index entity ON entity.id = resource.id AND entity.deleted_at IS NULL`;

export class ActionRepository {
  private activeChangeSetId: string | undefined;
  private readonly canonicalHistory: CanonicalHistoryRepository;
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    private readonly changeRecorder: ConsistencyRepository = new ConsistencyRepository(
      database,
      clock,
    ),
  ) {
    this.canonicalHistory = new CanonicalHistoryRepository(database, clock, changeRecorder);
  }

  /** Runs a planned AI batch as one transaction and one auditable change set. */
  public applyAiChangePlan<T>(
    summary: string,
    execute: () => T,
  ): { changeSetId: string; result: T } {
    return this.database.transaction(() => {
      if (this.activeChangeSetId !== undefined) throw new Error('CHANGE_PLAN_NESTING_UNSUPPORTED');
      const now = this.now();
      const changeSetId = ulid();
      this.database.raw
        .prepare(
          `INSERT INTO change_sets(id, source, summary, risk_level, status, created_at, applied_at)
           VALUES (?, 'AI', ?, 'LOW_WRITE', 'APPLIED', ?, ?)`,
        )
        .run(changeSetId, summary, now, now);
      this.activeChangeSetId = changeSetId;
      try {
        return { changeSetId, result: execute() };
      } finally {
        this.activeChangeSetId = undefined;
      }
    });
  }

  public getChangeSet(id: string): {
    id: string;
    source: 'USER' | 'RULE_ENGINE' | 'AI' | 'SYSTEM';
    summary: string;
    riskLevel: 'READ_ONLY' | 'LOW_WRITE' | 'HIGH_WRITE';
    status: 'PENDING' | 'APPLIED' | 'REVERTED' | 'FAILED';
    createdAt: string;
    appliedAt: string | null;
    revertedAt: string | null;
    operations: readonly {
      sequence: number;
      entityId: string | null;
      operation: 'CREATE' | 'UPDATE' | 'SOFT_DELETE' | 'RESTORE' | 'PURGE';
      before: unknown;
      after: unknown;
    }[];
  } {
    const row = this.database.raw.prepare('SELECT * FROM change_sets WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    if (row === undefined) throw new Error('CHANGE_SET_NOT_FOUND');
    const operations = this.database.raw
      .prepare(
        'SELECT sequence, entity_id, operation, before_json, after_json FROM change_operations WHERE change_set_id = ? ORDER BY sequence',
      )
      .all(id) as {
      sequence: number;
      entity_id: string | null;
      operation: 'CREATE' | 'UPDATE' | 'SOFT_DELETE' | 'RESTORE' | 'PURGE';
      before_json: string | null;
      after_json: string | null;
    }[];
    return {
      id: String(row.id),
      source: row.source as 'USER' | 'RULE_ENGINE' | 'AI' | 'SYSTEM',
      summary: String(row.summary),
      riskLevel: row.risk_level as 'READ_ONLY' | 'LOW_WRITE' | 'HIGH_WRITE',
      status: row.status as 'PENDING' | 'APPLIED' | 'REVERTED' | 'FAILED',
      createdAt: new Date(Number(row.created_at)).toISOString(),
      appliedAt: row.applied_at === null ? null : new Date(Number(row.applied_at)).toISOString(),
      revertedAt: row.reverted_at === null ? null : new Date(Number(row.reverted_at)).toISOString(),
      operations: operations.map((operation) => ({
        sequence: operation.sequence,
        entityId: operation.entity_id,
        operation: operation.operation,
        before:
          operation.before_json === null ? null : (JSON.parse(operation.before_json) as unknown),
        after: operation.after_json === null ? null : (JSON.parse(operation.after_json) as unknown),
      })),
    };
  }

  /** Reverts AI create-only change plans atomically. Other changes need their dedicated domain restore flow. */
  public undoAiChangeSet(id: string, context?: OperationContext) {
    if (context !== undefined) {
      const undone = this.canonicalHistory.undoChangeSet({ changeSetId: id, context });
      return { ...this.getChangeSet(id), ...undone };
    }
    return this.database.transaction(() => {
      const changeSet = this.getChangeSet(id);
      if (changeSet.source !== 'AI' || changeSet.status !== 'APPLIED')
        throw new Error('CHANGE_SET_NOT_UNDOABLE');
      if (
        changeSet.operations.length === 0 ||
        changeSet.operations.some((item) => item.operation !== 'CREATE' || item.entityId === null)
      )
        throw new Error('CHANGE_SET_NOT_UNDOABLE');
      const now = this.now();
      for (const operation of [...changeSet.operations].reverse()) {
        this.database.raw
          .prepare(
            'UPDATE entity_index SET deleted_at = ?, purge_after = ?, updated_at = ?, version = version + 1 WHERE id = ? AND deleted_at IS NULL',
          )
          .run(now, now + 30 * 86_400_000, now, operation.entityId);
      }
      this.database.raw
        .prepare(
          "UPDATE change_sets SET status = 'REVERTED', reverted_at = ? WHERE id = ? AND status = 'APPLIED'",
        )
        .run(now, id);
      return this.getChangeSet(id);
    });
  }

  public createGoal(
    input: {
      categoryId: string;
      title: string;
      description?: string | undefined;
      goalType: GoalRecord['goalType'];
      status?: GoalStatus | undefined;
      startDate: string;
      endDate?: string | null | undefined;
    },
    context?: OperationContext,
  ): GoalRecord {
    const id = ulid();
    const horizon = calculateGoalHorizon(input.startDate, input.endDate);
    this.database.transaction(() => {
      this.insertEntity(id, 'GOAL');
      this.database.raw
        .prepare(
          `INSERT INTO goals(id, category_id, title, description, goal_type, status, start_date, end_date, horizon)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.categoryId,
          input.title.trim(),
          input.description ?? null,
          input.goalType,
          input.status ?? 'ACTIVE',
          input.startDate,
          input.endDate ?? null,
          horizon,
        );
      this.recordCreate(id, 'GoalCreated', input, context);
    });
    return this.requireGoal(id);
  }

  public listGoals(): readonly GoalRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT resource.*, entity.version, entity.created_at, entity.updated_at
         FROM goals resource ${activeEntityJoin} ORDER BY resource.status, resource.end_date, resource.title`,
      )
      .all() as GoalRow[];
    return rows.map((row) => this.mapGoal(row));
  }

  public updateGoal(
    id: string,
    expectedVersion: number,
    patch: OptionalPatch<
      Pick<GoalRecord, 'title' | 'description' | 'status' | 'startDate' | 'endDate'>
    >,
    context?: OperationContext,
  ): GoalRecord {
    const current = this.requireGoal(id);
    this.assertVersion(current.version, expectedVersion);
    const startDate = patch.startDate ?? current.startDate;
    const endDate = patch.endDate === undefined ? current.endDate : patch.endDate;
    const horizon = calculateGoalHorizon(startDate, endDate);
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          `UPDATE goals SET title = ?, description = ?, status = ?, start_date = ?, end_date = ?, horizon = ?, completed_at = ? WHERE id = ?`,
        )
        .run(
          patch.title?.trim() ?? current.title,
          patch.description === undefined ? current.description : patch.description,
          patch.status ?? current.status,
          startDate,
          endDate,
          horizon,
          patch.status === 'COMPLETED' ? this.now() : null,
          id,
        );
      const version = this.bumpEntity(id);
      this.recordUpdate(id, version, 'GoalUpdated', patch, before, context);
    });
    return this.requireGoal(id);
  }

  public setGoalProgress(
    id: string,
    expectedVersion: number,
    value: number | null,
    context?: OperationContext,
  ): GoalRecord {
    const current = this.requireGoal(id);
    this.assertVersion(current.version, expectedVersion);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new Error('INVALID_PROGRESS');
    }
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          `UPDATE goals SET manual_progress = ?, progress_mode = ?, display_progress = CASE WHEN ? IS NULL THEN auto_progress ELSE ? END WHERE id = ?`,
        )
        .run(value, value === null ? 'AUTO' : 'MANUAL_OVERRIDE', value, value, id);
      const version = this.bumpEntity(id);
      this.recordUpdate(id, version, 'GoalProgressChanged', { value }, before, context);
    });
    return this.requireGoal(id);
  }

  public getGoalMetrics(goalId: string): GoalMetricsState {
    const goal = this.requireGoal(goalId);
    const metrics = this.database.raw
      .prepare(
        `SELECT metric.*,
                (SELECT entry.value FROM goal_progress_entries entry WHERE entry.metric_id=metric.id
                 ORDER BY entry.recorded_at DESC,entry.id DESC LIMIT 1) latest_value,
                (SELECT entry.recorded_at FROM goal_progress_entries entry WHERE entry.metric_id=metric.id
                 ORDER BY entry.recorded_at DESC,entry.id DESC LIMIT 1) latest_recorded_at,
                (SELECT entry.value FROM goal_progress_entries entry WHERE entry.metric_id=metric.id
                 ORDER BY entry.recorded_at ASC,entry.id ASC LIMIT 1) first_value
         FROM goal_metrics metric WHERE metric.goal_id=? ORDER BY metric.id`,
      )
      .all(goalId) as GoalMetricRow[];
    const entries = this.database.raw
      .prepare(
        `SELECT * FROM goal_progress_entries WHERE goal_id=?
         ORDER BY recorded_at DESC,id DESC`,
      )
      .all(goalId) as GoalProgressEntryRow[];
    return {
      goalId,
      goalVersion: goal.version,
      autoProgress: goal.autoProgress,
      displayProgress: goal.displayProgress,
      progressMode: goal.progressMode,
      metrics: metrics.map((metric) => ({
        id: metric.id,
        goalId: metric.goal_id,
        name: metric.name,
        metricType: metric.metric_type,
        unit: metric.unit,
        startValue: metric.start_value,
        targetValue: metric.target_value,
        direction: metric.direction,
        weight: metric.weight,
        latestValue: metric.latest_value,
        latestRecordedAt:
          metric.latest_recorded_at === null
            ? null
            : new Date(metric.latest_recorded_at).toISOString(),
        progressPercent: calculateMetricProgress({
          id: metric.id,
          metricType: metric.metric_type,
          startValue: metric.start_value,
          targetValue: metric.target_value,
          direction: metric.direction,
          weight: metric.weight,
          latestValue: metric.latest_value,
          firstValue: metric.first_value,
        }),
      })),
      entries: entries.map((entry) => ({
        id: entry.id,
        goalId: entry.goal_id,
        metricId: entry.metric_id,
        value: entry.value,
        recordedAt: new Date(entry.recorded_at).toISOString(),
        source: entry.source,
        sourceEntityId: entry.source_entity_id,
        note: entry.note,
      })),
    };
  }

  public createGoalMetric(
    goalId: string,
    expectedVersion: number,
    input: {
      name: string;
      metricType: GoalMetricRecord['metricType'];
      unit?: string | null | undefined;
      startValue?: number | null | undefined;
      targetValue: number;
      direction: GoalMetricRecord['direction'];
      weight?: number | undefined;
    },
    context?: OperationContext,
  ): GoalMetricsState {
    const goal = this.requireGoal(goalId);
    this.assertVersion(goal.version, expectedVersion);
    this.assertGoalMetric(input);
    const metricId = ulid();
    this.database.transaction(() => {
      const before = this.captureBefore(goalId, context);
      this.database.raw
        .prepare(
          `INSERT INTO goal_metrics(id,goal_id,name,metric_type,unit,start_value,target_value,direction,weight)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          metricId,
          goalId,
          input.name.trim(),
          input.metricType,
          optionalTrimmed(input.unit),
          input.startValue ?? null,
          input.targetValue,
          input.direction,
          input.weight ?? 1,
        );
      refreshGoalProgress(this.database, goalId);
      const version = this.bumpEntity(goalId);
      this.recordUpdate(
        goalId,
        version,
        'GoalMetricCreated',
        { metricId, ...input },
        before,
        context,
      );
    });
    return this.getGoalMetrics(goalId);
  }

  public updateGoalMetric(
    metricId: string,
    expectedVersion: number,
    patch: OptionalPatch<{
      name: string;
      metricType: GoalMetricRecord['metricType'];
      unit: string | null;
      startValue: number | null;
      targetValue: number;
      direction: GoalMetricRecord['direction'];
      weight: number;
    }>,
    context?: OperationContext,
  ): GoalMetricsState {
    const current = this.requireGoalMetric(metricId);
    const goal = this.requireGoal(current.goalId);
    this.assertVersion(goal.version, expectedVersion);
    const next = {
      name: patch.name ?? current.name,
      metricType: patch.metricType ?? current.metricType,
      unit: patch.unit === undefined ? current.unit : patch.unit,
      startValue: patch.startValue === undefined ? current.startValue : patch.startValue,
      targetValue: patch.targetValue ?? current.targetValue,
      direction: patch.direction ?? current.direction,
      weight: patch.weight ?? current.weight,
    };
    this.assertGoalMetric(next);
    this.database.transaction(() => {
      const before = this.captureBefore(goal.id, context);
      this.database.raw
        .prepare(
          `UPDATE goal_metrics SET name=?,metric_type=?,unit=?,start_value=?,target_value=?,direction=?,weight=? WHERE id=?`,
        )
        .run(
          next.name.trim(),
          next.metricType,
          optionalTrimmed(next.unit),
          next.startValue,
          next.targetValue,
          next.direction,
          next.weight,
          metricId,
        );
      refreshGoalProgress(this.database, goal.id);
      const version = this.bumpEntity(goal.id);
      this.recordUpdate(
        goal.id,
        version,
        'GoalMetricUpdated',
        { metricId, ...patch },
        before,
        context,
      );
    });
    return this.getGoalMetrics(goal.id);
  }

  public deleteGoalMetric(
    metricId: string,
    expectedVersion: number,
    context?: OperationContext,
  ): GoalMetricsState {
    const metric = this.requireGoalMetric(metricId);
    const goal = this.requireGoal(metric.goalId);
    this.assertVersion(goal.version, expectedVersion);
    this.database.transaction(() => {
      const before = this.captureBefore(goal.id, context);
      this.database.raw.prepare('DELETE FROM goal_metrics WHERE id=?').run(metricId);
      refreshGoalProgress(this.database, goal.id);
      const version = this.bumpEntity(goal.id);
      this.recordUpdate(goal.id, version, 'GoalMetricDeleted', { metricId }, before, context);
    });
    return this.getGoalMetrics(goal.id);
  }

  public recordGoalProgress(
    goalId: string,
    expectedVersion: number,
    input: {
      metricId: string;
      value: number;
      recordedAt?: string | undefined;
      note?: string | undefined;
      source?: GoalProgressEntryRecord['source'] | undefined;
      sourceEntityId?: string | null | undefined;
    },
    context?: OperationContext,
  ): GoalMetricsState {
    const goal = this.requireGoal(goalId);
    this.assertVersion(goal.version, expectedVersion);
    const metric = this.requireGoalMetric(input.metricId);
    if (metric.goalId !== goalId) throw new Error('GOAL_METRIC_MISMATCH');
    if (!Number.isFinite(input.value)) throw new Error('INVALID_GOAL_PROGRESS_VALUE');
    if (metric.metricType === 'BOOLEAN' && input.value !== 0 && input.value !== 1)
      throw new Error('INVALID_GOAL_PROGRESS_VALUE');
    const recordedAt = input.recordedAt === undefined ? this.now() : Date.parse(input.recordedAt);
    if (!Number.isFinite(recordedAt)) throw new Error('INVALID_GOAL_PROGRESS_DATE');
    const entryId = ulid();
    this.database.transaction(() => {
      const before = this.captureBefore(goalId, context);
      this.database.raw
        .prepare(
          `INSERT INTO goal_progress_entries(id,goal_id,metric_id,value,recorded_at,source,source_entity_id,note)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run(
          entryId,
          goalId,
          input.metricId,
          input.value,
          recordedAt,
          input.source ?? 'USER',
          input.sourceEntityId ?? null,
          optionalTrimmed(input.note),
        );
      refreshGoalProgress(this.database, goalId);
      const version = this.bumpEntity(goalId);
      this.recordUpdate(
        goalId,
        version,
        'GoalProgressRecorded',
        { entryId, ...input },
        before,
        context,
      );
    });
    return this.getGoalMetrics(goalId);
  }

  public createPlan(
    input: {
      goalId?: string | null | undefined;
      categoryId: string;
      title: string;
      description?: string | undefined;
      priority: Priority;
      startDate: string;
      endDate: string;
    },
    context?: OperationContext,
  ): PlanRecord {
    calculateGoalHorizon(input.startDate, input.endDate);
    const id = ulid();
    this.database.transaction(() => {
      this.insertEntity(id, 'PLAN');
      this.database.raw
        .prepare(
          `INSERT INTO plans(id, goal_id, category_id, title, description, status, priority, start_date, end_date)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
        )
        .run(
          id,
          input.goalId ?? null,
          input.categoryId,
          input.title.trim(),
          input.description ?? null,
          input.priority,
          input.startDate,
          input.endDate,
        );
      this.recordCreate(id, 'PlanCreated', input, context);
    });
    return this.requirePlan(id);
  }

  public listPlans(): readonly PlanRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT resource.*, entity.version, entity.created_at, entity.updated_at
         FROM plans resource ${activeEntityJoin} ORDER BY resource.status, resource.end_date, resource.title`,
      )
      .all() as PlanRow[];
    return rows.map((row) => this.mapPlan(row));
  }

  public updatePlan(
    id: string,
    expectedVersion: number,
    patch: OptionalPatch<
      Pick<PlanRecord, 'title' | 'description' | 'status' | 'priority' | 'startDate' | 'endDate'>
    >,
    context?: OperationContext,
  ): PlanRecord {
    const current = this.requirePlan(id);
    this.assertVersion(current.version, expectedVersion);
    const startDate = patch.startDate ?? current.startDate;
    const endDate = patch.endDate ?? current.endDate;
    calculateGoalHorizon(startDate, endDate);
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          `UPDATE plans SET title = ?, description = ?, status = ?, priority = ?, start_date = ?, end_date = ? WHERE id = ?`,
        )
        .run(
          patch.title?.trim() ?? current.title,
          patch.description === undefined ? current.description : patch.description,
          patch.status ?? current.status,
          patch.priority ?? current.priority,
          startDate,
          endDate,
          id,
        );
      const version = this.bumpEntity(id);
      this.recordUpdate(id, version, 'PlanUpdated', patch, before, context);
    });
    return this.requirePlan(id);
  }

  public setPlanProgress(
    id: string,
    expectedVersion: number,
    value: number | null,
    context?: OperationContext,
  ): PlanRecord {
    const current = this.requirePlan(id);
    this.assertVersion(current.version, expectedVersion);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new Error('INVALID_PROGRESS');
    }
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          `UPDATE plans SET manual_progress = ?, progress_mode = ?, display_progress = CASE WHEN ? IS NULL THEN auto_progress ELSE ? END WHERE id = ?`,
        )
        .run(value, value === null ? 'AUTO' : 'MANUAL_OVERRIDE', value, value, id);
      const version = this.bumpEntity(id);
      this.recordUpdate(id, version, 'PlanProgressChanged', { value }, before, context);
    });
    return this.requirePlan(id);
  }

  public listPlanMilestones(planId: string): readonly PlanMilestoneRecord[] {
    this.requirePlan(planId);
    const rows = this.database.raw
      .prepare(
        `SELECT milestone.*, entity.version, entity.created_at, entity.updated_at
         FROM milestones milestone
         JOIN entity_index entity ON entity.id = milestone.id AND entity.deleted_at IS NULL
         WHERE milestone.plan_id = ? ORDER BY milestone.due_at, milestone.title`,
      )
      .all(planId) as PlanMilestoneRow[];
    return rows.map((row) => this.mapPlanMilestone(row));
  }

  public createPlanMilestone(
    planId: string,
    input: {
      title: string;
      description?: string | undefined;
      dueAt: number;
      linkedEntityIds?: readonly string[] | undefined;
    },
    context?: OperationContext,
  ): PlanMilestoneRecord {
    this.requirePlan(planId);
    if (!Number.isInteger(input.dueAt)) throw new Error('INVALID_DUE_AT');
    const linkedEntityIds = this.validateMilestoneLinks(input.linkedEntityIds ?? []);
    const id = ulid();
    this.database.transaction(() => {
      const before = this.captureBefore(planId, context);
      this.insertEntity(id, 'MILESTONE');
      this.database.raw
        .prepare(
          `INSERT INTO milestones(id, plan_id, title, description, due_at, status)
           VALUES (?, ?, ?, ?, ?, 'PENDING')`,
        )
        .run(id, planId, input.title.trim(), input.description ?? null, input.dueAt);
      this.replaceMilestoneLinks(id, linkedEntityIds);
      const planVersion = this.bumpEntity(planId);
      this.recordUpdate(
        planId,
        planVersion,
        'PlanMilestoneCreated',
        { milestoneId: id, ...input, linkedEntityIds },
        before,
        context,
      );
    });
    return this.requirePlanMilestone(id);
  }

  public updatePlanMilestone(
    id: string,
    expectedVersion: number,
    patch: OptionalPatch<
      Pick<PlanMilestoneRecord, 'title' | 'description' | 'dueAt' | 'status' | 'linkedEntityIds'>
    >,
    context?: OperationContext,
  ): PlanMilestoneRecord {
    const current = this.requirePlanMilestone(id);
    this.assertVersion(current.version, expectedVersion);
    const dueAt = patch.dueAt === undefined ? Date.parse(current.dueAt) : Date.parse(patch.dueAt);
    if (!Number.isInteger(dueAt)) throw new Error('INVALID_DUE_AT');
    const linkedEntityIds =
      patch.linkedEntityIds === undefined
        ? current.linkedEntityIds
        : this.validateMilestoneLinks(patch.linkedEntityIds);
    const status = patch.status ?? current.status;
    this.database.transaction(() => {
      const before = this.captureBefore(current.planId, context);
      this.database.raw
        .prepare(
          `UPDATE milestones SET title=?, description=?, due_at=?, status=?, achieved_at=? WHERE id=?`,
        )
        .run(
          patch.title?.trim() ?? current.title,
          patch.description === undefined ? current.description : patch.description,
          dueAt,
          status,
          status === 'ACHIEVED'
            ? current.achievedAt === null
              ? this.now()
              : Date.parse(current.achievedAt)
            : null,
          id,
        );
      this.replaceMilestoneLinks(id, linkedEntityIds);
      this.bumpEntity(id);
      const planVersion = this.bumpEntity(current.planId);
      this.recordUpdate(
        current.planId,
        planVersion,
        'PlanMilestoneUpdated',
        { milestoneId: id, ...patch },
        before,
        context,
      );
    });
    return this.requirePlanMilestone(id);
  }

  public deletePlanMilestone(
    id: string,
    expectedVersion: number,
    context?: OperationContext,
  ): void {
    const current = this.requirePlanMilestone(id);
    this.assertVersion(current.version, expectedVersion);
    this.database.transaction(() => {
      const before = this.captureBefore(current.planId, context);
      const now = this.now();
      this.database.raw
        .prepare(
          'UPDATE entity_index SET version=version+1,updated_at=?,deleted_at=?,purge_after=? WHERE id=?',
        )
        .run(now, now, now + 30 * 86_400_000, id);
      const planVersion = this.bumpEntity(current.planId);
      this.recordUpdate(
        current.planId,
        planVersion,
        'PlanMilestoneDeleted',
        { milestoneId: id },
        before,
        context,
      );
    });
  }

  public createTask(
    input: {
      categoryId: string;
      planId?: string | null | undefined;
      goalId?: string | null | undefined;
      parentTaskId?: string | null | undefined;
      title: string;
      description?: string | undefined;
      priority: Priority;
      dueAt: number;
      estimatedMinutes: number;
      isFlexible: boolean;
      isSplittable?: boolean | undefined;
      preferredArea: PreferredArea;
    },
    context?: OperationContext,
  ): TaskRecord {
    assertEstimatedMinutes(input.estimatedMinutes);
    if (!Number.isInteger(input.dueAt)) throw new Error('INVALID_DUE_AT');
    if (input.parentTaskId !== undefined && input.parentTaskId !== null) {
      const parent = this.requireTask(input.parentTaskId);
      if (parent.parentTaskId !== null) throw new Error('SUBTASK_DEPTH_EXCEEDED');
    }
    this.assertCategoryArea(input.categoryId, input.preferredArea);
    const id = ulid();
    this.database.transaction(() => {
      this.insertEntity(id, 'TASK');
      this.database.raw
        .prepare(
          `INSERT INTO tasks(
             id, category_id, plan_id, goal_id, parent_task_id, title, description, status,
             priority, due_at, estimated_minutes, is_flexible, is_splittable, preferred_area
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'TODO', ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.categoryId,
          input.parentTaskId === undefined ? (input.planId ?? null) : null,
          input.goalId ?? null,
          input.parentTaskId ?? null,
          input.title.trim(),
          input.description ?? null,
          input.priority,
          input.dueAt,
          input.estimatedMinutes,
          input.isFlexible ? 1 : 0,
          input.isSplittable === true ? 1 : 0,
          input.preferredArea,
        );
      this.recordCreate(id, 'TaskCreated', input, context);
    });
    return this.requireTask(id);
  }

  public listTasks(
    options: {
      includeCompleted?: boolean;
      dueFromMs?: number;
      dueToMs?: number;
      area?: PreferredArea;
      ids?: readonly string[];
      linkedOnly?: boolean;
      limit?: number;
    } = {},
  ): readonly TaskRecord[] {
    const ids = options.ids ?? [];
    const idFilter = ids.length === 0 ? '' : `AND resource.id IN (${ids.map(() => '?').join(',')})`;
    const linkedFilter =
      options.linkedOnly === true
        ? 'AND (resource.plan_id IS NOT NULL OR resource.goal_id IS NOT NULL)'
        : '';
    const limit = options.limit ?? 200;
    const rows = this.database.raw
      .prepare(
        `SELECT resource.*, entity.version, entity.created_at, entity.updated_at
         FROM tasks resource ${activeEntityJoin}
         JOIN categories category ON category.id = resource.category_id
         WHERE (? = 1 OR resource.status IN ('TODO','IN_PROGRESS'))
           AND (? IS NULL OR resource.due_at >= ?)
           AND (? IS NULL OR resource.due_at < ?)
           AND (? IS NULL OR category.parent_area = ?)
           ${idFilter}
           ${linkedFilter}
         ORDER BY CASE resource.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
                  resource.due_at, resource.title
         LIMIT ?`,
      )
      .all(
        options.includeCompleted === true ? 1 : 0,
        options.dueFromMs ?? null,
        options.dueFromMs ?? null,
        options.dueToMs ?? null,
        options.dueToMs ?? null,
        options.area ?? null,
        options.area ?? null,
        ...ids,
        limit,
      ) as TaskRow[];
    return rows.map((row) => this.mapTask(row));
  }

  public getTask(id: string): TaskRecord | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT resource.*, entity.version, entity.created_at, entity.updated_at
         FROM tasks resource ${activeEntityJoin} WHERE resource.id = ?`,
      )
      .get(id) as TaskRow | undefined;
    return row === undefined ? undefined : this.mapTask(row);
  }

  public updateTask(
    id: string,
    expectedVersion: number,
    patch: OptionalPatch<
      Pick<
        TaskRecord,
        | 'title'
        | 'description'
        | 'priority'
        | 'dueAt'
        | 'estimatedMinutes'
        | 'isFlexible'
        | 'isSplittable'
        | 'preferredArea'
      >
    >,
    context?: OperationContext,
  ): TaskRecord {
    const current = this.requireTask(id);
    this.assertVersion(current.version, expectedVersion);
    const estimatedMinutes = patch.estimatedMinutes ?? current.estimatedMinutes;
    assertEstimatedMinutes(estimatedMinutes);
    const dueAt = patch.dueAt === undefined ? Date.parse(current.dueAt) : Date.parse(patch.dueAt);
    if (!Number.isFinite(dueAt)) throw new Error('INVALID_DUE_AT');
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          `UPDATE tasks SET title = ?, description = ?, priority = ?, due_at = ?, estimated_minutes = ?,
             is_flexible = ?, is_splittable = ?, preferred_area = ? WHERE id = ?`,
        )
        .run(
          patch.title?.trim() ?? current.title,
          patch.description === undefined ? current.description : patch.description,
          patch.priority ?? current.priority,
          dueAt,
          estimatedMinutes,
          (patch.isFlexible ?? current.isFlexible) ? 1 : 0,
          (patch.isSplittable ?? current.isSplittable) ? 1 : 0,
          patch.preferredArea ?? current.preferredArea,
          id,
        );
      const version = this.bumpEntity(id);
      this.recordUpdate(id, version, 'TaskUpdated', patch, before, context);
      this.releaseTaskBlocks(id);
    });
    return this.requireTask(id);
  }

  /** Step-1 compatibility path: callers must supply provenance explicitly. */
  public updateTaskWithContext(
    id: string,
    expectedVersion: number,
    patch: OptionalPatch<
      Pick<
        TaskRecord,
        | 'title'
        | 'description'
        | 'priority'
        | 'dueAt'
        | 'estimatedMinutes'
        | 'isFlexible'
        | 'isSplittable'
        | 'preferredArea'
      >
    >,
    context: OperationContext,
  ): TaskRecord {
    return this.updateTask(id, expectedVersion, patch, context);
  }

  public transitionTask(
    id: string,
    expectedVersion: number,
    status: TaskStatus,
    context?: OperationContext,
  ): TaskRecord {
    const current = this.requireTask(id);
    this.assertVersion(current.version, expectedVersion);
    assertTaskTransition(current.status, status);
    const now = this.now();
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare('UPDATE tasks SET status = ?, completed_at = ?, cancelled_at = ? WHERE id = ?')
        .run(status, status === 'COMPLETED' ? now : null, status === 'CANCELLED' ? now : null, id);
      const version = this.bumpEntity(id);
      if (status === 'COMPLETED' || status === 'CANCELLED')
        this.releaseTaskBlocks(id, status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_CANCELLED');
      this.recordUpdate(
        id,
        version,
        status === 'COMPLETED' ? 'TaskCompleted' : 'TaskStatusChanged',
        { from: current.status, to: status },
        before,
        context,
      );
      this.refreshProgress(current.planId, current.goalId);
    });
    return this.requireTask(id);
  }

  public addDependency(
    taskId: string,
    predecessorTaskId: string,
    context?: OperationContext,
    expectedVersion?: number,
  ): void {
    const task = this.requireTask(taskId);
    if (expectedVersion !== undefined) this.assertVersion(task.version, expectedVersion);
    this.requireTask(predecessorTaskId);
    const edges = this.database.raw
      .prepare('SELECT predecessor_task_id, successor_task_id FROM task_dependencies')
      .all() as { predecessor_task_id: string; successor_task_id: string }[];
    assertNoDependencyCycle(
      edges.map((edge) => [edge.predecessor_task_id, edge.successor_task_id] as const),
      [predecessorTaskId, taskId],
    );
    this.database.transaction(() => {
      const before = this.captureBefore(taskId, context);
      const result = this.database.raw
        .prepare(
          `INSERT OR IGNORE INTO task_dependencies(predecessor_task_id, successor_task_id, created_at) VALUES (?, ?, ?)`,
        )
        .run(predecessorTaskId, taskId, this.now());
      if (result.changes === 0) return;
      const version = this.bumpEntity(taskId);
      this.recordUpdate(
        taskId,
        version,
        'TaskDependencyAdded',
        { predecessorTaskId },
        before,
        context,
      );
    });
  }

  public listTaskDependencies(taskId: string): {
    readonly taskId: string;
    readonly predecessorTaskIds: readonly string[];
    readonly successorTaskIds: readonly string[];
  } {
    this.requireTask(taskId);
    const rows = this.database.raw
      .prepare(
        `SELECT predecessor_task_id, successor_task_id
         FROM task_dependencies
         WHERE predecessor_task_id = ? OR successor_task_id = ?
         ORDER BY predecessor_task_id, successor_task_id`,
      )
      .all(taskId, taskId) as { predecessor_task_id: string; successor_task_id: string }[];
    return {
      taskId,
      predecessorTaskIds: rows
        .filter((row) => row.successor_task_id === taskId)
        .map((row) => row.predecessor_task_id),
      successorTaskIds: rows
        .filter((row) => row.predecessor_task_id === taskId)
        .map((row) => row.successor_task_id),
    };
  }

  public removeDependency(
    taskId: string,
    predecessorTaskId: string,
    expectedVersion: number,
    context?: OperationContext,
  ): void {
    const task = this.requireTask(taskId);
    this.assertVersion(task.version, expectedVersion);
    this.requireTask(predecessorTaskId);
    this.database.transaction(() => {
      const before = this.captureBefore(taskId, context);
      const result = this.database.raw
        .prepare(
          'DELETE FROM task_dependencies WHERE predecessor_task_id = ? AND successor_task_id = ?',
        )
        .run(predecessorTaskId, taskId);
      if (result.changes === 0) throw new Error('TASK_DEPENDENCY_NOT_FOUND');
      const version = this.bumpEntity(taskId);
      this.recordUpdate(
        taskId,
        version,
        'TaskDependencyRemoved',
        { predecessorTaskId },
        before,
        context,
      );
    });
  }

  public listEntityTags(entityId: string): readonly EntityTagRecord[] {
    this.requireCoreEntity(entityId);
    return this.database.raw
      .prepare(
        `SELECT tag.id, tag.name, tag.color_token colorToken, tag.description, tag_entity.version
         FROM tag_links link
         JOIN tags tag ON tag.id = link.tag_id
         JOIN entity_index tag_entity ON tag_entity.id = tag.id AND tag_entity.deleted_at IS NULL
         WHERE link.entity_id = ?
         ORDER BY tag.name`,
      )
      .all(entityId) as EntityTagRecord[];
  }

  public addEntityTag(
    entityId: string,
    tagId: string,
    expectedVersion: number,
    context?: OperationContext,
  ): void {
    const entity = this.requireCoreEntity(entityId);
    this.assertVersion(entity.version, expectedVersion);
    const tag = this.database.raw
      .prepare(
        `SELECT tag.id FROM tags tag
         JOIN entity_index entity ON entity.id = tag.id AND entity.deleted_at IS NULL
         WHERE tag.id = ?`,
      )
      .get(tagId);
    if (tag === undefined) throw new Error('TAG_NOT_FOUND');
    this.database.transaction(() => {
      const before = this.captureBefore(entityId, context);
      const result = this.database.raw
        .prepare('INSERT OR IGNORE INTO tag_links(tag_id, entity_id, created_at) VALUES (?, ?, ?)')
        .run(tagId, entityId, this.now());
      if (result.changes === 0) return;
      const version = this.bumpEntity(entityId);
      this.recordUpdate(entityId, version, 'EntityTagAdded', { tagId }, before, context);
    });
  }

  public removeEntityTag(
    entityId: string,
    tagId: string,
    expectedVersion: number,
    context?: OperationContext,
  ): void {
    const entity = this.requireCoreEntity(entityId);
    this.assertVersion(entity.version, expectedVersion);
    this.database.transaction(() => {
      const before = this.captureBefore(entityId, context);
      const result = this.database.raw
        .prepare('DELETE FROM tag_links WHERE tag_id = ? AND entity_id = ?')
        .run(tagId, entityId);
      if (result.changes === 0) throw new Error('TAG_LINK_NOT_FOUND');
      const version = this.bumpEntity(entityId);
      this.recordUpdate(entityId, version, 'EntityTagRemoved', { tagId }, before, context);
    });
  }

  public createEvent(
    input: {
      categoryId: string;
      title: string;
      description?: string | undefined;
      startAt: number;
      endAt: number;
      eventType: EventRecord['eventType'];
      priority: Priority;
      isImmovable?: boolean | undefined;
      allowOverlap?: boolean | undefined;
    },
    context?: OperationContext,
  ): EventRecord {
    assertValidRange(input);
    const conflicts = this.findEventConflicts(input.startAt, input.endAt);
    if (conflicts.length > 0 && input.allowOverlap !== true) throw new Error('SCHEDULE_CONFLICT');
    const id = ulid();
    const isImmovable =
      input.isImmovable ?? (input.eventType === 'MEETING' || input.eventType === 'MEDICAL');
    this.database.transaction(() => {
      this.insertEntity(id, 'EVENT');
      this.database.raw
        .prepare(
          `INSERT INTO events(id, category_id, title, description, start_at, end_at, event_type, priority, is_immovable, allow_overlap, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
        )
        .run(
          id,
          input.categoryId,
          input.title.trim(),
          input.description ?? null,
          input.startAt,
          input.endAt,
          input.eventType,
          input.priority,
          isImmovable ? 1 : 0,
          input.allowOverlap === true ? 1 : 0,
        );
      this.recordCreate(id, 'EventCreated', input, context);
    });
    return this.requireEvent(id);
  }

  public updateEvent(
    id: string,
    expectedVersion: number,
    patch: OptionalPatch<
      Pick<
        EventRecord,
        | 'title'
        | 'description'
        | 'startAt'
        | 'endAt'
        | 'eventType'
        | 'priority'
        | 'isImmovable'
        | 'allowOverlap'
        | 'status'
      >
    >,
    context?: OperationContext,
  ): EventRecord {
    const current = this.requireEvent(id);
    this.assertVersion(current.version, expectedVersion);
    const startAt =
      patch.startAt === undefined ? Date.parse(current.startAt) : Date.parse(patch.startAt);
    const endAt = patch.endAt === undefined ? Date.parse(current.endAt) : Date.parse(patch.endAt);
    assertValidRange({ startAt, endAt });
    const allowOverlap = patch.allowOverlap ?? current.allowOverlap;
    const conflicts = this.findEventConflicts(startAt, endAt, id);
    if (conflicts.length > 0 && !allowOverlap) throw new Error('SCHEDULE_CONFLICT');
    this.database.transaction(() => {
      const before = this.captureBefore(id, context);
      this.database.raw
        .prepare(
          `UPDATE events SET title=?, description=?, start_at=?, end_at=?, event_type=?, priority=?,
             is_immovable=?, allow_overlap=?, status=? WHERE id=?`,
        )
        .run(
          patch.title?.trim() ?? current.title,
          patch.description === undefined ? current.description : patch.description,
          startAt,
          endAt,
          patch.eventType ?? current.eventType,
          patch.priority ?? current.priority,
          (patch.isImmovable ?? current.isImmovable) ? 1 : 0,
          allowOverlap ? 1 : 0,
          patch.status ?? current.status,
          id,
        );
      const version = this.bumpEntity(id);
      this.recordUpdate(id, version, 'EventUpdated', patch, before, context);
    });
    return this.requireEvent(id);
  }

  public softDelete(id: string, expectedVersion: number, context?: OperationContext): void {
    const row = this.database.raw
      .prepare('SELECT version, entity_type FROM entity_index WHERE id = ? AND deleted_at IS NULL')
      .get(id) as { version: number; entity_type: string } | undefined;
    if (row === undefined) throw new Error('ENTITY_NOT_FOUND');
    if (!['GOAL', 'PLAN', 'TASK', 'EVENT'].includes(row.entity_type))
      throw new Error('ENTITY_TYPE_NOT_SUPPORTED');
    this.assertVersion(row.version, expectedVersion);
    this.database.transaction(() => {
      const before =
        context === undefined ? undefined : this.canonicalHistory.captureCurrentState(id);
      const now = this.now();
      this.database.raw
        .prepare(
          'UPDATE entity_index SET version = version + 1, updated_at = ?, deleted_at = ?, purge_after = ? WHERE id = ?',
        )
        .run(now, now, now + 30 * 86_400_000, id);
      if (row.entity_type === 'TASK') this.releaseTaskBlocks(id, 'TASK_DELETED');
      if (context !== undefined && before !== undefined)
        this.canonicalHistory.recordLifecycleChange({
          entityId: id,
          before,
          context,
          summary: `${row.entity_type}Deleted`,
          operation: 'SOFT_DELETE',
        });
      else this.audit(id, expectedVersion + 1, `${row.entity_type}Deleted`, { id });
    });
  }

  public listEvents(from?: number, to?: number): readonly EventRecord[] {
    const rows = this.database.raw
      .prepare(
        `SELECT resource.*, entity.version, entity.created_at, entity.updated_at
         FROM events resource ${activeEntityJoin}
         WHERE (? IS NULL OR resource.end_at > ?) AND (? IS NULL OR resource.start_at < ?)
         ORDER BY resource.start_at`,
      )
      .all(from ?? null, from ?? null, to ?? null, to ?? null) as EventRow[];
    return rows.map((row) => this.mapEvent(row));
  }

  public getEvent(id: string): EventRecord | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT resource.*, entity.version, entity.created_at, entity.updated_at
         FROM events resource ${activeEntityJoin} WHERE resource.id = ?`,
      )
      .get(id) as EventRow | undefined;
    return row === undefined ? undefined : this.mapEvent(row);
  }

  public findEventConflicts(
    startAt: number,
    endAt: number,
    excludeId?: string,
  ): readonly EventRecord[] {
    assertValidRange({ startAt, endAt });
    return this.listEvents(startAt, endAt).filter(
      (event) =>
        event.id !== excludeId &&
        event.status === 'SCHEDULED' &&
        overlaps(
          { startAt, endAt },
          { startAt: Date.parse(event.startAt), endAt: Date.parse(event.endAt) },
        ),
    );
  }

  private requireGoal(id: string): GoalRecord {
    const value = this.listGoals().find((item) => item.id === id);
    if (value === undefined) throw new Error('GOAL_NOT_FOUND');
    return value;
  }

  private requireGoalMetric(id: string): GoalMetricRecord {
    const row = this.database.raw
      .prepare(
        `SELECT metric.*,
                (SELECT entry.value FROM goal_progress_entries entry WHERE entry.metric_id=metric.id
                 ORDER BY entry.recorded_at DESC,entry.id DESC LIMIT 1) latest_value,
                (SELECT entry.recorded_at FROM goal_progress_entries entry WHERE entry.metric_id=metric.id
                 ORDER BY entry.recorded_at DESC,entry.id DESC LIMIT 1) latest_recorded_at,
                (SELECT entry.value FROM goal_progress_entries entry WHERE entry.metric_id=metric.id
                 ORDER BY entry.recorded_at ASC,entry.id ASC LIMIT 1) first_value
         FROM goal_metrics metric JOIN entity_index entity ON entity.id=metric.goal_id AND entity.deleted_at IS NULL
         WHERE metric.id=?`,
      )
      .get(id) as GoalMetricRow | undefined;
    if (row === undefined) throw new Error('GOAL_METRIC_NOT_FOUND');
    return {
      id: row.id,
      goalId: row.goal_id,
      name: row.name,
      metricType: row.metric_type,
      unit: row.unit,
      startValue: row.start_value,
      targetValue: row.target_value,
      direction: row.direction,
      weight: row.weight,
      latestValue: row.latest_value,
      latestRecordedAt:
        row.latest_recorded_at === null ? null : new Date(row.latest_recorded_at).toISOString(),
      progressPercent: calculateMetricProgress({
        id: row.id,
        metricType: row.metric_type,
        startValue: row.start_value,
        targetValue: row.target_value,
        direction: row.direction,
        weight: row.weight,
        latestValue: row.latest_value,
        firstValue: row.first_value,
      }),
    };
  }

  private requirePlan(id: string): PlanRecord {
    const value = this.listPlans().find((item) => item.id === id);
    if (value === undefined) throw new Error('PLAN_NOT_FOUND');
    return value;
  }

  private requirePlanMilestone(id: string): PlanMilestoneRecord {
    const row = this.database.raw
      .prepare(
        `SELECT milestone.*, entity.version, entity.created_at, entity.updated_at
         FROM milestones milestone
         JOIN entity_index entity ON entity.id=milestone.id AND entity.deleted_at IS NULL
         WHERE milestone.id=?`,
      )
      .get(id) as PlanMilestoneRow | undefined;
    if (row === undefined) throw new Error('PLAN_MILESTONE_NOT_FOUND');
    return this.mapPlanMilestone(row);
  }

  private requireTask(id: string): TaskRecord {
    const value = this.getTask(id);
    if (value === undefined) throw new Error('TASK_NOT_FOUND');
    return value;
  }

  private requireEvent(id: string): EventRecord {
    const value = this.listEvents().find((item) => item.id === id);
    if (value === undefined) throw new Error('EVENT_NOT_FOUND');
    return value;
  }

  private insertEntity(id: string, entityType: string): void {
    const now = this.now();
    this.database.raw
      .prepare(
        'INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run(id, entityType, now, now);
  }

  private bumpEntity(id: string): number {
    this.database.raw
      .prepare('UPDATE entity_index SET version = version + 1, updated_at = ? WHERE id = ?')
      .run(this.now(), id);
    const row = this.database.raw
      .prepare('SELECT version FROM entity_index WHERE id = ?')
      .get(id) as {
      version: number;
    };
    return row.version;
  }

  private captureBefore(
    entityId: string,
    context: OperationContext | undefined,
  ): CanonicalEntitySnapshot | undefined {
    return context === undefined ? undefined : this.canonicalHistory.captureCurrentState(entityId);
  }

  private recordCreate(
    entityId: string,
    eventType: string,
    legacySnapshot: unknown,
    context: OperationContext | undefined,
  ): void {
    if (context === undefined) this.audit(entityId, 1, eventType, legacySnapshot);
    else this.canonicalHistory.recordCreate(entityId, context, eventType);
  }

  private recordUpdate(
    entityId: string,
    version: number,
    eventType: string,
    legacySnapshot: unknown,
    before: CanonicalEntitySnapshot | undefined,
    context: OperationContext | undefined,
  ): void {
    if (context === undefined || before === undefined)
      this.audit(entityId, version, eventType, legacySnapshot);
    else this.canonicalHistory.recordUpdate(entityId, before, context, eventType);
  }

  private audit(entityId: string, version: number, eventType: string, snapshot: unknown): void {
    const now = this.now();
    const changeSetId = this.activeChangeSetId ?? ulid();
    if (this.activeChangeSetId === undefined)
      this.database.raw
        .prepare(
          `INSERT INTO change_sets(id, source, summary, risk_level, status, created_at, applied_at)
           VALUES (?, 'USER', ?, 'LOW_WRITE', 'APPLIED', ?, ?)`,
        )
        .run(changeSetId, eventType, now, now);
    this.database.raw
      .prepare(
        `INSERT INTO entity_versions(id, entity_id, entity_version, change_set_id, source, snapshot_json, patch_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', ?)`,
      )
      .run(
        ulid(),
        entityId,
        version,
        changeSetId,
        this.activeChangeSetId === undefined ? 'USER' : 'AI',
        JSON.stringify(snapshot),
        now,
      );
    const sequence = (
      this.database.raw
        .prepare('SELECT COUNT(*) AS count FROM change_operations WHERE change_set_id=?')
        .get(changeSetId) as { count: number }
    ).count;
    this.database.raw
      .prepare(
        `INSERT INTO change_operations(id, change_set_id, sequence, entity_id, operation, before_json, after_json)
         VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      )
      .run(
        ulid(),
        changeSetId,
        sequence,
        entityId,
        version === 1 ? 'CREATE' : 'UPDATE',
        JSON.stringify(snapshot),
      );
    this.database.raw
      .prepare(
        `INSERT INTO domain_events(id, event_type, aggregate_id, aggregate_version, payload_json, status, next_attempt_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      )
      .run(ulid(), eventType, entityId, version, JSON.stringify(snapshot), now, now);
  }

  private releaseTaskBlocks(taskId: string, reason = 'TASK_UPDATED'): void {
    const now = this.now();
    this.database.raw
      .prepare(
        `UPDATE entity_index SET deleted_at = ?, purge_after = NULL, updated_at = ?
         WHERE id IN (
           SELECT blocks.id FROM schedule_blocks blocks
           JOIN entity_index block_entity ON block_entity.id = blocks.id AND block_entity.deleted_at IS NULL
           WHERE blocks.target_entity_id = ?
         )`,
      )
      .run(now, now, taskId);
    // schedule-specific history：为本次释放的旧块记录原因（原时间保留在块行中）。
    this.database.raw
      .prepare(
        `UPDATE schedule_blocks SET reason_code = 'RELEASED', reason_json = ?
         WHERE target_entity_id = ? AND (reason_code IS NULL OR reason_code <> 'RELEASED')`,
      )
      .run(JSON.stringify({ reason, releasedAt: new Date(now).toISOString() }), taskId);
  }

  private refreshProgress(planId: string | null, goalId: string | null): void {
    if (planId !== null) {
      const counts = this.database.raw
        .prepare(
          `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
           FROM tasks WHERE plan_id = ? AND status <> 'CANCELLED'`,
        )
        .get(planId) as { total: number; completed: number | null };
      const progress = counts.total === 0 ? 0 : ((counts.completed ?? 0) / counts.total) * 100;
      this.database.raw
        .prepare(
          `UPDATE plans SET auto_progress = ?, display_progress = CASE WHEN progress_mode = 'AUTO' THEN ? ELSE display_progress END WHERE id = ?`,
        )
        .run(progress, progress, planId);
      const plan = this.requirePlan(planId);
      goalId ??= plan.goalId;
    }
    if (goalId !== null) refreshGoalProgress(this.database, goalId);
  }

  private assertGoalMetric(input: {
    name: string;
    metricType: GoalMetricRecord['metricType'];
    startValue?: number | null | undefined;
    targetValue: number;
    direction: GoalMetricRecord['direction'];
    weight?: number | undefined;
  }): void {
    if (input.name.trim().length === 0 || input.name.trim().length > 200)
      throw new Error('INVALID_GOAL_METRIC_NAME');
    if (!Number.isFinite(input.targetValue)) throw new Error('INVALID_GOAL_METRIC_TARGET');
    if (
      input.startValue !== undefined &&
      input.startValue !== null &&
      !Number.isFinite(input.startValue)
    )
      throw new Error('INVALID_GOAL_METRIC_START');
    if (input.weight !== undefined && (!Number.isFinite(input.weight) || input.weight <= 0))
      throw new Error('INVALID_GOAL_METRIC_WEIGHT');
    if (
      input.metricType === 'BOOLEAN' &&
      ((input.startValue !== undefined &&
        input.startValue !== null &&
        ![0, 1].includes(input.startValue)) ||
        ![0, 1].includes(input.targetValue))
    )
      throw new Error('INVALID_GOAL_METRIC_BOOLEAN');
  }

  private assertCategoryArea(categoryId: string, area: PreferredArea): void {
    const category = this.database.raw
      .prepare('SELECT parent_area FROM categories WHERE id = ? AND is_archived = 0')
      .get(categoryId) as { parent_area: PreferredArea } | undefined;
    if (category === undefined) throw new Error('CATEGORY_NOT_FOUND');
    if (category.parent_area !== area) throw new Error('CATEGORY_AREA_MISMATCH');
  }

  private validateMilestoneLinks(entityIds: readonly string[]): readonly string[] {
    const uniqueIds = [...new Set(entityIds)];
    for (const entityId of uniqueIds) {
      const row = this.database.raw
        .prepare(
          `SELECT entity_type FROM entity_index
           WHERE id=? AND deleted_at IS NULL AND entity_type IN ('TASK','DEV_FEATURE')`,
        )
        .get(entityId);
      if (row === undefined) throw new Error('MILESTONE_LINK_TARGET_NOT_FOUND');
    }
    return uniqueIds;
  }

  private replaceMilestoneLinks(milestoneId: string, entityIds: readonly string[]): void {
    this.database.raw.prepare('DELETE FROM milestone_links WHERE milestone_id=?').run(milestoneId);
    const insert = this.database.raw.prepare(
      'INSERT INTO milestone_links(milestone_id,entity_id,created_at) VALUES (?,?,?)',
    );
    for (const entityId of entityIds) insert.run(milestoneId, entityId, this.now());
  }

  private requireCoreEntity(id: string): { readonly version: number; readonly entityType: string } {
    const row = this.database.raw
      .prepare(
        `SELECT version, entity_type entityType FROM entity_index
         WHERE id = ? AND deleted_at IS NULL AND entity_type IN ('GOAL', 'PLAN', 'TASK', 'EVENT')`,
      )
      .get(id) as { version: number; entityType: string } | undefined;
    if (row === undefined) throw new Error('ENTITY_NOT_FOUND');
    return row;
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) throw new Error('VERSION_CONFLICT');
  }

  private now(): number {
    return this.clock.now().getTime();
  }

  private mapGoal(row: GoalRow): GoalRecord {
    return {
      id: row.id,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      categoryId: row.category_id,
      title: row.title,
      description: row.description,
      goalType: row.goal_type,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      horizon: row.horizon,
      autoProgress: row.auto_progress,
      manualProgress: row.manual_progress,
      progressMode: row.progress_mode,
      displayProgress: row.display_progress,
    };
  }

  private mapPlan(row: PlanRow): PlanRecord {
    return {
      id: row.id,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      goalId: row.goal_id,
      categoryId: row.category_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      startDate: row.start_date,
      endDate: row.end_date,
      autoProgress: row.auto_progress,
      manualProgress: row.manual_progress,
      progressMode: row.progress_mode,
      displayProgress: row.display_progress,
    };
  }

  private mapPlanMilestone(row: PlanMilestoneRow): PlanMilestoneRecord {
    const linkedEntityIds = (
      this.database.raw
        .prepare('SELECT entity_id id FROM milestone_links WHERE milestone_id=? ORDER BY entity_id')
        .all(row.id) as { id: string }[]
    ).map((item) => item.id);
    return {
      id: row.id,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      planId: row.plan_id,
      title: row.title,
      description: row.description,
      dueAt: new Date(row.due_at).toISOString(),
      status: row.status,
      achievedAt: row.achieved_at === null ? null : new Date(row.achieved_at).toISOString(),
      linkedEntityIds,
    };
  }

  private mapTask(row: TaskRow): TaskRecord {
    return {
      id: row.id,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      categoryId: row.category_id,
      planId: row.plan_id,
      goalId: row.goal_id,
      parentTaskId: row.parent_task_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueAt: new Date(row.due_at).toISOString(),
      estimatedMinutes: row.estimated_minutes,
      isFlexible: row.is_flexible === 1,
      isSplittable: row.is_splittable === 1,
      preferredArea: row.preferred_area,
      completedAt: row.completed_at === null ? null : new Date(row.completed_at).toISOString(),
    };
  }

  private mapEvent(row: EventRow): EventRecord {
    return {
      id: row.id,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      categoryId: row.category_id,
      title: row.title,
      description: row.description,
      startAt: new Date(row.start_at).toISOString(),
      endAt: new Date(row.end_at).toISOString(),
      timeZone: row.time_zone,
      eventType: row.event_type,
      priority: row.priority,
      isImmovable: row.is_immovable === 1,
      allowOverlap: row.allow_overlap === 1,
      status: row.status,
    };
  }
}
