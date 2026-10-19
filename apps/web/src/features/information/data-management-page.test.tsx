// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataManagementPage } from './data-management-page.js';

const mocks = vi.hoisted<{
  changeSets: Record<string, unknown>[];
  recycle: Record<string, unknown>[];
  versions: Record<string, unknown>[];
  previewMutate: ReturnType<typeof vi.fn>;
  previewData: unknown;
  previewError: Error | null;
  previewPending: boolean;
  executeMutate: ReturnType<typeof vi.fn>;
  executeError: Error | null;
  executePending: boolean;
  searchResults: Record<string, unknown>[];
}>(() => ({
  changeSets: [],
  recycle: [],
  versions: [],
  previewMutate: vi.fn(),
  previewData: undefined,
  previewError: null,
  previewPending: false,
  executeMutate: vi.fn(),
  executeError: null,
  executePending: false,
  searchResults: [],
}));

vi.mock('./api.js', () => ({
  useAttachment: (id: string | undefined) => ({
    data:
      id === undefined
        ? undefined
        : {
            id,
            originalName: 'A8-行程.pdf',
            mediaType: 'application/pdf',
            extension: '.pdf',
            sizeBytes: 2048,
            description: '行程附件',
            status: 'READY',
          },
    isError: false,
  }),
  useChangeSets: () => ({ data: mocks.changeSets, isLoading: false, isError: false }),
  useRecycleBin: () => ({ data: mocks.recycle, isLoading: false, isError: false }),
  useEntityVersions: () => ({ data: mocks.versions, isLoading: false, isError: false }),
  useHistoryAction: () => ({ isPending: false, isError: false, error: null, mutate: vi.fn() }),
  useRestoreRecycleItem: () => ({ isPending: false, mutate: vi.fn() }),
  useVersionPreview: () => ({
    isPending: mocks.previewPending,
    isError: mocks.previewError !== null,
    error: mocks.previewError,
    data: mocks.previewData,
    mutate: mocks.previewMutate,
  }),
  useExecuteRestore: () => ({
    isPending: mocks.executePending,
    isError: mocks.executeError !== null,
    error: mocks.executeError,
    mutate: mocks.executeMutate,
  }),
  useSearch: (query: string) => ({
    data: query.trim().length > 0 ? mocks.searchResults : undefined,
    isLoading: false,
    isError: false,
  }),
  purgeRecycleItem: vi.fn(),
}));

vi.mock('../time-system/today/schedule-history-drawer.js', () => ({
  ScheduleHistoryDrawer: ({ taskTitle }: { taskTitle: string }) => (
    <div data-testid="schedule-history-drawer">调度历史：{taskTitle}</div>
  ),
}));

vi.mock('../settings/api.js', () => ({
  useBackups: () => ({ data: [], isLoading: false }),
  useCreateBackup: () => ({ isPending: false, mutate: vi.fn(), data: null }),
  useDemoData: () => ({ data: { exists: false, recordCount: 0 }, isLoading: false }),
  useSetupStatus: () => ({ data: { dataDirectory: 'C:\\data' }, isError: false }),
}));

vi.mock('../../widgets/system-status-panel.js', () => ({
  SystemStatusPanel: () => null,
}));

const changeSet = {
  id: '01J9CS000000000000000000001',
  source: 'USER',
  summary: '更新任务',
  riskLevel: 'LOW_WRITE',
  status: 'APPLIED',
  operationCount: 1,
  createdAt: '2026-08-30T08:00:00.000Z',
  entityId: '01J5TASK000000000000000000',
  entityVersion: 3,
  canUndo: false,
  canRedo: false,
};

const versionsFixture = [
  {
    entityVersion: 3,
    source: 'USER',
    snapshot: null,
    createdAt: '2026-08-30T09:00:00.000Z',
    changeSetId: 'cs3',
    summary: '更新标题',
    historyKind: 'CANONICAL',
    restoreEligibility: 'ELIGIBLE',
  },
  {
    entityVersion: 2,
    source: 'USER',
    snapshot: null,
    createdAt: '2026-08-30T08:30:00.000Z',
    changeSetId: 'cs2',
    summary: '更新标题',
    historyKind: 'BASELINE',
    restoreEligibility: 'ELIGIBLE',
  },
  {
    entityVersion: 1,
    source: 'SYSTEM',
    snapshot: null,
    createdAt: '2026-08-30T08:00:00.000Z',
    changeSetId: null,
    summary: null,
    historyKind: 'AUDIT_ONLY',
    restoreEligibility: 'UNVERIFIED',
  },
];

const confirmation = {
  id: '01J9CONF0000000000000000001',
  token: 'once-token',
  preview: {
    impact: '恢复到版本 2 会生成一个新的历史版本。',
    entityId: '01J5TASK000000000000000000',
    expectedVersion: 3,
    targetVersion: 2,
    changes: [
      { field: 'title', before: '当前标题', after: '历史标题' },
      { field: 'priority', before: 'LOW', after: 'HIGH' },
    ],
  },
};

const withError = (message: string, code: string): Error =>
  Object.assign(new Error(message), { code });

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DataManagementPage />
    </QueryClientProvider>,
  );
};

const openHistory = async () => {
  await userEvent.click(screen.getByRole('button', { name: '版本' }));
  await screen.findByText('对象版本历史');
};

