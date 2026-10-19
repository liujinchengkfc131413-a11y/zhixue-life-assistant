import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  CreateReminderRequestSchema,
  DiagnosticExportEnvelopeSchema,
  DiagnosticInfoEnvelopeSchema,
  HolidayOverrideRemoveEnvelopeSchema,
  HolidayUpdateRequestSchema,
  HolidayUpdateResultEnvelopeSchema,
  MutationEnvelopeSchema,
  ReminderEnvelopeSchema,
  RemindersEnvelopeSchema,
  SnoozeNotificationRequestSchema,
  UpdateReminderRequestSchema,
} from '@life-assistant/contracts';

import type { LocalRuntime } from './runtime-probe.js';

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});

const requireReminders = (runtime: LocalRuntime) => {
  if (runtime.reminders === undefined) throw new Error('APP_NOT_INITIALIZED');
  return runtime.reminders;
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

export const registerM8Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  app.get(
    '/api/v1/reminders',
    { schema: { response: { 200: RemindersEnvelopeSchema } } },
    (request) => {
      const query = request.query as { targetEntityId?: string };
      const reminders = requireReminders(runtime).list(query.targetEntityId);
      return envelope(request, reminders);
    },
  );
  app.post(
    '/api/v1/reminders',
    {
      schema: { body: CreateReminderRequestSchema, response: { 201: ReminderEnvelopeSchema } },
    },
    (request, reply) => {
      const body = CreateReminderRequestSchema.parse(request.body);
      const reminder = requireReminders(runtime).create({
        targetEntityId: body.targetEntityId,
        triggerMode: body.triggerMode,
        ...(body.triggerAt === undefined ? {} : { triggerAt: body.triggerAt }),
        ...(body.offsetMinutes === undefined ? {} : { offsetMinutes: body.offsetMinutes }),
      });
      return reply
        .header('etag', `"${String(reminder.version)}"`)
        .code(201)
        .send(envelope(request, reminder));
    },
  );
  app.patch(
    '/api/v1/reminders/:id',
    {
      schema: { body: UpdateReminderRequestSchema, response: { 200: ReminderEnvelopeSchema } },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateReminderRequestSchema.parse(request.body);
      const reminder = requireReminders(runtime).update(
        id,
        expectedVersion(request, body.expectedVersion),
        {
          ...(body.triggerMode === undefined ? {} : { triggerMode: body.triggerMode }),
          ...(body.triggerAt === undefined ? {} : { triggerAt: body.triggerAt }),
          ...(body.offsetMinutes === undefined ? {} : { offsetMinutes: body.offsetMinutes }),
          ...(body.isEnabled === undefined ? {} : { isEnabled: body.isEnabled }),
        },
      );
      return reply
        .header('etag', `"${String(reminder.version)}"`)
        .send(envelope(request, reminder));
    },
  );
  app.delete('/api/v1/reminders/:id', (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { expectedVersion?: unknown } | undefined;
    if (body === undefined || typeof body.expectedVersion !== 'number')
      throw new Error('PRECONDITION_REQUIRED');
    requireReminders(runtime).remove(id, expectedVersion(request, body.expectedVersion));
    return reply.code(204).send();
  });

  app.post('/api/v1/notifications/*', (request, reply) => {
    if (runtime.notifications === undefined) throw new Error('APP_NOT_INITIALIZED');
    const target = (request.params as { '*': string })['*'];
    const separator = target.lastIndexOf(':');
    if (separator < 1) throw new Error('NOTIFICATION_NOT_FOUND');
    const id = target.slice(0, separator);
    const action = target.slice(separator + 1);
    if (action === 'read') {
      runtime.notifications.markRead(id);
      return reply.send(envelope(request, { success: true }));
    }
    if (action === 'snooze') {
      const body = SnoozeNotificationRequestSchema.parse(request.body);
      runtime.notifications.snooze(id, body.snoozedUntil);
      return reply.send(envelope(request, { success: true }));
    }
    throw new Error('NOTIFICATION_NOT_FOUND');
  });
  app.post(
    '/api/v1/notifications:read-all',
    { schema: { response: { 200: MutationEnvelopeSchema } } },
    (request, reply) => {
      if (runtime.notifications === undefined) throw new Error('APP_NOT_INITIALIZED');
      runtime.notifications.markAllRead();
      return reply.send(envelope(request, { success: true }));
    },
  );

  app.post(
    '/api/v1/holidays:update',
    {
      schema: {
        body: HolidayUpdateRequestSchema,
        response: { 200: HolidayUpdateResultEnvelopeSchema },
      },
    },
    async (request, reply) => {
      if (runtime.holidayProvider === undefined || runtime.routines === undefined)
        throw new Error('APP_NOT_INITIALIZED');
      const body = HolidayUpdateRequestSchema.parse(request.body);
      const year = body.year ?? new Date().getUTCFullYear();
      const definitions = await runtime.holidayProvider.fetchYear(year);
      const result = runtime.routines.applySystemHolidays(
        definitions,
        runtime.holidayProvider.providerId,
      );
      return reply.send(
        envelope(request, {
          providerId: runtime.holidayProvider.providerId,
          year,
          applied: result.applied,
          preservedUserOverrides: result.preservedUserOverrides,
        }),
      );
    },
  );
  app.delete(
    '/api/v1/holidays/:date/override',
    { schema: { response: { 200: HolidayOverrideRemoveEnvelopeSchema } } },
    (request, reply) => {
      if (runtime.routines === undefined) throw new Error('APP_NOT_INITIALIZED');
      const { date } = request.params as { date: string };
      const removed = runtime.routines.removeHolidayOverride(date);
      return reply.send(envelope(request, { removed }));
    },
  );

  app.get(
    '/api/v1/system/diagnostics',
    { schema: { response: { 200: DiagnosticInfoEnvelopeSchema } } },
    (request) => envelope(request, runtime.getDiagnostics()),
  );

  app.post(
    '/api/v1/system/diagnostics:export',
    { schema: { response: { 200: DiagnosticExportEnvelopeSchema } } },
    async (request, reply) => {
      const result = await runtime.exportDiagnostics();
      return reply.send(envelope(request, result));
    },
  );
};
