import { expect, type Page } from '@playwright/test';

export const completeSetup = async (
  page: Page,
  dataDirectory: string,
  options: { includeDemoData?: boolean } = {},
): Promise<void> => {
  await expect(page.getByRole('heading', { name: '开始使用生活助手' })).toBeVisible();
  await page.getByLabel('本地数据保存位置').fill(dataDirectory);
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  if (options.includeDemoData === false) {
    await page.getByRole('checkbox', { name: /加载演示数据/ }).uncheck();
  }
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await page.getByRole('button', { name: '跳过 AI' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await expect(page.getByRole('heading', { name: '准备完成', exact: true })).toBeVisible();
  const setupStatus = await page.request.get('/api/v1/setup/status');
  expect(setupStatus.ok()).toBe(true);
  const setupBody = (await setupStatus.json()) as { data: { initialized: boolean } };
  expect(setupBody.data.initialized).toBe(false);
  await page.getByRole('button', { name: '完成并进入 Today' }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
};
