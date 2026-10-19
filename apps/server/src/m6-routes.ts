import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  ArchiveInboxItemRequestSchema,
  ConvertNotePreviewEnvelopeSchema,
  ConvertNotePreviewRequestSchema,
  ChangeSetsEnvelopeSchema,
  DraftEnvelopeSchema,
  InboxItemEnvelopeSchema,
  InboxItemsEnvelopeSchema,
  InboxStatusSchema,
  EntityVersionsEnvelopeSchema,
  ExecuteConfirmationRequestSchema,
  PurgePreviewRequestSchema,
  RebuildSearchEnvelopeSchema,
  RecycleItemsEnvelopeSchema,
  RestoreRecycleItemRequestSchema,
  SearchResultsEnvelopeSchema,
  SearchQuerySchema,
  NotificationsEnvelopeSchema,
  ProcessInboxManuallyRequestSchema,
  QuickCaptureRequestSchema,
  SaveDraftRequestSchema,
  UpdateInboxItemRequestSchema,
  VersionRestorePreviewRequestSchema,
} from '@life-assistant/contracts';
import { createUserOperationContext, type InboxRepository } from '@life-assistant/database';

import type { LocalRuntime } from './runtime-probe.js';

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});

const requireInbox = (runtime: LocalRuntime): InboxRepository => {
  if (runtime.inbox === undefined) throw new Error('APP_NOT_INITIALIZED');
  return runtime.inbox;
};

