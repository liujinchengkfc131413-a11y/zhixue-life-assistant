import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  AiProviderConfigsEnvelopeSchema,
  AiProviderEnvelopeSchema,
  AiProviderVersionRequestSchema,
  CreateAiProviderRequestSchema,
  PutAiProviderCredentialRequestSchema,
  UpdateAiProviderRequestSchema,
  type AiProviderConfigDto,
} from '@life-assistant/contracts';
import {
  createUserOperationContext,
  type AiProviderConfigRecord,
  type AiRepository,
} from '@life-assistant/database';
import {
  ChatSessionEnvelopeSchema,
  ChatSessionsEnvelopeSchema,
  ChatMessagesEnvelopeSchema,
  AiRunEnvelopeSchema,
  CreateChatRequestSchema,
  UpdateChatSessionRequestSchema,
  SendChatMessageRequestSchema,
  SendChatMessageEnvelopeSchema,
  AiActionEnvelopeSchema,
  AiChangeSetEnvelopeSchema,
  UndoAiChangeSetEnvelopeSchema,
  ClearAiMemoryConfirmEnvelopeSchema,
  ClearAiMemoryConfirmRequestSchema,
  ClearAiMemoryPreviewEnvelopeSchema,
  CreateAiSuggestionRequestSchema,
  AiSuggestionEnvelopeSchema,
  AiSuggestionAnalysisEnvelopeSchema,
} from '@life-assistant/contracts';

import type { LocalRuntime } from './runtime-probe.js';

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});

