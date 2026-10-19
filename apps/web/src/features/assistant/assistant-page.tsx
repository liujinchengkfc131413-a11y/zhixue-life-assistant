import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  UserRound,
} from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../shared/api/client.js';
import { consumeTodayAiDraft } from '../../shared/assistant-draft.js';
import { formatDateTime } from '../../shared/format.js';
import { EmptyState, ErrorState } from '../../shared/state-panel.js';
import { invalidateTimeSystemQueries } from '../time-system/api.js';
import {
  assistantKeys,
  resolveDefaultProvider,
  useAiChats,
  useAiProviders,
  useCreateAiChat,
  useSendAiMessage,
  useSetAiChatArchived,
  useUpdateAiChat,
} from './api.js';

const data = <T,>(value: T | undefined): T => {
  if (value === undefined) throw new Error('本地服务没有返回数据。');
  return value;
};

interface AiActionView {
  readonly id: string;
  readonly actionType: string;
  readonly preview: unknown;
  readonly status: string;
  readonly errorCode: string | null;
}
const requestAiAction = async (actionId: string, decision?: 'confirm' | 'cancel') => {
  const response = await fetch(
    `/api/v1/ai/actions/${actionId}${decision === undefined ? '' : `:${decision}`}`,
    { method: decision === undefined ? 'GET' : 'POST' },
  );
  if (!response.ok) throw new Error('AI 操作请求失败。');
  const body = (await response.json()) as { data: AiActionView | { action: AiActionView } };
  return 'action' in body.data ? body.data.action : body.data;
};

interface ChangeSetCard {
  type: 'change_set';
  changeSetId: string;
}
interface AiActionCardPart {
  type: 'ai_action';
  actionId: string;
}

const isChangeSetCard = (item: unknown): item is ChangeSetCard =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  item.type === 'change_set' &&
  'changeSetId' in item &&
  typeof item.changeSetId === 'string';
const isAiActionCard = (item: unknown): item is AiActionCardPart =>
  typeof item === 'object' &&
  item !== null &&
  'type' in item &&
  item.type === 'ai_action' &&
  'actionId' in item &&
  typeof item.actionId === 'string';

const formatTime = (value: string | null): string => {
  if (value === null) return '';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
};

const messageFallback = {
  PENDING: '等待生成',
  STREAMING: '正在生成…',
  COMPLETED: '已完成',
  FAILED: '生成失败',
  CANCELLED: '已取消',
} as const;

interface OperationCardProps {
  readonly changeSetId: string;
  readonly isExpanded: boolean;
  readonly isLoading: boolean;
  readonly isUndoing: boolean;
  readonly detail:
    | {
        readonly summary: string;
        readonly status: 'APPLIED' | 'REVERTED' | 'PENDING' | 'FAILED';
        readonly operations: readonly {
          readonly sequence: number;
          readonly operation: string;
          readonly entityId: string | null;
        }[];
      }
    | undefined;
  readonly onToggle: () => void;
  readonly onUndo: () => void;
}

