import type { FastifyInstance, FastifyRequest } from 'fastify';

import * as C from '@life-assistant/contracts';
import { createUserOperationContext } from '@life-assistant/database';

import type { LocalRuntime } from './runtime-probe.js';

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});
const work = (runtime: LocalRuntime) => {
  if (runtime.work === undefined) throw new Error('APP_NOT_INITIALIZED');
  return runtime.work;
};
const attachments = (runtime: LocalRuntime) => {
  if (runtime.attachmentRepository === undefined) throw new Error('APP_NOT_INITIALIZED');
  return runtime.attachmentRepository;
};
const version = (request: FastifyRequest, expected: number) => {
  const header = request.headers['if-match'];
  if (typeof header !== 'string') throw new Error('PRECONDITION_REQUIRED');
  const parsed = Number(header.replace(/^W\//, '').replaceAll('"', ''));
  if (parsed !== expected) throw new Error('VERSION_CONFLICT');
  return parsed;
};
const dates = (runtime: LocalRuntime, query: unknown) => {
  const parsed = C.WorkRangeQuerySchema.parse(query);
  const shifted = new Date(runtime.clock.now().getTime() + 8 * 3_600_000);
  const today = `${String(shifted.getUTCFullYear())}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
  if (parsed.range === 'CUSTOM') {
    if (parsed.from === undefined || parsed.to === undefined) throw new Error('INVALID_DATE_RANGE');
    if (parsed.from > parsed.to) throw new Error('INVALID_DATE_RANGE');
    return { from: parsed.from, to: parsed.to };
  }
  const end = new Date(`${today}T00:00:00+08:00`);
  const start = new Date(end);
  if (parsed.range === 'WEEK') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (parsed.range === 'MONTH') start.setDate(1);
  if (parsed.range === 'QUARTER') start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  if (parsed.range === 'YEAR') start.setMonth(0, 1);
  const fmt = (d: Date) => {
    const x = new Date(d.getTime() + 8 * 3_600_000);
    return `${String(x.getUTCFullYear())}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
  };
  return { from: fmt(start), to: today };
};
const removeUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));

