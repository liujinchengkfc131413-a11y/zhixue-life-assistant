import { describe, expect, it } from 'vitest';

import { resolveDefaultProvider, type AiProvider } from './api.js';

const provider = (overrides: Partial<AiProvider> = {}): AiProvider => ({
  id: 'provider-default',
  providerType: 'OPENAI',
  displayName: '默认服务',
  baseUrl: null,
  modelId: 'gpt-test',
  hasCredential: true,
  capabilities: { chat: true, streaming: true, toolCalling: true, nativeWebSearch: false },
  isDefault: true,
  lastVerifiedAt: '2026-08-20T08:00:00.000Z',
  lastError: null,
  version: 1,
  ...overrides,
});

describe('resolveDefaultProvider', () => {
  it('selects the explicit default instead of the first provider', () => {
    const first = provider({ id: 'provider-first', isDefault: false });
    const explicitDefault = provider({ id: 'provider-second' });

    expect(resolveDefaultProvider([first, explicitDefault])).toEqual({
      status: 'READY',
      provider: explicitDefault,
    });
  });

  it.each([
    [{ hasCredential: false }, 'MISSING_CREDENTIAL'],
    [{ lastVerifiedAt: null }, 'UNVERIFIED'],
    [{ lastError: '连接超时' }, 'VERIFICATION_FAILED'],
    [
      { capabilities: { chat: false, streaming: true, toolCalling: true, nativeWebSearch: false } },
      'CHAT_UNAVAILABLE',
    ],
    [{ providerType: 'ANTHROPIC' }, 'UNSUPPORTED_PROVIDER'],
  ] as const)('rejects an unusable explicit default as %s', (overrides, expectedStatus) => {
    expect(resolveDefaultProvider([provider(overrides)])).toMatchObject({ status: expectedStatus });
  });

  it('requires exactly one explicit default', () => {
    expect(resolveDefaultProvider([provider({ isDefault: false })])).toEqual({
      status: 'NO_DEFAULT',
    });
    expect(resolveDefaultProvider([provider(), provider({ id: 'provider-duplicate' })])).toEqual({
      status: 'AMBIGUOUS_DEFAULT',
    });
  });

  it('allows a verified chat provider without tool calling for pure conversation', () => {
    const chatOnly = provider({
      capabilities: {
        chat: true,
        streaming: true,
        toolCalling: false,
        nativeWebSearch: false,
      },
    });

    expect(resolveDefaultProvider([chatOnly])).toEqual({ status: 'READY', provider: chatOnly });
  });
});
