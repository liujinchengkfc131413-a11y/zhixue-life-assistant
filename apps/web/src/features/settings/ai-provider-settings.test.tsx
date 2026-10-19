// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiProviderSettings } from './ai-provider-settings.js';

const createdProvider = {
  id: 'provider-new',
  providerType: 'OPENAI_COMPATIBLE' as const,
  displayName: '备用服务',
  baseUrl: 'https://compatible.example/v1',
  modelId: 'compatible-model',
  hasCredential: false,
  capabilities: { chat: false, streaming: false, toolCalling: false, nativeWebSearch: false },
  isDefault: false,
  lastVerifiedAt: null,
  lastError: null,
  version: 1,
};

const createProvider = {
  mutateAsync: vi.fn().mockResolvedValue(createdProvider),
  isPending: false,
};
const updateProvider = { mutateAsync: vi.fn(), isPending: false };
const putCredential = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
const deleteCredential = { mutate: vi.fn(), isPending: false };
const deleteProvider = { mutate: vi.fn(), isPending: false };
const setDefaultProvider = { mutate: vi.fn(), isPending: false };
const verifyProvider = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({
    ...createdProvider,
    hasCredential: true,
    lastVerifiedAt: '2026-08-27T08:00:00Z',
  }),
  isPending: false,
};

vi.mock('./api.js', () => ({
  useAiProviders: () => ({
    isLoading: false,
    data: [
      {
        id: 'provider-1',
        providerType: 'OPENAI_COMPATIBLE',
        displayName: '本地兼容服务',
        baseUrl: 'https://compatible.example/v1',
        modelId: 'compatible-model',
        hasCredential: true,
        capabilities: { chat: true, streaming: true, toolCalling: true, nativeWebSearch: false },
        isDefault: true,
        lastVerifiedAt: '2026-08-27T07:30:00Z',
        lastError: null,
        version: 3,
      },
    ],
  }),
  useCreateAiProvider: () => createProvider,
  useUpdateAiProvider: () => updateProvider,
  usePutAiCredential: () => putCredential,
  useDeleteAiCredential: () => deleteCredential,
  useDeleteAiProvider: () => deleteProvider,
  useSetDefaultAiProvider: () => setDefaultProvider,
  useVerifyAiProvider: () => verifyProvider,
}));

describe('AiProviderSettings', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a provider with credential verification and never keeps the key visible', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AiProviderSettings />
      </QueryClientProvider>,
    );

    const capabilities = screen.getByLabelText('本地兼容服务 能力');
    expect(within(capabilities).getByText('工具调用')).toBeInTheDocument();
    expect(within(capabilities).getByText('原生联网搜索')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('服务商'), {
      target: { value: 'OPENAI_COMPATIBLE' },
    });
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: '备用服务' } });
    fireEvent.change(screen.getByLabelText('模型 ID'), { target: { value: 'compatible-model' } });
    fireEvent.change(screen.getByPlaceholderText('输入新的 API Key'), {
      target: { value: 'secret-create' },
    });
    expect(screen.getByLabelText('API Key')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('API Key')).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText('API Key')).toHaveClass('api-key-input');
    fireEvent.change(screen.getByLabelText('API Base URL'), {
      target: { value: 'https://compatible.example/v1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存并验证' }));

    await waitFor(() => {
      expect(createProvider.mutateAsync).toHaveBeenCalledWith({
        providerType: 'OPENAI_COMPATIBLE',
        displayName: '备用服务',
        modelId: 'compatible-model',
        baseUrl: 'https://compatible.example/v1',
      });
      expect(putCredential.mutateAsync).toHaveBeenCalledWith({
        id: 'provider-new',
        secret: 'secret-create',
      });
      expect(verifyProvider.mutateAsync).toHaveBeenCalledWith('provider-new');
    });
    expect(screen.getByPlaceholderText('输入新的 API Key')).toHaveValue('');
  });

  it('exposes separate key replacement, verification, default and deletion controls', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AiProviderSettings />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '更换 API Key' }));
    fireEvent.change(screen.getByLabelText('本地兼容服务 新的 API Key'), {
      target: { value: 'secret-replacement' },
    });
    const saveButtons = screen.getAllByRole('button', { name: '保存并验证' });
    expect(saveButtons).toHaveLength(2);
    const replacementSaveButton = saveButtons.at(1);
    if (replacementSaveButton === undefined) throw new Error('缺少更换 API Key 的保存按钮。');
    fireEvent.click(replacementSaveButton);
    await waitFor(() => {
      expect(putCredential.mutateAsync).toHaveBeenCalledWith({
        id: 'provider-1',
        secret: 'secret-replacement',
      });
      expect(verifyProvider.mutateAsync).toHaveBeenCalledWith('provider-1');
    });
    expect(screen.queryByLabelText('本地兼容服务 新的 API Key')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '验证连接' }));
    fireEvent.click(screen.getByRole('button', { name: '删除 API Key' }));
    expect(verifyProvider.mutate).toHaveBeenCalledWith('provider-1');
    expect(deleteCredential.mutate).toHaveBeenCalledWith('provider-1');
    expect(screen.getByText('默认模型')).toBeInTheDocument();
  });
});
