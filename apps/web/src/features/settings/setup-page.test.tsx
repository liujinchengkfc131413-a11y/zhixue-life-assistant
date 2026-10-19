// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SetupPage } from './setup-page.js';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('./api.js', () => ({
  useSetupStatus: () => ({
    data: { initialized: false, suggestedDataDirectory: 'D:/LifeAssistantData' },
  }),
  useInitialize: () => ({ mutate: mocks.mutate, isPending: false, error: null }),
}));

const continueToAiStep = () => {
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
  fireEvent.change(screen.getByLabelText('工作日睡眠开始'), { target: { value: '22:30' } });
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
  fireEvent.change(screen.getByLabelText('自动备份频率'), { target: { value: 'DAILY' } });
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
};

describe('SetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('completes all seven steps while skipping optional AI', () => {
    render(<SetupPage />);
    expect(screen.getByLabelText('初始化进度').querySelectorAll('li')).toHaveLength(7);

    continueToAiStep();
    fireEvent.click(screen.getByRole('button', { name: '跳过 AI' }));
    fireEvent.change(screen.getByLabelText('快速记录默认处理方式'), {
      target: { value: 'INBOX' },
    });
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '完成并进入 Today' }));

    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const payload = mocks.mutate.mock.calls.at(0)?.at(0) as unknown;
    expect(payload).toMatchObject({
      dataDirectory: 'D:/LifeAssistantData',
      backupFrequency: 'DAILY',
      quickCaptureDefaultAction: 'INBOX',
      routineTemplates: [
        expect.objectContaining({ templateType: 'WORKDAY' }),
        expect.objectContaining({ templateType: 'WEEKEND' }),
        expect.objectContaining({ templateType: 'HOLIDAY' }),
      ],
    });
    expect(payload).not.toHaveProperty('aiProvider');

    const options = mocks.mutate.mock.calls.at(0)?.at(1) as
      { onSuccess?: (() => void) | undefined } | undefined;
    options?.onSuccess?.();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('includes optional provider, model and key when requested', () => {
    render(<SetupPage />);
    continueToAiStep();
    fireEvent.click(screen.getByRole('checkbox', { name: '现在配置 AI；不勾选即可跳过' }));
    fireEvent.change(screen.getByLabelText('首次启动 AI 服务商'), {
      target: { value: 'OPENAI_COMPATIBLE' },
    });
    fireEvent.change(screen.getByLabelText('首次启动 AI 显示名称'), {
      target: { value: '本地兼容服务' },
    });
    fireEvent.change(screen.getByLabelText('首次启动 AI Base URL'), {
      target: { value: 'https://example.com/v1' },
    });
    fireEvent.change(screen.getByLabelText('首次启动 AI 模型 ID'), {
      target: { value: 'local-model' },
    });
    fireEvent.change(screen.getByLabelText('首次启动 AI API Key'), {
      target: { value: 'secret-onboarding' },
    });
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    fireEvent.click(screen.getByRole('button', { name: '完成并进入 Today' }));

    const payload = mocks.mutate.mock.calls.at(0)?.at(0) as unknown;
    expect(payload).toMatchObject({
      aiProvider: {
        providerType: 'OPENAI_COMPATIBLE',
        displayName: '本地兼容服务',
        baseUrl: 'https://example.com/v1',
        modelId: 'local-model',
        apiKey: 'secret-onboarding',
      },
    });
  });
});
