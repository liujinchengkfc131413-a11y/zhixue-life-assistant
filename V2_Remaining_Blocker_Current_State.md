# V2 Remaining Blocker Current State

> 审计日期：2026-09-06\
> 历史 Pass 0 基线：HEAD `f38f7eb`；当前 RC2 状态与最终提交定位见 `docs/operations/V2_RC2_发布就绪记录.md`。\
> 依据：`V2_PRD_剩余Blocker最小修复实施方案_Codex.md`、`V2_PRD_Compliance_Final_Audit.md`\
> 性质：Pass 0 只读现状映射；本文不把“存在底层能力”误判为生产闭环，也不把未验证项写成已关闭。

## 1. 工作树边界

- 当前工作树已有大量 A15 及用户文档/本地预览数据库改动；后续实施必须在这些改动之上增量工作，不覆盖、不清理。
- A5、A6、A7、A11、A15 已有 closure 记录，本轮只做依赖回归。
- A1–A20 均已完成实现与既定验收；A21 于 2026-09-06 以 Chrome 152 与 Edge 151 同套 73/73 完成最终门禁。当前剩余 blocker：0。
- Pass 0 未发现必须先做 schema migration 的 blocker。后续只有在既有模型无法表达通用计划里程碑、目标指标、标签关系或重复系列不变量时，才允许提出最小 migration；其余优先 service/route/contract/UI/test。

## 2. 当前 blocker 与已关闭项映射

| Blocker | 已有后端能力 | 已有 API | 已有 UI | 已有测试 | 真正缺口 | 是否需要 migration | 当前判定 |
|---|---|---|---|---|---|---|---|
| A1 七模块业务闭环 | 七模块均有结构化仓储；饮食、健身、娱乐完整维护复用通用软删除、历史与服务端聚合 | M4/M5 覆盖七模块；饮食日期/餐次、健身日期、娱乐类型/清单/状态筛选已合同化 | 七模块入口可用；三个重点域在既有 Drawer 内完成详情编辑删除，趋势复用日期序列 | M4/M5 与七模块表单 9 文件 20/20；三个独立 Chrome 录制覆盖生命周期、筛选趋势及七模块加载 | 无 | 否 | CLOSED |
| A2 核心对象生命周期 | `ActionRepository` 有 Goal/Plan/Task/Event create/update/softDelete；Task 有四种状态；四核心对象删除记录 canonical lifecycle 并进入 30 天回收站，Task 删除释放排程块；Event update 执行时间校验、冲突检测、显式允许重叠与不可移动语义 | M2 有 Goal/Plan patch、Task detail/update/start/complete/cancel/reopen、Event update/conflict check，以及四核心 DELETE；M6 回收站统一恢复 | Planning 各视图可进入 Plan/Goal 编辑并显示 Goal→Plan→Task 关系；Goal 详情列出关联计划/任务，Plan 详情显示所属目标/任务；Today Task 详情显示所属目标、计划、父任务和一层子任务；四类编辑面板可移入回收站，数据管理页负责恢复 | M2 四核心删除/恢复 lifecycle integration、Goal/Plan/Task/Event 编辑删除及关联摘要组件测试；独立 Chrome 验证 Goal→Plan→Task/Event 编辑、状态、删除、恢复及恢复后关系保持 | 无 | 否 | CLOSED |
| A3 子任务/依赖/里程碑/指标/标签 | 一层子任务与依赖生命周期已闭环；四核心对象标签关系带 optimistic version/canonical history；通用 `milestones(plan_id)` 与 `milestone_links` 已接 Plan 聚合历史；Goal 指标/进度记录复用既有 `goal_metrics` / `goal_progress_entries` 并纳入 Goal 聚合版本与恢复 | M2 已有子任务、依赖、标签、通用 Plan milestone API，并新增 Goal metric GET/POST/PATCH/DELETE 与 progress-entry POST；所有聚合写入强制 If-Match/expectedVersion | 四核心详情可维护标签；Task 维护子任务与依赖；Plan 维护通用里程碑；Goal 详情可创建、编辑、删除量化指标并录入当前值，显示自动贡献与手动覆盖状态 | M1/M2、canonical history 与组件测试覆盖各切片；独立 Chrome 验证子任务编辑/完成/删除/恢复、依赖阻塞/解除/环拒绝、里程碑任务关联、Goal 4/10 自动进度 40%、标签增删；A8 标签筛选已有真实浏览器证据 | 无 | 否；复用既有通用表 | CLOSED |
| A4 重复规则五行为 | `RecurrenceService` 已完成五种统一修改、乐观版本、不可变系列模板、目标反查、实例关系、历史保护、未来撤销重建、结束重复和 `until_at` 边界 | M2 已提供 by-target、occurrences 与统一 modify API；所有修改强制 If-Match/expectedVersion | Task/Event 生产详情共用统一五行为选择器，单次使用当前表单，系列修改可编辑 RRULE，跳过/结束必须确认 | parser/service/M2 自动化覆盖五行为、系列关系、过去/未来实例、陈旧版本、模板不污染和重启幂等；组件测试覆盖五个分支；Playwright 用真实 Task/Event 和 API 逐一验证全部五行为及系列状态 | 无 | 否 | CLOSED |
| A8 全局搜索 | `InformationRepository` 的 FTS/search projection 已覆盖四核心、Note、七专属模块主对象、Inbox、Attachment metadata 与 Chat session/message plain text；Note 返回所属对象身份，tag/attachment owner metadata 进入 keywords，附件正文不进入索引 | `/api/v1/search` 支持 `q + entityType/module/categoryId/status/tagId/from/to`；Event by-id 支持跨日期直达；WorkoutPlan 补最小 PATCH；OpenAPI 已同步 | 搜索弹窗提供全部筛选；所有主类型经统一 resolver 生成稳定目标；Note 通过所属 Work 对象打开 composer，Recipe/WorkoutPlan 在既有 Life Drawer 直达编辑器，其他目标页消费 URL 身份选中既有详情 | 数据库/M6/组件覆盖召回、筛选、owner 和正文隔离；resolver 覆盖完整主类型矩阵；M2/M5 覆盖 Event by-id 与 WorkoutPlan 更新；隔离 Playwright 连续打开 Task/Event/DevProject/Note/Recipe/WorkoutPlan 且 0 console/HTTP 错误 | 无 | 否 | CLOSED |
| A9 提醒闭环 | Reminder/Notification repository、delivery、read/snooze 与统一详情 resolver | M8 reminder CRUD、notification 动作及 Task/Event 目标类型 | Task/Event 多提醒编辑；提醒中心未读、已读、稍后提醒与具体详情直达 | delivery、M8 integration、Event 编辑器、reminders page 共 4 文件 10/10；独立 Chrome 覆盖投递与交互 | 无 | 否 | CLOSED |
| A10 设置与首次启动 | Category 有稳定 `module_type`；Routine repository 复用既有 `template_id + segments_json` 日期 override 模型；setup/runtime 可原子建立目录与基础数据，并复用外部凭据存储 | M1 category/setup API；M2 routine template 与日期 override GET/PUT/DELETE | Settings 分类创建可选八模板；Routine 可完整维护指定日期覆盖；Setup 已为数据目录、三类作息、七模块、备份、可选 AI、快速记录、完成进入 Today 七步 | 分类、override、setup 组件测试；M1 onboarding/八模板与 M2 override integration；独立 Chrome 完成真实全新安装、分类和日期覆盖验收 | 无 | 否 | CLOSED |
| A12 全局表单草稿 | `DraftRepository` 已有 get/save/remove 和过期语义 | M6 已有 `GET/PUT/DELETE /api/v1/drafts/:draftKey` | Note composer、Task/Goal/Plan/Event 新建与编辑，自媒体内容、开发项目、学习资源、购物清单 create/edit，以及饮食计划/记录、健身训练/计划、娱乐条目 create 已接通用 Adapter | M6 draft integration、Note 局部测试、Form Draft hook、四核心新建与编辑、工作三模块、购物清单及饮食/健身/娱乐组件测试；独立 Chrome 验证四核心刷新恢复与保存清理 | 无 | 否 | CLOSED |
| A13 AI 结构化读取 | `InformationRepository.getAiDomainRecord` 以显式 allowlist 将类型路由到真实领域表，覆盖四核心、七模块主/子对象、Reminder/Schedule、Note；附件使用独立安全字段投影 | `get_domain_record` 可选 `recordType` 并校验其与真实实体类型一致；省略时由 `entity_index` 解析 | Assistant 继续通过既有 Tool Runtime 发起按需读取 | ToolRegistry、InformationRepository、M7 integration 覆盖真实结构化字段；七模块 fixture 逐项读取；附件测试证明 storage key/safe name/正文均不返回 | 无 | 否 | CLOSED |
| A14 九项 AI 工具 | 九项均已注册；领域/提醒/调度/undo 复用既有服务，四项破坏性工具复用统一 A16 action | 低风险五项直接走 A15；`delete_record`、`bulk_update_records`、`clear_ai_memory`、`empty_recycle_bin` 返回持久化待确认 action | Assistant 通过统一 Action Card 承载高风险工具 | Tool、A15/M7 integration 覆盖九项定义、严格校验、意图、风险、proposal no-write、四项真实 DB confirm/reject/failure/atomic audit；独立 Chrome 验证真实聊天提案 | 无 | 是，migration 020 扩展既有 ai_actions | CLOSED |
| A16 高风险确认 | action 支持 expiry、CONFIRMED/EXECUTING/EXECUTED/FAILED、结果/错误持久化和重复确认幂等；确认执行复用 A15 | M7 get/confirm/cancel 响应含 expiry/result/error；ChatRunner 发出 awaiting event | Assistant message 持久化 `ai_action` part，既有 Operation Card 显示预览、Confirm/Reject 与执行状态 | Repository/M7/A15/组件覆盖 expire、success/failure、duplicate/cancel/no-write；独立 Chrome 验证 reject、execute fail、confirm 和重复 confirm | 无 | 是，migration 020 | CLOSED |
| A17 会话搜索与管理 | `ChatRepository.listSessions(q)` 通过 session title 或 message plain text 检索；session/messages 持久化、版本保护 rename 与 archive 存在 | `GET /ai/chats?q=`、PATCH rename、create、messages、archive/unarchive | Assistant 有独立历史搜索、包含归档、打开继续、重命名及归档/恢复 | Chat repository、M7 integration、合同检查与独立 Chrome；A8 API 实测正文召回 | 无 | 否 | CLOSED |
| A18 真正流式 | Provider adapter 的 `streamTools` 支持 text/tool-call delta，并从 completed event 保留下一轮 response items；ChatRunner 完成最多八轮 tool loop；SSE 有 retention、Last-Event-ID 和 cancel | M7 run events/cancel | Assistant 实时消费 SSE，可取消生成 | adapter、ChatRunner、M7 共 55 项；独立 Chrome 通过真实本地 OpenAI-compatible SSE 验证普通多 delta、tool-call 后续流、取消与重连 | 无 | 否 | CLOSED |
| A19 跨模块 Quick Capture | Typed Result 与 A15 executor 支持 Task、Shopping Item、Goal 单 change set 原子写入与整批回滚 | M6/M7 与 Tool Runtime 已接真实多域写入 | Quick Capture/Inbox 支持 AI 与无 AI 手动处理 | 相关 Vitest 45/45；独立 Chrome A19/A20 2/2 | 无 | 是，migration 021 扩展既有结果类型 | CLOSED |
| A20 主动建议 | 八类确定性 detector、真实 evidence 与 no-auto-write 边界已落地 | M7 suggestions analyze | 既有提醒卡展示类型、证据与明确执行边界 | M7 fixture 28/28；独立 Chrome A19/A20 2/2 | 无 | 否 | CLOSED |
| A21 Chrome + Edge | 全部 Playwright 配置支持 Chrome/Edge 同套隔离编排 | 不适用 | 不适用 | Chrome 152 与 Edge 151 各 73/73；最终 `pnpm verify` 全绿 | 无 | 否 | CLOSED / 最终门禁通过 |

