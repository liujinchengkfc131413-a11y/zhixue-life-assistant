import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

type RecurrenceAction =
  'ONLY_THIS' | 'THIS_AND_FUTURE' | 'ENTIRE_SERIES' | 'SKIP_ONCE' | 'END_RECURRENCE';

const applyAction = async (
  page: Page,
  input: { title: string; dialogName: '任务详情' | '日程详情'; action: RecurrenceAction },
) => {
  await page.getByText(input.title, { exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: input.dialogName });
  await expect(dialog.getByRole('heading', { name: '修改重复事项' })).toBeVisible();
  await expect(dialog.getByLabel('重复修改范围').locator('option')).toHaveCount(5);
  await dialog.getByLabel('重复修改范围').selectOption(input.action);
  if (input.action === 'THIS_AND_FUTURE' || input.action === 'ENTIRE_SERIES') {
    await dialog.getByLabel('重复规则').fill('FREQ=WEEKLY');
  }
  page.once('dialog', async (confirmation) => {
    await confirmation.accept();
  });
  await dialog.getByRole('button', { name: '应用重复修改' }).click();
  await expect(dialog).toHaveCount(0);
};

test('A4 Task/Event selector executes all five recurrence behaviors through the real API', async ({
  page,
}) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(12_000);
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      failedResponses.push(`${String(response.status())} ${response.url()}`);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '开始使用生活助手' })).toBeVisible();
  await page.getByLabel('本地数据保存位置').fill(resolve('test-results/e2e/data-a4'));
  for (let step = 1; step < 7; step += 1) {
    await page.getByRole('button', { name: /(继续|跳过 AI)/ }).click();
  }
  const finishSetup = page.getByRole('button', { name: '完成并进入 Today' });
  if (await finishSetup.isVisible()) await finishSetup.click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  consoleErrors.length = 0;
  failedResponses.length = 0;

  const fixtures = await page.evaluate(async () => {
    interface EntityEnvelope {
      data: { id: string };
    }
    interface RuleEnvelope {
      data: { id: string; rrule: string; isActive: boolean };
    }
    interface OccurrencesEnvelope {
      data: { recurrenceKey: string; generatedEntityId: string | null; status: string }[];
    }
    const session = (await (await fetch('/api/v1/session')).json()) as {
      data: { csrfToken: string };
    };
    const categories = (await (await fetch('/api/v1/categories')).json()) as {
      data: { id: string; parentArea: string }[];
    };
    const category = categories.data.find((item) => item.parentArea === 'LIFE');
    if (category === undefined) throw new Error('A4 E2E category not found');
    const shifted = new Date(Date.now() + 8 * 3_600_000);
    const dayDate = new Date(
      Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
    );
    const localDay = (offset: number) => {
      const value = new Date(dayDate.getTime() + offset * 86_400_000);
      return `${String(value.getUTCFullYear()).padStart(4, '0')}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
    };
    const day = localDay(0);
    const yesterday = localDay(-1);
    const request = async <T>(url: string, body: unknown): Promise<T> => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': session.data.csrfToken,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`${url} failed: ${String(response.status)}`);
      return (await response.json()) as T;
    };
    const createRepeatedEvent = async (title: string, hour: number) => {
      const hh = String(hour).padStart(2, '0');
      const source = await request<EntityEnvelope>('/api/v1/events', {
        categoryId: category.id,
        title,
        startAt: new Date(`${yesterday}T${hh}:00:00+08:00`).toISOString(),
        endAt: new Date(`${yesterday}T${hh}:30:00+08:00`).toISOString(),
        eventType: 'GENERAL',
        priority: 'NORMAL',
        isImmovable: false,
        allowOverlap: true,
      });
      const rule = await request<RuleEnvelope>('/api/v1/recurrence-rules', {
        targetType: 'EVENT_TEMPLATE',
        targetEntityId: source.data.id,
        rrule: 'FREQ=DAILY',
        dtstartLocal: `${yesterday}T${hh}:00`,
        generationHorizonDays: 7,
      });
      const occurrences = (await (
        await fetch(`/api/v1/recurrence-rules/${rule.data.id}/occurrences`)
      ).json()) as OccurrencesEnvelope;
      const current = occurrences.data.find((item) => item.recurrenceKey === `${day}T${hh}:00`);
      if (current?.generatedEntityId === null || current === undefined)
        throw new Error(`A4 E2E current occurrence not found: ${title}`);
      return {
        title,
        sourceId: source.data.id,
        entityId: current.generatedEntityId,
        ruleId: rule.data.id,
        recurrenceKey: current.recurrenceKey,
      };
    };

    const task = await request<EntityEnvelope>('/api/v1/tasks', {
      categoryId: category.id,
      title: 'A4 Task 仅本次',
      priority: 'NORMAL',
      dueAt: new Date(`${day}T20:00:00+08:00`).toISOString(),
      estimatedMinutes: 30,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'LIFE',
    });
    const taskRule = await request<RuleEnvelope>('/api/v1/recurrence-rules', {
      targetType: 'TASK_TEMPLATE',
      targetEntityId: task.data.id,
      rrule: 'FREQ=DAILY',
      dtstartLocal: `${day}T20:00`,
      generationHorizonDays: 7,
    });

    return {
      task: { title: 'A4 Task 仅本次', entityId: task.data.id, ruleId: taskRule.data.id },
      split: await createRepeatedEvent('A4 Event 本次及以后', 2),
      entire: await createRepeatedEvent('A4 Event 整个系列', 4),
      skip: await createRepeatedEvent('A4 Event 跳过本次', 6),
      end: await createRepeatedEvent('A4 Event 结束重复', 8),
    };
  });

  await page.reload();
  await page.getByText(fixtures.task.title, { exact: true }).first().click();
  const taskDialog = page.getByRole('dialog', { name: '任务详情' });
  await expect(taskDialog.getByLabel('重复修改范围').locator('option')).toHaveCount(5);
  await taskDialog.getByLabel('标题').fill('A4 Task 仅本次已修改');
  page.once('dialog', async (confirmation) => {
    await confirmation.accept();
  });
  await taskDialog.getByRole('button', { name: '应用重复修改' }).click();
  await expect(taskDialog).toHaveCount(0);

  await applyAction(page, {
    title: fixtures.split.title,
    dialogName: '日程详情',
    action: 'THIS_AND_FUTURE',
  });
  await applyAction(page, {
    title: fixtures.entire.title,
    dialogName: '日程详情',
    action: 'ENTIRE_SERIES',
  });
  await applyAction(page, {
    title: fixtures.skip.title,
    dialogName: '日程详情',
    action: 'SKIP_ONCE',
  });
  await applyAction(page, {
    title: fixtures.end.title,
    dialogName: '日程详情',
    action: 'END_RECURRENCE',
  });

  const result = await page.evaluate(async (input) => {
    const json = async <T>(url: string): Promise<T> => (await (await fetch(url)).json()) as T;
    const taskEnvelope = await json<{ data: { id: string; title: string }[] }>(
      '/api/v1/tasks?includeCompleted=true',
    );
    const splitRule = await json<{ data: { id: string; rrule: string } }>(
      `/api/v1/recurrence-rules/by-target/${input.split.sourceId}`,
    );
    const entireRule = await json<{ data: { id: string; rrule: string } }>(
      `/api/v1/recurrence-rules/by-target/${input.entire.sourceId}`,
    );
    const skipOccurrences = await json<{
      data: { recurrenceKey: string; status: string }[];
    }>(`/api/v1/recurrence-rules/${input.skip.ruleId}/occurrences`);
    const endRule = await json<{ data: { isActive: boolean } }>(
      `/api/v1/recurrence-rules/${input.end.ruleId}`,
    );
    const endOccurrences = await json<{
      data: { recurrenceKey: string; status: string }[];
    }>(`/api/v1/recurrence-rules/${input.end.ruleId}/occurrences`);
    return {
      taskTitle: taskEnvelope.data.find((item) => item.id === input.task.entityId)?.title,
      splitRule: splitRule.data,
      entireRule: entireRule.data,
      skipStatus: skipOccurrences.data.find(
        (item) => item.recurrenceKey === input.skip.recurrenceKey,
      )?.status,
      endActive: endRule.data.isActive,
      endHasGeneratedFuture: endOccurrences.data.some(
        (item) => item.recurrenceKey > input.end.recurrenceKey && item.status === 'GENERATED',
      ),
    };
  }, fixtures);

  expect(result).toMatchObject({
    taskTitle: 'A4 Task 仅本次已修改',
    splitRule: { id: expect.not.stringMatching(fixtures.split.ruleId), rrule: 'FREQ=WEEKLY' },
    entireRule: { id: fixtures.entire.ruleId, rrule: 'FREQ=WEEKLY' },
    skipStatus: 'SKIPPED',
    endActive: false,
    endHasGeneratedFuture: false,
  });
  expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] });
  await page.screenshot({
    path: resolve(tmpdir(), 'life-assistant-a4-recurrence-selector.png'),
    fullPage: false,
  });
});
