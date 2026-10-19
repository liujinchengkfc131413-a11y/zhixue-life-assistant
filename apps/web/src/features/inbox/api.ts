import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InboxStatusDto, ProcessInboxManuallyRequest } from '@life-assistant/contracts';

import { apiClient } from '../../shared/api/client.js';

const inboxKey = ['inbox'] as const;
const requireData = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('本地服务没有返回数据。');
  return value;
};
const refresh = (client: ReturnType<typeof useQueryClient>) => async () => {
  await client.invalidateQueries({ queryKey: inboxKey });
};

export const useInbox = (status?: InboxStatusDto) =>
  useQuery({
    queryKey: [...inboxKey, status],
    queryFn: async () =>
      requireData(
        (
          await apiClient.GET('/api/v1/inbox', {
            params: { query: status === undefined ? {} : { status } },
          })
        ).data,
      ).data,
  });

export const useQuickCapture = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { text: string; mode: 'INBOX_ONLY' | 'AI_PROCESS' }) =>
      requireData((await apiClient.POST('/api/v1/quick-capture', { body: input })).data).data,
    onSuccess: refresh(client),
  });
};

export const useProcessInbox = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: ProcessInboxManuallyRequest }) => {
      const body = {
        expectedVersion: input.body.expectedVersion,
        results: input.body.results.map((result) =>
          result.resultType === 'GOAL'
            ? {
                resultType: result.resultType,
                categoryId: result.categoryId,
                title: result.title,
                goalType: result.goalType,
                startDate: result.startDate,
                ...(result.description === undefined ? {} : { description: result.description }),
                ...(result.status === undefined ? {} : { status: result.status }),
                ...(result.endDate === undefined ? {} : { endDate: result.endDate }),
              }
            : result,
        ),
      };
      return requireData(
        (
          await apiClient.POST('/api/v1/inbox/{id}:process-manually', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.body.expectedVersion)}"` },
            body,
          })
        ).data,
      ).data;
    },
    onSuccess: refresh(client),
  });
};

export const useArchiveInbox = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; version: number }) =>
      requireData(
        (
          await apiClient.POST('/api/v1/inbox/{id}:archive', {
            params: { path: { id: input.id } },
            headers: { 'If-Match': `"${String(input.version)}"` },
            body: { expectedVersion: input.version },
          })
        ).data,
      ).data,
    onSuccess: refresh(client),
  });
};
