import { describe, expect, it } from 'vitest';

import { OpenAiProvider, ToolCallingOrchestrator } from '@life-assistant/ai-adapters';

const enabled = process.env.RUN_OPENAI_SMOKE === '1';
const apiKey = process.env.OPENAI_API_KEY;

describe.skipIf(!enabled || apiKey === undefined)(
  'manual OpenAI Responses tool-calling smoke test',
  () => {
    it('executes one forced local read-only tool call and receives a final response', async () => {
      const provider = new OpenAiProvider();
      const result = await new ToolCallingOrchestrator(2).run(
        provider,
        {
          modelId: process.env.OPENAI_SMOKE_MODEL ?? 'gpt-4.1-mini',
          baseUrl: null,
          credential: apiKey ?? '',
          messages: [
            {
              role: 'user',
              content: '调用 get_today_schedule，然后仅用工具返回的数据简短回答今天有什么安排。',
            },
          ],
          tools: [
            {
              name: 'get_today_schedule',
              description: '返回今天的本地日程。',
              parameters: { type: 'object', properties: {}, additionalProperties: false },
            },
          ],
          toolChoice: { type: 'function', name: 'get_today_schedule' },
        },
        { execute: () => Promise.resolve({ items: ['完成项目开发', '整理文档'] }) },
      );

      expect(result.executedCalls).toHaveLength(1);
      expect(result.text.trim()).not.toBe('');
    }, 60_000);
  },
);
