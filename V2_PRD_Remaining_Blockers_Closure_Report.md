# V2 PRD Remaining Blockers Closure Report

> 报告日期：2026-09-06\
> 历史审计基线 HEAD：`f38f7eb32aa104934222955d44052cab27258654`；Blocker 收口提交：`f83a9f89af07870e1c5363b13b3d0567bfa3d868`；RC2 最终提交由 `v2.0.0-rc.2^{commit}` 定位。\
> 功能基线：`产品需求与系统架构设计书.md`；实施边界：`V2_PRD_剩余Blocker最小修复实施方案_Codex.md`

## A1 - 七个专属模块完整业务闭环

Status: CLOSED

- Existing capability reused: 七模块既有 repository、M4/M5 API、Drawer、统一历史与回收站。
- Minimal changes made: 补齐饮食、健身、娱乐维护、筛选与服务端统计；未重做视觉。
- Acceptance evidence: 定向 9 文件 20/20；独立 Chrome 生命周期、筛选、趋势与七模块回归。
- Visual impact: NONE；Migration: NONE；Regression: 自媒体、开发、学习、购物通过。

## A2 - Goal/Plan/Task/Event 生命周期

Status: CLOSED

- Existing capability reused: ActionRepository、版本保护、canonical history、统一软删除/恢复。
- Minimal changes made: 四核心编辑、状态、关系摘要、删除与恢复入口闭环。
- Acceptance evidence: 集成/组件测试及独立 Chrome Goal→Plan→Task/Event 全链。
- Visual impact: NONE；Migration: NONE；Regression: A5/A6/A7。

## A3 - 子任务、依赖、里程碑、指标和标签

Status: CLOSED

- Existing capability reused: `parent_task_id`、task dependencies、通用 milestones、goal metrics、tags。
- Minimal changes made: 完整生产 API/UI wiring 与版本/历史保护。
- Acceptance evidence: 自动化与独立 Chrome 覆盖一层子任务、阻塞/解除/环拒绝、指标、里程碑、标签。
- Visual impact: NONE；Migration: NONE；Regression: A2/A5/A8。

## A4 - 重复规则五行为

Status: CLOSED

- Existing capability reused: recurrence rule/exception/instance 模型。
- Minimal changes made: 统一五行为 service/API/selector，保护不可变系列模板与重启幂等。
- Acceptance evidence: parser/service/M2/组件测试及真实 Task/Event Playwright 五行为。
- Visual impact: NONE；Migration: NONE；Regression: A2/A6。

## A8 - 全局搜索闭环

Status: CLOSED

- Existing capability reused: search projection/FTS 与现有详情 Drawer/Modal。
- Minimal changes made: 完整来源、五类筛选、附件正文隔离、统一 detail resolver。
- Acceptance evidence: database/API/component 矩阵和独立 Chrome 跨类型详情直达。
- Visual impact: NONE；Migration: NONE；Regression: A1/A2/A3/A17。

## A9 - 提醒闭环

Status: CLOSED

- Existing capability reused: Reminder/Notification service 与统一详情 resolver。
- Minimal changes made: Event 多提醒 UI、目标时间动态重算、已读/snooze 请求修复。
- Acceptance evidence: 4 文件 10/10；独立 Chrome Task/Event 各双提醒全链。
- Visual impact: NONE；Migration: NONE；Regression: A2/A8。

## A10 - 设置和首次启动

Status: CLOSED

- Existing capability reused: Category、Routine override、Setup/runtime、外部 credential store。
- Minimal changes made: 八模板、日期覆盖 CRUD、七步首次启动与可跳过 AI。
- Acceptance evidence: 自动化与独立 Chrome 全新安装流程。
- Visual impact: NONE；Migration: NONE；Regression: A11。

## A12 - 全局表单草稿

Status: CLOSED

- Existing capability reused: DraftRepository/API。
- Minimal changes made: 统一 Form Draft Adapter 接入四核心与高输入成本表单。
- Acceptance evidence: 组件/集成测试；独立 Chrome 四核心刷新恢复及保存清理。
- Visual impact: NONE；Migration: NONE；Regression: A2。

## A13 - AI 结构化读取

Status: CLOSED

- Existing capability reused: 各领域 read service。
- Minimal changes made: 显式 allowlist DTO registry；附件仅安全元数据。
- Acceptance evidence: Tool Runtime fixtures 覆盖四核心、七模块、提醒/排程、Note、Attachment。
- Visual impact: NONE；Migration: NONE；Regression: 附件正文/存储字段隔离。

