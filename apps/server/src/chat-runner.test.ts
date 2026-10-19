import { describe, expect, it } from 'vitest';

import type {
  StreamingToolCallingProvider,
  ToolCallingProvider,
} from '@life-assistant/ai-adapters';
import { OpenAiProvider } from '@life-assistant/ai-adapters';
import { AiRepository, ChatRepository, SqliteDatabase } from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { ChatRunner } from './chat-runner.js';

const emptyProvider: ToolCallingProvider = {
  providerType: 'OPENAI',
  verify: () =>
    Promise.resolve({
      chat: true,
      streaming: false,
      toolCalling: true,
      nativeWebSearch: false,
    }),
  executeTools: () =>
    Promise.resolve({
      text: '',
      toolCalls: [],
      providerItems: [],
      diagnostics: { providerType: 'OPENAI', endpointKind: 'responses', httpStatus: 200 },
    }),
};

const answeringProvider: ToolCallingProvider = {
  ...emptyProvider,
  executeTools: () =>
    Promise.resolve({
      text: '你好！有什么可以帮你？',
      toolCalls: [],
      providerItems: [],
      diagnostics: { providerType: 'OPENAI', endpointKind: 'responses', httpStatus: 200 },
    }),
};

const streamingEmptyProvider: StreamingToolCallingProvider = {
  ...emptyProvider,
  streamTools: async function* () {
    await Promise.resolve();
    yield { type: 'completed' as const };
  },
};

const encodeSse = (...events: readonly Readonly<Record<string, unknown>>[]): string =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

