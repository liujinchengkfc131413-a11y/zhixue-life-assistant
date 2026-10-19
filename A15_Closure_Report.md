# A15 Closure Report

## 1. Verdict

`CLOSED`

A15 的生产 AI 写入已经统一接入可追踪的执行上下文、canonical change set、即时聊天卡片持久化与可审计撤销。既有 V2 视觉、美术、布局、主题、图片和媒体资源均未修改。

## 2. Root Cause Resolution

- 生产 `ChatRunner` 现在为每次 tool call 先持久化 `ai_tool_calls`，保存 session、run、provider config、model、用户消息、assistant 消息、provider call、tool name、参数、风险级别和 `userIntentReference`。
- 新增不可变 `AiToolExecutionContext`，由 ChatRunner 贯通 ToolRegistry、`AiWriteExecutor`、既有 domain/repository 与 A6 `OperationContext`/recorder；AI change set 使用 `source=AI`、`source_ref=ai-run:<runId>`，actor 精确指向 tool call 或已确认 action。
- 新增薄 `AiWriteExecutor`，只负责建立 AI OperationContext 与持有一次逻辑操作的 transaction/change set；业务校验和 mutation 仍由既有服务/Repository 完成。
- direct write tools 均返回稳定 `{ changeSetId, operations, result }`；CREATE/UPDATE 使用 A6 canonical recorder，记录真实持久态 before/after，而不是输入 patch。
- ToolCallingOrchestrator 改为顺序执行同轮 tool calls，消除 `Promise.all` 并发部分提交；明确的 `apply_change_plan` 仍使用一个原子 transaction/change set。
- change set 在 tool 写入成功时立即关联 `ai_tool_calls` 与 assistant message。Provider 后续失败时 run/message 可标记 FAILED，但已经提交的数据和 OperationCard 不丢失。
- canonical undo 扩展到 AI CREATE、UPDATE 和多对象 change set：先完整预校验当前版本/恢复冲突，再按 reverse sequence 在一个 transaction 内软删除或恢复 canonical before，并生成新的 USER undo change set。
- Inbox、AI memory、确认后的 `replace_long_term_goal` 已接入同一 AI canonical 写路径；确认前不发生 goal mutation，确认后沿用原始 tool execution context。
- task/event 的生产 AI direct write 不再把提交后的同步 reschedule 失败伪装成主 mutation 失败；调度派生状态沿用现有 domain event/后台处理语义。Undo 会清理不可重放的 schedule block、重算 plan/goal progress 并追加 deterministic rebuild event。
- migration 019 只新增可证明的新 tool/action attribution 数据；没有猜测或改写 legacy USER 历史。

## 3. Final Architecture

```text
User Message
  → ChatRunner（校验当前 userIntentReference，持久化 ai_tool_calls）
  → ToolCallingOrchestrator（同轮调用串行）
  → ToolRegistry（schema + risk）
  → AiWriteExecutor（一次逻辑操作的 transaction/change set）
  → 既有 Application / Domain Repository（业务与 expectedVersion 校验）
  → A6 OperationContext + canonical recorder
  → change_sets / change_operations / entity_versions / domain_events
  → tool call 与 assistant OperationCard 即时持久关联
```

高风险目标替换在 ToolRegistry 创建确认 action；用户确认后才进入 `AiWriteExecutor`，并以 `ai-action:<actionId>` 作为 actor，同时保留原始 run/tool/message attribution。

## 4. Write Path Matrix

| 生产 write tool | Context / AI source | Transaction | Canonical before/after | changeSetId | Undo | UI card | 状态 |
|---|---|---|---|---|---|---|---|
| `create_task` / `create_goal` / `create_plan` / `create_event` / `create_note` | 完整 | 每调用独立 | CREATE：null / persisted snapshot | 有 | CREATE soft-delete | 即时 | CLOSED |
| `update_task` / `complete_task` / `update_goal` / `update_plan` / `update_event` / `update_note` | 完整 | 每调用独立 | UPDATE：真实 before / persisted after | 有 | canonical restore | 即时 | CLOSED |
| `apply_change_plan` | 完整 | 整个 plan 单事务 | 每对象 canonical | 一个顶层 ID | reverse、all-or-nothing | 即时 | CLOSED |
| `process_inbox_item` | 完整 | Inbox + 产物单事务 | Inbox UPDATE + 产物 CREATE | 一个顶层 ID | composite undo | 即时 | CLOSED |
| `remember_user_preference` | 完整 | 每调用独立 | AI_MEMORY CREATE canonical | 有 | soft-delete且查询不可见 | 即时 | CLOSED |
| `replace_long_term_goal` | 原始 context 持久到 action | 确认后单事务 | GOAL UPDATE canonical | 确认后产生 | canonical restore | 确认执行后补挂原消息 | CLOSED |

