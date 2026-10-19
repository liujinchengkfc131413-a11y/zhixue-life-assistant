import { describe, expect, it, vi } from 'vitest';

import {
  capabilitiesForModel,
  capabilitiesForOpenAiCompatible,
  extractResponsesText,
  OpenAiCompatibleProvider,
  OpenAiProvider,
  ToolCallingOrchestrator,
  type ToolCallingRequest,
  type ToolCallingProvider,
} from './index.js';

describe('OpenAiProvider', () => {
  it('verifies a configured model without claiming unsupported web search or streaming', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    const provider = new OpenAiProvider(fetchMock);

    await expect(
      provider.verify({ modelId: 'gpt-test', baseUrl: null, credential: 'test-secret' }),
    ).resolves.toEqual({
      chat: true,
      streaming: false,
      toolCalling: false,
      nativeWebSearch: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models/gpt-test',
      expect.objectContaining({ headers: { authorization: 'Bearer test-secret' } }),
    );
  });

  it('normalizes authentication failures without exposing a secret', async () => {
    const provider = new OpenAiProvider(() => Promise.resolve(new Response('{}', { status: 401 })));

    await expect(
      provider.verify({ modelId: 'gpt-test', baseUrl: null, credential: 'test-secret' }),
    ).rejects.toMatchObject({ code: 'AI_AUTHENTICATION_FAILED' });
  });

  it('sends Responses function definitions and returns parsed tool calls', async () => {
    let requestBody = '';
    const fetchMock: typeof fetch = (_input, init) => {
      requestBody = typeof init?.body === 'string' ? init.body : '';
      return Promise.resolve(
        new Response(
          JSON.stringify({
            output_text: '',
            output: [
              {
                type: 'function_call',
                call_id: 'call_today',
                name: 'get_today_schedule',
                arguments: '{}',
              },
            ],
          }),
          { status: 200 },
        ),
      );
    };
    const provider = new OpenAiProvider(fetchMock);
    const response = await provider.executeTools({
      modelId: 'gpt-4.1-mini',
      baseUrl: 'https://mock.openai.test/v1',
      credential: 'test-secret',
      messages: [{ role: 'user', content: '今天有什么安排？' }],
      tools: [
        {
          name: 'get_today_schedule',
          description: '读取今日安排',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      ],
      toolChoice: { type: 'function', name: 'get_today_schedule' },
    });

    expect(response.toolCalls).toEqual([
      { callId: 'call_today', name: 'get_today_schedule', argumentsJson: '{}' },
    ]);
    const body = JSON.parse(requestBody) as {
      tool_choice?: { type: string; name: string };
      tools: { name: string }[];
    };
    expect(body.tools).toEqual([
      expect.objectContaining({ name: 'get_today_schedule', strict: true }),
    ]);
    expect(body.tool_choice).toEqual({ type: 'function', name: 'get_today_schedule' });
  });

  it('advertises native web search only for supported OpenAI Responses models', () => {
    expect(capabilitiesForModel('gpt-4.1-mini')).toEqual({
      chat: true,
      streaming: true,
      toolCalling: true,
      nativeWebSearch: true,
    });
    expect(capabilitiesForModel('gpt-5.4-mini')).toEqual({
      chat: true,
      streaming: true,
      toolCalling: true,
      nativeWebSearch: true,
    });
    expect(capabilitiesForModel('unknown-model')).toEqual({
      chat: true,
      streaming: false,
      toolCalling: false,
      nativeWebSearch: false,
    });
  });

  it('resolves the explicit DeepSeek profile for api.deepseek.com regardless of model name', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    const provider = new OpenAiCompatibleProvider(fetchMock);
    await expect(
      provider.verify({
        modelId: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
        credential: 'test-secret',
      }),
    ).resolves.toEqual({
      chat: true,
      streaming: true,
      toolCalling: true,
      nativeWebSearch: false,
    });
  });

  it('normalizes a trailing slash on the DeepSeek base URL', () => {
    expect(capabilitiesForOpenAiCompatible('https://api.deepseek.com/')).toEqual({
      chat: true,
      streaming: true,
      toolCalling: true,
      nativeWebSearch: false,
    });
    expect(capabilitiesForOpenAiCompatible('https://api.deepseek.com')).toEqual({
      chat: true,
      streaming: true,
      toolCalling: true,
      nativeWebSearch: false,
    });
  });

  it('keeps unknown OpenAI Compatible providers conservative even with OpenAI-like model names', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    const provider = new OpenAiCompatibleProvider(fetchMock);
    await expect(
      provider.verify({
        modelId: 'gpt-4.1-mini',
        baseUrl: 'https://compatible.example.test/v1',
        credential: 'test-secret',
      }),
    ).resolves.toEqual({
      chat: true,
      streaming: false,
      toolCalling: false,
      nativeWebSearch: false,
    });
    expect(capabilitiesForOpenAiCompatible('https://compatible.example.test/v1')).toEqual({
      chat: true,
      streaming: false,
      toolCalling: false,
      nativeWebSearch: false,
    });
    expect(capabilitiesForOpenAiCompatible(null)).toEqual({
      chat: true,
      streaming: false,
      toolCalling: false,
      nativeWebSearch: false,
    });
  });

  it('recovers real capabilities after a transient network failure on retry', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const provider = new OpenAiCompatibleProvider(fetchMock);
    await expect(
      provider.verify({
        modelId: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
        credential: 'test-secret',
      }),
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    await expect(
      provider.verify({
        modelId: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
        credential: 'test-secret',
      }),
    ).resolves.toEqual({
      chat: true,
      streaming: true,
      toolCalling: true,
      nativeWebSearch: false,
    });
  });

  it('runs the minimum non-streaming tool calling loop to a final answer', async () => {
    const responses = [
      {
        text: '',
        toolCalls: [{ callId: 'call_today', name: 'get_today_schedule', argumentsJson: '{}' }],
        providerItems: [],
      },
      { text: '你今天有两个主要安排。', toolCalls: [], providerItems: [] },
    ];
    const requests: ToolCallingRequest[] = [];
    const executeTools = vi.fn((request: ToolCallingRequest) => {
      requests.push(request);
      return Promise.resolve(responses.shift() ?? { text: '', toolCalls: [], providerItems: [] });
    });
    const provider: ToolCallingProvider = {
      providerType: 'OPENAI',
      verify: () =>
        Promise.resolve({
          chat: true,
          streaming: false,
          toolCalling: true,
          nativeWebSearch: false,
        }),
      executeTools,
    };
    const execute = vi.fn(() => Promise.resolve({ items: ['完成项目开发', '整理文档'] }));

    const result = await new ToolCallingOrchestrator().run(
      provider,
      {
        modelId: 'gpt-4.1-mini',
        baseUrl: null,
        credential: 'test-secret',
        messages: [{ role: 'user', content: '今天有什么安排？' }],
        tools: [
          {
            name: 'get_today_schedule',
            description: '读取今日安排',
            parameters: { type: 'object', properties: {} },
          },
        ],
      },
      { execute },
    );

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ name: 'get_today_schedule' }));
    expect(executeTools).toHaveBeenCalledTimes(2);
    expect(requests[1]?.toolOutputs).toEqual([
      { callId: 'call_today', output: { items: ['完成项目开发', '整理文档'] } },
    ]);
    expect(result).toEqual({
      text: '你今天有两个主要安排。',
      executedCalls: [{ callId: 'call_today', name: 'get_today_schedule', argumentsJson: '{}' }],
      sources: [],
    });
  });

  it('executes independent tool calls serially and preserves provider order', async () => {
    let providerRound = 0;
    const provider: ToolCallingProvider = {
      providerType: 'OPENAI',
      verify: () =>
        Promise.resolve({
          chat: true,
          streaming: false,
          toolCalling: true,
          nativeWebSearch: false,
        }),
      executeTools: () => {
        providerRound += 1;
        return Promise.resolve(
          providerRound === 1
            ? {
                text: '',
                toolCalls: [
                  { callId: 'call_first', name: 'create_task', argumentsJson: '{"title":"一"}' },
                  { callId: 'call_second', name: 'create_task', argumentsJson: '{"title":"二"}' },
                ],
                providerItems: [],
              }
            : { text: '完成。', toolCalls: [], providerItems: [] },
        );
      },
    };
    const lifecycle: string[] = [];
    let active = 0;
    let maximumActive = 0;

    const result = await new ToolCallingOrchestrator().run(
      provider,
      {
        modelId: 'gpt-4.1-mini',
        baseUrl: null,
        credential: 'test-secret',
        messages: [{ role: 'user', content: '创建两个独立任务' }],
        tools: [],
      },
      {
        execute: async (call) => {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          lifecycle.push(`start:${call.callId}`);
          await Promise.resolve();
          lifecycle.push(`end:${call.callId}`);
          active -= 1;
          return { changeSetId: `change_set_${call.callId}` };
        },
      },
    );

    expect(maximumActive).toBe(1);
    expect(lifecycle).toEqual([
      'start:call_first',
      'end:call_first',
      'start:call_second',
      'end:call_second',
    ]);
    expect(result.executedCalls.map((call) => call.callId)).toEqual(['call_first', 'call_second']);
  });

  it('parses Responses SSE text and completed tool arguments', async () => {
    const stream = [
      'data: {"type":"response.output_text.delta","delta":"今天有"}\n\n',
      'data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call_today","name":"get_today_schedule","arguments":""}}\n\n',
      'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{}"}\n\n',
      'data: {"type":"response.function_call_arguments.done","output_index":0}\n\n',
      'data: {"type":"response.completed","response":{"output":[{"type":"function_call","call_id":"call_today","name":"get_today_schedule","arguments":"{}"}]}}\n\n',
    ].join('');
    const provider = new OpenAiProvider(() =>
      Promise.resolve(
        new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
      ),
    );
    const events = [];
    for await (const event of provider.streamTools({
      modelId: 'gpt-4.1-mini',
      baseUrl: 'https://mock.openai.test/v1',
      credential: 'test-secret',
      messages: [{ role: 'user', content: '今天有什么安排？' }],
      tools: [
        { name: 'get_today_schedule', description: '读取今日安排', parameters: { type: 'object' } },
      ],
    }))
      events.push(event);

    expect(events).toEqual([
      { type: 'text_delta', delta: '今天有' },
      {
        type: 'tool_call_delta',
        toolCall: { callId: 'call_today', name: 'get_today_schedule', argumentsJson: '{}' },
      },
      {
        type: 'completed',
        providerItems: [
          {
            type: 'function_call',
            call_id: 'call_today',
            name: 'get_today_schedule',
            arguments: '{}',
          },
        ],
      },
    ]);
  });

  it('rejects silent EOF before response.completed with sanitized stream diagnostics', async () => {
    const provider = new OpenAiProvider(() =>
      Promise.resolve(
        new Response(
          [
            'data: {"type":"response.output_text.delta","delta":"半截"}\n\n',
            'data: {"type":"response.output_text.delta","delta":"回答"}\n\n',
          ].join(''),
          {
            status: 200,
            headers: { 'content-type': 'text/event-stream', 'x-request-id': 'req_silent_eof' },
          },
        ),
      ),
    );
    const consume = async () => {
      const events = [];
      for await (const event of provider.streamTools({
        modelId: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
        credential: 'test-secret',
        messages: [{ role: 'user', content: '你好' }],
        tools: [],
      }))
        events.push(event);
      return events;
    };

    await expect(consume()).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      diagnostics: {
        provider: 'OPENAI',
        model: 'deepseek-v4-flash',
        providerRequestId: 'req_silent_eof',
        httpStatus: 200,
        streamTerminationReason: 'silent_eof',
        completedEventReceived: false,
        lastEventType: 'response.output_text.delta',
      },
    });
  });

  it('normalizes a socket interruption and malformed SSE without exposing stream content', async () => {
    const socketProvider = new OpenAiProvider(() => {
      let delivered = false;
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (!delivered) {
                delivered = true;
                controller.enqueue(
                  new TextEncoder().encode(
                    'data: {"type":"response.output_text.delta","delta":"private-content"}\n\n',
                  ),
                );
                return;
              }
              controller.error(new Error('socket closed with private-content'));
            },
          }),
          { status: 200 },
        ),
      );
    });
    const consumeSocket = async () => {
      for await (const _event of socketProvider.streamTools({
        modelId: 'gpt-4.1-mini',
        baseUrl: null,
        credential: 'test-secret',
        messages: [{ role: 'user', content: 'private-prompt' }],
        tools: [],
      })) {
        // Consume until the injected socket failure.
      }
    };
    let socketError: unknown;
    try {
      await consumeSocket();
    } catch (error) {
      socketError = error;
    }
    expect(socketError).toMatchObject({
      code: 'AI_UNAVAILABLE',
      diagnostics: {
        streamTerminationReason: 'socket_interruption',
        completedEventReceived: false,
        lastEventType: 'response.output_text.delta',
      },
    });
    expect(JSON.stringify(socketError)).not.toContain('private-content');
    expect(JSON.stringify(socketError)).not.toContain('private-prompt');
    expect(JSON.stringify(socketError)).not.toContain('test-secret');

    const malformedProvider = new OpenAiProvider(() =>
      Promise.resolve(new Response('data: {not-json}\n\n', { status: 200 })),
    );
    const consumeMalformed = async () => {
      for await (const _event of malformedProvider.streamTools({
        modelId: 'gpt-4.1-mini',
        baseUrl: null,
        credential: 'test-secret',
        messages: [{ role: 'user', content: '你好' }],
        tools: [],
      })) {
        // Consume until the injected parse failure.
      }
    };
    await expect(consumeMalformed()).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
      diagnostics: { streamTerminationReason: 'parse_error', completedEventReceived: false },
    });
  });
});

