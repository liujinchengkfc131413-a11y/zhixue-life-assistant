import { describe, expect, it } from 'vitest';

import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { AiRepository } from './ai-repository.js';
import { ChatRepository } from './chat-repository.js';
import { SqliteDatabase } from './sqlite-database.js';

describe('ChatRepository Today context', () => {
  it('searches message text, renames with optimistic versioning, and includes archived sessions on demand', async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-09-04T08:00:00.000Z'));
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const provider = new AiRepository(database, clock).createProvider({
        providerType: 'OPENAI',
        displayName: '测试服务',
        modelId: 'gpt-test',
      });
      const repository = new ChatRepository(database, clock);
      const session = repository.createSession({
        title: '原会话标题',
        providerConfigId: provider.id,
      });
      repository.sendMessage(String(session.id), '正文唯一关键词 snow-bridge');

      expect(repository.listSessions('snow-bridge')).toEqual([
        expect.objectContaining({ id: session.id }),
      ]);
      const originalVersion = Number(session.version);
      const renamed = repository.rename(String(session.id), '新的会话标题', originalVersion);
      expect(renamed).toMatchObject({ title: '新的会话标题', version: originalVersion + 1 });
      expect(() => repository.rename(String(session.id), '陈旧更新', originalVersion)).toThrow(
        'VERSION_CONFLICT',
      );

      repository.archive(String(session.id), true);
      expect(repository.listSessions('新的会话标题')).toEqual([]);
      expect(repository.listSessions('新的会话标题', true)).toEqual([
        expect.objectContaining({ id: session.id, status: 'ARCHIVED' }),
      ]);
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('stores context outside plain text and injects only the current run context', async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-20T08:00:00.000Z'));
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const provider = new AiRepository(database, clock).createProvider({
        providerType: 'OPENAI',
        displayName: '测试服务',
        modelId: 'gpt-test',
      });
      const repository = new ChatRepository(database, clock);
      const session = repository.createSession({
        title: '今日测试',
        providerConfigId: provider.id,
      });
      const result = repository.sendMessage(String(session.id), '帮我安排接下来的时间', {
        source: 'TODAY',
        date: '2026-08-20',
        timeZone: 'Asia/Shanghai',
        currentTime: '2026-08-20T08:00:00.000Z',
        pressure: { score: 72, level: 'ELEVATED' },
        totals: { sleepMinutes: 480, workMinutes: 360, lifeMinutes: 120, freeMinutes: 90 },
        currentBlock: null,
        upcoming: [
          {
            title: '整理 Phase 6',
            kind: 'TASK',
            area: 'WORK',
            startAt: '2026-08-20T09:00:00.000Z',
            endAt: '2026-08-20T10:00:00.000Z',
          },
        ],
      });

      const stored = repository.listMessages(String(session.id));
      expect(stored.find((message) => message.role === 'USER')?.plainText).toBe(
        '帮我安排接下来的时间',
      );

      const run = repository.getRunContext(result.runId);
      expect(run.messages[0]).toMatchObject({ role: 'system' });
      expect(run.messages[0]?.content).toContain('压力：72/100');
      expect(run.messages[1]).toEqual({
        role: 'user',
        content: `[userIntentReference: ${result.userMessageId}]\n帮我安排接下来的时间`,
      });
      const serialized = JSON.stringify(run.messages);
      expect(serialized).not.toContain(provider.id);
      expect(serialized).not.toContain('api_key');
      expect(serialized).not.toContain('C:\\\\');
    } finally {
      database.close();
      await directory.cleanup();
    }
  });
});