## 3. 历史 Pass 0 建议的实施切片（已执行，不是当前待办）

### Slice 1：A12 通用草稿基础与四个核心表单

选择理由：Draft repository/API 已完整，不依赖 migration，也不依赖 A1–A4 的领域重构；可以形成一个独立、可测试、视觉影响为零的闭环。

预期修改：

- 新增共享 Draft API/adapter/hook，统一 key、debounce、恢复、保存后清除、明确丢弃清除。
- 接入 Task、Goal、Plan、Event 现有表单，不新建视觉组件。
- 增加 hook/component 单测；再补一条刷新恢复 E2E。

### Slice 2：A8/A9 共用 Detail Resolver

先建立 `entityType + entityId -> route/detail action` 的单一 resolver，再分别接搜索结果和提醒目标，避免两套跳转逻辑。

### Slice 3：A1 按聚合根逐类收口

从已有 edit/delete 基础最好的 Diet Recipe/Meal Plan 回归开始，再按 Meals/Hydration/Preferences、Fitness、Entertainment 逐组补齐；每组独立通过 repository + route + UI + recycle 测试后再进入下一组。

## 4. 历史 Pass 0 结论（已被最新 CLOSED 状态取代）

- 没有把审计快照中的“缺失”直接等同于重写需求；已识别 A1、A10、A12、A17、A20 等顺带具备的局部能力。
- 当前没有剩余 blocker 可在不补证据/不补生产流程的情况下直接关闭。
- 最安全的下一实施点是 A12；A1 虽是 M1 首项，但仍应拆成可独立验收的聚合根切片，避免在当前额度内启动无法收口的大范围 CRUD 改造。