describe('Responses non-streaming text extraction', () => {
  const execute = (payload: unknown, status = 200) =>
    new OpenAiProvider(() =>
      Promise.resolve(new Response(JSON.stringify(payload), { status })),
    ).executeTools({
      modelId: 'deepseek-v4-flash',
      baseUrl: 'https://mock.deepseek.test/v1',
      credential: 'test-secret',
      messages: [{ role: 'user', content: '你好' }],
      tools: [],
    });

  it('parses text from the standard nested output[].content[].text structure', async () => {
    const response = await execute({
      status: 'completed',
      output: [
        { type: 'reasoning', content: [{ type: 'reasoning_text', text: '思考过程，不应展示' }] },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '你好！有什么可以帮你？' }],
        },
      ],
    });
    expect(response.text).toBe('你好！有什么可以帮你？');
  });

  it('combines multiple text items in original order', async () => {
    const response = await execute({
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'output_text', text: '第一段。' },
            { type: 'output_text', text: '第二段。' },
          ],
        },
      ],
    });
    expect(response.text).toBe('第一段。第二段。');
  });

  it('extracts only assistant message text and never reasoning content', async () => {
    const response = await execute({
      status: 'completed',
      output: [
        { type: 'reasoning', content: [{ type: 'reasoning_text', text: '秘密思考' }] },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '这是最终回答' }],
        },
      ],
    });
    expect(response.text).toBe('这是最终回答');
    expect(response.text).not.toContain('秘密思考');
  });

  it('keeps the legacy top-level output_text compatibility', async () => {
    const response = await execute({
      status: 'completed',
      output_text: '顶层便捷正文',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '嵌套正文' }],
        },
      ],
    });
    expect(response.text).toBe('顶层便捷正文');
  });

  it('falls back to nested text when top-level output_text is empty', async () => {
    const response = await execute({
      status: 'completed',
      output_text: '',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '嵌套正文' }],
        },
      ],
    });
    expect(response.text).toBe('嵌套正文');
  });

  it('rejects an explicit failed provider status with sanitized diagnostics', async () => {
    await expect(
      execute({
        status: 'failed',
        error: { code: 'server_error', message: '内部错误' },
        output: [],
      }),
    ).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });

  it('attaches sanitized diagnostics without exposing credentials', async () => {
    const response = await execute({
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '你好' }],
        },
      ],
    });
    expect(response.diagnostics).toMatchObject({
      providerType: 'OPENAI',
      modelId: 'deepseek-v4-flash',
      endpointKind: 'responses',
      httpStatus: 200,
      responseStatus: 'completed',
      outputItemTypes: ['message'],
    });
    const serialized = JSON.stringify(response.diagnostics);
    expect(serialized).not.toContain('test-secret');
    expect(serialized).not.toContain('Authorization');
  });
});

