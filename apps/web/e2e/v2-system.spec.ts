import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';
import { completeSetup } from './helpers/complete-setup.js';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/system');
const dataDirectory = resolve('test-results/v2-system/data');
const viewports = [
  { width: 1366, height: 768 },
  { width: 1448, height: 1086 },
  { width: 1536, height: 1024 },
  { width: 1920, height: 1080 },
] as const;

const now = Date.now();
const iso = (offsetHours: number) => new Date(now + offsetHours * 3_600_000).toISOString();

interface InboxFixture {
  id: string;
  rawText: string;
  status: 'UNPROCESSED' | 'PROCESSED';
  captureMode: 'INBOX_ONLY';
  processedChangeSetId: string | null;
  processedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  results: { entityId: string; resultType: 'TASK'; createdAt: string }[];
}

interface NotificationFixture {
  id: string;
  notificationType: 'REMINDER' | 'SYSTEM' | 'AI_SUGGESTION' | 'SCHEDULE_WARNING';
  targetEntityType: 'TASK' | null;
  targetEntityId: string | null;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING';
  scheduledAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  snoozedUntil: string | null;
}

const inboxSeed: InboxFixture[] = [
  {
    id: 'inbox-phase-6',
    rawText: '整理本周会议纪要；购买燕麦和牛奶',
    status: 'UNPROCESSED',
    captureMode: 'INBOX_ONLY',
    processedChangeSetId: null,
    processedAt: null,
    version: 1,
    createdAt: iso(-1),
    updatedAt: iso(-1),
    results: [],
  },
  {
    id: 'inbox-phase-6-secondary',
    rawText: '确认下周体检时间',
    status: 'UNPROCESSED',
    captureMode: 'INBOX_ONLY',
    processedChangeSetId: null,
    processedAt: null,
    version: 1,
    createdAt: iso(-3),
    updatedAt: iso(-3),
    results: [],
  },
];

const notificationSeed: NotificationFixture[] = [
  {
    id: 'notification-today',
    notificationType: 'REMINDER',
    targetEntityType: 'TASK',
    targetEntityId: 'task-phase-6',
    title: '提交设计复盘',
    body: '在今天下班前整理关键结论。',
    severity: 'INFO',
    scheduledAt: iso(-1),
    deliveredAt: iso(-1),
    readAt: null,
    snoozedUntil: null,
  },
  {
    id: 'notification-upcoming',
    notificationType: 'SYSTEM',
    targetEntityType: null,
    targetEntityId: null,
    title: '自动备份即将开始',
    body: '本地数据将在一小时后执行例行备份。',
    severity: 'INFO',
    scheduledAt: iso(1),
    deliveredAt: null,
    readAt: null,
    snoozedUntil: null,
  },
  {
    id: 'notification-overdue',
    notificationType: 'SCHEDULE_WARNING',
    targetEntityType: null,
    targetEntityId: null,
    title: '昨日计划仍未确认',
    body: '请检查排程冲突后再继续。',
    severity: 'WARNING',
    scheduledAt: iso(-30),
    deliveredAt: iso(-30),
    readAt: null,
    snoozedUntil: null,
  },
  {
    id: 'notification-read',
    notificationType: 'AI_SUGGESTION',
    targetEntityType: null,
    targetEntityId: null,
    title: '周计划建议已生成',
    body: '建议内容已保存到会话。',
    severity: 'INFO',
    scheduledAt: iso(-50),
    deliveredAt: iso(-50),
    readAt: iso(-48),
    snoozedUntil: null,
  },
];

