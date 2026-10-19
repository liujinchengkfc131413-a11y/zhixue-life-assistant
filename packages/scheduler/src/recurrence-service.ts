import { ulid } from 'ulid';

import type { ActionRepository, SqliteDatabase } from '@life-assistant/database';
import type { Clock } from '@life-assistant/kernel';

import { expandRecurrence, parseRecurrenceRule } from './recurrence.js';

export interface RecurrenceRuleRecord {
  readonly id: string;
  readonly version: number;
  readonly targetType: 'TASK_TEMPLATE' | 'EVENT_TEMPLATE';
  readonly targetEntityId: string;
  readonly rrule: string;
  readonly dtstartLocal: string;
  readonly timeZone: string;
  readonly untilAt: string | null;
  readonly countLimit: number | null;
  readonly generationHorizonDays: number;
  readonly isActive: boolean;
}

export interface RecurrenceOccurrenceRecord {
  readonly id: string;
  readonly ruleId: string;
  readonly recurrenceKey: string;
  readonly scheduledAt: string;
  readonly generatedEntityId: string | null;
  readonly status: 'GENERATED' | 'SKIPPED' | 'CANCELLED';
}

export type RecurrenceModification =
  'ONLY_THIS' | 'THIS_AND_FUTURE' | 'ENTIRE_SERIES' | 'SKIP_ONCE' | 'END_RECURRENCE';

