import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { InitializeRequest } from '@life-assistant/contracts';

import { apiClient } from '../../shared/api/client.js';
import { getCsrfToken } from '../../shared/api/session.js';

export const setupStatusKey = ['setup', 'status'] as const;
export const settingsKey = ['settings'] as const;
export const categoriesKey = ['categories'] as const;
export const tagsKey = ['tags'] as const;
export const aiProvidersKey = ['ai', 'providers'] as const;

const requireData = <T>(data: T | undefined): T => {
  if (data === undefined) throw new Error('本地服务没有返回数据。');
  return data;
};

export const useSetupStatus = () =>
  useQuery({
    queryKey: setupStatusKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/setup/status')).data).data,
  });

export const useInitialize = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InitializeRequest) =>
      requireData(
        (
          await apiClient.POST('/api/v1/setup/initialize', {
            body: {
              dataDirectory: input.dataDirectory,
              includeDemoData: input.includeDemoData,
              backupFrequency: input.backupFrequency,
              backupRetentionCount: input.backupRetentionCount,
              quickCaptureDefaultAction: input.quickCaptureDefaultAction,
              ...(input.routineTemplates === undefined
                ? {}
                : { routineTemplates: input.routineTemplates }),
              ...(input.aiProvider === undefined
                ? {}
                : {
                    aiProvider: {
                      providerType: input.aiProvider.providerType,
                      displayName: input.aiProvider.displayName,
                      modelId: input.aiProvider.modelId,
                      apiKey: input.aiProvider.apiKey,
                      ...(input.aiProvider.baseUrl === undefined
                        ? {}
                        : { baseUrl: input.aiProvider.baseUrl }),
                    },
                  }),
            },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
};

interface DemoDataStatus {
  exists: boolean;
  recordCount: number;
  batchId: string;
}
interface DemoDataClearPreview extends DemoDataStatus {
  confirmation: { id: string; token: string };
}

export const useSettings = () =>
  useQuery({
    queryKey: settingsKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/settings')).data).data,
  });

export const useSaveSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, string | number | boolean>) =>
      requireData((await apiClient.PATCH('/api/v1/settings', { body: { values } })).data).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsKey });
    },
  });
};

export const useAiProviders = () =>
  useQuery({
    queryKey: aiProvidersKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/ai/providers')).data).data,
  });

export const useCreateAiProvider = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerType: 'OPENAI' | 'OPENAI_COMPATIBLE';
      displayName: string;
      modelId: string;
      baseUrl?: string;
    }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/ai/providers', {
            body: {
              providerType: input.providerType,
              displayName: input.displayName,
              modelId: input.modelId,
              ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
            },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiProvidersKey });
    },
  });
};

export const useUpdateAiProvider = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      expectedVersion: number;
      displayName: string;
      modelId: string;
      baseUrl: string | null;
    }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/ai/providers/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.expectedVersion)}"` },
            body: {
              expectedVersion: input.expectedVersion,
              displayName: input.displayName,
              modelId: input.modelId,
              baseUrl: input.baseUrl,
            },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiProvidersKey });
    },
  });
};

export const useSetDefaultAiProvider = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/ai/providers/{id}:set-default', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.expectedVersion)}"` },
            body: { expectedVersion: input.expectedVersion },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiProvidersKey });
    },
  });
};

export const useDeleteAiProvider = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number }) => {
      const response = await apiClient.DELETE('/api/v1/ai/providers/{id}', {
        params: { path: { id: input.id } },
        headers: { 'If-Match': `"${String(input.expectedVersion)}"` },
        body: { expectedVersion: input.expectedVersion },
      });
      if (response.response.status !== 204) throw new Error('模型服务删除失败。');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiProvidersKey });
    },
  });
};

export const usePutAiCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; secret: string }) => {
      const response = await apiClient.PUT('/api/v1/ai/providers/{id}/credential', {
        params: { path: { id: input.id } },
        body: { secret: input.secret },
      });
      if (response.response.status !== 204) throw new Error('凭据保存失败。');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiProvidersKey });
    },
  });
};

