import { ulid } from 'ulid';

import { FixedClock } from '@life-assistant/kernel';
import { describe, expect, it } from 'vitest';

import { ActionRepository } from './action-repository.js';
import { ConsistencyRepository } from './consistency-repository.js';
import { createAiOperationContext, parseOperationSourceRef } from './operation-context.js';
import { SharedRepository } from './shared-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

const clock = new FixedClock(new Date('2026-08-30T02:00:00.000Z'));

describe('unified change recorder foundation', () => {
  it('records an AI task update with canonical before/after state and traceable run provenance', () => {
    const database = new SqliteDatabase(':memory:', clock);
    database.migrate();
    const consistency = new ConsistencyRepository(database, clock);
    const actions = new ActionRepository(database, clock, consistency);
    const shared = new SharedRepository(database, clock);
    shared.seedDefaults();
    const category = shared.listCategories().find((item) => item.parentArea === 'WORK');
    if (category === undefined) throw new Error('测试缺少工作分类。');

    const task = actions.createTask({
      categoryId: category.id,
      title: 'AI 修改前',
      priority: 'NORMAL',
      dueAt: Date.parse('2026-08-31T08:00:00.000Z'),
      estimatedMinutes: 60,
      isFlexible: true,
      preferredArea: 'WORK',
    });

    const providerId = ulid();
    const sessionId = ulid();
    const userMessageId = ulid();
    const assistantMessageId = ulid();
    const runId = ulid();
    const now = clock.now().getTime();
    for (const [id, type] of [
      [providerId, 'AI_PROVIDER_CONFIG'],
      [sessionId, 'CHAT_SESSION'],
      [userMessageId, 'CHAT_MESSAGE'],
      [assistantMessageId, 'CHAT_MESSAGE'],
      [runId, 'AI_RUN'],
    ] as const) {
      database.raw
        .prepare('INSERT INTO entity_index(id,entity_type,created_at,updated_at) VALUES (?,?,?,?)')
        .run(id, type, now, now);
    }
    database.raw
      .prepare(
        `INSERT INTO ai_provider_configs(id,provider_type,display_name,model_id,credential_ref,capabilities_json)
         VALUES (?,'OPENAI','POC Provider','gpt-poc','credential:poc','{}')`,
      )
      .run(providerId);
    database.raw
      .prepare(
        "INSERT INTO chat_sessions(id,title,provider_config_id,status) VALUES (?,'POC',?,'ACTIVE')",
      )
      .run(sessionId, providerId);
    database.raw
      .prepare(
        `INSERT INTO chat_messages(id,session_id,role,content_json,plain_text,model_id,status,completed_at)
         VALUES (?,?,?,'[]','',?,'COMPLETED',?)`,
      )
      .run(userMessageId, sessionId, 'USER', null, now);
    database.raw
      .prepare(
        `INSERT INTO chat_messages(id,session_id,role,content_json,plain_text,model_id,status,completed_at)
         VALUES (?,?,?,'[]','',?,'COMPLETED',?)`,
      )
      .run(assistantMessageId, sessionId, 'ASSISTANT', 'gpt-poc', now);
    database.raw
      .prepare(
        `INSERT INTO ai_runs(id,session_id,user_message_id,assistant_message_id,provider_config_id,status,started_at,finished_at)
         VALUES (?,?,?,?,?,'COMPLETED',?,?)`,
      )
      .run(runId, sessionId, userMessageId, assistantMessageId, providerId, now, now);

    const updated = actions.updateTaskWithContext(
      task.id,
      task.version,
      { title: 'AI 修改后' },
      createAiOperationContext({
        aiRunId: runId,
        aiSessionId: sessionId,
        userIntentReference: userMessageId,
      }),
    );

    const recorded = database.raw
      .prepare(
        `SELECT change_set.id change_set_id,change_set.source,change_set.source_ref,change_set.actor_ref change_set_actor_ref,
                operation.before_json,operation.after_json,
                version.entity_version,version.source version_source,version.actor_ref,
                version.snapshot_json,version.patch_json,entity.version current_version
         FROM change_sets change_set
         JOIN change_operations operation ON operation.change_set_id=change_set.id
         JOIN entity_versions version ON version.change_set_id=change_set.id
         JOIN entity_index entity ON entity.id=version.entity_id
         WHERE version.entity_id=? ORDER BY version.entity_version DESC LIMIT 1`,
      )
      .get(task.id) as Record<string, unknown>;
    const sourceReference = parseOperationSourceRef(String(recorded.source_ref));
    const provenance = database.raw
      .prepare(
        `SELECT run.id run_id,run.session_id,run.provider_config_id,message.model_id
         FROM ai_runs run JOIN chat_messages message ON message.id=run.assistant_message_id
         WHERE run.id=?`,
      )
      .get(sourceReference.id);

    expect(updated).toMatchObject({ title: 'AI 修改后', version: 2 });
    expect(recorded).toMatchObject({
      source: 'AI',
      source_ref: `ai-run:${runId}`,
      change_set_actor_ref: `ai-run:${runId}`,
      version_source: 'AI',
      entity_version: 2,
      current_version: 2,
    });
    expect(JSON.parse(String(recorded.before_json))).toMatchObject({
      entityType: 'TASK',
      canonicalState: { title: 'AI 修改前', status: 'TODO' },
    });
    expect(JSON.parse(String(recorded.after_json))).toMatchObject({
      entityType: 'TASK',
      canonicalState: { title: 'AI 修改后', status: 'TODO' },
    });
    expect(JSON.parse(String(recorded.snapshot_json))).toEqual(
      JSON.parse(String(recorded.after_json)),
    );
    expect(JSON.parse(String(recorded.patch_json))).toMatchObject({
      contractVersion: 1,
      snapshotKind: 'CANONICAL',
      restoreEligibility: 'ELIGIBLE',
    });
    const baseline = database.raw
      .prepare(
        'SELECT snapshot_json,patch_json FROM entity_versions WHERE entity_id=? AND entity_version=1',
      )
      .get(task.id) as { snapshot_json: string; patch_json: string };
    expect(JSON.parse(baseline.snapshot_json)).toMatchObject({
      canonicalState: { title: 'AI 修改前' },
    });
    expect(JSON.parse(baseline.patch_json)).toMatchObject({
      snapshotKind: 'BASELINE',
      restoreEligibility: 'ELIGIBLE',
    });
    expect(provenance).toEqual({
      run_id: runId,
      session_id: sessionId,
      provider_config_id: providerId,
      model_id: 'gpt-poc',
    });
    database.close();
  });
});
