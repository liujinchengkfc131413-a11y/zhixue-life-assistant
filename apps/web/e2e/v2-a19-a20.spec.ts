import { expect, test } from '@playwright/test';

test('A19 no-AI quick capture keeps the item and manually creates task, shopping item, and goal', async ({
  page,
}) => {
  await page.request.post('/api/v1/setup/initialize', {
    data: {
      dataDirectory: 'test-results/v2-a19-a20/data',
      includeDemoData: false,
      backupFrequency: 'MANUAL',
      backupRetentionCount: 1,
      quickCaptureDefaultAction: 'INBOX',
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: '快速记录' }).click();
  await page
    .getByRole('textbox', { name: '记录内容' })
    .fill('周五前完成项目首页；今晚买牛奶；下个月减重两公斤。');
  await page.getByRole('button', { name: '交给 AI' }).click();
  await expect(page.getByRole('alert')).toContainText('已按原模式保留在收集箱');
  await page.getByRole('button', { name: '关闭快速记录' }).click();
  await page.getByRole('link', { name: '收集箱' }).click();
  await expect(page.getByRole('blockquote')).toContainText(
    '周五前完成项目首页；今晚买牛奶；下个月减重两公斤。',
  );

  const types = page.getByRole('combobox', { name: '结果类型' });
  await expect(types).toHaveCount(3);
  await types.nth(1).selectOption('SHOPPING_ITEM');
  await types.nth(2).selectOption('GOAL');
  await page.getByRole('button', { name: '保存处理结果' }).click();
  await expect(page.getByText('已生成：任务、购物项、目标')).toBeVisible();

  const [tasks, shopping, goals] = await Promise.all([
    page.request.get('/api/v1/tasks'),
    page.request.get('/api/v1/life/shopping/items'),
    page.request.get('/api/v1/goals'),
  ]);
  const tasksBody = (await tasks.json()) as { data: unknown };
  const shoppingBody = (await shopping.json()) as { data: unknown };
  const goalsBody = (await goals.json()) as { data: unknown };
  expect(tasksBody.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ title: '周五前完成项目首页' })]),
  );
  expect(shoppingBody.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: '今晚买牛奶' })]),
  );
  expect(goalsBody.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ title: '下个月减重两公斤。' })]),
  );
});

test('A20 renders a deterministic suggestion with evidence and does not auto-write business data', async ({
  page,
}) => {
  const before = await page.request.get('/api/v1/tasks');
  const beforeBody = (await before.json()) as { data: unknown[] };
  const beforeTasks = beforeBody.data;
  const analyzed = await page.request.post('/api/v1/ai/suggestions:analyze');
  expect(analyzed.ok()).toBe(true);
  const analyzedBody = (await analyzed.json()) as { data: { created: number } };
  expect(analyzedBody.data.created).toBeGreaterThan(0);
  const after = await page.request.get('/api/v1/tasks');
  const afterBody = (await after.json()) as { data: unknown[] };
  expect(afterBody.data).toHaveLength(beforeTasks.length);

  await page.goto('/reminders');
  const suggestion = page.locator('li.notification-row').filter({
    hasText: '[NEAR_DEADLINE] 主动建议',
  });
  await expect(suggestion).toContainText('证据对象：');
  await expect(suggestion).toContainText('需你明确执行后才会修改数据');
});