export class RecurrenceService {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly actions: ActionRepository,
    private readonly clock: Clock,
  ) {}

  public createRule(input: {
    targetType: RecurrenceRuleRecord['targetType'];
    targetEntityId: string;
    rrule: string;
    dtstartLocal: string;
    generationHorizonDays?: number | undefined;
    templateSnapshot?: Record<string, unknown> | undefined;
  }): RecurrenceRuleRecord {
    const parsed = parseRecurrenceRule(input.rrule);
    const templateSnapshot = input.templateSnapshot ?? this.captureSeriesTemplate(input);
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, created_at, updated_at) VALUES (?, 'RECURRENCE_RULE', ?, ?)`,
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO recurrence_rules(
             id, target_type, target_entity_id, rrule, dtstart_local, until_at, count_limit, generation_horizon_days
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.targetType,
          input.targetEntityId,
          input.rrule,
          input.dtstartLocal,
          parsed.until ?? null,
          parsed.count ?? null,
          input.generationHorizonDays ?? 60,
        );
      this.database.raw
        .prepare(
          `INSERT INTO recurrence_exceptions(id,rule_id,recurrence_key,exception_type,override_json,created_at)
           VALUES (?,?,'__SERIES_TEMPLATE__','OVERRIDE',?,?)`,
        )
        .run(ulid(), id, JSON.stringify(templateSnapshot), now);
    });
    this.generate(id);
    return this.requireRule(id);
  }

  public getRule(id: string): RecurrenceRuleRecord | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT rule.*, entity.version FROM recurrence_rules rule
         JOIN entity_index entity ON entity.id = rule.id AND entity.deleted_at IS NULL WHERE rule.id = ?`,
      )
      .get(id) as
      | {
          id: string;
          version: number;
          target_type: RecurrenceRuleRecord['targetType'];
          target_entity_id: string;
          rrule: string;
          dtstart_local: string;
          time_zone: string;
          until_at: number | null;
          count_limit: number | null;
          generation_horizon_days: number;
          is_active: number;
        }
      | undefined;
    return row === undefined
      ? undefined
      : {
          id: row.id,
          version: row.version,
          targetType: row.target_type,
          targetEntityId: row.target_entity_id,
          rrule: row.rrule,
          dtstartLocal: row.dtstart_local,
          timeZone: row.time_zone,
          untilAt: row.until_at === null ? null : new Date(row.until_at).toISOString(),
          countLimit: row.count_limit,
          generationHorizonDays: row.generation_horizon_days,
          isActive: row.is_active === 1,
        };
  }

  public getRuleByTarget(targetEntityId: string): RecurrenceRuleRecord | undefined {
    const row = this.database.raw
      .prepare(
        `SELECT rule.id FROM recurrence_rules rule
         JOIN entity_index entity ON entity.id=rule.id AND entity.deleted_at IS NULL
         WHERE rule.target_entity_id=? OR rule.id IN (
           SELECT rule_id FROM recurrence_occurrences WHERE generated_entity_id=?
         ) ORDER BY rule.rowid DESC LIMIT 1`,
      )
      .get(targetEntityId, targetEntityId) as { id: string } | undefined;
    return row === undefined ? undefined : this.getRule(row.id);
  }

  public listOccurrences(id: string): readonly RecurrenceOccurrenceRecord[] {
    this.requireRule(id);
    return (
      this.database.raw
        .prepare(
          `SELECT id,rule_id ruleId,recurrence_key recurrenceKey,scheduled_at scheduledAt,
                  generated_entity_id generatedEntityId,status
           FROM recurrence_occurrences WHERE rule_id=? ORDER BY scheduled_at,id`,
        )
        .all(id) as {
        id: string;
        ruleId: string;
        recurrenceKey: string;
        scheduledAt: number;
        generatedEntityId: string | null;
        status: RecurrenceOccurrenceRecord['status'];
      }[]
    ).map((item) => ({ ...item, scheduledAt: new Date(item.scheduledAt).toISOString() }));
  }

  public generate(id: string): number {
    const rule = this.requireRule(id);
    if (!rule.isActive) return 0;
    const rangeEnd = Math.min(
      this.clock.now().getTime() + rule.generationHorizonDays * 86_400_000,
      rule.untilAt === null ? Number.POSITIVE_INFINITY : Date.parse(rule.untilAt),
    );
    const occurrences = expandRecurrence({
      rrule: rule.rrule,
      dtstartLocal: rule.dtstartLocal,
      rangeEnd,
    });
    let created = 0;
    for (const occurrence of occurrences) {
      const exists = this.database.raw
        .prepare('SELECT 1 FROM recurrence_occurrences WHERE rule_id = ? AND recurrence_key = ?')
        .get(id, occurrence.recurrenceKey);
      if (exists !== undefined) continue;
      const exception = this.database.raw
        .prepare(
          'SELECT exception_type, override_json FROM recurrence_exceptions WHERE rule_id = ? AND recurrence_key = ?',
        )
        .get(id, occurrence.recurrenceKey) as
        { exception_type: 'SKIP' | 'OVERRIDE'; override_json: string | null } | undefined;
      if (exception?.exception_type === 'SKIP') {
        this.insertOccurrence(
          id,
          occurrence.recurrenceKey,
          occurrence.scheduledAt,
          null,
          'SKIPPED',
        );
        continue;
      }
      const override =
        exception?.override_json === null || exception === undefined
          ? {}
          : (JSON.parse(exception.override_json) as Record<string, unknown>);
      const generatedId =
        this.canReuseTarget(rule, occurrence.scheduledAt) && Object.keys(override).length === 0
          ? rule.targetEntityId
          : this.cloneTarget(rule, occurrence.scheduledAt, override);
      this.insertOccurrence(
        id,
        occurrence.recurrenceKey,
        occurrence.scheduledAt,
        generatedId,
        'GENERATED',
      );
      this.database.raw
        .prepare(
          rule.targetType === 'TASK_TEMPLATE'
            ? 'UPDATE tasks SET recurrence_rule_id = ?, occurrence_id = ? WHERE id = ?'
            : 'UPDATE events SET recurrence_rule_id = ?, occurrence_id = ? WHERE id = ?',
        )
        .run(id, occurrence.recurrenceKey, generatedId);
      created += 1;
    }
    return created;
  }

  public addException(
    id: string,
    recurrenceKey: string,
    type: 'SKIP' | 'OVERRIDE',
    override?: Record<string, unknown>,
  ): void {
    this.requireRule(id);
    this.database.raw
      .prepare(
        `INSERT INTO recurrence_exceptions(id, rule_id, recurrence_key, exception_type, override_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(rule_id, recurrence_key) DO UPDATE SET exception_type = excluded.exception_type,
           override_json = excluded.override_json`,
      )
      .run(
        ulid(),
        id,
        recurrenceKey,
        type,
        override === undefined ? null : JSON.stringify(override),
        this.clock.now().getTime(),
      );
  }

  public splitRule(id: string, splitLocal: string, replacementRrule: string): RecurrenceRuleRecord {
    const current = this.requireRule(id);
    parseRecurrenceRule(replacementRrule);
    const splitAt = Date.parse(`${splitLocal}:00+08:00`);
    if (!Number.isFinite(splitAt)) throw new Error('INVALID_SPLIT_TIME');
    this.database.transaction(() => {
      this.database.raw
        .prepare('UPDATE recurrence_rules SET until_at = ? WHERE id = ?')
        .run(splitAt - 1, id);
      const future = this.database.raw
        .prepare(
          `SELECT generated_entity_id FROM recurrence_occurrences
           WHERE rule_id = ? AND scheduled_at >= ? AND status = 'GENERATED'`,
        )
        .all(id, splitAt) as { generated_entity_id: string | null }[];
      this.database.raw
        .prepare(
          `UPDATE recurrence_occurrences SET status = 'CANCELLED' WHERE rule_id = ? AND scheduled_at >= ?`,
        )
        .run(id, splitAt);
      const now = this.clock.now().getTime();
      for (const occurrence of future) {
        if (occurrence.generated_entity_id === null) continue;
        this.database.raw
          .prepare('UPDATE entity_index SET deleted_at = ?, purge_after = ? WHERE id = ?')
          .run(now, now + 30 * 86_400_000, occurrence.generated_entity_id);
      }
    });
    return this.createRule({
      targetType: current.targetType,
      targetEntityId: current.targetEntityId,
      rrule: replacementRrule,
      dtstartLocal: splitLocal,
      generationHorizonDays: current.generationHorizonDays,
      templateSnapshot: this.getSeriesTemplate(current),
    });
  }

  public modify(
    id: string,
    expectedVersion: number,
    input: {
      action: RecurrenceModification;
      recurrenceKey: string;
      rrule?: string | undefined;
      override?: Record<string, unknown> | undefined;
    },
  ): RecurrenceRuleRecord {
    const current = this.requireRule(id);
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const effectiveAt = this.recurrenceTimestamp(input.recurrenceKey);
    switch (input.action) {
      case 'ONLY_THIS':
        this.database.transaction(() => {
          this.addException(id, input.recurrenceKey, 'OVERRIDE', input.override ?? {});
          this.applyOverrideToGenerated(id, input.recurrenceKey, input.override ?? {});
          this.bumpRule(id);
        });
        return this.requireRule(id);
      case 'SKIP_ONCE':
        this.database.transaction(() => {
          this.addException(id, input.recurrenceKey, 'SKIP');
          this.retireOccurrence(id, input.recurrenceKey, 'SKIPPED');
          this.bumpRule(id);
        });
        return this.requireRule(id);
      case 'THIS_AND_FUTURE':
        if (input.rrule === undefined) throw new Error('RECURRENCE_RRULE_REQUIRED');
        return this.splitRuleVersioned(id, expectedVersion, input.recurrenceKey, input.rrule);
      case 'ENTIRE_SERIES':
        if (input.rrule === undefined) throw new Error('RECURRENCE_RRULE_REQUIRED');
        return this.updateEntireSeries(id, expectedVersion, effectiveAt, input.rrule);
      case 'END_RECURRENCE':
        this.database.transaction(() => {
          this.retireFuture(id, effectiveAt, false);
          this.database.raw
            .prepare('UPDATE recurrence_rules SET until_at=?,is_active=0 WHERE id=?')
            .run(effectiveAt, id);
          this.bumpRule(id);
        });
        return this.requireRule(id);
    }
  }

  private splitRuleVersioned(
    id: string,
    expectedVersion: number,
    splitLocal: string,
    replacementRrule: string,
  ): RecurrenceRuleRecord {
    const current = this.requireRule(id);
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    parseRecurrenceRule(replacementRrule);
    const splitAt = this.recurrenceTimestamp(splitLocal);
    this.database.transaction(() => {
      this.retireFuture(id, splitAt, true);
      this.database.raw
        .prepare('UPDATE recurrence_rules SET until_at=? WHERE id=?')
        .run(splitAt - 1, id);
      this.bumpRule(id);
    });
    return this.createRule({
      targetType: current.targetType,
      targetEntityId: current.targetEntityId,
      rrule: replacementRrule,
      dtstartLocal: splitLocal,
      generationHorizonDays: current.generationHorizonDays,
      templateSnapshot: this.getSeriesTemplate(current),
    });
  }

  private captureSeriesTemplate(input: {
    targetType: RecurrenceRuleRecord['targetType'];
    targetEntityId: string;
  }): Record<string, unknown> {
    if (input.targetType === 'TASK_TEMPLATE') {
      const task = this.actions.getTask(input.targetEntityId);
      if (task === undefined) throw new Error('RECURRENCE_TARGET_NOT_FOUND');
      return {
        categoryId: task.categoryId,
        planId: task.planId,
        goalId: task.goalId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        isFlexible: task.isFlexible,
        isSplittable: task.isSplittable,
        preferredArea: task.preferredArea,
      };
    }
    const event = this.actions.getEvent(input.targetEntityId);
    if (event === undefined) throw new Error('RECURRENCE_TARGET_NOT_FOUND');
    return {
      categoryId: event.categoryId,
      title: event.title,
      description: event.description,
      duration: Date.parse(event.endAt) - Date.parse(event.startAt),
      eventType: event.eventType,
      priority: event.priority,
      isImmovable: event.isImmovable,
      allowOverlap: event.allowOverlap,
    };
  }

  private getSeriesTemplate(rule: RecurrenceRuleRecord): Record<string, unknown> {
    const row = this.database.raw
      .prepare(
        `SELECT override_json overrideJson FROM recurrence_exceptions
         WHERE rule_id=? AND recurrence_key='__SERIES_TEMPLATE__'`,
      )
      .get(rule.id) as { overrideJson: string | null } | undefined;
    return row?.overrideJson === null || row === undefined
      ? this.captureSeriesTemplate(rule)
      : (JSON.parse(row.overrideJson) as Record<string, unknown>);
  }

  private updateEntireSeries(
    id: string,
    expectedVersion: number,
    effectiveAt: number,
    rrule: string,
  ): RecurrenceRuleRecord {
    const current = this.requireRule(id);
    if (current.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const parsed = parseRecurrenceRule(rrule);
    this.database.transaction(() => {
      this.retireFuture(id, effectiveAt, true, true);
      this.database.raw
        .prepare(
          `UPDATE recurrence_rules SET rrule=?,until_at=?,count_limit=?,is_active=1 WHERE id=?`,
        )
        .run(rrule, parsed.until ?? null, parsed.count ?? null, id);
      this.bumpRule(id);
    });
    this.generate(id);
    return this.requireRule(id);
  }

  private recurrenceTimestamp(value: string): number {
    const normalized = value.length === 16 ? `${value}:00` : value;
    const timestamp = Date.parse(`${normalized}+08:00`);
    if (!Number.isFinite(timestamp)) throw new Error('INVALID_RECURRENCE_KEY');
    return timestamp;
  }

  private bumpRule(id: string): void {
    this.database.raw
      .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
      .run(this.clock.now().getTime(), id);
  }

  private canReuseTarget(rule: RecurrenceRuleRecord, scheduledAt: number): boolean {
    const table = rule.targetType === 'TASK_TEMPLATE' ? 'tasks' : 'events';
    const timeColumn = rule.targetType === 'TASK_TEMPLATE' ? 'due_at' : 'start_at';
    const row = this.database.raw
      .prepare(
        `SELECT ${timeColumn} scheduledAt,recurrence_rule_id recurrenceRuleId FROM ${table} WHERE id=?`,
      )
      .get(rule.targetEntityId) as
      { scheduledAt: number; recurrenceRuleId: string | null } | undefined;
    return (
      row?.scheduledAt === scheduledAt &&
      (row.recurrenceRuleId === null || row.recurrenceRuleId === rule.id)
    );
  }

  private retireOccurrence(
    ruleId: string,
    recurrenceKey: string,
    status: 'SKIPPED' | 'CANCELLED',
  ): void {
    const row = this.database.raw
      .prepare(
        `SELECT occurrence.generated_entity_id generatedEntityId,rule.target_entity_id targetEntityId
         FROM recurrence_occurrences occurrence JOIN recurrence_rules rule ON rule.id=occurrence.rule_id
         WHERE occurrence.rule_id=? AND occurrence.recurrence_key=?`,
      )
      .get(ruleId, recurrenceKey) as
      { generatedEntityId: string | null; targetEntityId: string } | undefined;
    if (
      row?.generatedEntityId !== null &&
      row?.generatedEntityId !== undefined &&
      row.generatedEntityId !== row.targetEntityId
    ) {
      const entity = this.database.raw
        .prepare('SELECT version FROM entity_index WHERE id=? AND deleted_at IS NULL')
        .get(row.generatedEntityId) as { version: number } | undefined;
      if (entity !== undefined) this.actions.softDelete(row.generatedEntityId, entity.version);
    }
    this.database.raw
      .prepare('UPDATE recurrence_occurrences SET status=? WHERE rule_id=? AND recurrence_key=?')
      .run(status, ruleId, recurrenceKey);
  }

  private retireFuture(
    ruleId: string,
    effectiveAt: number,
    inclusive: boolean,
    removeRows = false,
  ): void {
    const operator = inclusive ? '>=' : '>';
    const rows = this.database.raw
      .prepare(
        `SELECT occurrence.recurrence_key recurrenceKey,
                occurrence.generated_entity_id generatedEntityId,
                rule.target_entity_id targetEntityId
         FROM recurrence_occurrences occurrence JOIN recurrence_rules rule ON rule.id=occurrence.rule_id
         WHERE occurrence.rule_id=? AND occurrence.scheduled_at ${operator} ? AND occurrence.status='GENERATED'`,
      )
      .all(ruleId, effectiveAt) as {
      recurrenceKey: string;
      generatedEntityId: string | null;
      targetEntityId: string;
    }[];
    for (const row of rows) {
      if (row.generatedEntityId === null || row.generatedEntityId === row.targetEntityId) continue;
      const entity = this.database.raw
        .prepare('SELECT version FROM entity_index WHERE id=? AND deleted_at IS NULL')
        .get(row.generatedEntityId) as { version: number } | undefined;
      if (entity !== undefined) this.actions.softDelete(row.generatedEntityId, entity.version);
    }
    if (removeRows) {
      this.database.raw
        .prepare(
          `DELETE FROM recurrence_occurrences WHERE rule_id=? AND scheduled_at ${operator} ?`,
        )
        .run(ruleId, effectiveAt);
    } else {
      this.database.raw
        .prepare(
          `UPDATE recurrence_occurrences SET status='CANCELLED' WHERE rule_id=? AND scheduled_at ${operator} ?`,
        )
        .run(ruleId, effectiveAt);
    }
  }

  private applyOverrideToGenerated(
    ruleId: string,
    recurrenceKey: string,
    override: Record<string, unknown>,
  ): void {
    const rule = this.requireRule(ruleId);
    const occurrence = this.database.raw
      .prepare(
        `SELECT generated_entity_id generatedEntityId FROM recurrence_occurrences
         WHERE rule_id=? AND recurrence_key=? AND status='GENERATED'`,
      )
      .get(ruleId, recurrenceKey) as { generatedEntityId: string | null } | undefined;
    if (occurrence?.generatedEntityId === null || occurrence?.generatedEntityId === undefined)
      return;
    if (rule.targetType === 'TASK_TEMPLATE') {
      const task = this.actions.getTask(occurrence.generatedEntityId);
      if (task === undefined) return;
      this.actions.updateTask(task.id, task.version, {
        ...(typeof override.title === 'string' ? { title: override.title } : {}),
        ...(typeof override.description === 'string' ? { description: override.description } : {}),
        ...(typeof override.dueAt === 'string' ? { dueAt: override.dueAt } : {}),
      });
      return;
    }
    const event = this.actions.getEvent(occurrence.generatedEntityId);
    if (event === undefined) return;
    this.actions.updateEvent(event.id, event.version, {
      ...(typeof override.title === 'string' ? { title: override.title } : {}),
      ...(typeof override.description === 'string' ? { description: override.description } : {}),
      ...(typeof override.startAt === 'string' ? { startAt: override.startAt } : {}),
      ...(typeof override.endAt === 'string' ? { endAt: override.endAt } : {}),
    });
  }

  private cloneTarget(
    rule: RecurrenceRuleRecord,
    scheduledAt: number,
    override: Record<string, unknown>,
  ): string {
    const template = this.getSeriesTemplate(rule);
    if (rule.targetType === 'TASK_TEMPLATE') {
      if (this.actions.getTask(rule.targetEntityId) === undefined)
        throw new Error('RECURRENCE_TARGET_NOT_FOUND');
      return this.actions.createTask({
        categoryId: String(template.categoryId),
        planId: typeof template.planId === 'string' ? template.planId : null,
        goalId: typeof template.goalId === 'string' ? template.goalId : null,
        title: typeof override.title === 'string' ? override.title : String(template.title),
        description:
          typeof override.description === 'string'
            ? override.description
            : typeof template.description === 'string'
              ? template.description
              : undefined,
        priority: template.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
        dueAt: typeof override.dueAt === 'string' ? Date.parse(override.dueAt) : scheduledAt,
        estimatedMinutes: Number(template.estimatedMinutes),
        isFlexible: template.isFlexible === true,
        isSplittable: template.isSplittable === true,
        preferredArea: template.preferredArea as 'WORK' | 'LIFE',
      }).id;
    }
    if (this.actions.getEvent(rule.targetEntityId) === undefined)
      throw new Error('RECURRENCE_TARGET_NOT_FOUND');
    const duration = Number(template.duration);
    return this.actions.createEvent({
      categoryId: String(template.categoryId),
      title: typeof override.title === 'string' ? override.title : String(template.title),
      description:
        typeof override.description === 'string'
          ? override.description
          : typeof template.description === 'string'
            ? template.description
            : undefined,
      startAt: typeof override.startAt === 'string' ? Date.parse(override.startAt) : scheduledAt,
      endAt:
        typeof override.endAt === 'string' ? Date.parse(override.endAt) : scheduledAt + duration,
      eventType: template.eventType as 'GENERAL' | 'MEETING' | 'MEDICAL' | 'TRAVEL' | 'REST',
      priority: template.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
      isImmovable: template.isImmovable === true,
      allowOverlap: template.allowOverlap === true,
    }).id;
  }

  private insertOccurrence(
    ruleId: string,
    recurrenceKey: string,
    scheduledAt: number,
    generatedEntityId: string | null,
    status: 'GENERATED' | 'SKIPPED',
  ): void {
    this.database.raw
      .prepare(
        `INSERT INTO recurrence_occurrences(id, rule_id, recurrence_key, scheduled_at, generated_entity_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ulid(),
        ruleId,
        recurrenceKey,
        scheduledAt,
        generatedEntityId,
        status,
        this.clock.now().getTime(),
      );
  }

  private requireRule(id: string): RecurrenceRuleRecord {
    const value = this.getRule(id);
    if (value === undefined) throw new Error('RECURRENCE_RULE_NOT_FOUND');
    return value;
  }
}
