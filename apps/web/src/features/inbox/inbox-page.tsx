import { useMemo, useState } from 'react';
import { ErrorState } from '../../shared/state-panel.js';
import { formatDateTime } from '../../shared/format.js';
import { readEntityDetailTarget } from '../../shared/entity-detail-target.js';
import type {
  InboxItemDto,
  InboxStatusDto,
  ProcessInboxManuallyRequest,
} from '@life-assistant/contracts';

import { useCategories } from '../settings/api.js';
import { useArchiveInbox, useInbox, useProcessInbox } from './api.js';

interface DraftResult {
  id: string;
  type: 'TASK' | 'SHOPPING_ITEM' | 'GOAL';
  text: string;
}
const statusLabels: Record<InboxStatusDto, string> = {
  UNPROCESSED: '待整理',
  PROCESSING: '处理中',
  PROCESSED: '已处理',
  ARCHIVED: '已归档',
};
const tomorrowAtNine = () => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(9, 0, 0, 0);
  return value.toISOString();
};
const todayDate = () => new Date().toISOString().slice(0, 10);
const nextMonthDate = () => {
  const value = new Date();
  value.setMonth(value.getMonth() + 1);
  return value.toISOString().slice(0, 10);
};

export const InboxPage = () => {
  const target = readEntityDetailTarget(window.location.search);
  const inboxTargetId = target?.entityType === 'INBOX_ITEM' ? target.entityId : undefined;
  const [filter, setFilter] = useState<InboxStatusDto | undefined>(
    inboxTargetId === undefined ? 'UNPROCESSED' : undefined,
  );
  const inbox = useInbox(filter);
  const categories = useCategories();
  const processInbox = useProcessInbox();
  const archiveInbox = useArchiveInbox();
  const [selectedId, setSelectedId] = useState<string | undefined>(inboxTargetId);
  const [drafts, setDrafts] = useState<DraftResult[]>([]);
  const [draftOwnerId, setDraftOwnerId] = useState<string>();
  const items = inbox.data ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const selectedDrafts =
    selected?.status === 'UNPROCESSED'
      ? draftOwnerId === selected.id
        ? drafts
        : selected.rawText
            .split(/[；;\n]+/)
            .map((text, index): DraftResult => ({
              id: `${selected.id}-${String(index)}`,
              type: 'TASK',
              text: text.trim(),
            }))
            .filter((item) => item.text !== '')
      : [];

  const categoryList = categories.data?.data ?? [];
  const shoppingCategory = categoryList.find(
    (item) => item.moduleType === 'SHOPPING' && !item.isArchived,
  );
  const fitnessCategory = categoryList.find(
    (item) => item.moduleType === 'FITNESS' && !item.isArchived,
  );
  const fallbackCategory = categoryList.find((item) => !item.isArchived);
  const canProcess =
    selected?.status === 'UNPROCESSED' &&
    selectedDrafts.length > 0 &&
    fallbackCategory !== undefined;
  const resultSummary = useMemo(
    () =>
      selected?.results
        .map((result) =>
          result.resultType === 'TASK' ? '任务' : result.resultType === 'GOAL' ? '目标' : '购物项',
        )
        .join('、'),
    [selected],
  );
  const flowStep =
    selected?.status === 'PROCESSED' || selected?.status === 'ARCHIVED'
      ? 4
      : selectedDrafts.length > 1
        ? 2
        : 1;

  const save = () => {
    if (
      selected?.status !== 'UNPROCESSED' ||
      fallbackCategory === undefined ||
      selectedDrafts.length === 0
    )
      return;
    const results: ProcessInboxManuallyRequest['results'] = selectedDrafts.map((draft) =>
      draft.type === 'TASK'
        ? {
            resultType: 'TASK',
            categoryId: fallbackCategory.id,
            title: draft.text,
            priority: 'NORMAL',
            dueAt: tomorrowAtNine(),
            estimatedMinutes: 30,
            isFlexible: true,
            preferredArea: fallbackCategory.parentArea,
          }
        : draft.type === 'SHOPPING_ITEM'
          ? {
              resultType: 'SHOPPING_ITEM',
              categoryId: shoppingCategory?.id ?? fallbackCategory.id,
              name: draft.text,
              quantity: 1,
              priority: 'NORMAL',
            }
          : {
              resultType: 'GOAL',
              categoryId: fitnessCategory?.id ?? fallbackCategory.id,
              title: draft.text,
              description: '从收集箱手动整理',
              goalType: 'OUTCOME',
              startDate: todayDate(),
              endDate: nextMonthDate(),
            },
    );
    processInbox.mutate(
      { id: selected.id, body: { expectedVersion: selected.version, results } },
      {
        onSuccess: () => {
          setFilter('PROCESSED');
          setDraftOwnerId(undefined);
        },
      },
    );
  };

  return (
    <div className="page inbox-page">
      <header className="page__header">
        <p className="eyebrow">快速收集 · 稍后归类</p>
        <h1>收集箱</h1>
        <p>先把念头稳稳接住，再拆成任务或购物项。没有配置 AI 时，所有内容都保持原样等待你处理。</p>
      </header>
      <ol className="inbox-flow" aria-label="处理流程">
        {['已收集', '拆分', '归类', '完成'].map((label, index) => (
          <li
            key={label}
            data-state={
              index + 1 < flowStep ? 'complete' : index + 1 === flowStep ? 'current' : 'next'
            }
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      <div className="inbox-toolbar" aria-label="收集箱筛选">
        {([undefined, 'UNPROCESSED', 'PROCESSED', 'ARCHIVED'] as const).map((value) => (
          <button
            className="button button--small"
            data-selected={filter === value}
            key={value ?? 'ALL'}
            onClick={() => {
              setFilter(value);
              setSelectedId(undefined);
              setDraftOwnerId(undefined);
            }}
            type="button"
          >
            {value === undefined ? '全部' : statusLabels[value]}
          </button>
        ))}
      </div>
      <div className="inbox-workspace">
        <section className="inbox-list" aria-label="收集内容">
          {inbox.isLoading && <p>正在读取收集箱……</p>}
          {inbox.isError && (
            <ErrorState>收集箱暂时无法加载。请确认本地服务运行正常后重试。</ErrorState>
          )}
          {!inbox.isLoading && !inbox.isError && items.length === 0 && (
            <div className="empty-state">
              <strong>这里很清爽</strong>
              <span>使用侧栏的“快速记录”添加第一条内容。</span>
            </div>
          )}
          {items.map((item) => (
            <button
              data-selected={item.id === selected?.id}
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setDraftOwnerId(undefined);
              }}
              type="button"
            >
              <span>{item.rawText}</span>
              <small>
                {statusLabels[item.status]} · {formatDateTime(item.createdAt)}
              </small>
            </button>
          ))}
        </section>
        <section className="inbox-detail" aria-live="polite">
          {selected === undefined ? (
            <div className="empty-state">
              <strong>选择一条内容</strong>
              <span>可在这里拆分、分类或归档。</span>
            </div>
          ) : (
            <InboxDetail
              item={selected}
              drafts={selectedDrafts}
              onDraftsChange={(value) => {
                setDraftOwnerId(selected.id);
                setDrafts(value);
              }}
              shoppingEnabled={shoppingCategory !== undefined}
              goalEnabled={fitnessCategory !== undefined}
              resultSummary={resultSummary}
              saveDisabled={!canProcess || processInbox.isPending}
              onSave={save}
              onArchive={() => {
                archiveInbox.mutate({ id: selected.id, version: selected.version });
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
};

const InboxDetail = ({
  item,
  drafts,
  onDraftsChange,
  shoppingEnabled,
  goalEnabled,
  resultSummary,
  saveDisabled,
  onSave,
  onArchive,
}: {
  item: InboxItemDto;
  drafts: DraftResult[];
  onDraftsChange: (value: DraftResult[]) => void;
  shoppingEnabled: boolean;
  goalEnabled: boolean;
  resultSummary: string | undefined;
  saveDisabled: boolean;
  onSave: () => void;
  onArchive: () => void;
}) => (
  <>
    <div className="section-heading">
      <div>
        <p className="eyebrow">{statusLabels[item.status]}</p>
        <h2>整理内容</h2>
      </div>
      <button className="text-button" onClick={onArchive} type="button">
        归档
      </button>
    </div>
    <blockquote>{item.rawText}</blockquote>
    {item.status === 'UNPROCESSED' ? (
      <>
        <div className="inbox-results">
          <div className="section-heading">
            <h3>拆分结果</h3>
            <button
              className="text-button"
              onClick={() => {
                onDraftsChange([...drafts, { id: crypto.randomUUID(), type: 'TASK', text: '' }]);
              }}
              type="button"
            >
              添加一项
            </button>
          </div>
          {drafts.map((draft) => (
            <div className="inbox-result-row" key={draft.id}>
              <select
                aria-label="结果类型"
                value={draft.type}
                onChange={(event) => {
                  onDraftsChange(
                    drafts.map((item) =>
                      item.id === draft.id
                        ? { ...item, type: event.target.value as DraftResult['type'] }
                        : item,
                    ),
                  );
                }}
              >
                <option value="TASK">任务</option>
                <option disabled={!shoppingEnabled} value="SHOPPING_ITEM">
                  购物项
                </option>
                <option disabled={!goalEnabled} value="GOAL">
                  目标
                </option>
              </select>
              <input
                aria-label="结果内容"
                value={draft.text}
                onChange={(event) => {
                  onDraftsChange(
                    drafts.map((item) =>
                      item.id === draft.id ? { ...item, text: event.target.value } : item,
                    ),
                  );
                }}
              />
              <button
                aria-label="删除拆分项"
                className="text-button text-button--danger"
                onClick={() => {
                  onDraftsChange(drafts.filter((item) => item.id !== draft.id));
                }}
                type="button"
              >
                删除
              </button>
            </div>
          ))}
        </div>
        <div className="form-actions">
          <button
            className="button button--primary"
            disabled={saveDisabled || drafts.some((draft) => draft.text.trim() === '')}
            onClick={onSave}
            type="button"
          >
            保存处理结果
          </button>
        </div>
      </>
    ) : (
      <div className="inbox-processed">
        <strong>{item.status === 'PROCESSED' ? '处理完成' : '内容已归档'}</strong>
        {item.results.length > 0 && <span>已生成：{resultSummary}</span>}
      </div>
    )}
  </>
);