const expectedVersion = (request: FastifyRequest, bodyVersion: number): number => {
  const header = request.headers['if-match'];
  const value = typeof header === 'string' ? header : Array.isArray(header) ? header[0] : undefined;
  if (value === undefined) throw new Error('PRECONDITION_REQUIRED');
  const parsed = Number(value.replace(/^W\//, '').replaceAll('"', ''));
  if (!Number.isInteger(parsed) || parsed !== bodyVersion) throw new Error('VERSION_CONFLICT');
  return parsed;
};

const requireAi = (runtime: LocalRuntime): AiRepository => {
  if (runtime.ai === undefined) throw new Error('APP_NOT_INITIALIZED');
  return runtime.ai;
};

const present = (runtime: LocalRuntime, record: AiProviderConfigRecord): AiProviderConfigDto => ({
  id: record.id,
  providerType: record.providerType,
  displayName: record.displayName,
  baseUrl: record.baseUrl,
  modelId: record.modelId,
  hasCredential: runtime.hasAiCredential(record.id),
  capabilities: record.capabilities,
  isDefault: record.isDefault,
  lastVerifiedAt: record.lastVerifiedAt,
  lastError: record.lastError,
  version: record.version,
});

export const registerM7Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  app.post(
    '/api/v1/ai/suggestions',
    {
      schema: {
        body: CreateAiSuggestionRequestSchema,
        response: { 200: AiSuggestionEnvelopeSchema },
      },
    },
    (request) => {
      const body = CreateAiSuggestionRequestSchema.parse(request.body);
      return envelope(
        request,
        runtime.recordAiSuggestion({
          title: body.title,
          body: body.body,
          ...(body.severity === undefined ? {} : { severity: body.severity }),
        }),
      );
    },
  );
  app.post(
    '/api/v1/ai/suggestions:analyze',
    { schema: { response: { 200: AiSuggestionAnalysisEnvelopeSchema } } },
    (request) => envelope(request, runtime.analyzeAndSuggest()),
  );
  app.post(
    '/api/v1/settings/ai-memory:clear-preview',
    { schema: { response: { 200: ClearAiMemoryPreviewEnvelopeSchema } } },
    (request) => envelope(request, runtime.previewClearAiMemories()),
  );
  app.post(
    '/api/v1/settings/ai-memory:clear-confirm',
    {
      schema: {
        body: ClearAiMemoryConfirmRequestSchema,
        response: { 200: ClearAiMemoryConfirmEnvelopeSchema },
      },
    },
    (request) => {
      const body = ClearAiMemoryConfirmRequestSchema.parse(request.body);
      return envelope(request, runtime.confirmClearAiMemories(body.confirmationId, body.count));
    },
  );
  const chats = () => {
    if (runtime.chats === undefined) throw new Error('APP_NOT_INITIALIZED');
    return runtime.chats;
  };
  app.get(
    '/api/v1/ai/chats',
    { schema: { response: { 200: ChatSessionsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { q?: string; includeArchived?: string };
      return envelope(request, chats().listSessions(query.q, query.includeArchived === 'true'));
    },
  );
  app.patch(
    '/api/v1/ai/chats/:id',
    {
      schema: {
        body: UpdateChatSessionRequestSchema,
        response: { 200: ChatSessionEnvelopeSchema },
      },
    },
    (request) => {
      const body = UpdateChatSessionRequestSchema.parse(request.body);
      const version = expectedVersion(request, body.expectedVersion);
      return envelope(
        request,
        chats().rename((request.params as { id: string }).id, body.title, version),
      );
    },
  );
  app.get(
    '/api/v1/ai/change-sets/:id',
    { schema: { response: { 200: AiChangeSetEnvelopeSchema } } },
    (request) => {
      if (runtime.actions === undefined) throw new Error('APP_NOT_INITIALIZED');
      return envelope(request, runtime.actions.getChangeSet((request.params as { id: string }).id));
    },
  );
  app.post(
    '/api/v1/ai/change-sets/*',
    { schema: { response: { 200: UndoAiChangeSetEnvelopeSchema } } },
    (request) => {
      if (runtime.actions === undefined) throw new Error('APP_NOT_INITIALIZED');
      const target = (request.params as { '*': string })['*'];
      const match = /^([^:]+):undo$/.exec(target);
      if (match?.[1] === undefined) throw new Error('CHANGE_SET_NOT_FOUND');
      return envelope(
        request,
        runtime.actions.undoAiChangeSet(
          match[1],
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  const presentAction = (action: ReturnType<LocalRuntime['getAiAction']>) => ({
    id: action.id,
    actionType: action.actionType,
    preview: action.preview,
    status: action.status,
    createdAt: action.createdAt,
    executedAt: action.executedAt,
    cancelledAt: action.cancelledAt,
    expiresAt: action.expiresAt,
    result: action.result,
    errorCode: action.errorCode,
  });
  app.get(
    '/api/v1/ai/actions/:id',
    { schema: { response: { 200: AiActionEnvelopeSchema } } },
    (request) =>
      envelope(request, presentAction(runtime.getAiAction((request.params as { id: string }).id))),
  );
  app.post('/api/v1/ai/actions/*', (request) => {
    const target = (request.params as { '*': string })['*'];
    const match = /^([^:]+):(confirm|cancel)$/.exec(target);
    if (match?.[1] === undefined || match[2] === undefined) throw new Error('AI_ACTION_NOT_FOUND');
    if (match[2] === 'confirm') {
      const output = runtime.confirmAiAction(match[1]);
      return envelope(request, { action: presentAction(output.action), result: output.result });
    }
    return envelope(request, presentAction(runtime.cancelAiAction(match[1])));
  });
  app.post(
    '/api/v1/ai/chats',
    { schema: { body: CreateChatRequestSchema, response: { 201: ChatSessionEnvelopeSchema } } },
    (request, reply) =>
      reply
        .code(201)
        .send(
          envelope(request, chats().createSession(CreateChatRequestSchema.parse(request.body))),
        ),
  );
  app.get(
    '/api/v1/ai/chats/:id/messages',
    { schema: { response: { 200: ChatMessagesEnvelopeSchema } } },
    (request) => envelope(request, chats().listMessages((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/ai/chats/:id/messages',
    {
      schema: {
        body: SendChatMessageRequestSchema,
        response: { 202: SendChatMessageEnvelopeSchema },
      },
    },
    (request, reply) => {
      const body = SendChatMessageRequestSchema.parse(request.body);
      const result = chats().sendMessage(
        (request.params as { id: string }).id,
        body.content,
        body.context,
      );
      void runtime.chatRunner?.run(result.runId);
      return reply.code(202).send(envelope(request, result));
    },
  );
  app.post(
    '/api/v1/ai/chats/*',
    { schema: { response: { 200: ChatSessionEnvelopeSchema } } },
    (request) => {
      const target = (request.params as { '*': string })['*'];
      const match = /^([^:]+):(archive|unarchive)$/.exec(target);
      if (match?.[1] === undefined || match[2] === undefined)
        throw new Error('CHAT_SESSION_NOT_FOUND');
      return envelope(request, chats().archive(match[1], match[2] === 'archive'));
    },
  );
  app.get(
    '/api/v1/ai/runs/:id',
    { schema: { response: { 200: AiRunEnvelopeSchema } } },
    (request) => envelope(request, chats().getRun((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/ai/runs/*',
    { schema: { response: { 200: AiRunEnvelopeSchema } } },
    (request) => {
      const target = (request.params as { '*': string })['*'];
      const match = /^([^:]+):cancel$/.exec(target);
      if (match?.[1] === undefined) throw new Error('AI_RUN_NOT_FOUND');
      const run = runtime.chatRunner?.cancel(match[1]) ?? chats().cancelRun(match[1]);
      return envelope(request, run);
    },
  );
  app.get('/api/v1/ai/runs/:id/events', (request, reply) => {
    const id = (request.params as { id: string }).id;
    const runner = runtime.chatRunner;
    if (runner === undefined) throw new Error('APP_NOT_INITIALIZED');
    const format = (event: { id: string; type: string; data: Readonly<Record<string, unknown>> }) =>
      `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    const prior = runner.eventsFor(id);
    const last = request.headers['last-event-id'];
    const index = typeof last === 'string' ? prior.findIndex((event) => event.id === last) : -1;
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    if (typeof last === 'string' && index < 0 && prior.length > 0)
      reply.raw.write(format({ id: `${id}-sync`, type: 'sync.required', data: { runId: id } }));
    else for (const event of prior.slice(index + 1)) reply.raw.write(format(event));
    const terminal = prior.at(-1)?.type;
    if (
      terminal === 'ai.run.completed' ||
      terminal === 'ai.run.failed' ||
      terminal === 'ai.run.cancelled'
    ) {
      reply.raw.end();
      return;
    }
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 20_000);
    const unsubscribe = runner.subscribe(id, (event) => {
      reply.raw.write(format(event));
      if (
        event.type === 'ai.run.completed' ||
        event.type === 'ai.run.failed' ||
        event.type === 'ai.run.cancelled'
      ) {
        clearInterval(heartbeat);
        unsubscribe();
        reply.raw.end();
      }
    });
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
  app.get(
    '/api/v1/ai/providers',
    { schema: { response: { 200: AiProviderConfigsEnvelopeSchema } } },
    (request) =>
      envelope(
        request,
        requireAi(runtime)
          .listProviders()
          .map((provider) => present(runtime, provider)),
      ),
  );
  app.post(
    '/api/v1/ai/providers',
    {
      schema: { body: CreateAiProviderRequestSchema, response: { 201: AiProviderEnvelopeSchema } },
    },
    (request, reply) => {
      const body = CreateAiProviderRequestSchema.parse(request.body);
      const provider = requireAi(runtime).createProvider({
        providerType: body.providerType,
        displayName: body.displayName,
        modelId: body.modelId,
        ...(body.baseUrl === undefined ? {} : { baseUrl: body.baseUrl }),
      });
      return reply
        .header('etag', `"${String(provider.version)}"`)
        .code(201)
        .send(envelope(request, present(runtime, provider)));
    },
  );
  app.patch(
    '/api/v1/ai/providers/:id',
    {
      schema: { body: UpdateAiProviderRequestSchema, response: { 200: AiProviderEnvelopeSchema } },
    },
    (request, reply) => {
      const body = UpdateAiProviderRequestSchema.parse(request.body);
      const provider = requireAi(runtime).updateProvider(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        {
          ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
          ...(body.baseUrl === undefined ? {} : { baseUrl: body.baseUrl }),
          ...(body.modelId === undefined ? {} : { modelId: body.modelId }),
        },
      );
      return reply
        .header('etag', `"${String(provider.version)}"`)
        .send(envelope(request, present(runtime, provider)));
    },
  );
  app.put(
    '/api/v1/ai/providers/:id/credential',
    { schema: { body: PutAiProviderCredentialRequestSchema } },
    async (request, reply) => {
      const body = PutAiProviderCredentialRequestSchema.parse(request.body);
      await runtime.putAiCredential((request.params as { id: string }).id, body.secret);
      return reply.code(204).send();
    },
  );
  app.delete('/api/v1/ai/providers/:id/credential', async (request, reply) => {
    await runtime.removeAiCredential((request.params as { id: string }).id);
    return reply.code(204).send();
  });
  app.delete('/api/v1/ai/providers/:id', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const body = AiProviderVersionRequestSchema.parse(request.body);
    await runtime.removeAiCredential(id);
    requireAi(runtime).deleteProvider(id, expectedVersion(request, body.expectedVersion));
    return reply.code(204).send();
  });
  app.post(
    '/api/v1/ai/providers/*',
    { schema: { response: { 200: AiProviderEnvelopeSchema } } },
    async (request) => {
      const target = (request.params as { '*': string })['*'];
      if (target.endsWith(':set-default')) {
        const body = AiProviderVersionRequestSchema.parse(request.body);
        const provider = requireAi(runtime).setDefault(
          target.slice(0, -':set-default'.length),
          expectedVersion(request, body.expectedVersion),
        );
        return envelope(request, present(runtime, provider));
      }
      if (!target.endsWith(':verify')) throw new Error('AI_PROVIDER_NOT_FOUND');
      const provider = await runtime.verifyAiProvider(target.slice(0, -':verify'.length));
      if (provider === undefined) throw new Error('AI_PROVIDER_NOT_FOUND');
      return envelope(request, present(runtime, provider));
    },
  );
};