export const registerM4Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  app.get(
    '/api/v1/work/overview',
    { schema: { response: { 200: C.WorkOverviewEnvelopeSchema } } },
    (request) => {
      const range = dates(runtime, request.query);
      return envelope(request, work(runtime).overview(range.from, range.to));
    },
  );
  app.get(
    '/api/v1/work/statistics',
    { schema: { response: { 200: C.WorkOverviewEnvelopeSchema } } },
    (request) => {
      const range = dates(runtime, request.query);
      return envelope(request, work(runtime).overview(range.from, range.to));
    },
  );

  app.get(
    '/api/v1/work/self-media/contents',
    { schema: { response: { 200: C.SelfMediaContentsEnvelopeSchema } } },
    (request) => {
      const query = request.query as {
        status?: 'IDEA' | 'PLANNING' | 'CREATING' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
        from?: string;
        to?: string;
      };
      return envelope(request, work(runtime).listContents(query));
    },
  );
  app.post(
    '/api/v1/work/self-media/contents',
    {
      schema: {
        body: C.CreateSelfMediaContentSchema,
        response: { 201: C.SelfMediaContentEnvelopeSchema },
      },
    },
    (request, reply) => {
      const body = C.CreateSelfMediaContentSchema.parse(request.body);
      const item = work(runtime).createContent(
        {
          categoryId: body.categoryId,
          title: body.title,
          idea: body.idea ?? null,
          script: body.script ?? null,
          contentType: body.contentType,
          platform: body.platform ?? null,
          ...(body.productionStatus === undefined
            ? {}
            : { productionStatus: body.productionStatus }),
          plannedPublishAt: body.plannedPublishAt ?? null,
          publishedAt: body.publishedAt ?? null,
          calendarEventId: body.calendarEventId ?? null,
          taskId: body.taskId ?? null,
        },
        createUserOperationContext({ requestId: request.id }),
      );
      return reply
        .code(201)
        .header('etag', `"${String(item.version)}"`)
        .send(envelope(request, item));
    },
  );
  app.get(
    '/api/v1/work/self-media/contents/:id',
    { schema: { response: { 200: C.SelfMediaContentEnvelopeSchema } } },
    (request) => {
      const item = work(runtime).getContent((request.params as { id: string }).id);
      if (item === undefined) throw new Error('SELF_MEDIA_CONTENT_NOT_FOUND');
      return envelope(request, item);
    },
  );
  app.patch(
    '/api/v1/work/self-media/contents/:id',
    {
      schema: {
        body: C.UpdateSelfMediaContentSchema,
        response: { 200: C.SelfMediaContentEnvelopeSchema },
      },
    },
    (request, reply) => {
      const body = C.UpdateSelfMediaContentSchema.parse(request.body),
        { expectedVersion, ...patch } = body;
      const item = work(runtime).updateContent(
        (request.params as { id: string }).id,
        version(request, expectedVersion),
        removeUndefined(patch),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.header('etag', `"${String(item.version)}"`).send(envelope(request, item));
    },
  );
  app.delete(
    '/api/v1/work/self-media/contents/:id',
    { schema: { body: C.UpdateSelfMediaContentSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateSelfMediaContentSchema.pick({ expectedVersion: true }).parse(
        request.body,
      );
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/work/self-media/contents/:id/transition',
    {
      schema: {
        body: C.TransitionContentSchema,
        response: { 200: C.SelfMediaContentEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.TransitionContentSchema.parse(request.body);
      return envelope(
        request,
        work(runtime).transitionContent(
          (request.params as { id: string }).id,
          version(request, body.expectedVersion),
          body.status,
          body.publishedAt,
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.get(
    '/api/v1/work/self-media/calendar',
    { schema: { response: { 200: C.SelfMediaContentsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { from?: string; to?: string };
      return envelope(request, work(runtime).listContents(query));
    },
  );
  app.get(
    '/api/v1/work/self-media/contents/:id/metrics',
    { schema: { response: { 200: C.SelfMediaMetricsEnvelopeSchema } } },
    (request) =>
      envelope(request, work(runtime).listMetrics((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/work/self-media/contents/:id/metrics',
    { schema: { body: C.CreateMetricSchema, response: { 201: C.SelfMediaMetricEnvelopeSchema } } },
    (request, reply) => {
      const body = C.CreateMetricSchema.parse(request.body);
      const item = work(runtime).createMetric((request.params as { id: string }).id, {
        recordedDate: body.recordedDate,
        platform: body.platform,
        views: body.views ?? null,
        likes: body.likes ?? null,
        comments: body.comments ?? null,
        favorites: body.favorites ?? null,
        shares: body.shares ?? null,
        followerDelta: body.followerDelta ?? null,
        customMetrics: body.customMetrics ?? {},
      });
      return reply.code(201).send(envelope(request, item));
    },
  );
  app.patch(
    '/api/v1/work/self-media/metrics/:id',
    { schema: { body: C.UpdateMetricSchema, response: { 200: C.SelfMediaMetricEnvelopeSchema } } },
    (request) => {
      const body = C.UpdateMetricSchema.parse(request.body),
        { expectedVersion, ...patch } = body;
      return envelope(
        request,
        work(runtime).updateMetric(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/self-media/metrics/:id',
    { schema: { body: C.UpdateMetricSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateMetricSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, body.expectedVersion),
      );
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/work/dev-projects',
    { schema: { response: { 200: C.DevProjectsEnvelopeSchema } } },
    (request) =>
      envelope(
        request,
        work(runtime).listProjects(
          (
            request.query as {
              status?: 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
            }
          ).status,
        ),
      ),
  );
  app.post(
    '/api/v1/work/dev-projects',
    { schema: { body: C.CreateDevProjectSchema, response: { 201: C.DevProjectEnvelopeSchema } } },
    (request, reply) => {
      const b = C.CreateDevProjectSchema.parse(request.body);
      const item = work(runtime).createProject(
        {
          categoryId: b.categoryId,
          name: b.name,
          summary: b.summary ?? null,
          ...(b.status === undefined ? {} : { status: b.status }),
          startDate: b.startDate ?? null,
          targetDate: b.targetDate ?? null,
          planId: b.planId ?? null,
        },
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(201).send(envelope(request, item));
    },
  );
  app.get(
    '/api/v1/work/dev-projects/:id',
    { schema: { response: { 200: C.DevProjectEnvelopeSchema } } },
    (request) => {
      const item = work(runtime).getProject((request.params as { id: string }).id);
      if (item === undefined) throw new Error('DEV_PROJECT_NOT_FOUND');
      return envelope(request, item);
    },
  );
  app.patch(
    '/api/v1/work/dev-projects/:id',
    { schema: { body: C.UpdateDevProjectSchema, response: { 200: C.DevProjectEnvelopeSchema } } },
    (request) => {
      const b = C.UpdateDevProjectSchema.parse(request.body),
        { expectedVersion, ...patch } = b;
      return envelope(
        request,
        work(runtime).updateProject(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/dev-projects/:id',
    { schema: { body: C.UpdateDevProjectSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const b = C.UpdateDevProjectSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, b.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/work/dev-projects/:id/features',
    { schema: { response: { 200: C.DevFeaturesEnvelopeSchema } } },
    (request) =>
      envelope(request, work(runtime).listFeatures((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/work/dev-projects/:id/features',
    { schema: { body: C.CreateDevFeatureSchema, response: { 201: C.DevFeatureEnvelopeSchema } } },
    (request, reply) => {
      const b = C.CreateDevFeatureSchema.parse(request.body);
      return reply.code(201).send(
        envelope(
          request,
          work(runtime).createFeature((request.params as { id: string }).id, {
            title: b.title,
            description: b.description ?? null,
            status: b.status,
            priority: b.priority,
            taskId: b.taskId ?? null,
            milestoneId: b.milestoneId ?? null,
            sortOrder: b.sortOrder,
          }),
        ),
      );
    },
  );
  app.patch(
    '/api/v1/work/dev-features/:id',
    { schema: { body: C.UpdateDevFeatureSchema, response: { 200: C.DevFeatureEnvelopeSchema } } },
    (request) => {
      const b = C.UpdateDevFeatureSchema.parse(request.body),
        { expectedVersion, ...patch } = b;
      return envelope(
        request,
        work(runtime).updateFeature(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/dev-features/:id',
    { schema: { body: C.UpdateDevFeatureSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const b = C.UpdateDevFeatureSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, b.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/work/dev-projects/:id/defects',
    { schema: { response: { 200: C.DevDefectsEnvelopeSchema } } },
    (request) =>
      envelope(request, work(runtime).listDefects((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/work/dev-projects/:id/defects',
    { schema: { body: C.CreateDevDefectSchema, response: { 201: C.DevDefectEnvelopeSchema } } },
    (request, reply) => {
      const b = C.CreateDevDefectSchema.parse(request.body);
      return reply.code(201).send(
        envelope(
          request,
          work(runtime).createDefect((request.params as { id: string }).id, {
            featureId: b.featureId ?? null,
            taskId: b.taskId ?? null,
            title: b.title,
            description: b.description ?? null,
            reproductionSteps: b.reproductionSteps ?? null,
            severity: b.severity,
            status: b.status,
            foundVersion: b.foundVersion ?? null,
            resolvedVersion: b.resolvedVersion ?? null,
          }),
        ),
      );
    },
  );
  app.patch(
    '/api/v1/work/dev-defects/:id',
    { schema: { body: C.UpdateDevDefectSchema, response: { 200: C.DevDefectEnvelopeSchema } } },
    (request) => {
      const b = C.UpdateDevDefectSchema.parse(request.body),
        { expectedVersion, ...patch } = b;
      return envelope(
        request,
        work(runtime).updateDefect(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/dev-defects/:id',
    { schema: { body: C.UpdateDevDefectSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const b = C.UpdateDevDefectSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, b.expectedVersion),
      );
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/work/dev-projects/:id/repositories',
    { schema: { response: { 200: C.RepositoryLinksEnvelopeSchema } } },
    (request) =>
      envelope(request, work(runtime).listRepositoryLinks((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/work/dev-projects/:id/repositories',
    {
      schema: {
        body: C.CreateRepositoryLinkSchema,
        response: { 201: C.RepositoryLinkEnvelopeSchema },
      },
    },
    (request, reply) => {
      const b = C.CreateRepositoryLinkSchema.parse(request.body);
      return reply.code(201).send(
        envelope(
          request,
          work(runtime).createRepositoryLink((request.params as { id: string }).id, {
            name: b.name,
            url: b.url,
            description: b.description ?? null,
            sortOrder: b.sortOrder,
          }),
        ),
      );
    },
  );
  app.patch(
    '/api/v1/work/repositories/:id',
    {
      schema: {
        body: C.UpdateRepositoryLinkSchema,
        response: { 200: C.RepositoryLinkEnvelopeSchema },
      },
    },
    (request) => {
      const b = C.UpdateRepositoryLinkSchema.parse(request.body),
        { expectedVersion, ...patch } = b;
      return envelope(
        request,
        work(runtime).updateRepositoryLink(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/repositories/:id',
    { schema: { body: C.UpdateRepositoryLinkSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const b = C.UpdateRepositoryLinkSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, b.expectedVersion),
      );
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/work/learning/resources',
    { schema: { response: { 200: C.LearningResourcesEnvelopeSchema } } },
    (request) =>
      envelope(
        request,
        work(runtime).listLearningResources(
          (
            request.query as {
              status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'ABANDONED';
            }
          ).status,
        ),
      ),
  );
  app.post(
    '/api/v1/work/learning/resources',
    {
      schema: {
        body: C.CreateLearningResourceSchema,
        response: { 201: C.LearningResourceEnvelopeSchema },
      },
    },
    (request, reply) => {
      const b = C.CreateLearningResourceSchema.parse(request.body);
      return reply.code(201).send(
        envelope(
          request,
          work(runtime).createLearningResource(
            {
              categoryId: b.categoryId,
              title: b.title,
              resourceType: b.resourceType,
              author: b.author ?? null,
              sourceUrl: b.sourceUrl ?? null,
              ...(b.status === undefined ? {} : { status: b.status }),
              progressCurrent: b.progressCurrent ?? null,
              progressTotal: b.progressTotal ?? null,
              progressUnit: b.progressUnit ?? null,
            },
            createUserOperationContext({ requestId: request.id }),
          ),
        ),
      );
    },
  );
  app.get(
    '/api/v1/work/learning/resources/:id',
    { schema: { response: { 200: C.LearningResourceEnvelopeSchema } } },
    (request) => {
      const item = work(runtime)
        .listLearningResources()
        .find((x) => x.id === (request.params as { id: string }).id);
      if (item === undefined) throw new Error('LEARNING_RESOURCE_NOT_FOUND');
      return envelope(request, item);
    },
  );
  app.patch(
    '/api/v1/work/learning/resources/:id',
    {
      schema: {
        body: C.UpdateLearningResourceSchema,
        response: { 200: C.LearningResourceEnvelopeSchema },
      },
    },
    (request) => {
      const b = C.UpdateLearningResourceSchema.parse(request.body),
        { expectedVersion, ...patch } = b;
      return envelope(
        request,
        work(runtime).updateLearningResource(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/learning/resources/:id',
    { schema: { body: C.UpdateLearningResourceSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const b = C.UpdateLearningResourceSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, b.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/work/learning/resources/:id/set-progress',
    {
      schema: {
        body: C.SetLearningProgressSchema,
        response: { 200: C.LearningResourceEnvelopeSchema },
      },
    },
    (request) => {
      const b = C.SetLearningProgressSchema.parse(request.body);
      return envelope(
        request,
        work(runtime).setLearningProgress(
          (request.params as { id: string }).id,
          version(request, b.expectedVersion),
          b.current,
          b.status,
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.get(
    '/api/v1/work/learning/sessions',
    { schema: { response: { 200: C.LearningSessionsEnvelopeSchema } } },
    (request) => {
      const q = request.query as { from?: string; to?: string };
      return envelope(request, work(runtime).listLearningSessions(q.from, q.to));
    },
  );
  app.post(
    '/api/v1/work/learning/sessions',
    {
      schema: {
        body: C.CreateLearningSessionSchema,
        response: { 201: C.LearningSessionEnvelopeSchema },
      },
    },
    (request, reply) => {
      const b = C.CreateLearningSessionSchema.parse(request.body);
      return reply.code(201).send(
        envelope(
          request,
          work(runtime).createLearningSession(
            {
              resourceId: b.resourceId ?? null,
              planId: b.planId ?? null,
              taskId: b.taskId ?? null,
              sessionDate: b.sessionDate,
              durationMinutes: b.durationMinutes,
              progressDelta: b.progressDelta ?? null,
              summary: b.summary ?? null,
            },
            createUserOperationContext({ requestId: request.id }),
          ),
        ),
      );
    },
  );
  app.patch(
    '/api/v1/work/learning/sessions/:id',
    {
      schema: {
        body: C.UpdateLearningSessionSchema,
        response: { 200: C.LearningSessionEnvelopeSchema },
      },
    },
    (request) => {
      const b = C.UpdateLearningSessionSchema.parse(request.body),
        { expectedVersion, ...patch } = b;
      return envelope(
        request,
        work(runtime).updateLearningSession(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/learning/sessions/:id',
    { schema: { body: C.UpdateLearningSessionSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const b = C.UpdateLearningSessionSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, b.expectedVersion),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/plans/:id/learning-resources',
    { schema: { body: C.LinkLearningResourceSchema } },
    (request, reply) => {
      const b = C.LinkLearningResourceSchema.parse(request.body);
      work(runtime).linkLearningResource(
        (request.params as { id: string }).id,
        b.resourceId,
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.delete('/api/v1/plans/:id/learning-resources/:resourceId', (request, reply) => {
    const p = request.params as { id: string; resourceId: string };
    work(runtime).unlinkLearningResource(
      p.id,
      p.resourceId,
      createUserOperationContext({ requestId: request.id }),
    );
    return reply.code(204).send();
  });

  app.get(
    '/api/v1/work/self-media/statistics',
    { schema: { response: { 200: C.SelfMediaTrendEnvelopeSchema } } },
    (request) => {
      const range = dates(runtime, request.query);
      return envelope(request, work(runtime).selfMediaTrend(range.from, range.to));
    },
  );

  app.get(
    '/api/v1/work/dev-projects/:id/milestones',
    { schema: { response: { 200: C.DevProjectMilestonesEnvelopeSchema } } },
    (request) =>
      envelope(request, work(runtime).listProjectMilestones((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/work/dev-projects/:id/milestones',
    {
      schema: {
        body: C.CreateDevProjectMilestoneSchema,
        response: { 201: C.DevProjectMilestoneEnvelopeSchema },
      },
    },
    (request, reply) => {
      const body = C.CreateDevProjectMilestoneSchema.parse(request.body);
      const item = work(runtime).createProjectMilestone((request.params as { id: string }).id, {
        title: body.title,
        dueAt: body.dueAt,
        description: body.description ?? null,
        ...(body.status === undefined ? {} : { status: body.status }),
        taskId: body.taskId ?? null,
      });
      return reply.code(201).send(envelope(request, item));
    },
  );
  app.patch(
    '/api/v1/work/dev-milestones/:id',
    {
      schema: {
        body: C.UpdateDevProjectMilestoneSchema,
        response: { 200: C.DevProjectMilestoneEnvelopeSchema },
      },
    },
    (request) => {
      const body = C.UpdateDevProjectMilestoneSchema.parse(request.body),
        { expectedVersion, ...patch } = body;
      return envelope(
        request,
        work(runtime).updateProjectMilestone(
          (request.params as { id: string }).id,
          version(request, expectedVersion),
          removeUndefined(patch),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/dev-milestones/:id',
    { schema: { body: C.UpdateDevProjectMilestoneSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const body = C.UpdateDevProjectMilestoneSchema.pick({ expectedVersion: true }).parse(
        request.body,
      );
      work(runtime).softDelete(
        (request.params as { id: string }).id,
        version(request, body.expectedVersion),
      );
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/work/entities/:id/notes',
    { schema: { response: { 200: C.WorkNotesEnvelopeSchema } } },
    (request) => envelope(request, work(runtime).listNotes((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/work/entities/:id/notes',
    {
      schema: {
        body: C.CreateWorkNoteSchema,
        response: { 201: C.WorkNoteEnvelopeSchema },
      },
    },
    (request, reply) => {
      const body = C.CreateWorkNoteSchema.parse(request.body);
      return reply.code(201).send(
        envelope(
          request,
          work(runtime).createNoteForEntity(
            {
              entityId: (request.params as { id: string }).id,
              ...body,
              editorMode: body.editorMode,
              richContent: body.richContent ?? null,
              markdownContent: body.markdownContent ?? '',
              summary: body.summary ?? null,
            },
            createUserOperationContext({ requestId: request.id }),
          ),
        ),
      );
    },
  );
  app.patch(
    '/api/v1/work/entities/:entityId/notes/:noteId',
    { schema: { body: C.UpdateWorkNoteSchema, response: { 200: C.WorkNoteEnvelopeSchema } } },
    (request) => {
      const params = request.params as { entityId: string; noteId: string };
      const body = C.UpdateWorkNoteSchema.parse(request.body),
        { expectedVersion, ...patch } = body;
      return envelope(
        request,
        work(runtime).updateNote(
          params.noteId,
          params.entityId,
          version(request, expectedVersion),
          removeUndefined(patch),
          createUserOperationContext({ requestId: request.id }),
        ),
      );
    },
  );
  app.delete(
    '/api/v1/work/entities/:entityId/notes/:noteId',
    { schema: { body: C.UpdateWorkNoteSchema.pick({ expectedVersion: true }) } },
    (request, reply) => {
      const params = request.params as { entityId: string; noteId: string };
      const body = C.UpdateWorkNoteSchema.pick({ expectedVersion: true }).parse(request.body);
      work(runtime).listNotes(params.entityId);
      work(runtime).softDelete(
        params.noteId,
        version(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/work/entities/:id/attachments',
    { schema: { response: { 200: C.LinkedAttachmentsEnvelopeSchema } } },
    (request) =>
      envelope(request, attachments(runtime).listForEntity((request.params as { id: string }).id)),
  );
  app.post(
    '/api/v1/work/entities/:id/attachments',
    { schema: { body: C.LinkAttachmentSchema } },
    (request, reply) => {
      const body = C.LinkAttachmentSchema.parse(request.body);
      attachments(runtime).link(
        body.attachmentId,
        (request.params as { id: string }).id,
        body.role,
      );
      return reply.code(204).send();
    },
  );
  app.delete('/api/v1/work/entities/:id/attachments/:attachmentId', (request, reply) => {
    const params = request.params as { id: string; attachmentId: string };
    attachments(runtime).unlink(params.attachmentId, params.id);
    return reply.code(204).send();
  });
};
