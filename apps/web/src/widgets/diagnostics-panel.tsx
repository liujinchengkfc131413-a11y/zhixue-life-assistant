import { useState } from 'react';

import { useDiagnostics, useExportDiagnostics } from '../features/settings/api.js';

const formatBytes = (value: number): string => {
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${String(value)} B`;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${String(days)} 天 ${String(hours)} 小时`;
  if (hours > 0) return `${String(hours)} 小时 ${String(minutes)} 分钟`;
  return `${String(minutes)} 分钟`;
};

export const DiagnosticsPanel = () => {
  const diagnostics = useDiagnostics();
  const exportDiagnostics = useExportDiagnostics();
  const [copied, setCopied] = useState(false);

  if (diagnostics.isPending) {
    return (
      <section className="settings-section">
        <h2>诊断信息</h2>
        <p>正在读取诊断信息…</p>
      </section>
    );
  }

  if (diagnostics.isError) {
    return (
      <section className="settings-section">
        <h2>诊断信息</h2>
        <p className="field-hint">诊断信息当前不可用，本地服务可能尚未完全初始化。</p>
      </section>
    );
  }

  const info = diagnostics.data;
  const summary = [
    `应用版本：${info.appVersion}`,
    `Schema 版本：${String(info.schemaVersion)}`,
    `数据目录 ID：${info.dataDirectoryId}`,
    `运行时长：${formatUptime(info.uptimeSeconds)}`,
    `后台任务：待处理 ${String(info.backgroundJobs.pending)} · 失败 ${String(
      info.backgroundJobs.failed,
    )}`,
    `日志文件：${info.logs.map((file) => `${file.name} (${formatBytes(file.bytes)})`).join('、')}`,
  ].join('\n');

  const copySummary = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // 剪贴板不可用时静默失败。
    }
  };

  return (
    <section className="settings-section" aria-labelledby="diagnostics-title">
      <div className="section-heading">
        <div>
          <h2 id="diagnostics-title">诊断信息</h2>
          <p>以下信息经过脱敏，不包含个人内容与密钥；日志仅保留最近片段。</p>
        </div>
        <div className="row-actions">
          <button className="button button--small" type="button" onClick={() => void copySummary()}>
            {copied ? '已复制' : '复制诊断信息'}
          </button>
          <button
            className="button button--small"
            type="button"
            disabled={exportDiagnostics.isPending}
            onClick={() => {
              exportDiagnostics.mutate();
            }}
          >
            {exportDiagnostics.isPending ? '正在导出…' : '导出诊断包'}
          </button>
        </div>
      </div>
      <dl className="status-panel__details">
        <div>
          <dt>应用版本</dt>
          <dd>{info.appVersion}</dd>
        </div>
        <div>
          <dt>Schema 版本</dt>
          <dd>{String(info.schemaVersion)}</dd>
        </div>
        <div>
          <dt>数据目录 ID</dt>
          <dd>{info.dataDirectoryId}</dd>
        </div>
        <div>
          <dt>运行时长</dt>
          <dd>{formatUptime(info.uptimeSeconds)}</dd>
        </div>
        <div>
          <dt>后台任务</dt>
          <dd>
            待处理 {String(info.backgroundJobs.pending)} · 运行中{' '}
            {String(info.backgroundJobs.running)}
            {info.backgroundJobs.failed > 0 ? ` · 失败 ${String(info.backgroundJobs.failed)}` : ''}
          </dd>
        </div>
      </dl>
      {exportDiagnostics.data ? (
        <p className="form-success">诊断包已生成：{exportDiagnostics.data.path}</p>
      ) : null}
      <details className="diagnostics-tail">
        <summary>查看脱敏日志尾部</summary>
        <pre>{info.logTail || '暂无日志。'}</pre>
      </details>
    </section>
  );
};
