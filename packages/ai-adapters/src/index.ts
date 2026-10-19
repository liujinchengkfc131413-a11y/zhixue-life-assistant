import type { AiCapabilitiesDto, AiProviderConfigDto } from '@life-assistant/contracts';

export type AiErrorCode =
  | 'AI_UNAVAILABLE'
  | 'AI_AUTHENTICATION_FAILED'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_RESPONSE'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_CAPABILITY_UNAVAILABLE';

export class AiProviderError extends Error {
  public constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly retryable: boolean,
    /** 脱敏诊断信息：绝不包含 API Key、Authorization、完整请求正文或完整模型回答。 */
    public readonly diagnostics?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

export interface ModelProvider {
  readonly providerType: AiProviderConfigDto['providerType'];
  verify(input: {
    readonly modelId: string;
    readonly baseUrl: string | null;
    readonly credential: string;
  }): Promise<AiCapabilitiesDto>;
}

export interface AiMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly strict?: boolean;
}

export interface ToolCall {
  readonly callId: string;
  readonly name: string;
  readonly argumentsJson: string;
}

export interface ToolCallOutput {
  readonly callId: string;
  readonly output: unknown;
}

/** Provider-owned response item retained verbatim only for the next model turn. */
export type ProviderResponseItem = Readonly<Record<string, unknown>>;

export interface ToolRuntime {
  execute(call: ToolCall): Promise<unknown>;
}

export interface ToolCallingRequest {
  readonly modelId: string;
  readonly baseUrl: string | null;
  readonly credential: string;
  readonly messages: readonly AiMessage[];
  readonly tools: readonly ToolDefinition[];
  readonly nativeWebSearch?: boolean;
  readonly toolChoice?: { readonly type: 'function'; readonly name: string };
  readonly previousResponseItems?: readonly ProviderResponseItem[];
  readonly toolOutputs?: readonly ToolCallOutput[];
  /** Aborts an in-flight provider request when its local run is cancelled. */
  readonly signal?: AbortSignal;
}

export interface ToolCallingResponse {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
  readonly providerItems: readonly ProviderResponseItem[];
  readonly sources?: readonly { title: string; url: string }[];
  /** 脱敏诊断信息（不含凭据与正文），供上层记录生产日志。 */
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

/** A provider that can execute the non-streaming function-call protocol. */
export interface ToolCallingProvider extends ModelProvider {
  executeTools(request: ToolCallingRequest): Promise<ToolCallingResponse>;
}

export interface StreamEvent {
  readonly type: 'text_delta' | 'tool_call_delta' | 'completed';
  readonly delta?: string;
  readonly toolCall?: ToolCall;
  readonly providerItems?: readonly ProviderResponseItem[];
  readonly sources?: readonly { title: string; url: string }[];
}

export interface StreamingToolCallingProvider extends ToolCallingProvider {
  streamTools(request: ToolCallingRequest): AsyncIterable<StreamEvent>;
}

export class ToolCallingOrchestrator {
  public constructor(private readonly maxRounds = 8) {}