## 4.5 A10/A12 最终浏览器验收关闭（2026-09-04）

- 使用固定 CDP 9333、独立 `.codex/tmp/browser-harness-a10-a12-9333` user-data-dir 和隔离 43176 数据实例完成真实 Chrome 验收；未复用日常 Chrome Profile，未修改默认搜索引擎、浏览器策略或系统代理。
- A10：全新数据目录走完数据目录、三类作息、七模块、自动备份、可选 AI、快速记录、完成七步；跳过 AI 后正常进入 Today；设置页验证专属分类模板创建，以及指定日期覆盖新增、切换自定义时段、保存和删除。
- A12：Goal、Plan、Task、Event 分别填写未保存标题，刷新页面并重新打开表单后恢复；正式保存后 `GOAL:create:new`、`PLAN:create:new`、`TASK:create:new`、`EVENT:create:new` 四个 draft key 均返回空。
- 录制：`C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a10-a12-final-20260904`（39 帧）。A10=CLOSED，A12=CLOSED；无代码、CSS、布局、主题、资源或 migration 修改。

## 4.6 A17 会话搜索与历史管理关闭（2026-09-04）

- `ChatRepository.listSessions(q)` 使用标题匹配或消息 `plain_text` EXISTS 查询；会话 rename 强制 expectedVersion/If-Match，陈旧更新返回 409。M7 新增 PATCH 会话合同并同步 OpenAPI。
- Assistant 在既有会话栏增加独立关键词搜索与“包含已归档”，当前会话区复用既有按钮补重命名、归档和恢复；不新增页面或视觉体系。
- 自动化：ChatRepository + M7 integration 2 文件 31/31；database/contracts/server/web typecheck；contracts generate/check；全仓 build 通过。
- 独立 Chrome 验证消息正文唯一关键词召回、打开原会话、重命名、归档隐藏、包含归档后找回并恢复；A8 `/search` 同一关键词返回更新后的 Chat Session。录制：`C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a17-chat-history-20260904`（11 帧）。A17=CLOSED。

## 4.7 A18 真正流式 tool-call 实现更新（2026-09-05）

- OpenAI Responses 流 adapter 在 completed event 中保留 provider response items，供本地工具结果回传后的下一轮请求使用；缺少 items 时 ChatRunner 仅以已验证的完整 function call 构造等价续轮输入。
- ChatRunner 对支持 `streamTools` 的 Provider 始终走流式路径，不再以 `definitions.length` 分流；逐个持久化/发送 text delta，组装完整 tool call，串行执行本地工具，将 tool output 与 provider items 回传并继续下一轮流，最多八轮。
- 保持既有取消、空输出失败、工具审计、change set 与 awaiting-confirmation 事件语义；非流式 Provider 继续走原有 orchestrator fallback。
- 自动化：AI adapter、ChatRunner、M7 integration 3 文件 55/55；覆盖存在工具定义但不调用、一次 tool-call 后多 delta 续流、provider items/tool output 回传、空输出、取消及 SSE replay/resync。A18 保持 OPEN，待真实 Provider/浏览器联合验收。

## 4.8 A18 联合验收关闭（2026-09-05）

- 以隔离 43177 应用实例连接本地 OpenAI-compatible HTTP/SSE 端点，生产 `OpenAiProvider` 经真实网络解析流事件；独立 Chrome 152 使用固定 CDP 9333 和 `.codex/tmp/browser-harness-a18-9333` profile 操作 Assistant。
- 普通回答持久化三个独立 delta；tool-call 场景依次产生首轮 delta、`get_today_schedule` 成功工具调用、第二轮两个 delta 和唯一 completed，最终正文为完整拼接结果。
- 浏览器在长流生成中显示取消入口；取消后 run=`CANCELLED`。携带 Last-Event-ID 重连只返回该 ID 之后的 delta 与一个 cancelled 终态，没有重复已确认事件或 completed。
- 录制：`C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a18-stream-tool-browser-20260905`（43 帧）。Chrome 152.0.7977.82；未复用日常 Profile，未修改默认搜索引擎、浏览器策略或系统代理。A18=CLOSED。

## 4.9 A14/A16 联合验收关闭（2026-09-05）

- 真实聊天经 Provider stream 提出 `clear_ai_memory`，工具调用记录成功但确认前不写业务数据；Assistant message 持久化 `ai_action`，独立 Chrome 显示既有 Action Card、风险预览、确认和拒绝。
- 联合验收发现并修复：工具后的下一轮 text delta 曾只保留 change-set part、覆盖 `ai_action` part。`appendRunDelta` 现在同时保留两类结构化 part；新增 ChatRepository 回归测试。
- Chrome 验证 Reject→CANCELLED/零写入；零对象确认触发 FAILED/EMPTY_CHANGE_SET；有一条记忆时 Confirm→EXECUTED/cleared=1；随后两次重复 confirm 返回同一 executedAt/result，不重复执行。
- 自动化回归：ChatRepository、ChatRunner、A15、M7 共 4 文件 43/43；Database/Server build 通过。既有九工具与四类高风险 DB 矩阵继续作为 A14/A16 后端证据。
- 录制：`C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a14-a16-action-browser-20260905`、`a14-a16-action-browser-confirm-20260905`。A14=CLOSED，A16=CLOSED。

## 4.4 A13 结构化领域读取关闭（2026-09-04）

- `get_domain_record` 不再依赖 `search_documents` 的 title/snippet，而由显式 allowlist 路由到真实领域表；调用方可传 `recordType`，其与实体真实类型不一致时安全返回未找到。
- 覆盖 Goal/Plan/Task/Event、Self Media/Development/Learning/Shopping/Diet/Fitness/Entertainment 的主对象及现有子类型、Reminder、Schedule Block、Note；未向 AI 暴露 provider、credential、内部日志或版本快照。
- Attachment 使用独立字段投影，仅返回 filename/MIME/extension/size/description/status/ownership；不返回 `safe_name`、`sha256`、`storage_key`，不读取附件正文或图像。
- 验证：3 个测试文件 31/31；七模块 demo fixture 均读取到非摘要结构化字段，Reminder/Schedule/Note/Attachment 路径与类型错配拒绝通过；Database/Server typecheck 通过。A13=CLOSED。

## 4.1 A10 Slice 1 实施更新（2026-09-01）

- 设置页创建分类可在自媒体、开发、学习、购物、饮食、健身、娱乐、通用八种中文模板间选择，并提交稳定 `moduleType` 码。
- 重命名继续只提交名称与版本，不提供修改 `moduleType` 的入口；服务端集成测试证明专属模板重命名后类型不变。
- 自动化验证：前端组件 2/2、M1 integration 4/4 通过；Web/Server typecheck、相关 ESLint 与 Prettier 通过。
- A10 仍为 OPEN：10.2 日期作息覆盖与 10.3 首次启动尚未关闭；真实浏览器 E2E 按用户要求后续单独处理。

