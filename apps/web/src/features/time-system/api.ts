import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { apiClient } from '../../shared/api/client.js';

export const tasksKey = ['time-system', 'tasks'] as const;
export const eventsKey = ['time-system', 'events'] as const;
export const timelineKey = ['time-system', 'timeline'] as const;
export const goalsKey = ['time-system', 'goals'] as const;
export const plansKey = ['time-system', 'plans'] as const;
export const routinesKey = ['time-system', 'routines'] as const;
export const routineOverrideKey = (date: string) =>
  ['time-system', 'routine-override', date] as const;
export const warningsKey = ['time-system', 'warnings'] as const;
export const todayKey = ['time-system', 'today'] as const;
export const planningViewsKey = ['time-system', 'planning-views'] as const;
export const scheduleHistoryKey = ['time-system', 'schedule-history'] as const;
export const taskDependenciesKey = ['time-system', 'task-dependencies'] as const;
export const entityTagsKey = ['time-system', 'entity-tags'] as const;
export const planMilestonesKey = ['time-system', 'plan-milestones'] as const;
export const goalMetricsKey = ['time-system', 'goal-metrics'] as const;
export const recurrenceRuleKey = (targetEntityId: string) =>
  ['time-system', 'recurrence-rule', targetEntityId] as const;
export const recurrenceOccurrencesKey = (ruleId: string) =>
  ['time-system', 'recurrence-occurrences', ruleId] as const;

const requireData = <T>(data: T | undefined): T => {
  if (data === undefined) throw new Error('本地服务没有返回数据。');
  return data;
};

