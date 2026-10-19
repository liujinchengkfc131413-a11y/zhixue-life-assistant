import { z } from 'zod';

import { RequestMetaSchema, TagSchema } from './m1.js';

export const PrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const GoalStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']);
export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const AreaSchema = z.enum(['WORK', 'LIFE']);

const EntityFieldsSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const GoalSchema = EntityFieldsSchema.extend({
  categoryId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  goalType: z.enum(['OUTCOME', 'HABIT']),
  status: GoalStatusSchema,
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
  horizon: z.enum(['SHORT_TERM', 'LONG_TERM']),
  autoProgress: z.number().min(0).max(100),
  manualProgress: z.number().min(0).max(100).nullable(),
  progressMode: z.enum(['AUTO', 'MANUAL_OVERRIDE']),
  displayProgress: z.number().min(0).max(100),
});
export const CreateGoalRequestSchema = z.object({
  categoryId: z.string(),
  title: z.string().trim().min(1).max(200),
  description: z.string().optional(),
  goalType: z.enum(['OUTCOME', 'HABIT']).default('OUTCOME'),
  status: GoalStatusSchema.optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable().optional(),
});
export const UpdateGoalRequestSchema = CreateGoalRequestSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const SetProgressRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  value: z.number().min(0).max(100).nullable(),
});
export const GoalEnvelopeSchema = z.object({ data: GoalSchema, meta: RequestMetaSchema });
export const GoalsEnvelopeSchema = z.object({ data: z.array(GoalSchema), meta: RequestMetaSchema });

export const GoalMetricTypeSchema = z.enum([
  'NUMBER',
  'COUNT',
  'DURATION',
  'PERCENTAGE',
  'BOOLEAN',
]);
export const GoalMetricDirectionSchema = z.enum(['INCREASE', 'DECREASE', 'MAINTAIN']);
export const GoalMetricSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  name: z.string(),
  metricType: GoalMetricTypeSchema,
  unit: z.string().nullable(),
  startValue: z.number().nullable(),
  targetValue: z.number(),
  direction: GoalMetricDirectionSchema,
  weight: z.number().positive(),
  latestValue: z.number().nullable(),
  latestRecordedAt: z.iso.datetime().nullable(),
  progressPercent: z.number().min(0).max(100),
});
export const GoalProgressEntrySchema = z.object({
  id: z.string(),
  goalId: z.string(),
  metricId: z.string().nullable(),
  value: z.number(),
  recordedAt: z.iso.datetime(),
  source: z.enum(['USER', 'TASKS', 'HEALTH', 'SYSTEM', 'AI']),
  sourceEntityId: z.string().nullable(),
  note: z.string().nullable(),
});
export const GoalMetricsStateSchema = z.object({
  goalId: z.string(),
  goalVersion: z.number().int().positive(),
  autoProgress: z.number().min(0).max(100),
  displayProgress: z.number().min(0).max(100),
  progressMode: z.enum(['AUTO', 'MANUAL_OVERRIDE']),
  metrics: z.array(GoalMetricSchema),
  entries: z.array(GoalProgressEntrySchema),
});
export const GoalMetricsStateEnvelopeSchema = z.object({
  data: GoalMetricsStateSchema,
  meta: RequestMetaSchema,
});
export const CreateGoalMetricRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  metricType: GoalMetricTypeSchema,
  unit: z.string().trim().max(50).nullable().optional(),
  startValue: z.number().nullable().optional(),
  targetValue: z.number(),
  direction: GoalMetricDirectionSchema,
  weight: z.number().positive().default(1),
});
export const UpdateGoalMetricRequestSchema = CreateGoalMetricRequestSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
});
export const CreateGoalProgressEntryRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  metricId: z.string(),
  value: z.number(),
  recordedAt: z.iso.datetime().optional(),
  note: z.string().max(500).optional(),
});

export const PlanSchema = EntityFieldsSchema.extend({
  goalId: z.string().nullable(),
  categoryId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: GoalStatusSchema,
  priority: PrioritySchema,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  autoProgress: z.number().min(0).max(100),
  manualProgress: z.number().min(0).max(100).nullable(),
  progressMode: z.enum(['AUTO', 'MANUAL_OVERRIDE']),
  displayProgress: z.number().min(0).max(100),
});
export const CreatePlanRequestSchema = z.object({
  goalId: z.string().nullable().optional(),
  categoryId: z.string(),
  title: z.string().trim().min(1).max(200),
  description: z.string().optional(),
  priority: PrioritySchema.default('NORMAL'),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});