describe('DataManagementPage history closure', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.history.replaceState({}, '', '/data-management');
    vi.clearAllMocks();
    mocks.changeSets = [changeSet];
    mocks.recycle = [];
    mocks.versions = versionsFixture;
    mocks.previewData = undefined;
    mocks.previewError = null;
    mocks.previewPending = false;
    mocks.executeError = null;
    mocks.executePending = false;
    mocks.searchResults = [];
  });

  it('labels BASELINE and CANONICAL versions as trusted and offers restore', async () => {
    renderPage();
    await openHistory();
    expect(screen.getByText('可信基线版本')).toBeInTheDocument();
    expect(screen.getByText('可信历史版本')).toBeInTheDocument();
    // only version 2 is older than the current version and eligible
    expect(screen.getAllByRole('button', { name: '恢复此版本' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '查看变更' })).toHaveLength(1);
  });

  it('labels AUDIT_ONLY / UNVERIFIED as audit-only and never offers restore', async () => {
    renderPage();
    await openHistory();
    expect(screen.getByText('旧版审计')).toBeInTheDocument();
    expect(screen.getByText('旧版历史仅供审计，无法可靠恢复。')).toBeInTheDocument();
    // the unverified version 1 exposes neither restore nor change view
    expect(screen.getAllByRole('button', { name: '恢复此版本' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '查看变更' })).toHaveLength(1);
  });

  it('shows field-level before/after when viewing changes', async () => {
    mocks.previewMutate.mockImplementation(() => {
      mocks.previewData = confirmation;
    });
    renderPage();
    await openHistory();
    await userEvent.click(screen.getByRole('button', { name: '查看变更' }));
    await waitFor(() => {
      expect(screen.getAllByText('当前值')).toHaveLength(2);
      expect(screen.getAllByText('目标历史版本值')).toHaveLength(2);
    });
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByText('当前标题')).toBeInTheDocument();
    expect(screen.getByText('历史标题')).toBeInTheDocument();
    expect(screen.getByText('优先级')).toBeInTheDocument();
    expect(screen.getByText('恢复到版本 2 会生成一个新的历史版本。')).toBeInTheDocument();
  });

  it('requires explicit confirmation before executing a restore', async () => {
    mocks.previewMutate.mockImplementation(() => {
      mocks.previewData = confirmation;
    });
    renderPage();
    await openHistory();
    await userEvent.click(screen.getByRole('button', { name: '恢复此版本' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '确认恢复此版本' })).toBeInTheDocument();
    });
    expect(mocks.executeMutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '确认恢复此版本' }));
    await waitFor(() => {
      expect(mocks.executeMutate).toHaveBeenCalledWith(confirmation, expect.anything());
    });
  });

  it('surfaces RESTORE_CONFLICT to the user', async () => {
    mocks.previewMutate.mockImplementation(() => {
      mocks.previewError = withError('请求状态冲突', 'RESTORE_CONFLICT');
    });
    renderPage();
    await openHistory();
    await userEvent.click(screen.getByRole('button', { name: '查看变更' }));
    await waitFor(() => {
      expect(
        screen.getByText(
          /该版本无法恢复：目标历史版本引用的分类、任务、附件、标签或日程当前不可用/,
        ),
      ).toBeInTheDocument();
    });
  });

  it('surfaces ENTITY_VERSION_UNVERIFIED to the user', async () => {
    mocks.previewMutate.mockImplementation(() => {
      mocks.previewError = withError('请求状态冲突', 'ENTITY_VERSION_UNVERIFIED');
    });
    renderPage();
    await openHistory();
    await userEvent.click(screen.getByRole('button', { name: '查看变更' }));
    await waitFor(() => {
      expect(screen.getByText('该历史版本无法确认完整性，因此不能恢复。')).toBeInTheDocument();
    });
  });

  it('keeps recent operations and recycle-bin flows intact', async () => {
    mocks.recycle = [
      {
        id: '01J9REC00000000000000000001',
        entityType: 'TASK',
        version: 2,
        title: '已删除任务',
        deletedAt: '2026-08-29T08:00:00.000Z',
        purgeAfter: '2026-09-28T08:00:00.000Z',
      },
    ];
    renderPage();
    expect(screen.getByText('更新任务')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '版本' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /回收站/ }));
    expect(screen.getByText('已删除任务')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '恢复' })).toBeInTheDocument();
  });

  it('opens attachment metadata from a stable search target without exposing storage data', () => {
    window.history.replaceState(
      {},
      '',
      '/data-management?entityType=ATTACHMENT&entityId=attachment-1',
    );
    renderPage();
    expect(screen.getByRole('heading', { name: 'A8-行程.pdf' })).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下载附件' })).toHaveAttribute(
      'href',
      '/api/v1/attachments/attachment-1/content',
    );
    expect(screen.queryByText(/storage/i)).not.toBeInTheDocument();
  });

  it('finds a completed non-current-date task through the stable search entry', async () => {
    mocks.changeSets = [];
    mocks.searchResults = [
      {
        entityId: '01J5TASK000000000000000099',
        entityType: 'TASK',
        categoryId: 'category-life',
        title: '三个月前已完成任务',
        snippet: '',
        updatedAt: '2026-05-30T08:00:00.000Z',
      },
    ];
    renderPage();
    await userEvent.type(screen.getByRole('searchbox', { name: '查找任务调度历史' }), '三个月前');
    expect(screen.getByText('三个月前已完成任务')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '调度历史' }));
    expect(screen.getByTestId('schedule-history-drawer')).toHaveTextContent(
      '调度历史：三个月前已完成任务',
    );
  });
});