export const useDeleteAiCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.DELETE('/api/v1/ai/providers/{id}/credential', {
        params: { path: { id } },
      });
      if (response.response.status !== 204) throw new Error('凭据删除失败。');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiProvidersKey });
    },
  });
};

export const useVerifyAiProvider = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      requireData(
        (
          await apiClient.POST('/api/v1/ai/providers/{id}:verify', {
            params: { path: { id } },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiProvidersKey });
    },
  });
};

export const useCategories = () =>
  useQuery({
    queryKey: categoriesKey,
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/categories', {
            params: { query: { includeArchived: true } },
          })
        ).data,
      ),
  });

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      parentArea: 'WORK' | 'LIFE';
      name: string;
      moduleType:
        | 'SELF_MEDIA'
        | 'DEVELOPMENT'
        | 'LEARNING'
        | 'SHOPPING'
        | 'DIET'
        | 'FITNESS'
        | 'ENTERTAINMENT'
        | 'GENERIC';
    }) => requireData((await apiClient.POST('/api/v1/categories', { body: input })).data).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesKey });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number; name: string }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/categories/{id}', {
            params: { path: { id: input.id } },
            body: { expectedVersion: input.expectedVersion, name: input.name },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesKey });
    },
  });
};

export const useArchiveCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number; archive: boolean }) => {
      const path = input.archive
        ? '/api/v1/categories/{id}/archive'
        : '/api/v1/categories/{id}/unarchive';
      const response = input.archive
        ? await apiClient.POST(path, {
            params: { path: { id: input.id } },
            body: { expectedVersion: input.expectedVersion },
          })
        : await apiClient.POST(path, {
            params: { path: { id: input.id } },
            body: { expectedVersion: input.expectedVersion },
          });
      return requireData(response.data).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesKey });
    },
  });
};

export const useReorderCategories = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      parentArea: 'WORK' | 'LIFE';
      ids: string[];
      expectedOrderVersion: number;
    }) =>
      requireData((await apiClient.POST('/api/v1/categories:reorder', { body: input })).data).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesKey });
    },
  });
};

export const useTags = () =>
  useQuery({
    queryKey: tagsKey,
    queryFn: async () => requireData((await apiClient.GET('/api/v1/tags')).data).data,
  });

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      requireData((await apiClient.POST('/api/v1/tags', { body: { name } })).data).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tagsKey });
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number; name: string }) =>
      requireData(
        (
          await apiClient.PATCH('/api/v1/tags/{id}', {
            params: { path: { id: input.id } },
            body: { expectedVersion: input.expectedVersion, name: input.name },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tagsKey });
    },
  });
};

export const usePreviewDeleteTag = () =>
  useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/tags/{id}/delete-preview', {
            params: { path: { id: input.id } },
            body: { expectedVersion: input.expectedVersion },
          })
        ).data,
      ).data,
  });

export const useDeleteTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      expectedVersion: number;
      confirmationId: string;
      confirmationToken: string;
    }) => {
      const response = await apiClient.DELETE('/api/v1/tags/{id}', {
        params: { path: { id: input.id } },
        body: {
          expectedVersion: input.expectedVersion,
          confirmationId: input.confirmationId,
          confirmationToken: input.confirmationToken,
        },
      });
      if (response.response.status !== 204) throw new Error('标签删除失败。');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tagsKey });
    },
  });
};

export const useCreateBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => requireData((await apiClient.POST('/api/v1/backups')).data).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
};

interface BackupRecord {
  id: string;
  backupType: string;
  status: string;
  path: string | null;
  createdAt: string;
}
interface RestorePreview {
  path: string;
  generatedAt: string;
  schemaVersion: number;
  fileCount: number;
  confirmation: { id: string; token: string };
}
const rawRequest = async <T>(path: string, body?: unknown): Promise<T> => {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-csrf-token': await getCsrfToken() },
          body: JSON.stringify(body),
        },
  );
  const payload = (await response.json()) as { data?: T; detail?: string };
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.detail ?? '本地服务没有返回数据。');
  return payload.data;
};
export const useDemoData = () =>
  useQuery({
    queryKey: ['demo-data'],
    queryFn: () => rawRequest<DemoDataStatus>('/api/v1/demo-data'),
  });
