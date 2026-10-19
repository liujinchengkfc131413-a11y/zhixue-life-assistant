import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCsrfToken } from '../../shared/api/session.js';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  if (init?.method !== undefined && init.method !== 'GET')
    headers.set('x-csrf-token', await getCsrfToken());
  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json()) as { data?: T; detail?: string };
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.detail ?? '本地服务没有返回数据。');
  return payload.data;
};

export interface ReminderItem {
  id: string;
  targetEntityId: string;
  targetEntityType: 'TASK' | 'EVENT';
  triggerMode: 'ABSOLUTE' | 'OFFSET_BEFORE_START' | 'OFFSET_BEFORE_DUE';
  triggerAt: string | null;
  offsetMinutes: number | null;
  isEnabled: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const remindersKey = (targetEntityId?: string) =>
  ['reminders', targetEntityId ?? 'all'] as const;

export const useReminders = (targetEntityId?: string) =>
  useQuery({
    queryKey: remindersKey(targetEntityId),
    queryFn: () =>
      request<readonly ReminderItem[]>(
        targetEntityId === undefined
          ? '/api/v1/reminders'
          : `/api/v1/reminders?targetEntityId=${encodeURIComponent(targetEntityId)}`,
      ),
  });

export const useCreateReminder = (targetEntityId?: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      targetEntityId: string;
      triggerMode: 'ABSOLUTE' | 'OFFSET_BEFORE_START' | 'OFFSET_BEFORE_DUE';
      triggerAt?: string | null;
      offsetMinutes?: number | null;
    }) =>
      request<ReminderItem>('/api/v1/reminders', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: remindersKey(targetEntityId) });
    },
  });
};

export const useUpdateReminder = (targetEntityId?: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; expectedVersion: number; isEnabled: boolean }) =>
      request<ReminderItem>(`/api/v1/reminders/${input.id}`, {
        method: 'PATCH',
        headers: { 'if-match': `"${String(input.expectedVersion)}"` },
        body: JSON.stringify({
          expectedVersion: input.expectedVersion,
          isEnabled: input.isEnabled,
        }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: remindersKey(targetEntityId) });
    },
  });
};

export const useRemoveReminder = (targetEntityId?: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; expectedVersion: number }) =>
      request<unknown>(`/api/v1/reminders/${input.id}`, {
        method: 'DELETE',
        headers: { 'if-match': `"${String(input.expectedVersion)}"` },
        body: JSON.stringify({ expectedVersion: input.expectedVersion }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: remindersKey(targetEntityId) });
    },
  });
};
