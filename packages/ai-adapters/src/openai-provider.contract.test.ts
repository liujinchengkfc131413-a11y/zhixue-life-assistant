import { createServer, type Server } from 'node:http';
import { once } from 'node:events';

import { afterEach, describe, expect, it } from 'vitest';

import {
  OpenAiProvider,
  ToolCallingOrchestrator,
  type ToolCall,
  type ToolCallingRequest,
} from './index.js';

interface CapturedRequest {
  readonly url: string | undefined;
  readonly body: Record<string, unknown>;
}

const startMockResponsesApi = async (): Promise<{
  readonly baseUrl: string;
  readonly requests: CapturedRequest[];
  close(): Promise<void>;
}> => {
  const requests: CapturedRequest[] = [];
  const server: Server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => {
      requests.push({ url: request.url, body: JSON.parse(body) as Record<string, unknown> });
      response.setHeader('content-type', 'application/json');
      if (requests.length === 1) {
        response.end(
          JSON.stringify({
            output_text: '',
            output: [
              { type: 'reasoning', id: 'rs_mock', summary: [] },
              {
                type: 'function_call',
                id: 'fc_mock',
                call_id: 'call_today',
                name: 'get_today_schedule',
                arguments: '{}',
              },
            ],
          }),
        );
      } else {
        response.end(JSON.stringify({ output_text: '你今天有两个主要安排。', output: [] }));
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Mock server did not bind TCP.');
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}/v1`,
    requests,
    close: async () => {
      server.close();
      await once(server, 'close');
    },
  };
};

describe('OpenAiProvider non-streaming tool calling contract', () => {
  let mock: Awaited<ReturnType<typeof startMockResponsesApi>> | undefined;
  afterEach(async () => {
    await mock?.close();
    mock = undefined;
  });

  it('preserves provider items, executes the local runtime, returns call_id-bound output, and receives a final answer', async () => {
    mock = await startMockResponsesApi();
    const provider = new OpenAiProvider();
    const executed: ToolCall[] = [];
    const request: ToolCallingRequest = {
      modelId: 'gpt-4.1-mini',
      baseUrl: mock.baseUrl,
      credential: 'test-secret',
      messages: [{ role: 'user', content: '今天有什么安排？' }],
      tools: [
        {
          name: 'get_today_schedule',
          description: '读取今日安排',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      ],
    };

    const result = await new ToolCallingOrchestrator().run(provider, request, {
      execute: (call) => {
        executed.push(call);
        return Promise.resolve({ items: ['完成项目开发', '整理文档'] });
      },
    });

    expect(result.text).toBe('你今天有两个主要安排。');
    expect(executed).toEqual([
      { callId: 'call_today', name: 'get_today_schedule', argumentsJson: '{}' },
    ]);
    expect(mock.requests).toHaveLength(2);
    expect(mock.requests[0]?.url).toBe('/v1/responses');
    expect(mock.requests[0]?.body.tools).toEqual([
      expect.objectContaining({ type: 'function', name: 'get_today_schedule', strict: true }),
    ]);
    expect(mock.requests[1]?.body.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'reasoning', id: 'rs_mock' }),
        expect.objectContaining({ type: 'function_call', call_id: 'call_today' }),
        {
          type: 'function_call_output',
          call_id: 'call_today',
          output: JSON.stringify({ items: ['完成项目开发', '整理文档'] }),
        },
      ]),
    );
  });
});