## 4.2 A10 Slice 2 实施更新（2026-09-01）

- 复用数据库既有 `date_routine_overrides.template_id / segments_json`，补齐日期覆盖读取、保存、删除 repository 与 GET/PUT/DELETE API，不新增 migration。
- 设置页可选日期，查看并新增/编辑/删除覆盖；覆盖既可引用现有模板，也可直接维护当天自定义时段。删除后重新使用工作日/周末/节假日默认解析。
- 自动化验证：Routine override 组件 2/2、M2 integration 6/6，和 10.1 合并回归共 4 文件 14/14；contracts/database/server/web typecheck、契约生成/检查、相关 ESLint/Prettier、Web production build 通过。
- A10 仍为 OPEN：仅 10.3 首次启动尚未关闭；真实浏览器 E2E 按用户要求后续单独处理。

## 4.3 A10 Slice 3 实施更新（2026-09-01）

- 首次启动扩为七步：不可跳过的数据目录、工作日/周末/节假日作息、七个专属模块、自动备份、可选 AI provider/model/API key、快速记录默认行为、完成进入 Today。
- 初始化请求可携带三类作息与可选 AI；服务端在打开新数据目录后更新默认模板，复用现有外部凭据存储并设默认 provider。跳过 AI 时不创建 provider，本地能力照常初始化。
- 作息在初始化前校验 15 分钟粒度、零长度、重叠及三种模板唯一性；OpenAI 兼容服务必须提供 Base URL。
- 自动化验证：Setup UI 2/2、M1 integration 5/5；A10 三切片合并回归 5 文件 17/17；contracts/database/server/web typecheck、契约生成/检查、相关 ESLint/Prettier、Web production build 通过。
- A10 继续标记 OPEN：实现与自动化已完整，真实浏览器新安装路径与跳过 AI 后 Today 核心交互按用户要求后续单独验收，通过后再改 CLOSED。

## 5. A12 Slice 1 实施更新（2026-09-01）

- 新增共享 `useFormDraft`：稳定 `formType:mode:entityId/new` key、读取/解析、单次恢复、600ms debounce、立即保存、正式保存/明确丢弃清理。
- 接入现有 Goal、Plan、Task、Event 新建表单；普通关闭会立即保留草稿，显式“丢弃草稿”和正式保存会清理。
- 自动化验证：4 个测试文件 10/10 通过，逐个覆盖 Goal/Plan/Task/Event 的恢复与正式保存清理；Web typecheck 与相关 ESLint 通过。
- A12 保持 OPEN：当前生产 UI 尚无 A2 所要求的四类完整编辑表单，因此 edit key 只完成协议与单测、尚无生产入口；其他高输入成本领域表单和真实刷新/异常退出 E2E 仍待补。
- 浏览器验证未执行：当前 Browser 插件缺少其强制要求的 `browser/scripts/browser-client.mjs`，没有擅自切换到用户日常 Chrome 或未授权的 Playwright fallback。

## 5.1 A12 Slice 2 实施更新（2026-09-01）

- 自媒体内容创建与编辑表单复用 `useFormDraft`；创建使用 `SELF_MEDIA_CONTENT:create:new`，编辑使用 `SELF_MEDIA_CONTENT:edit:<entityId>`，避免新建/编辑及不同内容之间串稿。
- 原有非受控表单改为受控但继续沿用现有字段和样式；覆盖标题、内容类型、平台、选题灵感、计划发布日期和长脚本。正式保存/删除、明确丢弃会清理草稿，普通收起创建表单会立即保存。
- 自动化验证：新增组件测试 3/3；A12 合并回归 5 文件 13/13；Web typecheck、相关 ESLint/Prettier、Web production build 通过。
- A12 保持 OPEN：核心 edit 表单依赖 A2，开发/学习与生活领域其他高输入表单、真实刷新/异常退出 E2E 仍待补；真实浏览器验证继续按用户安排后续单独处理。

## 5.2 A12 Slice 3 实施更新（2026-09-01）

- 开发项目创建与编辑表单复用 `useFormDraft`；创建使用 `DEV_PROJECT:create:new`，编辑使用 `DEV_PROJECT:edit:<entityId>`，覆盖项目名称、概览、状态和目标日期。
- 原有非受控表单改为可测试的受控组件，正式创建/保存/删除及明确丢弃会清理草稿；继续复用既有 mutation、字段、按钮和 CSS class。
- 自动化验证：新增组件测试 2/2；A12 合并回归 6 文件 15/15；Web typecheck、相关 ESLint/Prettier、Web production build 通过。
- A12 保持 OPEN：核心 edit 表单依赖 A2，学习与生活领域其他高输入表单、真实刷新/异常退出 E2E 仍待补；真实浏览器验证继续按用户安排后续单独处理。

## 5.3 A12 Slice 4 实施更新（2026-09-01）

- 学习资源创建与编辑表单复用 `useFormDraft`；创建使用 `LEARNING_RESOURCE:create:new`，编辑使用 `LEARNING_RESOURCE:edit:<entityId>`，覆盖名称、资源类型、作者/讲师、状态、当前/总进度及单位。
- 进度草稿保持用户输入字符串，正式保存时再转换为领域数值；正式创建/保存/删除及明确丢弃会清理草稿。独立的单次学习记录属于短操作，本切片不纳入草稿。
- 自动化验证：新增组件测试 2/2；A12 合并回归 7 文件 17/17；Web typecheck、相关 ESLint/Prettier 与 Web production build 通过（仅保留既有大 chunk 警告）。
- A12 保持 OPEN：核心 edit 表单依赖 A2，生活领域高输入表单、真实刷新/异常退出 E2E 仍待补；真实浏览器验证继续按用户安排后续单独处理。

## 5.4 A12 Slice 5 实施更新（2026-09-01）

- 购物清单创建与详情编辑表单复用 `useFormDraft`；创建使用 `SHOPPING_ITEM:create:new`，编辑使用 `SHOPPING_ITEM:edit:<entityId>`，覆盖名称、商品分类、数量、单位、计划单价、优先级、状态及购买渠道。
- 数量和金额在草稿中保留用户输入字符串，正式提交时再转换为领域数值；正式创建/保存/删除及明确丢弃会清理草稿。购买记账与购物预算属于独立短事务，本切片不纳入草稿。
- 自动化验证：新增组件测试 2/2；A12 合并回归 8 文件 19/19；Web typecheck、相关 ESLint/Prettier 与 Web production build 通过（仅保留既有大 chunk 警告）。
- A12 保持 OPEN：核心 edit 表单依赖 A2，其余生活领域高输入表单、真实刷新/异常退出 E2E 仍待补；真实浏览器验证继续按用户安排后续单独处理。

## 5.5 A12 Slice 6 实施更新（2026-09-02）

