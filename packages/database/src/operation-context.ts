export type OperationSource = 'USER' | 'RULE_ENGINE' | 'AI' | 'SYSTEM';

export interface OperationContext {
  readonly source: OperationSource;
  readonly sourceRef: string | null;
  readonly actorRef: string | null;
  readonly userIntentReference?: string | undefined;
  readonly requestId?: string | undefined;
  readonly aiSessionId?: string | undefined;
  readonly aiRunId?: string | undefined;
  readonly aiActionId?: string | undefined;
  readonly aiToolCallId?: string | undefined;
  readonly aiProviderConfigId?: string | undefined;
  readonly aiModelId?: string | undefined;
  readonly aiUserMessageId?: string | undefined;
  readonly aiAssistantMessageId?: string | undefined;
  readonly aiToolName?: string | undefined;
  readonly ruleJobId?: string | undefined;
  readonly scheduleRunId?: string | undefined;
  readonly activeChangeSetId?: string | undefined;
}

export interface AiToolExecutionContext {
  readonly sessionId: string;
  readonly runId: string;
  readonly providerConfigId: string;
  readonly modelId: string;
  readonly userMessageId: string;
  readonly assistantMessageId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly userIntentReference: string;
  readonly aiActionId?: string | undefined;
}

export interface OperationSourceReference {
  readonly kind: 'request' | 'ai-run' | 'ai-action' | 'rule-job' | 'schedule-run' | 'system';
  readonly id: string;
}

const reference = (kind: OperationSourceReference['kind'], id: string): string => `${kind}:${id}`;

export const parseOperationSourceRef = (value: string): OperationSourceReference => {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) throw new Error('INVALID_SOURCE_REF');
  const kind = value.slice(0, separator);
  if (!['request', 'ai-run', 'ai-action', 'rule-job', 'schedule-run', 'system'].includes(kind)) {
    throw new Error('INVALID_SOURCE_REF');
  }
  return { kind: kind as OperationSourceReference['kind'], id: value.slice(separator + 1) };
};

export const createUserOperationContext = (input: {
  readonly requestId: string;
  readonly actorRef?: string | undefined;
  readonly activeChangeSetId?: string | undefined;
}): OperationContext => ({
  source: 'USER',
  sourceRef: reference('request', input.requestId),
  actorRef: input.actorRef ?? 'local-user',
  requestId: input.requestId,
  ...(input.activeChangeSetId === undefined ? {} : { activeChangeSetId: input.activeChangeSetId }),
});

export const createAiOperationContext = (input: {
  readonly aiSessionId: string;
  readonly aiRunId: string;
  readonly aiActionId?: string | undefined;
  readonly aiToolCallId?: string | undefined;
  readonly providerConfigId?: string | undefined;
  readonly modelId?: string | undefined;
  readonly userMessageId?: string | undefined;
  readonly assistantMessageId?: string | undefined;
  readonly toolName?: string | undefined;
  readonly userIntentReference?: string | undefined;
  readonly activeChangeSetId?: string | undefined;
}): OperationContext => ({
  source: 'AI',
  sourceRef: reference('ai-run', input.aiRunId),
  actorRef:
    input.aiActionId !== undefined
      ? reference('ai-action', input.aiActionId)
      : input.aiToolCallId !== undefined
        ? `ai-tool-call:${input.aiToolCallId}`
        : reference('ai-run', input.aiRunId),
  aiSessionId: input.aiSessionId,
  aiRunId: input.aiRunId,
  ...(input.aiActionId === undefined ? {} : { aiActionId: input.aiActionId }),
  ...(input.aiToolCallId === undefined ? {} : { aiToolCallId: input.aiToolCallId }),
  ...(input.providerConfigId === undefined ? {} : { aiProviderConfigId: input.providerConfigId }),
  ...(input.modelId === undefined ? {} : { aiModelId: input.modelId }),
  ...(input.userMessageId === undefined ? {} : { aiUserMessageId: input.userMessageId }),
  ...(input.assistantMessageId === undefined
    ? {}
    : { aiAssistantMessageId: input.assistantMessageId }),
  ...(input.toolName === undefined ? {} : { aiToolName: input.toolName }),
  ...(input.userIntentReference === undefined
    ? {}
    : { userIntentReference: input.userIntentReference }),
  ...(input.activeChangeSetId === undefined ? {} : { activeChangeSetId: input.activeChangeSetId }),
});

export const createRuleOperationContext = (input: {
  readonly ruleJobId?: string | undefined;
  readonly scheduleRunId?: string | undefined;
  readonly activeChangeSetId?: string | undefined;
}): OperationContext => {
  let sourceRef: string;
  if (input.scheduleRunId !== undefined) {
    sourceRef = reference('schedule-run', input.scheduleRunId);
  } else if (input.ruleJobId !== undefined) {
    sourceRef = reference('rule-job', input.ruleJobId);
  } else {
    throw new Error('RULE_SOURCE_REF_REQUIRED');
  }
  return {
    source: 'RULE_ENGINE',
    sourceRef,
    actorRef: 'rule-engine',
    ...(input.ruleJobId === undefined ? {} : { ruleJobId: input.ruleJobId }),
    ...(input.scheduleRunId === undefined ? {} : { scheduleRunId: input.scheduleRunId }),
    ...(input.activeChangeSetId === undefined
      ? {}
      : { activeChangeSetId: input.activeChangeSetId }),
  };
};

export const createSystemOperationContext = (input: {
  readonly sourceId: string;
  readonly activeChangeSetId?: string | undefined;
}): OperationContext => ({
  source: 'SYSTEM',
  sourceRef: reference('system', input.sourceId),
  actorRef: 'system',
  ...(input.activeChangeSetId === undefined ? {} : { activeChangeSetId: input.activeChangeSetId }),
});