export const shanghaiDayRange = (
  date = new Date(),
): { from: string; to: string; localDate: string } => {
  const shifted = new Date(date.getTime() + 8 * 3_600_000);
  const localDate = `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
  const from = new Date(Date.parse(`${localDate}T00:00:00+08:00`)).toISOString();
  const to = new Date(Date.parse(`${localDate}T00:00:00+08:00`) + 86_400_000).toISOString();
  return { from, to, localDate };
};

export const useTasks = (includeCompleted = false, ids?: readonly string[]) =>
  useQuery({
    queryKey: [...tasksKey, includeCompleted, ids],
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/tasks', {
            params: {
              query: {
                includeCompleted,
                ...(ids !== undefined && ids.length > 0 ? { ids: ids.join(',') } : {}),
              },
            },
          })
        ).data,
      ).data,
  });

export const useEvents = (from: string, to: string) =>
  useQuery({
    queryKey: [...eventsKey, from, to],
    queryFn: async () =>
      requireData((await apiClient.GET('/api/v1/events', { params: { query: { from, to } } })).data)
        .data,
  });

export const useEvent = (id: string | undefined) =>
  useQuery({
    queryKey: [...eventsKey, 'detail', id],
    enabled: id !== undefined,
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/events/{id}', {
            params: { path: { id: id ?? '' } },
          })
        ).data,
      ).data,
  });

export const useTimeline = (from: string, to: string) =>
  useQuery({
    queryKey: [...timelineKey, from, to],
    queryFn: async () =>
      requireData(
        (await apiClient.GET('/api/v1/schedules', { params: { query: { from, to } } })).data,
      ).data,
  });

export type EventItem = NonNullable<ReturnType<typeof useEvents>['data']>[number];

export const useToday = (date: string) =>
  useQuery({
    queryKey: [...todayKey, date],
    queryFn: async () =>
      requireData((await apiClient.GET('/api/v1/today', { params: { query: { date } } })).data)
        .data,
    refetchInterval: 60_000,
  });

export type TodayData = NonNullable<ReturnType<typeof useToday>['data']>;
export type TodayPlanItem = NonNullable<TodayData['plan']>[number];
export type TodayBlock = NonNullable<TodayData['blocks']>[number];
export type TaskItem = NonNullable<ReturnType<typeof useTasks>['data']>[number];
export type WarningItem = NonNullable<ReturnType<typeof useScheduleWarnings>['data']>[number];

export const useScheduleWarnings = () =>
  useQuery({
    queryKey: warningsKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/schedules/warnings')).data).data,
  });

export interface ScheduleHistoryTimeSpan {
  startAt: string;
  endAt: string;
}
export interface TaskScheduleHistoryEntry {
  runId: string | null;
  trigger: string;
  occurredAt: string;
  kind: 'RELEASED' | 'SCHEDULED' | 'RESCHEDULED' | 'UNSCHEDULED';
  reason: string | null;
  previousBlocks: readonly ScheduleHistoryTimeSpan[];
  newBlocks: readonly ScheduleHistoryTimeSpan[];
  warnings: readonly { type: string; severity: string; message: string }[];
}
export interface TaskScheduleHistory {
  taskId: string;
  entries: readonly TaskScheduleHistoryEntry[];
}

export const useTaskScheduleHistory = (taskId: string) =>
  useQuery({
    queryKey: [...scheduleHistoryKey, taskId],
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/tasks/{id}/schedule-history', {
            params: { path: { id: taskId } },
          })
        ).data,
      ).data,
  });

export const useTaskDependencies = (taskId: string) =>
  useQuery({
    queryKey: [...taskDependenciesKey, taskId],
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/tasks/{id}/dependencies', {
            params: { path: { id: taskId } },
          })
        ).data,
      ).data,
  });

export const useEntityTags = (entityId: string) =>
  useQuery({
    queryKey: [...entityTagsKey, entityId],
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/entities/{id}/tags', {
            params: { path: { id: entityId } },
          })
        ).data,
      ).data,
  });

export const invalidateTimeSystemQueries = async (queryClient: QueryClient): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: tasksKey }),
    queryClient.invalidateQueries({ queryKey: eventsKey }),
    queryClient.invalidateQueries({ queryKey: timelineKey }),
    queryClient.invalidateQueries({ queryKey: warningsKey }),
    queryClient.invalidateQueries({ queryKey: goalsKey }),
    queryClient.invalidateQueries({ queryKey: plansKey }),
    queryClient.invalidateQueries({ queryKey: todayKey }),
    queryClient.invalidateQueries({ queryKey: planningViewsKey }),
  ]);
};

const useInvalidateTimeSystem = () => {
  const queryClient = useQueryClient();
  return async () => invalidateTimeSystemQueries(queryClient);
};

export const useCreateTask = () => {
  const invalidate = useInvalidateTimeSystem();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      planId?: string | null;
      goalId?: string | null;
      title: string;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      dueAt: string;
      estimatedMinutes: number;
      isFlexible: boolean;
      isSplittable: boolean;
      preferredArea: 'WORK' | 'LIFE';
    }) => requireData((await apiClient.POST('/api/v1/tasks', { body: input })).data).data,
    onSuccess: invalidate,
  });
};

export const useCreateSubtask = (parentTaskId: string) => {
  const invalidate = useInvalidateTimeSystem();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      goalId?: string | null;
      title: string;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      dueAt: string;
      estimatedMinutes: number;
      isFlexible: boolean;
      isSplittable: boolean;
      preferredArea: 'WORK' | 'LIFE';
    }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/tasks/{id}/subtasks', {
            params: { path: { id: parentTaskId } },
            body: input,
          })
        ).data,
      ).data,
    onSuccess: invalidate,
  });
};

export const useCompleteTask = () => {
  const invalidate = useInvalidateTimeSystem();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/tasks/{id}/complete', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: { expectedVersion: input.version },
          })
        ).data,
      ).data,
    onSuccess: invalidate,
  });
};

export const useUpdateTask = () => {
  const invalidate = useInvalidateTimeSystem();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      dueAt: string;
      estimatedMinutes: number;
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/tasks/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              title: input.title,
              priority: input.priority,
              dueAt: input.dueAt,
              estimatedMinutes: input.estimatedMinutes,
            },
          })
        ).data,
      ).data,
    onSuccess: invalidate,
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) => {
      const response = await apiClient.DELETE('/api/v1/tasks/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      });
      if (response.error !== undefined) throw new Error('任务删除失败。');
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['recycle-bin'] }),
      ]);
    },
  });
};

export const useAddTaskDependency = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number; predecessorTaskId: string }) => {
      const response = await apiClient.POST('/api/v1/tasks/{id}/dependencies', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: {
          predecessorTaskId: input.predecessorTaskId,
          expectedVersion: input.version,
        },
      });
      if (response.error !== undefined) throw new Error('任务依赖添加失败。');
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: [...taskDependenciesKey, input.id] }),
      ]);
    },
  });
};

export const useRemoveTaskDependency = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number; predecessorTaskId: string }) => {
      const response = await apiClient.DELETE('/api/v1/tasks/{id}/dependencies', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: {
          predecessorTaskId: input.predecessorTaskId,
          expectedVersion: input.version,
        },
      });
      if (response.error !== undefined) throw new Error('任务依赖解除失败。');
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: [...taskDependenciesKey, input.id] }),
      ]);
    },
  });
};

const useMutateEntityTag = (method: 'POST' | 'DELETE') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entityId: string; version: number; tagId: string }) => {
      const options = {
        params: { path: { id: input.entityId } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { tagId: input.tagId, expectedVersion: input.version },
      } as const;
      const response =
        method === 'POST'
          ? await apiClient.POST('/api/v1/entities/{id}/tags', options)
          : await apiClient.DELETE('/api/v1/entities/{id}/tags', options);
      if (response.error !== undefined) throw new Error('对象标签更新失败。');
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: [...entityTagsKey, input.entityId] }),
      ]);
    },
  });
};

export const useAddEntityTag = () => useMutateEntityTag('POST');
export const useRemoveEntityTag = () => useMutateEntityTag('DELETE');

export const useCreateEvent = () => {
  const invalidate = useInvalidateTimeSystem();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      title: string;
      startAt: string;
      endAt: string;
      eventType: 'GENERAL' | 'MEETING' | 'MEDICAL' | 'TRAVEL' | 'REST';
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      isImmovable: boolean;
    }) => requireData((await apiClient.POST('/api/v1/events', { body: input })).data).data,
    onSuccess: invalidate,
  });
};

export const useUpdateEvent = () => {
  const invalidate = useInvalidateTimeSystem();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      description: string;
      startAt: string;
      endAt: string;
      eventType: EventItem['eventType'];
      priority: EventItem['priority'];
      isImmovable: boolean;
      allowOverlap: boolean;
      status: EventItem['status'];
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/events/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              title: input.title,
              description: input.description,
              startAt: input.startAt,
              endAt: input.endAt,
              eventType: input.eventType,
              priority: input.priority,
              isImmovable: input.isImmovable,
              allowOverlap: input.allowOverlap,
              status: input.status,
            },
          })
        ).data,
      ).data,
    onSuccess: invalidate,
  });
};

export const useRecurrenceRule = (targetEntityId: string) =>
  useQuery({
    queryKey: recurrenceRuleKey(targetEntityId),
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/recurrence-rules/by-target/{id}', {
            params: { path: { id: targetEntityId } },
          })
        ).data,
      ).data,
  });

export const useRecurrenceOccurrences = (ruleId: string | undefined) =>
  useQuery({
    queryKey: recurrenceOccurrencesKey(ruleId ?? 'none'),
    enabled: ruleId !== undefined,
    queryFn: async () => {
      if (ruleId === undefined) throw new Error('重复规则不存在。');
      return requireData(
        (
          await apiClient.GET('/api/v1/recurrence-rules/{id}/occurrences', {
            params: { path: { id: ruleId } },
          })
        ).data,
      ).data;
    },
  });

export const useModifyRecurrence = (targetEntityId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      action: 'ONLY_THIS' | 'THIS_AND_FUTURE' | 'ENTIRE_SERIES' | 'SKIP_ONCE' | 'END_RECURRENCE';
      recurrenceKey: string;
      rrule?: string;
      override?: Record<string, unknown>;
    }) => {
      const response = await apiClient.POST('/api/v1/recurrence-rules/{id}/modify', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: {
          expectedVersion: input.version,
          action: input.action,
          recurrenceKey: input.recurrenceKey,
          ...(input.rrule === undefined ? {} : { rrule: input.rrule }),
          ...(input.override === undefined ? {} : { override: input.override }),
        },
      });
      if (response.error !== undefined) throw new Error('重复事项修改失败。');
      return response.data.data;
    },
    onSuccess: (_data, input) => {
      void Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: recurrenceRuleKey(targetEntityId) }),
        queryClient.invalidateQueries({ queryKey: recurrenceOccurrencesKey(input.id) }),
      ]);
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) => {
      const response = await apiClient.DELETE('/api/v1/events/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      });
      if (response.error !== undefined) throw new Error('日程删除失败。');
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['recycle-bin'] }),
      ]);
    },
  });
};

export const useReschedule = () => {
  const invalidate = useInvalidateTimeSystem();
  return useMutation({
    mutationFn: async (input: { from: string; to: string }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/schedules:reschedule', {
            body: { rangeStart: input.from, rangeEnd: input.to, reason: 'USER_REQUEST' },
          })
        ).data,
      ).data,
    onSuccess: invalidate,
  });
};

export const useGoals = () =>
  useQuery({
    queryKey: goalsKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/goals')).data).data,
  });

export const usePlans = () =>
  useQuery({
    queryKey: plansKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/plans')).data).data,
  });

export const usePlanMilestones = (planId: string) =>
  useQuery({
    queryKey: [...planMilestonesKey, planId],
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/plans/{id}/milestones', {
            params: { path: { id: planId } },
          })
        ).data,
      ).data,
  });

export type GoalItem = NonNullable<ReturnType<typeof useGoals>['data']>[number];
export type PlanItem = NonNullable<ReturnType<typeof usePlans>['data']>[number];
export type PlanMilestoneItem = NonNullable<ReturnType<typeof usePlanMilestones>['data']>[number];
export type GoalMetricsState = NonNullable<ReturnType<typeof useGoalMetrics>['data']>;
export type GoalMetricItem = GoalMetricsState['metrics'][number];

export type PlanningRange = 'TODAY' | 'WEEK' | 'SHORT_TERM' | 'LONG_TERM' | 'CUSTOM';
export interface PlanningFilters {
  range?: PlanningRange;
  from?: string;
  to?: string;
  area?: 'WORK' | 'LIFE';
}

export const usePlanningKanban = (filters: PlanningFilters) =>
  useQuery({
    queryKey: [...planningViewsKey, 'kanban', filters],
    queryFn: async () =>
      requireData(
        (await apiClient.GET('/api/v1/plans/views/kanban', { params: { query: filters } })).data,
      ).data,
  });

export const usePlanningCalendar = (filters: PlanningFilters) =>
  useQuery({
    queryKey: [...planningViewsKey, 'calendar', filters],
    queryFn: async () =>
      requireData(
        (await apiClient.GET('/api/v1/plans/views/calendar', { params: { query: filters } })).data,
      ).data,
  });

export const usePlanningTimeline = (filters: PlanningFilters) =>
  useQuery({
    queryKey: [...planningViewsKey, 'timeline', filters],
    queryFn: async () =>
      requireData(
        (await apiClient.GET('/api/v1/plans/views/timeline', { params: { query: filters } })).data,
      ).data,
  });

export const usePlanningGoalTree = (filters: PlanningFilters) =>
  useQuery({
    queryKey: [...planningViewsKey, 'goal-tree', filters],
    queryFn: async () =>
      requireData(
        (await apiClient.GET('/api/v1/plans/views/goal-tree', { params: { query: filters } })).data,
      ).data,
  });

export const useSetGoalProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number; value: number | null }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/goals/{id}/set-progress', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: { expectedVersion: input.version, value: input.value },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: goalsKey }),
        queryClient.invalidateQueries({ queryKey: planningViewsKey }),
      ]);
    },
  });
};

export const useGoalMetrics = (goalId: string) =>
  useQuery({
    queryKey: [...goalMetricsKey, goalId],
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/goals/{id}/metrics', {
            params: { path: { id: goalId } },
          })
        ).data,
      ).data,
  });

const invalidateGoalMetrics = async (queryClient: QueryClient, goalId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [...goalMetricsKey, goalId] }),
    queryClient.invalidateQueries({ queryKey: goalsKey }),
    queryClient.invalidateQueries({ queryKey: planningViewsKey }),
    queryClient.invalidateQueries({ queryKey: ['canonical-history', goalId] }),
  ]);
};

export const useCreateGoalMetric = (goalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version: number;
      name: string;
      metricType: GoalMetricItem['metricType'];
      unit: string | null;
      startValue: number | null;
      targetValue: number;
      direction: GoalMetricItem['direction'];
      weight: number;
    }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/goals/{id}/metrics', {
            params: { path: { id: goalId } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              name: input.name,
              metricType: input.metricType,
              unit: input.unit,
              startValue: input.startValue,
              targetValue: input.targetValue,
              direction: input.direction,
              weight: input.weight,
            },
          })
        ).data,
      ).data,
    onSuccess: async () => invalidateGoalMetrics(queryClient, goalId),
  });
};

export const useUpdateGoalMetric = (goalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name: string;
      metricType: GoalMetricItem['metricType'];
      unit: string | null;
      startValue: number | null;
      targetValue: number;
      direction: GoalMetricItem['direction'];
      weight: number;
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/goal-metrics/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              name: input.name,
              metricType: input.metricType,
              unit: input.unit,
              startValue: input.startValue,
              targetValue: input.targetValue,
              direction: input.direction,
              weight: input.weight,
            },
          })
        ).data,
      ).data,
    onSuccess: async () => invalidateGoalMetrics(queryClient, goalId),
  });
};

export const useDeleteGoalMetric = (goalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) =>
      requireData(
        (
          await apiClient.DELETE('/api/v1/goal-metrics/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: { expectedVersion: input.version },
          })
        ).data,
      ).data,
    onSuccess: async () => invalidateGoalMetrics(queryClient, goalId),
  });
};

export const useRecordGoalProgress = (goalId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      version: number;
      metricId: string;
      value: number;
      note?: string;
    }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/goals/{id}/progress-entries', {
            params: { path: { id: goalId } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              metricId: input.metricId,
              value: input.value,
              ...(input.note === undefined ? {} : { note: input.note }),
            },
          })
        ).data,
      ).data,
    onSuccess: async () => invalidateGoalMetrics(queryClient, goalId),
  });
};

export const useSetPlanProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number; value: number | null }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/plans/{id}/set-progress', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: { expectedVersion: input.version, value: input.value },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: plansKey }),
        queryClient.invalidateQueries({ queryKey: planningViewsKey }),
      ]);
    },
  });
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      title: string;
      goalType: 'OUTCOME' | 'HABIT';
      startDate: string;
      endDate?: string | null;
    }) => requireData((await apiClient.POST('/api/v1/goals', { body: input })).data).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: goalsKey }),
        queryClient.invalidateQueries({ queryKey: planningViewsKey }),
      ]);
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      description: string;
      status: GoalItem['status'];
      startDate: string;
      endDate: string | null;
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/goals/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              title: input.title,
              description: input.description,
              status: input.status,
              startDate: input.startDate,
              endDate: input.endDate,
            },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: goalsKey }),
        queryClient.invalidateQueries({ queryKey: planningViewsKey }),
      ]);
    },
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) => {
      const response = await apiClient.DELETE('/api/v1/goals/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      });
      if (response.error !== undefined) throw new Error('目标删除失败。');
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['recycle-bin'] }),
      ]);
    },
  });
};

export const useCreatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      goalId?: string | null;
      categoryId: string;
      title: string;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      startDate: string;
      endDate: string;
    }) => requireData((await apiClient.POST('/api/v1/plans', { body: input })).data).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: plansKey }),
        queryClient.invalidateQueries({ queryKey: goalsKey }),
        queryClient.invalidateQueries({ queryKey: planningViewsKey }),
      ]);
    },
  });
};

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      description: string;
      status: PlanItem['status'];
      priority: PlanItem['priority'];
      startDate: string;
      endDate: string;
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/plans/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              title: input.title,
              description: input.description,
              status: input.status,
              priority: input.priority,
              startDate: input.startDate,
              endDate: input.endDate,
            },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: plansKey }),
        queryClient.invalidateQueries({ queryKey: goalsKey }),
        queryClient.invalidateQueries({ queryKey: planningViewsKey }),
      ]);
    },
  });
};

export const useDeletePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) => {
      const response = await apiClient.DELETE('/api/v1/plans/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      });
      if (response.error !== undefined) throw new Error('计划删除失败。');
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateTimeSystemQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['recycle-bin'] }),
      ]);
    },
  });
};

const invalidatePlanMilestones = async (queryClient: QueryClient, planId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [...planMilestonesKey, planId] }),
    queryClient.invalidateQueries({ queryKey: plansKey }),
    queryClient.invalidateQueries({ queryKey: planningViewsKey }),
    queryClient.invalidateQueries({ queryKey: ['canonical-history', planId] }),
  ]);
};

export const useCreatePlanMilestone = (planId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      dueAt: string;
      linkedEntityIds: string[];
    }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/plans/{id}/milestones', {
            params: { path: { id: planId } },
            body: input,
          })
        ).data,
      ).data,
    onSuccess: async () => invalidatePlanMilestones(queryClient, planId),
  });
};

export const useUpdatePlanMilestone = (planId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      description: string;
      dueAt: string;
      status: PlanMilestoneItem['status'];
      linkedEntityIds: string[];
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/milestones/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              title: input.title,
              description: input.description,
              dueAt: input.dueAt,
              status: input.status,
              linkedEntityIds: input.linkedEntityIds,
            },
          })
        ).data,
      ).data,
    onSuccess: async () => invalidatePlanMilestones(queryClient, planId),
  });
};

export const useDeletePlanMilestone = (planId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) => {
      const response = await apiClient.DELETE('/api/v1/milestones/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.version)}"` },
        body: { expectedVersion: input.version },
      });
      if (response.error !== undefined) throw new Error('里程碑删除失败。');
    },
    onSuccess: async () => {
      await Promise.all([
        invalidatePlanMilestones(queryClient, planId),
        queryClient.invalidateQueries({ queryKey: ['recycle-bin'] }),
      ]);
    },
  });
};

