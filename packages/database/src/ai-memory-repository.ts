import { ulid } from 'ulid';

import type { Clock } from '@life-assistant/kernel';

import type { SqliteDatabase } from './sqlite-database.js';
import { CanonicalHistoryRepository } from './canonical-history-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import type { OperationContext } from './operation-context.js';

export class AiMemoryRepository {
  private readonly history: CanonicalHistoryRepository;
  public constructor(
    private readonly database: SqliteDatabase,
    private readonly clock: Clock,
    consistency: ConsistencyRepository = new ConsistencyRepository(database, clock),
  ) {
    this.history = new CanonicalHistoryRepository(database, clock, consistency);
  }

  public remember(
    input: {
      memoryType: 'PREFERENCE' | 'CONSTRAINT' | 'ROUTINE_HINT' | 'DECISION_STYLE';
      content: string;
      confidence: number;
      sourceSessionId?: string;
    },
    context?: OperationContext,
  ): string {
    const id = ulid();
    const now = this.clock.now().getTime();
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          "INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,'AI_MEMORY',?,?)",
        )
        .run(id, now, now);
      this.database.raw
        .prepare(
          'INSERT INTO ai_memories(id,memory_type,content,confidence,source_session_id) VALUES (?,?,?,?,?)',
        )
        .run(
          id,
          input.memoryType,
          input.content.trim(),
          input.confidence,
          input.sourceSessionId ?? null,
        );
      if (context !== undefined) this.history.recordCreate(id, context, 'AiMemoryCreated');
    });
    return id;
  }

  public clearAll(context?: OperationContext): number {
    return this.database.transaction(() => {
      const active = this.listActive();
      const before =
        context === undefined
          ? []
          : active.map((memory) => ({
              id: memory.id,
              snapshot: this.history.captureCurrentState(memory.id),
            }));
      const changed = this.database.raw
        .prepare('UPDATE ai_memories SET is_active=0 WHERE is_active=1')
        .run().changes;
      if (context !== undefined) {
        const now = this.clock.now().getTime();
        for (const memory of before) {
          this.database.raw
            .prepare('UPDATE entity_index SET version=version+1,updated_at=? WHERE id=?')
            .run(now, memory.id);
          this.history.recordUpdate(memory.id, memory.snapshot, context, 'AiMemoryCleared');
        }
      }
      return changed;
    });
  }

  public listActive(): readonly {
    id: string;
    memoryType: string;
    content: string;
    confidence: number;
  }[] {
    return this.database.raw
      .prepare(
        `SELECT memory.id,memory.memory_type,memory.content,memory.confidence
         FROM ai_memories memory
         JOIN entity_index entity ON entity.id=memory.id AND entity.deleted_at IS NULL
         WHERE memory.is_active=1 ORDER BY memory.confidence DESC,memory.id DESC`,
      )
      .all()
      .map((row) => {
        const value = row as {
          id: string;
          memory_type: string;
          content: string;
          confidence: number;
        };
        return {
          id: value.id,
          memoryType: value.memory_type,
          content: value.content,
          confidence: value.confidence,
        };
      });
  }

  public listForContext(minimumConfidence: number, limit: number): readonly string[] {
    const rows = this.database.raw
      .prepare(
        `SELECT memory.id,memory.content FROM ai_memories memory
         JOIN entity_index entity ON entity.id=memory.id AND entity.deleted_at IS NULL
         WHERE memory.is_active=1 AND memory.confidence >= ?
         ORDER BY memory.confidence DESC,memory.id DESC LIMIT ?`,
      )
      .all(minimumConfidence, limit) as { id: string; content: string }[];
    if (rows.length > 0) {
      const now = this.clock.now().getTime();
      this.database.transaction(() => {
        const update = this.database.raw.prepare(
          'UPDATE ai_memories SET last_used_at=? WHERE id=?',
        );
        for (const row of rows) update.run(now, row.id);
      });
    }
    return rows.map((row) => row.content);
  }
}