- 将已存在但未接线的饮食域草稿组件正式替换生产表单：餐食计划使用 `MEAL_PLAN:create:new`，直接用餐记录使用 `MEAL_RECORD:create:new`。
- 覆盖名称、日期、餐型、关联食谱，以及热量、支出和商家；正式创建与明确丢弃清理草稿。数字字段在草稿中保留输入字符串，正式 mutation 前再转换。
- 自动化验证：新增组件测试 2/2；A12 合并回归 9 文件 21/21；Web typecheck、相关 ESLint/Prettier 与 production build 通过（仅保留既有大 chunk 警告）。
- A12 保持 OPEN：Zcode 新增的健身/娱乐草稿组件仍未接生产页面；核心编辑覆盖和真实刷新/异常退出 E2E 仍待补。

## 6. A8/A9 Detail Resolver Foundation（2026-09-01）

- 新增单一 `buildEntityDetailHref(entityType, entityId)`，覆盖核心规划、七模块、附件、收集箱和 AI 会话；未知类型安全回落数据管理页，同时保留稳定实体参数。
- 搜索结果与提醒“查看详情”统一调用 resolver，不再各自维护模块首页映射。
- Notification repository 通过 `entity_index` 联表派生 `targetEntityType`，同步 Notification contract/OpenAPI/Web DTO；目标已删除或无类型时不渲染无效详情链接。
- 验证：resolver、提醒页面、Notification repository、M8 integration 共 4 文件 12/12；database/contracts/web typecheck 通过。
- A8/A9 保持 OPEN：URL 已精确携带对象身份，但 Life/Work/Today/Plans 页面消费 query 并自动打开详情仍依赖 A1/A2 详情面板；A8 数据源/筛选和 A9 Event 提醒/相对时间重算仍待实施。

## 7. A12 Slice 7 实施更新（2026-09-02）

- 将已存在但未接线的健身与娱乐草稿组件替换生产旧表单：训练记录使用 `WORKOUT_SESSION:create:new`，训练计划使用 `WORKOUT_PLAN:create:new`，娱乐条目使用 `ENTERTAINMENT_ITEM:create:new`。
- 恢复训练日期、关联计划/动作、组次重量、热量强度、训练说明，以及娱乐类型、进度单位与备注；正式创建和明确丢弃后清理草稿，提交继续复用既有 mutation 与领域数据转换。
- 自动化验证：新增组件测试 3/3；A12 合并回归 10 文件 20/20；Web typecheck、相关 ESLint/Prettier 与 production build 通过（仅保留既有大 chunk 警告）。
- A12 保持 OPEN：生活域主要高输入成本创建表单已接入；核心对象编辑草稿仍依赖 A2 完整生命周期，真实浏览器刷新/异常退出 E2E 仍待补。

## 8. A12 Slice 8 实施更新（2026-09-02）

- 为生产 Task 详情编辑表单补齐独立验收证据，确认实体隔离 key 为 `TASK:edit:<taskId>`，可恢复标题、优先级、截止时间和预计时长。
- 正式保存继续复用既有 `useUpdateTask`、乐观版本与自动重排流程；成功回调清除该任务草稿并关闭详情，未改生产交互或视觉。
- 红绿验证：测试先因 `TaskDetail` 不可访问而失败；最小导出组件后，Task 编辑草稿测试 1/1、A12 合并回归 11 文件 21/21 通过，Web typecheck、相关 ESLint/Prettier、production build 与 diff-check 通过（仅保留既有大 chunk 警告）。
- A12 保持 OPEN：Task 编辑已有生产实现与自动化证据；Goal/Plan/Event 完整编辑表单依赖 A2，真实浏览器刷新/异常退出 E2E 仍待补。

## 9. A2/A12 Goal + Plan 编辑切片（2026-09-02）

- 复用现有 Goal/Plan PATCH、If-Match/version、canonical history 与计划视图；新增 Web update hooks，并在看板、日历、时间轴和目标树的既有卡片上增加必要“编辑计划”入口，目标树增加“编辑目标”入口。
- Goal 可编辑标题、说明、DRAFT/ACTIVE/PAUSED/COMPLETED/CANCELLED 状态和起止日期；Plan 可编辑标题、说明、相同状态、优先级和起止日期。现有手动进度/恢复自动控件继续作为同一生命周期能力，不复制领域数据。
- 两个编辑表单分别使用 `GOAL:edit:<id>`、`PLAN:edit:<id>` 草稿 key，支持恢复、普通关闭保留、正式保存或明确丢弃后清理。
- 自动化：A2/A12 合并回归 14 文件 32/32；Web/Server typecheck、相关 ESLint/Prettier、Web production build 与 diff-check 通过（仅保留既有大 chunk 警告）。
- A2、A12 均保持 OPEN：A2 仍缺 Goal/Plan 删除恢复与关联详情、Task 删除、Event 完整生命周期；A12 仍缺 Event 编辑草稿和真实浏览器刷新/异常退出 E2E。

## 10. A2/A12 Event 编辑切片（2026-09-02）

- Today 事件时间块现在通过 `targetEntityId` 打开真实 Event 详情，不再只显示只读时间摘要；休息/睡眠块继续使用原只读面板。
- Event 可编辑标题、说明、起止时间、类型、优先级、SCHEDULED/COMPLETED/CANCELLED 状态、不可移动与显式允许重叠；保存复用现有 PATCH、If-Match/version、冲突检测、canonical history 与自动重排。
- 编辑草稿使用 `EVENT:edit:<id>`，覆盖全部可编辑字段；普通关闭保留，正式保存或明确丢弃后清理。冲突/时间/版本错误在详情面板给出可操作提示。
- 自动化：A2/A12 合并回归 15 文件 33/33；Web/Server typecheck、相关 ESLint/Prettier、Web production build 与 diff-check 通过（仅保留既有大 chunk 警告）。
- A2 保持 OPEN：仍缺 Goal/Plan/Task/Event 删除恢复与关联详情。A12 实现与自动化范围完成但保持 OPEN，等待真实浏览器刷新/异常退出 E2E 后再判 CLOSED。

## 11. A2 四核心统一软删除与恢复切片（2026-09-02）

- `ActionRepository` 为 Goal、Plan、Task、Event 增加统一 `softDelete`：校验乐观版本，将对象标记为 30 天后可清理，并通过 canonical history 记录 `SOFT_DELETE`；Task 同时释放既有排程块。
- M2 为四类对象增加 DELETE 路由与 OpenAPI 合同，继续强制 `If-Match` 与 `expectedVersion` 一致；Task/Event 删除后触发近端自动重排。Web 四类详情/编辑面板复用既有危险按钮与确认交互，将对象移入回收站并清理对应编辑草稿。
- 恢复继续复用数据管理页既有回收站和 M6 restore route，不新增第二套恢复模型。集成测试逐一证明四类对象删除后版本加一、进入同一回收站，并可按新版本恢复；陈旧版本删除返回冲突。
- 自动化：Time System/A12/M2/M6 合并回归 36 文件 129/129；database/contracts/server/web typecheck、contracts check、相关 ESLint/Prettier 与 Web production build 通过（仅保留既有大 chunk 警告）。
- A2 保持 OPEN：关联计划/任务、目标、子任务、依赖、提醒等详情入口仍需与 A3/A9 边界一起收口，并补真实浏览器完整生命周期 E2E。未改 CSS、布局、主题或视觉资源。

