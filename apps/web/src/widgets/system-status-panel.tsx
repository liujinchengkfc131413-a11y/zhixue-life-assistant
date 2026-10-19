import { useSystemStatus } from '../entities/system/use-system-status.js';

const stateLabels = {
  STARTING: '正在启动',
  READY: '已就绪',
  DEGRADED: '等待初始化',
} as const;

const formatBytes = (value: number): string => {
  if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(1)} GB`;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  return `${(value / 1024).toFixed(0)} KB`;
};

export const SystemStatusPanel = () => {
  const status = useSystemStatus();

  if (status.isPending) {
    return <p className="status-line">正在连接本地服务…</p>;
  }

  if (status.isError) {
    return <p className="status-line status-line--error">本地服务暂时无法连接。</p>;
  }

  const { data } = status;
  const jobTotal = data.backgroundJobs.pending + data.backgroundJobs.running;

  return (
    <section className="status-panel" aria-labelledby="system-status-title">
      <div>
        <p className="status-panel__label" id="system-status-title">
          应用与后台服务状态
        </p>
        <p className="status-panel__value">{stateLabels[data.state]}</p>
      </div>
      <dl className="status-panel__details">
        <div>
          <dt>应用版本</dt>
          <dd>{data.appVersion}</dd>
        </div>
        <div>
          <dt>数据库</dt>
          <dd>{data.database.connected ? '已连接' : '未连接'}</dd>
        </div>
        <div>
          <dt>数据目录</dt>
          <dd>{data.database.dataDirectoryConfigured ? '已配置' : '未配置'}</dd>
        </div>
        <div>
          <dt>本地排程</dt>
          <dd>{data.capabilities.schedulerAvailable ? '可用' : '不可用'}</dd>
        </div>
        <div>
          <dt>AI 服务</dt>
          <dd>{data.capabilities.aiConfigured ? '已配置' : '未配置'}</dd>
        </div>
        <div>
          <dt>后台任务</dt>
          <dd>
            {jobTotal > 0
              ? `待处理 ${String(data.backgroundJobs.pending)} · 运行中 ${String(data.backgroundJobs.running)}`
              : '无待处理任务'}
            {data.backgroundJobs.failed > 0 ? ` · 失败 ${String(data.backgroundJobs.failed)}` : ''}
          </dd>
        </div>
        <div>
          <dt>磁盘空间</dt>
          <dd>
            可用 {formatBytes(data.disk.freeBytes)} / 共 {formatBytes(data.disk.totalBytes)}
          </dd>
        </div>
        <div>
          <dt>服务器时间</dt>
          <dd>{new Date(data.serverTime).toLocaleString('zh-CN')}</dd>
        </div>
      </dl>
    </section>
  );
};