  public async run(
    provider: ToolCallingProvider,
    request: ToolCallingRequest,
    runtime: ToolRuntime,
  ): Promise<{
    readonly text: string;
    readonly executedCalls: readonly ToolCall[];
    readonly sources: readonly { title: string; url: string }[];
  }> {
    let toolOutputs: readonly ToolCallOutput[] | undefined = request.toolOutputs;
    let previousResponseItems: readonly ProviderResponseItem[] | undefined;
    const executedCalls: ToolCall[] = [];
    const sources: { title: string; url: string }[] = [];
    for (let round = 0; round < this.maxRounds; round += 1) {
      const response = await provider.executeTools({
        ...request,
        ...(previousResponseItems === undefined ? {} : { previousResponseItems }),
        ...(toolOutputs === undefined ? {} : { toolOutputs }),
      });
      sources.push(...(response.sources ?? []));
      if (response.toolCalls.length === 0) {
        // 完成不变量：最终响应没有任何合法输出（正文、已执行工具调用或引用来源）时，
        // 不得把 run/message 标记为 COMPLETED，统一使用 AI_EMPTY_RESPONSE。
        if (response.text.trim() === '' && executedCalls.length === 0 && sources.length === 0) {
          throw new AiProviderError(
            'AI_EMPTY_RESPONSE',
            '模型返回了空响应。',
            false,
            response.diagnostics,
          );
        }
        return { text: response.text, executedCalls, sources };
      }
      const outputs: ToolCallOutput[] = [];
      for (const call of response.toolCalls) {
        try {
          JSON.parse(call.argumentsJson) as unknown;
        } catch {
          throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回了无效的工具参数。', false);
        }
        executedCalls.push(call);
        outputs.push({ callId: call.callId, output: await runtime.execute(call) });
      }
      toolOutputs = outputs;
      previousResponseItems = response.providerItems;
    }
    throw new AiProviderError('AI_INVALID_RESPONSE', '模型工具调用轮次超过安全上限。', false);
  }
}

/** Credentials are deliberately opaque to the database and provider configuration DTOs. */
export interface CredentialStore {
  has(reference: string): Promise<boolean>;
  get(reference: string): Promise<string | undefined>;
  set(reference: string, secret: string): Promise<void>;
  remove(reference: string): Promise<void>;
}

export class InMemoryCredentialStore implements CredentialStore {
  private readonly values = new Map<string, string>();

  public has(reference: string): Promise<boolean> {
    return Promise.resolve(this.values.has(reference));
  }
  public get(reference: string): Promise<string | undefined> {
    return Promise.resolve(this.values.get(reference));
  }
  public set(reference: string, secret: string): Promise<void> {
    this.values.set(reference, secret);
    return Promise.resolve();
  }
  public remove(reference: string): Promise<void> {
    this.values.delete(reference);
    return Promise.resolve();
  }
}

export class OpenAiProvider implements StreamingToolCallingProvider {
  public readonly providerType: 'OPENAI' | 'OPENAI_COMPATIBLE';

  public constructor(
    private readonly fetchImplementation: typeof fetch = fetch,
    providerType: 'OPENAI' | 'OPENAI_COMPATIBLE' = 'OPENAI',
  ) {
    this.providerType = providerType;
  }

