import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TodayAiContextDto } from '@life-assistant/contracts';

import { apiClient } from '../../shared/api/client.js';

export const assistantKeys = {
  providers: ['ai', 'providers'] as const,
  chats: (query = '', includeArchived = false) => ['ai', 'chats', query, includeArchived] as const,
  messages: (sessionId: string | null) => ['ai', 'messages', sessionId] as const,
};

const requireData = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('本地服务没有返回数据。');
  return value;
};

export const fetchAiProviders = async () =>
  requireData((await apiClient.GET('/api/v1/ai/providers')).data).data;

export type AiProvider = Awaited<ReturnType<typeof fetchAiProviders>>[number];

export type DefaultProviderState =
  | { readonly status: 'READY'; readonly provider: AiProvider }
  | {
      readonly status:
        | 'NO_DEFAULT'
        | 'AMBIGUOUS_DEFAULT'
        | 'UNSUPPORTED_PROVIDER'
        | 'MISSING_CREDENTIAL'
        | 'UNVERIFIED'
        | 'VERIFICATION_FAILED'
        | 'CHAT_UNAVAILABLE';
      readonly provider?: AiProvider | undefined;
    };

export const resolveDefaultProvider = (
  providers: readonly AiProvider[] | undefined,
): DefaultProviderState => {
  const defaults = (providers ?? []).filter((provider) => provider.isDefault);
  if (defaults.length === 0) return { status: 'NO_DEFAULT' };
  if (defaults.length > 1) return { status: 'AMBIGUOUS_DEFAULT' };
  const provider = defaults[0];
  if (provider === undefined) return { status: 'NO_DEFAULT' };
  if (provider.providerType !== 'OPENAI' && provider.providerType !== 'OPENAI_COMPATIBLE')
    return { status: 'UNSUPPORTED_PROVIDER', provider };
  if (!provider.hasCredential) return { status: 'MISSING_CREDENTIAL', provider };
  if (provider.lastError !== null) return { status: 'VERIFICATION_FAILED', provider };
  if (provider.lastVerifiedAt === null) return { status: 'UNVERIFIED', provider };
  if (!provider.capabilities.chat) return { status: 'CHAT_UNAVAILABLE', provider };
  return { status: 'READY', provider };
};

export type TodayAiContext = TodayAiContextDto;

export const fetchAiChats = async (query = '', includeArchived = false) =>
  requireData(
    (
      await apiClient.GET('/api/v1/ai/chats', {
        params: {
          query: {
            ...(query.trim() === '' ? {} : { q: query.trim() }),
            ...(includeArchived ? { includeArchived: 'true' as const } : {}),
          },
        },
      })
    ).data,
  ).data;

export const createAiChat = async (input: { title: string; providerConfigId: string }) =>
  requireData((await apiClient.POST('/api/v1/ai/chats', { body: input })).data).data;

export const sendAiMessage = async (input: {
  sessionId: string;
  content: string;
  context?: TodayAiContext | undefined;
}) =>
  requireData(
    (
      await apiClient.POST('/api/v1/ai/chats/{id}/messages', {
        params: { path: { id: input.sessionId } },
        body: {
          content: input.content,
          ...(input.context === undefined ? {} : { context: input.context }),
        },
      })
    ).data,
  ).data;

export const useAiProviders = () =>
  useQuery({ queryKey: assistantKeys.providers, queryFn: fetchAiProviders });

export const useAiChats = (query = '', includeArchived = false) =>
  useQuery({
    queryKey: assistantKeys.chats(query, includeArchived),
    queryFn: () => fetchAiChats(query, includeArchived),
  });

export const updateAiChat = async (input: {
  id: string;
  title: string;
  expectedVersion: number;
}) => {
  const response = await fetch(`/api/v1/ai/chats/${input.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': String(input.expectedVersion) },
    body: JSON.stringify({ title: input.title, expectedVersion: input.expectedVersion }),
  });
  if (!response.ok) throw new Error('会话重命名失败。');
  return ((await response.json()) as { data: Awaited<ReturnType<typeof fetchAiChats>>[number] })
    .data;
};

export const setAiChatArchived = async (input: { id: string; archived: boolean }) => {
  const response = await fetch(
    `/api/v1/ai/chats/${input.id}:${input.archived ? 'archive' : 'unarchive'}`,
    { method: 'POST' },
  );
  if (!response.ok) throw new Error(input.archived ? '会话归档失败。' : '会话恢复失败。');
  return ((await response.json()) as { data: Awaited<ReturnType<typeof fetchAiChats>>[number] })
    .data;
};

export const useUpdateAiChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAiChat,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['ai', 'chats'] }),
  });
};

export const useSetAiChatArchived = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setAiChatArchived,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['ai', 'chats'] }),
  });
};

export const useCreateAiChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAiChat,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['ai', 'chats'] }),
  });
};

export const useSendAiMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendAiMessage,
    onSuccess: async (_result, input) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ai', 'chats'] }),
        queryClient.invalidateQueries({ queryKey: assistantKeys.messages(input.sessionId) }),
      ]),
  });
};
