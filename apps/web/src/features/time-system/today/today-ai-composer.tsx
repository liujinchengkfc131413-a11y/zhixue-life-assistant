import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState, type SyntheticEvent } from 'react';

import {
  resolveDefaultProvider,
  type TodayAiContext,
  useCreateAiChat,
  useAiProviders,
  useSendAiMessage,
} from '../../assistant/api.js';
import { clearTodayAiDraft, saveTodayAiDraft } from '../../../shared/assistant-draft.js';

type DeliveryStage = 'IDLE' | 'CREATING' | 'SENDING' | 'FAILED';

const providerRecoveryText = (
  status: ReturnType<typeof resolveDefaultProvider>['status'],
): string =>
  ({
    READY: '',
    NO_DEFAULT: '请先在设置中选择默认 AI 服务',
    AMBIGUOUS_DEFAULT: '检测到多个默认 AI 服务，请在设置中修正',
    UNSUPPORTED_PROVIDER: '默认 AI 服务暂不受当前运行时支持',
    MISSING_CREDENTIAL: '默认 AI 服务尚未配置凭据',
    UNVERIFIED: '默认 AI 服务尚未完成连接验证',
    VERIFICATION_FAILED: '默认 AI 服务验证失败，请检查配置',
    CHAT_UNAVAILABLE: '默认 AI 服务当前不支持对话',
  })[status];

export const TodayAiComposer = ({ context }: { context?: TodayAiContext | undefined }) => {
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<DeliveryStage>('IDLE');
  const [retrySession, setRetrySession] = useState<{
    id: string;
    providerConfigId: string;
  } | null>(null);
  const navigate = useNavigate();
  const providers = useAiProviders();
  const createChat = useCreateAiChat();
  const sendMessage = useSendAiMessage();
  const defaultProvider = useMemo(() => resolveDefaultProvider(providers.data), [providers.data]);
  const deliver = useMutation({
    mutationFn: async (input: {
      content: string;
      providerConfigId: string;
      sessionId?: string | undefined;
    }) => {
      let sessionId = input.sessionId;
      if (sessionId === undefined) {
        setStage('CREATING');
        const session = await createChat.mutateAsync({
          title: `今日 · ${context?.date ?? '新对话'}`,
          providerConfigId: input.providerConfigId,
        });
        sessionId = session.id;
        setRetrySession({ id: session.id, providerConfigId: input.providerConfigId });
      }
      setStage('SENDING');
      const run = await sendMessage.mutateAsync({
        sessionId,
        content: input.content,
        context,
      });
      return { sessionId, runId: run.runId };
    },
    onSuccess: ({ sessionId, runId }) => {
      setRetrySession(null);
      clearTodayAiDraft();
      setValue('');
      void navigate({ to: '/assistant', search: { sessionId, runId } });
    },
    onError: (_error, input) => {
      saveTodayAiDraft(input.content);
      setStage('FAILED');
    },
  });

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const content = value.trim();
    if (
      content === '' ||
      context === undefined ||
      defaultProvider.status !== 'READY' ||
      deliver.isPending
    )
      return;
    setStage('IDLE');
    deliver.mutate({
      content,
      providerConfigId: defaultProvider.provider.id,
      sessionId:
        retrySession?.providerConfigId === defaultProvider.provider.id
          ? retrySession.id
          : undefined,
    });
  };

  const pendingLabel = stage === 'CREATING' ? '正在创建对话…' : '正在发送…';
  const unavailable = !providers.isLoading && defaultProvider.status !== 'READY';

  return (
    <form className="today-ai" onSubmit={submit} aria-label="AI 助手">
      <input
        className="today-ai__input"
        aria-label="AI 助手输入"
        placeholder="告诉我你想做什么，或者有什么想法……"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (stage === 'FAILED') setStage('IDLE');
        }}
      />
      <button
        className="button today-ai__button"
        type="submit"
        disabled={
          value.trim() === '' ||
          context === undefined ||
          defaultProvider.status !== 'READY' ||
          providers.isLoading ||
          deliver.isPending
        }
      >
        {deliver.isPending ? '发送中' : 'AI 助手'}
      </button>
      {providers.isLoading ? <span className="today-ai__hint">正在检查 AI 配置…</span> : null}
      {unavailable ? (
        <a className="today-ai__hint today-ai__hint--link" href="/settings">
          {providerRecoveryText(defaultProvider.status)}
        </a>
      ) : null}
      {defaultProvider.status === 'READY' && !deliver.isPending && stage !== 'FAILED' ? (
        <span className="today-ai__hint">
          {defaultProvider.provider.capabilities.toolCalling
            ? '直接发送，并带上今天的状态'
            : '直接发送；当前服务仅支持对话'}
        </span>
      ) : null}
      {deliver.isPending ? (
        <span className="today-ai__hint" role="status">
          {pendingLabel}
        </span>
      ) : null}
      {stage === 'FAILED' ? (
        <span className="today-ai__hint today-ai__hint--error" role="alert">
          发送失败，内容已保留，可直接重试。
        </span>
      ) : null}
    </form>
  );
};
