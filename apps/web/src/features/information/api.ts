import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCsrfToken } from '../../shared/api/session.js';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  if (init?.method !== undefined && init.method !== 'GET')
    headers.set('x-csrf-token', await getCsrfToken());
  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json()) as {
    data?: T;
    code?: string;
    detail?: string;
    title?: string;
  };
  if (!response.ok || payload.data === undefined) {
    const error = new Error(payload.detail ?? payload.title ?? '本地服务没有返回数据。');
    if (payload.code !== undefined) (error as { code?: string }).code = payload.code;
    throw error;
  }
  return payload.data;
};

export interface SearchItem {
  entityId: string;
  entityType: string;
  categoryId: string | null;
  ownerEntityId: string | null;
  ownerEntityType: string | null;
  title: string;
  snippet: string;
  eventAt: string | null;
  updatedAt: string;
}
export interface SearchFilters {
  entityType?: string;
  module?: string;
  categoryId?: string;
  status?: string;
  tagId?: string;
  from?: string;
  to?: string;
}
export interface AttachmentItem {
  id: string;
  originalName: string;
  mediaType: string;
  extension: string | null;
  sizeBytes: number;
  description: string | null;
  status: 'UPLOADING' | 'READY' | 'MISSING' | 'QUARANTINED';
}
export interface ChangeSetItem {
  id: string;
  source: string;
  summary: string;
  riskLevel: string;
  status: string;
  operationCount: number;
  createdAt: string;
  entityId: string | null;
  entityVersion: number | null;
  canUndo: boolean;
  canRedo: boolean;
}
export type VersionHistoryKind = 'AUDIT_ONLY' | 'BASELINE' | 'CANONICAL';
export type VersionRestoreEligibility = 'UNVERIFIED' | 'ELIGIBLE';
export interface VersionChange {
  field: string;
  before: unknown;
  after: unknown;
}
export interface EntityVersionItem {
  entityVersion: number;
  source: string;
  snapshot: unknown;
  createdAt: string;
  changeSetId: string | null;
  summary: string | null;
  historyKind: VersionHistoryKind;
  restoreEligibility: VersionRestoreEligibility;
}
interface Confirmation {
  id: string;
  token: string;
  preview: {
    impact?: string;
    entityId: string;
    expectedVersion: number;
    targetVersion: number;
    changeSetId?: string;
    changes?: readonly VersionChange[];
  };
}
export interface RecycleItem {
  id: string;
  entityType: string;
  version: number;
  title: string;
  deletedAt: string;
  purgeAfter: string;
}

export const useSearch = (query: string, input: SearchFilters | string = {}) => {
  const filters = typeof input === 'string' ? { entityType: input } : input;
  return useQuery({
    queryKey: ['search', query, filters],
    enabled: query.trim().length > 0,
    queryFn: () => {
      const parameters = new URLSearchParams({ q: query });
      const entries = Object.entries(filters) as [keyof SearchFilters, string | undefined][];
      for (const [key, value] of entries) {
        if (value !== undefined && value !== '') parameters.set(key, value);
      }
      return request<readonly SearchItem[]>(`/api/v1/search?${parameters.toString()}`);
    },
  });
};

export const useAttachment = (id: string | undefined) =>
  useQuery({
    queryKey: ['attachment', id],
    enabled: id !== undefined,
    queryFn: () => request<AttachmentItem>(`/api/v1/attachments/${id ?? ''}`),
  });

export const useChangeSets = () =>
  useQuery({
    queryKey: ['change-sets'],
    queryFn: () => request<readonly ChangeSetItem[]>('/api/v1/change-sets'),
  });
export const useRecycleBin = () =>
  useQuery({
    queryKey: ['recycle-bin'],
    queryFn: () => request<readonly RecycleItem[]>('/api/v1/recycle-bin'),
  });
export const useEntityVersions = (entityId: string | null) =>
  useQuery({
    queryKey: ['entity-versions', entityId],
    enabled: entityId !== null,
    queryFn: () =>
      request<readonly EntityVersionItem[]>(`/api/v1/entities/${entityId ?? ''}/versions`),
  });

const executeConfirmation = async (
  confirmation: Confirmation,
  operation: 'RESTORE_VERSION' | 'UNDO_CHANGE_SET' | 'REDO_CHANGE_SET',
) =>
  request<{ success: true }>(`/api/v1/confirmations/${confirmation.id}:execute`, {
    method: 'POST',
    body: JSON.stringify({
      token: confirmation.token,
      operation,
      entityId: confirmation.preview.entityId,
      expectedVersion: confirmation.preview.expectedVersion,
      targetVersion: confirmation.preview.targetVersion,
      ...(confirmation.preview.changeSetId === undefined
        ? {}
        : { changeSetId: confirmation.preview.changeSetId }),
    }),
  });

export const useHistoryAction = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: 'undo' | 'redo'; changeSet: ChangeSetItem }) => {
      const confirmation = await request<Confirmation>(
        `/api/v1/change-sets/${input.changeSet.id}:${input.kind}-preview`,
        { method: 'POST', body: '{}' },
      );
      if (
        !window.confirm(
          `${confirmation.preview.impact ?? '此操作会生成新的历史版本。'}\n\n确认继续吗？`,
        )
      )
        return;
      await executeConfirmation(
        confirmation,
        input.kind === 'undo' ? 'UNDO_CHANGE_SET' : 'REDO_CHANGE_SET',
      );
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['change-sets'] });
      await client.invalidateQueries({ queryKey: ['entity-versions'] });
    },
  });
};

export const useVersionPreview = () =>
  useMutation({
    mutationFn: (input: { entityId: string; targetVersion: number; expectedVersion: number }) =>
      request<Confirmation>(
        `/api/v1/entities/${input.entityId}/versions/${String(input.targetVersion)}:restore-preview`,
        { method: 'POST', body: JSON.stringify({ expectedVersion: input.expectedVersion }) },
      ),
  });

export const useExecuteRestore = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: Confirmation) =>
      executeConfirmation(confirmation, 'RESTORE_VERSION'),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['entity-versions'] });
      await client.invalidateQueries({ queryKey: ['change-sets'] });
    },
  });
};

export const useRestoreRecycleItem = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (item: RecycleItem) =>
      request<{ success: true }>(`/api/v1/recycle-bin/${item.id}:restore`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: item.version }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['recycle-bin'] });
    },
  });
};

export const purgeRecycleItem = async (item: RecycleItem): Promise<void> => {
  const confirmation = await request<{
    id: string;
    token: string;
    expiresAt: string;
    preview: { impact?: string };
  }>(`/api/v1/recycle-bin/${item.id}:purge-preview`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion: item.version }),
  });
  if (
    !window.confirm(
      `${confirmation.preview.impact ?? '此操作不可撤销。'}\n\n确认永久删除“${item.title}”吗？`,
    )
  )
    return;
  await request<{ success: true }>(`/api/v1/confirmations/${confirmation.id}:execute`, {
    method: 'POST',
    body: JSON.stringify({
      token: confirmation.token,
      operation: 'PURGE_ENTITY',
      entityId: item.id,
      expectedVersion: item.version,
    }),
  });
};
