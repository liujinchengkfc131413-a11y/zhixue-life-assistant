# ADR-011：统一业务操作上下文、变更记录与快照契约

- 状态：接受（Foundation Step 1）
- 日期：2026-08-30
- 对应缺口：A6、A15（均保持 OPEN）

## 背景

现有 `ActionRepository`、`WorkRepository`、`LifeRepository`、`InboxRepository` 和
`InformationRepository` 分别创建 change set。多数 `entity_versions.snapshot_json` 实际保存请求参数或
patch，`change_operations.before_json` 缺失，且普通 AI 工具会被 repository 记录为 `USER`。

本决策只建立统一基础设施和 TASK UPDATE proof-of-concept，不迁移全部 repository，不扩展历史 UI，
也不关闭 A6/A15。

## Schema 结论

### AI 来源链

保留单一事实来源：

```text
change_sets.source_ref = ai-run:<runId>
  -> ai_runs.id
     -> ai_runs.session_id -> chat_sessions
     -> ai_runs.provider_config_id -> ai_provider_configs
     -> ai_runs.user_message_id -> user intent message
     -> ai_runs.assistant_message_id -> chat_messages.model_id

change_sets.actor_ref = ai-action:<actionId>（仅存在确认 action 时）
entity_versions.actor_ref = 同一 actor reference
```

run 可以可靠推导 session、provider、user intent、assistant message 和 model。为保证工具写入后即使 run
失败仍能追溯实际 model，ChatRunner 必须在任何工具执行前把当前 `modelId` 写入既有的
`chat_messages.model_id`。不新增重复的 `model_id`、`session_id` 或 `run_id`。

`ai_runs` 目前不能推导可选 `ai_action`。只依赖 `entity_versions.actor_ref` 也无法覆盖 PURGE，因为实体版本
会随实体删除。因此 migration 018 只为 change set 增加通用 `actor_ref`，不增加 AI 专用重复字段。
`source_ref` 是多态引用，统一 recorder 在写入时校验引用真实性，而不是增加多组 nullable foreign key。

### Migration 018

- `change_sets.actor_ref TEXT`：记录执行主体或确认 action；USER 为 `local-user`，AI action 为
  `ai-action:<id>`。
- `(source, source_ref)` 索引：支持从 run/job/request 追查 change set。
- 旧 change set 的 `actor_ref` 为 `NULL`，不伪造历史主体。
- 旧数据库可原地升级；升级后的 schema version 为 18。新版本备份不能由仅支持 schema 17 的旧程序恢复。

## OperationContext

最终结构定义在 `operation-context.ts`：

```ts
interface OperationContext {
  source: 'USER' | 'RULE_ENGINE' | 'AI' | 'SYSTEM';
  sourceRef: string | null;
  actorRef: string | null;
  userIntentReference?: string;
  requestId?: string;
  aiSessionId?: string;
  aiRunId?: string;
  aiActionId?: string;
  ruleJobId?: string;
  scheduleRunId?: string;
  activeChangeSetId?: string;
}
```

引用协议：

| 来源 | `sourceRef` | `actorRef` |
|---|---|---|
| USER | `request:<requestId>` | `local-user` 或未来用户主体 |
| AI | `ai-run:<runId>` | `ai-run:<runId>` 或 `ai-action:<actionId>` |
| RULE_ENGINE | `rule-job:<jobId>` 或 `schedule-run:<runId>` | `rule-engine` |
| SYSTEM | `system:<operationId>` | `system` |

HTTP/application boundary 必须显式创建 USER context。新路径不允许 repository 通过“没有 context”猜测
USER；尚未迁移的旧方法保留为明确的 legacy compatibility path。

## Unified Change Recorder

复用 `ConsistencyRepository.recordChange()`，将它从只写 `change_sets/change_operations` 的闲置方法改造成
统一入口，没有创建第九个 writer。

统一入口负责：

1. 校验 OperationContext，AI run/session/user intent/action 必须真实存在且一致。
2. 没有 `activeChangeSetId` 时创建一个 change set；存在时校验来源、sourceRef、actorRef 和状态后追加。
3. 一个 `changes` 数组可记录多个实体，统一 sequence，共享同一 `changeSetId`。
4. 同时写 `change_operations` 的 before/after 与 `entity_versions` 的 canonical snapshot。
5. `entity_versions.source/actor_ref` 与 change set context 一致。
6. 所有写入参加调用方现有 SQLite transaction；任一步失败整体回滚。

操作语义：

| 操作 | before | after | entity version |
|---|---|---|---|
| CREATE | `NULL` | 完整 canonical snapshot | 写新版本 |
| UPDATE | 完整旧 snapshot | 完整新 snapshot | 写新版本 |
| SOFT_DELETE | 删除前完整 snapshot | 明确的删除后业务状态 | 写新版本 |
| RESTORE | 恢复前完整 snapshot | 恢复后完整 snapshot | 写新版本 |
| PURGE | 仅允许脱敏后的影响摘要 | `NULL` | 不写会被 FK cascade 删除的版本 |

本轮只迁移 TASK HTTP UPDATE。旧 `ActionRepository.updateTask()` 暂时保留，AI ToolRegistry、Work、Life、
Inbox 和历史恢复 writer 留待后续分批迁移。

## Canonical Snapshot Contract

`snapshot_json` 从 contract version 1 起保存：

