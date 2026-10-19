import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { completeSetup } from './helpers/complete-setup.js';

test('A8 filters a tagged task through the production search dialog', async ({ page }) => {
  test.setTimeout(180_000);
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
  await completeSetup(page, resolve('test-results/e2e/data-a8'));
  consoleErrors.length = 0;
  failedResponses.length = 0;

  const fixture = await page.evaluate(async () => {
    const session = (await (await fetch('/api/v1/session')).json()) as {
      data: { csrfToken: string };
    };
    const categories = (await (await fetch('/api/v1/categories')).json()) as {
      data: { id: string; name: string; moduleType: string; parentArea: string }[];
    };
    const category = categories.data.find((item) => item.parentArea === 'WORK');
    const developmentCategory = categories.data.find((item) => item.moduleType === 'DEVELOPMENT');
    const dietCategory = categories.data.find((item) => item.moduleType === 'DIET');
    const fitnessCategory = categories.data.find((item) => item.moduleType === 'FITNESS');
    if (
      category === undefined ||
      developmentCategory === undefined ||
      dietCategory === undefined ||
      fitnessCategory === undefined
    )
      throw new Error('A8 E2E category not found');
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
    const tag = await request<{ data: { id: string } }>('/api/v1/tags', {
      name: 'A8 重点',
      colorToken: 'blue',
    });
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const task = await request<{ data: { id: string; version: number } }>('/api/v1/tasks', {
      categoryId: category.id,
      title: 'A8 Aurora 可找回任务',
      priority: 'NORMAL',
      dueAt: new Date(`${localDate}T20:00:00+08:00`).toISOString(),
      estimatedMinutes: 30,
      isFlexible: true,
      isSplittable: false,
      preferredArea: 'WORK',
    });
    const linked = await fetch(`/api/v1/entities/${task.data.id}/tags`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': session.data.csrfToken,
        'if-match': `"${String(task.data.version)}"`,
      },
      body: JSON.stringify({ tagId: tag.data.id, expectedVersion: task.data.version }),
    });
    if (!linked.ok) throw new Error(`tag link failed: ${String(linked.status)}`);
    const project = await request<{ data: { id: string } }>('/api/v1/work/dev-projects', {
      categoryId: developmentCategory.id,
      name: 'A8 ProjectAurora 直达项目',
      summary: '验证 Work 详情目标消费',
    });
    const note = await request<{ data: { id: string } }>(
      `/api/v1/work/entities/${project.data.id}/notes`,
      {
        categoryId: developmentCategory.id,
        title: 'A8 NoteAurora 所属项目笔记',
        editorMode: 'MARKDOWN',
        markdownContent: '验证笔记通过所属项目直接打开',
        role: 'TECHNICAL',
      },
    );
    const recipe = await request<{ data: { id: string } }>('/api/v1/life/diet/recipes', {
      categoryId: dietCategory.id,
      name: 'A8 RecipeAurora 搜索食谱',
      servings: 2,
      caloriesKcal: 360,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    const workoutPlan = await request<{ data: { id: string } }>('/api/v1/life/fitness/plans', {
      categoryId: fitnessCategory.id,
      name: 'A8 WorkoutAurora 搜索训练',
      description: '验证训练计划直达',
      status: 'ACTIVE',
      items: [],
    });
    const tomorrowAtNine = new Date(
      Date.parse(`${localDate}T09:00:00+08:00`) + 86_400_000,
    ).toISOString();
    const event = await request<{ data: { id: string } }>('/api/v1/events', {
      categoryId: category.id,
      title: 'A8 EventAurora 跨日期日程',
      startAt: tomorrowAtNine,
      endAt: new Date(Date.parse(tomorrowAtNine) + 3_600_000).toISOString(),
      eventType: 'GENERAL',
      priority: 'NORMAL',
    });
    return {
      taskId: task.data.id,
      projectId: project.data.id,
      noteId: note.data.id,
      recipeId: recipe.data.id,
      workoutPlanId: workoutPlan.data.id,
      eventId: event.data.id,
      categoryId: category.id,
      moduleType: category.moduleType,
      tagId: tag.data.id,
      localDate,
    };
  });

  await page.reload();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '全局搜索' }).click();
  const dialog = page.getByRole('dialog', { name: '全局搜索' });
  await dialog.getByPlaceholder(/搜索任务/).fill('Aurora');
  await dialog.getByLabel('模块').selectOption(fixture.moduleType);
  await dialog.getByLabel('分类').selectOption(fixture.categoryId);
  await dialog.getByLabel('状态').fill('TODO');
  await dialog.getByLabel('标签').selectOption(fixture.tagId);
  await dialog.getByLabel('开始日期').fill(fixture.localDate);
  await dialog.getByLabel('结束日期').fill(fixture.localDate);
  const result = dialog.getByRole('link', { name: /A8 Aurora 可找回任务/ });
  await expect(result).toHaveAttribute('href', `/?entityType=TASK&entityId=${fixture.taskId}`);
  await expect(dialog.getByLabel('分类')).toHaveValue(fixture.categoryId);
  await page.screenshot({
    path: resolve(tmpdir(), 'life-assistant-a8-search-filters.png'),
    fullPage: false,
  });
  await result.click();
  await expect(page).toHaveURL(new RegExp(`entityType=TASK&entityId=${fixture.taskId}$`));
  const taskDetail = page.getByRole('dialog', { name: '任务详情' });
  await expect(taskDetail).toBeVisible();
  await taskDetail.getByRole('button', { name: '关闭' }).click();

  await page.getByRole('button', { name: '全局搜索' }).click();
  const projectSearch = page.getByRole('dialog', { name: '全局搜索' });
  await projectSearch.getByPlaceholder(/搜索任务/).fill('ProjectAurora');
  await projectSearch.getByLabel('模块').selectOption('');
  await projectSearch.getByLabel('分类').selectOption('');
  await projectSearch.getByLabel('状态').fill('');
  await projectSearch.getByLabel('标签').selectOption('');
  await projectSearch.getByLabel('开始日期').fill('');
  await projectSearch.getByLabel('结束日期').fill('');
  await projectSearch.getByRole('link', { name: /A8 ProjectAurora 直达项目/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/work/development\\?entityType=DEV_PROJECT&entityId=${fixture.projectId}$`),
  );
  await expect(page.getByLabel('编辑项目名称')).toHaveValue('A8 ProjectAurora 直达项目');

  await page.getByRole('button', { name: '全局搜索' }).click();
  const eventSearch = page.getByRole('dialog', { name: '全局搜索' });
  await eventSearch.getByPlaceholder(/搜索任务/).fill('EventAurora');
  await eventSearch.getByRole('link', { name: /A8 EventAurora 跨日期日程/ }).click();
  await expect(page).toHaveURL(new RegExp(`entityType=EVENT&entityId=${fixture.eventId}$`));
  const eventDetail = page.getByRole('dialog', { name: '日程详情' });
  await expect(eventDetail).toBeVisible();
  await eventDetail.getByRole('button', { name: '关闭' }).click();

  await page.getByRole('button', { name: '全局搜索' }).click();
  const noteSearch = page.getByRole('dialog', { name: '全局搜索' });
  await noteSearch.getByPlaceholder(/搜索任务/).fill('NoteAurora');
  await noteSearch.getByRole('link', { name: /A8 NoteAurora 所属项目笔记/ }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/work/development\\?entityType=DEV_PROJECT&entityId=${fixture.projectId}&noteId=${fixture.noteId}$`,
    ),
  );
  await expect(page.getByLabel('笔记标题')).toHaveValue('A8 NoteAurora 所属项目笔记');

  await page.getByRole('button', { name: '全局搜索' }).click();
  const recipeSearch = page.getByRole('dialog', { name: '全局搜索' });
  await recipeSearch.getByPlaceholder(/搜索任务/).fill('RecipeAurora');
  await recipeSearch.getByRole('link', { name: /A8 RecipeAurora 搜索食谱/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/life/diet\\?entityType=RECIPE&entityId=${fixture.recipeId}$`),
  );
  await expect(page.getByLabel('食谱名称')).toHaveValue('A8 RecipeAurora 搜索食谱');

  await page.getByRole('button', { name: '全局搜索' }).click();
  const workoutSearch = page.getByRole('dialog', { name: '全局搜索' });
  await workoutSearch.getByPlaceholder(/搜索任务/).fill('WorkoutAurora');
  await workoutSearch.getByRole('link', { name: /A8 WorkoutAurora 搜索训练/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/life/fitness\\?entityType=WORKOUT_PLAN&entityId=${fixture.workoutPlanId}$`),
  );
  await expect(page.getByLabel('训练计划名称')).toHaveValue('A8 WorkoutAurora 搜索训练');
  expect({ consoleErrors, failedResponses }).toEqual({ consoleErrors: [], failedResponses: [] });
});
