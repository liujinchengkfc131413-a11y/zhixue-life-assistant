import type {
  ProviderResponseItem,
  StreamingToolCallingProvider,
  ToolCall,
  ToolCallingProvider,
  ToolCallOutput,
  ToolDefinition,
  ToolRuntime,
} from '@life-assistant/ai-adapters';
import { AiProviderError, ToolCallingOrchestrator } from '@life-assistant/ai-adapters';
import type {
  AiRepository,
  AiToolExecutionContext,
  ChatRepository,
} from '@life-assistant/database';
import type { Clock } from '@life-assistant/kernel';

export interface ChatRunEvent {
  readonly id: string;
  readonly type:
    | 'ai.run.started'
    | 'ai.run.delta'
    | 'ai.run.completed'
    | 'ai.run.failed'
    | 'ai.run.cancelled'
    | 'ai.action.awaiting_confirmation';
  readonly data: Readonly<Record<string, unknown>>;
}

export class ChatRunner {
  private readonly events = new Map<string, ChatRunEvent[]>();
  private readonly listeners = new Map<string, Set<(event: ChatRunEvent) => void>>();
  private readonly controllers = new Map<string, AbortController>();
  public constructor(
    private readonly chats: ChatRepository,
    private readonly ai: AiRepository,
    private readonly credential: (providerId: string) => Promise<string | undefined>,
    private readonly providerFor: (providerType: string) => ToolCallingProvider | undefined,
    private readonly tools: ToolRuntime & {
      definitions(): readonly ToolDefinition[];
      riskLevel?(name: string): 'READ_ONLY' | 'LOW_WRITE' | 'HIGH_WRITE';
      execute(
        call: Parameters<ToolRuntime['execute']>[0],
        context?: AiToolExecutionContext,
      ): Promise<unknown>;
    },
    private readonly memoryContext: () => readonly string[] = () => [],
    private readonly logger?: (
      level: 'info' | 'warn' | 'error',
      message: string,
      fields: Readonly<Record<string, unknown>>,
    ) => void,
    private readonly clock?: Clock,
    private readonly timeZone = 'Asia/Shanghai',
  ) {}
  public async run(id: string): Promise<void> {
    const startedAt = Date.now();
    const controller = new AbortController();
    this.controllers.set(id, controller);
    const context = this.chats.getRunContext(id);
    const memories = this.memoryContext();
    const messages = [
      {
        role: 'system' as const,
        content: this.temporalContext(this.clock?.now() ?? new Date(), this.timeZone),
      },
      ...(memories.length === 0
        ? []
        : [
            {
              role: 'system' as const,
              content: `可长期参考的用户偏好与约束（仅在相关时使用，不要声称来自附件）：\n${memories.map((memory) => `- ${memory}`).join('\n')}`,
            },
          ]),
      ...context.messages,
    ];
    const config = this.ai.getProvider(context.providerConfigId);
    if (config === undefined) {
      this.controllers.delete(id);
      throw new Error('AI_PROVIDER_NOT_FOUND');
    }
    const secret = await this.credential(config.id);
    if (secret === undefined) {
      this.failed(id, 'AI_UNAVAILABLE', undefined, {
        provider: config.providerType,
        model: config.modelId,
        sessionId: context.sessionId,
        durationMs: Date.now() - startedAt,
        errorSummary: 'Provider credential is unavailable.',
      });
      this.controllers.delete(id);
      return;
    }
    const provider = this.providerFor(config.providerType);
    if (provider === undefined) {
      this.failed(id, 'AI_CAPABILITY_UNAVAILABLE', undefined, {
        provider: config.providerType,
        model: config.modelId,
        sessionId: context.sessionId,
        durationMs: Date.now() - startedAt,
        errorSummary: 'Configured provider capability is unavailable.',
      });
      this.controllers.delete(id);
      return;
    }
    if (this.chats.getRun(id).status === 'CANCELLED') {
      this.cancelled(id);
      this.controllers.delete(id);
      return;
    }
    // Persist the actual model before any tool can write, so failed runs remain auditable.
    this.chats.startRun(id, config.modelId);
    this.emit(id, 'ai.run.started', { runId: id });
    try {
      const definitions = this.tools.definitions();
      const changeSetIds: string[] = [];
      const executeTool = async (call: ToolCall): Promise<unknown> => {
        let argumentsValue: unknown;
        try {
          argumentsValue = JSON.parse(call.argumentsJson) as unknown;
        } catch {
          throw new AiProviderError('AI_INVALID_RESPONSE', '模型返回了无效的工具参数。', false);
        }
        let userIntentReference: string | undefined;
        if (
          typeof argumentsValue === 'object' &&
          argumentsValue !== null &&
          'userIntentReference' in argumentsValue
        ) {
          const reference = argumentsValue.userIntentReference;
          if (typeof reference !== 'string')
            throw new AiProviderError(
              'AI_INVALID_RESPONSE',
              '写操作缺少有效的用户意图引用。',
              false,
            );
          try {
            this.chats.assertUserIntentReference(id, reference);
          } catch {
            throw new AiProviderError(
              'AI_INVALID_RESPONSE',
              '写操作的用户意图引用必须指向当前对话的用户消息。',
              false,
            );
          }
          userIntentReference = reference;
        }
        const riskLevel = this.tools.riskLevel?.(call.name) ?? 'READ_ONLY';
        if (riskLevel !== 'READ_ONLY' && userIntentReference === undefined) {
          throw new AiProviderError('AI_INVALID_RESPONSE', '写操作缺少有效的用户意图引用。', false);
        }
        const toolCall = this.chats.startToolCall({
          runId: id,
          providerConfigId: context.providerConfigId,
          modelId: config.modelId,
          providerCallId: call.callId,
          toolName: call.name,
          argumentsJson: call.argumentsJson,
          ...(userIntentReference === undefined ? {} : { userIntentReference }),
          riskLevel,
        });
        const executionContext: AiToolExecutionContext | undefined =
          userIntentReference === undefined
            ? undefined
            : {
                sessionId: toolCall.sessionId,
                runId: id,
                providerConfigId: context.providerConfigId,
                modelId: config.modelId,
                userMessageId: toolCall.userMessageId,
                assistantMessageId: toolCall.assistantMessageId,
                toolCallId: toolCall.id,
                toolName: call.name,
                userIntentReference,
              };
        let output: unknown;
        try {
          output = await this.tools.execute(call, executionContext);
        } catch (error) {
          const code = error instanceof Error ? error.message : 'AI_TOOL_FAILED';
          this.chats.failToolCall(toolCall.id, code);
          throw error;
        }
        const changeSetId =
          typeof output === 'object' &&
          output !== null &&
          'changeSetId' in output &&
          typeof output.changeSetId === 'string'
            ? output.changeSetId
            : undefined;
        this.chats.completeToolCall(toolCall.id, output, changeSetId);
        if (
          typeof output === 'object' &&
          output !== null &&
          'actionId' in output &&
          typeof output.actionId === 'string'
        ) {
          this.emit(id, 'ai.action.awaiting_confirmation', {
            runId: id,
            actionId: output.actionId,
            status: 'AWAITING_CONFIRMATION',
          });
        }
        if (changeSetId !== undefined) changeSetIds.push(changeSetId);
        return output;
      };
      const recordingTools: ToolRuntime = { execute: executeTool };
      let result: {
        readonly text: string;
        readonly sources: readonly { title: string; url: string }[];
      };
      if ('streamTools' in provider) {
        let text = '';
        let previousResponseItems: readonly ProviderResponseItem[] | undefined;
        let toolOutputs: readonly ToolCallOutput[] | undefined;
        const sources: { title: string; url: string }[] = [];
        let completed = false;
        for (let round = 0; round < 8; round += 1) {
          const calls: ToolCall[] = [];
          let roundItems: readonly ProviderResponseItem[] | undefined;
          let roundCompleted = false;
          let lastEventType: string | null = null;
          for await (const event of (provider as StreamingToolCallingProvider).streamTools({
            modelId: config.modelId,
            baseUrl: config.baseUrl,
            credential: secret,
            messages,
            tools: definitions,
            nativeWebSearch: config.capabilities.nativeWebSearch,
            ...(previousResponseItems === undefined ? {} : { previousResponseItems }),
            ...(toolOutputs === undefined ? {} : { toolOutputs }),
            signal: controller.signal,
          })) {
            lastEventType = event.type;
            if (this.chats.getRun(id).status === 'CANCELLED') {
              this.cancelled(id);
              return;
            }
            if (event.type === 'text_delta' && event.delta !== undefined) {
              text = this.chats.appendRunDelta(id, event.delta);
              this.emit(id, 'ai.run.delta', { runId: id, delta: event.delta });
            } else if (event.type === 'tool_call_delta' && event.toolCall !== undefined) {
              calls.push(event.toolCall);
            } else if (event.type === 'completed') {
              roundCompleted = true;
              roundItems = event.providerItems;
              sources.push(...(event.sources ?? []));
            }
          }
          if (!roundCompleted)
            throw new AiProviderError('AI_UNAVAILABLE', '模型流式响应意外中断。', true, {
              provider: provider.providerType,
              model: config.modelId,
              streamTerminationReason: 'silent_eof',
              completedEventReceived: false,
              lastEventType,
              errorSummary: 'Provider iterator ended before a completed event.',
            });
          if (calls.length === 0) {
            completed = true;
            break;
          }
          const outputs: ToolCallOutput[] = [];
          for (const call of calls) {
            outputs.push({ callId: call.callId, output: await executeTool(call) });
          }
          toolOutputs = outputs;
          previousResponseItems =
            roundItems !== undefined && roundItems.length > 0
              ? roundItems
              : calls.map((call) => ({
                  type: 'function_call',
                  call_id: call.callId,
                  name: call.name,
                  arguments: call.argumentsJson,
                }));
        }
        if (!completed)
          throw new AiProviderError('AI_INVALID_RESPONSE', '模型工具调用轮次超过安全上限。', false);
        result = { text, sources };
      } else {
        result = await new ToolCallingOrchestrator().run(
          provider,
          {
            modelId: config.modelId,
            baseUrl: config.baseUrl,
            credential: secret,
            messages,
            tools: definitions,
            nativeWebSearch: config.capabilities.nativeWebSearch,
            signal: controller.signal,
          },
          recordingTools,
        );
      }
      if (this.chats.getRun(id).status === 'CANCELLED') {
        this.emit(id, 'ai.run.cancelled', { runId: id });
        return;
      }
      // 防御性不变量：即使 adapter/orchestrator 漏检，也不允许空正文 + 无持久化输出的 COMPLETED。
      if (result.text.trim() === '' && changeSetIds.length === 0 && result.sources.length === 0) {
        throw new AiProviderError('AI_EMPTY_RESPONSE', '模型返回了空响应。', false);
      }
      if (!('streamTools' in provider) && result.text)
        this.emit(id, 'ai.run.delta', { runId: id, delta: result.text });
      this.chats.completeRun(id, result.text, changeSetIds, result.sources, config.modelId);
      this.emit(id, 'ai.run.completed', { runId: id });
    } catch (error) {
      const code =
        error instanceof Error && 'code' in error ? String(error.code) : 'AI_UNAVAILABLE';
      this.failed(id, code, error, {
        provider: config.providerType,
        model: config.modelId,
        sessionId: context.sessionId,
        durationMs: Date.now() - startedAt,
      });
    } finally {
      this.controllers.delete(id);
    }
  }
  public cancel(id: string) {
    const run = this.chats.cancelRun(id);
    this.controllers.get(id)?.abort();
    this.cancelled(id);
    return run;
  }
  public eventsFor(id: string): readonly ChatRunEvent[] {
    return this.events.get(id) ?? [];
  }
  public subscribe(id: string, listener: (event: ChatRunEvent) => void): () => void {
    const listeners = this.listeners.get(id) ?? new Set<(event: ChatRunEvent) => void>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(id);
    };
  }
  public emit(id: string, type: ChatRunEvent['type'], data: Readonly<Record<string, unknown>>) {
    const list = this.events.get(id) ?? [];
    list.push({ id: `${id}-${String(list.length + 1)}`, type, data });
    this.events.set(id, list);
    const event = list.at(-1);
    if (event !== undefined) for (const listener of this.listeners.get(id) ?? []) listener(event);
  }
  private failed(
    id: string,
    code: string,
    error?: unknown,
    fields: Readonly<Record<string, unknown>> = {},
  ) {
    if (this.chats.getRun(id).status === 'CANCELLED') {
      this.cancelled(id);
      return;
    }
    this.chats.failRun(id, code);
    const diagnostics =
      error instanceof AiProviderError && error.diagnostics !== undefined ? error.diagnostics : {};
    this.logger?.('error', `AI run failed: ${code}`, {
      ...diagnostics,
      ...fields,
      runId: id,
      errorCode: code,
      errorSummary:
        typeof fields.errorSummary === 'string'
          ? fields.errorSummary
          : typeof diagnostics.errorSummary === 'string'
            ? diagnostics.errorSummary
            : error instanceof AiProviderError
              ? error.message
              : 'Unexpected provider failure.',
    });
    this.emit(id, 'ai.run.failed', { runId: id, errorCode: code });
  }
  private cancelled(id: string) {
    if (this.eventsFor(id).some((event) => event.type === 'ai.run.cancelled')) return;
    this.emit(id, 'ai.run.cancelled', { runId: id });
  }

  private temporalContext(now: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes): string => {
      const value = parts.find((candidate) => candidate.type === type)?.value;
      if (value === undefined) throw new Error(`TEMPORAL_CONTEXT_${type.toUpperCase()}_MISSING`);
      return value;
    };
    const year = part('year');
    const month = part('month');
    const day = part('day');
    const localDate = `${year}-${month}-${day}`;
    const localDateTime = `${localDate}T${part('hour')}:${part('minute')}:${part('second')}`;
    const localDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const daysSinceMonday = (localDay.getUTCDay() + 6) % 7;
    localDay.setUTCDate(localDay.getUTCDate() - daysSinceMonday);
    const weekStart = localDay.toISOString().slice(0, 10);
    const weekday = new Intl.DateTimeFormat('zh-CN', { timeZone, weekday: 'long' }).format(now);
    return [
      '以下是服务端提供的可信当前时间上下文，用于解释“今天、今晚、明天、本周、周五前”等相对时间；不得要求用户或工具再次提供当前日期：',
      `currentUtc: ${now.toISOString()}`,
      `localDateTime: ${localDateTime}`,
      `timezone: ${timeZone}`,
      `weekday: ${weekday}`,
      `weekStart: ${weekStart}（本周按周一开始）`,
    ].join('\n');
  }
}