const expectedVersion = (request: FastifyRequest, bodyVersion: number): number => {
  const header: unknown = request.headers['if-match'];
  let value: string;
  if (typeof header === 'string') value = header;
  else if (Array.isArray(header) && typeof header[0] === 'string') value = header[0];
  else throw new Error('PRECONDITION_REQUIRED');
  const parsed = Number(value.replace(/^W\//, '').replaceAll('"', ''));
  if (!Number.isInteger(parsed) || parsed !== bodyVersion) throw new Error('VERSION_CONFLICT');
  return parsed;
};

export const registerM6Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  const information = () => {
    if (runtime.information === undefined) throw new Error('APP_NOT_INITIALIZED');
    return runtime.information;
  };
  app.get(
    '/api/v1/notifications',
    { schema: { response: { 200: NotificationsEnvelopeSchema } } },
    (request) => {
      if (runtime.notificationService === undefined) throw new Error('APP_NOT_INITIALIZED');
      return envelope(request, runtime.notificationService.execute());
    },
  );

  app.get(
    '/api/v1/search',
    { schema: { response: { 200: SearchResultsEnvelopeSchema } } },
    (request) => {
      const query = SearchQuerySchema.parse(request.query);
      return envelope(
        request,
        information().search(query.q, {
          entityType: query.entityType,
          module: query.module,
          categoryId: query.categoryId,
          status: query.status,
          tagId: query.tagId,
          from: query.from === undefined ? undefined : Date.parse(query.from),
          to: query.to === undefined ? undefined : Date.parse(query.to),
        }),
      );
    },
  );
  app.post('/api/v1/entities/*', (request) => {
    const target = (request.params as { '*': string })['*'];
    const match = /^([^/]+)\/versions\/(\d+):restore-preview$/.exec(target);
    if (match === null) throw new Error('ENTITY_VERSION_NOT_FOUND');
    const entityId = match[1];
    const targetVersion = match[2];
    if (entityId === undefined || targetVersion === undefined)
      throw new Error('ENTITY_VERSION_NOT_FOUND');
    const body = VersionRestorePreviewRequestSchema.parse(request.body);
    return envelope(
      request,
      information().previewVersionRestore(entityId, Number(targetVersion), body.expectedVersion),
    );
  });
  app.post(
    '/api/v1/search/rebuild',
    { schema: { response: { 200: RebuildSearchEnvelopeSchema } } },
    (request) => envelope(request, { indexed: information().rebuildSearchIndex() }),
  );
  app.get(
    '/api/v1/entities/:id/versions',
    { schema: { response: { 200: EntityVersionsEnvelopeSchema } } },
    (request) => envelope(request, information().versions((request.params as { id: string }).id)),
  );
  app.post('/api/v1/change-sets/*', (request) => {
    const target = (request.params as { '*': string })['*'];
    if (target.endsWith(':undo-preview'))
      return envelope(request, information().previewUndo(target.slice(0, -':undo-preview'.length)));
    if (target.endsWith(':redo-preview'))
      return envelope(request, information().previewRedo(target.slice(0, -':redo-preview'.length)));
    throw new Error('CHANGE_SET_NOT_UNDOABLE');
  });
  app.get(
    '/api/v1/change-sets',
    { schema: { response: { 200: ChangeSetsEnvelopeSchema } } },
    (request) => envelope(request, information().changeSets()),
  );
  app.get(
    '/api/v1/recycle-bin',
    { schema: { response: { 200: RecycleItemsEnvelopeSchema } } },
    (request) => envelope(request, information().recycleBin()),
  );
  app.post('/api/v1/recycle-bin/*', (request) => {
    const target = (request.params as { '*': string })['*'];
    const separator = target.lastIndexOf(':');
    if (separator < 1) throw new Error('RECYCLE_ITEM_NOT_FOUND');
    const id = target.slice(0, separator);
    const action = target.slice(separator + 1);
    if (action === 'restore') {
      const body = RestoreRecycleItemRequestSchema.parse(request.body);
      information().restoreDeleted(
        id,
        body.expectedVersion,
        createUserOperationContext({ requestId: request.id }),
      );
      return envelope(request, { success: true });
    }
    if (action === 'purge-preview') {
      const body = PurgePreviewRequestSchema.parse(request.body);
      const current = (
        information().recycleBin() as readonly { id: string; version: number }[]
      ).find((item) => item.id === id);
      if (current === undefined) throw new Error('RECYCLE_ITEM_NOT_FOUND');
      if (current.version !== body.expectedVersion) throw new Error('VERSION_CONFLICT');
      return envelope(request, information().previewPurge(id));
    }
    throw new Error('RECYCLE_ITEM_NOT_FOUND');
  });
  app.post('/api/v1/confirmations/*', (request) => {
    const body = ExecuteConfirmationRequestSchema.parse(request.body);
    const target = (request.params as { '*': string })['*'];
    if (!target.endsWith(':execute')) throw new Error('CONFIRMATION_INVALID');
    const confirmationId = target.slice(0, -':execute'.length);
    if (body.operation === 'PURGE_ENTITY')
      information().executePurge(confirmationId, body.token, body.entityId, body.expectedVersion);
    else {
      if (body.targetVersion === undefined) throw new Error('CONFIRMATION_INVALID');
      if (body.operation === 'RESTORE_VERSION')
        information().executeVersionRestore(
          confirmationId,
          body.token,
          body.entityId,
          body.targetVersion,
          body.expectedVersion,
          createUserOperationContext({ requestId: request.id }),
        );
      else {
        if (body.changeSetId === undefined) throw new Error('CONFIRMATION_INVALID');
        if (body.operation === 'UNDO_CHANGE_SET')
          information().executeUndo(
            confirmationId,
            body.token,
            body.changeSetId,
            body.entityId,
            body.targetVersion,
            body.expectedVersion,
            createUserOperationContext({ requestId: request.id }),
          );
        else
          information().executeRedo(
            confirmationId,
            body.token,
            body.changeSetId,
            body.entityId,
            body.targetVersion,
            body.expectedVersion,
            createUserOperationContext({ requestId: request.id }),
          );
      }
    }
    return envelope(request, { success: true });
  });
  app.get(
    '/api/v1/drafts/:draftKey',
    { schema: { response: { 200: DraftEnvelopeSchema } } },
    (request) => {
      if (runtime.drafts === undefined) throw new Error('APP_NOT_INITIALIZED');
      return envelope(
        request,
        runtime.drafts.get((request.params as { draftKey: string }).draftKey) ?? null,
      );
    },
  );
  app.put(
    '/api/v1/drafts/:draftKey',
    { schema: { body: SaveDraftRequestSchema, response: { 200: DraftEnvelopeSchema } } },
    (request) => {
      if (runtime.drafts === undefined) throw new Error('APP_NOT_INITIALIZED');
      const body = SaveDraftRequestSchema.parse(request.body);
      return envelope(
        request,
        runtime.drafts.save({
          draftKey: (request.params as { draftKey: string }).draftKey,
          entityId: body.entityId ?? null,
          formType: body.formType,
          content: body.content,
          expiresAt:
            body.expiresAt === undefined || body.expiresAt === null
              ? null
              : Date.parse(body.expiresAt),
        }),
      );
    },
  );
  app.delete('/api/v1/drafts/:draftKey', (request, reply) => {
    if (runtime.drafts === undefined) throw new Error('APP_NOT_INITIALIZED');
    runtime.drafts.remove((request.params as { draftKey: string }).draftKey);
    return reply.code(204).send();
  });

  app.post(
    '/api/v1/work/entities/:entityId/notes/:noteId\\:convert-preview',
    {
      schema: {
        body: ConvertNotePreviewRequestSchema,
        response: { 200: ConvertNotePreviewEnvelopeSchema },
      },
    },
    (request) => {
      if (runtime.work === undefined) throw new Error('APP_NOT_INITIALIZED');
      const { entityId, noteId } = request.params as { entityId: string; noteId: string };
      const body = ConvertNotePreviewRequestSchema.parse(request.body);
      const note = runtime.work.listNotes(entityId).find((item) => item.id === noteId);
      if (note === undefined) throw new Error('WORK_NOTE_NOT_FOUND');
      const source = note.markdownContent ?? note.plainText;
      const preview =
        body.targetMode === 'RICH_TEXT'
          ? source
              .split('\n')
              .map(
                (line) =>
                  `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`,
              )
              .join('')
          : source;
      const warnings =
        body.targetMode === 'RICH_TEXT' && /(^|\n)(```|\|.+\|)/.test(source)
          ? ['代码块或表格在富文本预览中可能需要重新排版。']
          : [];
      return envelope(request, {
        sourceMode: note.editorMode,
        targetMode: body.targetMode,
        preview,
        warnings,
        hasLoss: warnings.length > 0,
      });
    },
  );

  app.post(
    '/api/v1/quick-capture',
    { schema: { body: QuickCaptureRequestSchema, response: { 201: InboxItemEnvelopeSchema } } },
    (request, reply) => {
      const body = QuickCaptureRequestSchema.parse(request.body);
      if (body.mode === 'AI_PROCESS' && !runtime.isAiConfigured()) {
        requireInbox(runtime).capture(body.text, body.mode);
        throw new Error('AI_UNAVAILABLE');
      }
      const item = requireInbox(runtime).capture(body.text, body.mode);
      return reply
        .header('etag', `"${String(item.version)}"`)
        .code(201)
        .send(envelope(request, item));
    },
  );

  app.get(
    '/api/v1/inbox',
    { schema: { response: { 200: InboxItemsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { status?: string };
      const status = query.status === undefined ? undefined : InboxStatusSchema.parse(query.status);
      return envelope(request, requireInbox(runtime).list(status));
    },
  );
  app.get(
    '/api/v1/inbox/:id',
    { schema: { response: { 200: InboxItemEnvelopeSchema } } },
    (request, reply) => {
      const item = requireInbox(runtime).get((request.params as { id: string }).id);
      if (item === undefined) throw new Error('INBOX_ITEM_NOT_FOUND');
      return reply.header('etag', `"${String(item.version)}"`).send(envelope(request, item));
    },
  );
  app.patch(
    '/api/v1/inbox/:id',
    { schema: { body: UpdateInboxItemRequestSchema, response: { 200: InboxItemEnvelopeSchema } } },
    (request, reply) => {
      const body = UpdateInboxItemRequestSchema.parse(request.body);
      const item = requireInbox(runtime).update(
        (request.params as { id: string }).id,
        expectedVersion(request, body.expectedVersion),
        body.rawText,
      );
      return reply.header('etag', `"${String(item.version)}"`).send(envelope(request, item));
    },
  );
  app.post('/api/v1/inbox/*', (request, reply) => {
    const target = (request.params as { '*': string })['*'];
    const separator = target.lastIndexOf(':');
    if (separator < 1) throw new Error('INBOX_ITEM_NOT_FOUND');
    const id = target.slice(0, separator);
    const action = target.slice(separator + 1);
    if (action === 'process-with-ai') throw new Error('AI_UNAVAILABLE');
    if (action === 'process-manually') {
      const body = ProcessInboxManuallyRequestSchema.parse(request.body);
      const inputs = body.results.map((result) =>
        result.resultType === 'TASK' ? { ...result, dueAt: Date.parse(result.dueAt) } : result,
      );
      const item = requireInbox(runtime).processManually(
        id,
        expectedVersion(request, body.expectedVersion),
        inputs,
      );
      return reply.header('etag', `"${String(item.version)}"`).send(envelope(request, item));
    }
    if (action === 'archive') {
      const body = ArchiveInboxItemRequestSchema.parse(request.body);
      const item = requireInbox(runtime).archive(
        id,
        expectedVersion(request, body.expectedVersion),
      );
      return reply.header('etag', `"${String(item.version)}"`).send(envelope(request, item));
    }
    throw new Error('INBOX_ITEM_NOT_FOUND');
  });
};
