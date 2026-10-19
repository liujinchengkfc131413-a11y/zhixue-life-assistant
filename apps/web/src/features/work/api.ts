import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../../shared/api/client.js';
import { getCsrfToken } from '../../shared/api/session.js';

export const workKey = ['work'] as const;
const data = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('本地服务没有返回数据。');
  return value;
};
const requiredId = (value: string | undefined): string => {
  if (value === undefined) throw new Error('尚未选择开发项目。');
  return value;
};
const refresh = (client: ReturnType<typeof useQueryClient>) => async () => {
  await client.invalidateQueries({ queryKey: workKey });
};

export type WorkRange = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'CUSTOM';
export const useWorkOverview = (range: WorkRange, from?: string, to?: string) =>
  useQuery({
    queryKey: [...workKey, 'overview', range, from, to],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/overview', {
            params: {
              query: {
                range,
                ...(from === undefined ? {} : { from }),
                ...(to === undefined ? {} : { to }),
              },
            },
          })
        ).data,
      ).data,
  });
export const useContents = (status?: string, from?: string, to?: string) =>
  useQuery({
    queryKey: [...workKey, 'contents', status, from, to],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/self-media/contents', {
            params: {
              query: {
                ...(status === undefined || status === '' ? {} : { status: status as 'IDEA' }),
                ...(from === undefined ? {} : { from }),
                ...(to === undefined ? {} : { to }),
              },
            },
          })
        ).data,
      ).data,
  });
export const useSelfMediaTrend = (range: WorkRange, from?: string, to?: string) =>
  useQuery({
    queryKey: [...workKey, 'self-media-trend', range, from, to],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/self-media/statistics', {
            params: {
              query: {
                range,
                ...(from === undefined ? {} : { from }),
                ...(to === undefined ? {} : { to }),
              },
            },
          })
        ).data,
      ).data,
  });
export const useCreateContent = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      title: string;
      contentType: 'VIDEO' | 'ARTICLE' | 'AUDIO' | 'IMAGE' | 'OTHER';
      idea?: string;
      platform?: string;
      plannedPublishAt?: string | null;
    }) =>
      data((await apiClient.POST('/api/v1/work/self-media/contents', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useTransitionContent = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      status: 'IDEA' | 'PLANNING' | 'CREATING' | 'READY' | 'PUBLISHED' | 'ARCHIVED';
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/work/self-media/contents/{id}/transition', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              status: input.status,
              ...(input.status === 'PUBLISHED' ? { publishedAt: new Date().toISOString() } : {}),
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateContent = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      idea: string | null;
      script: string | null;
      platform: string | null;
      plannedPublishAt: string | null;
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/work/self-media/contents/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              title: input.title,
              idea: input.idea,
              script: input.script,
              platform: input.platform,
              plannedPublishAt: input.plannedPublishAt,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
const useDelete = (execute: (id: string, version: number) => Promise<unknown>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => execute(id, version),
    onSuccess: refresh(client),
  });
};
export const useDeleteContent = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/self-media/contents/{id}', {
      params: { path: { id } },
      headers: { 'If-Match': `"${String(version)}"` },
      body: { expectedVersion: version },
    }),
  );
export const useCreateMetric = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      recordedDate: string;
      platform: string;
      views: number | null;
      likes: number | null;
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/work/self-media/contents/{id}/metrics', {
            params: { path: { id: input.id } },
            body: {
              recordedDate: input.recordedDate,
              platform: input.platform,
              views: input.views,
              likes: input.likes,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};

export const useDevProjects = (status?: string) =>
  useQuery({
    queryKey: [...workKey, 'projects', status],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/dev-projects', {
            params: {
              query: status === undefined || status === '' ? {} : { status: status as 'ACTIVE' },
            },
          })
        ).data,
      ).data,
  });
export const useCreateDevProject = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      name: string;
      summary?: string;
      targetDate?: string | null;
    }) => data((await apiClient.POST('/api/v1/work/dev-projects', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateDevProject = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      name: string;
      summary: string | null;
      status: 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
      targetDate: string | null;
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/work/dev-projects/{id}', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              name: input.name,
              summary: input.summary,
              status: input.status,
              targetDate: input.targetDate,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteDevProject = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/dev-projects/{id}', {
      params: { path: { id } },
      headers: { 'If-Match': `"${String(version)}"` },
      body: { expectedVersion: version },
    }),
  );
export const useFeatures = (projectId: string | undefined) =>
  useQuery({
    queryKey: [...workKey, 'features', projectId],
    enabled: projectId !== undefined,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/dev-projects/{id}/features', {
            params: { path: { id: requiredId(projectId) } },
          })
        ).data,
      ).data,
  });
export const useCreateFeature = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/work/dev-projects/{id}/features', {
            params: { path: { id: input.projectId } },
            body: { title: input.title, priority: input.priority },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateFeature = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      status: 'BACKLOG' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/work/dev-features/{id}', {
            params: { path: { id: input.id } },
            body: { expectedVersion: input.version, title: input.title, status: input.status },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteFeature = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/dev-features/{id}', {
      params: { path: { id } },
      body: { expectedVersion: version },
    }),
  );
