import { useMemo, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { buildEntityDetailHref } from '../../shared/entity-detail-target.js';
import { formatDate } from '../../shared/format.js';
import { useDialogA11y } from '../../shared/use-dialog-a11y.js';
import { useCategories, useTags } from '../settings/api.js';

import { useSearch } from './api.js';

const labelFor = (type: string) =>
  (
    ({
      TASK: '任务',
      NOTE: '笔记',
      GOAL: '目标',
      PLAN: '计划',
      EVENT: '日程',
      SHOPPING_ITEM: '购物',
      INBOX_ITEM: '收集箱',
      DEV_PROJECT: '开发项目',
      LEARNING_RESOURCE: '学习资源',
    }) as Record<string, string>
  )[type] ?? type;

export const SearchDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('');
  const [module, setModule] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [tagId, setTagId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const categories = useCategories();
  const tags = useTags();
  const categoryItems = categories.data?.data ?? [];
  const search = useSearch(query, {
    ...(entityType === '' ? {} : { entityType }),
    ...(module === '' ? {} : { module }),
    ...(categoryId === '' ? {} : { categoryId }),
    ...(status === '' ? {} : { status }),
    ...(tagId === '' ? {} : { tagId }),
    ...(from === '' ? {} : { from: new Date(`${from}T00:00:00+08:00`).toISOString() }),
    ...(to === ''
      ? {}
      : { to: new Date(Date.parse(`${to}T00:00:00+08:00`) + 86_400_000).toISOString() }),
  });
  const panelRef = useDialogA11y<HTMLElement>(open, onClose, 'input[placeholder^="搜索"]');
  const types = useMemo(
    () => Array.from(new Set((search.data ?? []).map((item) => item.entityType))),
    [search.data],
  );
  if (!open) return null;
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="search-dialog"
        data-surface="system"
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        tabIndex={-1}
      >
        <header>
          <div>
            <span className="eyebrow">跨模块检索</span>
            <h2>全局搜索</h2>
          </div>
          <button
            className="button button--ghost"
            onClick={() => {
              onClose();
            }}
          >
            Esc
          </button>
        </header>
        <div className="search-dialog__input">
          <SearchIcon size={18} strokeWidth={2} aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="搜索任务、笔记、项目、购物与生活记录…"
          />
        </div>
        <div className="form-grid" aria-label="搜索筛选">
          <label>
            模块
            <select
              value={module}
              onChange={(event) => {
                setModule(event.target.value);
              }}
            >
              <option value="">全部模块</option>
              {Array.from(new Set(categoryItems.map((item) => item.moduleType))).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            分类
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
              }}
            >
              <option value="">全部分类</option>
              {categoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            状态
            <input
              value={status}
              placeholder="例如 TODO / ACTIVE"
              onChange={(event) => {
                setStatus(event.target.value.trim().toUpperCase());
              }}
            />
          </label>
          <label>
            标签
            <select
              value={tagId}
              onChange={(event) => {
                setTagId(event.target.value);
              }}
            >
              <option value="">全部标签</option>
              {(tags.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            开始日期
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
              }}
            />
          </label>
          <label>
            结束日期
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
              }}
            />
          </label>
        </div>
        {(entityType !== '' || types.length > 1) && (
          <div className="search-dialog__filters">
            <button
              data-selected={!entityType}
              onClick={() => {
                setEntityType('');
              }}
            >
              全部
            </button>
            {types.map((type) => (
              <button
                key={type}
                data-selected={entityType === type}
                onClick={() => {
                  setEntityType(type);
                }}
              >
                {labelFor(type)}
              </button>
            ))}
          </div>
        )}
        <div className="search-dialog__results">
          {query.trim().length === 0 && (
            <div className="empty-state">
              <strong>从一个关键词开始</strong>
              <span>结果不会包含附件正文。</span>
            </div>
          )}
          {search.isFetching && <p className="muted">正在检索本地数据…</p>}
          {search.isError && (
            <p className="form-error">搜索暂时不可用，请确认本地服务正常后重试。</p>
          )}
          {query && !search.isFetching && !search.isError && search.data?.length === 0 && (
            <div className="empty-state">
              <strong>没有匹配记录</strong>
              <span>换一个关键词或清除类型筛选。</span>
            </div>
          )}
          {search.data?.map((item) => (
            <a
              key={item.entityId}
              className="search-result"
              href={buildEntityDetailHref(
                item.entityType,
                item.entityId,
                typeof item.ownerEntityId === 'string' && typeof item.ownerEntityType === 'string'
                  ? { entityType: item.ownerEntityType, entityId: item.ownerEntityId }
                  : undefined,
              )}
              onClick={() => {
                onClose();
              }}
            >
              <div>
                <span className="pill">{labelFor(item.entityType)}</span>
                <time>{formatDate(item.updatedAt)}</time>
              </div>
              <strong>{item.title}</strong>
              <p>{item.snippet}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