## 12. A2 核心对象关联详情切片（2026-09-02）

- Goal 编辑详情直接从现有 Plan/Task 查询展示关联计划和任务；既覆盖任务直接挂 Goal，也覆盖任务经 Plan 归属 Goal 的情况。
- Plan 编辑详情展示所属 Goal 和关联 Task；Today Task 详情展示所属 Goal、Plan、父任务及一层子任务。所有标题均由既有对象 ID 现场解析，不新增字段、复制表或派生持久化数据。
- 继续复用现有表单、详情面板和基础列表样式，没有修改 CSS、布局、主题或视觉资源。依赖增删/环校验留在 A3，Event 多提醒留在 A9，避免在 A2 重复实现。
- 自动化：关联摘要定向组件测试 3 文件 5/5；Time System + M2 回归 27 文件 109/109；Web typecheck、相关 ESLint/Prettier 和 production build 通过（仅保留既有大 chunk 警告）。
- A2 保持 OPEN：实现切片已覆盖其独立可落地范围，但最终关闭仍依赖 A3/A9 相关详情能力和真实浏览器完整生命周期 E2E。

## 13. A3 Task 依赖生产闭环切片（2026-09-02）

- 在既有 `task_dependencies` 与 `assertNoDependencyCycle` 上补齐依赖查询和解除；添加/解除均校验 Task 当前版本、生成 canonical history 新版本，并在 HTTP 成功后触发自动重排。
- M2/OpenAPI 提供同一路径的 GET/POST/DELETE：查询返回前置与后继任务 ID，写入强制 `If-Match` 与 `expectedVersion` 一致；环依赖和陈旧版本均返回冲突。
- Today Task 详情可查看前置/后继任务标题、从现有任务中选择前置任务、解除已有前置依赖；失败提示覆盖环和版本变化。候选项继续来自现有 Task 查询，不复制任务数据。
- 自动化：M2 + scheduler + Time System 回归 28 文件 124/124；database/contracts/server/web typecheck、contracts check 和 Web production build 通过（仅保留既有大 chunk 警告）。
- A3 保持 OPEN：子任务完整生命周期、通用 Plan milestone、Goal metric/progress entry、主要对象标签关联仍待独立切片；真实浏览器交互继续按既有安排后续验收。

## 14. A3 一层子任务完整生命周期切片（2026-09-02）

- Today Task 详情新增一层子任务创建入口，默认继承父任务分类、目标、优先级、截止时间和工作/生活区域；仓储继续强制只有一层，尝试创建孙任务返回领域校验错误。
- 父任务详情中的子任务可直接打开同一个 `TaskDetail`；打开后复用普通 Task 的编辑草稿、PATCH/version、完成动作、软删除与回收站恢复，不新增子任务专用模型或重复表单。Task 详情同时补齐“完成任务”动作。
- 子任务创建成功后触发自动重排。定向交互测试还发现并修复 Task/Event 详情关闭回调随输入变化导致焦点被重新夺回的问题：改用最新 `saveNow` ref 保持对话框关闭回调稳定，连续中文输入恢复正常。
- 自动化：M2 集成逐步验证创建、二层拒绝、编辑、完成、删除和恢复；Time System + M2 + scheduler 回归 28 文件 125/125；Server/Web typecheck、相关 ESLint/Prettier 和 Web production build 通过（仅保留既有大 chunk 警告）。
- A3 保持 OPEN：剩余通用 Plan milestone、Goal metric/progress entry 与主要对象标签关联；真实浏览器交互按既有安排后续验收。

## 15. A3 四核心对象标签关联切片（2026-09-02）

- 复用既有标签本体和 `tag_links`，在 ActionRepository 为 Goal/Plan/Task/Event 增加统一标签查询、关联与解除；写入校验对象当前版本及标签有效性，递增对象版本并记录 canonical history。
- M2/OpenAPI 增加 `/api/v1/entities/{id}/tags` GET/POST/DELETE，标签写入继续强制 `If-Match` 与 `expectedVersion`。标签本体创建、编辑与删除仍由既有 M1/设置页负责，不复制管理能力。
- 新增统一 `EntityTagsEditor`，接入 Goal、Plan、Task、Event 的现有详情/编辑面板；用户可查看当前标签、从有效标签中添加或移除。变更后统一失效核心对象与标签关联查询，避免继续使用旧版本。
- 自动化：M2 覆盖标签关联、读取、陈旧版本拒绝、解除和对象版本递增；统一编辑器覆盖添加/移除；canonical history 既有回归证明标签关系可恢复。相关合并回归 30 文件 126/126，四包 typecheck、contracts check、相关 ESLint/Prettier 与 Web build 通过（仅保留既有大 chunk 警告）。
- A3 保持 OPEN：剩余通用 Plan milestone 与 Goal metric/progress entry；A8 的 tag 搜索筛选另行接入。

## 16. A3 通用 Plan 里程碑切片（2026-09-02）

- 复用既有通用 `milestones(plan_id)` 与 `milestone_links`，没有复用或改写开发项目专用 `dev_project_milestones`，也不新增 migration。通用里程碑支持创建、详情、编辑、待完成/风险/达成/错过状态、达成时间、多任务/开发功能关联、软删除与统一回收站恢复。
- ActionRepository 将里程碑视为 Plan 的 owned relation：每次创建、编辑、关联调整和删除均递增 Plan 聚合版本并写 canonical history；Plan 历史快照现在同时捕获并恢复每个里程碑的 `linkedEntityIds`，引用失效时阻止不安全恢复。
- M2/OpenAPI 增加 `/plans/{id}/milestones` GET/POST 与 `/milestones/{id}` PATCH/DELETE；编辑和删除继续强制 `If-Match` 与 `expectedVersion`。回收站标题查询补上通用里程碑标题。
- Plan 编辑面板新增里程碑区域，可查看数量/状态/截止时间/关联数，创建时多选计划内任务，编辑字段和关联，快捷标记达成，或确认后移入回收站。未新增 CSS 或视觉资源，沿用现有 planning form、按钮和提示样式。
- 自动化覆盖多任务关联、编辑/达成、陈旧版本拒绝、删除/回收恢复、Plan canonical 字段及任务链接回滚和 UI mutation wiring。A3 保持 OPEN：仅剩 Goal metric/progress entry/auto override；A8 tag filter 仍单独处理。真实浏览器交互继续按既有安排后续验收。

## 17. A3 Goal 指标与进度记录切片（2026-09-02）