export const useDefects = (projectId: string | undefined) =>
  useQuery({
    queryKey: [...workKey, 'defects', projectId],
    enabled: projectId !== undefined,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/dev-projects/{id}/defects', {
            params: { path: { id: requiredId(projectId) } },
          })
        ).data,
      ).data,
  });
export const useCreateDefect = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      reproductionSteps?: string;
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/work/dev-projects/{id}/defects', {
            params: { path: { id: input.projectId } },
            body: {
              title: input.title,
              severity: input.severity,
              ...(input.reproductionSteps === undefined
                ? {}
                : { reproductionSteps: input.reproductionSteps }),
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateDefect = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      status: 'OPEN' | 'CONFIRMED' | 'FIXING' | 'RESOLVED' | 'CLOSED' | 'WONT_FIX';
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/work/dev-defects/{id}', {
            params: { path: { id: input.id } },
            body: {
              expectedVersion: input.version,
              title: input.title,
              status: input.status,
              severity: input.severity,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteDefect = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/dev-defects/{id}', {
      params: { path: { id } },
      body: { expectedVersion: version },
    }),
  );
export const useRepositories = (projectId: string | undefined) =>
  useQuery({
    queryKey: [...workKey, 'repositories', projectId],
    enabled: projectId !== undefined,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/dev-projects/{id}/repositories', {
            params: { path: { id: requiredId(projectId) } },
          })
        ).data,
      ).data,
  });
export const useCreateRepository = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; name: string; url: string }) =>
      data(
        (
          await apiClient.POST('/api/v1/work/dev-projects/{id}/repositories', {
            params: { path: { id: input.projectId } },
            body: { name: input.name, url: input.url },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteRepository = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/repositories/{id}', {
      params: { path: { id } },
      body: { expectedVersion: version },
    }),
  );

export const useMilestones = (projectId: string | undefined) =>
  useQuery({
    queryKey: [...workKey, 'milestones', projectId],
    enabled: projectId !== undefined,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/dev-projects/{id}/milestones', {
            params: { path: { id: requiredId(projectId) } },
          })
        ).data,
      ).data,
  });
export const useCreateMilestone = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; title: string; dueAt: string }) =>
      data(
        (
          await apiClient.POST('/api/v1/work/dev-projects/{id}/milestones', {
            params: { path: { id: input.projectId } },
            body: { title: input.title, dueAt: input.dueAt },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateMilestone = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      status: 'PENDING' | 'AT_RISK' | 'ACHIEVED' | 'MISSED';
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/work/dev-milestones/{id}', {
            params: { path: { id: input.id } },
            body: { expectedVersion: input.version, status: input.status },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteMilestone = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/dev-milestones/{id}', {
      params: { path: { id } },
      body: { expectedVersion: version },
    }),
  );

export const useLearningResources = (status?: string) =>
  useQuery({
    queryKey: [...workKey, 'learning-resources', status],
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/learning/resources', {
            params: {
              query:
                status === undefined || status === '' ? {} : { status: status as 'IN_PROGRESS' },
            },
          })
        ).data,
      ).data,
  });
export const useCreateLearningResource = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoryId: string;
      title: string;
      resourceType: 'COURSE' | 'BOOK' | 'ARTICLE' | 'VIDEO' | 'DOCUMENT' | 'OTHER';
      author?: string;
      progressTotal?: number | null;
      progressUnit?: string | null;
    }) =>
      data((await apiClient.POST('/api/v1/work/learning/resources', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateLearningResource = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      version: number;
      title: string;
      author: string | null;
      status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'ABANDONED';
      progressCurrent: number | null;
      progressTotal: number | null;
      progressUnit: string | null;
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/work/learning/resources/{id}', {
            params: { path: { id: input.id } },
            body: {
              expectedVersion: input.version,
              title: input.title,
              author: input.author,
              status: input.status,
              progressCurrent: input.progressCurrent,
              progressTotal: input.progressTotal,
              progressUnit: input.progressUnit,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteLearningResource = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/learning/resources/{id}', {
      params: { path: { id } },
      body: { expectedVersion: version },
    }),
  );
export const useLearningSessions = () =>
  useQuery({
    queryKey: [...workKey, 'learning-sessions'],
    queryFn: async () => data((await apiClient.GET('/api/v1/work/learning/sessions')).data).data,
  });
export const useCreateLearningSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      resourceId: string;
      sessionDate: string;
      durationMinutes: number;
      progressDelta?: number | null;
      summary?: string;
    }) => data((await apiClient.POST('/api/v1/work/learning/sessions', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};
export const useDeleteLearningSession = () =>
  useDelete((id, version) =>
    apiClient.DELETE('/api/v1/work/learning/sessions/{id}', {
      params: { path: { id } },
      body: { expectedVersion: version },
    }),
  );

export const useNotes = (entityId: string | undefined) =>
  useQuery({
    queryKey: [...workKey, 'notes', entityId],
    enabled: entityId !== undefined,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/entities/{id}/notes', {
            params: { path: { id: requiredId(entityId) } },
          })
        ).data,
      ).data,
  });
