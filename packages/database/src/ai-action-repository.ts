import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';
import type { AiToolExecutionContext } from './operation-context.js';

export type AiActionStatus =
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type AiActionType =
  | 'REPLACE_LONG_TERM_GOAL'
  | 'DELETE_RECORD'
  | 'BULK_UPDATE_RECORDS'
  | 'CLEAR_AI_MEMORY'
  | 'EMPTY_RECYCLE_BIN'
  | 'REQUEST_RESCHEDULE';

export interface AiActionRecord {
  readonly id: string;
  readonly actionType: AiActionType;
  readonly request: unknown;
  readonly preview: unknown;
  readonly confirmationId: string;
  readonly status: AiActionStatus;
  readonly createdAt: string;
  readonly executedAt: string | null;
  readonly cancelledAt: string | null;
  readonly expiresAt: string | null;
  readonly result: unknown;
  readonly errorCode: string | null;
  readonly executionContext: AiToolExecutionContext | null;
}

interface AiActionRow {
  id: string;
  action_type: AiActionRecord['actionType'];
  request_json: string;
  preview_json: string;
  confirmation_id: string;
  status: AiActionStatus;
  created_at: number;
  executed_at: number | null;
  cancelled_at: number | null;
  expires_at: number | null;
  result_json: string | null;
  error_code: string | null;
}

export class AiActionRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public create(input: {
    readonly actionType: AiActionRecord['actionType'];
    readonly request: unknown;
    readonly preview: unknown;
    readonly confirmationId: string;
    readonly expiresAt?: string | undefined;
    readonly executionContext?: AiToolExecutionContext | undefined;
  }): AiActionRecord {
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `INSERT INTO entity_index(id, entity_type, version, created_at, updated_at)
           VALUES (?, 'AI_ACTION', 1, ?, ?)`,
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          `INSERT INTO ai_actions(id, action_type, request_json, preview_json, confirmation_id, status, expires_at)
           VALUES (?, ?, ?, ?, ?, 'AWAITING_CONFIRMATION', ?)`,
        )
        .run(
          id,
          input.actionType,
          JSON.stringify(input.request),
          JSON.stringify(input.preview),
          input.confirmationId,
          input.expiresAt === undefined ? null : Date.parse(input.expiresAt),
        );
      if (input.executionContext !== undefined) {
        this.database.raw
          .prepare('INSERT INTO ai_action_execution_contexts(action_id,context_json) VALUES (?,?)')
          .run(id, JSON.stringify(input.executionContext));
      }
    });
    return this.require(id);
  }

  public get(id: string): AiActionRecord {
    return this.require(id);
  }

  public markConfirmed(id: string): AiActionRecord {
    return this.transition(id, 'AWAITING_CONFIRMATION', 'CONFIRMED');
  }

  public markExecuting(id: string): AiActionRecord {
    const current = this.require(id);
    if (current.status === 'EXECUTING' || current.status === 'EXECUTED') return current;
    return this.transition(id, 'CONFIRMED', 'EXECUTING');
  }

  public expireDue(): number {
    const now = this.clock.now().getTime();
    return this.database.raw
      .prepare(
        `UPDATE ai_actions SET status='EXPIRED',cancelled_at=?
         WHERE status='AWAITING_CONFIRMATION' AND expires_at IS NOT NULL AND expires_at<=?`,
      )
      .run(now, now).changes;
  }

  public cancel(id: string): AiActionRecord {
    const now = this.clock.now().getTime();
    const changed = this.database.raw
      .prepare(
        `UPDATE ai_actions SET status='CANCELLED', cancelled_at=? WHERE id=? AND status='AWAITING_CONFIRMATION'`,
      )
      .run(now, id).changes;
    if (changed !== 1) throw new Error('AI_ACTION_NOT_CONFIRMABLE');
    return this.require(id);
  }

  public markExecuted(id: string, result?: unknown): AiActionRecord {
    const now = this.clock.now().getTime();
    const changed = this.database.raw
      .prepare(
        `UPDATE ai_actions SET status='EXECUTED', executed_at=?, result_json=?, error_code=NULL
         WHERE id=? AND status='EXECUTING'`,
      )
      .run(now, result === undefined ? null : JSON.stringify(result), id).changes;
    if (changed !== 1) throw new Error('AI_ACTION_NOT_CONFIRMABLE');
    return this.require(id);
  }

  public markFailed(id: string, errorCode: string): AiActionRecord {
    const changed = this.database.raw
      .prepare(
        `UPDATE ai_actions SET status='FAILED',error_code=? WHERE id=? AND status='EXECUTING'`,
      )
      .run(errorCode, id).changes;
    if (changed !== 1) throw new Error('AI_ACTION_NOT_EXECUTING');
    return this.require(id);
  }

  private transition(id: string, from: AiActionStatus, to: AiActionStatus): AiActionRecord {
    const changed = this.database.raw
      .prepare('UPDATE ai_actions SET status=? WHERE id=? AND status=?')
      .run(to, id, from).changes;
    if (changed !== 1) throw new Error('AI_ACTION_NOT_CONFIRMABLE');
    return this.require(id);
  }

  private require(id: string): AiActionRecord {
    const row = this.database.raw
      .prepare(
        `SELECT a.*, e.created_at FROM ai_actions a JOIN entity_index e ON e.id=a.id WHERE a.id=?`,
      )
      .get(id) as AiActionRow | undefined;
    if (row === undefined) throw new Error('AI_ACTION_NOT_FOUND');
    return {
      id: row.id,
      actionType: row.action_type,
      request: JSON.parse(row.request_json) as unknown,
      preview: JSON.parse(row.preview_json) as unknown,
      confirmationId: row.confirmation_id,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      executedAt: row.executed_at === null ? null : new Date(row.executed_at).toISOString(),
      cancelledAt: row.cancelled_at === null ? null : new Date(row.cancelled_at).toISOString(),
      expiresAt: row.expires_at === null ? null : new Date(row.expires_at).toISOString(),
      result: row.result_json === null ? null : (JSON.parse(row.result_json) as unknown),
      errorCode: row.error_code,
      executionContext: (() => {
        const context = this.database.raw
          .prepare('SELECT context_json FROM ai_action_execution_contexts WHERE action_id=?')
          .get(row.id) as { context_json: string } | undefined;
        return context === undefined
          ? null
          : (JSON.parse(context.context_json) as AiToolExecutionContext);
      })(),
    };
  }
}
