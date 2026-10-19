# 架构决策记录

| ADR | 状态 | 决策 |
|---|---|---|
| [001](./001-pnpm-monorepo.md) | 接受 | pnpm Monorepo 与模块化单体 |
| [002](./002-sqlite-wal.md) | 接受 | SQLite WAL 为本地权威数据源 |
| [003](./003-zod-contracts.md) | 接受 | Zod 生成 OpenAPI 与工具 Schema |
| [004](./004-domain-boundaries.md) | 接受 | 领域层不依赖框架和基础设施 |
| [005](./005-persistent-jobs.md) | 接受 | SQLite 持久化 Job/Outbox |
| [006](./006-windows-launcher.md) | 接受 | 薄 .NET Windows 启动器 |
| [007](./007-api-key-credentials.md) | 接受 | API Key 使用 Windows 凭据管理器 |
| [008](./008-time-flow-renderer.md) | 接受 | 今日时间流使用可替换 Canvas Renderer |
| [009](./009-risk-confirmation.md) | 接受 | 高风险操作采用预览—确认—执行 |
| [010](./010-ai-tool-boundary.md) | 接受 | AI 工具只调用应用层 |
| [011](./011-business-operation-context-and-change-recorder.md) | 接受（Foundation Step 1） | 统一业务操作上下文、变更记录与快照契约 |
| [012](./012-a6-canonical-history-and-restore.md) | 接受 | A6 主要聚合 canonical history 与安全恢复 |
| [013](./013-a5-overdue-reschedule-and-schedule-history.md) | 已实施（待复审判定） | A5 逾期自动重排与调度历史 |

新 ADR 从[模板](./template.md)复制。已接受的 ADR 如需推翻，应新建 ADR 并注明被替代关系。