  public async verify(input: {
    readonly modelId: string;
    readonly baseUrl: string | null;
    readonly credential: string;
  }): Promise<AiCapabilitiesDto> {
    const baseUrl = input.baseUrl ?? 'https://api.openai.com/v1';
    let response: Response;
    try {
      response = await this.fetchImplementation(
        `${baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(input.modelId)}`,
        {
          headers: { authorization: `Bearer ${input.credential}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new AiProviderError('AI_UNAVAILABLE', '无法连接模型服务。', true);
    }
    if (response.status === 401 || response.status === 403)
      throw new AiProviderError('AI_AUTHENTICATION_FAILED', '模型服务拒绝了凭据。', false);
    if (response.status === 429)
      throw new AiProviderError('AI_RATE_LIMITED', '模型服务当前限流。', true);
    if (!response.ok) throw new AiProviderError('AI_UNAVAILABLE', '模型服务暂不可用。', true);
    return this.providerType === 'OPENAI'
      ? capabilitiesForModel(input.modelId)
      : capabilitiesForOpenAiCompatible(input.baseUrl);
  }

  public async executeTools(request: ToolCallingRequest): Promise<ToolCallingResponse> {
    const startedAt = Date.now();
    const baseUrl = request.baseUrl ?? 'https://api.openai.com/v1';
    const input: unknown[] = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    input.push(...(request.previousResponseItems ?? []));
    for (const output of request.toolOutputs ?? []) {
      input.push({
        type: 'function_call_output',
        call_id: output.callId,
        output: JSON.stringify(output.output),
      });
    }
    let response: Response;
    try {
      response = await this.fetchImplementation(`${baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${request.credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.modelId,
          input,
          ...(request.toolChoice === undefined ? {} : { tool_choice: request.toolChoice }),
          tools: [
            ...(request.nativeWebSearch === true ? [{ type: 'web_search_preview' }] : []),
            ...request.tools.map((tool) => ({
              type: 'function',
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              strict: tool.strict ?? true,
            })),
          ],
        }),
        signal:
          request.signal === undefined
            ? AbortSignal.timeout(30_000)
            : AbortSignal.any([AbortSignal.timeout(30_000), request.signal]),
      });
    } catch (error) {
      const timeout =
        error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
      throw new AiProviderError(
        timeout ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
        '无法连接模型服务。',
        true,
        {
          provider: this.providerType,
          model: request.modelId,
          endpointKind: 'responses',
          streamTerminationReason: timeout ? 'timeout' : 'request_error',
          completedEventReceived: false,
          lastEventType: null,
          durationMs: Date.now() - startedAt,
          errorSummary: timeout
            ? 'Provider request timed out.'
            : 'Provider request failed before a response was received.',
        },
      );
    }
    const httpDiagnostics = {
      provider: this.providerType,
      model: request.modelId,
      endpointKind: 'responses',
      httpStatus: response.status,
      providerRequestId: response.headers.get('x-request-id') ?? undefined,
      completedEventReceived: false,
      lastEventType: null,
      durationMs: Date.now() - startedAt,
    };
    if (response.status === 401 || response.status === 403)
      throw new AiProviderError('AI_AUTHENTICATION_FAILED', '模型服务拒绝了凭据。', false, {
        ...httpDiagnostics,
        streamTerminationReason: 'http_error',
        errorSummary: 'Provider rejected the configured credential.',
      });
    if (response.status === 429)
      throw new AiProviderError('AI_RATE_LIMITED', '模型服务当前限流。', true, {
        ...httpDiagnostics,
        streamTerminationReason: 'http_error',
        errorSummary: 'Provider rate limit was reached.',
      });
    if (!response.ok)
      throw new AiProviderError('AI_UNAVAILABLE', '模型服务暂不可用。', true, {
        ...httpDiagnostics,
        streamTerminationReason: 'http_error',
        errorSummary: 'Provider returned a non-success HTTP status.',
      });
    let payload: {
      output_text?: unknown;
      output?: unknown;
      status?: unknown;
      error?: unknown;
    };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回格式无效。', false, {
        ...httpDiagnostics,
        streamTerminationReason: 'parse_error',
        errorSummary: 'Provider returned a non-JSON response body.',
      });
    }
    if (!Array.isArray(payload.output))
      throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回格式无效。', false, {
        ...httpDiagnostics,
        streamTerminationReason: 'invalid_response',
        errorSummary: 'Provider response did not contain an output array.',
      });
    const diagnostics = {
      provider: this.providerType,
      providerType: this.providerType,
      model: request.modelId,
      modelId: request.modelId,
      endpointKind: 'responses',
      httpStatus: response.status,
      providerRequestId: response.headers.get('x-request-id') ?? undefined,
      responseStatus: typeof payload.status === 'string' ? payload.status : undefined,
      outputItemTypes: payload.output.map((item) =>
        typeof item === 'object' && item !== null && 'type' in item
          ? String((item as { type: unknown }).type)
          : 'unknown',
      ),
    };
    if (payload.status === 'failed' || (payload.error !== undefined && payload.error !== null)) {
      const providerError =
        typeof payload.error === 'object' && payload.error !== null
          ? (payload.error as Record<string, unknown>)
          : undefined;
      throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回了失败状态。', false, {
        ...diagnostics,
        providerErrorCode: typeof providerError?.code === 'string' ? providerError.code : undefined,
        streamTerminationReason: 'provider_failed',
        completedEventReceived: false,
        lastEventType: null,
        durationMs: Date.now() - startedAt,
        errorSummary: 'Provider returned an explicit failed response.',
      });
    }
    const toolCalls: ToolCall[] = [];
    for (const item of payload.output) {
      if (typeof item !== 'object' || item === null) continue;
      const candidate = item as Record<string, unknown>;
      if (candidate.type !== 'function_call') continue;
      if (
        typeof candidate.call_id !== 'string' ||
        typeof candidate.name !== 'string' ||
        typeof candidate.arguments !== 'string'
      )
        throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回了不完整的工具调用。', false, {
          ...diagnostics,
          streamTerminationReason: 'incomplete_tool_call',
          completedEventReceived: false,
          lastEventType: null,
          durationMs: Date.now() - startedAt,
          errorSummary: 'Provider returned an incomplete tool call.',
        });
      toolCalls.push({
        callId: candidate.call_id,
        name: candidate.name,
        argumentsJson: candidate.arguments,
      });
    }
    const sources = payload.output.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) return [];
      return content.flatMap((part) => {
        const annotations =
          typeof part === 'object' && part !== null
            ? (part as { annotations?: unknown }).annotations
            : undefined;
        if (!Array.isArray(annotations)) return [];
        return annotations.flatMap((annotation) => {
          if (typeof annotation !== 'object' || annotation === null) return [];
          const value = annotation as { type?: unknown; title?: unknown; url?: unknown };
          return value.type === 'url_citation' && typeof value.url === 'string'
            ? [{ title: typeof value.title === 'string' ? value.title : value.url, url: value.url }]
            : [];
        });
      });
    });
    return {
      text: extractResponsesText(payload.output_text, payload.output),
      toolCalls,
      providerItems: payload.output as ProviderResponseItem[],
      ...(sources.length === 0 ? {} : { sources }),
      diagnostics,
    };
  }

  public async *streamTools(request: ToolCallingRequest): AsyncIterable<StreamEvent> {
    const startedAt = Date.now();
    const response = await this.requestResponses(request, true);
    const baseDiagnostics = {
      provider: this.providerType,
      model: request.modelId,
      endpointKind: 'responses',
      httpStatus: response.status,
      providerRequestId: response.headers.get('x-request-id') ?? undefined,
    };
    if (response.body === null)
      throw new AiProviderError('AI_INVALID_RESPONSE', '模型流式响应为空。', false, {
        ...baseDiagnostics,
        streamTerminationReason: 'empty_body',
        completedEventReceived: false,
        lastEventType: null,
        durationMs: Date.now() - startedAt,
        errorSummary: 'Provider returned an empty stream body.',
      });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastEventType: string | null = null;
    let completedEventReceived = false;
    const partialCalls = new Map<
      number,
      { callId?: string; name?: string; argumentsJson: string }
    >();
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const value = line.slice(5).trim();
          if (value === '[DONE]') {
            lastEventType = '[DONE]';
            continue;
          }
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(value) as Record<string, unknown>;
          } catch {
            throw new AiProviderError('AI_INVALID_RESPONSE', '模型流式事件格式无效。', false, {
              ...baseDiagnostics,
              streamTerminationReason: 'parse_error',
              completedEventReceived,
              lastEventType,
              durationMs: Date.now() - startedAt,
              errorSummary: 'Provider emitted an invalid JSON stream event.',
            });
          }
          lastEventType = typeof event.type === 'string' ? event.type : 'unknown';
          if (event.type === 'response.failed' || event.type === 'error') {
            const failure =
              typeof event.response === 'object' && event.response !== null
                ? (event.response as Record<string, unknown>)
                : event;
            const rawProviderError = failure.error;
            const providerError =
              typeof rawProviderError === 'object' && rawProviderError !== null
                ? (rawProviderError as Record<string, unknown>)
                : undefined;
            throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回了失败状态。', false, {
              ...baseDiagnostics,
              providerErrorCode:
                typeof providerError?.code === 'string'
                  ? providerError.code
                  : typeof failure.code === 'string'
                    ? failure.code
                    : undefined,
              streamTerminationReason: 'provider_failed',
              completedEventReceived,
              lastEventType,
              durationMs: Date.now() - startedAt,
              errorSummary: 'Provider emitted an explicit failure event.',
            });
          }
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            yield { type: 'text_delta', delta: event.delta };
          }
          if (
            event.type === 'response.output_item.added' &&
            typeof event.output_index === 'number'
          ) {
            const item = event.item as Record<string, unknown> | undefined;
            if (item?.type === 'function_call') {
              partialCalls.set(event.output_index, {
                ...(typeof item.call_id === 'string' ? { callId: item.call_id } : {}),
                ...(typeof item.name === 'string' ? { name: item.name } : {}),
                argumentsJson: typeof item.arguments === 'string' ? item.arguments : '',
              });
            }
          }
          if (
            event.type === 'response.function_call_arguments.delta' &&
            typeof event.output_index === 'number'
          ) {
            const call = partialCalls.get(event.output_index);
            if (call !== undefined && typeof event.delta === 'string')
              call.argumentsJson += event.delta;
          }
          if (
            event.type === 'response.function_call_arguments.done' &&
            typeof event.output_index === 'number'
          ) {
            const call = partialCalls.get(event.output_index);
            if (call?.callId === undefined || call.name === undefined)
              throw new AiProviderError('AI_INVALID_RESPONSE', '模型流式工具调用不完整。', false, {
                ...baseDiagnostics,
                streamTerminationReason: 'incomplete_tool_call',
                completedEventReceived,
                lastEventType,
                durationMs: Date.now() - startedAt,
                errorSummary: 'Provider emitted an incomplete tool call.',
              });
            yield {
              type: 'tool_call_delta',
              toolCall: { callId: call.callId, name: call.name, argumentsJson: call.argumentsJson },
            };
            partialCalls.delete(event.output_index);
          }
          if (event.type === 'response.completed') {
            const completedResponse = event.response as Record<string, unknown> | undefined;
            const rawProviderError = completedResponse?.error;
            const providerError =
              typeof rawProviderError === 'object' && rawProviderError !== null
                ? (rawProviderError as Record<string, unknown>)
                : undefined;
            if (
              completedResponse === undefined ||
              completedResponse.status === 'failed' ||
              providerError !== undefined
            )
              throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回了失败状态。', false, {
                ...baseDiagnostics,
                providerErrorCode:
                  typeof providerError?.code === 'string' ? providerError.code : undefined,
                streamTerminationReason: 'provider_failed',
                completedEventReceived: false,
                lastEventType,
                durationMs: Date.now() - startedAt,
                errorSummary: 'Provider emitted response.completed with a failed response.',
              });
            if (!Array.isArray(completedResponse.output))
              throw new AiProviderError('AI_INVALID_RESPONSE', '模型完成事件格式无效。', false, {
                ...baseDiagnostics,
                streamTerminationReason: 'invalid_completed_event',
                completedEventReceived: false,
                lastEventType,
                durationMs: Date.now() - startedAt,
                errorSummary: 'Provider emitted an invalid response.completed event.',
              });
            if (partialCalls.size > 0)
              throw new AiProviderError('AI_INVALID_RESPONSE', '模型流式工具调用不完整。', false, {
                ...baseDiagnostics,
                streamTerminationReason: 'incomplete_tool_call',
                completedEventReceived: false,
                lastEventType,
                durationMs: Date.now() - startedAt,
                errorSummary: 'Provider completed while a tool call was still incomplete.',
              });
            completedEventReceived = true;
            yield {
              type: 'completed',
              providerItems: completedResponse.output as ProviderResponseItem[],
            };
            return;
          }
        }
      }
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      const timeout =
        error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
      throw new AiProviderError(
        timeout ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
        timeout ? '模型流式响应超时。' : '模型流式响应意外中断。',
        true,
        {
          ...baseDiagnostics,
          streamTerminationReason: timeout ? 'timeout' : 'socket_interruption',
          completedEventReceived,
          lastEventType,
          durationMs: Date.now() - startedAt,
          errorSummary: timeout
            ? 'Provider stream timed out before completion.'
            : 'Provider stream was interrupted before completion.',
        },
      );
    }
    buffer += decoder.decode();
    if (buffer.trim() !== '')
      throw new AiProviderError('AI_INVALID_RESPONSE', '模型流式事件不完整。', false, {
        ...baseDiagnostics,
        streamTerminationReason: 'truncated_event',
        completedEventReceived,
        lastEventType,
        durationMs: Date.now() - startedAt,
        errorSummary: 'Provider stream ended with a truncated event.',
      });
    throw new AiProviderError('AI_UNAVAILABLE', '模型流式响应意外中断。', true, {
      ...baseDiagnostics,
      streamTerminationReason: 'silent_eof',
      completedEventReceived,
      lastEventType,
      durationMs: Date.now() - startedAt,
      errorSummary: 'Provider stream ended before response.completed.',
    });
  }

  private async requestResponses(request: ToolCallingRequest, stream: boolean): Promise<Response> {
    const startedAt = Date.now();
    const baseUrl = request.baseUrl ?? 'https://api.openai.com/v1';
    const input: unknown[] = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    input.push(...(request.previousResponseItems ?? []));
    for (const output of request.toolOutputs ?? []) {
      input.push({
        type: 'function_call_output',
        call_id: output.callId,
        output: JSON.stringify(output.output),
      });
    }
    let response: Response;
    try {
      response = await this.fetchImplementation(`${baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${request.credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.modelId,
          input,
          stream,
          ...(request.toolChoice === undefined ? {} : { tool_choice: request.toolChoice }),
          tools: [
            ...(request.nativeWebSearch === true ? [{ type: 'web_search_preview' }] : []),
            ...request.tools.map((tool) => ({
              type: 'function',
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              strict: tool.strict ?? true,
            })),
          ],
        }),
        signal:
          request.signal === undefined
            ? AbortSignal.timeout(30_000)
            : AbortSignal.any([AbortSignal.timeout(30_000), request.signal]),
      });
    } catch (error) {
      const timeout =
        error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
      throw new AiProviderError(
        timeout ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
        '无法连接模型服务。',
        true,
        {
          provider: this.providerType,
          model: request.modelId,
          endpointKind: 'responses',
          streamTerminationReason: timeout ? 'timeout' : 'request_error',
          completedEventReceived: false,
          lastEventType: null,
          durationMs: Date.now() - startedAt,
          errorSummary: timeout
            ? 'Provider request timed out.'
            : 'Provider request failed before a response was received.',
        },
      );
    }
    const diagnostics = {
      provider: this.providerType,
      model: request.modelId,
      endpointKind: 'responses',
      httpStatus: response.status,
      providerRequestId: response.headers.get('x-request-id') ?? undefined,
      completedEventReceived: false,
      lastEventType: null,
      durationMs: Date.now() - startedAt,
    };
    if (response.status === 401 || response.status === 403)
      throw new AiProviderError('AI_AUTHENTICATION_FAILED', '模型服务拒绝了凭据。', false, {
        ...diagnostics,
        streamTerminationReason: 'http_error',
        errorSummary: 'Provider rejected the configured credential.',
      });
    if (response.status === 429)
      throw new AiProviderError('AI_RATE_LIMITED', '模型服务当前限流。', true, {
        ...diagnostics,
        streamTerminationReason: 'http_error',
        errorSummary: 'Provider rate limit was reached.',
      });
    if (!response.ok)
      throw new AiProviderError('AI_UNAVAILABLE', '模型服务暂不可用。', true, {
        ...diagnostics,
        streamTerminationReason: 'http_error',
        errorSummary: 'Provider returned a non-success HTTP status.',
      });
    return response;
  }
}

/**
 * 从 Responses API 非流式正文中提取 assistant 可见文本。
 *
 * - 优先兼容顶层便捷属性 `output_text`（OpenAI SDK 风格）。
 * - 顶层缺失或为空时，遍历标准原始结构 `output[type=message].content[type=output_text].text`，
 *   多个 text item 按原始顺序组合（同时兼容 OpenAI、DeepSeek 及其他 Compatible Provider）。
 * - reasoning 内容（`output[type=reasoning]`）不会进入用户可见正文。
 */
export const extractResponsesText = (outputText: unknown, output: readonly unknown[]): string => {
  if (typeof outputText === 'string' && outputText.trim() !== '') return outputText;
  const parts: string[] = [];
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const candidate = item as Record<string, unknown>;
    if (candidate.type !== 'message') continue;
    const content = candidate.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const contentItem = part as Record<string, unknown>;
      if (contentItem.type !== 'output_text') continue;
      if (typeof contentItem.text === 'string') parts.push(contentItem.text);
    }
  }
  return parts.join('');
};

/** OpenAI-compatible services use the same Responses tool-call wire contract with a custom base URL. */
export class OpenAiCompatibleProvider extends OpenAiProvider {
  public constructor(fetchImplementation: typeof fetch = fetch) {
    super(fetchImplementation, 'OPENAI_COMPATIBLE');
  }
}

export const capabilitiesForModel = (modelId: string): AiCapabilitiesDto => {
  const normalized = modelId.toLowerCase();
  const supportsFunctionTools = /^(gpt-(?:4\.1|4o|5(?:\.\d+)?)(?:-|$)|o[34](?:-|$))/.test(
    normalized,
  );
  const supportsStreaming = supportsFunctionTools;
  const supportsNativeWebSearch = /^(gpt-(?:4\.1|5(?:\.\d+)?)(?:-|$))/.test(normalized);
  return {
    chat: true,
    streaming: supportsStreaming,
    toolCalling: supportsFunctionTools,
    nativeWebSearch: supportsNativeWebSearch,
  };
};

const DEEPSEEK_OFFICIAL_BASE_URL = 'https://api.deepseek.com';

/**
 * 官方 DeepSeek Responses API 的明确 provider profile。
 *
 * `nativeWebSearch` 保持 `false`：capability 表达的是「当前 App + Provider + Model」实际
 * 端到端可用能力，而不是 Provider 官方理论能力。当前 adapter 对 web search 发送的线格式是
 * OpenAI 的 `web_search_preview`，DeepSeek 官方文档确认未知工具类型会被忽略（实测 HTTP 2xx
 * 但不会产生 `web_search_call`），因此在把工具类型映射为 DeepSeek 的 `web_search` 之前，
 * 不得对外声明原生联网搜索可用。
 */
const deepseekCapabilities: AiCapabilitiesDto = {
  chat: true,
  streaming: true,
  toolCalling: true,
  nativeWebSearch: false,
};

/** 未知 OpenAI Compatible Provider 的保守能力：不做任何模型名推断。 */
const conservativeCompatibleCapabilities: AiCapabilitiesDto = {
  chat: true,
  streaming: false,
  toolCalling: false,
  nativeWebSearch: false,
};

/**
 * OpenAI Compatible Provider 的能力解析：只按「providerType + 规范化 baseUrl」的明确
 * 协议 profile 判定。官方 `api.deepseek.com` 使用 DeepSeek profile；其他 Compatible
 * Provider 一律保持保守，不允许仅根据 OpenAI 模型名正则推断能力。
 */
export const capabilitiesForOpenAiCompatible = (baseUrl: string | null): AiCapabilitiesDto => {
  const normalized = (baseUrl ?? '').replace(/\/+$/, '').toLowerCase();
  return normalized === DEEPSEEK_OFFICIAL_BASE_URL
    ? deepseekCapabilities
    : conservativeCompatibleCapabilities;
};
