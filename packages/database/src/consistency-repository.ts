import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';
import type { OperationContext } from './operation-context.js';
import { parseOperationSourceRef } from './operation-context.js';
import type { CanonicalEntitySnapshot } from './snapshot-contract.js';
import {
  canonicalSnapshotMetadata,
  isTrustedCanonicalSnapshotMetadata,
} from './snapshot-contract.js';

export class IdempotencyConflictError extends Error {
  public constructor() {
    super('同一幂等键不能用于不同请求。');
  }
}

export interface IdempotentResponse {
  readonly statusCode: number;
  readonly body: unknown;
  readonly replayed: boolean;
}

export interface ChangeInput {
  readonly entityId?: string;
  readonly entityVersion?: number;
  readonly operation: 'CREATE' | 'UPDATE' | 'SOFT_DELETE' | 'RESTORE' | 'PURGE';
  readonly before?: unknown;
  readonly after?: unknown;
  readonly canonicalSnapshot?: CanonicalEntitySnapshot;
}

export class ConsistencyRepository {
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
  ) {}

  public executeAtomicChangeSet<T>(input: {
    readonly context: OperationContext;
    readonly summary: string;
    readonly riskLevel: 'LOW_WRITE' | 'HIGH_WRITE';
    readonly execute: (context: OperationContext) => T;
  }): {
    readonly changeSetId: string;
    readonly operations: readonly {
      sequence: number;
      entityId: string | null;
      operation: ChangeInput['operation'];
    }[];
    readonly result: T;
  } {
    return this.database.transaction(() => {
      this.assertOperationContext(input.context);
      if (input.context.activeChangeSetId !== undefined)
        throw new Error('CHANGE_SET_NESTING_UNSUPPORTED');
      const changeSetId = ulid();
      const now = this.clock.now().getTime();
      this.database.raw
        .prepare(
          `INSERT INTO change_sets(id,source,source_ref,actor_ref,summary,risk_level,status,created_at,applied_at)
           VALUES (?,?,?,?,?,?,'APPLIED',?,?)`,
        )
        .run(
          changeSetId,
          input.context.source,
          input.context.sourceRef,
          input.context.actorRef,
          input.summary,
          input.riskLevel,
          now,
          now,
        );
      const result = input.execute({ ...input.context, activeChangeSetId: changeSetId });
      const operations = this.database.raw
        .prepare(
          `SELECT sequence,entity_id,operation FROM change_operations
           WHERE change_set_id=? ORDER BY sequence`,
        )
        .all(changeSetId) as {
        sequence: number;
        entity_id: string | null;
        operation: ChangeInput['operation'];
      }[];
      if (operations.length === 0) throw new Error('EMPTY_CHANGE_SET');
      return {
        changeSetId,
        operations: operations.map((operation) => ({
          sequence: operation.sequence,
          entityId: operation.entity_id,
          operation: operation.operation,
        })),
        result,
      };
    });
  }

  public executeIdempotent(
    key: string,
    request: unknown,
    operation: () => { readonly statusCode: number; readonly body: unknown },
  ): IdempotentResponse {
    const hash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    return this.database.transaction(() => {
      const existing = this.database.raw
        .prepare(
          'SELECT request_hash, status_code, response_json, state FROM idempotency_records WHERE key = ?',
        )
        .get(key) as
        | {
            request_hash: string;
            status_code: number | null;
            response_json: string | null;
            state: string;
          }
        | undefined;
      if (existing !== undefined) {
        if (existing.request_hash !== hash) throw new IdempotencyConflictError();
        if (
          existing.state !== 'COMPLETED' ||
          existing.status_code === null ||
          existing.response_json === null
        ) {
          throw new Error('幂等请求仍在处理中。');
        }
        return {
          statusCode: existing.status_code,
          body: JSON.parse(existing.response_json) as unknown,
          replayed: true,
        };
      }

      const now = this.clock.now().getTime();
      this.database.raw
        .prepare(
          `INSERT INTO idempotency_records(key, request_hash, state, expires_at, created_at)
           VALUES (?, ?, 'PROCESSING', ?, ?)`,
        )
        .run(key, hash, now + 86_400_000, now);
      const result = operation();
      this.database.raw
        .prepare(
          `UPDATE idempotency_records SET state = 'COMPLETED', status_code = ?, response_json = ? WHERE key = ?`,
        )
        .run(result.statusCode, JSON.stringify(result.body), key);
      return { ...result, replayed: false };
    });
  }

  public recordChange(input: {
    readonly context: OperationContext;
    readonly summary: string;
    readonly riskLevel: 'READ_ONLY' | 'LOW_WRITE' | 'HIGH_WRITE';
    readonly changes: readonly ChangeInput[];
  }): string {
    if (input.changes.length === 0) throw new Error('EMPTY_CHANGE_SET');
    return this.database.transaction(() => {
      this.assertOperationContext(input.context);
      const now = this.clock.now().getTime();
      const changeSetId = input.context.activeChangeSetId ?? ulid();
      if (input.context.activeChangeSetId === undefined) {
        this.database.raw
          .prepare(
            `INSERT INTO change_sets(id, source, source_ref, actor_ref, summary, risk_level, status, created_at, applied_at)
             VALUES (?, ?, ?, ?, ?, ?, 'APPLIED', ?, ?)`,
          )
          .run(
            changeSetId,
            input.context.source,
            input.context.sourceRef,
            input.context.actorRef,
            input.summary,
            input.riskLevel,
            now,
            now,
          );
      } else {
        const active = this.database.raw
          .prepare('SELECT source,source_ref,actor_ref,status FROM change_sets WHERE id=?')
          .get(changeSetId) as
          | { source: string; source_ref: string | null; actor_ref: string | null; status: string }
          | undefined;
        if (active === undefined) throw new Error('ACTIVE_CHANGE_SET_CONTEXT_MISMATCH');
        if (
          active.status !== 'APPLIED' ||
          active.source !== input.context.source ||
          active.source_ref !== input.context.sourceRef ||
          active.actor_ref !== input.context.actorRef
        ) {
          throw new Error('ACTIVE_CHANGE_SET_CONTEXT_MISMATCH');
        }
      }
      const startSequence = (
        this.database.raw
          .prepare('SELECT COUNT(*) count FROM change_operations WHERE change_set_id=?')
          .get(changeSetId) as { count: number }
      ).count;
      const insert = this.database.raw.prepare(
        `INSERT INTO change_operations(id, change_set_id, sequence, entity_id, operation, before_json, after_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      input.changes.forEach((change, sequence) => {
        this.assertChangeContract(change);
        if (
          change.operation !== 'CREATE' &&
          change.entityId !== undefined &&
          change.entityVersion !== undefined &&
          change.before !== undefined
        ) {
          this.ensureCanonicalBaseline(
            change.entityId,
            change.entityVersion - 1,
            change.before,
            now,
          );
        }
        insert.run(
          ulid(),
          changeSetId,
          startSequence + sequence,
          change.entityId ?? null,
          change.operation,
          change.before === undefined ? null : JSON.stringify(change.before),
          change.after === undefined ? null : JSON.stringify(change.after),
        );
        if (
          change.entityId !== undefined &&
          change.entityVersion !== undefined &&
          change.canonicalSnapshot !== undefined &&
          change.operation !== 'PURGE'
        ) {
          this.database.raw
            .prepare(
              `INSERT INTO entity_versions(
                 id,entity_id,entity_version,change_set_id,source,actor_ref,snapshot_json,patch_json,created_at
               ) VALUES (?,?,?,?,?,?,?,?,?)`,
            )
            .run(
              ulid(),
              change.entityId,
              change.entityVersion,
              changeSetId,
              input.context.source,
              input.context.actorRef,
              JSON.stringify(change.canonicalSnapshot),
              JSON.stringify(canonicalSnapshotMetadata('CANONICAL')),
              now,
            );
        }
      });
      return changeSetId;
    });
  }

  private ensureCanonicalBaseline(
    entityId: string,
    entityVersion: number,
    snapshot: unknown,
    now: number,
  ): void {
    if (entityVersion < 1) return;
    const existing = this.database.raw
      .prepare('SELECT id,patch_json FROM entity_versions WHERE entity_id=? AND entity_version=?')
      .get(entityId, entityVersion) as { id: string; patch_json: string } | undefined;
    if (existing !== undefined) {
      const metadata = JSON.parse(existing.patch_json) as unknown;
      if (isTrustedCanonicalSnapshotMetadata(metadata)) return;
      this.database.raw
        .prepare('UPDATE entity_versions SET snapshot_json=?,patch_json=? WHERE id=?')
        .run(
          JSON.stringify(snapshot),
          JSON.stringify(canonicalSnapshotMetadata('BASELINE')),
          existing.id,
        );
      return;
    }
    this.database.raw
      .prepare(
        `INSERT INTO entity_versions(
           id,entity_id,entity_version,change_set_id,source,actor_ref,snapshot_json,patch_json,created_at
         ) VALUES (?,?,?,NULL,'SYSTEM','system:history-baseline',?,?,?)`,
      )
      .run(
        ulid(),
        entityId,
        entityVersion,
        JSON.stringify(snapshot),
        JSON.stringify(canonicalSnapshotMetadata('BASELINE')),
        now,
      );
  }

  private assertChangeContract(change: ChangeInput): void {
    if (change.operation === 'PURGE') {
      if (
        change.after !== undefined ||
        change.canonicalSnapshot !== undefined ||
        change.entityVersion !== undefined
      ) {
        throw new Error('PURGE_AUDIT_MUST_BE_SUMMARY_ONLY');
      }
      return;
    }
    if (
      change.entityId === undefined ||
      change.entityVersion === undefined ||
      change.after === undefined ||
      change.canonicalSnapshot === undefined
    ) {
      throw new Error('CANONICAL_CHANGE_INCOMPLETE');
    }
    if (change.operation === 'CREATE' && change.before !== undefined) {
      throw new Error('CREATE_BEFORE_MUST_BE_EMPTY');
    }
    if (change.operation !== 'CREATE' && change.before === undefined) {
      throw new Error('CHANGE_BEFORE_REQUIRED');
    }
  }

  private assertOperationContext(context: OperationContext): void {
    if (context.sourceRef === null || context.actorRef === null) {
      throw new Error('OPERATION_CONTEXT_INCOMPLETE');
    }
    const sourceReference = parseOperationSourceRef(context.sourceRef);
    if (context.source === 'USER') {
      if (sourceReference.kind !== 'request' || context.requestId !== sourceReference.id) {
        throw new Error('USER_OPERATION_CONTEXT_INVALID');
      }
      return;
    }
    if (context.source === 'AI') {
      if (
        sourceReference.kind !== 'ai-run' ||
        context.aiRunId !== sourceReference.id ||
        context.aiSessionId === undefined
      ) {
        throw new Error('AI_OPERATION_CONTEXT_INVALID');
      }
      const run = this.database.raw
        .prepare('SELECT session_id,user_message_id FROM ai_runs WHERE id=?')
        .get(context.aiRunId) as { session_id: string; user_message_id: string } | undefined;
      if (
        run?.session_id !== context.aiSessionId ||
        (context.userIntentReference !== undefined &&
          run.user_message_id !== context.userIntentReference)
      ) {
        throw new Error('AI_OPERATION_CONTEXT_UNTRACEABLE');
      }
      if (context.aiActionId !== undefined) {
        const action = this.database.raw
          .prepare('SELECT 1 present FROM ai_actions WHERE id=?')
          .get(context.aiActionId) as { present: number } | undefined;
        if (action === undefined || context.actorRef !== `ai-action:${context.aiActionId}`) {
          throw new Error('AI_ACTION_CONTEXT_UNTRACEABLE');
        }
      }
      if (context.aiToolCallId !== undefined) {
        const toolCall = this.database.raw
          .prepare(
            `SELECT session_id,run_id,provider_config_id,model_id,user_message_id,
                    assistant_message_id,tool_name,user_intent_reference
             FROM ai_tool_calls WHERE id=?`,
          )
          .get(context.aiToolCallId) as
          | {
              session_id: string;
              run_id: string;
              provider_config_id: string;
              model_id: string;
              user_message_id: string;
              assistant_message_id: string;
              tool_name: string;
              user_intent_reference: string | null;
            }
          | undefined;
        if (
          toolCall?.session_id !== context.aiSessionId ||
          toolCall.run_id !== context.aiRunId ||
          toolCall.provider_config_id !== context.aiProviderConfigId ||
          toolCall.model_id !== context.aiModelId ||
          toolCall.user_message_id !== context.aiUserMessageId ||
          toolCall.assistant_message_id !== context.aiAssistantMessageId ||
          toolCall.tool_name !== context.aiToolName ||
          toolCall.user_intent_reference !== context.userIntentReference ||
          (context.aiActionId === undefined &&
            context.actorRef !== `ai-tool-call:${context.aiToolCallId}`)
        ) {
          throw new Error('AI_TOOL_CONTEXT_UNTRACEABLE');
        }
      }
      return;
    }
    if (context.source === 'RULE_ENGINE') {
      if (
        (sourceReference.kind === 'rule-job' && context.ruleJobId === sourceReference.id) ||
        (sourceReference.kind === 'schedule-run' && context.scheduleRunId === sourceReference.id)
      ) {
        return;
      }
      throw new Error('RULE_OPERATION_CONTEXT_INVALID');
    }
    if (sourceReference.kind !== 'system') throw new Error('SYSTEM_OPERATION_CONTEXT_INVALID');
  }

  public appendEvent(input: {
    readonly eventType: string;
    readonly aggregateId?: string;
    readonly aggregateVersion?: number;
    readonly payload: unknown;
  }): string {
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.raw
      .prepare(
        `INSERT INTO domain_events(id, event_type, aggregate_id, aggregate_version, payload_json, status, next_attempt_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      )
      .run(
        id,
        input.eventType,
        input.aggregateId ?? null,
        input.aggregateVersion ?? null,
        JSON.stringify(input.payload),
        now,
        now,
      );
    return id;
  }

  public createConfirmation(
    operationType: string,
    request: unknown,
    preview: unknown,
  ): {
    id: string;
    token: string;
    expiresAt: string;
  } {
    const id = ulid();
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now().getTime();
    const expiresAt = now + 10 * 60_000;
    this.database.raw
      .prepare(
        `INSERT INTO confirmations(
          id, operation_type, request_hash, preview_json, token_hash, status, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      )
      .run(
        id,
        operationType,
        createHash('sha256').update(JSON.stringify(request)).digest('hex'),
        JSON.stringify(preview),
        createHash('sha256').update(token).digest('hex'),
        expiresAt,
        now,
      );
    return { id, token, expiresAt: new Date(expiresAt).toISOString() };
  }

  public confirm(id: string, token: string, operationType: string, request: unknown): void {
    this.confirmInternal(id, operationType, request, token);
  }

  /** Used only by a local, explicit AI action confirmation route. */
  public confirmTrusted(id: string, operationType: string, request: unknown): void {
    this.confirmInternal(id, operationType, request);
  }

  private confirmInternal(
    id: string,
    operationType: string,
    request: unknown,
    token?: string,
  ): void {
    this.database.transaction(() => {
      const row = this.database.raw
        .prepare(
          `SELECT operation_type, request_hash, token_hash, status, expires_at FROM confirmations WHERE id = ?`,
        )
        .get(id) as
        | {
            operation_type: string;
            request_hash: string;
            token_hash: string;
            status: string;
            expires_at: number;
          }
        | undefined;
      const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
      const tokenHash =
        token === undefined ? undefined : createHash('sha256').update(token).digest('hex');
      if (
        row?.status !== 'PENDING' ||
        row.expires_at <= this.clock.now().getTime() ||
        row.operation_type !== operationType ||
        row.request_hash !== requestHash ||
        (tokenHash !== undefined &&
          (row.token_hash.length !== tokenHash.length ||
            !timingSafeEqual(Buffer.from(row.token_hash), Buffer.from(tokenHash))))
      ) {
        throw new Error('CONFIRMATION_INVALID');
      }
      this.database.raw
        .prepare("UPDATE confirmations SET status = 'CONFIRMED' WHERE id = ?")
        .run(id);
    });
  }

  public markConfirmationExecuted(id: string): void {
    this.database.raw
      .prepare("UPDATE confirmations SET status = 'EXECUTED' WHERE id = ? AND status = 'CONFIRMED'")
      .run(id);
  }
}
