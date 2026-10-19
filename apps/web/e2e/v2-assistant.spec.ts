import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { evidenceDirectoryFor } from './evidence-directory';
import { completeSetup } from './helpers/complete-setup.js';

const evidenceDirectory = evidenceDirectoryFor('docs/design/v2/assistant');
const dataDirectory = resolve('test-results/v2-assistant/data');
const viewports = [
  { width: 1448, height: 1086 },
  { width: 1536, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1100, height: 900 },
] as const;

interface FixtureSession {
  id: string;
  title: string;
  providerConfigId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  lastMessageAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface FixtureMessage {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM';
  content: unknown;
  plainText: string;
  status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  completedAt: string | null;
  sources: { title: string; url: string; retrievedAt: string }[];
}

const sessions: FixtureSession[] = [
  {
    id: 'session-plan',
    title: '本周计划重排',
    providerConfigId: 'provider-phase-5',
    status: 'ACTIVE',
    lastMessageAt: '2026-08-26T02:28:00.000Z',
    version: 1,
    createdAt: '2026-08-26T02:20:00.000Z',
    updatedAt: '2026-08-26T02:28:00.000Z',
  },
  {
    id: 'session-life',
    title: '整理生活目标',
    providerConfigId: 'provider-phase-5',
    status: 'ACTIVE',
    lastMessageAt: '2026-08-25T09:16:00.000Z',
    version: 1,
    createdAt: '2026-08-25T09:10:00.000Z',
    updatedAt: '2026-08-25T09:16:00.000Z',
  },
] as const;

const planMessages: FixtureMessage[] = [
  {
    id: 'message-user',
    role: 'USER',
    content: '帮我根据优先级重排本周计划，重点推进工作项目 A 和健康目标。',
    plainText: '帮我根据优先级重排本周计划，重点推进工作项目 A 和健康目标。',
    status: 'COMPLETED',
    createdAt: '2026-08-26T02:24:00.000Z',
    completedAt: '2026-08-26T02:24:00.000Z',
    sources: [],
  },
  {
    id: 'message-assistant',
    role: 'ASSISTANT',
    content: [{ type: 'change_set', changeSetId: 'change-phase-5' }],
    plainText:
      '好的，知雪。我基于你的目标优先级、任务量、时间与能量曲线，为你重排了本周计划，聚焦工作项目 A 与健康目标。\n\n我保留了必要的恢复时间，并把低优先级任务移到精力波谷。',
    status: 'COMPLETED',
    createdAt: '2026-08-26T02:28:00.000Z',
    completedAt: '2026-08-26T02:28:00.000Z',
    sources: [
      {
        title: '本周计划',
        url: 'https://example.com/plan',
        retrievedAt: '2026-08-26T02:27:00.000Z',
      },
    ],
  },
  {
    id: 'message-failed',
    role: 'ASSISTANT',
    content: [],
    plainText: '',
    status: 'FAILED',
    createdAt: '2026-08-26T02:29:00.000Z',
    completedAt: '2026-08-26T02:29:00.000Z',
    sources: [],
  },
];

const waitForStablePage = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.waitForTimeout(200);
};

const installAssistantFixture = async (page: Page) => {
  let currentMessages = [...planMessages];
  let changeSetStatus: 'APPLIED' | 'REVERTED' = 'APPLIED';
  let currentSessions = [...sessions];

  await page.route('**/api/v1/ai/providers', async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: 'provider-phase-5',
            providerType: 'OPENAI',
            displayName: 'Phase 5 Fixture',
            baseUrl: null,
            modelId: 'fixture-model',
            hasCredential: true,
            capabilities: {
              chat: true,
              streaming: true,
              toolCalling: true,
              nativeWebSearch: false,
            },
            isDefault: true,
            lastVerifiedAt: '2026-08-26T01:00:00.000Z',
            lastError: null,
            version: 1,
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/ai/chats', async (route) => {
    if (route.request().method() === 'POST') {
      const created: FixtureSession = {
        id: 'session-created',
        title: '新会话验收',
        providerConfigId: 'provider-phase-5',
        status: 'ACTIVE',
        lastMessageAt: null,
        version: 1,
        createdAt: '2026-08-26T02:35:00.000Z',
        updatedAt: '2026-08-26T02:35:00.000Z',
      };
      currentSessions = [created, ...currentSessions];
      await route.fulfill({ json: { data: created } });
      return;
    }
    await route.fulfill({ json: { data: currentSessions } });
  });
  await page.route('**/api/v1/ai/chats/*/messages', async (route) => {
    const request = route.request();
    const isLifeSession = request.url().includes('session-life');
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { content: string };
      currentMessages = [
        ...currentMessages,
        {
          id: 'message-keyboard',
          role: 'USER',
          content: body.content,
          plainText: body.content,
          status: 'COMPLETED',
          createdAt: '2026-08-26T02:34:00.000Z',
          completedAt: '2026-08-26T02:34:00.000Z',
          sources: [],
        },
      ];
      await route.fulfill({
        json: {
          data: {
            userMessageId: 'message-keyboard',
            assistantMessageId: 'message-stream',
            runId: 'run-phase-5',
            status: 'QUEUED',
          },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        data: isLifeSession
          ? [
              {
                id: 'message-life',
                role: 'USER',
                content: '帮我把生活目标拆成计划。',
                plainText: '帮我把生活目标拆成计划。',
                status: 'COMPLETED',
                createdAt: '2026-08-25T09:16:00.000Z',
                completedAt: '2026-08-25T09:16:00.000Z',
                sources: [],
              },
            ]
          : currentMessages,
      },
    });
  });
  await page.route('**/api/v1/ai/runs/run-phase-5/events', async (route) => {
    await route.fulfill({
      body: 'event: ai.run.completed\ndata: {}\n\n',
      contentType: 'text/event-stream',
    });
  });
  await page.route('**/api/v1/ai/change-sets/change-phase-5', async (route) => {
    await route.fulfill({
      json: {
        data: {
          id: 'change-phase-5',
          summary: '重排本周计划（聚焦重点）',
          status: changeSetStatus,
          operations: [
            { sequence: 1, operation: '更新计划优先级', entityId: 'plan-work-a' },
            { sequence: 2, operation: '保留健康目标时段', entityId: 'goal-health' },
          ],
        },
      },
    });
  });
  await page.route('**/api/v1/ai/change-sets/change-phase-5:undo', async (route) => {
    changeSetStatus = 'REVERTED';
    await route.fulfill({ json: { data: { id: 'change-phase-5', status: 'REVERTED' } } });
  });
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('initializes an isolated Phase 5 data directory', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await completeSetup(page, dataDirectory);
});

