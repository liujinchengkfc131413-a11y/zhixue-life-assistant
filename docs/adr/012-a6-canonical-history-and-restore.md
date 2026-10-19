# ADR-012：A6 Canonical History 与安全恢复

- 状态：接受（2026-08-30 A6 Final UI Closure 完成并全量验证通过，A6 已关闭）
- 日期：2026-08-30
- 对应缺口：A6（本文件不涉及 A15）

## 决策

主要业务聚合统一通过 `CanonicalHistoryRepository` 和既有
`ConsistencyRepository.recordChange()` 写入、读取和恢复历史。恢复器实现统一 adapter 协议：

```ts
interface CanonicalSnapshotAdapter {
  captureCurrentState(): CanonicalEntitySnapshot;
  validateRestoreTarget(): RestoreConflict[];
  applyCanonicalState(): void;
  restoreOwnedRelations(): void;
  rebuildDerivedState(): void;
}
```

支持的 entity type 为：`GOAL`、`PLAN`、`TASK`、`EVENT`、`NOTE`、
`SELF_MEDIA_CONTENT`、`DEV_PROJECT`、`LEARNING_RESOURCE`、`SHOPPING_ITEM`、`RECIPE`、
`WORKOUT_PLAN`、`ENTERTAINMENT_ITEM`。七个专属模块只选择可独立操作的主要聚合根；指标、日志、
session、set、消费事实等明细不伪装成聚合根历史。

## Snapshot boundary

所有 adapter 只读取显式字段，不使用整行 dump/replay。标签、提醒、附件链接是适用实体的通用 owned
relations。

| 聚合根 | canonical fields | owned relations | external references | derived / 不 replay |
|---|---|---|---|---|
| GOAL | 分类、标题、描述、类型、状态、日期、周期、手动进度、完成时间 | 指标定义、通用关系 | 分类 | 自动/展示进度、搜索、统计 |
| PLAN | 目标/分类、标题、描述、状态、优先级、日期、手动进度 | 里程碑、通用关系 | 目标、分类 | 自动进度、搜索、统计 |
| TASK | 分类/目标/计划/父任务、正文、状态、优先级、截止与排程偏好、完成/取消时间 | 前后置依赖、通用关系 | 分类、目标、计划、父任务、依赖目标、标签、附件 | schedule blocks、搜索、目标/计划自动进度 |
| EVENT | 分类、正文、起止、时区、类型、优先级、不可移动/重叠策略、状态 | recurrence rule/exception、通用关系 | 分类、标签、附件 | recurrence occurrence、schedule blocks、搜索 |
| NOTE | 分类、标题、编辑模式、富文本/Markdown、摘要 | work links、标签、附件 | link target、分类 | plain text、搜索 |
| SELF_MEDIA_CONTENT | 平台、内容类型、标题/正文、状态、发布时间、关联日程/任务 | 通用关系 | 分类、日程、任务 | 指标趋势、搜索；指标事实不 replay |
| DEV_PROJECT | 项目标题、描述、状态、优先级、日期、仓库/技术栈、关联计划 | 通用关系 | 分类、计划 | 完成率、搜索；feature/defect/milestone 独立事实不 replay |
| LEARNING_RESOURCE | 资源标题、类型、来源、状态、优先级、进度、日期 | 学习计划链接、通用关系 | 分类、计划 | 时长/进度汇总、搜索；session 不 replay |
| SHOPPING_ITEM | 商品、数量、价格、预算、优先级、状态、日期、关联任务 | 通用关系 | 分类、任务 | 预算/价格汇总、搜索；purchase/expense 不 replay |
| RECIPE | 食谱正文、份数、营养和准备/烹饪时间 | 食材、通用关系 | 分类 | 营养汇总、搜索；meal facts 不 replay |
| WORKOUT_PLAN | 计划标题、描述、状态、日期、关联目标 | 计划动作、通用关系 | 分类、目标、exercise | 自动进度、搜索；session/set/body facts 不 replay |
| ENTERTAINMENT_ITEM | 条目类型、标题、状态、评分、进度、日期、备注 | trip detail、通用关系 | 分类、trip event/task | 时长/支出统计、搜索；session/expense 不 replay |

## Legacy 与 BASELINE 语义

- 缺少可信 metadata 的旧版本分类为 `AUDIT_ONLY / UNVERIFIED`，明确拒绝内容恢复。
- 不从旧 request patch 推断 before，不回填无法证明的历史值。
- 实体第一次进入统一 recorder 时，以事务内完整当前状态建立 `BASELINE / ELIGIBLE`。
- 若同版本旧行存在，baseline 升级该行；若不存在，以 `SYSTEM`、空 change set 写同版本 baseline。
- baseline 不增加 `entity_index.version`，不创建 change set，不冒充用户业务变更，也不会重复版本。
- baseline 后的新写入均为 `CANONICAL / ELIGIBLE`，恢复本身生成新的 canonical version。

