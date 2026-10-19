import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { getCsrfToken } from './api/session.js';

export type FormDraftMode = 'create' | 'edit';

interface DraftRecord {
  readonly draftKey: string;
  readonly entityId: string | null;
  readonly formType: string;
  readonly content: unknown;
  readonly updatedAt: string;
}

interface FormDraftOptions<T> {
  readonly formType: string;
  readonly mode: FormDraftMode;
  readonly entityId?: string;
  readonly enabled: boolean;
  readonly dirty: boolean;
  readonly value: T;
  readonly parse: (value: unknown) => T | undefined;
  readonly onRestore: (value: T, updatedAt: string) => void;
  readonly debounceMs?: number;
}

export const buildFormDraftKey = (
  formType: string,
  mode: FormDraftMode,
  entityId?: string,
): string => `${formType}:${mode}:${entityId ?? 'new'}`;

const draftQueryKey = (draftKey: string) => ['form-draft', draftKey] as const;

const readDraft = async (draftKey: string): Promise<DraftRecord | null> => {
  const response = await fetch(`/api/v1/drafts/${encodeURIComponent(draftKey)}`);
  if (!response.ok) throw new Error('草稿读取失败。');
  return ((await response.json()) as { data: DraftRecord | null }).data;
};

const saveDraft = async (input: {
  readonly draftKey: string;
  readonly entityId?: string;
  readonly formType: string;
  readonly content: unknown;
}): Promise<void> => {
  const response = await fetch(`/api/v1/drafts/${encodeURIComponent(input.draftKey)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-csrf-token': await getCsrfToken() },
    body: JSON.stringify({
      entityId: input.entityId ?? null,
      formType: input.formType,
      content: input.content,
    }),
  });
  if (!response.ok) throw new Error('草稿保存失败。');
};

const deleteDraft = async (draftKey: string): Promise<void> => {
  const response = await fetch(`/api/v1/drafts/${encodeURIComponent(draftKey)}`, {
    method: 'DELETE',
    headers: { 'x-csrf-token': await getCsrfToken() },
  });
  if (!response.ok) throw new Error('草稿清理失败。');
};

export const useFormDraft = <T>({
  formType,
  mode,
  entityId,
  enabled,
  dirty,
  value,
  parse,
  onRestore,
  debounceMs = 600,
}: FormDraftOptions<T>) => {
  const client = useQueryClient();
  const draftKey = buildFormDraftKey(formType, mode, entityId);
  const restoredKeyRef = useRef<string | undefined>(undefined);

  const query = useQuery({
    queryKey: draftQueryKey(draftKey),
    queryFn: () => readDraft(draftKey),
    enabled,
  });
  const {
    mutate: mutateSave,
    isPending: isSaving,
    error: saveError,
  } = useMutation({
    mutationFn: saveDraft,
    onSuccess: async (_data, input) => {
      await client.invalidateQueries({ queryKey: draftQueryKey(input.draftKey) });
    },
  });
  const { mutate: mutateRemove } = useMutation({
    mutationFn: deleteDraft,
    onSuccess: async (_data, key) => {
      client.setQueryData(draftQueryKey(key), null);
      await client.invalidateQueries({ queryKey: draftQueryKey(key) });
    },
  });

  useEffect(() => {
    if (!enabled || query.data === null || query.data === undefined) return;
    if (restoredKeyRef.current === draftKey) return;
    const restored = parse(query.data.content);
    restoredKeyRef.current = draftKey;
    if (restored !== undefined) onRestore(restored, query.data.updatedAt);
  }, [draftKey, enabled, onRestore, parse, query.data]);

  useEffect(() => {
    if (!enabled || !dirty || query.isLoading) return;
    const timeout = window.setTimeout(() => {
      mutateSave({
        draftKey,
        formType,
        content: value,
        ...(entityId === undefined ? {} : { entityId }),
      });
    }, debounceMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    debounceMs,
    dirty,
    draftKey,
    enabled,
    entityId,
    formType,
    mutateSave,
    query.isLoading,
    value,
  ]);

  const clear = useCallback(() => {
    mutateRemove(draftKey);
  }, [draftKey, mutateRemove]);
  const saveNow = useCallback(() => {
    if (!dirty) return;
    mutateSave({
      draftKey,
      formType,
      content: value,
      ...(entityId === undefined ? {} : { entityId }),
    });
  }, [dirty, draftKey, entityId, formType, mutateSave, value]);

  return {
    draftKey,
    isLoading: query.isLoading,
    restoredAt: query.data?.updatedAt,
    hasDraft: query.data !== null && query.data !== undefined,
    isSaving,
    saveError,
    clear,
    saveNow,
  } as const;
};