const OperationCard = ({
  changeSetId,
  isExpanded,
  isLoading,
  isUndoing,
  detail,
  onToggle,
  onUndo,
}: OperationCardProps) => {
  const status = detail?.status ?? 'APPLIED';
  const statusLabel = {
    APPLIED: '已应用',
    REVERTED: '已撤销',
    PENDING: '待处理',
    FAILED: '失败',
  }[status];
  const StatusIcon =
    status === 'FAILED' ? CircleAlert : status === 'PENDING' ? LoaderCircle : Check;

  return (
    <article className={`assistant-operation assistant-operation--${status.toLowerCase()}`}>
      <div className="assistant-operation__heading">
        <span className="assistant-operation__icon" aria-hidden="true">
          <StatusIcon size={17} />
        </span>
        <div>
          <span className="assistant-operation__eyebrow">操作结果 · {statusLabel}</span>
          <h3>{detail?.summary ?? 'AI 已完成一组结构化变更'}</h3>
        </div>
      </div>
      <p className="assistant-operation__id">变更集 {changeSetId}</p>
      <div className="assistant-operation__actions">
        <button
          className="button button--small assistant-operation__toggle"
          type="button"
          onClick={onToggle}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {isExpanded ? '收起详情' : '查看详情'}
        </button>
        {status !== 'REVERTED' ? (
          <button
            className="button button--small assistant-operation__undo"
            type="button"
            disabled={isUndoing}
            onClick={onUndo}
          >
            <RotateCcw size={15} />
            {isUndoing ? '正在撤销' : '撤销'}
          </button>
        ) : null}
      </div>
      {isExpanded ? (
        <div className="assistant-operation__detail" aria-label="操作详情" role="region">
          {isLoading ? <p>正在读取操作详情…</p> : null}
          {!isLoading && detail ? (
            <ol>
              {detail.operations.map((operation) => (
                <li key={operation.sequence}>
                  <span>{operation.operation}</span>
                  <small>{operation.entityId ?? '无关联对象'}</small>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

export const AiActionCard = ({ actionId }: { readonly actionId: string }) => {
  const qc = useQueryClient();
  const action = useQuery({
    queryKey: ['ai', 'action', actionId],
    queryFn: async () => requestAiAction(actionId),
  });
  const decide = useMutation({
    mutationFn: async (decision: 'confirm' | 'cancel') => {
      return requestAiAction(actionId, decision);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ai', 'action', actionId] });
      await invalidateTimeSystemQueries(qc);
    },
  });
  const value = action.data;
  const pending = value?.status === 'AWAITING_CONFIRMATION';
  return (
    <article className="assistant-operation assistant-operation--pending">
      <div className="assistant-operation__heading">
        <span className="assistant-operation__icon" aria-hidden="true">
          <CircleAlert size={17} />
        </span>
        <div>
          <span className="assistant-operation__eyebrow">
            高风险操作 · {value?.status ?? '读取中'}
          </span>
          <h3>{value?.actionType ?? '待确认操作'}</h3>
        </div>
      </div>
      <p className="assistant-operation__id">操作 {actionId}</p>
      {value?.preview === undefined ? null : <p>{JSON.stringify(value.preview)}</p>}
      {value?.errorCode === null || value?.errorCode === undefined ? null : (
        <p>{value.errorCode}</p>
      )}
      {pending ? (
        <div className="assistant-operation__actions">
          <button
            className="button button--small"
            disabled={decide.isPending}
            type="button"
            onClick={() => {
              decide.mutate('confirm');
            }}
          >
            确认执行
          </button>
          <button
            className="button button--small"
            disabled={decide.isPending}
            type="button"
            onClick={() => {
              decide.mutate('cancel');
            }}
          >
            拒绝
          </button>
        </div>
      ) : null}
    </article>
  );
};

interface MessageItemProps {
  readonly message: {
    readonly id: string;
    readonly role: 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM';
    readonly content?: unknown;
    readonly plainText: string;
    readonly status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    readonly createdAt: string;
    readonly sources: readonly {
      readonly title: string;
      readonly url: string;
      readonly retrievedAt: string;
    }[];
  };
  readonly expandedChangeSetId: string | null;
  readonly operationDetail: OperationCardProps['detail'];
  readonly isOperationLoading: boolean;
  readonly isUndoing: boolean;
  readonly onToggleOperation: (changeSetId: string) => void;
  readonly onUndo: (changeSetId: string) => void;
}

const MessageItem = ({
  message,
  expandedChangeSetId,
  operationDetail,
  isOperationLoading,
  isUndoing,
  onToggleOperation,
  onUndo,
}: MessageItemProps) => {
  const cards = Array.isArray(message.content) ? message.content.filter(isChangeSetCard) : [];
  const actionCards = Array.isArray(message.content) ? message.content.filter(isAiActionCard) : [];
  const isUser = message.role === 'USER';
  const isAssistant = message.role === 'ASSISTANT';
  const copy = message.plainText !== '' ? message.plainText : messageFallback[message.status];

  return (
    <li className={`assistant-message assistant-message--${message.role.toLowerCase()}`}>
      <div className="assistant-message__identity" aria-hidden="true">
        {isUser ? <UserRound size={17} /> : <Bot size={17} />}
      </div>
      <div className="assistant-message__body">
        <header className="assistant-message__meta">
          <strong>
            {isUser ? '你' : isAssistant ? 'AI 助手' : message.role === 'TOOL' ? '工具' : '系统'}
          </strong>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {message.status === 'STREAMING' ? (
            <span className="assistant-message__live">思考中</span>
          ) : null}
        </header>
        <div className="assistant-message__copy">{copy}</div>
        {message.sources.length > 0 ? (
          <div className="assistant-message__sources">
            {message.sources.map((source) => (
              <span
                className="assistant-message__source"
                key={`${source.url}-${source.retrievedAt}`}
              >
                <a href={source.url} rel="noreferrer" target="_blank">
                  <ExternalLink size={13} />
                  {source.title}
                </a>
                <time dateTime={source.retrievedAt}>
                  检索于 {formatDateTime(source.retrievedAt)}
                </time>
              </span>
            ))}
          </div>
        ) : null}
        {cards.map((card) => (
          <OperationCard
            changeSetId={card.changeSetId}
            detail={expandedChangeSetId === card.changeSetId ? operationDetail : undefined}
            isExpanded={expandedChangeSetId === card.changeSetId}
            isLoading={expandedChangeSetId === card.changeSetId && isOperationLoading}
            isUndoing={isUndoing}
            key={card.changeSetId}
            onToggle={() => {
              onToggleOperation(card.changeSetId);
            }}
            onUndo={() => {
              onUndo(card.changeSetId);
            }}
          />
        ))}
        {actionCards.map((card) => (
          <AiActionCard actionId={card.actionId} key={card.actionId} />
        ))}
      </div>
    </li>
  );
};

export const AssistantPage = () => {
  const qc = useQueryClient();
  const search = useSearch({ from: '/assistant' });
  const [title, setTitle] = useState('新对话');
  const [sessionQuery, setSessionQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [content, setContent] = useState(consumeTodayAiDraft);
  const [selectedId, setSelectedId] = useState<string | null>(search.sessionId ?? null);
  const [runId, setRunId] = useState<string | null>(search.runId ?? null);
  const [selectedChangeSetId, setSelectedChangeSetId] = useState<string | null>(null);
  const sessions = useAiChats(sessionQuery, includeArchived);
  const activeSessionId = selectedId ?? sessions.data?.[0]?.id ?? null;
  const providers = useAiProviders();
  const defaultProvider = useMemo(() => resolveDefaultProvider(providers.data), [providers.data]);
  const create = useCreateAiChat();
  const updateSession = useUpdateAiChat();
  const archiveSession = useSetAiChatArchived();
  const send = useSendAiMessage();
  const messages = useQuery({
    queryKey: assistantKeys.messages(activeSessionId),
    enabled: activeSessionId !== null,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/ai/chats/{id}/messages', {
            params: { path: { id: activeSessionId ?? '' } },
          })
        ).data,
      ).data,
  });

  useEffect(() => {
    if (runId === null || activeSessionId === null) return;
    const stream = new EventSource(`/api/v1/ai/runs/${runId}/events`);
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: assistantKeys.messages(activeSessionId) });
    };
    const finish = () => {
      refresh();
      void invalidateTimeSystemQueries(qc);
      setRunId(null);
      stream.close();
    };
    stream.addEventListener('ai.run.delta', refresh);
    stream.addEventListener('ai.run.completed', finish);
    stream.addEventListener('ai.run.failed', finish);
    stream.addEventListener('ai.run.cancelled', finish);
    return () => {
      stream.close();
    };
  }, [activeSessionId, qc, runId]);

  const cancel = useMutation({
    mutationFn: async (id: string) =>
      data((await apiClient.POST('/api/v1/ai/runs/{id}:cancel', { params: { path: { id } } })).data)
        .data,
    onSuccess: async () => {
      await messages.refetch();
      setRunId(null);
    },
  });
  const changeSet = useQuery({
    queryKey: ['ai', 'change-set', selectedChangeSetId],
    enabled: selectedChangeSetId !== null,
    queryFn: async () =>
      data(
        (
          await apiClient.GET('/api/v1/ai/change-sets/{id}', {
            params: { path: { id: selectedChangeSetId ?? '' } },
          })
        ).data,
      ).data,
  });
  const undo = useMutation({
    mutationFn: async (id: string) =>
      data(
        (
          await apiClient.POST('/api/v1/ai/change-sets/{id}:undo', {
            params: { path: { id } },
          })
        ).data,
      ).data,
    onSuccess: async () => {
      await Promise.all([messages.refetch(), changeSet.refetch()]);
    },
  });

  const submitMessage = useCallback(() => {
    const trimmedContent = content.trim();
    if (activeSessionId === null || trimmedContent === '' || send.isPending) return;
    send.mutate(
      { sessionId: activeSessionId, content: trimmedContent },
      {
        onSuccess: (result) => {
          setContent('');
          setRunId(result.runId);
        },
      },
    );
  }, [activeSessionId, content, send]);

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submitMessage();
    }
  };

  const selectedSession = sessions.data?.find((session) => session.id === activeSessionId);
  const providerReady = defaultProvider.status === 'READY';
  const isAiActive = send.isPending || runId !== null;

  return (
    <main className="page assistant-page">
      <header className="page__header assistant-page__header">
        <p className="assistant-page__kicker">AI ASSISTANT · 思考与执行</p>
        <div className="assistant-page__heading-row">
          <div>
            <h1>AI 助手</h1>
            <p>在明确边界内读取信息、辅助分析、提出建议，并在确认后执行操作。</p>
          </div>
          <span className="assistant-page__capability">
            <Sparkles size={16} />
            本地管理 · 授权执行
          </span>
        </div>
      </header>

      <section className="assistant-workspace" aria-label="AI 助手工作区">
        <aside className="assistant-sessions" aria-label="会话列表">
          <label className="assistant-session-title">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="搜索历史会话"
              placeholder="搜索标题或消息"
              value={sessionQuery}
              onChange={(event) => {
                setSessionQuery(event.target.value);
              }}
            />
          </label>
          <label className="assistant-sessions__notice">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => {
                setIncludeArchived(event.target.checked);
              }}
            />
            包含已归档会话
          </label>
          <div className="assistant-sessions__create">
            <label className="assistant-session-title">
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="会话标题"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
              />
            </label>
            <button
              className="button assistant-sessions__add"
              type="button"
              aria-label="新建会话"
              disabled={!providerReady || create.isPending || title.trim() === ''}
              onClick={() => {
                if (defaultProvider.status !== 'READY') return;
                create.mutate(
                  { title: title.trim(), providerConfigId: defaultProvider.provider.id },
                  {
                    onSuccess: (session) => {
                      setSelectedId(session.id);
                      setTitle('新对话');
                    },
                  },
                );
              }}
            >
              <Plus size={19} />
            </button>
          </div>
          {content !== '' ? (
            <p className="assistant-sessions__notice">已带入来自“今日”的内容</p>
          ) : null}
          {!providerReady ? (
            <p className="assistant-sessions__notice">请先配置并验证默认模型服务。</p>
          ) : null}
          {providers.isError ? <ErrorState>模型服务配置暂时无法读取。</ErrorState> : null}
          {sessions.isLoading ? <p className="assistant-sessions__notice">正在读取会话…</p> : null}
          {sessions.isError ? <ErrorState>会话列表暂时无法加载，请重试。</ErrorState> : null}
          {!sessions.isLoading && !sessions.isError && (sessions.data ?? []).length === 0 ? (
            <EmptyState title="还没有会话">输入标题并点击加号开始第一次对话。</EmptyState>
          ) : null}
          <ol className="assistant-session-list">
            {(sessions.data ?? []).map((session) => {
              const isSelected = activeSessionId === session.id;
              return (
                <li key={session.id}>
                  <button
                    className="assistant-session-card"
                    data-selected={isSelected ? 'true' : 'false'}
                    type="button"
                    onClick={() => {
                      setSelectedId(session.id);
                      setSelectedChangeSetId(null);
                    }}
                  >
                    <span className="assistant-session-card__row">
                      <strong>{session.title}</strong>
                      <time dateTime={session.lastMessageAt ?? session.createdAt}>
                        {formatTime(session.lastMessageAt ?? session.createdAt)}
                      </time>
                    </span>
                    <span className="assistant-session-card__summary">
                      {isSelected && messages.data?.at(-1)?.plainText
                        ? messages.data.at(-1)?.plainText
                        : session.status === 'ARCHIVED'
                          ? '已归档会话'
                          : '继续这次对话…'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="assistant-conversation" aria-label="当前对话">
          <header className="assistant-conversation__header">
            <div>
              <span>当前会话</span>
              <h2>{selectedSession?.title ?? '选择一个会话开始思考'}</h2>
            </div>
            {selectedSession !== undefined ? (
              <div className="button-row">
                <input
                  aria-label="重命名当前会话"
                  value={renameTitle}
                  placeholder={selectedSession.title}
                  onChange={(event) => {
                    setRenameTitle(event.target.value);
                  }}
                />
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={renameTitle.trim() === '' || updateSession.isPending}
                  onClick={() => {
                    updateSession.mutate(
                      {
                        id: selectedSession.id,
                        title: renameTitle.trim(),
                        expectedVersion: selectedSession.version,
                      },
                      {
                        onSuccess: () => {
                          setRenameTitle('');
                        },
                      },
                    );
                  }}
                >
                  重命名
                </button>
                <button
                  className="button button--ghost"
                  type="button"
                  disabled={archiveSession.isPending}
                  onClick={() => {
                    archiveSession.mutate(
                      { id: selectedSession.id, archived: selectedSession.status !== 'ARCHIVED' },
                      {
                        onSuccess: () => {
                          if (selectedSession.status !== 'ARCHIVED') setSelectedId(null);
                        },
                      },
                    );
                  }}
                >
                  {selectedSession.status === 'ARCHIVED' ? '恢复会话' : '归档会话'}
                </button>
              </div>
            ) : null}
            {isAiActive ? (
              <span className="assistant-conversation__active">
                <Sparkles size={14} />
                AI 正在思考
              </span>
            ) : null}
          </header>

          <div className="assistant-conversation__scroll" aria-live="polite">
            {messages.isLoading ? (
              <p className="assistant-conversation__status">正在读取消息…</p>
            ) : null}
            {messages.isError ? <ErrorState>消息暂时无法加载，请重试。</ErrorState> : null}
            {activeSessionId !== null &&
            !messages.isLoading &&
            !messages.isError &&
            (messages.data ?? []).length === 0 ? (
              <div className="assistant-conversation__welcome">
                <span aria-hidden="true">
                  <Sparkles size={22} />
                </span>
                <h2>我们从哪里开始？</h2>
                <p>把需要梳理的问题告诉我，我会先说明理解和建议，再呈现任何实际操作。</p>
              </div>
            ) : null}
            {activeSessionId === null ? (
              <div className="assistant-conversation__welcome">
                <span aria-hidden="true">
                  <Bot size={22} />
                </span>
                <h2>选择或新建一个会话</h2>
                <p>每次对话、运行状态与实际变更都保存在本地。</p>
              </div>
            ) : null}
            <ol className="assistant-message-list">
              {(messages.data ?? []).map((message) => (
                <MessageItem
                  expandedChangeSetId={selectedChangeSetId}
                  isOperationLoading={changeSet.isLoading}
                  isUndoing={undo.isPending}
                  key={message.id}
                  message={message}
                  operationDetail={changeSet.data}
                  onToggleOperation={(changeSetId) => {
                    setSelectedChangeSetId((current) =>
                      current === changeSetId ? null : changeSetId,
                    );
                  }}
                  onUndo={(changeSetId) => {
                    undo.mutate(changeSetId);
                  }}
                />
              ))}
            </ol>
          </div>

          <div className={`assistant-composer${isAiActive ? ' assistant-composer--active' : ''}`}>
            <textarea
              aria-label="消息"
              disabled={activeSessionId === null}
              onChange={(event) => {
                setContent(event.target.value);
              }}
              onKeyDown={handleComposerKeyDown}
              placeholder="告诉我你想做什么，或需要什么帮助…"
              rows={3}
              value={content}
            />
            <div className="assistant-composer__footer">
              <span className="assistant-composer__hint">
                <Sparkles size={16} />
                AI 会在实际变更前呈现操作结果
              </span>
              <div className="assistant-composer__actions">
                {runId !== null ? (
                  <button
                    className="button button--small assistant-composer__cancel"
                    type="button"
                    disabled={cancel.isPending}
                    onClick={() => {
                      cancel.mutate(runId);
                    }}
                  >
                    <Square size={13} />
                    取消生成
                  </button>
                ) : null}
                <button
                  className="button button--primary assistant-composer__send"
                  type="button"
                  disabled={activeSessionId === null || content.trim() === '' || send.isPending}
                  onClick={submitMessage}
                >
                  <Send size={16} />
                  发送给 AI
                  <kbd>⌘ ↵</kbd>
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
};