const completedTextStream = (text: string): Response =>
  new Response(
    encodeSse(
      { type: 'response.output_text.delta', delta: text },
      { type: 'response.completed', response: { output: [] } },
    ),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

const silentEofAfter = (...events: readonly Readonly<Record<string, unknown>>[]): Response =>
  new Response(encodeSse(...events), {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req_rc3_fault' },
  });

const runFixture = async () => {
  const directory = await createTestDataDirectory();
  const clock = new FixedClock(new Date('2026-08-29T10:00:00.000Z'));
  const database = new SqliteDatabase(directory.databasePath, clock);
  database.migrate();
  const ai = new AiRepository(database, clock);
  const provider = ai.createProvider({
    providerType: 'OPENAI',
    displayName: '测试服务',
    modelId: 'deepseek-v4-flash',
  });
  const chats = new ChatRepository(database, clock);
  const session = chats.createSession({ title: '测试会话', providerConfigId: provider.id });
  const result = chats.sendMessage(String(session.id), '你好');
  return {
    directory,
    clock,
    database,
    chats,
    ai,
    session,
    result,
    cleanup: async () => {
      database.close();
      await directory.cleanup();
    },
  };
};

const runnerFor = (
  chats: ChatRepository,
  ai: AiRepository,
  provider: ToolCallingProvider,
  tools: {
    definitions: () => readonly {
      name: string;
      description: string;
      parameters: Readonly<Record<string, unknown>>;
    }[];
    execute: (call: { callId: string; name: string; argumentsJson: string }) => Promise<unknown>;
  } = { definitions: () => [], execute: () => Promise.resolve({}) },
  options: {
    readonly clock?: FixedClock;
    readonly logger?: (
      level: 'info' | 'warn' | 'error',
      message: string,
      fields: Readonly<Record<string, unknown>>,
    ) => void;
  } = {},
): ChatRunner =>
  new ChatRunner(
    chats,
    ai,
    () => Promise.resolve('test-secret'),
    (providerType) => (providerType === provider.providerType ? provider : undefined),
    tools,
    () => [],
    options.logger,
    options.clock,
  );

describe('ChatRunner completion invariants', () => {
  it('emits started → failed (never completed) when the provider returns an empty response', async () => {
    const fixture = await runFixture();
    try {
      const runner = runnerFor(fixture.chats, fixture.ai, emptyProvider);
      await runner.run(fixture.result.runId);

      const types = runner.eventsFor(fixture.result.runId).map((event) => event.type);
      expect(types).toEqual(['ai.run.started', 'ai.run.failed']);

      const run = fixture.chats.getRun(fixture.result.runId);
      expect(run.status).toBe('FAILED');
      expect(run.errorCode).toBe('AI_EMPTY_RESPONSE');

      const messages = fixture.chats.listMessages(String(fixture.session.id));
      const assistant = messages.find((message) => message.role === 'ASSISTANT');
      expect(assistant?.status).toBe('FAILED');
      expect(assistant?.plainText).toBe('');
    } finally {
      await fixture.cleanup();
    }
  });

  it('completes a non-empty answer with delta, COMPLETED run/message and persisted model_id', async () => {
    const fixture = await runFixture();
    try {
      const runner = runnerFor(fixture.chats, fixture.ai, answeringProvider);
      await runner.run(fixture.result.runId);

      const types = runner.eventsFor(fixture.result.runId).map((event) => event.type);
      expect(types).toEqual(['ai.run.started', 'ai.run.delta', 'ai.run.completed']);

      const run = fixture.chats.getRun(fixture.result.runId);
      expect(run.status).toBe('COMPLETED');
      expect(run.errorCode).toBeNull();

      const messages = fixture.chats.listMessages(String(fixture.session.id));
      const assistant = messages.find((message) => message.role === 'ASSISTANT');
      expect(assistant?.status).toBe('COMPLETED');
      expect(assistant?.plainText).toBe('你好！有什么可以帮你？');
      expect(assistant?.modelId).toBe('deepseek-v4-flash');
    } finally {
      await fixture.cleanup();
    }
  });

  it('emits started → failed for an SSE stream that only contains completed without deltas', async () => {
    const fixture = await runFixture();
    try {
      const runner = runnerFor(fixture.chats, fixture.ai, streamingEmptyProvider);
      await runner.run(fixture.result.runId);

      const types = runner.eventsFor(fixture.result.runId).map((event) => event.type);
      expect(types).toEqual(['ai.run.started', 'ai.run.failed']);
      const failed = runner
        .eventsFor(fixture.result.runId)
        .find((event) => event.type === 'ai.run.failed');
      expect(failed?.data).toEqual({ runId: fixture.result.runId, errorCode: 'AI_EMPTY_RESPONSE' });

      const run = fixture.chats.getRun(fixture.result.runId);
      expect(run.status).toBe('FAILED');
      expect(run.errorCode).toBe('AI_EMPTY_RESPONSE');
    } finally {
      await fixture.cleanup();
    }
  });

  it('streams real deltas across a tool-call round and feeds the tool output into the next provider stream', async () => {
    const fixture = await runFixture();
    let round = 0;
    const requests: Parameters<StreamingToolCallingProvider['streamTools']>[0][] = [];
    const provider: StreamingToolCallingProvider = {
      ...emptyProvider,
      streamTools: async function* (request) {
        await Promise.resolve();
        requests.push(request);
        round += 1;
        if (round === 1) {
          yield { type: 'text_delta' as const, delta: '我先查看' };
          yield {
            type: 'tool_call_delta' as const,
            toolCall: { callId: 'call_schedule', name: 'get_today_schedule', argumentsJson: '{}' },
          };
          yield {
            type: 'completed' as const,
            providerItems: [
              {
                type: 'function_call',
                call_id: 'call_schedule',
                name: 'get_today_schedule',
                arguments: '{}',
              },
            ],
          };
          return;
        }
        yield { type: 'text_delta' as const, delta: '，今天有' };
        yield { type: 'text_delta' as const, delta: '一个安排。' };
        yield { type: 'completed' as const, providerItems: [] };
      },
    };
    try {
      const runner = runnerFor(fixture.chats, fixture.ai, provider, {
        definitions: () => [
          { name: 'get_today_schedule', description: '读取今日安排', parameters: {} },
        ],
        execute: () => Promise.resolve({ items: [{ title: '专注工作' }] }),
      });
      await runner.run(fixture.result.runId);

      expect(requests).toHaveLength(2);
      expect(requests[1]?.toolOutputs).toEqual([
        { callId: 'call_schedule', output: { items: [{ title: '专注工作' }] } },
      ]);
      expect(requests[1]?.previousResponseItems).toEqual(
        expect.arrayContaining([expect.objectContaining({ call_id: 'call_schedule' })]),
      );
      expect(
        runner
          .eventsFor(fixture.result.runId)
          .filter((event) => event.type === 'ai.run.delta')
          .map((event) => event.data.delta),
      ).toEqual(['我先查看', '，今天有', '一个安排。']);
      expect(fixture.chats.getRun(fixture.result.runId).status).toBe('COMPLETED');
      expect(
        fixture.chats
          .listMessages(String(fixture.session.id))
          .find((message) => message.role === 'ASSISTANT')?.plainText,
      ).toBe('我先查看，今天有一个安排。');
    } finally {
      await fixture.cleanup();
    }
  });

  it('keeps true streaming when tool definitions are present but the model does not call a tool', async () => {
    const fixture = await runFixture();
    let executions = 0;
    const provider: StreamingToolCallingProvider = {
      ...emptyProvider,
      streamTools: async function* () {
        await Promise.resolve();
        yield { type: 'text_delta' as const, delta: '直接' };
        yield { type: 'text_delta' as const, delta: '回答。' };
        yield { type: 'completed' as const, providerItems: [] };
      },
    };
    try {
      const runner = runnerFor(fixture.chats, fixture.ai, provider, {
        definitions: () => [
          { name: 'get_today_schedule', description: '读取今日安排', parameters: {} },
        ],
        execute: () => {
          executions += 1;
          return Promise.resolve({});
        },
      });
      await runner.run(fixture.result.runId);
      expect(executions).toBe(0);
      expect(
        runner
          .eventsFor(fixture.result.runId)
          .filter((event) => event.type === 'ai.run.delta')
          .map((event) => event.data.delta),
      ).toEqual(['直接', '回答。']);
      expect(fixture.chats.getRun(fixture.result.runId).status).toBe('COMPLETED');
    } finally {
      await fixture.cleanup();
    }
  });

  it('fails multiple text deltas on silent EOF and excludes the partial assistant from the next run', async () => {
    const fixture = await runFixture();
    let providerRequests = 0;
    const requestBodies: Record<string, unknown>[] = [];
    const logs: Readonly<Record<string, unknown>>[] = [];
    const provider = new OpenAiProvider((_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('expected serialized provider request');
      requestBodies.push(JSON.parse(init.body) as Record<string, unknown>);
      providerRequests += 1;
      return Promise.resolve(
        providerRequests === 1
          ? silentEofAfter(
              { type: 'response.output_text.delta', delta: '这是一段' },
              { type: 'response.output_text.delta', delta: '未完成回答' },
            )
          : completedTextStream('2'),
      );
    });
    const runner = runnerFor(fixture.chats, fixture.ai, provider, undefined, {
      clock: fixture.clock,
      logger: (_level, _message, fields) => logs.push(fields),
    });
    try {
      await runner.run(fixture.result.runId);
      expect(fixture.chats.getRun(fixture.result.runId)).toMatchObject({
        status: 'FAILED',
        errorCode: 'AI_UNAVAILABLE',
      });

      const followUp = fixture.chats.sendMessage(String(fixture.session.id), '1 + 1 等于多少');
      await runner.run(followUp.runId);

      expect(fixture.chats.getRun(followUp.runId).status).toBe('COMPLETED');
      expect(requestBodies[1]?.input).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'assistant', content: '这是一段未完成回答' }),
        ]),
      );
      expect(logs[0]).toMatchObject({
        provider: 'OPENAI',
        model: 'deepseek-v4-flash',
        sessionId: fixture.session.id,
        runId: fixture.result.runId,
        providerRequestId: 'req_rc3_fault',
        httpStatus: 200,
        streamTerminationReason: 'silent_eof',
        completedEventReceived: false,
        lastEventType: 'response.output_text.delta',
        errorCode: 'AI_UNAVAILABLE',
      });
      expect(logs[0]?.durationMs).toEqual(expect.any(Number));
      expect(logs[0]?.errorSummary).toBe('Provider stream ended before response.completed.');
      const serializedLog = JSON.stringify(logs[0]);
      expect(serializedLog).not.toContain('test-secret');
      expect(serializedLog).not.toContain('这是一段未完成回答');
    } finally {
      await fixture.cleanup();
    }
  });

  it('fails a half-generated streaming tool call, then answers a new message in the same session', async () => {
    const fixture = await runFixture();
    let providerRequests = 0;
    let toolExecutions = 0;
    const provider = new OpenAiProvider(() => {
      providerRequests += 1;
      if (providerRequests === 1) {
        return Promise.resolve(
          silentEofAfter(
            {
              type: 'response.output_item.added',
              output_index: 0,
              item: {
                type: 'function_call',
                call_id: 'call_interrupted',
                name: 'get_today_schedule',
                arguments: '',
              },
            },
            {
              type: 'response.function_call_arguments.delta',
              output_index: 0,
              delta: '{"date":"2026-',
            },
          ),
        );
      }
      return Promise.resolve(completedTextStream('2'));
    });
    const runner = runnerFor(fixture.chats, fixture.ai, provider, {
      definitions: () => [
        { name: 'get_today_schedule', description: '读取今日安排', parameters: {} },
      ],
      execute: () => {
        toolExecutions += 1;
        return Promise.resolve({ items: [] });
      },
    });
    try {
      await runner.run(fixture.result.runId);
      expect(fixture.chats.getRun(fixture.result.runId)).toMatchObject({
        status: 'FAILED',
        errorCode: 'AI_UNAVAILABLE',
      });
      expect(toolExecutions).toBe(0);

      const followUp = fixture.chats.sendMessage(String(fixture.session.id), '1 + 1 等于多少');
      await runner.run(followUp.runId);

      expect(fixture.chats.getRun(followUp.runId).status).toBe('COMPLETED');
      const assistants = fixture.chats
        .listMessages(String(fixture.session.id))
        .filter((message) => message.role === 'ASSISTANT');
      expect(assistants.map((message) => [message.status, message.plainText])).toEqual([
        ['FAILED', ''],
        ['COMPLETED', '2'],
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it('does not repeat a successful tool after the final assistant continuation stream disconnects', async () => {
    const fixture = await runFixture();
    let providerRequests = 0;
    let toolExecutions = 0;
    const requestBodies: Record<string, unknown>[] = [];
    const provider = new OpenAiProvider((_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('expected serialized provider request');
      requestBodies.push(JSON.parse(init.body) as Record<string, unknown>);
      providerRequests += 1;
      if (providerRequests === 1) {
        return Promise.resolve(
          new Response(
            encodeSse(
              {
                type: 'response.output_item.added',
                output_index: 0,
                item: {
                  type: 'function_call',
                  call_id: 'call_schedule_once',
                  name: 'get_today_schedule',
                  arguments: '',
                },
              },
              {
                type: 'response.function_call_arguments.delta',
                output_index: 0,
                delta: '{}',
              },
              { type: 'response.function_call_arguments.done', output_index: 0 },
              {
                type: 'response.completed',
                response: {
                  output: [
                    {
                      type: 'function_call',
                      call_id: 'call_schedule_once',
                      name: 'get_today_schedule',
                      arguments: '{}',
                    },
                  ],
                },
              },
            ),
            { status: 200, headers: { 'content-type': 'text/event-stream' } },
          ),
        );
      }
      if (providerRequests === 2) {
        return Promise.resolve(
          silentEofAfter({
            type: 'response.output_text.delta',
            delta: '工具结果是：',
          }),
        );
      }
      return Promise.resolve(completedTextStream('2'));
    });
    const runner = runnerFor(fixture.chats, fixture.ai, provider, {
      definitions: () => [
        { name: 'get_today_schedule', description: '读取今日安排', parameters: {} },
      ],
      execute: () => {
        toolExecutions += 1;
        return Promise.resolve({ items: [{ title: '专注工作' }] });
      },
    });
    try {
      await runner.run(fixture.result.runId);
      expect(fixture.chats.getRun(fixture.result.runId)).toMatchObject({
        status: 'FAILED',
        errorCode: 'AI_UNAVAILABLE',
      });
      expect(toolExecutions).toBe(1);

      const followUp = fixture.chats.sendMessage(String(fixture.session.id), '1 + 1 等于多少');
      await runner.run(followUp.runId);

      expect(fixture.chats.getRun(followUp.runId).status).toBe('COMPLETED');
      expect(toolExecutions).toBe(1);
      expect(providerRequests).toBe(3);
      const nextRunInput = requestBodies[2]?.input;
      expect(Array.isArray(nextRunInput) ? nextRunInput : []).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'function_call_output', call_id: 'call_schedule_once' }),
        ]),
      );
      const assistants = fixture.chats
        .listMessages(String(fixture.session.id))
        .filter((message) => message.role === 'ASSISTANT');
      expect(assistants.map((message) => [message.status, message.plainText])).toEqual([
        ['FAILED', '工具结果是：'],
        ['COMPLETED', '2'],
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it('injects trusted UTC and Asia/Shanghai week context into every provider run', async () => {
    const fixture = await runFixture();
    let capturedMessages: readonly { role: string; content: string }[] = [];
    const provider: ToolCallingProvider = {
      ...answeringProvider,
      executeTools: (request) => {
        capturedMessages = request.messages;
        return answeringProvider.executeTools(request);
      },
    };
    try {
      await runnerFor(fixture.chats, fixture.ai, provider, undefined, {
        clock: fixture.clock,
      }).run(fixture.result.runId);
      expect(capturedMessages[0]).toMatchObject({ role: 'system' });
      expect(capturedMessages[0]?.content).toContain('currentUtc: 2026-08-29T10:00:00.000Z');
      expect(capturedMessages[0]?.content).toContain('localDateTime: 2026-08-29T18:00:00');
      expect(capturedMessages[0]?.content).toContain('timezone: Asia/Shanghai');
      expect(capturedMessages[0]?.content).toContain('weekday: 星期六');
      expect(capturedMessages[0]?.content).toContain('weekStart: 2026-08-24');
    } finally {
      await fixture.cleanup();
    }
  });
});