describe('AI completion invariants', () => {
  const providerReturning = (text: string) => {
    const provider: ToolCallingProvider = {
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
          text,
          toolCalls: [],
          providerItems: [],
          diagnostics: { providerType: 'OPENAI', endpointKind: 'responses', httpStatus: 200 },
        }),
    };
    return provider;
  };

  it('does not complete an empty output array', async () => {
    const provider: ToolCallingProvider = {
      providerType: 'OPENAI',
      verify: () =>
        Promise.resolve({
          chat: true,
          streaming: false,
          toolCalling: true,
          nativeWebSearch: false,
        }),
      executeTools: () => Promise.resolve({ text: '', toolCalls: [], providerItems: [] }),
    };
    await expect(
      new ToolCallingOrchestrator().run(
        provider,
        {
          modelId: 'gpt-test',
          baseUrl: null,
          credential: 'test-secret',
          messages: [{ role: 'user', content: '你好' }],
          tools: [],
        },
        { execute: () => Promise.resolve({}) },
      ),
    ).rejects.toMatchObject({ code: 'AI_EMPTY_RESPONSE' });
  });

  it('does not complete a reasoning-only response', async () => {
    await expect(
      new ToolCallingOrchestrator().run(
        providerReturning(''),
        {
          modelId: 'gpt-test',
          baseUrl: null,
          credential: 'test-secret',
          messages: [{ role: 'user', content: '你好' }],
          tools: [],
        },
        { execute: () => Promise.resolve({}) },
      ),
    ).rejects.toMatchObject({ code: 'AI_EMPTY_RESPONSE' });
  });

  it('does not complete a message with empty content', async () => {
    const provider: ToolCallingProvider = {
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
          providerItems: [{ type: 'message', role: 'assistant', content: [] }],
        }),
    };
    await expect(
      new ToolCallingOrchestrator().run(
        provider,
        {
          modelId: 'gpt-test',
          baseUrl: null,
          credential: 'test-secret',
          messages: [{ role: 'user', content: '你好' }],
          tools: [],
        },
        { execute: () => Promise.resolve({}) },
      ),
    ).rejects.toMatchObject({ code: 'AI_EMPTY_RESPONSE' });
  });

  it('completes a non-empty final answer', async () => {
    const result = await new ToolCallingOrchestrator().run(
      providerReturning('正常的回答'),
      {
        modelId: 'gpt-test',
        baseUrl: null,
        credential: 'test-secret',
        messages: [{ role: 'user', content: '你好' }],
        tools: [],
      },
      { execute: () => Promise.resolve({}) },
    );
    expect(result.text).toBe('正常的回答');
  });
});

describe('extractResponsesText', () => {
  it('ignores non-message items and non-text parts', () => {
    expect(
      extractResponsesText(undefined, [
        { type: 'reasoning', content: [{ type: 'reasoning_text', text: 'x' }] },
        { type: 'message', content: [{ type: 'input_text', text: 'y' }] },
        { type: 'message', content: [{ type: 'output_text', text: '正文' }] },
      ]),
    ).toBe('正文');
  });

  it('returns an empty string for structurally empty responses', () => {
    expect(extractResponsesText(undefined, [])).toBe('');
    expect(
      extractResponsesText(undefined, [
        { type: 'reasoning', content: [{ type: 'reasoning_text', text: '仅思考' }] },
      ]),
    ).toBe('');
  });
});