export const UpdatePlanRequestSchema = CreatePlanRequestSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
  status: GoalStatusSchema.optional(),
});
export const PlanEnvelopeSchema = z.object({ data: PlanSchema, meta: RequestMetaSchema });
export const PlansEnvelopeSchema = z.object({ data: z.array(PlanSchema), meta: RequestMetaSchema });

export const PlanMilestoneStatusSchema = z.enum(['PENDING', 'AT_RISK', 'ACHIEVED', 'MISSED']);
export const PlanMilestoneSchema = EntityFieldsSchema.extend({
  planId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  dueAt: z.iso.datetime(),
  status: PlanMilestoneStatusSchema,
  achievedAt: z.iso.datetime().nullable(),
  linkedEntityIds: z.array(z.string()),
});
export const CreatePlanMilestoneRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().optional(),
  dueAt: z.iso.datetime(),
  linkedEntityIds: z.array(z.string()).default([]),
});
export const UpdatePlanMilestoneRequestSchema = CreatePlanMilestoneRequestSchema.partial().extend({
  expectedVersion: z.number().int().positive(),
  status: PlanMilestoneStatusSchema.optional(),
});
export const PlanMilestoneEnvelopeSchema = z.object({
  data: PlanMilestoneSchema,
  meta: RequestMetaSchema,
});
export const PlanMilestonesEnvelopeSchema = z.object({
  data: z.array(PlanMilestoneSchema),
  meta: RequestMetaSchema,
});

export const TaskSchema = EntityFieldsSchema.extend({
  categoryId: z.string(),
  planId: z.string().nullable(),
  goalId: z.string().nullable(),
  parentTaskId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  priority: PrioritySchema,
  dueAt: z.iso.datetime(),
  estimatedMinutes: z.number().int().positive(),
  isFlexible: z.boolean(),
  isSplittable: z.boolean(),
  preferredArea: AreaSchema,
  completedAt: z.iso.datetime().nullable(),
});
export const CreateTaskRequestSchema = z.object({
  categoryId: z.string(),
  planId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().optional(),
  priority: PrioritySchema.default('NORMAL'),
  dueAt: z.iso.datetime(),
  estimatedMinutes: z.number().int().positive().multipleOf(15),
  isFlexible: z.boolean().default(true),
  isSplittable: z.boolean().default(false),
  preferredArea: AreaSchema,
});
export const UpdateTaskRequestSchema = CreateTaskRequestSchema.omit({
  categoryId: true,
  planId: true,
  goalId: true,
  parentTaskId: true,
})
  .partial()
  .extend({ expectedVersion: z.number().int().positive() });
export const TaskTransitionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
export const AddDependencyRequestSchema = z.object({
  predecessorTaskId: z.string(),
  expectedVersion: z.number().int().positive(),
});
export const TaskDependenciesSchema = z.object({
  taskId: z.string(),
  predecessorTaskIds: z.array(z.string()),
  successorTaskIds: z.array(z.string()),
});
export const TaskDependenciesEnvelopeSchema = z.object({
  data: TaskDependenciesSchema,
  meta: RequestMetaSchema,
});
export const EntityTagLinkRequestSchema = z.object({
  tagId: z.string(),
  expectedVersion: z.number().int().positive(),
});
export const EntityTagsEnvelopeSchema = z.object({
  data: z.array(TagSchema),
  meta: RequestMetaSchema,
});
export const TaskEnvelopeSchema = z.object({ data: TaskSchema, meta: RequestMetaSchema });
export const TasksEnvelopeSchema = z.object({ data: z.array(TaskSchema), meta: RequestMetaSchema });

