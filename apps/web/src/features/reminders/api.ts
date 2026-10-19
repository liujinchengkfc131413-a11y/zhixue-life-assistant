import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCsrfToken } from '../../shared/api/session.js';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) headers.set('content-type', 'application/json');
  if (init?.method !== undefined && init.method !== 'GET')
    headers.set('x-csrf-token', await getCsrfToken());
  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json()) as { data?: T; detail?: string };
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.detail ?? '本地服务没有返回数据。');
  return payload.data;
};

export interface NotificationItem {
  id: string;
  notificationType: 'REMINDER' | 'SYSTEM' | 'AI_SUGGESTION' | 'SCHEDULE_WARNING';
  targetEntityId: string | null;
  targetEntityType: string | null;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  scheduledAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  snoozedUntil: string | null;
}

export const notificationsKey = ['notifications'] as const;

export const useNotifications = () =>
  useQuery({
    queryKey: notificationsKey,
    queryFn: () => request<readonly NotificationItem[]>('/api/v1/notifications'),
    refetchInterval: 60_000,
  });

export const useMarkNotificationRead = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ success: true }>(`/api/v1/notifications/${id}:read`, { method: 'POST' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: notificationsKey });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ success: true }>('/api/v1/notifications:read-all', { method: 'POST' }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: notificationsKey });
    },
  });
};

export const useSnoozeNotification = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; snoozedUntil: string }) =>
      request<{ success: true }>(`/api/v1/notifications/${input.id}:snooze`, {
        method: 'POST',
        body: JSON.stringify({ snoozedUntil: input.snoozedUntil }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: notificationsKey });
    },
  });
};
