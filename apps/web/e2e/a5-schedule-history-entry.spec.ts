import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { completeSetup } from './helpers/complete-setup.js';

/**
 * A5 Tail Closure：调度历史的长期稳定入口（复用数据管理的任务记录）。
 *
 * 验收闭环：
 * 创建任务 → 自动排程 → 完成任务 → 任务从 Today 消失
 * → 从「数据管理」的最近操作（任务记录）重新找到该已完成任务
 * → 打开「调度历史」→ 能看到原 schedule block + TASK_COMPLETED / RELEASED 历史。
 */
const shanghaiInput = (offsetDays: number, hour: number, minute = 0): string => {
  const shifted = new Date(Date.now() + 8 * 3_600_000 + offsetDays * 86_400_000);
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

test('A5 completed task schedule history is reachable from the Data Management long-term entry', async ({
  page,
}) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(12_000);
  await page.goto('/');

  // 初始化（干净数据目录，不含演示数据）
  await completeSetup(page, resolve('test-results/e2e/data-a5'), { includeDemoData: false });

  // 1) 创建弹性任务并自动排程。块可以落在未来日期，测试不得依赖执行时刻仍有今日空位。
  await page.getByRole('button', { name: '添加事项' }).click();
  await page.getByRole('tab', { name: '弹性任务' }).click();
  await page.getByLabel('事项标题').fill('A5 历史闭环任务');
  // 周末作息模板没有 WORK 时段，弹性任务改用 LIFE 区域使其与运行日期无关地排入今日。
  await page.getByLabel('所属区域').selectOption('LIFE');
  await page.getByLabel('优先级').selectOption('URGENT');
  await page.getByLabel('截止').fill(shanghaiInput(2, 18));
  await page.getByRole('button', { name: '添加并自动安排' }).click();
  await expect(page.getByText('A5 历史闭环任务', { exact: true }).first()).toBeVisible();

  // 2) 通过真实 API 完成任务；先证明它已经拥有 schedule block，再验证完成释放与离开 Today。
  const completion = await page.evaluate(async (title) => {
    const tasksEnvelope = (await (await fetch('/api/v1/tasks?includeCompleted=true')).json()) as {
      data: { id: string; title: string; version: number }[];
    };
    const task = tasksEnvelope.data.find((item) => item.title === title);
    if (task === undefined) throw new Error('A5 E2E task not found');
    const historyEnvelope = (await (
      await fetch(`/api/v1/tasks/${task.id}/schedule-history`)
    ).json()) as { data: { entries: { newBlocks: unknown[] }[] } };
    const hadScheduledBlock = historyEnvelope.data.entries.some(
      (entry) => entry.newBlocks.length > 0,
    );
    const sessionEnvelope = (await (await fetch('/api/v1/session')).json()) as {
      data: { csrfToken: string };
    };
    const response = await fetch(`/api/v1/tasks/${task.id}/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'if-match': `"${String(task.version)}"`,
        'x-csrf-token': sessionEnvelope.data.csrfToken,
      },
      body: JSON.stringify({ expectedVersion: task.version }),
    });
    return { hadScheduledBlock, status: response.status };
  }, 'A5 历史闭环任务');
  expect(completion).toEqual({ hadScheduledBlock: true, status: 200 });
  await page.reload();
  await expect(page.getByText('A5 历史闭环任务', { exact: true })).toHaveCount(0);

  // 3) 从长期入口（数据管理 → 任务搜索）找回已完成、非当前日期任务。
  await page.getByRole('link', { name: '数据管理' }).click();
  await expect(page.getByRole('heading', { name: '数据管理' })).toBeVisible();
  await page.getByRole('searchbox', { name: '查找任务调度历史' }).fill('A5 历史闭环任务');
  const taskSearchRow = page.locator('article').filter({ hasText: 'A5 历史闭环任务' }).first();
  await expect(taskSearchRow.getByRole('button', { name: '调度历史' })).toBeVisible();

  // 4) 打开调度历史 → 可见 RELEASED / TASK_COMPLETED 与原始 schedule block
  await taskSearchRow.getByRole('button', { name: '调度历史' }).click();
  await expect(page.getByRole('dialog', { name: '任务调度历史' })).toBeVisible();
  await expect(page.getByText('已释放', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/任务完成释放/).first()).toBeVisible();
  await expect(page.getByText(/原时间：/).first()).toBeVisible();

  await page.screenshot({ path: 'test-results/e2e/a5-schedule-history-entry.png', fullPage: true });
});
