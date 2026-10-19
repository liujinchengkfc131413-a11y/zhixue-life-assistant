import { describe, expect, it } from 'vitest';

import {
  OpenAiCompatibleProvider,
  type ToolCall,
  type ToolCallingRequest,
  type ToolCallingResponse,
} from '@life-assistant/ai-adapters';
import { AiRepository, ChatRepository, SqliteDatabase } from '@life-assistant/database';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';

import { ChatRunner } from '../src/chat-runner.js';
import { registerReadOnlyTools, ToolRegistry } from '../src/tool-registry.js';
import { WindowsCredentialStore } from '../src/windows-credential-store.js';

/**
 * DeepSeek 真实 API smoke test（环境门控，默认跳过）。
 *
 * API Key 只允许来自进程环境 `DEEPSEEK_API_KEY`，或通过 `DEEPSEEK_CREDENTIAL_REF`
 * 从 Windows Credential Store 读取；任何情况下都不允许进入终端输出、日志、
 * fixture、snapshot 或 Git diff。
 */
const enabled = process.env.RUN_DEEPSEEK_SMOKE === '1';
const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
const modelId = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash';

const readCredential = async (): Promise<string | undefined> => {
  const fromEnv = process.env.DEEPSEEK_API_KEY;
  if (fromEnv !== undefined && fromEnv.trim() !== '') return fromEnv;
  const reference = process.env.DEEPSEEK_CREDENTIAL_REF;
  if (reference === undefined || reference.trim() === '') return undefined;
  return new WindowsCredentialStore().get(reference);
};

const getFreeTimeDefinition = {
  name: 'get_free_time',
  description: '读取指定日期的可用空闲时间段。',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['date'],
    properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
  },
};

class RecordingCompatibleProvider extends OpenAiCompatibleProvider {
  public readonly requests: ToolCallingRequest[] = [];
  public readonly diagnostics: Readonly<Record<string, unknown>>[] = [];

  public override async executeTools(request: ToolCallingRequest): Promise<ToolCallingResponse> {
    this.requests.push(request);
    const response = await super.executeTools(request);
    if (response.diagnostics !== undefined) this.diagnostics.push(response.diagnostics);
    return response;
  }
}

class RecordingToolRegistry extends ToolRegistry {
  public readonly executedNames: string[] = [];

  public override async execute(call: ToolCall): Promise<unknown> {
    this.executedNames.push(call.name);
    return super.execute(call);
  }
}