- 复用既有 `goal_metrics`、`goal_progress_entries` 与 Goal 的 `auto_progress/manual_progress/progress_mode/display_progress`，未新增 migration。指标支持创建、编辑、删除、权重与增减/维持方向；Goal 详情可录入指标当前值并查看单指标贡献。
- 指标与进度记录作为 Goal owned relation 接入 canonical history；每次写入强制 Goal 聚合版本和 If-Match，自动进度在存在指标时按权重计算、无指标时沿用任务完成度。`MANUAL_OVERRIDE` 下只更新 `auto_progress`，不静默覆盖 `display_progress`。
- M2/OpenAPI 新增 Goal metric 状态读取、指标 CRUD 与 progress-entry 写入；Web 在既有 Goal 编辑面板复用 planning form/button 控件增加 `GoalMetricsEditor`，未修改 CSS、布局、主题或视觉资源。
- 自动化验证覆盖指标 CRUD、进度录入、陈旧版本拒绝、手动覆盖保护，以及指标/进度 owned relation 的历史恢复；四包 typecheck、contracts check、定向 lint/format 与 Web production build 通过。A3 仍为 OPEN：A8 标签筛选与真实浏览器整链验收通过前不标 CLOSED。

## 18. A4 重复规则服务端五行为切片（2026-09-03）

- 在既有 recurrence 表与服务上增加统一 `ONLY_THIS / THIS_AND_FUTURE / ENTIRE_SERIES / SKIP_ONCE / END_RECURRENCE` 修改协议，所有统一修改强制规则版本与 If-Match，不新增 migration。
- 单次覆盖会持久化 `OVERRIDE` 并同步现有实例；跳过会保存 `SKIP`、撤销对应实例；本次及以后切分旧/新规则；整个系列保留已发生实例并在原规则上重建未来实例；结束重复保留当前及过去、撤销未来并停止生成。
- 生成器开始遵守数据库 `until_at`，同一规则重跑继续依赖稳定 `(rule_id, recurrence_key)` 保证幂等；创建规则时与 DTSTART 同时刻的原对象直接作为首个实例，避免重复克隆。规则同时保存不可变系列模板快照，因此“仅本次”修改首个复用实例后，后续扩窗生成也不会继承单次覆盖。同步修复 `FREQ=WEEKLY` 未提供 `BYDAY` 时错误按每日展开的问题。
- 新增按目标查询规则、列出实例关系和统一 modify M2/OpenAPI；自动化覆盖五行为、过去/未来实例、系列 ID、陈旧版本拒绝与重跑幂等。
- Task/Event 详情已共用统一五行为选择器；组件测试覆盖五个请求分支，Playwright 在真实七步初始化、真实 API 和 Desktop Chrome 下通过 Task “仅本次”与 Event 其余四行为，并核对持久化字段、新旧 rule ID、RRULE、SKIPPED、inactive 及未来实例状态；目标流程无控制台错误或失败响应。A4 已满足 DoD，状态改为 CLOSED。

## 19. A8 搜索覆盖与筛选切片（2026-09-03）

- 扩展既有搜索 projection，不新增 migration：在原四核心、Note 与七专属模块主对象基础上加入 Attachment metadata 和 Chat session/message plain text；附件只索引文件名、描述、MIME、扩展名及 owner/role metadata，明确不读取、不索引物理附件正文。
- 搜索合同、M6 路由和 Web adapter 已统一支持 `entityType/module/categoryId/status/tagId/from/to`；状态按实体表解析，日期使用 `event_at`、无业务日期时回退 `updated_at`，结束日期为排他上界。标签、聊天消息和附件 owner 关系变化会推进搜索投影版本，固定时钟下也能增量刷新。
- 生产搜索弹窗复用现有表单样式增加模块、分类、状态、标签、起止日期控件；筛选后保留“全部”入口，结果继续由统一 resolver 生成稳定 `entityType/entityId` URL。数据库、M6 integration、组件测试和隔离 Desktop Chrome Playwright 已验证组合筛选与链接，无 CSS/布局/主题/资源改动。
- A8 保持 OPEN：下一切片必须让 Today、Plans/Goals、Work、Life、Inbox、Data Management 等目标页消费 URL 身份并自动打开具体详情，再补跨类型详情跳转 E2E；当前不能把“URL 正确”视为“详情已打开”。

## 20. A8 详情目标消费第一切片（2026-09-03）

- 新增稳定 URL 身份读取器；Today 以全量 Task 数据打开已完成/非当前任务，并为 Event 增加 by-id API/合同/Query，使非当前日期日程也能打开现有详情；Plans/Goals 直接初始化既有编辑对话框。
- Work 的 SelfMedia/DevProject/Learning、Life 的 Shopping/Entertainment、Inbox 均把 URL `entityId` 接到既有 selected state；Life 有目标时自动开启既有管理 Drawer。Attachment 在 Data Management 新增安全元数据卡和下载入口，仅展示名称、MIME、扩展名、大小、状态与描述，不渲染 `storageKey`、绝对路径或正文。
- 隔离 Desktop Chrome Playwright 已从真实搜索结果依次打开 Task 详情、DevProject 编辑器和跨日期 Event 详情；M2 integration 验证 Event by-id，Attachment 页面组件验证元数据与下载目标。
- A8 仍为 OPEN：Note 需要解析所属业务对象后打开 Note composer；Recipe 与 WorkoutPlan 依赖 A1 补具体详情/编辑面板。Goal/Plan、SelfMedia/Learning、Shopping/Entertainment、Inbox、Attachment 仍需纳入最终跨类型浏览器矩阵。

## 21. A8 剩余详情目标与最终关闭（2026-09-03）

- Note 搜索结果新增所属对象 ID/类型；统一 resolver 将笔记 ID 附着到所属 Work 主对象 URL，工作页会直接初始化该对象的现有 Note composer。
- Diet/Recipe 与 Fitness/WorkoutPlan 在既有管理 Drawer 内增加列表和编辑表单，稳定 URL 身份会直接选中对应记录；WorkoutPlan 同步补齐最小更新合同、PATCH 路由、OpenAPI 与 Web mutation。没有新增 migration、CSS、主题或视觉资源。
- resolver 单测覆盖四核心、七专属模块主对象、Inbox、Attachment、Chat session 和 owner-aware Note；数据库测试覆盖 Note owner、跨类型同词召回、五类/组合筛选及附件正文隔离；M5 integration 验证训练计划修改不会丢失已有动作编排。
- 隔离 Desktop Chrome 从生产搜索弹窗依次打开 Task、跨日期 Event、DevProject、Note composer、Recipe 编辑器和 WorkoutPlan 编辑器，全程无 console error 或失败响应。A8 五项 DoD 均已满足，状态改为 CLOSED。

## 22. A1 饮食次级对象生命周期切片（2026-09-04）