export const EventSchema = EntityFieldsSchema.extend({
  categoryId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  timeZone: z.string(),
  eventType: z.enum(['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST']),
  priority: PrioritySchema,
  isImmovable: z.boolean(),
  allowOverlap: z.boolean(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
});
export const CreateEventRequestSchema = z.object({
  categoryId: z.string(),
  title: z.string().trim().min(1).max(300),
  description: z.string().optional(),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  eventType: z.enum(['GENERAL', 'MEETING', 'MEDICAL', 'TRAVEL', 'REST']).default('GENERAL'),
  priority: PrioritySchema.default('NORMAL'),
  isImmovable: z.boolean().optional(),
  allowOverlap: z.boolean().optional(),
});
export const UpdateEventRequestSchema = CreateEventRequestSchema.omit({ categoryId: true })
  .partial()
  .extend({
    expectedVersion: z.number().int().positive(),
    status: EventSchema.shape.status.optional(),
  });
export const EventEnvelopeSchema = z.object({ data: EventSchema, meta: RequestMetaSchema });
export const EventsEnvelopeSchema = z.object({
  data: z.array(EventSchema),
  meta: RequestMetaSchema,
});
export const EventConflictsRequestSchema = z.object({
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  excludeId: z.string().optional(),
});

export const RoutineSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  segmentType: z.enum(['SLEEP', 'WORK', 'LIFE', 'REST']),
  startTime: z.string(),
  endTime: z.string(),
  isImmovable: z.boolean(),
  sortOrder: z.number().int(),
});
const RoutineSegmentInputSchema = RoutineSegmentSchema.omit({ id: true, sortOrder: true });
export const RoutineTemplateSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  name: z.string(),
  templateType: z.enum(['WORKDAY', 'WEEKEND', 'HOLIDAY', 'CUSTOM']),
  isDefault: z.boolean(),
  timeZone: z.string(),
  segments: z.array(RoutineSegmentSchema),
});
export const CreateRoutineTemplateRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  templateType: z.enum(['WORKDAY', 'WEEKEND', 'HOLIDAY', 'CUSTOM']),
  isDefault: z.boolean().optional(),
  segments: z.array(RoutineSegmentInputSchema).min(1),
});
export const UpdateRoutineTemplateRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).optional(),
  segments: z.array(RoutineSegmentInputSchema).min(1).optional(),
});
export const RoutineTemplatesEnvelopeSchema = z.object({
  data: z.array(RoutineTemplateSchema),
  meta: RequestMetaSchema,
});
export const RoutineTemplateEnvelopeSchema = z.object({
  data: RoutineTemplateSchema,
  meta: RequestMetaSchema,
});
export const RoutineOverrideSchema = z.object({
  id: z.string(),
  localDate: z.iso.date(),
  templateId: z.string().nullable(),
  segments: z.array(RoutineSegmentInputSchema).nullable(),
  note: z.string().nullable(),
});
export const RoutineOverrideRequestSchema = z.union([
  z.object({
    templateId: z.string(),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    segments: z.array(RoutineSegmentInputSchema).min(1),
    note: z.string().trim().max(500).optional(),
  }),
]);
export const RoutineOverrideEnvelopeSchema = z.object({
  data: RoutineOverrideSchema,
  meta: RequestMetaSchema,
});
export const NullableRoutineOverrideEnvelopeSchema = z.object({
  data: RoutineOverrideSchema.nullable(),
  meta: RequestMetaSchema,
});
export const HolidaySchema = z.object({
  localDate: z.iso.date(),
  name: z.string(),
  dayType: z.enum(['HOLIDAY', 'MAKEUP_WORKDAY']),
  source: z.enum(['SYSTEM_UPDATE', 'USER_OVERRIDE']),
});
export const HolidaysEnvelopeSchema = z.object({
  data: z.array(HolidaySchema),
  meta: RequestMetaSchema,
});

export const RecurrenceRuleSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  targetType: z.enum(['TASK_TEMPLATE', 'EVENT_TEMPLATE']),
  targetEntityId: z.string(),
  rrule: z.string(),
  dtstartLocal: z.string(),
  timeZone: z.string(),
  untilAt: z.iso.datetime().nullable(),
  countLimit: z.number().int().nullable(),
  generationHorizonDays: z.number().int(),
  isActive: z.boolean(),
});
export const CreateRecurrenceRuleRequestSchema = z.object({
  targetType: z.enum(['TASK_TEMPLATE', 'EVENT_TEMPLATE']),
  targetEntityId: z.string(),
  rrule: z.string().min(1),
  dtstartLocal: z.string().min(16),
  generationHorizonDays: z.number().int().min(1).max(366).optional(),
});
export const RecurrenceRuleEnvelopeSchema = z.object({
  data: RecurrenceRuleSchema,
  meta: RequestMetaSchema,
});
export const NullableRecurrenceRuleEnvelopeSchema = z.object({
  data: RecurrenceRuleSchema.nullable(),
  meta: RequestMetaSchema,
});
export const RecurrenceOccurrenceSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  recurrenceKey: z.string(),
  scheduledAt: z.iso.datetime(),
  generatedEntityId: z.string().nullable(),
  status: z.enum(['GENERATED', 'SKIPPED', 'CANCELLED']),
});
export const RecurrenceOccurrencesEnvelopeSchema = z.object({
  data: z.array(RecurrenceOccurrenceSchema),
  meta: RequestMetaSchema,
});
export const RecurrenceExceptionRequestSchema = z.object({
  recurrenceKey: z.string(),
  type: z.enum(['SKIP', 'OVERRIDE']),
  override: z.record(z.string(), z.unknown()).optional(),
});
export const SplitRecurrenceRequestSchema = z.object({ splitLocal: z.string(), rrule: z.string() });
export const ModifyRecurrenceRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    action: z.enum([
      'ONLY_THIS',
      'THIS_AND_FUTURE',
      'ENTIRE_SERIES',
      'SKIP_ONCE',
      'END_RECURRENCE',
    ]),
    recurrenceKey: z.string().min(16),
    rrule: z.string().min(1).optional(),
    override: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.action === 'THIS_AND_FUTURE' || value.action === 'ENTIRE_SERIES') &&
      value.rrule === undefined
    ) {
      context.addIssue({ code: 'custom', path: ['rrule'], message: '该操作需要重复规则。' });
    }
  });

