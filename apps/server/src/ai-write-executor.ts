import {
  createAiOperationContext,
  type AiToolExecutionContext,
  type ConsistencyRepository,
  type OperationContext,
} from '@life-assistant/database';

export interface AiWriteResult<T> {
  readonly changeSetId: string;
  readonly operations: readonly {
    readonly sequence: number;
    readonly entityId: string | null;
    readonly operation: 'CREATE' | 'UPDATE' | 'SOFT_DELETE' | 'RESTORE' | 'PURGE';
  }[];
  readonly result: T;
}

/** Thin audit/transaction boundary; domain mutations stay in existing repositories/services. */
export class AiWriteExecutor {
  public constructor(private readonly consistency: ConsistencyRepository) {}

  public execute<T>(input: {
    readonly execution: AiToolExecutionContext;
    readonly summary: string;
    readonly riskLevel?: 'LOW_WRITE' | 'HIGH_WRITE';
    readonly mutate: (context: OperationContext) => T;
  }): AiWriteResult<T> {
    const context = createAiOperationContext({
      aiSessionId: input.execution.sessionId,
      aiRunId: input.execution.runId,
      aiToolCallId: input.execution.toolCallId,
      providerConfigId: input.execution.providerConfigId,
      modelId: input.execution.modelId,
      userMessageId: input.execution.userMessageId,
      assistantMessageId: input.execution.assistantMessageId,
      toolName: input.execution.toolName,
      userIntentReference: input.execution.userIntentReference,
      ...(input.execution.aiActionId === undefined
        ? {}
        : { aiActionId: input.execution.aiActionId }),
    });
    return this.consistency.executeAtomicChangeSet({
      context,
      summary: input.summary,
      riskLevel: input.riskLevel ?? 'LOW_WRITE',
      execute: input.mutate,
    });
  }
}