export const useRoutines = () =>
  useQuery({
    queryKey: routinesKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/routine-templates')).data).data,
  });

export const useRoutineOverride = (date: string) =>
  useQuery({
    queryKey: routineOverrideKey(date),
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/routine-overrides/{date}', {
            params: { path: { date } },
          })
        ).data,
      ).data,
  });

export const useSaveRoutineOverride = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      override:
        | { templateId: string; note?: string }
        | {
            segments: readonly {
              name: string;
              segmentType: 'SLEEP' | 'WORK' | 'LIFE' | 'REST';
              startTime: string;
              endTime: string;
              isImmovable: boolean;
            }[];
            note?: string;
          };
    }) =>
      requireData(
        (
          await apiClient.PUT('/api/v1/routine-overrides/{date}', {
            params: { path: { date: input.date } },
            body:
              'segments' in input.override
                ? { ...input.override, segments: [...input.override.segments] }
                : input.override,
          })
        ).data,
      ).data,
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: routineOverrideKey(input.date) }),
        queryClient.invalidateQueries({ queryKey: timelineKey }),
        queryClient.invalidateQueries({ queryKey: todayKey }),
      ]);
    },
  });
};

export const useRemoveRoutineOverride = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      await apiClient.DELETE('/api/v1/routine-overrides/{date}', {
        params: { path: { date } },
      });
      return date;
    },
    onSuccess: async (date) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: routineOverrideKey(date) }),
        queryClient.invalidateQueries({ queryKey: timelineKey }),
        queryClient.invalidateQueries({ queryKey: todayKey }),
      ]);
    },
  });
};

export const useCreateRoutine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      templateType: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY' | 'CUSTOM';
      isDefault?: boolean;
      segments: readonly {
        name: string;
        segmentType: 'SLEEP' | 'WORK' | 'LIFE' | 'REST';
        startTime: string;
        endTime: string;
        isImmovable: boolean;
      }[];
    }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/routine-templates', {
            body: { ...input, segments: [...input.segments] },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: routinesKey });
    },
  });
};

export const useUpdateRoutine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name: string;
      segments: readonly {
        name: string;
        segmentType: 'SLEEP' | 'WORK' | 'LIFE' | 'REST';
        startTime: string;
        endTime: string;
        isImmovable: boolean;
      }[];
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/routine-templates/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              name: input.name,
              segments: [...input.segments],
            },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: routinesKey }),
        queryClient.invalidateQueries({ queryKey: timelineKey }),
      ]);
    },
  });
};