export const TimelineBlockSchema = z.object({
  id: z.string(),
  targetEntityId: z.string().nullable(),
  title: z.string(),
  blockType: z.enum(['TASK', 'EVENT', 'SLEEP', 'REST']),
  area: z.enum(['WORK', 'LIFE', 'SLEEP']),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
  source: z.enum(['MANUAL', 'RULE_ENGINE', 'ROUTINE']),
  isLocked: z.boolean(),
  crossAreaWarning: z.boolean(),
});
export const TimelineEnvelopeSchema = z.object({
  data: z.array(TimelineBlockSchema),
  meta: RequestMetaSchema,
});
export const RescheduleRequestSchema = z.object({
  rangeStart: z.iso.datetime(),
  rangeEnd: z.iso.datetime(),
  reason: z.string().default('MANUAL'),
});
export const ScheduleRunSchema = z.object({
  id: z.string(),
  status: z.enum(['APPLIED', 'NO_CHANGE']),
  createdBlocks: z.number().int(),
  preservedBlocks: z.number().int(),
  warnings: z.array(
    z.object({
      entityId: z.string(),
      warningType: z.enum(['UNSCHEDULED', 'CROSS_AREA', 'DEPENDENCY_BLOCKED', 'DEADLINE_RISK']),
      severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
      message: z.string(),
    }),
  ),
  inputHash: z.string(),
});
export const ScheduleRunEnvelopeSchema = z.object({
  data: ScheduleRunSchema,
  meta: RequestMetaSchema,
});
export const ScheduleWarningsEnvelopeSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      entityId: z.string().nullable(),
      warningType: z.string(),
      severity: z.string(),
      message: z.string(),
    }),
  ),
  meta: RequestMetaSchema,
});

export const ScheduleHistoryTimeSpanSchema = z.object({
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime(),
});
export const TaskScheduleHistoryEntrySchema = z.object({
  runId: z.string().nullable(),
  trigger: z.string(),
  occurredAt: z.iso.datetime(),
  kind: z.enum(['RELEASED', 'SCHEDULED', 'RESCHEDULED', 'UNSCHEDULED']),
  reason: z.string().nullable(),
  previousBlocks: z.array(ScheduleHistoryTimeSpanSchema),
  newBlocks: z.array(ScheduleHistoryTimeSpanSchema),
  warnings: z.array(
    z.object({
      type: z.string(),
      severity: z.string(),
      message: z.string(),
    }),
  ),
});
export const TaskScheduleHistoryEnvelopeSchema = z.object({
  data: z.object({
    taskId: z.string(),
    entries: z.array(TaskScheduleHistoryEntrySchema),
  }),
  meta: RequestMetaSchema,
});
export const ScheduleRunDetailSchema = z.object({
  id: z.string(),
  rangeStart: z.iso.datetime(),
  rangeEnd: z.iso.datetime(),
  trigger: z.string(),
  status: z.string(),
  ruleVersion: z.string(),
  createdAt: z.iso.datetime(),
  summary: z.object({
    createdBlocks: z.number().int(),
    releasedBlocks: z.array(
      z.object({ taskId: z.string(), startAt: z.number().int(), endAt: z.number().int() }),
    ),
    affectedTaskIds: z.array(z.string()),
    rescheduledTaskIds: z.array(z.string()),
    unscheduledTaskIds: z.array(z.string()),
  }),
  createdBlocks: z.array(
    z.object({
      id: z.string(),
      taskId: z.string(),
      startAt: z.iso.datetime(),
      endAt: z.iso.datetime(),
      reasonCode: z.string().nullable(),
      outcome: z.string().nullable(),
      released: z.boolean(),
      previousBlocks: z.array(ScheduleHistoryTimeSpanSchema),
    }),
  ),
  releasedBlocks: z.array(
    z.object({
      taskId: z.string(),
      startAt: z.iso.datetime(),
      endAt: z.iso.datetime(),
    }),
  ),
  warnings: z.array(
    z.object({
      entityId: z.string().nullable(),
      warningType: z.string(),
      severity: z.string(),
      message: z.string(),
    }),
  ),
});
export const ScheduleRunDetailEnvelopeSchema = z.object({
  data: ScheduleRunDetailSchema,
  meta: RequestMetaSchema,
});