```ts
interface CanonicalEntitySnapshot {
  contractVersion: 1;
  entityType: string;
  canonicalState: unknown;
  ownedRelations: unknown;
}
```

`patch_json` 不再伪装成 patch，而保存快照可信元数据：

```json
{
  "contractVersion": 1,
  "snapshotKind": "CANONICAL | BASELINE",
  "restoreEligibility": "ELIGIBLE"
}
```

边界规则：

- canonical business state：决定实体业务含义、可由用户直接维护且恢复后必须一致的字段。
- owned relations：随聚合恢复的子项或关联 ID；每个 adapter 必须明确 replace/merge/relink 规则。
- derived/rebuildable state：搜索投影、自动统计、自动进度、排程投影、缓存和通知投影，不复制旧数据库行，
  恢复后重建。

未来主要 adapter 的边界：

| 实体/聚合 | canonical business state | owned relations | derived/rebuildable |
|---|---|---|---|
| GOAL | 标题、说明、类型、日期、状态、手动进度模式和值 | 指标定义、标签 | 自动进度、搜索、统计 |
| PLAN | 标题、说明、目标、分类、日期、状态、优先级、手动进度 | 里程碑、标签、资源链接 | 自动进度、统计、搜索 |
| TASK | 分类/目标/计划/父任务、正文、状态、优先级、截止、排程偏好、完成/取消时间 | 依赖、标签、提醒、附件链接 | schedule blocks、搜索、目标/计划自动进度 |
| EVENT | 分类、正文、起止、时区、类型、状态、冲突策略 | recurrence rule、例外、提醒、标签、附件链接 | recurrence occurrences、时间流投影、搜索 |
| NOTE | 分类、标题、编辑模式、富文本/Markdown、摘要 | work note links、标签、附件链接 | plain-text/search projection |
| 自媒体 | 内容业务字段、发布状态与时间 | 指标、材料/附件、任务/日程链接 | 趋势统计、搜索 |
| 开发 | 项目/功能/缺陷/里程碑各自业务字段 | 项目内成员、仓库/文档/任务链接 | 完成率、统计、搜索 |
| 学习 | 资源与学习记录业务字段 | 计划/任务/笔记链接 | 进度汇总、时长统计、搜索 |
| 购物 | 待购项、预算、购买记录、价格/数量/状态 | 购买产生的消费引用 | 预算汇总、价格差异统计、搜索 |
| 饮食 | 食谱、计划、餐食、饮水、偏好业务字段 | 食材、餐食与消费引用 | 营养/趋势统计、搜索 |
| 健身 | 训练计划、训练记录、身体/个人纪录/恢复字段 | 计划动作、训练 sets、目标链接 | 趋势、目标自动进度、搜索 |
| 娱乐 | 条目、进度、活动/旅行、体验记录、支出字段 | trip detail、session/expense links | 时长/支出统计、搜索 |

TASK POC 已实现上述 snapshot adapter，并明确排除 schedule/search/自动进度等派生状态。

## Legacy History 策略

旧行的 `patch_json={}` 不满足 contract version 1，统一视为 `UNVERIFIED_LEGACY`。不得因为存在
`entity_versions` 行就认定可恢复。

安全兼容策略：

1. 不批量改写、不猜测旧 before，也不从 patch 反推已无法证明的字段。
2. 某实体第一次进入新 recorder 时，用事务内实际读取的完整 before snapshot，把“当前旧版本”升级为
   `BASELINE/ELIGIBLE`。这是对当下可观察状态建立基线，不是重写更早历史。
3. baseline 之后的新版本全部使用 `CANONICAL/ELIGIBLE`。
4. baseline 以前未带可信 metadata 的版本继续保留用于审计，但未来 restore adapter 必须拒绝恢复。
5. 没有对应旧版本行时，可插入 `change_set_id=NULL/source=SYSTEM` 的同版本 baseline；不制造业务变更。
6. 本 Step 1 不修改历史 UI，也不把旧 restore switch 扩展到新 adapter。A6 后续接入时，版本 API/UI 和
   restore executor 必须统一使用 `isTrustedCanonicalSnapshotMetadata()`，否则不能宣称旧版本可恢复。

该方案不需要为 legacy 行增加数据库列；可信状态由 `patch_json` 中带版本的 metadata 判定。缺少 metadata
即不可信，避免把旧 `{}` 误当成有效新格式。

## Proof-of-concept

- USER HTTP `PATCH /api/v1/tasks/:id` 在 Fastify boundary 显式创建 USER context。
- recorder 保存完整旧/新 TASK snapshot；change set、operation、entity version 与
  `entity_index.version` 一致。
- isolated AI test 传入真实 aiRun/session/userMessage context，结果保存为 AI，sourceRef 可关联到
  session/provider/model，不再降级成 USER。
- production AI ToolRegistry 尚未迁移，A15 仍为 OPEN。

## 后果与后续顺序

- migration 018 只补通用 actor reference；没有复制现有 AI 事实来源。
- 后续按 Action → Work/Life → Inbox → Rule/SYSTEM 分批迁移，逐个删除 legacy writer。
- 每个实体先实现 canonical adapter 和可信 baseline，再开放新 restore。
- `apply_change_plan` 最终改为调用同一 recorder，批内实体共享 active change set。
- A6、A15 在主要对象 adapter、legacy restore gating、AI 全写工具与统一撤销接入前保持 OPEN。