## A14 - PRD 第一版九项 AI 工具

Status: CLOSED

- Existing capability reused: 领域服务、Reminder/Schedule、A15 executor 与 A16 action。
- Minimal changes made: 九项等价工具、严格参数/意图/风险路由。
- Acceptance evidence: 正向/校验/意图/风险/A15 审计及四类高风险 DB/浏览器矩阵。
- Visual impact: NONE；Migration: 020（扩展既有 action）；Regression: A15/A16。

## A16 - 高风险 AI 操作确认

Status: CLOSED

- Existing capability reused: confirmations、AI action 与既有 Operation Card。
- Minimal changes made: expiry、幂等 confirm、失败结果、SSE/action part 全链。
- Acceptance evidence: confirm/reject/expire/duplicate/failure 自动化及独立 Chrome。
- Visual impact: NONE；Migration: 020；Regression: A14/A15/A18。

## A17 - AI 会话搜索与历史管理

Status: CLOSED

- Existing capability reused: ChatRepository、A8 搜索索引。
- Minimal changes made: 标题/正文检索、版本保护 rename、archive/restore UI。
- Acceptance evidence: repository/M7/contract 测试与独立 Chrome 搜索继续会话。
- Visual impact: NONE；Migration: NONE；Regression: A8。

## A18 - 真正流式回答

Status: CLOSED

- Existing capability reused: Provider stream、SSE retention、Last-Event-ID、cancel。
- Minimal changes made: text/tool-call delta 组装、工具结果回传与多轮续流。
- Acceptance evidence: 55 项自动化；独立 Chrome + 本地真实 HTTP/SSE 联合验收。
- Visual impact: NONE；Migration: NONE；Regression: A14/A16。

## A19 - 快速记录跨模块真实写入

Status: CLOSED

- Existing capability reused: Inbox、Typed ChangePlan、A15 single change set executor。
- Minimal changes made: Task + Shopping Item + Goal 三对象写入、整批预校验/回滚、无 AI 手动保留。
- Acceptance evidence: 相关 Vitest 45/45；独立 Chrome A19/A20 2/2。
- Visual impact: NONE；Migration: 021（扩展既有 inbox result type）；Regression: A14/A15。

## A20 - 主动建议覆盖

Status: CLOSED

- Existing capability reused: `AI_SUGGESTION` 通知与现有卡片。
- Minimal changes made: 八类确定性 detector、真实 evidence、no-auto-write 边界。
- Acceptance evidence: M7 fixture 28/28；独立 Chrome 建议卡与业务对象计数不变。
- Visual impact: NONE；Migration: NONE；Regression: A13/A16。

## A21 - 最新 Chrome 和 Edge 完整验收

Status: CLOSED

- Existing capability reused: 参数化 Playwright 配置和隔离分套编排。
- Minimal changes made: 安装 Edge Stable 151；同步 schema 021 恢复上限与可靠性断言；格式化 4 个既有 A21 文件。
- Acceptance evidence: Chrome 152.0.7977.82 73/73；Edge 151.0.4129.107 73/73；`pnpm verify` 全绿。详见 `artifacts/a21/a21-browser-acceptance.md`。
- Visual impact: NONE；Migration: 本项未新增 migration；Regression: A1–A20、A5/A6/A7/A11/A15 smoke 与全仓验证。

## RC Readiness

Remaining PRD blockers: 0

Chrome:
- version: 152.0.7977.82
- suite: `LIFE_ASSISTANT_BROWSER=chrome node scripts/run-isolated-e2e.mjs`
- result: 73 passed / 0 failed / 0 skipped

Edge:
- version: 152.0.4191.66（RC2 最终复验；原 A21 关闭证据为 151.0.4129.107）
- suite: `LIFE_ASSISTANT_BROWSER=msedge node scripts/run-isolated-e2e.mjs`
- result: 73 passed / 0 failed / 0 skipped

verify:
- command: `pnpm verify`
- result: passed；Vitest 450 passed / 7 skipped；contracts、build、Launcher Release build 均通过

Recommendation:
- READY FOR RC

RC2 发布门禁详见 `docs/operations/V2_RC2_发布就绪记录.md`：RC2-03 首次启动末步提前提交已修复，Chrome 152 与 Edge 152 同套各 73/73，最终 `pnpm verify` 为 450 passed / 7 gated skipped。