test('renders the two-region assistant and master-derived background at five viewports', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const metrics: Record<string, unknown>[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await installAssistantFixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/assistant');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'ai');
    await expect(page.getByRole('heading', { name: 'AI 助手', exact: true })).toBeVisible();
    await expect(page.getByRole('complementary', { name: '会话列表' })).toBeVisible();
    await expect(page.getByRole('region', { name: '当前对话' })).toBeVisible();
    await expect(page.getByText('AI 已完成一组结构化变更')).toBeVisible();
    await expect(page.getByText('检索于 2026/8/26 10:27')).toBeVisible();
    await waitForStablePage(page);
    const layout = await page.evaluate(() => {
      const atmosphere = document.querySelector<HTMLElement>('.theme-atmosphere');
      const selectedCard = document.querySelector<HTMLElement>(
        '.assistant-session-card[data-selected="true"]',
      );
      const composer = document.querySelector<HTMLElement>('.assistant-composer');
      if (!atmosphere || !selectedCard || !composer) throw new Error('缺少 Phase 5 视觉验收节点。');
      return {
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        atmosphereAnimation: getComputedStyle(atmosphere).animationName,
        atmosphereBackground: getComputedStyle(atmosphere).backgroundImage,
        selectedCardShadow: getComputedStyle(selectedCard).boxShadow,
        composerShadow: getComputedStyle(composer).boxShadow,
        workspaceColumns: (() => {
          const workspace = document.querySelector<HTMLElement>('.assistant-workspace');
          if (!workspace) throw new Error('缺少 AI 工作区。');
          return getComputedStyle(workspace).gridTemplateColumns;
        })(),
      };
    });
    expect(layout.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(layout.atmosphereAnimation).toBe('none');
    expect(layout.atmosphereBackground).toContain('vision-ai-arc-horizon-v2-');
    expect(layout.selectedCardShadow).not.toBe('none');
    expect(layout.composerShadow).not.toBe('none');
    const screenshot = `assistant-${String(viewport.width)}x${String(viewport.height)}.png`;
    await page.screenshot({ path: resolve(evidenceDirectory, screenshot), fullPage: true });
    metrics.push({ viewport, screenshot, ...layout });
  }

  await writeFile(
    resolve(evidenceDirectory, 'assistant-metrics.json'),
    `${JSON.stringify({ fixture: dataDirectory, metrics }, null, 2)}\n`,
    'utf8',
  );
  expect(consoleErrors).toEqual([]);
});

test('preserves session switching, keyboard send, operation expansion, failure, and undo', async ({
  page,
}) => {
  await installAssistantFixture(page);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/assistant');

  await page.getByRole('button', { name: /整理生活目标/ }).click();
  await expect(
    page.getByRole('region', { name: '当前对话' }).getByText('帮我把生活目标拆成计划。'),
  ).toBeVisible();
  await page.getByRole('button', { name: /本周计划重排/ }).click();
  await expect(page.getByText('生成失败', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '查看详情' }).click();
  await expect(page.getByRole('region', { name: '操作详情' })).toContainText('更新计划优先级');
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('操作结果 · 已撤销')).toBeVisible();

  const composer = page.getByLabel('消息');
  await composer.fill('请继续检查本周缓冲时间。');
  await composer.press('Control+Enter');
  // 会话卡片摘要会乐观更新为最新消息文本，与对话消息副本同文，
  // 断言必须限定在“当前对话”区域，避免 strict mode 歧义（时序竞态）。
  await expect(
    page.getByRole('region', { name: '当前对话' }).getByText('请继续检查本周缓冲时间。'),
  ).toBeVisible();

  await page.getByLabel('会话标题').fill('新会话验收');
  await page.getByRole('button', { name: '新建会话' }).click();
  await expect(page.getByRole('heading', { name: '新会话验收' })).toBeVisible();
});