可信度保存在既有 `snapshot_json` / `patch_json` contract metadata；无需新增 migration 或复制字段。

## Restore constraints

恢复前一次性收集冲突，存在任一冲突便拒绝整个操作：

- 分类不存在、已归档或 TASK 分类 area 不匹配；目标、计划、父任务、依赖或其他外部引用不存在/已删除；
- TASK 父链超过允许深度、依赖自环或恢复后成环；标签已删除；附件元数据或受管文件已 GC；
- PLAN milestone、EVENT recurrence rule/exception 等 owned row 已永久删除；
- EVENT 不允许重叠时与当前有效事件冲突；NOTE work link target 不存在；
- learning plan、workout exercise、trip event/task 等模块引用失效。

不存在“尽量恢复”：关系不能完整恢复时返回 conflict/preview，不能留下 dangling FK，也不能静默跳过。

## 原子恢复与 derived rebuild

一次 restore 在同一 SQLite transaction 中完成：读取并验证指定可信版本、捕获完整 before、验证所有
constraints、应用 canonical state、替换 owned relations、递增实体版本、通过统一 recorder 写
`RESTORE` change set/operation/entity version、删除旧 derived projection 并写 rebuild outbox。任一步失败，
实体、关系、版本、历史与 outbox 全部回滚。

TASK/EVENT 的历史 schedule blocks 只删除并重建，绝不 replay；search projection 重建；GOAL/PLAN 自动
进度按当前关系重算；NOTE plain text 由恢复后的正文生成。旧 InformationRepository undo/redo 委托同一
canonical restore，不删除或覆盖历史。

## 验证证据（2026-08-30 最终）

- 红灯：新 canonical history 测试最初因实现模块不存在而失败。
- 定向回归：recycle（M8-012）、backup（M8-010/M1/M8-009）、scheduling（M2）、A7 附件 GC（12/12）、
  A11 凭据失效（10/10）、canonical（8/8）与 change-recorder（1/1）共 9 文件 55 项全部通过。
- 根级 `pnpm verify` 退出码 0：format/lint/CSS audit/11 包 typecheck/全量 Vitest/contracts/build/
  Launcher 全绿；Vitest 72 文件通过、3 跳过，314 项通过、7 跳过。
- 审查补充：修复 A6 引入的 19 项 lint 错误；补齐 M3 `setPlanProgress` 路由遗漏的 USER context。
- 已覆盖 legacy 拒绝、baseline、TASK owned relations/冲突/GC/schedule、五个核心实体往返、七模块根
  E2E、restore 新版本、单调版本、来源、foreign key/integrity 和故障整体回滚。

A6 后端已判定 COMPLETE；A15 继续保持 OPEN；本决策没有迁移完整 AI ToolRegistry。

## 只读审计结论（2026-08-30 二次审计）

后端证据：12 类聚合均有 adapter、USER 生产写路径、带 `historyKind/restoreEligibility` 的历史读路径、
preview/conflict 门禁的原子 restore，以及 create→update→history→restore→state 自动化测试（见
`canonical-history-repository.test.ts` 与 M2/M6 集成测试）。

生产 UI 缺口（B 未达成，已于 2026-08-30 A6 Final UI Closure 关闭）：Data Management「对象版本历史」
弹窗只显示版本号、summary、来源与时间，不显示 before/after，也不标识 AUDIT_ONLY/UNVERIFIED、
BASELINE、CANONICAL；前端类型未消费 `historyKind/restoreEligibility`；UNVERIFIED 版本仍显示恢复按钮
（后端拒绝但 UI 静默失败）；RESTORE_CONFLICT 在 preview 阶段抛出后 UI 无错误呈现。恢复触发与恢复后
刷新（invalidate versions/change-sets）已成立。

## A6 Final UI Closure（2026-08-30）

- 前端消费后端已返回的 `historyKind/restoreEligibility`；历史弹窗按版本展示可信标识（旧版审计 / 可信
  基线 / 可信历史）与提示文案，UNVERIFIED 版本不再提供恢复与变更查看入口。
- 新增「查看变更」：调用 `:restore-preview` 展示字段级 before/after（当前值 / 目标历史版本值）。
- 恢复流程：获取/复用 preview → 展示影响摘要与变更 → 用户确认 → `confirmations/:id:execute`（沿用现有
  确认协议，未绕过）；成功后 invalidate `entity-versions` 与 `change-sets` 刷新。
- 错误可见：RESTORE_CONFLICT、ENTITY_VERSION_UNVERIFIED、CONFIRMATION_INVALID、VERSION_CONFLICT
  及其他错误在弹窗内以简体中文展示。
- 新增页面级 7 项 + 真实 hook 2 项测试，覆盖 10 个验收点；完整 `pnpm verify` exit 0（Vitest 74 文件
  323 项通过、7 跳过）。

A6 已判定 CLOSED；A15 继续保持 OPEN；本决策没有迁移完整 AI ToolRegistry。