export const useCreateNote = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entityId: string;
      categoryId: string;
      title: string;
      markdownContent: string;
      editorMode?: 'RICH_TEXT' | 'MARKDOWN';
      richContent?: unknown;
      role: 'SCRIPT' | 'TECHNICAL' | 'KNOWLEDGE' | 'MATERIAL' | 'OTHER';
    }) =>
      data(
        (
          await apiClient.POST('/api/v1/work/entities/{id}/notes', {
            params: { path: { id: input.entityId } },
            body: {
              categoryId: input.categoryId,
              title: input.title,
              markdownContent: input.markdownContent,
              editorMode: input.editorMode ?? 'MARKDOWN',
              richContent: input.richContent,
              role: input.role,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
export const useUpdateNote = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entityId: string;
      noteId: string;
      version: number;
      title: string;
      editorMode: 'RICH_TEXT' | 'MARKDOWN';
      markdownContent: string | null;
      richContent: unknown;
      role: 'SCRIPT' | 'TECHNICAL' | 'KNOWLEDGE' | 'MATERIAL' | 'OTHER';
    }) =>
      data(
        (
          await apiClient.PATCH('/api/v1/work/entities/{entityId}/notes/{noteId}', {
            params: { path: { entityId: input.entityId, noteId: input.noteId } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: {
              expectedVersion: input.version,
              title: input.title,
              editorMode: input.editorMode,
              markdownContent: input.markdownContent,
              richContent: input.richContent,
              role: input.role,
            },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};

export const useDraft = (draftKey: string) =>
  useQuery({
    queryKey: ['draft', draftKey],
    queryFn: async () => {
      const response = await fetch(`/api/v1/drafts/${encodeURIComponent(draftKey)}`);
      if (!response.ok) throw new Error('草稿读取失败。');
      return ((await response.json()) as { data: { content: unknown; updatedAt: string } | null })
        .data;
    },
  });
export const useSaveDraft = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { draftKey: string; entityId: string; content: unknown }) =>
      fetch(`/api/v1/drafts/${encodeURIComponent(input.draftKey)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-csrf-token': await getCsrfToken() },
        body: JSON.stringify({
          entityId: input.entityId,
          formType: 'WORK_NOTE',
          content: input.content,
        }),
      }).then(async (response) => {
        if (!response.ok) throw new Error('草稿保存失败。');
        return (await response.json()) as unknown;
      }),
    onSuccess: async (_data, input) => {
      await client.invalidateQueries({ queryKey: ['draft', input.draftKey] });
    },
  });
};
export const useDeleteDraft = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (draftKey: string) => {
      const response = await fetch(`/api/v1/drafts/${encodeURIComponent(draftKey)}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': await getCsrfToken() },
      });
      if (!response.ok) throw new Error('草稿清理失败。');
    },
    onSuccess: async (_data, draftKey) => {
      await client.invalidateQueries({ queryKey: ['draft', draftKey] });
    },
  });
};
export const useDeleteNote = () =>
  useDelete((noteId, version) => {
    const [entityId, id] = noteId.split(':');
    return apiClient.DELETE('/api/v1/work/entities/{entityId}/notes/{noteId}', {
      params: { path: { entityId: entityId ?? '', noteId: id ?? '' } },
      body: { expectedVersion: version },
    });
  });

export const useAttachments = (entityId: string | undefined) =>
  useQuery({
    queryKey: [...workKey, 'attachments', entityId],
    enabled: entityId !== undefined,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/work/entities/{id}/attachments', {
            params: { path: { id: requiredId(entityId) } },
          })
        ).data,
      ).data,
  });
export const useUploadAttachment = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entityId: string;
      file: File;
      role: 'GENERAL' | 'MATERIAL' | 'DOCUMENT' | 'COVER';
    }) => {
      const form = new FormData();
      form.append('file', input.file);
      const response = await fetch('/api/v1/attachments', {
        method: 'POST',
        headers: { 'x-csrf-token': await getCsrfToken() },
        body: form,
      });
      if (!response.ok) throw new Error('附件上传失败。');
      const uploaded = (await response.json()) as { data: { id: string } };
      await apiClient.POST('/api/v1/work/entities/{id}/attachments', {
        params: { path: { id: input.entityId } },
        body: { attachmentId: uploaded.data.id, role: input.role },
      });
      return uploaded.data;
    },
    onSuccess: refresh(client),
  });
};
export const useUnlinkAttachment = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { entityId: string; attachmentId: string }) =>
      apiClient.DELETE('/api/v1/work/entities/{id}/attachments/{attachmentId}', {
        params: { path: { id: input.entityId, attachmentId: input.attachmentId } },
      }),
    onSuccess: refresh(client),
  });
};
