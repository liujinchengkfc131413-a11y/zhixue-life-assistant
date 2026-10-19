import {
  CategoriesEnvelopeSchema,
  EventsEnvelopeSchema,
  EventEnvelopeSchema,
  EntityTagsEnvelopeSchema,
  GoalEnvelopeSchema,
  GoalMetricsStateEnvelopeSchema,
  GoalsEnvelopeSchema,
  PlanEnvelopeSchema,
  PlanMilestoneEnvelopeSchema,
  PlanMilestonesEnvelopeSchema,
  PlansEnvelopeSchema,
  RecycleItemsEnvelopeSchema,
  RecurrenceOccurrencesEnvelopeSchema,
  RecurrenceRuleEnvelopeSchema,
  NullableRoutineOverrideEnvelopeSchema,
  RoutineOverrideEnvelopeSchema,
  RoutineTemplatesEnvelopeSchema,
  ScheduleRunDetailEnvelopeSchema,
  ScheduleRunEnvelopeSchema,
  TaskEnvelopeSchema,
  TaskDependenciesEnvelopeSchema,
  TaskScheduleHistoryEnvelopeSchema,
  TagEnvelopeSchema,
  TasksEnvelopeSchema,
  TimelineEnvelopeSchema,
} from '@life-assistant/contracts';
import { FixedClock } from '@life-assistant/kernel';
import { createTestDataDirectory } from '@life-assistant/test-support';
import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { LocalRuntime } from '../src/runtime-probe.js';

