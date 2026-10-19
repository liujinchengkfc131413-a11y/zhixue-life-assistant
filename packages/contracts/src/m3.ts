import { z } from 'zod';

import { RequestMetaSchema } from './m1.js';
import { GoalSchema, PlanSchema, TaskSchema, TimelineBlockSchema } from './m2.js';

export const PressureLevelSchema = z.enum(['RELAXED', 'COMFORTABLE', 'ELEVATED', 'HIGH_PRESSURE']);

export const PressureFactorSchema = z.object({
  code: z.string(),
  points: z.number().int().min(0),
  message: z.string(),
});

export const PressureSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: PressureLevelSchema,
  algorithmVersion: z.literal('pressure-v1'),
  factors: z.array(PressureFactorSchema),
});

export const TodayTotalsSchema = z.object({
  sleepMinutes: z.number().int().min(0),
  workMinutes: z.number().int().min(0),
  lifeMinutes: z.number().int().min(0),
  freeMinutes: z.number().int().min(0),
});

export const TodayPlanItemSchema = z.object({
  id: z.string(),
  entityId: z.string().nullable(),
  title: z.string(),
  kind: z.enum(['TASK', 'EVENT']),
  area: z.enum(['WORK', 'LIFE']),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
});

export const FreeTimeSegmentSchema = z.object({
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  minutes: z.number().int().positive(),
});

export const TodaySchema = z.object({
  date: z.iso.date(),
  timeZone: z.literal('Asia/Shanghai'),
  serverNow: z.iso.datetime(),
  timelineVersion: z.number().int().nonnegative(),
  blocks: z.array(TimelineBlockSchema),
  plan: z.array(TodayPlanItemSchema),
  freeTime: z.array(FreeTimeSegmentSchema),
  totals: TodayTotalsSchema,
  pressure: PressureSchema,
  notifications: z.array(z.unknown()),
  suggestions: z.array(z.unknown()),
});
export const TodayEnvelopeSchema = z.object({ data: TodaySchema, meta: RequestMetaSchema });
export const TodayPlanEnvelopeSchema = z.object({
  data: z.array(TodayPlanItemSchema),
  meta: RequestMetaSchema,
});
export const TodayTotalsEnvelopeSchema = z.object({
  data: TodayTotalsSchema,
  meta: RequestMetaSchema,
});
export const FreeTimeEnvelopeSchema = z.object({
  data: z.array(FreeTimeSegmentSchema),
  meta: RequestMetaSchema,
});
export const PressureEnvelopeSchema = z.object({ data: PressureSchema, meta: RequestMetaSchema });

export const PlanningRangeSchema = z.enum(['TODAY', 'WEEK', 'SHORT_TERM', 'LONG_TERM', 'CUSTOM']);
export const PlanningQuerySchema = z.object({
  range: PlanningRangeSchema.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  area: z.enum(['WORK', 'LIFE']).optional(),
});

export const KanbanColumnSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']),
  plans: z.array(PlanSchema),
});
export const KanbanEnvelopeSchema = z.object({
  data: z.array(KanbanColumnSchema),
  meta: RequestMetaSchema,
});

export const CalendarDaySchema = z.object({
  date: z.iso.date(),
  plans: z.array(PlanSchema),
  tasks: z.array(TaskSchema),
});
export const CalendarEnvelopeSchema = z.object({
  data: z.array(CalendarDaySchema),
  meta: RequestMetaSchema,
});

export const TimelinePlanSchema = z.object({
  goal: GoalSchema.nullable(),
  plan: PlanSchema,
});
export const PlanTimelineEnvelopeSchema = z.object({
  data: z.array(TimelinePlanSchema),
  meta: RequestMetaSchema,
});

export const GoalTreeNodeSchema = z.object({
  goal: GoalSchema,
  plans: z.array(z.object({ plan: PlanSchema, tasks: z.array(TaskSchema) })),
  directTasks: z.array(TaskSchema),
});
export const GoalTreeEnvelopeSchema = z.object({
  data: z.array(GoalTreeNodeSchema),
  meta: RequestMetaSchema,
});