describe('ChatRepository completion invariants', () => {
  const setup = async () => {
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-29T10:00:00.000Z'));
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    const provider = new AiRepository(database, clock).createProvider({
      providerType: 'OPENAI',
      displayName: '测试服务',
      modelId: 'deepseek-v4-flash',
    });
    const repository = new ChatRepository(database, clock);
    const session = repository.createSession({
      title: '不变量测试',
      providerConfigId: provider.id,
    });
    const result = repository.sendMessage(String(session.id), '你好');
    repository.startRun(result.runId, 'deepseek-v4-flash');
    return { directory, clock, database, repository, session, result };
  };

  it('persists the actual model id on the completed assistant message', async () => {
    const { directory, database, repository, session, result } = await setup();
    try {
      repository.completeRun(result.runId, '你好！', [], [], 'deepseek-v4-flash');
      const messages = repository.listMessages(String(session.id));
      const assistant = messages.find((message) => message.role === 'ASSISTANT');
      expect(assistant?.status).toBe('COMPLETED');
      expect(assistant?.modelId).toBe('deepseek-v4-flash');
      const run = repository.getRun(result.runId);
      expect(run.status).toBe('COMPLETED');
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('refuses to complete a purely empty response with AI_EMPTY_RESPONSE', async () => {
    const { directory, database, repository, session, result } = await setup();
    try {
      expect(() => repository.completeRun(result.runId, '   ')).toThrow(
        expect.objectContaining({ code: 'AI_EMPTY_RESPONSE' }),
      );
      const run = repository.getRun(result.runId);
      expect(run.status).toBe('RUNNING');
      const messages = repository.listMessages(String(session.id));
      const assistant = messages.find((message) => message.role === 'ASSISTANT');
      expect(assistant?.status).toBe('STREAMING');
      expect(assistant?.modelId).toBe('deepseek-v4-flash');
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('allows completion when a change set was persisted even with empty text', async () => {
    const { directory, database, repository, session, result } = await setup();
    try {
      repository.completeRun(result.runId, '', ['change-set-01'], [], 'deepseek-v4-flash');
      const messages = repository.listMessages(String(session.id));
      const assistant = messages.find((message) => message.role === 'ASSISTANT');
      expect(assistant?.status).toBe('COMPLETED');
      expect(assistant?.modelId).toBe('deepseek-v4-flash');
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('preserves a pending AI action card while later streamed text deltas are appended', async () => {
    const { directory, database, repository, result } = await setup();
    try {
      database.raw
        .prepare(
          'UPDATE chat_messages SET content_json=? WHERE id=(SELECT assistant_message_id FROM ai_runs WHERE id=?)',
        )
        .run(
          JSON.stringify([{ type: 'ai_action', actionId: '01M1QFAKEACTION00000000000' }]),
          result.runId,
        );
      repository.appendRunDelta(result.runId, '工具执行后继续回答。');
      repository.completeRun(result.runId, '工具执行后继续回答。');
      const content = database.raw
        .prepare(
          'SELECT content_json FROM chat_messages WHERE id=(SELECT assistant_message_id FROM ai_runs WHERE id=?)',
        )
        .get(result.runId) as { content_json: string };
      expect(JSON.parse(content.content_json)).toEqual([
        { type: 'text', text: '工具执行后继续回答。' },
        { type: 'ai_action', actionId: '01M1QFAKEACTION00000000000' },
      ]);
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('excludes FAILED, CANCELLED, STREAMING and PENDING assistant messages from later history', async () => {
    const { directory, database, repository, session, result } = await setup();
    try {
      repository.appendRunDelta(result.runId, '失败的半截回答');
      repository.failRun(result.runId, 'AI_UNAVAILABLE');

      const cancelled = repository.sendMessage(String(session.id), '取消这一轮');
      repository.startRun(cancelled.runId, 'deepseek-v4-flash');
      repository.appendRunDelta(cancelled.runId, '取消的半截回答');
      repository.cancelRun(cancelled.runId);

      const streaming = repository.sendMessage(String(session.id), '仍在生成的一轮');
      repository.startRun(streaming.runId, 'deepseek-v4-flash');
      repository.appendRunDelta(streaming.runId, '不应进入历史的流式片段');
      const pending = repository.sendMessage(String(session.id), '新一轮');

      const history = repository.getRunContext(pending.runId).messages;
      expect(history.filter((message) => message.role === 'assistant')).toEqual([]);
      expect(JSON.stringify(history)).not.toContain('失败的半截回答');
      expect(JSON.stringify(history)).not.toContain('取消的半截回答');
      expect(JSON.stringify(history)).not.toContain('不应进入历史的流式片段');
    } finally {
      database.close();
      await directory.cleanup();
    }
  });

  it('closes only RUNNING tool calls when a run fails or is cancelled', async () => {
    const { directory, database, repository, session, result } = await setup();
    const startTool = (runId: string, providerCallId: string) =>
      repository.startToolCall({
        runId,
        providerConfigId: String(session.providerConfigId),
        modelId: 'deepseek-v4-flash',
        providerCallId,
        toolName: 'get_today_schedule',
        argumentsJson: '{}',
        riskLevel: 'READ_ONLY',
      });
    try {
      const succeeded = startTool(result.runId, 'call_succeeded');
      repository.completeToolCall(succeeded.id, { items: [] });
      const interrupted = startTool(result.runId, 'call_interrupted');
      repository.failRun(result.runId, 'AI_UNAVAILABLE');

      const failedRows = database.raw
        .prepare(
          'SELECT provider_call_id,status,error_code FROM ai_tool_calls WHERE run_id=? ORDER BY provider_call_id',
        )
        .all(result.runId);
      expect(failedRows).toEqual([
        { provider_call_id: 'call_interrupted', status: 'FAILED', error_code: 'AI_UNAVAILABLE' },
        { provider_call_id: 'call_succeeded', status: 'SUCCEEDED', error_code: null },
      ]);
      expect(interrupted.id).toEqual(expect.any(String));

      const cancelledRun = repository.sendMessage(String(session.id), '取消工具');
      repository.startRun(cancelledRun.runId, 'deepseek-v4-flash');
      const cancelledTool = startTool(cancelledRun.runId, 'call_cancelled');
      repository.cancelRun(cancelledRun.runId);
      expect(
        database.raw
          .prepare('SELECT status,error_code FROM ai_tool_calls WHERE run_id=?')
          .get(cancelledRun.runId),
      ).toEqual({ status: 'FAILED', error_code: 'AI_RUN_CANCELLED' });

      // If the local business tool reports a real success after cancellation won the race,
      // preserve that truth instead of leaving the execution falsely marked as rolled back.
      repository.completeToolCall(cancelledTool.id, { executed: true });
      expect(
        database.raw
          .prepare('SELECT status,error_code,result_json FROM ai_tool_calls WHERE id=?')
          .get(cancelledTool.id),
      ).toEqual({ status: 'SUCCEEDED', error_code: null, result_json: '{"executed":true}' });
    } finally {
      database.close();
      await directory.cleanup();
    }
  });
});
