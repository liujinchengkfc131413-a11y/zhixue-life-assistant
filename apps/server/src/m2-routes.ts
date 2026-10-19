import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  AddDependencyRequestSchema,
  CreateEventRequestSchema,
  CreateGoalRequestSchema,
  CreateGoalMetricRequestSchema,
  CreateGoalProgressEntryRequestSchema,
  CreatePlanRequestSchema,
  CreatePlanMilestoneRequestSchema,
  CreateRecurrenceRuleRequestSchema,
  CreateRoutineTemplateRequestSchema,
  CreateTaskRequestSchema,
  EventConflictsRequestSchema,
  EventEnvelopeSchema,
  EntityTagLinkRequestSchema,
  EntityTagsEnvelopeSchema,
  EventsEnvelopeSchema,
  GoalEnvelopeSchema,
  GoalMetricsStateEnvelopeSchema,
  GoalsEnvelopeSchema,
  HolidaysEnvelopeSchema,
  NullableRoutineOverrideEnvelopeSchema,
  NullableRecurrenceRuleEnvelopeSchema,
  PlanEnvelopeSchema,
  PlanMilestoneEnvelopeSchema,
  PlanMilestonesEnvelopeSchema,
  PlansEnvelopeSchema,
  RecurrenceExceptionRequestSchema,
  RecurrenceOccurrencesEnvelopeSchema,
  RecurrenceRuleEnvelopeSchema,
  RescheduleRequestSchema,
  RoutineOverrideRequestSchema,
  RoutineOverrideEnvelopeSchema,
  RoutineTemplateEnvelopeSchema,
  RoutineTemplatesEnvelopeSchema,
  ScheduleRunDetailEnvelopeSchema,
  ScheduleRunEnvelopeSchema,
  ScheduleWarningsEnvelopeSchema,
  SetProgressRequestSchema,
  ModifyRecurrenceRequestSchema,
  SplitRecurrenceRequestSchema,
  TaskEnvelopeSchema,
  TaskDependenciesEnvelopeSchema,
  TaskScheduleHistoryEnvelopeSchema,
  TasksEnvelopeSchema,
  TaskTransitionRequestSchema,
  TimelineEnvelopeSchema,
  UpdateGoalRequestSchema,
  UpdateGoalMetricRequestSchema,
  UpdateEventRequestSchema,
  UpdatePlanRequestSchema,
  UpdatePlanMilestoneRequestSchema,
  UpdateRoutineTemplateRequestSchema,
  UpdateTaskRequestSchema,
} from '@life-assistant/contracts';
import {
  createUserOperationContext,
  type ActionRepository,
  type RoutineRepository,
} from '@life-assistant/database';
import type { RecurrenceService, ScheduleService } from '@life-assistant/scheduler';

import type { LocalRuntime } from './runtime-probe.js';

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});

const requireServices = (
  runtime: LocalRuntime,
): {
  actions: ActionRepository;
  routines: RoutineRepository;
  schedules: ScheduleService;
  recurrences: RecurrenceService;
} => {
  if (
    runtime.actions === undefined ||
    runtime.routines === undefined ||
    runtime.schedules === undefined ||
    runtime.recurrences === undefined
  ) {
    throw new Error('APP_NOT_INITIALIZED');
  }
  return {
    actions: runtime.actions,
    routines: runtime.routines,
    schedules: runtime.schedules,
    recurrences: runtime.recurrences,
  };
};

