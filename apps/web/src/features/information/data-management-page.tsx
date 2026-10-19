import { useState } from 'react';
import { Archive, Database, FlaskConical, FolderCog, HardDrive } from 'lucide-react';
import { ErrorState } from '../../shared/state-panel.js';
import { formatDate, formatDateTime } from '../../shared/format.js';
import { readEntityDetailTarget } from '../../shared/entity-detail-target.js';
import { useDialogA11y } from '../../shared/use-dialog-a11y.js';
import { SystemStatusPanel } from '../../widgets/system-status-panel.js';
import { useBackups, useCreateBackup, useDemoData, useSetupStatus } from '../settings/api.js';
import { ScheduleHistoryDrawer } from '../time-system/today/schedule-history-drawer.js';

import {
  purgeRecycleItem,
  useAttachment,
  useChangeSets,
  useEntityVersions,
  useExecuteRestore,
  useHistoryAction,
  useRecycleBin,
  useRestoreRecycleItem,
  useSearch,
  useVersionPreview,
} from './api.js';

const backupStatusLabel: Record<string, string> = {
  RUNNING: '进行中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  DELETED: '已清理',
};

const historyKindMeta: Record<string, { badge: string; hint: string }> = {
  AUDIT_ONLY: { badge: '旧版审计', hint: '旧版历史仅供审计，无法可靠恢复。' },
  BASELINE: { badge: '可信基线', hint: '可信基线版本' },
  CANONICAL: { badge: '可信历史', hint: '可信历史版本' },
};

const fieldLabels: Record<string, string> = {
  categoryId: '分类',
  goalId: '目标',
  planId: '计划',
  parentTaskId: '父任务',
  title: '标题',
  description: '说明',
  status: '状态',
  priority: '优先级',
  dueAt: '截止时间',
  estimatedMinutes: '预计时长',
  isFlexible: '弹性任务',
  isSplittable: '允许拆分',
  preferredArea: '偏好区域',
  completedAt: '完成时间',
  cancelledAt: '取消时间',
  startDate: '开始日期',
  endDate: '结束日期',
  horizon: '周期',
  goalType: '目标类型',
  progressMode: '进度模式',
  manualProgress: '手动进度',
  name: '名称',
  summary: '摘要',
  startAt: '开始时间',
  endAt: '结束时间',
  timeZone: '时区',
  eventType: '日程类型',
  isImmovable: '不可移动',
  allowOverlap: '允许重叠',
  editorMode: '编辑模式',
  richContent: '富文本内容',
  markdownContent: 'Markdown 内容',
  contentType: '内容类型',
  platform: '平台',
  productionStatus: '制作状态',
  plannedPublishAt: '计划发布时间',
  publishedAt: '发布时间',
  idea: '选题灵感',
  script: '脚本',
  resourceType: '资源类型',
  author: '作者',
  sourceUrl: '来源链接',
  progressCurrent: '当前进度',
  progressTotal: '总进度',
  progressUnit: '进度单位',
  productCategory: '商品分类',
  quantity: '数量',
  unit: '单位',
  plannedUnitPriceMinor: '计划单价',
  budgetAmountMinor: '预算',
  purchaseChannel: '购买渠道',
  servings: '份数',
  rating: '评分',
  note: '备注',
  listType: '清单类型',
  itemType: '条目类型',
};

const fieldLabel = (field: string): string => fieldLabels[field] ?? field;

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '空';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value))
    return value.length === 0 ? '空列表' : value.map(formatValue).join('、');
  return JSON.stringify(value, null, 2);
};

const restoreErrorMessage = (error: unknown): string => {
  const code = (error as { code?: string }).code;
  if (code === 'RESTORE_CONFLICT')
    return '该版本无法恢复：目标历史版本引用的分类、任务、附件、标签或日程当前不可用（已删除、已归档或时间冲突）。请先处理相关引用后重试。';
  if (code === 'ENTITY_VERSION_UNVERIFIED') return '该历史版本无法确认完整性，因此不能恢复。';
  if (code === 'CONFIRMATION_INVALID') return '恢复确认已失效或已被使用，请重新发起恢复。';
  if (code === 'VERSION_CONFLICT') return '当前版本已变化，请关闭后重新查看版本历史再试。';
  return error instanceof Error ? error.message : '恢复失败，请稍后重试。';
};