- 复用既有 `meal_records`、`hydration_records`、`dietary_preferences`、`entity_index` 和统一回收站，不新增 migration。三类对象新增 PATCH/DELETE 合同与 M5 路由，编辑继续强制 `If-Match/expectedVersion`；删除走 30 天软删除，数据管理页可恢复。
- Life 饮食管理 Drawer 可从“最近实吃”“饮水记录”“现有偏好与限制”逐条打开详情，编辑餐次/日期/营养、饮水量/备注、偏好类型/严重程度/备注/启停，并可移入回收站；复用现有 `compact-form`、`work-list` 和按钮样式，未改 CSS、主题或资源。
- 服务端汇总回归证明餐食热量改为 `null` 后仍计 1 餐，但 `caloriesRecordedMeals=0`、`nutritionMissingMeals=1`，未记录营养没有被伪装成已记录 0；饮水编辑后汇总同步，餐饮支出关联保持不变。回收站标题补餐食、饮水备注/水量和偏好名称。
- 自动化：database/contracts/server/web typecheck；M5/M6/search 3 文件 9/9；contracts check；定向 ESLint/Prettier；Web production build均通过。独立 Chrome 151（固定 CDP 9333、独立 user-data-dir）通过 Browser Harness 完成三类对象创建、详情、编辑、删除和恢复，录屏位于 `C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a1-diet-crud-20260904`。
- A1 保持 OPEN：本切片关闭饮食三类次级对象的生命周期缺口；饮食筛选/趋势最终整链、健身与娱乐剩余维护闭环仍待后续切片。

## 23. A1 健身完整维护切片（2026-09-04）

- 复用既有健身表、`entity_index`、canonical history 与统一回收站，不新增 migration。动作、训练记录、身体指标、个人纪录、恢复状态新增 PATCH/DELETE，训练计划补 DELETE；全部编辑/删除继续强制 `If-Match/expectedVersion`，训练组与计划动作编排在局部更新时保持不丢失。
- Life 健身管理 Drawer 可从训练、指标、计划、动作、纪录和恢复列表逐项打开详情，修改生产字段并移入回收站；恢复继续使用数据管理页既有入口。回收站为六类对象显示动作/计划名称、训练/指标/恢复备注和纪录值，不再只有类型名。
- 服务端集成覆盖五类新增更新、六类删除恢复、陈旧版本 409、训练时长/热量/体重/恢复总览重算及关联集合保留。独立 Chrome 151（固定 CDP 9333、独立 user-data-dir）经 Browser Harness 验证生产 UI：编辑后总览为 1 次/120 分钟、65.1 kg，六类对象删除后回收站显示可读标题并全部恢复；录屏为 `C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a1-fitness-crud-20260904`。
- A1 保持 OPEN：饮食与健身生命周期重点缺口已收口；娱乐完整维护，以及饮食/健身筛选和趋势的最终整链仍待后续切片。未改 CSS、布局、主题或视觉资源。

## 24. A1 娱乐完整维护与筛选切片（2026-09-04）

- 娱乐条目新增全字段 PATCH 与软删除，娱乐时长记录新增 PATCH/DELETE；编辑继续强制 `If-Match/expectedVersion`，时长记录进度增量变化会原子校正条目进度。活动/旅行详情、进度/评分与娱乐支出继续复用既有权威对象和聚合，不新增 migration。
- 娱乐页增加类型、想看/想玩/想去清单、状态三类服务端筛选；现有 Drawer 可编辑条目标题、类型、清单、状态、总进度、单位、备注，也可编辑/删除具体时长记录。回收站为娱乐时长显示备注或日期标题。
- M5 integration 覆盖组合筛选、条目/时长编辑、陈旧版本 409、进度联动、150 分钟统计、8000 分支出、删除恢复。独立 Chrome 151（固定 CDP 9333、独立 user-data-dir）走通筛选、编辑、删除、回收站恢复；录屏为 `C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a1-entertainment-crud-20260904`。
- A1 保持 OPEN：三个重点域生命周期已收口；只剩饮食/健身筛选与趋势最终整链，完成并回归七模块后再判 CLOSED。未改 CSS、主题或视觉资源。

## 25. A1 饮食/健身筛选与趋势实现切片（2026-09-04）

- 将餐食已有日期查询扩为日期+餐次服务端筛选，饮水、训练记录沿用既有日期查询；身体指标补日期查询。Web hooks 正式透传查询，饮食页新增起止日期/餐次筛选，健身页新增起止日期筛选，现有按时间排列的营养、饮水、训练和身体指标列表作为趋势序列继续复用。
- M5 integration 新增同日命中、跨日排除、餐次、饮水、训练和身体指标筛选断言；相关 contracts/server/web typecheck、合同生成检查、M5 4/4 与 Web build 已通过。
- A1 保持 OPEN：本切片实现和自动化已完成，仍需独立 Chrome 验收筛选/趋势交互并执行七模块最终回归；完成前不标 CLOSED。未改 CSS、主题或视觉资源。

## 26. A1 最终验收与关闭（2026-09-04）

- 独立 Chrome 151（固定 CDP 9333、独立 `.codex/tmp/browser-harness-a1-final-9333`）验证饮食 2026-09-04+午餐组合只显示目标餐食，健身同日起始只显示 65.2 kg 指标；随后逐页验证自媒体、开发、学习、购物、饮食、健身、娱乐均正常加载且无失败状态。
- 最终 A1 定向回归为 M4/M5 integration 与七模块表单测试，共 9 文件 20/20；结合此前饮食、健身、娱乐三条独立生命周期录制，A1 DoD 的创建、详情、编辑、筛选、服务端统计、删除和恢复均有证据。
- A1=CLOSED。最终录屏：`C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a1-final-filters-regression-20260904`。未新增 migration，未改 CSS、主题或视觉资源。

## 27. A9 提醒闭环最终关闭（2026-09-04）

- Event 详情复用既有 Task 提醒编辑模式，支持多个提前 10 分钟、1 小时、1 天或固定时间提醒及逐项删除；投递服务继续按 Task 截止时间/Event 开始时间的最新值动态计算相对触发时刻。
- 修复提醒中心无请求体 POST 仍发送 `application/json` 导致“标记已读”返回 500 的问题；现在仅在存在请求体时设置 JSON Content-Type。定向自动化覆盖 Event 两个相对提醒、Event 目标时间变更后的实际触发重算及 Event 编辑器增删提醒，共 4 文件 10/10。
- 独立 Chrome 151（固定 CDP 9333、独立 `.codex/tmp/browser-harness-a2-a3-9333`）验证 Task/Event 各两个提醒、到期通知、标记已读、10 分钟稍后提醒，以及 Event/Task 正确详情跳转；录屏：`C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\a9-reminders-final-20260904`（39 帧）。A9=CLOSED；未新增 migration，未改 CSS、布局、主题或视觉资源，也未修改默认搜索引擎、浏览器策略或系统代理。