const installSystemFixture = async (page: Page) => {
  let inboxItems = [...inboxSeed];
  let notifications = [...notificationSeed];
  let recycleItems = [
    {
      id: 'recycle-restore',
      entityType: 'TASK',
      version: 2,
      title: '可恢复的周报任务',
      deletedAt: iso(-12),
      purgeAfter: iso(24 * 29),
    },
    {
      id: 'recycle-purge',
      entityType: 'NOTE',
      version: 1,
      title: '废弃草稿',
      deletedAt: iso(-40),
      purgeAfter: iso(24 * 28),
    },
  ];

  await page.route('**/api/v1/inbox**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.url().includes(':process-manually')) {
      inboxItems = inboxItems.map((item) =>
        item.id === 'inbox-phase-6'
          ? {
              ...item,
              status: 'PROCESSED',
              version: 2,
              processedAt: iso(0),
              results: [{ entityId: 'task-created', resultType: 'TASK', createdAt: iso(0) }],
            }
          : item,
      );
      await route.fulfill({ json: { data: inboxItems[0], meta: {} } });
      return;
    }
    const status = new URL(request.url()).searchParams.get('status');
    await route.fulfill({
      json: {
        data: status === null ? inboxItems : inboxItems.filter((item) => item.status === status),
        meta: {},
      },
    });
  });

  await page.route('**/api/v1/change-sets', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: 'change-phase-6',
            source: 'USER',
            summary: '更新本周重点任务',
            riskLevel: 'LOW_WRITE',
            status: 'APPLIED',
            operationCount: 2,
            createdAt: iso(-2),
            entityId: 'entity-phase-6',
            entityVersion: 3,
            canUndo: true,
            canRedo: false,
          },
        ],
      },
    });
  });

  await page.route('**/api/v1/entities/entity-phase-6/versions', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            entityVersion: 3,
            source: 'USER',
            snapshot: {},
            createdAt: iso(-2),
            changeSetId: 'change-phase-6',
            summary: '当前版本',
          },
          {
            entityVersion: 2,
            source: 'USER',
            snapshot: {},
            createdAt: iso(-26),
            changeSetId: null,
            summary: '调整前版本',
          },
        ],
      },
    });
  });

  await page.route('**/api/v1/recycle-bin**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.url().includes(':restore')) {
      recycleItems = recycleItems.filter((item) => !request.url().includes(item.id));
      await route.fulfill({ json: { data: { success: true } } });
      return;
    }
    if (request.method() === 'POST' && request.url().includes(':purge-preview')) {
      await route.fulfill({
        json: {
          data: {
            id: 'confirmation-purge',
            token: 'phase-6-token',
            expiresAt: iso(1),
            preview: { impact: '永久删除后无法恢复。' },
          },
        },
      });
      return;
    }
    await route.fulfill({ json: { data: recycleItems } });
  });

  await page.route('**/api/v1/confirmations/confirmation-purge:execute', async (route) => {
    recycleItems = recycleItems.filter((item) => item.id !== 'recycle-purge');
    await route.fulfill({ json: { data: { success: true } } });
  });

  await page.route('**/api/v1/notifications**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.url().includes(':read')) {
      notifications = notifications.map((item) =>
        request.url().includes(item.id) ? { ...item, readAt: iso(0) } : item,
      );
      await route.fulfill({ json: { data: { success: true } } });
      return;
    }
    if (request.method() === 'POST' && request.url().includes(':snooze')) {
      notifications = notifications.filter((item) => !request.url().includes(item.id));
      await route.fulfill({ json: { data: { success: true } } });
      return;
    }
    await route.fulfill({ json: { data: notifications } });
  });
};