export const usePreviewClearDemoData = () =>
  useMutation({
    mutationFn: () => rawRequest<DemoDataClearPreview>('/api/v1/demo-data/clear-preview', {}),
  });
export const useClearDemoData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { confirmationId: string; confirmationToken: string }) =>
      rawRequest<{ removedCount: number }>('/api/v1/demo-data/clear', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
};
export const useBackups = () =>
  useQuery({
    queryKey: ['backups'],
    queryFn: () => rawRequest<readonly BackupRecord[]>('/api/v1/backups'),
  });
export const usePreviewBackupRestore = () =>
  useMutation({
    mutationFn: (path: string) =>
      rawRequest<RestorePreview>('/api/v1/backups/restore-preview', { path }),
  });
export const useExecuteBackupRestore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { path: string; confirmationId: string; confirmationToken: string }) =>
      rawRequest<unknown>('/api/v1/backups/restore', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
};

export const usePreviewDataDirectoryMigration = () =>
  useMutation({
    mutationFn: async (dataDirectory: string) =>
      requireData(
        (
          await apiClient.POST('/api/v1/settings/data-directory/migration-preview', {
            body: { dataDirectory },
          })
        ).data,
      ).data,
  });

interface AiMemoryClearPreview {
  confirmationId: string;
  count: number;
  expiresAt: string;
}
export const usePreviewClearAiMemory = () =>
  useMutation({
    mutationFn: () =>
      rawRequest<AiMemoryClearPreview>('/api/v1/settings/ai-memory:clear-preview', {}),
  });
export const useClearAiMemory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { confirmationId: string; count: number }) =>
      rawRequest<{ cleared: number }>('/api/v1/settings/ai-memory:clear-confirm', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
};

export const useExecuteDataDirectoryMigration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      dataDirectory: string;
      confirmationId: string;
      confirmationToken: string;
    }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/settings/data-directory/migrate', {
            body: input,
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
};

export interface HolidayItem {
  localDate: string;
  name: string;
  dayType: 'HOLIDAY' | 'MAKEUP_WORKDAY';
  source: 'SYSTEM_UPDATE' | 'USER_OVERRIDE';
}
interface HolidayUpdateResult {
  providerId: string;
  year: number;
  applied: number;
  preservedUserOverrides: number;
}

export const holidaysKey = (year: number) => ['holidays', year] as const;

export const useHolidays = (year: number) =>
  useQuery({
    queryKey: holidaysKey(year),
    queryFn: () => rawRequest<readonly HolidayItem[]>(`/api/v1/holidays?year=${String(year)}`),
  });

export const useUpdateHolidays = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (year: number) =>
      rawRequest<HolidayUpdateResult>('/api/v1/holidays:update', { year }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });
};

export const useRemoveHolidayOverride = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (localDate: string) => {
      const response = await fetch(`/api/v1/holidays/${encodeURIComponent(localDate)}/override`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': await getCsrfToken() },
      });
      const payload = (await response.json()) as { data?: { removed: boolean }; detail?: string };
      if (!response.ok || payload.data === undefined)
        throw new Error(payload.detail ?? '移除节假日覆盖失败。');
      return payload.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });
};

interface DiagnosticInfo {
  appVersion: string;
  schemaVersion: number;
  dataDirectoryId: string;
  generatedAt: string;
  uptimeSeconds: number;
  backgroundJobs: { pending: number; running: number; failed: number };
  disk: { freeBytes: number; totalBytes: number };
  logs: { name: string; bytes: number }[];
  logTail: string;
}

export const diagnosticsKey = ['system', 'diagnostics'] as const;

export const useDiagnostics = () =>
  useQuery({
    queryKey: diagnosticsKey,
    queryFn: () => rawRequest<DiagnosticInfo>('/api/v1/system/diagnostics'),
    refetchInterval: 30_000,
  });

export const useExportDiagnostics = () =>
  useMutation({
    mutationFn: () => rawRequest<{ path: string }>('/api/v1/system/diagnostics:export', {}),
  });
