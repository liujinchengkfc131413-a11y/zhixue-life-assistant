import { useState, type SyntheticEvent } from 'react';

import { formatDateTime } from '../../shared/format.js';
import {
  useAiProviders,
  useCreateAiProvider,
  useDeleteAiCredential,
  useDeleteAiProvider,
  usePutAiCredential,
  useSetDefaultAiProvider,
  useUpdateAiProvider,
  useVerifyAiProvider,
} from './api.js';

const capabilityLabels = {
  chat: '对话',
  streaming: '流式输出',
  toolCalling: '工具调用',
  nativeWebSearch: '原生联网搜索',
} as const;

const providerTypeLabels = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  GOOGLE: 'Google',
  OPENAI_COMPATIBLE: 'OpenAI 兼容服务',
} as const;

interface ProviderDraft {
  readonly id: string;
  readonly providerType: keyof typeof providerTypeLabels;
  readonly version: number;
  displayName: string;
  modelId: string;
  baseUrl: string;
}

const errorText = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() !== '' ? error.message : fallback;

export const AiProviderSettings = () => {
  const providers = useAiProviders();
  const createProvider = useCreateAiProvider();
  const updateProvider = useUpdateAiProvider();
  const putCredential = usePutAiCredential();
  const deleteCredential = useDeleteAiCredential();
  const deleteProvider = useDeleteAiProvider();
  const setDefaultProvider = useSetDefaultAiProvider();
  const verifyProvider = useVerifyAiProvider();
  const [providerType, setProviderType] = useState<'OPENAI' | 'OPENAI_COMPATIBLE'>('OPENAI');
  const [displayName, setDisplayName] = useState('');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [secretEditingId, setSecretEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProviderDraft | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const addProvider = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    try {
      const provider = await createProvider.mutateAsync({
        providerType,
        displayName,
        modelId,
        ...(providerType === 'OPENAI_COMPATIBLE' ? { baseUrl } : {}),
      });
      setDisplayName('');
      setModelId('');
      setBaseUrl('');
      try {
        await putCredential.mutateAsync({ id: provider.id, secret: apiKey });
        const verified = await verifyProvider.mutateAsync(provider.id);
        setFeedback(
          verified.lastError === null
            ? { type: 'success', text: '模型服务已保存并验证。' }
            : { type: 'error', text: `模型服务已保存，但验证失败：${verified.lastError}` },
        );
      } catch (error) {
        setFeedback({
          type: 'error',
          text: `模型服务已创建，但凭据或验证未完成：${errorText(error, '请重新配置 API Key。')}`,
        });
      }
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error, '模型服务创建失败。') });
    } finally {
      setApiKey('');
    }
  };

  const saveCredential = async (id: string) => {
    const secret = secrets[id] ?? '';
    setFeedback(null);
    try {
      await putCredential.mutateAsync({ id, secret });
      const verified = await verifyProvider.mutateAsync(id);
      setFeedback(
        verified.lastError === null
          ? { type: 'success', text: 'API Key 已更新并完成验证。' }
          : { type: 'error', text: `API Key 已更新，但验证失败：${verified.lastError}` },
      );
    } catch (error) {
      setFeedback({ type: 'error', text: errorText(error, 'API Key 更新失败。') });
    } finally {
      setSecrets((value) => {
        return Object.fromEntries(Object.entries(value).filter(([key]) => key !== id));
      });
      setSecretEditingId(null);
    }
  };

  return (
    <section
      className="settings-section ai-provider-settings"
      aria-labelledby="ai-provider-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="ai-provider-heading">AI 模型服务</h2>
          <p>添加模型、配置凭据并验证能力。API Key 仅写入 Windows 凭据管理器。</p>
        </div>
      </div>

      <form className="provider-create-form" onSubmit={(event) => void addProvider(event)}>
        <div className="settings-grid">
          <label>
            服务商
            <select
              value={providerType}
              onChange={(event) => {
                setProviderType(event.target.value as typeof providerType);
              }}
            >
              <option value="OPENAI">OpenAI</option>
              <option value="OPENAI_COMPATIBLE">OpenAI 兼容服务</option>
            </select>
          </label>
          <label>
            显示名称
            <input
              value={displayName}
              placeholder="例如：我的 OpenAI"
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
              required
            />
          </label>
          <label>
            模型 ID
            <input
              value={modelId}
              placeholder="例如：gpt-5-mini"
              onChange={(event) => {
                setModelId(event.target.value);
              }}
              required
            />
          </label>
          <label>
            API Key
            <input
              type="text"
              className="api-key-input"
              name="api-access-token"
              aria-label="API Key"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              value={apiKey}
              placeholder="输入新的 API Key"
              onChange={(event) => {
                setApiKey(event.target.value);
              }}
              required
            />
            <span className="field-hint">密钥不会写入业务数据库、日志或浏览器存储。</span>
          </label>
          {providerType === 'OPENAI_COMPATIBLE' ? (
            <label className="provider-create-form__wide">
              API Base URL
              <input
                type="url"
                value={baseUrl}
                placeholder="https://example.com/v1"
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                }}
                required
              />
            </label>
          ) : null}
        </div>
        <button
          className="button button--primary"
          type="submit"
          disabled={createProvider.isPending || putCredential.isPending || verifyProvider.isPending}
        >
          {createProvider.isPending || putCredential.isPending || verifyProvider.isPending
            ? '正在保存并验证…'
            : '保存并验证'}
        </button>
      </form>

      {feedback ? (
        <p className={feedback.type === 'success' ? 'form-success' : 'form-error'} role="status">
          {feedback.text}
        </p>
      ) : null}
      {providers.isLoading ? <p>正在读取模型服务…</p> : null}
      {providers.data?.length === 0 ? (
        <div className="settings-empty-state">
          <strong>还没有模型服务</strong>
          <p>填写上方信息和 API Key 后即可完成第一次连接。</p>
        </div>
      ) : null}

      <div className="provider-card-list">
        {(providers.data ?? []).map((provider) => {
          const verified = provider.lastVerifiedAt !== null && provider.lastError === null;
          return (
            <article className="provider-card" key={provider.id} aria-label={provider.displayName}>
              <header className="provider-card__header">
                <div>
                  <span className="provider-card__type">
                    {providerTypeLabels[provider.providerType]}
                  </span>
                  <h3>{provider.displayName}</h3>
                  <p>{provider.modelId}</p>
                </div>
                {provider.isDefault ? <span className="badge">默认模型</span> : null}
              </header>

              {editing?.id === provider.id ? (
                <div className="provider-edit-form">
                  <label>
                    显示名称
                    <input
                      value={editing.displayName}
                      onChange={(event) => {
                        setEditing({ ...editing, displayName: event.target.value });
                      }}
                    />
                  </label>
                  <label>
                    模型 ID
                    <input
                      value={editing.modelId}
                      onChange={(event) => {
                        setEditing({ ...editing, modelId: event.target.value });
                      }}
                    />
                  </label>
                  {editing.providerType === 'OPENAI_COMPATIBLE' ? (
                    <label>
                      API Base URL
                      <input
                        type="url"
                        value={editing.baseUrl}
                        onChange={(event) => {
                          setEditing({ ...editing, baseUrl: event.target.value });
                        }}
                      />
                    </label>
                  ) : null}
                  <div className="row-actions">
                    <button
                      className="button button--small button--primary"
                      type="button"
                      disabled={updateProvider.isPending}
                      onClick={() => {
                        void updateProvider
                          .mutateAsync({
                            id: editing.id,
                            expectedVersion: editing.version,
                            displayName: editing.displayName,
                            modelId: editing.modelId,
                            baseUrl:
                              editing.providerType === 'OPENAI_COMPATIBLE' ? editing.baseUrl : null,
                          })
                          .then(() => {
                            setEditing(null);
                            setFeedback({ type: 'success', text: '模型服务信息已更新。' });
                          })
                          .catch((error: unknown) => {
                            setFeedback({
                              type: 'error',
                              text: errorText(error, '模型服务信息更新失败。'),
                            });
                          });
                      }}
                    >
                      保存修改
                    </button>
                    <button
                      className="button button--small"
                      type="button"
                      onClick={() => {
                        setEditing(null);
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {provider.baseUrl ? (
                    <p className="provider-card__base-url">{provider.baseUrl}</p>
                  ) : null}
                  <dl className="provider-card__status">
                    <div>
                      <dt>凭据</dt>
                      <dd data-state={provider.hasCredential ? 'ready' : 'missing'}>
                        {provider.hasCredential ? '● 已配置' : '○ 未配置'}
                      </dd>
                    </div>
                    <div>
                      <dt>连接状态</dt>
                      <dd data-state={verified ? 'ready' : 'missing'}>
                        {verified ? '● 已验证' : provider.lastError ? '● 验证失败' : '○ 尚未验证'}
                      </dd>
                    </div>
                    <div>
                      <dt>最近验证</dt>
                      <dd>
                        {provider.lastVerifiedAt ? formatDateTime(provider.lastVerifiedAt) : '—'}
                      </dd>
                    </div>
                  </dl>
                  <div className="capability-list" aria-label={`${provider.displayName} 能力`}>
                    {Object.entries(capabilityLabels).map(([key, label]) => (
                      <span
                        key={key}
                        className={
                          provider.capabilities[key as keyof typeof provider.capabilities]
                            ? 'capability capability--available'
                            : 'capability'
                        }
                      >
                        {label}
                        <b>
                          {provider.capabilities[key as keyof typeof provider.capabilities]
                            ? '✓'
                            : '—'}
                        </b>
                      </span>
                    ))}
                  </div>
                  {provider.lastError ? (
                    <p className="form-error">最近验证失败：{provider.lastError}</p>
                  ) : null}
                </>
              )}

              {secretEditingId === provider.id ? (
                <div className="provider-secret-form">
                  <label>
                    新的 API Key
                    <input
                      aria-label={`${provider.displayName} 新的 API Key`}
                      type="text"
                      className="api-key-input"
                      name={`api-access-token-${provider.id}`}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      data-1p-ignore="true"
                      data-lpignore="true"
                      value={secrets[provider.id] ?? ''}
                      placeholder="输入新的 API Key"
                      onChange={(event) => {
                        setSecrets((value) => ({ ...value, [provider.id]: event.target.value }));
                      }}
                    />
                  </label>
                  <button
                    className="button button--small button--primary"
                    type="button"
                    disabled={(secrets[provider.id] ?? '').trim() === '' || putCredential.isPending}
                    onClick={() => void saveCredential(provider.id)}
                  >
                    保存并验证
                  </button>
                  <button
                    className="button button--small"
                    type="button"
                    onClick={() => {
                      setSecrets((value) => ({ ...value, [provider.id]: '' }));
                      setSecretEditingId(null);
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : null}

              <footer className="provider-card__actions">
                <button
                  className="button button--small"
                  type="button"
                  disabled={!provider.hasCredential || verifyProvider.isPending}
                  onClick={() => {
                    verifyProvider.mutate(provider.id);
                  }}
                >
                  {verifyProvider.isPending ? '正在验证…' : '验证连接'}
                </button>
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => {
                    setSecretEditingId(provider.id);
                  }}
                >
                  {provider.hasCredential ? '更换 API Key' : '配置 API Key'}
                </button>
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => {
                    setEditing({
                      id: provider.id,
                      providerType: provider.providerType,
                      version: provider.version,
                      displayName: provider.displayName,
                      modelId: provider.modelId,
                      baseUrl: provider.baseUrl ?? '',
                    });
                  }}
                >
                  编辑信息
                </button>
                {!provider.isDefault ? (
                  <button
                    className="button button--small"
                    type="button"
                    disabled={setDefaultProvider.isPending}
                    onClick={() => {
                      setDefaultProvider.mutate({
                        id: provider.id,
                        expectedVersion: provider.version,
                      });
                    }}
                  >
                    设为默认
                  </button>
                ) : null}
                <button
                  className="button button--small button--danger"
                  type="button"
                  disabled={!provider.hasCredential || deleteCredential.isPending}
                  onClick={() => {
                    deleteCredential.mutate(provider.id);
                  }}
                >
                  删除 API Key
                </button>
                {pendingDeleteId === provider.id ? (
                  <>
                    <span className="provider-card__delete-warning">确认删除整个模型服务？</span>
                    <button
                      className="button button--small button--danger"
                      type="button"
                      disabled={deleteProvider.isPending}
                      onClick={() => {
                        deleteProvider.mutate(
                          { id: provider.id, expectedVersion: provider.version },
                          {
                            onSuccess: () => {
                              setPendingDeleteId(null);
                            },
                          },
                        );
                      }}
                    >
                      确认删除
                    </button>
                  </>
                ) : (
                  <button
                    className="button button--small button--danger"
                    type="button"
                    onClick={() => {
                      setPendingDeleteId(provider.id);
                    }}
                  >
                    删除服务
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
};