所有 UPDATE 继续由既有 Repository 检查 `entityId` 与 `expectedVersion`；版本冲突不会覆盖最新状态，也不会留下半成功 change set。

## 5. Atomicity Semantics

- 独立 write：按 provider 顺序串行执行；每个 tool call 各自 transaction、change set 和 OperationCard，一个失败不把已成功的前序操作伪装成未发生。
- 多对象逻辑 plan：`apply_change_plan` 在一个 transaction 内执行，所有对象共享一个 change set；任一 mutation 失败时整个 plan 回滚。
- 撤销：在写入前预校验 change set、对象当前版本和所有 restore target；之后 reverse sequence 单事务执行，避免部分恢复。

## 6. Provider Failure Semantics

Tool 成功后立即完成 `ai_tool_calls`、保存 `change_set_id`，并把 `{type:"change_set", changeSetId}` 追加到 assistant message。若 Provider 第二轮失败：

- 业务数据与 APPLIED change set 保留；
- run 和 assistant message 标记 FAILED 并保存真实 error code；
- assistant message 的 OperationCard 部分保留，API/UI 仍可查询本次成功写入；
- 最终状态表达为“写入已成功、回答生成失败”，不会暗示整次操作回滚。

## 7. Undo Verification

- CREATE：AI memory 生产链路创建后撤销，实体软删除且 active memory 查询不再返回。
- UPDATE：AI `update_task` 的 canonical before/after 经断言，USER undo change set 恢复原标题并推进实体版本。
- Multi-object：既有 M7 `apply_change_plan` 撤销回归继续通过；canonical undo 反向、单事务执行。
- Derived state：A6 canonical restore 测试覆盖 TASK restore 不重放旧 schedule block；实现同时重算 plan/goal progress，并发出 schedule rebuild domain event。既有 M8-014 覆盖派生 reschedule 失败不反向伪装主 mutation 失败。

## 8. Special Paths

- Inbox：生产 ChatRunner 测试证明生成 TASK 与 INBOX_ITEM UPDATE 同属一个 AI change set，且 `processedChangeSetId` 指向该顶层集合。
- Memory：保存完整 session/run/tool attribution、canonical CREATE 与 undo 语义。
- Confirmed high-risk：确认前目标不变；确认后目标 mutation 通过 A15 executor，生成 HIGH_WRITE AI change set，并将卡片挂回原 assistant message。

## 9. Tests

新增 `apps/server/test/a15.integration.test.ts`，覆盖：

1. direct `create_task` 全 attribution、canonical CREATE，以及 Provider 第二轮失败后的数据/卡片留存；
2. `update_task` canonical before/after 与 USER undo；
3. AI memory attribution 与 CREATE undo；
4. Inbox composite change set；
5. confirmed long-term goal replacement attribution 与卡片。

新增 ai-adapters 单测证明多个独立 tool call 最大并发数为 1，且严格保持 provider 顺序。既有 M7、A6 canonical history、M8 reliability/backup/crash/derived-effect 测试共同覆盖原子回滚、多对象撤销、版本与派生状态语义。

## 10. Regression

- `pnpm vitest run apps/server/test/a15.integration.test.ts`：5/5 通过。
- `pnpm vitest run apps/server/test/a15.integration.test.ts apps/server/test/m7.integration.test.ts`：28/28 通过（扩展特殊路径前的阶段性结果）。
- `pnpm vitest run apps/server/test/m1.integration.test.ts apps/server/test/m8-009-crash-recovery.drill.test.ts apps/server/test/m8-010-reliability.drill.test.ts apps/server/test/m8-011-log-diagnostics-privacy.test.ts apps/server/test/m8-013-release-core.test.ts`：schema 19 兼容修正后 28/29；唯一失败为测试专用、刻意只到 v18 的 crash migration fixture 被误改期望，恢复其 v18 局部期望后纳入最终 verify 复核。
- `pnpm verify`：exit 0；format、lint、V2 CSS audit、11/11 packages typecheck、contracts check、11/11 packages build 与 Launcher Release build 全部通过。
- 全量 Vitest：78 个测试文件、356 项通过；3 个文件共 7 项按环境门控设计跳过（OpenAI 手工 smoke 1、DeepSeek 真实 smoke 5、performance benchmark 1）。
- Launcher Release：0 warnings、0 errors。Web production build 通过，仅保留既有的 Vite 大 chunk 提示与 Turbo outputs 提示。

## 11. Remaining Risks

- 外部 OpenAI/DeepSeek smoke 继续受显式环境凭据门控；本轮使用真实生产 ChatRunner/ToolRegistry/SQLite 路径的确定性 provider double 验证，不读取、不输出凭据。
- 本轮没有新增或调整 OperationCard 视觉；复用现有消息 `content_json` 合约和 UI 渲染器。
- legacy USER 记录保持原样，不做来源推断回填。