const waitForStablePage = async (page: Page): Promise<void> => {
  await page.evaluate(async () => document.fonts.ready);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.waitForTimeout(150);
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('initializes an isolated Phase 6 data directory', async ({ page }) => {
  await page.goto('/');
  await completeSetup(page, dataDirectory);
});

test('renders all System pages at four desktop viewports', async ({ page }) => {
  await installSystemFixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const metrics: Record<string, unknown>[] = [];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const target of [
      { path: '/inbox', name: 'inbox', heading: '收集箱' },
      { path: '/data-management', name: 'data', heading: '数据管理' },
      { path: '/reminders', name: 'reminders', heading: '提醒中心' },
      { path: '/settings', name: 'settings', heading: '设置' },
    ]) {
      await page.goto(target.path);
      await expect(page.getByRole('heading', { name: target.heading, exact: true })).toBeVisible();
      await waitForStablePage(page);
      const pageMetrics = await page.evaluate(() => {
        const atmosphere = document.querySelector('.app-atmosphere');
        return {
          theme: document.querySelector('.app-shell')?.getAttribute('data-theme'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          environmentLayer: atmosphere !== null,
          environmentOpacity: atmosphere === null ? '0' : getComputedStyle(atmosphere).opacity,
        };
      });
      expect(pageMetrics.theme).toBe('system');
      expect(pageMetrics.overflow).toBeLessThanOrEqual(1);
      expect(pageMetrics.environmentLayer).toBe(false);
      metrics.push({
        width: viewport.width,
        height: viewport.height,
        page: target.name,
        ...pageMetrics,
      });
      await page.screenshot({
        path: resolve(
          evidenceDirectory,
          `${target.name}-${String(viewport.width)}x${String(viewport.height)}.png`,
        ),
        fullPage: true,
      });
    }
  }

  await writeFile(
    resolve(evidenceDirectory, 'metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
});

test('keeps common settings ahead of engineering details and exposes the AI credential entry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '常规', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: '基础偏好' })).toBeVisible();
  await expect(page.getByText('应用与后台服务状态')).toHaveCount(0);

  await page.getByRole('button', { name: 'AI 与模型', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI 模型服务' })).toBeVisible();
  await expect(page.getByLabel('API Key')).toBeVisible();
  await expect(page.getByLabel('API Base URL')).toHaveCount(0);
  await page.getByLabel('服务商').selectOption('OPENAI_COMPATIBLE');
  await expect(page.getByLabel('API Base URL')).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, 'settings-ai-1536x1024.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: '高级', exact: true }).click();
  await expect(page.getByText('应用与后台服务状态')).toBeVisible();
  await expect(page.getByRole('heading', { name: '诊断信息' })).toBeVisible();
  await page.screenshot({
    path: resolve(evidenceDirectory, 'settings-advanced-1536x1024.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: '数据与备份', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本地数据' })).toBeVisible();
  await expect(page.getByRole('button', { name: '立即备份' })).toBeVisible();
});

test('preserves Inbox, Data and Reminder risk workflows', async ({ page }) => {
  await installSystemFixture(page);

  await page.goto('/inbox');
  await expect(page.getByRole('list', { name: '处理流程' })).toBeVisible();
  await page.getByRole('button', { name: '保存处理结果' }).click();
  await expect(page.getByText('处理完成')).toBeVisible();

  await page.goto('/data-management');
  await page.getByRole('button', { name: /回收站/ }).click();
  await page.getByRole('button', { name: '恢复', exact: true }).first().click();
  await expect(page.getByText('可恢复的周报任务')).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '永久删除“废弃草稿”' }).click();
  await expect(page.getByRole('heading', { name: '永久删除' })).toHaveCount(0);

  await page.goto('/reminders');
  await expect(page.getByText('未读', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('即将到来', { exact: true })).toBeVisible();
  await expect(page.getByText('已逾期', { exact: true })).toBeVisible();
  await expect(page.getByText('已读', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '标记已读' }).first().click();
  await expect(page.getByText('提交设计复盘').locator('..').getByText('已读')).toBeVisible();
  const upcomingNotification = page.locator('.notification-row').filter({
    hasText: '自动备份即将开始',
  });
  await upcomingNotification.getByRole('button', { name: '稍后提醒' }).click();
  await upcomingNotification.getByRole('button', { name: '10 分钟' }).click();
  await expect(page.getByText('自动备份即将开始')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '查看详情' })).toHaveAttribute(
    'href',
    '/?entityType=TASK&entityId=task-phase-6',
  );
});