describe('M2 core time-system API', () => {
  it('creates, edits, resolves and deletes template or custom date routine overrides', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const template = RoutineTemplatesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/routine-templates' })).json(),
      ).data[0];
      if (template === undefined) throw new Error('测试缺少作息模板。');

      const templateOverrideResponse = await app.inject({
        method: 'PUT',
        url: '/api/v1/routine-overrides/2026-09-08',
        payload: { templateId: template.id, note: '出差' },
      });
      expect(templateOverrideResponse.statusCode).toBe(200);
      expect(
        RoutineOverrideEnvelopeSchema.parse(templateOverrideResponse.json()).data,
      ).toMatchObject({
        localDate: '2026-09-08',
        templateId: template.id,
        segments: null,
        note: '出差',
      });

      const customSegments = [
        {
          name: '补觉',
          segmentType: 'SLEEP' as const,
          startTime: '00:00',
          endTime: '09:00',
          isImmovable: true,
        },
        {
          name: '自由安排',
          segmentType: 'LIFE' as const,
          startTime: '10:00',
          endTime: '22:00',
          isImmovable: false,
        },
      ];
      const customOverrideResponse = await app.inject({
        method: 'PUT',
        url: '/api/v1/routine-overrides/2026-09-08',
        payload: { segments: customSegments, note: '当天自定义' },
      });
      expect(customOverrideResponse.statusCode).toBe(200);
      expect(RoutineOverrideEnvelopeSchema.parse(customOverrideResponse.json()).data).toMatchObject(
        {
          templateId: null,
          segments: customSegments,
          note: '当天自定义',
        },
      );
      expect(runtime.routines?.resolveTemplate('2026-09-08').segments).toMatchObject(
        customSegments,
      );

      const getResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/routine-overrides/2026-09-08',
      });
      expect(
        NullableRoutineOverrideEnvelopeSchema.parse(getResponse.json()).data?.segments,
      ).toEqual(customSegments);

      expect(
        (await app.inject({ method: 'DELETE', url: '/api/v1/routine-overrides/2026-09-08' }))
          .statusCode,
      ).toBe(204);
      const afterDelete = NullableRoutineOverrideEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/routine-overrides/2026-09-08' })).json(),
      );
      expect(afterDelete.data).toBeNull();
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('records a USER HTTP task update through the unified change recorder', async () => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-30T01:00:00.000Z'));
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json`, clock });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      );
      const category = categories.data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');
      const created = TaskEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/tasks',
            payload: {
              categoryId: category.id,
              title: 'HTTP 修改前',
              priority: 'NORMAL',
              dueAt: '2026-08-31T08:00:00.000Z',
              estimatedMinutes: 60,
              isFlexible: true,
              preferredArea: 'WORK',
            },
          })
        ).json(),
      ).data;
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${created.id}`,
        headers: { 'if-match': `"${String(created.version)}"` },
        payload: { expectedVersion: created.version, title: 'HTTP 修改后' },
      });
      const updated = TaskEnvelopeSchema.parse(response.json());
      const recorded = runtime.database?.raw
        .prepare(
          `SELECT change_set.source,change_set.source_ref,change_set.actor_ref change_set_actor_ref,
                  operation.before_json,operation.after_json,
                  version.entity_version,version.source version_source,version.snapshot_json,
                  version.patch_json,entity.version current_version
           FROM entity_versions version
           JOIN change_sets change_set ON change_set.id=version.change_set_id
           JOIN change_operations operation ON operation.change_set_id=change_set.id
           JOIN entity_index entity ON entity.id=version.entity_id
           WHERE version.entity_id=? ORDER BY version.entity_version DESC LIMIT 1`,
        )
        .get(created.id) as Record<string, unknown> | undefined;

      expect(updated.data).toMatchObject({ title: 'HTTP 修改后', version: 2 });
      expect(recorded).toMatchObject({
        source: 'USER',
        source_ref: `request:${updated.meta.requestId}`,
        change_set_actor_ref: 'local-user',
        version_source: 'USER',
        entity_version: 2,
        current_version: 2,
      });
      expect(JSON.parse(String(recorded?.before_json))).toMatchObject({
        entityType: 'TASK',
        canonicalState: { title: 'HTTP 修改前' },
      });
      expect(JSON.parse(String(recorded?.after_json))).toMatchObject({
        entityType: 'TASK',
        canonicalState: { title: 'HTTP 修改后' },
      });
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('runs the no-AI create, schedule, complete and progress workflow', async () => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json`, clock });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      );
      const workCategory = categories.data.find((category) => category.parentArea === 'WORK');
      if (workCategory === undefined) throw new Error('测试缺少工作分类。');

      const routines = RoutineTemplatesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/routine-templates' })).json(),
      );
      expect(routines.data.filter((template) => template.isDefault)).toHaveLength(3);
      expect(
        routines.data.some((template) =>
          template.segments.some((segment) => segment.segmentType === 'SLEEP'),
        ),
      ).toBe(true);

      const goal = GoalEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/goals',
            payload: {
              categoryId: workCategory.id,
              title: '完成 M2',
              goalType: 'OUTCOME',
              startDate: '2026-08-11',
              endDate: '2026-08-31',
            },
          })
        ).json(),
      ).data;
      const plan = PlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/plans',
            payload: {
              goalId: goal.id,
              categoryId: workCategory.id,
              title: '核心时间系统',
              priority: 'HIGH',
              startDate: '2026-08-11',
              endDate: '2026-08-20',
            },
          })
        ).json(),
      ).data;
      const meeting = await app.inject({
        method: 'POST',
        url: '/api/v1/events',
        payload: {
          categoryId: workCategory.id,
          title: '固定会议',
          startAt: '2026-08-11T02:00:00.000Z',
          endAt: '2026-08-11T03:00:00.000Z',
          eventType: 'MEETING',
          priority: 'HIGH',
        },
      });
      expect(EventEnvelopeSchema.parse(meeting.json()).data.isImmovable).toBe(true);

      const createTask = async (title: string, priority: 'URGENT' | 'NORMAL') => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/tasks',
          payload: {
            categoryId: workCategory.id,
            planId: plan.id,
            goalId: goal.id,
            title,
            priority,
            dueAt: '2026-08-11T12:00:00.000Z',
            estimatedMinutes: 60,
            isFlexible: true,
            isSplittable: false,
            preferredArea: 'WORK',
          },
        });
        expect(response.statusCode).toBe(201);
        return TaskEnvelopeSchema.parse(response.json()).data;
      };
      const urgent = await createTask('高优先任务', 'URGENT');
      await createTask('普通任务', 'NORMAL');

      const timeline = TimelineEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/schedules?from=2026-08-10T16:00:00.000Z&to=2026-08-11T16:00:00.000Z',
          })
        ).json(),
      ).data;
      const urgentBlock = timeline.find((block) => block.targetEntityId === urgent.id);
      const meetingBlock = timeline.find((block) => block.title === '固定会议');
      const normalBlock = timeline.find((block) => block.title === '普通任务');
      expect(urgentBlock?.startAt).toBe('2026-08-11T01:00:00.000Z');
      expect(meetingBlock?.startAt).toBe('2026-08-11T02:00:00.000Z');
      expect(normalBlock?.startAt).toBe('2026-08-11T03:00:00.000Z');

      const withoutIfMatch = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${urgent.id}/complete`,
        payload: { expectedVersion: urgent.version },
      });
      expect(withoutIfMatch.statusCode).toBe(428);
      const complete = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${urgent.id}/complete`,
        headers: { 'if-match': `"${String(urgent.version)}"` },
        payload: { expectedVersion: urgent.version },
      });
      expect(TaskEnvelopeSchema.parse(complete.json()).data.status).toBe('COMPLETED');
      const staleUpdate = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${urgent.id}`,
        headers: { 'if-match': `"${String(urgent.version)}"` },
        payload: { expectedVersion: urgent.version, title: '过期页面的修改' },
      });
      expect(staleUpdate.statusCode).toBe(409);

      const afterComplete = TimelineEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/schedules?from=2026-08-10T16:00:00.000Z&to=2026-08-11T16:00:00.000Z',
          })
        ).json(),
      ).data;
      expect(afterComplete.some((block) => block.targetEntityId === urgent.id)).toBe(false);
      const releasedHistory = runtime.database?.raw
        .prepare(
          `SELECT COUNT(*) AS count FROM schedule_blocks blocks
           JOIN entity_index entity ON entity.id = blocks.id
           WHERE blocks.target_entity_id = ? AND entity.deleted_at IS NOT NULL`,
        )
        .get(urgent.id) as { count: number } | undefined;
      expect(releasedHistory?.count).toBeGreaterThan(0);
      const goals = GoalEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/goals/${goal.id}/set-progress`,
            headers: { 'if-match': `"${String(goal.version)}"` },
            payload: { expectedVersion: goal.version, value: 50 },
          })
        ).json(),
      ).data;
      expect(goals.displayProgress).toBe(50);

      const tasks = TasksEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/tasks?includeCompleted=true' })).json(),
      );
      expect(tasks.data).toHaveLength(2);
      const rerun = ScheduleRunEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/schedules:reschedule',
            payload: {
              rangeStart: '2026-08-10T16:00:00.000Z',
              rangeEnd: '2026-08-11T16:00:00.000Z',
              reason: 'TEST_REPLAY',
            },
          })
        ).json(),
      );
      expect(rerun.data.preservedBlocks).toBeGreaterThan(0);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it.each([
    {
      now: '2026-08-11T01:42:00.000Z',
      expectedStart: '2026-08-11T01:45:00.000Z',
      label: 'rounds the current time up to the next 15-minute grid',
    },
    {
      now: '2026-08-11T01:45:00.000Z',
      expectedStart: '2026-08-11T01:45:00.000Z',
      label: 'keeps an exact current grid boundary available',
    },
  ])('$label', async ({ now, expectedStart }) => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date(now));
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json`, clock });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      );
      const workCategory = categories.data.find((category) => category.parentArea === 'WORK');
      if (workCategory === undefined) throw new Error('测试缺少工作分类。');

      const created = TaskEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/tasks',
            payload: {
              categoryId: workCategory.id,
              title: '当前时间边界排程',
              priority: 'NORMAL',
              dueAt: '2026-08-11T05:45:00.000Z',
              estimatedMinutes: 60,
              isFlexible: true,
              isSplittable: false,
              preferredArea: 'WORK',
            },
          })
        ).json(),
      ).data;
      const timeline = TimelineEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/schedules?from=2026-08-10T16:00:00.000Z&to=2026-08-11T16:00:00.000Z',
          })
        ).json(),
      ).data;
      const block = timeline.find((item) => item.targetEntityId === created.id);

      expect(block?.startAt).toBe(expectedStart);
      expect(Date.parse(block?.startAt ?? '')).toBeGreaterThanOrEqual(Date.parse(now));
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('exposes task schedule history and schedule run detail through the API', async () => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-08-11T00:00:00.000Z'));
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json`, clock });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const categories = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      );
      const category = categories.data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');
      const created = TaskEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/tasks',
            payload: {
              categoryId: category.id,
              title: '历史闭环任务',
              priority: 'NORMAL',
              dueAt: '2026-08-11T08:00:00.000Z',
              estimatedMinutes: 60,
              isFlexible: true,
              isSplittable: false,
              preferredArea: 'WORK',
            },
          })
        ).json(),
      ).data;
      const completed = TaskEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/tasks/${created.id}/complete`,
            headers: { 'if-match': `"${String(created.version)}"` },
            payload: { expectedVersion: created.version },
          })
        ).json(),
      ).data;
      expect(completed.status).toBe('COMPLETED');

      const history = TaskScheduleHistoryEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/tasks/${created.id}/schedule-history`,
          })
        ).json(),
      ).data;
      expect(history.taskId).toBe(created.id);
      const releasedEntry = history.entries.find((entry) => entry.kind === 'RELEASED');
      expect(releasedEntry?.reason).toBe('TASK_COMPLETED');
      expect(releasedEntry?.previousBlocks).toHaveLength(1);

      const scheduledRunId = history.entries.find((entry) => entry.runId !== null)?.runId;
      expect(typeof scheduledRunId).toBe('string');
      if (scheduledRunId === null || scheduledRunId === undefined)
        throw new Error('缺少排程运行记录。');
      const detail = ScheduleRunDetailEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/schedules/runs/${scheduledRunId}`,
          })
        ).json(),
      ).data;
      expect(detail.trigger).toBeTruthy();
      expect(detail.createdBlocks.some((block) => block.taskId === created.id)).toBe(true);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('edits goal, plan and event fields and lifecycle status with optimistic versions', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');

      const goal = GoalEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/goals',
            payload: {
              categoryId: category.id,
              title: '原目标',
              goalType: 'OUTCOME',
              startDate: '2026-09-01',
              endDate: '2026-12-01',
            },
          })
        ).json(),
      ).data;
      const updatedGoalResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/goals/${goal.id}`,
        headers: { 'if-match': `"${String(goal.version)}"` },
        payload: {
          expectedVersion: goal.version,
          title: '更新目标',
          description: '补齐生命周期',
          status: 'PAUSED',
          endDate: '2026-12-31',
        },
      });
      expect(updatedGoalResponse.statusCode).toBe(200);
      const updatedGoal = GoalEnvelopeSchema.parse(updatedGoalResponse.json()).data;
      expect(updatedGoal).toMatchObject({
        title: '更新目标',
        description: '补齐生命周期',
        status: 'PAUSED',
        endDate: '2026-12-31',
        version: goal.version + 1,
      });

      const plan = PlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/plans',
            payload: {
              goalId: goal.id,
              categoryId: category.id,
              title: '原计划',
              priority: 'NORMAL',
              startDate: '2026-09-01',
              endDate: '2026-10-01',
            },
          })
        ).json(),
      ).data;
      const updatedPlanResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/plans/${plan.id}`,
        headers: { 'if-match': `"${String(plan.version)}"` },
        payload: {
          expectedVersion: plan.version,
          title: '更新计划',
          description: '进入执行阶段',
          status: 'COMPLETED',
          priority: 'HIGH',
          endDate: '2026-10-31',
        },
      });
      expect(updatedPlanResponse.statusCode).toBe(200);
      expect(PlanEnvelopeSchema.parse(updatedPlanResponse.json()).data).toMatchObject({
        title: '更新计划',
        description: '进入执行阶段',
        status: 'COMPLETED',
        priority: 'HIGH',
        endDate: '2026-10-31',
        version: plan.version + 1,
      });

      const staleGoalResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/goals/${goal.id}`,
        headers: { 'if-match': `"${String(goal.version)}"` },
        payload: { expectedVersion: goal.version, status: 'ACTIVE' },
      });
      expect(staleGoalResponse.statusCode).toBe(409);

      const fixedEvent = EventEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: {
              categoryId: category.id,
              title: '固定会议',
              startAt: '2026-09-03T01:00:00.000Z',
              endAt: '2026-09-03T02:00:00.000Z',
              eventType: 'MEETING',
              priority: 'HIGH',
            },
          })
        ).json(),
      ).data;
      const editableEvent = EventEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: {
              categoryId: category.id,
              title: '待调整日程',
              startAt: '2026-09-03T02:00:00.000Z',
              endAt: '2026-09-03T03:00:00.000Z',
              eventType: 'GENERAL',
              priority: 'NORMAL',
            },
          })
        ).json(),
      ).data;
      expect(fixedEvent.isImmovable).toBe(true);
      expect(
        EventEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: `/api/v1/events/${editableEvent.id}` })).json(),
        ).data,
      ).toMatchObject({ id: editableEvent.id, title: '待调整日程' });

      const conflictResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/events/${editableEvent.id}`,
        headers: { 'if-match': `"${String(editableEvent.version)}"` },
        payload: {
          expectedVersion: editableEvent.version,
          startAt: '2026-09-03T01:30:00.000Z',
          endAt: '2026-09-03T02:30:00.000Z',
        },
      });
      expect(conflictResponse.statusCode).toBe(409);

      const updatedEventResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/events/${editableEvent.id}`,
        headers: { 'if-match': `"${String(editableEvent.version)}"` },
        payload: {
          expectedVersion: editableEvent.version,
          title: '完成的重叠日程',
          description: '用户明确允许重叠',
          startAt: '2026-09-03T01:30:00.000Z',
          endAt: '2026-09-03T02:30:00.000Z',
          allowOverlap: true,
          isImmovable: true,
          status: 'COMPLETED',
        },
      });
      expect(updatedEventResponse.statusCode).toBe(200);
      expect(EventEnvelopeSchema.parse(updatedEventResponse.json()).data).toMatchObject({
        title: '完成的重叠日程',
        description: '用户明确允许重叠',
        allowOverlap: true,
        isImmovable: true,
        status: 'COMPLETED',
        version: editableEvent.version + 1,
      });
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('soft-deletes and restores goals, plans, tasks and events through the shared recycle bin', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');

      const goal = GoalEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/goals',
            payload: {
              categoryId: category.id,
              title: '待删除目标',
              goalType: 'OUTCOME',
              startDate: '2026-09-02',
              endDate: '2026-12-31',
            },
          })
        ).json(),
      ).data;
      const plan = PlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/plans',
            payload: {
              goalId: goal.id,
              categoryId: category.id,
              title: '待删除计划',
              priority: 'NORMAL',
              startDate: '2026-09-02',
              endDate: '2026-10-01',
            },
          })
        ).json(),
      ).data;
      const task = TaskEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/tasks',
            payload: {
              categoryId: category.id,
              goalId: goal.id,
              planId: plan.id,
              title: '待删除任务',
              priority: 'NORMAL',
              dueAt: '2026-09-03T10:00:00.000Z',
              estimatedMinutes: 30,
              isFlexible: true,
              isSplittable: false,
              preferredArea: 'WORK',
            },
          })
        ).json(),
      ).data;
      const event = EventEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: {
              categoryId: category.id,
              title: '待删除日程',
              startAt: '2026-09-03T11:00:00.000Z',
              endAt: '2026-09-03T12:00:00.000Z',
              eventType: 'GENERAL',
              priority: 'NORMAL',
            },
          })
        ).json(),
      ).data;

      const staleDelete = await app.inject({
        method: 'DELETE',
        url: `/api/v1/goals/${goal.id}`,
        headers: { 'if-match': '"2"' },
        payload: { expectedVersion: 2 },
      });
      expect(staleDelete.statusCode).toBe(409);

      for (const item of [
        { route: 'goals', ...goal },
        { route: 'plans', ...plan },
        { route: 'tasks', ...task },
        { route: 'events', ...event },
      ]) {
        const response = await app.inject({
          method: 'DELETE',
          url: `/api/v1/${item.route}/${item.id}`,
          headers: { 'if-match': `"${String(item.version)}"` },
          payload: { expectedVersion: item.version },
        });
        expect(response.statusCode).toBe(204);
      }

      const recycle = RecycleItemsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json(),
      ).data;
      expect(recycle.map((item) => item.entityType)).toEqual(
        expect.arrayContaining(['GOAL', 'PLAN', 'TASK', 'EVENT']),
      );
      for (const original of [goal, plan, task, event]) {
        const deleted = recycle.find((item) => item.id === original.id);
        expect(deleted?.version).toBe(original.version + 1);
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/recycle-bin/${original.id}:restore`,
          payload: { expectedVersion: deleted?.version },
        });
        expect(response.statusCode).toBe(200);
      }

      const restoredGoals = GoalsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/goals' })).json(),
      ).data;
      const restoredPlans = PlansEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/plans' })).json(),
      ).data;
      expect(restoredGoals.some((item) => item.id === goal.id)).toBe(true);
      expect(restoredPlans.some((item) => item.id === plan.id)).toBe(true);
      expect(
        (await app.inject({ method: 'GET', url: `/api/v1/tasks/${task.id}` })).statusCode,
      ).toBe(200);
      const restoredEvents = EventsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/events' })).json(),
      ).data;
      expect(restoredEvents.some((item) => item.id === event.id)).toBe(true);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('lists, adds and removes task dependencies while rejecting cycles and stale versions', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');
      const createTask = async (title: string) =>
        TaskEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'POST',
              url: '/api/v1/tasks',
              payload: {
                categoryId: category.id,
                title,
                priority: 'NORMAL',
                dueAt: '2026-09-03T10:00:00.000Z',
                estimatedMinutes: 30,
                isFlexible: true,
                isSplittable: false,
                preferredArea: 'WORK',
              },
            })
          ).json(),
        ).data;
      const predecessor = await createTask('前置任务');
      const successor = await createTask('后继任务');

      const added = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${successor.id}/dependencies`,
        headers: { 'if-match': `"${String(successor.version)}"` },
        payload: { predecessorTaskId: predecessor.id, expectedVersion: successor.version },
      });
      expect(added.statusCode).toBe(204);
      const dependencies = TaskDependenciesEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/tasks/${successor.id}/dependencies`,
          })
        ).json(),
      ).data;
      expect(dependencies).toEqual({
        taskId: successor.id,
        predecessorTaskIds: [predecessor.id],
        successorTaskIds: [],
      });

      const cycle = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${predecessor.id}/dependencies`,
        headers: { 'if-match': `"${String(predecessor.version)}"` },
        payload: { predecessorTaskId: successor.id, expectedVersion: predecessor.version },
      });
      expect(cycle.statusCode).toBe(409);

      const staleRemove = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tasks/${successor.id}/dependencies`,
        headers: { 'if-match': `"${String(successor.version)}"` },
        payload: { predecessorTaskId: predecessor.id, expectedVersion: successor.version },
      });
      expect(staleRemove.statusCode).toBe(409);
      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tasks/${successor.id}/dependencies`,
        headers: { 'if-match': `"${String(successor.version + 1)}"` },
        payload: { predecessorTaskId: predecessor.id, expectedVersion: successor.version + 1 },
      });
      expect(removed.statusCode).toBe(204);
      const afterRemoval = TaskDependenciesEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/tasks/${successor.id}/dependencies`,
          })
        ).json(),
      ).data;
      expect(afterRemoval).toEqual({
        taskId: successor.id,
        predecessorTaskIds: [],
        successorTaskIds: [],
      });
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('runs one-level subtask create, edit, complete, delete and restore through the task lifecycle', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');
      const taskPayload = {
        categoryId: category.id,
        title: '父任务',
        priority: 'NORMAL' as const,
        dueAt: '2026-09-03T10:00:00.000Z',
        estimatedMinutes: 60,
        isFlexible: true,
        isSplittable: false,
        preferredArea: 'WORK' as const,
      };
      const parent = TaskEnvelopeSchema.parse(
        (await app.inject({ method: 'POST', url: '/api/v1/tasks', payload: taskPayload })).json(),
      ).data;
      const childResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${parent.id}/subtasks`,
        payload: { ...taskPayload, title: '子任务', estimatedMinutes: 30 },
      });
      expect(childResponse.statusCode).toBe(201);
      const child = TaskEnvelopeSchema.parse(childResponse.json()).data;
      expect(child).toMatchObject({ parentTaskId: parent.id, title: '子任务', status: 'TODO' });

      const grandchild = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${child.id}/subtasks`,
        payload: { ...taskPayload, title: '禁止的孙任务', estimatedMinutes: 30 },
      });
      expect(grandchild.statusCode).toBe(422);
      const editedResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tasks/${child.id}`,
        headers: { 'if-match': `"${String(child.version)}"` },
        payload: {
          expectedVersion: child.version,
          title: '已编辑子任务',
          dueAt: '2026-09-03T11:00:00.000Z',
        },
      });
      const edited = TaskEnvelopeSchema.parse(editedResponse.json()).data;
      const completedResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/tasks/${child.id}/complete`,
        headers: { 'if-match': `"${String(edited.version)}"` },
        payload: { expectedVersion: edited.version },
      });
      const completed = TaskEnvelopeSchema.parse(completedResponse.json()).data;
      expect(completed).toMatchObject({ title: '已编辑子任务', status: 'COMPLETED' });
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/api/v1/tasks/${child.id}`,
            headers: { 'if-match': `"${String(completed.version)}"` },
            payload: { expectedVersion: completed.version },
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/recycle-bin/${child.id}:restore`,
            payload: { expectedVersion: completed.version + 1 },
          })
        ).statusCode,
      ).toBe(200);
      const restored = TaskEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: `/api/v1/tasks/${child.id}` })).json(),
      ).data;
      expect(restored).toMatchObject({
        parentTaskId: parent.id,
        title: '已编辑子任务',
        status: 'COMPLETED',
        version: completed.version + 2,
      });
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('adds, lists and removes core entity tags with optimistic versions', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');
      const tag = TagEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/tags',
            payload: { name: '核心标签', colorToken: 'blue' },
          })
        ).json(),
      ).data;
      const task = TaskEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/tasks',
            payload: {
              categoryId: category.id,
              title: '待关联标签任务',
              priority: 'NORMAL',
              dueAt: '2026-09-03T10:00:00.000Z',
              estimatedMinutes: 30,
              isFlexible: true,
              isSplittable: false,
              preferredArea: 'WORK',
            },
          })
        ).json(),
      ).data;

      const added = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${task.id}/tags`,
        headers: { 'if-match': `"${String(task.version)}"` },
        payload: { tagId: tag.id, expectedVersion: task.version },
      });
      expect(added.statusCode).toBe(204);
      expect(
        EntityTagsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: `/api/v1/entities/${task.id}/tags` })).json(),
        ).data,
      ).toEqual([tag]);

      const staleRemove = await app.inject({
        method: 'DELETE',
        url: `/api/v1/entities/${task.id}/tags`,
        headers: { 'if-match': `"${String(task.version)}"` },
        payload: { tagId: tag.id, expectedVersion: task.version },
      });
      expect(staleRemove.statusCode).toBe(409);
      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/v1/entities/${task.id}/tags`,
        headers: { 'if-match': `"${String(task.version + 1)}"` },
        payload: { tagId: tag.id, expectedVersion: task.version + 1 },
      });
      expect(removed.statusCode).toBe(204);
      expect(
        EntityTagsEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: `/api/v1/entities/${task.id}/tags` })).json(),
        ).data,
      ).toEqual([]);
      expect(
        TaskEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: `/api/v1/tasks/${task.id}` })).json(),
        ).data.version,
      ).toBe(task.version + 2);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('manages plan milestones with multiple task links, achievement and recycle restore', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'WORK');
      if (category === undefined) throw new Error('测试缺少工作分类。');
      const plan = PlanEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/plans',
            payload: {
              categoryId: category.id,
              title: '里程碑计划',
              priority: 'HIGH',
              startDate: '2026-09-01',
              endDate: '2026-10-31',
            },
          })
        ).json(),
      ).data;
      const createTask = async (title: string) =>
        TaskEnvelopeSchema.parse(
          (
            await app.inject({
              method: 'POST',
              url: '/api/v1/tasks',
              payload: {
                categoryId: category.id,
                planId: plan.id,
                title,
                priority: 'NORMAL',
                dueAt: '2026-09-20T10:00:00.000Z',
                estimatedMinutes: 30,
                isFlexible: true,
                isSplittable: false,
                preferredArea: 'WORK',
              },
            })
          ).json(),
        ).data;
      const firstTask = await createTask('任务一');
      const secondTask = await createTask('任务二');

      const createdResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/plans/${plan.id}/milestones`,
        payload: {
          title: '第一阶段',
          description: '完成两项任务',
          dueAt: '2026-09-30T16:00:00.000Z',
          linkedEntityIds: [firstTask.id, secondTask.id],
        },
      });
      expect(createdResponse.statusCode).toBe(201);
      const milestone = PlanMilestoneEnvelopeSchema.parse(createdResponse.json()).data;
      expect(milestone).toMatchObject({
        planId: plan.id,
        status: 'PENDING',
        linkedEntityIds: [firstTask.id, secondTask.id].sort(),
      });

      const updatedResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/milestones/${milestone.id}`,
        headers: { 'if-match': `"${String(milestone.version)}"` },
        payload: {
          expectedVersion: milestone.version,
          title: '第一阶段验收',
          status: 'ACHIEVED',
          linkedEntityIds: [secondTask.id],
        },
      });
      expect(updatedResponse.statusCode).toBe(200);
      const updated = PlanMilestoneEnvelopeSchema.parse(updatedResponse.json()).data;
      expect(updated).toMatchObject({
        title: '第一阶段验收',
        status: 'ACHIEVED',
        linkedEntityIds: [secondTask.id],
        version: milestone.version + 1,
      });
      expect(updated.achievedAt).not.toBeNull();

      const staleDelete = await app.inject({
        method: 'DELETE',
        url: `/api/v1/milestones/${milestone.id}`,
        headers: { 'if-match': `"${String(milestone.version)}"` },
        payload: { expectedVersion: milestone.version },
      });
      expect(staleDelete.statusCode).toBe(409);
      const deleted = await app.inject({
        method: 'DELETE',
        url: `/api/v1/milestones/${milestone.id}`,
        headers: { 'if-match': `"${String(updated.version)}"` },
        payload: { expectedVersion: updated.version },
      });
      expect(deleted.statusCode).toBe(204);
      expect(
        PlanMilestonesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: `/api/v1/plans/${plan.id}/milestones` })).json(),
        ).data,
      ).toEqual([]);
      const recycle = RecycleItemsEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/recycle-bin' })).json(),
      ).data;
      const recycled = recycle.find((item) => item.id === milestone.id);
      expect(recycled).toMatchObject({ entityType: 'MILESTONE', title: '第一阶段验收' });
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/recycle-bin/${milestone.id}:restore`,
            payload: { expectedVersion: recycled?.version },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        PlanMilestonesEnvelopeSchema.parse(
          (await app.inject({ method: 'GET', url: `/api/v1/plans/${plan.id}/milestones` })).json(),
        ).data[0],
      ).toMatchObject({ status: 'ACHIEVED', linkedEntityIds: [secondTask.id] });
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('manages goal metrics and preserves a manual progress override during automatic recalculation', async () => {
    const temporary = await createTestDataDirectory();
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json` });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'LIFE');
      if (category === undefined) throw new Error('测试缺少生活分类。');
      const goal = GoalEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/goals',
            payload: {
              categoryId: category.id,
              title: '减重目标',
              goalType: 'HABIT',
              startDate: '2026-09-01',
              endDate: '2026-10-01',
            },
          })
        ).json(),
      ).data;

      const createdResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/goals/${goal.id}/metrics`,
        headers: { 'if-match': `"${String(goal.version)}"` },
        payload: {
          expectedVersion: goal.version,
          name: '累计减重',
          metricType: 'NUMBER',
          unit: 'kg',
          startValue: 0,
          targetValue: 2,
          direction: 'INCREASE',
          weight: 1,
        },
      });
      expect(createdResponse.statusCode).toBe(201);
      const created = GoalMetricsStateEnvelopeSchema.parse(createdResponse.json()).data;
      expect(created).toMatchObject({ goalVersion: goal.version + 1, autoProgress: 0 });
      const metric = created.metrics[0];
      if (metric === undefined) throw new Error('指标创建失败。');

      const firstEntryResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/goals/${goal.id}/progress-entries`,
        headers: { 'if-match': `"${String(created.goalVersion)}"` },
        payload: {
          expectedVersion: created.goalVersion,
          metricId: metric.id,
          value: 1,
          recordedAt: '2026-09-10T10:00:00.000Z',
          note: '第一周',
        },
      });
      const firstEntry = GoalMetricsStateEnvelopeSchema.parse(firstEntryResponse.json()).data;
      expect(firstEntry).toMatchObject({ autoProgress: 50, displayProgress: 50 });
      expect(firstEntry.metrics[0]).toMatchObject({ latestValue: 1, progressPercent: 50 });

      const manual = GoalEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/goals/${goal.id}/set-progress`,
            headers: { 'if-match': `"${String(firstEntry.goalVersion)}"` },
            payload: { expectedVersion: firstEntry.goalVersion, value: 80 },
          })
        ).json(),
      ).data;
      const secondEntryResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/goals/${goal.id}/progress-entries`,
        headers: { 'if-match': `"${String(manual.version)}"` },
        payload: {
          expectedVersion: manual.version,
          metricId: metric.id,
          value: 1.5,
          recordedAt: '2026-09-20T10:00:00.000Z',
        },
      });
      const secondEntry = GoalMetricsStateEnvelopeSchema.parse(secondEntryResponse.json()).data;
      expect(secondEntry).toMatchObject({
        autoProgress: 75,
        displayProgress: 80,
        progressMode: 'MANUAL_OVERRIDE',
      });

      const updatedResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/goal-metrics/${metric.id}`,
        headers: { 'if-match': `"${String(secondEntry.goalVersion)}"` },
        payload: {
          expectedVersion: secondEntry.goalVersion,
          name: '累计减重（公斤）',
          targetValue: 3,
        },
      });
      const updated = GoalMetricsStateEnvelopeSchema.parse(updatedResponse.json()).data;
      expect(updated.metrics[0]).toMatchObject({
        name: '累计减重（公斤）',
        targetValue: 3,
        progressPercent: 50,
      });
      expect(updated).toMatchObject({ autoProgress: 50, displayProgress: 80 });

      const staleDelete = await app.inject({
        method: 'DELETE',
        url: `/api/v1/goal-metrics/${metric.id}`,
        headers: { 'if-match': `"${String(secondEntry.goalVersion)}"` },
        payload: { expectedVersion: secondEntry.goalVersion },
      });
      expect(staleDelete.statusCode).toBe(409);
      const deletedResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/goal-metrics/${metric.id}`,
        headers: { 'if-match': `"${String(updated.goalVersion)}"` },
        payload: { expectedVersion: updated.goalVersion },
      });
      const deleted = GoalMetricsStateEnvelopeSchema.parse(deletedResponse.json()).data;
      expect(deleted.metrics).toEqual([]);
      expect(deleted).toMatchObject({ autoProgress: 0, displayProgress: 80 });
      expect(deleted.entries).toHaveLength(2);
      expect(deleted.entries.every((entry) => entry.metricId === null)).toBe(true);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });

  it('exposes the unified recurrence modification protocol with optimistic rule versions', async () => {
    const temporary = await createTestDataDirectory();
    const clock = new FixedClock(new Date('2026-09-03T00:00:00.000Z'));
    const runtime = new LocalRuntime({ bootstrapPath: `${temporary.path}/bootstrap.json`, clock });
    const app = await buildApp({ runtime });
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v1/setup/initialize',
        payload: { dataDirectory: `${temporary.path}/data`, includeDemoData: false },
      });
      const category = CategoriesEnvelopeSchema.parse(
        (await app.inject({ method: 'GET', url: '/api/v1/categories' })).json(),
      ).data.find((item) => item.parentArea === 'LIFE');
      if (category === undefined) throw new Error('测试缺少生活分类。');
      const event = EventEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/events',
            payload: {
              categoryId: category.id,
              title: '重复散步',
              startAt: '2026-09-03T01:00:00.000Z',
              endAt: '2026-09-03T01:30:00.000Z',
              eventType: 'GENERAL',
              priority: 'NORMAL',
              allowOverlap: false,
            },
          })
        ).json(),
      ).data;
      const ruleResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/recurrence-rules',
        payload: {
          targetType: 'EVENT_TEMPLATE',
          targetEntityId: event.id,
          rrule: 'FREQ=DAILY',
          dtstartLocal: '2026-09-03T09:00',
          generationHorizonDays: 7,
        },
      });
      const rule = RecurrenceRuleEnvelopeSchema.parse(ruleResponse.json()).data;
      const targetRule = RecurrenceRuleEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/recurrence-rules/by-target/${event.id}`,
          })
        ).json(),
      ).data;
      expect(targetRule.id).toBe(rule.id);
      const occurrences = RecurrenceOccurrencesEnvelopeSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/recurrence-rules/${rule.id}/occurrences`,
          })
        ).json(),
      ).data;
      const second = occurrences[1];
      if (second === undefined) throw new Error('测试缺少第二个重复实例。');

      const modifiedResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/recurrence-rules/${rule.id}/modify`,
        headers: { 'if-match': `"${String(rule.version)}"` },
        payload: {
          expectedVersion: rule.version,
          action: 'ONLY_THIS',
          recurrenceKey: second.recurrenceKey,
          override: { title: '只改这次' },
        },
      });
      expect(modifiedResponse.statusCode).toBe(200);
      expect(RecurrenceRuleEnvelopeSchema.parse(modifiedResponse.json()).data.version).toBe(
        rule.version + 1,
      );
      expect(runtime.actions?.getEvent(second.generatedEntityId ?? '')?.title).toBe('只改这次');
      const stale = await app.inject({
        method: 'POST',
        url: `/api/v1/recurrence-rules/${rule.id}/modify`,
        headers: { 'if-match': `"${String(rule.version)}"` },
        payload: {
          expectedVersion: rule.version,
          action: 'SKIP_ONCE',
          recurrenceKey: second.recurrenceKey,
        },
      });
      expect(stale.statusCode).toBe(409);
    } finally {
      await app.close();
      runtime.close();
      await temporary.cleanup();
    }
  });
});