const parseExpectedVersion = (request: FastifyRequest, bodyVersion: number): number => {
  const header: unknown = request.headers['if-match'];
  let headerValue: string;
  if (typeof header === 'string') headerValue = header;
  else if (Array.isArray(header) && typeof header[0] === 'string') headerValue = header[0];
  else throw new Error('PRECONDITION_REQUIRED');
  const parsed = Number(headerValue.replace(/^W\//, '').replaceAll('"', ''));
  if (!Number.isInteger(parsed) || parsed !== bodyVersion) throw new Error('VERSION_CONFLICT');
  return parsed;
};

const entityReply = (
  reply: FastifyReply,
  request: FastifyRequest,
  data: { version: number },
  status = 200,
) =>
  reply
    .header('etag', `"${String(data.version)}"`)
    .code(status)
    .send(envelope(request, data));

const goalMetricsReply = (
  reply: FastifyReply,
  request: FastifyRequest,
  data: { goalVersion: number },
  status = 200,
) =>
  reply
    .header('etag', `"${String(data.goalVersion)}"`)
    .code(status)
    .send(envelope(request, data));

const currentScheduleRange = (runtime: LocalRuntime): { rangeStart: number; rangeEnd: number } => {
  const now = runtime.clock.now().getTime();
  const shifted = new Date(now + 8 * 3_600_000);
  const rangeStart =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 8 * 3_600_000;
  // 自动触发只重排今天 + 未来 3 天（覆盖今日页与近端安排）；
  // 手动 /schedules:reschedule 保留完整自定义范围。
  return { rangeStart, rangeEnd: rangeStart + 3 * 86_400_000 };
};

const autoSchedule = (runtime: LocalRuntime, trigger: string): void => {
  const { schedules } = requireServices(runtime);
  const { rangeStart, rangeEnd } = currentScheduleRange(runtime);
  try {
    schedules.reschedule(rangeStart, rangeEnd, trigger);
  } catch (error) {
    // canonical 写操作已成功；derived reschedule 失败不得伪装成操作失败，
    // 转为后台重试并记录日志，同时保留 next-due 刷新。
    runtime.enqueueScheduleRetry(rangeStart, rangeEnd, trigger, error);
  } finally {
    runtime.refreshOverdueNextDue();
  }
};

export const registerM2Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  app.get('/api/v1/goals', { schema: { response: { 200: GoalsEnvelopeSchema } } }, (request) =>
    envelope(request, requireServices(runtime).actions.listGoals()),
  );
  app.post(
    '/api/v1/goals',
    { schema: { body: CreateGoalRequestSchema, response: { 201: GoalEnvelopeSchema } } },
    (request, reply) => {
      const goal = requireServices(runtime).actions.createGoal(
        CreateGoalRequestSchema.parse(request.body),
        createUserOperationContext({ requestId: request.id }),
      );
      return entityReply(reply, request, goal, 201);
    },
  );
  app.patch(
    '/api/v1/goals/:id',
    { schema: { body: UpdateGoalRequestSchema, response: { 200: GoalEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const {
        expectedVersion,
        categoryId: _categoryId,
        goalType: _goalType,
        ...patch
      } = UpdateGoalRequestSchema.parse(request.body);
      const goal = requireServices(runtime).actions.updateGoal(
        id,
        parseExpectedVersion(request, expectedVersion),
        patch,
        createUserOperationContext({ requestId: request.id }),
      );
      return entityReply(reply, request, goal);
    },
  );
  app.delete(
    '/api/v1/goals/:id',
    { schema: { body: TaskTransitionRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = TaskTransitionRequestSchema.parse(request.body);
      requireServices(runtime).actions.softDelete(
        id,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/goals/:id/set-progress',
    { schema: { body: SetProgressRequestSchema, response: { 200: GoalEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = SetProgressRequestSchema.parse(request.body);
      const goal = requireServices(runtime).actions.setGoalProgress(
        id,
        parseExpectedVersion(request, body.expectedVersion),
        body.value,
        createUserOperationContext({ requestId: request.id }),
      );
      return entityReply(reply, request, goal);
    },
  );

  app.get(
    '/api/v1/goals/:id/metrics',
    { schema: { response: { 200: GoalMetricsStateEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      return envelope(request, requireServices(runtime).actions.getGoalMetrics(id));
    },
  );
  app.post(
    '/api/v1/goals/:id/metrics',
    {
      schema: {
        body: CreateGoalMetricRequestSchema,
        response: { 201: GoalMetricsStateEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const { expectedVersion, ...input } = CreateGoalMetricRequestSchema.parse(request.body);
      const state = requireServices(runtime).actions.createGoalMetric(
        id,
        parseExpectedVersion(request, expectedVersion),
        input,
        createUserOperationContext({ requestId: request.id }),
      );
      return goalMetricsReply(reply, request, state, 201);
    },
  );
  app.patch(
    '/api/v1/goal-metrics/:id',
    {
      schema: {
        body: UpdateGoalMetricRequestSchema,
        response: { 200: GoalMetricsStateEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const { expectedVersion, ...patch } = UpdateGoalMetricRequestSchema.parse(request.body);
      const state = requireServices(runtime).actions.updateGoalMetric(
        id,
        parseExpectedVersion(request, expectedVersion),
        patch,
        createUserOperationContext({ requestId: request.id }),
      );
      return goalMetricsReply(reply, request, state);
    },
  );
  app.delete(
    '/api/v1/goal-metrics/:id',
    {
      schema: {
        body: TaskTransitionRequestSchema,
        response: { 200: GoalMetricsStateEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = TaskTransitionRequestSchema.parse(request.body);
      const state = requireServices(runtime).actions.deleteGoalMetric(
        id,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return goalMetricsReply(reply, request, state);
    },
  );
  app.post(
    '/api/v1/goals/:id/progress-entries',
    {
      schema: {
        body: CreateGoalProgressEntryRequestSchema,
        response: { 201: GoalMetricsStateEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const { expectedVersion, ...input } = CreateGoalProgressEntryRequestSchema.parse(
        request.body,
      );
      const state = requireServices(runtime).actions.recordGoalProgress(
        id,
        parseExpectedVersion(request, expectedVersion),
        input,
        createUserOperationContext({ requestId: request.id }),
      );
      return goalMetricsReply(reply, request, state, 201);
    },
  );

  app.get('/api/v1/plans', { schema: { response: { 200: PlansEnvelopeSchema } } }, (request) =>
    envelope(request, requireServices(runtime).actions.listPlans()),
  );
  app.post(
    '/api/v1/plans',
    { schema: { body: CreatePlanRequestSchema, response: { 201: PlanEnvelopeSchema } } },
    (request, reply) => {
      const plan = requireServices(runtime).actions.createPlan(
        CreatePlanRequestSchema.parse(request.body),
        createUserOperationContext({ requestId: request.id }),
      );
      return entityReply(reply, request, plan, 201);
    },
  );
  app.patch(
    '/api/v1/plans/:id',
    { schema: { body: UpdatePlanRequestSchema, response: { 200: PlanEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const {
        expectedVersion,
        goalId: _goalId,
        categoryId: _categoryId,
        ...patch
      } = UpdatePlanRequestSchema.parse(request.body);
      const plan = requireServices(runtime).actions.updatePlan(
        id,
        parseExpectedVersion(request, expectedVersion),
        patch,
        createUserOperationContext({ requestId: request.id }),
      );
      return entityReply(reply, request, plan);
    },
  );
  app.delete(
    '/api/v1/plans/:id',
    { schema: { body: TaskTransitionRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = TaskTransitionRequestSchema.parse(request.body);
      requireServices(runtime).actions.softDelete(
        id,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/plans/:id/milestones',
    { schema: { response: { 200: PlanMilestonesEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      return envelope(request, requireServices(runtime).actions.listPlanMilestones(id));
    },
  );
  app.post(
    '/api/v1/plans/:id/milestones',
    {
      schema: {
        body: CreatePlanMilestoneRequestSchema,
        response: { 201: PlanMilestoneEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreatePlanMilestoneRequestSchema.parse(request.body);
      const milestone = requireServices(runtime).actions.createPlanMilestone(
        id,
        { ...body, dueAt: Date.parse(body.dueAt) },
        createUserOperationContext({ requestId: request.id }),
      );
      return entityReply(reply, request, milestone, 201);
    },
  );
  app.patch(
    '/api/v1/milestones/:id',
    {
      schema: {
        body: UpdatePlanMilestoneRequestSchema,
        response: { 200: PlanMilestoneEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const { expectedVersion, ...patch } = UpdatePlanMilestoneRequestSchema.parse(request.body);
      const milestone = requireServices(runtime).actions.updatePlanMilestone(
        id,
        parseExpectedVersion(request, expectedVersion),
        patch,
        createUserOperationContext({ requestId: request.id }),
      );
      return entityReply(reply, request, milestone);
    },
  );
  app.delete(
    '/api/v1/milestones/:id',
    { schema: { body: TaskTransitionRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = TaskTransitionRequestSchema.parse(request.body);
      requireServices(runtime).actions.deletePlanMilestone(
        id,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );

  app.get('/api/v1/tasks', { schema: { response: { 200: TasksEnvelopeSchema } } }, (request) => {
    const query = request.query as {
      includeCompleted?: string;
      from?: string;
      to?: string;
      area?: string;
      ids?: string;
      limit?: string;
    };
    const ids = (query.ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const parsedLimit = query.limit === undefined ? undefined : Number(query.limit);
    const limit = Number.isInteger(parsedLimit) && (parsedLimit ?? 0) > 0 ? parsedLimit : undefined;
    return envelope(
      request,
      requireServices(runtime).actions.listTasks({
        includeCompleted: query.includeCompleted === 'true',
        ...(query.from === undefined ? {} : { dueFromMs: Date.parse(query.from) }),
        ...(query.to === undefined ? {} : { dueToMs: Date.parse(query.to) }),
        ...(query.area === 'WORK' || query.area === 'LIFE' ? { area: query.area } : {}),
        ...(ids.length > 0 ? { ids } : {}),
        ...(limit === undefined ? {} : { limit }),
      }),
    );
  });
  app.get(
    '/api/v1/tasks/:id',
    { schema: { response: { 200: TaskEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const task = requireServices(runtime).actions.getTask(id);
      if (task === undefined) throw new Error('TASK_NOT_FOUND');
      return entityReply(reply, request, task);
    },
  );
  app.post(
    '/api/v1/tasks',
    { schema: { body: CreateTaskRequestSchema, response: { 201: TaskEnvelopeSchema } } },
    (request, reply) => {
      const body = CreateTaskRequestSchema.parse(request.body);
      const task = requireServices(runtime).actions.createTask(
        {
          ...body,
          dueAt: Date.parse(body.dueAt),
        },
        createUserOperationContext({ requestId: request.id }),
      );
      autoSchedule(runtime, 'TASK_CREATED');
      return entityReply(reply, request, task, 201);
    },
  );
  app.patch(
    '/api/v1/tasks/:id',
    { schema: { body: UpdateTaskRequestSchema, response: { 200: TaskEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateTaskRequestSchema.parse(request.body);
      const { expectedVersion, ...patch } = body;
      const task = requireServices(runtime).actions.updateTaskWithContext(
        id,
        parseExpectedVersion(request, expectedVersion),
        patch,
        createUserOperationContext({ requestId: request.id }),
      );
      autoSchedule(runtime, 'TASK_UPDATED');
      return entityReply(reply, request, task);
    },
  );
  app.delete(
    '/api/v1/tasks/:id',
    { schema: { body: TaskTransitionRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = TaskTransitionRequestSchema.parse(request.body);
      requireServices(runtime).actions.softDelete(
        id,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      autoSchedule(runtime, 'TASK_DELETED');
      return reply.code(204).send();
    },
  );
  const transitions = {
    start: 'IN_PROGRESS',
    complete: 'COMPLETED',
    cancel: 'CANCELLED',
    reopen: 'TODO',
  } as const;
  for (const [action, status] of Object.entries(transitions)) {
    app.post(
      `/api/v1/tasks/:id/${action}`,
      { schema: { body: TaskTransitionRequestSchema, response: { 200: TaskEnvelopeSchema } } },
      (request, reply) => {
        const { id } = request.params as { id: string };
        const body = TaskTransitionRequestSchema.parse(request.body);
        const task = requireServices(runtime).actions.transitionTask(
          id,
          parseExpectedVersion(request, body.expectedVersion),
          status,
          createUserOperationContext({ requestId: request.id }),
        );
        autoSchedule(runtime, `TASK_${status}`);
        return entityReply(reply, request, task);
      },
    );
  }
  app.post(
    '/api/v1/tasks/:id/subtasks',
    {
      schema: {
        body: CreateTaskRequestSchema.omit({ parentTaskId: true }),
        response: { 201: TaskEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreateTaskRequestSchema.omit({ parentTaskId: true }).parse(request.body);
      const task = requireServices(runtime).actions.createTask(
        {
          ...body,
          parentTaskId: id,
          dueAt: Date.parse(body.dueAt),
        },
        createUserOperationContext({ requestId: request.id }),
      );
      autoSchedule(runtime, 'SUBTASK_CREATED');
      return entityReply(reply, request, task, 201);
    },
  );
  app.post(
    '/api/v1/tasks/:id/dependencies',
    { schema: { body: AddDependencyRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = AddDependencyRequestSchema.parse(request.body);
      requireServices(runtime).actions.addDependency(
        id,
        body.predecessorTaskId,
        createUserOperationContext({ requestId: request.id }),
        parseExpectedVersion(request, body.expectedVersion),
      );
      autoSchedule(runtime, 'TASK_DEPENDENCY_ADDED');
      return reply.code(204).send();
    },
  );
  app.get(
    '/api/v1/tasks/:id/dependencies',
    { schema: { response: { 200: TaskDependenciesEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      return envelope(request, requireServices(runtime).actions.listTaskDependencies(id));
    },
  );
  app.delete(
    '/api/v1/tasks/:id/dependencies',
    { schema: { body: AddDependencyRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = AddDependencyRequestSchema.parse(request.body);
      requireServices(runtime).actions.removeDependency(
        id,
        body.predecessorTaskId,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      autoSchedule(runtime, 'TASK_DEPENDENCY_REMOVED');
      return reply.code(204).send();
    },
  );

  app.get(
    '/api/v1/entities/:id/tags',
    { schema: { response: { 200: EntityTagsEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      return envelope(request, requireServices(runtime).actions.listEntityTags(id));
    },
  );
  app.post(
    '/api/v1/entities/:id/tags',
    { schema: { body: EntityTagLinkRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = EntityTagLinkRequestSchema.parse(request.body);
      requireServices(runtime).actions.addEntityTag(
        id,
        body.tagId,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );
  app.delete(
    '/api/v1/entities/:id/tags',
    { schema: { body: EntityTagLinkRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = EntityTagLinkRequestSchema.parse(request.body);
      requireServices(runtime).actions.removeEntityTag(
        id,
        body.tagId,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.code(204).send();
    },
  );

  app.get('/api/v1/events', { schema: { response: { 200: EventsEnvelopeSchema } } }, (request) => {
    const query = request.query as { from?: string; to?: string };
    return envelope(
      request,
      requireServices(runtime).actions.listEvents(
        query.from === undefined ? undefined : Date.parse(query.from),
        query.to === undefined ? undefined : Date.parse(query.to),
      ),
    );
  });
  app.get(
    '/api/v1/events/:id',
    { schema: { response: { 200: EventEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const event = requireServices(runtime).actions.getEvent(id);
      if (event === undefined) throw new Error('EVENT_NOT_FOUND');
      return entityReply(reply, request, event);
    },
  );
  app.post('/api/v1/events', { schema: { body: CreateEventRequestSchema } }, (request, reply) => {
    const body = CreateEventRequestSchema.parse(request.body);
    const event = requireServices(runtime).actions.createEvent(
      {
        ...body,
        startAt: Date.parse(body.startAt),
        endAt: Date.parse(body.endAt),
      },
      createUserOperationContext({ requestId: request.id }),
    );
    autoSchedule(runtime, 'EVENT_CREATED');
    return entityReply(reply, request, event, 201);
  });
  app.patch(
    '/api/v1/events/:id',
    { schema: { body: UpdateEventRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateEventRequestSchema.parse(request.body);
      const { expectedVersion, startAt, endAt, ...patch } = body;
      const event = requireServices(runtime).actions.updateEvent(
        id,
        parseExpectedVersion(request, expectedVersion),
        {
          ...patch,
          ...(startAt === undefined ? {} : { startAt }),
          ...(endAt === undefined ? {} : { endAt }),
        },
        createUserOperationContext({ requestId: request.id }),
      );
      autoSchedule(runtime, 'EVENT_UPDATED');
      return entityReply(reply, request, event);
    },
  );
  app.delete(
    '/api/v1/events/:id',
    { schema: { body: TaskTransitionRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = TaskTransitionRequestSchema.parse(request.body);
      requireServices(runtime).actions.softDelete(
        id,
        parseExpectedVersion(request, body.expectedVersion),
        createUserOperationContext({ requestId: request.id }),
      );
      autoSchedule(runtime, 'EVENT_DELETED');
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/events/conflicts:check',
    { schema: { body: EventConflictsRequestSchema, response: { 200: EventsEnvelopeSchema } } },
    (request) => {
      const body = EventConflictsRequestSchema.parse(request.body);
      return envelope(
        request,
        requireServices(runtime).actions.findEventConflicts(
          Date.parse(body.startAt),
          Date.parse(body.endAt),
          body.excludeId,
        ),
      );
    },
  );

  app.get(
    '/api/v1/routine-templates',
    { schema: { response: { 200: RoutineTemplatesEnvelopeSchema } } },
    (request) => envelope(request, requireServices(runtime).routines.listTemplates()),
  );
  app.post(
    '/api/v1/routine-templates',
    {
      schema: {
        body: CreateRoutineTemplateRequestSchema,
        response: { 201: RoutineTemplateEnvelopeSchema },
      },
    },
    (request, reply) => {
      const value = requireServices(runtime).routines.createTemplate(
        CreateRoutineTemplateRequestSchema.parse(request.body),
      );
      return entityReply(reply, request, value, 201);
    },
  );
  app.patch(
    '/api/v1/routine-templates/:id',
    {
      schema: {
        body: UpdateRoutineTemplateRequestSchema,
        response: { 200: RoutineTemplateEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateRoutineTemplateRequestSchema.parse(request.body);
      const { expectedVersion, ...patch } = body;
      parseExpectedVersion(request, expectedVersion);
      const value = requireServices(runtime).routines.updateTemplate(id, expectedVersion, patch);
      autoSchedule(runtime, 'ROUTINE_UPDATED');
      return entityReply(reply, request, value);
    },
  );
  app.post('/api/v1/routine-templates/:id/set-default', (request, reply) => {
    const { id } = request.params as { id: string };
    const value = requireServices(runtime).routines.setDefault(id);
    autoSchedule(runtime, 'ROUTINE_DEFAULT_CHANGED');
    return entityReply(reply, request, value);
  });
  app.put(
    '/api/v1/routine-overrides/:date',
    {
      schema: {
        body: RoutineOverrideRequestSchema,
        response: { 200: RoutineOverrideEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { date } = request.params as { date: string };
      const body = RoutineOverrideRequestSchema.parse(request.body);
      const value = requireServices(runtime).routines.setDateOverride(date, body);
      autoSchedule(runtime, 'ROUTINE_OVERRIDE_CHANGED');
      return reply.code(200).send(envelope(request, value));
    },
  );
  app.get(
    '/api/v1/routine-overrides/:date',
    { schema: { response: { 200: NullableRoutineOverrideEnvelopeSchema } } },
    (request) => {
      const { date } = request.params as { date: string };
      return envelope(request, requireServices(runtime).routines.getDateOverride(date));
    },
  );
  app.delete('/api/v1/routine-overrides/:date', (request, reply) => {
    const { date } = request.params as { date: string };
    requireServices(runtime).routines.removeDateOverride(date);
    autoSchedule(runtime, 'ROUTINE_OVERRIDE_CHANGED');
    return reply.code(204).send();
  });
  app.get(
    '/api/v1/holidays',
    { schema: { response: { 200: HolidaysEnvelopeSchema } } },
    (request) => {
      const query = request.query as { year?: string };
      const year = Number(query.year ?? new Date().getUTCFullYear());
      return envelope(request, requireServices(runtime).routines.listHolidays(year));
    },
  );
  app.put('/api/v1/holidays/:date', (request, reply) => {
    const { date } = request.params as { date: string };
    const body = request.body as { name?: unknown; dayType?: unknown };
    if (
      typeof body.name !== 'string' ||
      (body.dayType !== 'HOLIDAY' && body.dayType !== 'MAKEUP_WORKDAY')
    ) {
      throw new Error('INVALID_HOLIDAY');
    }
    requireServices(runtime).routines.upsertHoliday({
      localDate: date,
      name: body.name,
      dayType: body.dayType,
      source: 'USER_OVERRIDE',
    });
    return reply.code(204).send();
  });

  app.post(
    '/api/v1/recurrence-rules',
    {
      schema: {
        body: CreateRecurrenceRuleRequestSchema,
        response: { 201: RecurrenceRuleEnvelopeSchema },
      },
    },
    (request, reply) => {
      const value = requireServices(runtime).recurrences.createRule(
        CreateRecurrenceRuleRequestSchema.parse(request.body),
      );
      return entityReply(reply, request, value, 201);
    },
  );
  app.get(
    '/api/v1/recurrence-rules/by-target/:id',
    { schema: { response: { 200: NullableRecurrenceRuleEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      return envelope(request, requireServices(runtime).recurrences.getRuleByTarget(id) ?? null);
    },
  );
  app.get(
    '/api/v1/recurrence-rules/:id',
    { schema: { response: { 200: RecurrenceRuleEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const value = requireServices(runtime).recurrences.getRule(id);
      if (value === undefined) throw new Error('RECURRENCE_RULE_NOT_FOUND');
      return entityReply(reply, request, value);
    },
  );
  app.get(
    '/api/v1/recurrence-rules/:id/occurrences',
    { schema: { response: { 200: RecurrenceOccurrencesEnvelopeSchema } } },
    (request) => {
      const { id } = request.params as { id: string };
      return envelope(request, requireServices(runtime).recurrences.listOccurrences(id));
    },
  );
  app.post(
    '/api/v1/recurrence-rules/:id/modify',
    {
      schema: {
        body: ModifyRecurrenceRequestSchema,
        response: { 200: RecurrenceRuleEnvelopeSchema, 201: RecurrenceRuleEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const { expectedVersion, ...input } = ModifyRecurrenceRequestSchema.parse(request.body);
      const value = requireServices(runtime).recurrences.modify(
        id,
        parseExpectedVersion(request, expectedVersion),
        input,
      );
      return entityReply(reply, request, value, input.action === 'THIS_AND_FUTURE' ? 201 : 200);
    },
  );
  app.post(
    '/api/v1/recurrence-rules/:id/exceptions',
    { schema: { body: RecurrenceExceptionRequestSchema } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = RecurrenceExceptionRequestSchema.parse(request.body);
      requireServices(runtime).recurrences.addException(
        id,
        body.recurrenceKey,
        body.type,
        body.override,
      );
      return reply.code(204).send();
    },
  );
  app.post(
    '/api/v1/recurrence-rules/:id/split',
    {
      schema: {
        body: SplitRecurrenceRequestSchema,
        response: { 201: RecurrenceRuleEnvelopeSchema },
      },
    },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = SplitRecurrenceRequestSchema.parse(request.body);
      const value = requireServices(runtime).recurrences.splitRule(id, body.splitLocal, body.rrule);
      return entityReply(reply, request, value, 201);
    },
  );

  app.get(
    '/api/v1/schedules',
    { schema: { response: { 200: TimelineEnvelopeSchema } } },
    (request) => {
      const query = request.query as { from: string; to: string };
      return envelope(
        request,
        requireServices(runtime).schedules.listTimeline(
          Date.parse(query.from),
          Date.parse(query.to),
        ),
      );
    },
  );
  app.post(
    '/api/v1/schedules:reschedule',
    { schema: { body: RescheduleRequestSchema, response: { 200: ScheduleRunEnvelopeSchema } } },
    (request) => {
      const body = RescheduleRequestSchema.parse(request.body);
      const result = requireServices(runtime).schedules.reschedule(
        Date.parse(body.rangeStart),
        Date.parse(body.rangeEnd),
        body.reason,
      );
      runtime.refreshOverdueNextDue();
      return envelope(request, result);
    },
  );
  app.get(
    '/api/v1/schedules/warnings',
    { schema: { response: { 200: ScheduleWarningsEnvelopeSchema } } },
    (request) => envelope(request, requireServices(runtime).schedules.listWarnings()),
  );
  app.get(
    '/api/v1/schedules/runs/:id',
    { schema: { response: { 200: ScheduleRunDetailEnvelopeSchema } } },
    (request) =>
      envelope(
        request,
        requireServices(runtime).schedules.runDetail((request.params as { id: string }).id),
      ),
  );
  app.get(
    '/api/v1/tasks/:id/schedule-history',
    { schema: { response: { 200: TaskScheduleHistoryEnvelopeSchema } } },
    (request) =>
      envelope(
        request,
        requireServices(runtime).schedules.taskScheduleHistory(
          (request.params as { id: string }).id,
        ),
      ),
  );
  for (const [action, locked] of [
    ['lock', true],
    ['unlock', false],
  ] as const) {
    app.post(`/api/v1/schedules/blocks/:id/${action}`, (request, reply) => {
      const { id } = request.params as { id: string };
      requireServices(runtime).schedules.setBlockLocked(id, locked);
      return reply.code(204).send();
    });
  }

  app.get('/api/v1/events/stream', (request, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    reply.raw.write(
      `event: ready\ndata: ${JSON.stringify({ serverTime: runtime.clock.now().toISOString() })}\n\n`,
    );
    const timer = setInterval(() => {
      reply.raw.write(
        `event: heartbeat\ndata: ${JSON.stringify({ at: runtime.clock.now().toISOString() })}\n\n`,
      );
    }, 15_000);
    request.raw.once('close', () => {
      clearInterval(timer);
    });
    return reply.hijack();
  });
};