export const DataManagementPage = () => {
  const target = readEntityDetailTarget(window.location.search);
  const attachmentId = target?.entityType === 'ATTACHMENT' ? target.entityId : undefined;
  const [tab, setTab] = useState<'recent' | 'recycle'>('recent');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [scheduleHistoryQuery, setScheduleHistoryQuery] = useState('');
  const [scheduleHistoryTask, setScheduleHistoryTask] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const closeHistory = () => {
    setSelectedEntityId(null);
    setPreviewTarget(null);
    setConfirming(null);
  };
  const historyPanelRef = useDialogA11y<HTMLElement>(selectedEntityId !== null, closeHistory);
  const changes = useChangeSets();
  const attachment = useAttachment(attachmentId);
  const recycle = useRecycleBin();
  const restore = useRestoreRecycleItem();
  const versions = useEntityVersions(selectedEntityId);
  const historyAction = useHistoryAction();
  const versionPreview = useVersionPreview();
  const executeRestore = useExecuteRestore();
  const setup = useSetupStatus();
  const backups = useBackups();
  const createBackup = useCreateBackup();
  const demo = useDemoData();
  const currentVersion = versions.data?.[0]?.entityVersion;
  const latestBackup = backups.data?.[0];
  const scheduleHistorySearch = useSearch(scheduleHistoryQuery, 'TASK');
  const openEntityHistory = (entityId: string) => {
    setSelectedEntityId(entityId);
    setPreviewTarget(null);
    setConfirming(null);
  };
  const openVersionPreview = (version: number, confirm: boolean) => {
    if (selectedEntityId === null || currentVersion === undefined) return;
    setPreviewTarget(version);
    setConfirming(confirm ? version : null);
    const loaded = previewTarget === version && versionPreview.data !== undefined;
    if (!loaded)
      versionPreview.mutate({
        entityId: selectedEntityId,
        targetVersion: version,
        expectedVersion: currentVersion,
      });
  };
  const confirmRestore = () => {
    if (versionPreview.data === undefined) return;
    executeRestore.mutate(versionPreview.data, {
      onSuccess: () => {
        setConfirming(null);
        setPreviewTarget(null);
      },
    });
  };
  const cancelRestore = () => {
    setConfirming(null);
  };
  return (
    <div className="page data-management">
      <header className="page__header">
        <div>
          <span className="eyebrow">版本与可恢复性</span>
          <h1>数据管理</h1>
          <p>查看最近操作、对象版本记录，以及 30 天内可恢复的已删除内容。</p>
        </div>
      </header>
      <section className="data-overview" aria-labelledby="data-overview-title">
        <div className="data-overview__heading">
          <div>
            <span className="eyebrow">可靠性概览</span>
            <h2 id="data-overview-title">本地数据状态</h2>
          </div>
          <a className="button button--secondary" href="/settings#local-data">
            存储、恢复与演示数据设置
          </a>
        </div>
        <div className="data-overview__grid">
          <article>
            <HardDrive aria-hidden="true" size={18} />
            <span>数据状态</span>
            <strong>{setup.isError ? '需要检查' : setup.data ? '本地数据可用' : '正在检查'}</strong>
          </article>
          <article>
            <FolderCog aria-hidden="true" size={18} />
            <span>存储目录</span>
            <strong title={setup.data?.dataDirectory ?? undefined}>
              {setup.data?.dataDirectory ?? '正在读取'}
            </strong>
          </article>
          <article>
            <Archive aria-hidden="true" size={18} />
            <span>最近备份</span>
            <strong>
              {latestBackup
                ? `${formatDateTime(latestBackup.createdAt)} · ${backupStatusLabel[latestBackup.status] ?? '状态未知'}`
                : '暂无备份'}
            </strong>
            <button
              className="text-button"
              disabled={createBackup.isPending}
              onClick={() => {
                createBackup.mutate();
              }}
              type="button"
            >
              {createBackup.isPending ? '正在备份…' : '立即备份'}
            </button>
          </article>
          <article>
            <Database aria-hidden="true" size={18} />
            <span>数据库状态</span>
            <strong>{setup.isError ? '状态未知' : setup.data ? '已连接' : '正在检查'}</strong>
          </article>
        </div>
        {createBackup.data ? (
          <p className="data-overview__feedback">备份已生成：{createBackup.data.path}</p>
        ) : null}
      </section>
      {attachmentId === undefined ? null : (
        <section className="data-overview" aria-labelledby="attachment-detail-title">
          <div className="data-overview__heading">
            <div>
              <span className="eyebrow">附件详情</span>
              <h2 id="attachment-detail-title">
                {attachment.data?.originalName ?? '正在读取附件…'}
              </h2>
            </div>
            {attachment.data?.status === 'READY' ? (
              <a
                className="button button--secondary"
                href={`/api/v1/attachments/${attachment.data.id}/content`}
              >
                下载附件
              </a>
            ) : null}
          </div>
          {attachment.isError ? (
            <ErrorState>附件元数据暂时无法读取，请返回搜索后重试。</ErrorState>
          ) : attachment.data ? (
            <div className="data-overview__grid">
              <article>
                <span>文件类型</span>
                <strong>{attachment.data.mediaType}</strong>
              </article>
              <article>
                <span>扩展名</span>
                <strong>{attachment.data.extension ?? '无'}</strong>
              </article>
              <article>
                <span>文件大小</span>
                <strong>{(attachment.data.sizeBytes / 1024).toFixed(1)} KB</strong>
              </article>
              <article>
                <span>状态</span>
                <strong>{attachment.data.status}</strong>
              </article>
            </div>
          ) : (
            <p className="status-line">正在读取附件元数据…</p>
          )}
          {attachment.data?.description ? <p>{attachment.data.description}</p> : null}
        </section>
      )}
      <SystemStatusPanel />
      <div className="segmented">
        <button
          data-selected={tab === 'recent'}
          onClick={() => {
            setTab('recent');
          }}
        >
          最近操作
        </button>
        <button
          data-selected={tab === 'recycle'}
          onClick={() => {
            setTab('recycle');
          }}
        >
          回收站 {recycle.data?.length ? `· ${String(recycle.data.length)}` : ''}
        </button>
      </div>
      {tab === 'recent' ? (
        <section className="management-list">
          <div>
            <label>
              查找任务调度历史
              <input
                aria-label="查找任务调度历史"
                placeholder="输入任务标题，包括已完成任务"
                type="search"
                value={scheduleHistoryQuery}
                onChange={(event) => {
                  setScheduleHistoryQuery(event.target.value);
                }}
              />
            </label>
            {scheduleHistorySearch.isLoading ? <p className="field-hint">正在查找任务…</p> : null}
            {scheduleHistorySearch.isError ? (
              <p className="field-hint">任务搜索暂时不可用，请重试。</p>
            ) : null}
          </div>
          {(scheduleHistorySearch.data ?? []).map((item) => (
            <article key={`schedule-history-search:${item.entityId}`}>
              <div>
                <strong>{item.title}</strong>
                <span>任务 · 可查看完整调度历史</span>
              </div>
              <div className="management-list__actions">
                <time>{formatDateTime(item.updatedAt)}</time>
                <button
                  className="text-button"
                  onClick={() => {
                    setScheduleHistoryTask({ id: item.entityId, title: item.title });
                  }}
                  type="button"
                >
                  调度历史
                </button>
              </div>
            </article>
          ))}
          {changes.data?.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.summary}</strong>
                <span>
                  {{
                    USER: '用户操作',
                    RULE_ENGINE: '规则引擎',
                    AI: 'AI 操作',
                  }[item.source] ?? item.source}{' '}
                  ·{' '}
                  {{
                    LOW_WRITE: '低风险',
                    HIGH_IMPACT: '高风险',
                  }[item.riskLevel] ?? item.riskLevel}
                </span>
              </div>
              <div className="management-list__actions">
                <span className="pill">
                  {{
                    APPLIED: '已应用',
                    REVERTED: '已撤销',
                    PENDING: '待处理',
                  }[item.status] ?? item.status}
                </span>
                <time>{formatDateTime(item.createdAt)}</time>
                {item.entityId !== null && (
                  <button
                    className="text-button"
                    onClick={() => {
                      if (item.entityId !== null) openEntityHistory(item.entityId);
                    }}
                  >
                    版本
                  </button>
                )}
                {item.canUndo && (
                  <button
                    className="text-button"
                    disabled={historyAction.isPending}
                    onClick={() => {
                      historyAction.mutate({ kind: 'undo', changeSet: item });
                    }}
                  >
                    撤销
                  </button>
                )}
                {item.canRedo && (
                  <button
                    className="text-button"
                    disabled={historyAction.isPending}
                    onClick={() => {
                      historyAction.mutate({ kind: 'redo', changeSet: item });
                    }}
                  >
                    重做
                  </button>
                )}
              </div>
            </article>
          ))}
          {changes.isLoading ? <p className="status-line">正在读取操作记录…</p> : null}
          {changes.isError ? <ErrorState>操作记录暂时无法加载，请重试。</ErrorState> : null}
          {changes.data?.length === 0 && !changes.isLoading && !changes.isError && (
            <div className="empty-state">
              <strong>还没有操作记录</strong>
            </div>
          )}
          {historyAction.isError ? (
            <p className="status-line status-line--error">
              {historyAction.error instanceof Error
                ? `${historyAction.error.message}，请重试。`
                : '操作失败，请重试。'}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="management-list">
          {recycle.data?.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {{
                    TASK: '任务',
                    EVENT: '日程',
                    NOTE: '笔记',
                    GOAL: '目标',
                    PLAN: '计划',
                    SHOPPING_ITEM: '购物项',
                    ENTERTAINMENT_ITEM: '娱乐项',
                  }[item.entityType] ?? item.entityType}{' '}
                  · 将于 {formatDate(item.purgeAfter)} 到期
                </span>
              </div>
              <div className="row-actions">
                <button
                  className="button button--secondary"
                  disabled={restore.isPending}
                  onClick={() => {
                    restore.mutate(item);
                  }}
                >
                  恢复
                </button>
              </div>
            </article>
          ))}
          {recycle.isLoading ? <p className="status-line">正在读取回收站…</p> : null}
          {recycle.isError ? <ErrorState>回收站暂时无法加载，请重试。</ErrorState> : null}
          {recycle.data?.length === 0 && !recycle.isLoading && !recycle.isError && (
            <div className="empty-state">
              <strong>回收站是空的</strong>
              <span>软删除内容会在这里保留 30 天。</span>
            </div>
          )}
        </section>
      )}
      <section className="data-restore-demo" aria-labelledby="data-restore-demo-title">
        <FlaskConical aria-hidden="true" size={20} />
        <div>
          <h2 id="data-restore-demo-title">恢复与演示数据</h2>
          <p>
            {demo.data?.exists
              ? `当前有 ${String(demo.data.recordCount)} 条演示记录。完整备份恢复和演示数据清理均需预检确认。`
              : demo.isLoading
                ? '正在读取演示数据状态…'
                : '当前为干净空间。完整备份恢复会先执行预检并创建恢复前备份。'}
          </p>
        </div>
        <a className="button button--secondary" href="/settings#local-data">
          打开安全操作设置
        </a>
      </section>
      {tab === 'recycle' && (recycle.data?.length ?? 0) > 0 ? (
        <section className="data-danger-zone" aria-labelledby="data-danger-title">
          <div>
            <span className="eyebrow">危险操作</span>
            <h2 id="data-danger-title">永久删除</h2>
            <p>这些操作无法撤销。需要保留的内容请先在上方恢复。</p>
          </div>
          <div className="data-danger-zone__actions">
            {recycle.data?.map((item) => (
              <button
                className="button button--danger"
                key={item.id}
                onClick={() => {
                  void (async () => {
                    await purgeRecycleItem(item);
                    await recycle.refetch();
                  })();
                }}
                type="button"
              >
                永久删除“{item.title}”
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {scheduleHistoryTask !== null && (
        <ScheduleHistoryDrawer
          taskId={scheduleHistoryTask.id}
          taskTitle={scheduleHistoryTask.title}
          onClose={() => {
            setScheduleHistoryTask(null);
          }}
        />
      )}
      {selectedEntityId !== null && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeHistory();
          }}
        >
          <section
            ref={historyPanelRef}
            className="history-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="对象版本历史"
            tabIndex={-1}
          >
            <header>
              <div>
                <h2>对象版本历史</h2>
                <p>恢复不会删除后续历史，而是生成一个新版本。</p>
              </div>
              <button className="button button--ghost" onClick={closeHistory}>
                关闭
              </button>
            </header>
            <div className="history-dialog__list">
              {versions.data?.map((version) => {
                const meta = historyKindMeta[version.historyKind] ?? {
                  badge: version.historyKind,
                  hint: '',
                };
                const isOlder =
                  currentVersion !== undefined && version.entityVersion < currentVersion;
                const isEligible = version.restoreEligibility === 'ELIGIBLE';
                return (
                  <article key={version.entityVersion}>
                    <div>
                      <strong>版本 {version.entityVersion}</strong>
                      <span>
                        {version.summary ??
                          { USER: '用户操作', RULE_ENGINE: '规则引擎', AI: 'AI 操作' }[
                            version.source
                          ] ??
                          version.source}{' '}
                        · {formatDateTime(version.createdAt)}
                      </span>
                      <span className="pill">{meta.badge}</span>
                    </div>
                    <p className="status-line">{meta.hint}</p>
                    {isOlder && isEligible && (
                      <div className="row-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => {
                            openVersionPreview(version.entityVersion, false);
                          }}
                        >
                          查看变更
                        </button>
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={() => {
                            openVersionPreview(version.entityVersion, true);
                          }}
                        >
                          恢复此版本
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {previewTarget !== null ? (
              <div className="history-dialog__preview">
                {versionPreview.isPending ? (
                  <p className="status-line">正在读取变更预览…</p>
                ) : versionPreview.isError ? (
                  <p className="status-line status-line--error">
                    {restoreErrorMessage(versionPreview.error)}
                  </p>
                ) : versionPreview.data !== undefined ? (
                  <>
                    <p className="status-line">
                      {versionPreview.data.preview.impact ?? '恢复到目标历史版本。'}
                    </p>
                    {(versionPreview.data.preview.changes?.length ?? 0) === 0 ? (
                      <p className="status-line">该版本与当前状态没有字段差异。</p>
                    ) : (
                      <dl
                        className="history-dialog__diff"
                        style={{ display: 'grid', gap: '8px', margin: '12px 0' }}
                      >
                        {versionPreview.data.preview.changes?.map((change) => (
                          <div
                            key={change.field}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(96px, auto) 1fr 1fr',
                              gap: '8px',
                              alignItems: 'start',
                            }}
                          >
                            <dt style={{ fontWeight: 600 }}>{fieldLabel(change.field)}</dt>
                            <dd style={{ margin: 0 }}>
                              <span style={{ opacity: 0.72 }}>当前值</span>
                              <pre
                                style={{
                                  margin: '2px 0 0',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {formatValue(change.before)}
                              </pre>
                            </dd>
                            <dd style={{ margin: 0 }}>
                              <span style={{ opacity: 0.72 }}>目标历史版本值</span>
                              <pre
                                style={{
                                  margin: '2px 0 0',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {formatValue(change.after)}
                              </pre>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {confirming === previewTarget && (
                      <div className="row-actions">
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={executeRestore.isPending}
                          onClick={confirmRestore}
                        >
                          {executeRestore.isPending ? '正在恢复…' : '确认恢复此版本'}
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          disabled={executeRestore.isPending}
                          onClick={cancelRestore}
                        >
                          取消
                        </button>
                      </div>
                    )}
                    {executeRestore.isError ? (
                      <p className="status-line status-line--error">
                        {restoreErrorMessage(executeRestore.error)}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
};
