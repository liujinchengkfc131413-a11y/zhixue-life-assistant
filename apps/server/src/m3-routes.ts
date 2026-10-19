import type { FastifyInstance, FastifyRequest } from 'fastify';

import { createUserOperationContext, type TaskRecord } from '@life-assistant/database';

import {
  CalendarEnvelopeSchema,
  FreeTimeEnvelopeSchema,
  GoalTreeEnvelopeSchema,
  KanbanEnvelopeSchema,
  PlanEnvelopeSchema,
  PlanningQuerySchema,
  PlanTimelineEnvelopeSchema,
  PressureEnvelopeSchema,
  SetProgressRequestSchema,
  TodayEnvelopeSchema,
  TodayPlanEnvelopeSchema,
  TodayTotalsEnvelopeSchema,
  TimelineEnvelopeSchema,
} from '@life-assistant/contracts';

import type { LocalRuntime } from './runtime-probe.js';

const envelope = <T>(request: FastifyRequest, data: T) => ({
  data,
  meta: { requestId: request.id },
});

const localDate = (timestamp: number): string => {
  const shifted = new Date(timestamp + 8 * 3_600_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
};

const parseVersion = (request: FastifyRequest, expected: number): number => {
  const header = request.headers['if-match'];
  if (typeof header !== 'string') throw new Error('PRECONDITION_REQUIRED');
  const value = Number(header.replace(/^W\//, '').replaceAll('"', ''));
  if (value !== expected) throw new Error('VERSION_CONFLICT');
  return value;
};

const requireRuntime = (runtime: LocalRuntime) => {
  if (
    runtime.today === undefined ||
    runtime.actions === undefined ||
    runtime.database === undefined
  ) {
    throw new Error('APP_NOT_INITIALIZED');
  }
  return { today: runtime.today, actions: runtime.actions, database: runtime.database };
};

const planningData = (
  runtime: LocalRuntime,
  rawQuery: unknown,
  options?: { taskScope?: 'none' | 'due-range' | 'linked' },
) => {
  const query = PlanningQuerySchema.parse(rawQuery);
  const { actions, database } = requireRuntime(runtime);
  const nowDate = localDate(runtime.clock.now().getTime());
  const weekEnd = localDate(Date.parse(`${nowDate}T00:00:00+08:00`) + 6 * 86_400_000);
  const from = query.range === 'TODAY' ? nowDate : query.range === 'WEEK' ? nowDate : query.from;
  const to = query.range === 'TODAY' ? nowDate : query.range === 'WEEK' ? weekEnd : query.to;
  const categoryRows = database.raw.prepare('SELECT id, parent_area FROM categories').all() as {
    id: string;
    parent_area: 'WORK' | 'LIFE';
  }[];
  const areaByCategory = new Map(categoryRows.map((row) => [row.id, row.parent_area]));
  const inArea = (categoryId: string) =>
    query.area === undefined || areaByCategory.get(categoryId) === query.area;
  const inRange = (start: string, end: string) =>
    (from === undefined || end >= from) && (to === undefined || start <= to);
  const goals = actions
    .listGoals()
    .filter(
      (goal) =>
        inArea(goal.categoryId) &&
        (query.range === 'SHORT_TERM' ? goal.horizon === 'SHORT_TERM' : true) &&
        (query.range === 'LONG_TERM' ? goal.horizon === 'LONG_TERM' : true) &&
        inRange(goal.startDate, goal.endDate ?? '9999-12-31'),
    );
  const goalIds = new Set(goals.map((goal) => goal.id));
  const plans = actions
    .listPlans()
    .filter((plan) => inArea(plan.categoryId) && inRange(plan.startDate, plan.endDate));
  const planIds = new Set(plans.map((plan) => plan.id));
  let tasks: ReturnType<typeof actions.listTasks> = [];
  const scope = options?.taskScope ?? 'none';
  if (scope === 'due-range') {
    const dueFromMs = from === undefined ? undefined : Date.parse(`${from}T00:00:00+08:00`);
    const dueToMs = to === undefined ? undefined : Date.parse(`${to}T00:00:00+08:00`) + 86_400_000;
    tasks = actions.listTasks({
      includeCompleted: true,
      ...(dueFromMs === undefined ? {} : { dueFromMs }),
      ...(dueToMs === undefined ? {} : { dueToMs }),
    });
    const filtered = tasks.filter((task) => inArea(task.categoryId));
    tasks = filtered;
  } else if (scope === 'linked') {
    tasks = actions.listTasks({ includeCompleted: true, linkedOnly: true });
  }
  return { goals, goalIds, plans, planIds, tasks };
};

export const registerM3Routes = (app: FastifyInstance, runtime: LocalRuntime): void => {
  app.get('/api/v1/today', { schema: { response: { 200: TodayEnvelopeSchema } } }, (request) => {
    const query = request.query as { date?: string };
    const date = query.date ?? localDate(runtime.clock.now().getTime());
    return envelope(request, requireRuntime(runtime).today.getToday(date));
  });
  app.get(
    '/api/v1/today/timeline',
    { schema: { response: { 200: TimelineEnvelopeSchema } } },
    (request) => {
      const query = request.query as { date?: string };
      const today = requireRuntime(runtime).today.getToday(
        query.date ?? localDate(runtime.clock.now().getTime()),
      );
      return envelope(request, today.blocks);
    },
  );
  app.get(
    '/api/v1/today/plan',
    { schema: { response: { 200: TodayPlanEnvelopeSchema } } },
    (request) => {
      const query = request.query as { date?: string; area?: 'WORK' | 'LIFE' };
      const today = requireRuntime(runtime).today.getToday(
        query.date ?? localDate(runtime.clock.now().getTime()),
      );
      return envelope(
        request,
        query.area === undefined
          ? today.plan
          : today.plan.filter((item) => item.area === query.area),
      );
    },
  );
  app.get(
    '/api/v1/today/free-time',
    { schema: { response: { 200: FreeTimeEnvelopeSchema } } },
    (request) => {
      const query = request.query as { date?: string };
      return envelope(
        request,
        requireRuntime(runtime).today.getToday(
          query.date ?? localDate(runtime.clock.now().getTime()),
        ).freeTime,
      );
    },
  );
  app.get(
    '/api/v1/today/totals',
    { schema: { response: { 200: TodayTotalsEnvelopeSchema } } },
    (request) => {
      const query = request.query as { date?: string };
      return envelope(
        request,
        requireRuntime(runtime).today.getToday(
          query.date ?? localDate(runtime.clock.now().getTime()),
        ).totals,
      );
    },
  );
  app.get(
    '/api/v1/today/pressure',
    { schema: { response: { 200: PressureEnvelopeSchema } } },
    (request) => {
      const query = request.query as { date?: string };
      return envelope(
        request,
        requireRuntime(runtime).today.getToday(
          query.date ?? localDate(runtime.clock.now().getTime()),
        ).pressure,
      );
    },
  );

  app.post(
    '/api/v1/plans/:id/set-progress',
    { schema: { body: SetProgressRequestSchema, response: { 200: PlanEnvelopeSchema } } },
    (request, reply) => {
      const { id } = request.params as { id: string };
      const body = SetProgressRequestSchema.parse(request.body);
      const plan = requireRuntime(runtime).actions.setPlanProgress(
        id,
        parseVersion(request, body.expectedVersion),
        body.value,
        createUserOperationContext({ requestId: request.id }),
      );
      return reply.header('etag', `"${String(plan.version)}"`).send(envelope(request, plan));
    },
  );

  app.get(
    '/api/v1/plans/views/kanban',
    { schema: { response: { 200: KanbanEnvelopeSchema } } },
    (request) => {
      const { plans } = planningData(runtime, request.query);
      const statuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
      return envelope(
        request,
        statuses.map((status) => ({
          status,
          plans: plans.filter((plan) => plan.status === status),
        })),
      );
    },
  );
  app.get(
    '/api/v1/plans/views/calendar',
    { schema: { response: { 200: CalendarEnvelopeSchema } } },
    (request) => {
      const { plans, tasks } = planningData(runtime, request.query, { taskScope: 'due-range' });
      const dates = new Set([
        ...plans.flatMap((plan) => [plan.startDate, plan.endDate]),
        ...tasks.map((task) => localDate(Date.parse(task.dueAt))),
      ]);
      const tasksByDate = new Map<string, TaskRecord[]>();
      for (const task of tasks) {
        const date = localDate(Date.parse(task.dueAt));
        const list = tasksByDate.get(date);
        if (list === undefined) tasksByDate.set(date, [task]);
        else list.push(task);
      }
      return envelope(
        request,
        [...dates].toSorted().map((date) => ({
          date,
          plans: plans.filter((plan) => plan.startDate === date || plan.endDate === date),
          tasks: tasksByDate.get(date) ?? [],
        })),
      );
    },
  );
  app.get(
    '/api/v1/plans/views/timeline',
    { schema: { response: { 200: PlanTimelineEnvelopeSchema } } },
    (request) => {
      const { goals, plans } = planningData(runtime, request.query);
      const goalById = new Map(goals.map((goal) => [goal.id, goal]));
      return envelope(
        request,
        plans.map((plan) => ({
          goal: plan.goalId === null ? null : (goalById.get(plan.goalId) ?? null),
          plan,
        })),
      );
    },
  );
  app.get(
    '/api/v1/plans/views/goal-tree',
    { schema: { response: { 200: GoalTreeEnvelopeSchema } } },
    (request) => {
      const { goals, plans, tasks } = planningData(runtime, request.query, {
        taskScope: 'linked',
      });
      const tasksByPlan = new Map<string, TaskRecord[]>();
      const directTasks: TaskRecord[] = [];
      for (const task of tasks) {
        if (task.planId !== null) {
          const list = tasksByPlan.get(task.planId);
          if (list === undefined) tasksByPlan.set(task.planId, [task]);
          else list.push(task);
        } else {
          directTasks.push(task);
        }
      }
      return envelope(
        request,
        goals.map((goal) => ({
          goal,
          plans: plans
            .filter((plan) => plan.goalId === goal.id)
            .map((plan) => ({
              plan,
              tasks: tasksByPlan.get(plan.id) ?? [],
            })),
          directTasks: directTasks.filter((task) => task.goalId === goal.id),
        })),
      );
    },
  );
};