describe.skipIf(!enabled)('DeepSeek real API smoke test', () => {
  it('runs a non-streaming user chat to a COMPLETED canonical assistant message', async () => {
    const credential = await readCredential();
    if (credential === undefined) throw new Error('DEEPSEEK credential unavailable');
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date());
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const ai = new AiRepository(database, clock);
      const providerConfig = ai.createProvider({
        providerType: 'OPENAI_COMPATIBLE',
        displayName: 'DeepSeek smoke',
        baseUrl,
        modelId,
      });
      const chats = new ChatRepository(database, clock);
      const session = chats.createSession({
        title: 'DeepSeek smoke',
        providerConfigId: providerConfig.id,
      });
      const result = chats.sendMessage(String(session.id), '用一句话介绍你自己。');
      const provider = new OpenAiCompatibleProvider();
      const runner = new ChatRunner(
        chats,
        ai,
        () => Promise.resolve(credential),
        (providerType) => (providerType === 'OPENAI_COMPATIBLE' ? provider : undefined),
        {
          definitions: () => [getFreeTimeDefinition],
          execute: () => Promise.resolve({}),
        },
      );
      await runner.run(result.runId);

      const types = runner.eventsFor(result.runId).map((event) => event.type);
      expect(types).toEqual(['ai.run.started', 'ai.run.delta', 'ai.run.completed']);

      const run = chats.getRun(result.runId);
      expect(run.status).toBe('COMPLETED');
      expect(run.errorCode).toBeNull();

      const messages = chats.listMessages(String(session.id));
      const assistant = messages.find((message) => message.role === 'ASSISTANT');
      expect(assistant?.status).toBe('COMPLETED');
      expect(assistant?.plainText.trim()).not.toBe('');
      expect(assistant?.modelId).toBe(modelId);
    } finally {
      database.close();
      await directory.cleanup();
    }
  }, 120_000);

  it('parses a plain non-streaming Responses body directly', async () => {
    const credential = await readCredential();
    if (credential === undefined) throw new Error('DEEPSEEK credential unavailable');
    const provider = new OpenAiCompatibleProvider();
    const response = await provider.executeTools({
      modelId,
      baseUrl,
      credential,
      messages: [{ role: 'user', content: '你好' }],
      tools: [],
    });
    expect(response.text.trim()).not.toBe('');
    expect(response.diagnostics).toMatchObject({
      providerType: 'OPENAI_COMPATIBLE',
      endpointKind: 'responses',
      httpStatus: 200,
    });
  }, 120_000);

  it('runs a read-only function tool chain: function_call → local runtime → function_call_output → final text', async () => {
    const credential = await readCredential();
    if (credential === undefined) throw new Error('DEEPSEEK credential unavailable');
    const provider = new RecordingCompatibleProvider();
    const requestBase: ToolCallingRequest = {
      modelId,
      baseUrl,
      credential,
      messages: [
        {
          role: 'user',
          content:
            '请调用 get_free_time 工具读取 2026-08-29 的空闲时间，然后用工具返回的数据简短回答。',
        },
      ],
      tools: [getFreeTimeDefinition],
    };
    // 注意：deepseek-v4-flash 处于 thinking mode，显式 tool_choice（含 required）会被
    // DeepSeek 以 400「Thinking mode does not support this tool_choice」拒绝（已实测），
    // 因此工具调用由提示词驱动，与生产 ChatRunner 路径一致。
    const round1 = await provider.executeTools(requestBase);
    expect(round1.toolCalls).toHaveLength(1);
    expect(round1.toolCalls[0]?.name).toBe('get_free_time');
    expect(round1.text).toBe('');
    const call = round1.toolCalls[0];
    if (call === undefined) throw new Error('Expected the model to call get_free_time.');

    // 本地只读 Tool Runtime：不产生任何业务写入。
    const output = {
      date: '2026-08-29',
      freeTime: [{ start: '09:00', end: '10:00', minutes: 60 }],
    };
    // 第二轮：回传 function_call_output，让模型给出最终正文。
    const round2 = await provider.executeTools({
      ...requestBase,
      previousResponseItems: round1.providerItems,
      toolOutputs: [{ callId: call.callId, output }],
    });
    expect(round2.toolCalls).toHaveLength(0);
    expect(round2.text.trim()).not.toBe('');
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.toolOutputs).toEqual([{ callId: call.callId, output }]);
    expect(provider.requests[1]?.previousResponseItems).toEqual(round1.providerItems);
    // 脱敏诊断不得包含 API Key。
    expect(JSON.stringify(provider.diagnostics)).not.toContain(credential);
  }, 180_000);

  it('runs the full ChatRunner tool chain to a COMPLETED canonical message without business writes', async () => {
    const credential = await readCredential();
    if (credential === undefined) throw new Error('DEEPSEEK credential unavailable');
    const directory = await createTestDataDirectory();
    const clock = new FixedClock(new Date());
    const database = new SqliteDatabase(directory.databasePath, clock);
    database.migrate();
    try {
      const ai = new AiRepository(database, clock);
      const providerConfig = ai.createProvider({
        providerType: 'OPENAI_COMPATIBLE',
        displayName: 'DeepSeek tool smoke',
        baseUrl,
        modelId,
      });
      const chats = new ChatRepository(database, clock);
      const session = chats.createSession({
        title: 'DeepSeek tool smoke',
        providerConfigId: providerConfig.id,
      });
      const result = chats.sendMessage(
        String(session.id),
        '请先调用 get_today_schedule 工具读取 2026-08-29 的日程，然后根据工具返回的内容简短回答今天有什么安排。',
      );
      const registry = new RecordingToolRegistry();
      registerReadOnlyTools(registry, {
        today: {
          getToday: () => ({
            date: '2026-08-29',
            plan: [{ title: '完成 P1 修复', kind: 'TASK' }],
            totals: { workMinutes: 0, lifeMinutes: 0, sleepMinutes: 0, freeMinutes: 0 },
            pressure: { score: 50, level: 'COMFORTABLE' },
            freeTime: [],
          }),
        },
        work: { overview: () => ({}) },
        life: { overview: () => ({}) },
      });
      const provider = new OpenAiCompatibleProvider();
      const loggedFields: Readonly<Record<string, unknown>>[] = [];
      const runner = new ChatRunner(
        chats,
        ai,
        () => Promise.resolve(credential),
        (providerType) => (providerType === 'OPENAI_COMPATIBLE' ? provider : undefined),
        registry,
        () => [],
        (_level, _message, fields) => {
          loggedFields.push(fields);
        },
      );
      await runner.run(result.runId);

      expect(registry.executedNames).toContain('get_today_schedule');
      expect(runner.eventsFor(result.runId).map((event) => event.type)).toEqual([
        'ai.run.started',
        'ai.run.delta',
        'ai.run.completed',
      ]);
      const run = chats.getRun(result.runId);
      expect(run.status).toBe('COMPLETED');
      expect(run.errorCode).toBeNull();

      const messages = chats.listMessages(String(session.id));
      const assistant = messages.find((message) => message.role === 'ASSISTANT');
      expect(assistant?.status).toBe('COMPLETED');
      expect(assistant?.plainText.trim()).not.toBe('');
      expect(assistant?.modelId).toBe(modelId);

      // 任何日志字段都不得包含 API Key 或 Authorization。
      expect(JSON.stringify(loggedFields)).not.toContain(credential);
      expect(JSON.stringify(loggedFields)).not.toContain('Authorization');

      // 只读工具链不得产生业务写入。
      expect(database.raw.prepare('SELECT COUNT(*) AS n FROM change_sets').get()).toEqual({ n: 0 });
      expect(database.raw.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 0 });
      expect(database.raw.prepare('SELECT COUNT(*) AS n FROM ai_actions').get()).toEqual({ n: 0 });
    } finally {
      database.close();
      await directory.cleanup();
    }
  }, 180_000);

  it('documents that web_search_preview is accepted (2xx) but does not prove usable native web search', async () => {
    const credential = await readCredential();
    if (credential === undefined) throw new Error('DEEPSEEK credential unavailable');
    // DeepSeek 官方文档确认未知工具类型被忽略：HTTP 2xx 只说明请求不报错，
    // 不会产生 web_search_call，因此 nativeWebSearch 必须保持 false。
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credential}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        input: [{ role: 'user', content: 'hi' }],
        tools: [{ type: 'web_search_preview' }],
        stream: false,
      }),
    });
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    const payload = (await response.json()) as {
      output?: readonly unknown[];
    };
    const outputItems = Array.isArray(payload.output)
      ? payload.output.map((item) =>
          typeof item === 'object' && item !== null && 'type' in item
            ? String((item as { type: unknown }).type)
            : 'unknown',
        )
      : [];
    // 工具被忽略：不会出现 web_search_call 输出项。
    expect(outputItems).not.toContain('web_search_call');
  }, 120_000);
});
