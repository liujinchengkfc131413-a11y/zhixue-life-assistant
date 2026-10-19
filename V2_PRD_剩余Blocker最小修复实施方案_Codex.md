# V2 剩余 PRD Blocker 最小修复实施方案（Codex 执行版）

> 阅读顺序说明（2026-09-06）：实时状态表与最终 DoD 表示最新功能结论。正文中的旧 OPEN、切片待验收和推荐实施顺序保留为历史过程，不再作为执行待办；下一阶段为发布就绪检查与 RC 固化。

> 文档目的：将 `V2_PRD_Compliance_Final_Audit.md` 中**仍未关闭的第一版必修问题**，压缩为可直接交给 Codex 实施的最小 Gap Closure 方案。\
> 功能权威：`产品需求与系统架构设计书.md` > `数据库与API详细设计书.md` > 当前实现。\
> 视觉原则：**本轮严禁重做视觉、布局、主题、Today Scene 美术与既有前端风格。只补功能闭环。**\
> 当前已关闭：**A1、A4、A5、A6、A7、A8、A11、A15**。这些项只做回归，不重新实施。\
> 当前剩余 Blocker：**0 项**。A21 已于 2026-09-06 完成最新稳定 Edge 同套件验收并关闭。

## 实时状态（最后更新：2026-09-06）

> 后续执行者每次关闭 blocker 时，必须在同一次修改中更新本表和 `修改日志.md`。只有该项全部 DoD 与验收证据满足时才标记 `CLOSED`；只完成切片时继续标记 `OPEN` 并简记进展。

| Blocker | 状态 | 已落地 / 当前说明 |
|---|---|---|
| A1 | CLOSED | 七模块结构化业务与回归通过；饮食、健身、娱乐均完成创建、详情、编辑、筛选、服务端统计、软删除与恢复。独立 Chrome 已验证三个重点域生命周期、饮食日期/餐次、健身日期趋势、娱乐组合筛选及七模块页面 |
| A2 | CLOSED | Goal/Plan/Task/Event 普通字段、状态、关联摘要、冲突/允许重叠/不可移动、统一软删除与恢复均已形成生产闭环；独立 Chrome 已验证 Goal→Plan→Task/Event 编辑、状态、删除、回收站恢复及恢复后关系保持 |
| A3 | CLOSED | Task 一层子任务、依赖、四核心标签、通用 Plan 里程碑与 Goal 指标/进度录入已完成；独立 Chrome 已验证子任务编辑/完成/删除/恢复、依赖阻塞/解除/环拒绝、里程碑关联、指标自动进度及标签增删 |
| A4 | CLOSED | 服务端统一五行为、版本保护、不可变系列模板、实例关系、未来重建/终止与重启幂等已完成；Task/Event 详情共用五行为选择器，Playwright 已通过真实七步初始化、Task/Event 与全部五行为整链验收 |
| A5 | CLOSED | 只做回归 |
| A6 | CLOSED | 只做回归 |
| A7 | CLOSED | 只做回归 |
| A8 | CLOSED | 搜索覆盖、五类及组合筛选、附件正文隔离、稳定详情目标均已完成；Note 经所属对象打开 composer，Recipe/WorkoutPlan 可直达既有 Drawer 内编辑器；真实浏览器已连续验证 Task/Event/DevProject/Note/Recipe/WorkoutPlan，主类型 resolver 矩阵与相关组件/服务测试通过 |
| A9 | CLOSED | Task/Event 均支持多个提前或固定时间提醒；投递按目标最新时间动态重算，提醒中心已读、稍后提醒与 Task/Event 详情直达均完成；独立 Chrome 最终验收通过 |
| A10 | CLOSED | 10.1–10.3 自动化与独立 Chrome 真实 E2E 均通过：八模板分类、日期覆盖新增/自定义编辑/删除、七步首次启动及跳过 AI 后进入 Today |
| A11 | CLOSED | 只做回归 |
| A12 | CLOSED | 四核心与主要高输入成本表单均接通用草稿；独立 Chrome 验证 Goal/Plan/Task/Event 刷新恢复、正式保存及四个 draft key 清空 |
| A13 | CLOSED | 显式结构化读取注册表已覆盖四核心、七模块主/子对象、Reminder/Schedule、Note 与 Attachment 安全元数据；Tool Runtime fixtures 与附件正文/存储字段隔离测试通过 |
| A14 | CLOSED | 9/9 工具、严格参数/意图/风险/A15 审计及四类高风险真实 DB 矩阵通过；独立 Chrome 验证真实聊天提出 action、拒绝/失败/确认与幂等结果 |
| A15 | CLOSED | 只做回归 |
| A16 | CLOSED | 通用 action 状态机、expiry、结果/错误、重复 confirm、Chat/SSE/Action Card 全链完成；修复流式续答覆盖 action part，自动化与独立 Chrome confirm/reject/fail/duplicate 验收通过 |
| A17 | CLOSED | 会话标题/消息正文搜索、打开继续、版本保护重命名、归档/恢复与 A8 全局搜索均完成；定向自动化及独立 Chrome 验收通过 |
| A18 | CLOSED | Provider stream、tool-call/tool-result 多轮续流、取消与 Last-Event-ID 重连均完成；55 项自动化与固定 9333 独立 Chrome、真实本地 SSE 网络联合验收通过 |
| A19 | CLOSED | TASK＋SHOPPING_ITEM＋GOAL Typed Result、migration 021、单 change set、第三项失败整批回滚、无 AI 原模式保留/手动处理提示均已落地；真实 ChatRunner 集成验证标准三对象与同一 action/change set，独立 Chrome E2E 验证跨模块入库与 UI 摘要 |
| A20 | CLOSED | 临近截止、今日过载、连续工作、依赖阻塞、目标停滞、预算阈值、跨域冲突、计划不可执行八类确定性 detector 均有 fixture；独立 Chrome 验证生产提醒卡 evidence/明确执行文案及业务对象零自动写入 |
| A21 | CLOSED | Chrome 152.0.7977.82 与 Edge 151.0.4129.107 使用同一隔离编排各通过 73/73；Edge 通过 `msedge` channel、Playwright 临时 Profile 验收，未复用日常浏览器 Profile，也未修改默认搜索引擎、浏览器策略或系统代理 |

---

## 0. 给 Codex 的执行指令

### 0.1 先做现状映射，再改代码

开始编码前，先检查当前 HEAD，并为每个 blocker 建一行映射：

| Blocker | 已有后端能力 | 已有 API | 已有 UI | 已有测试 | 真正缺口 | 是否需要 migration |
|---|---|---|---|---|---|---|

要求：

1. **不能因为审计快照写“缺失”就直接重写。** A5/A6/A7/A11/A15 修复后，可能顺带补齐其他能力；如果当前 HEAD 已经完整满足某项，则补验收证据后直接标记 closed，不再改代码。
2. 判断标准不是“有没有同名表/同名路由”，而是**用户是否能从生产 UI/API 完成 PRD 要求的完整流程**。
3. 已有等价实现必须复用。不要为了对齐详细设计而强行：
   - 改表名；
   - 改 API 路径；
   - 改 SSE 事件名；
   - 新建一套重复的 repository/service；
   - 大规模重构当前架构。
4. **Schema migration 只在当前数据模型无法表达 PRD 语义时才允许。** 优先补 service、route、DTO、UI wiring 和测试。
5. 若必须新增 migration，必须是最小、向前、可验证的增量，同时同步 Drizzle Schema、DTO/Zod、OpenAPI 和测试。
6. 所有业务写入继续复用现有：
   - change set；
   - history/version；
   - recycle/soft delete；
   - A15 已完成的 AI write execution context / audit / undo。
7. 不覆盖、不清理与本任务无关的用户改动，不做 broad refactor。
8. 每完成一个 blocker，先跑相关 unit/integration/E2E，再进入下一项。

### 0.2 视觉冻结

本轮以下行为禁止：

- 改主题、颜色、玻璃效果、背景、字号体系；
- 重新设计卡片、导航、Today Scene；
- 大范围调整间距、布局、动效；
- 为新增功能另起一套视觉组件体系。

允许：

- 在现有详情面板、Modal、Drawer、表单、筛选栏、Action Card 等既有组件上增加必要字段和操作；
- 复用当前按钮、表单控件、确认框、列表、统计卡片；
- 为完整功能闭环补少量必要入口，但外观必须继承现有组件。

---

# 1. 重排后的实施顺序

原审计 Batch 1 已因 A5/A6/A7/A11/A15 全部关闭而退出主线。剩余问题按依赖关系重新整理为四个最小批次。

## M1：生产业务闭环

**A1、A2、A3、A4、A8、A9、A10、A12**

可并行分三条线：

- **M1-A Life Domain**：A1
- **M1-B Core Planning**：A2 → A3 → A4
- **M1-C Common UX**：A8、A9、A10、A12

完成条件：不依赖 AI，用户已经可以在生产 UI 完整维护第一版核心数据。

## M2：AI 领域能力

**A13 → A14 → A19**

依赖 M1 的完整领域读取/写入能力，并复用已关闭的 A15。

完成条件：AI 能读全业务、调用 PRD 第一版工具，并完成跨模块原子写入。

## M3：AI 交互闭环

**A16、A17、A18、A20**

依赖：
- A16 依赖 A14 + 已关闭 A15；
- A20 依赖 A13；
- A17、A18 底层可以提前并行，但最终验收放在 M3。

完成条件：高风险确认、历史会话搜索、真正流式 tool-call、主动建议全部形成生产闭环。

## M4：最终验收

**A21 + 全量回归**

完成条件：16 个剩余 blocker 全部 closed，5 个既有 closed blocker 无回归，Chrome/Edge 最新稳定版通过同一套核心 E2E。

---

# 2. M1 — 生产业务闭环

## A1. 七个专属模块完整业务闭环

### PRD 最低要求

七个专属模块必须是真实业务模块，具备录入、编辑、详情、筛选和统计，而不是只能创建或查看的半成品。

审计指出当前重点缺口在：

- 饮食
- 健身
- 娱乐

自媒体、开发、学习、购物以**回归验证**为主，不因 A1 再重写。

### 最小实施方案

#### A1-Diet

必须保证下列 PRD 业务对象至少能完成现有数据模型支持的完整维护：

- 食谱
- 用餐计划
- 餐食记录
- 饮水记录
- 饮食偏好/忌口
- 营养统计
- 餐饮支出关联

最低闭环：

`列表/入口 → 创建 → 详情 → 编辑 → 状态/业务动作 → 删除 → 回收站恢复`

并至少提供：

- 日期筛选；
- 餐次/状态等现有结构化字段筛选；
- 营养趋势；
- 饮水趋势；
- 餐饮支出汇总；
- 缺失营养值保持“未记录”，不能当 0。

不要新建“独立财务模块”；费用继续走现有生活消费底层聚合。

#### A1-Fitness

补齐：

- 动作库
- 训练计划
- 训练记录
- 动作组数/次数/重量/时长/距离数据
- 身体指标
- 个人纪录
- 恢复状态

最低闭环同上。

统计至少覆盖：

- 训练频率；
- 训练时长；
- 身体指标趋势；
- 个人纪录。

训练计划与目标、任务/今日安排之间已有关系的，必须继续使用现有权威对象，不复制数据。

#### A1-Entertainment

补齐：

- 娱乐条目；
- 想看/想玩/想去；
- 状态与当前进度；
- 娱乐时长记录；
- 活动/旅行详情；
- 娱乐支出。

最低闭环同上。

筛选至少覆盖当前已有的：

- 类型；
- 清单类型；
- 状态；
- 日期/进度相关条件（若当前 UI 已有）。

统计至少覆盖：

- 娱乐时长；
- 清单/进度；
- 娱乐支出。

### 不要做

- 不接第三方影视/游戏/旅行 API；
- 不给每种小对象单独做新页面，优先复用当前模块内 Detail/Modal/Drawer；
- 不重做四个生活模块视觉；
- 不重新设计数据库，如果已有表能表达。

### A1 DoD

1. 七个模块全部存在真实结构化数据。
2. 饮食、健身、娱乐逐个证明创建、详情、编辑、筛选、统计、删除。
3. 删除继续走已经关闭的通用软删除/回收站机制。
4. 自媒体、开发、学习、购物做回归，不允许因本轮改动退化。
5. 所有统计由服务端结构化数据计算，不由页面临时拼接。

---

## A2. 目标、计划、任务、日程完整生命周期

### 最小实施方案

不要新做一套“计划系统”，补齐现有核心对象的生命周期。

### Goal

生产 UI/API 至少支持：

- 创建；
- 详情；
- 普通字段编辑；
- ACTIVE / PAUSED / COMPLETED / CANCELLED 等当前领域允许的状态流转；
- 手动进度 / 恢复自动进度；
- 删除；
- 回收站恢复；
- 查看关联计划/任务。

### Plan

至少支持：

- 创建；
- 详情；
- 编辑；
- 状态流转；
- 手动/自动进度；
- 完成；
- 删除；
- 恢复；
- 查看关联目标、里程碑、任务。

### Task

已有主要状态能力的基础上补齐：

- 编辑；
- 开始；
- 完成；
- 取消；
- reopen；
- 删除；
- 恢复；
- 详情中的排程、提醒、子任务、依赖等入口。

任务完成/取消后的排程释放继续复用已关闭 A5，不重复实现调度器。

### Event

至少支持：

- 创建；
- 详情；
- 完整编辑；
- 完成；
- 取消；
- 删除；
- 恢复；
- 冲突检测与显式允许重叠；
- 不可移动语义。

### 实施原则

- 所有删除复用已关闭 A6/A7 的历史与回收语义；
- 所有更新沿用当前 version / ETag / If-Match 或等价乐观并发；
- 状态流转必须走领域服务，不允许 UI 直接拼数据库状态；
- 目标、计划、任务、日程保持单一事实来源。

### A2 DoD

一套 E2E 可完整执行：

`目标 → 计划 → 任务 + 日程 → 编辑 → 状态变化 → 删除 → 回收站恢复`

并证明没有复制第二份任务/计划/目标数据。

---

## A3. 子任务、依赖、里程碑、指标和标签

### 3.1 子任务

补齐一层子任务：

- create
- edit
- status update
- reorder（若当前模型支持；没有则不是强制新增）
- delete

必须拒绝第二层嵌套。

### 3.2 任务依赖

补齐：

- 添加前置依赖；
- 查看前置/后置；
- 移除依赖；
- 调整依赖；
- 拒绝自依赖；
- 拒绝有向环。

排程继续遵循：前置未完成，后置任务不能被自动排入。

### 3.3 计划里程碑

不要误用“开发项目里程碑”替代通用计划里程碑。

至少支持：

- 创建里程碑；
- 关联计划；
- 编辑；
- 状态/达成；
- 关联多个任务或功能；
- 详情展示；
- 删除/恢复按现有主要对象语义执行。

现有底层如果使用同一个 `milestones` 聚合，只需补通用 plan flow。

### 3.4 目标指标

目标详情补：

- 指标创建；
- 指标编辑；
- 指标删除；
- 录入 progress entry；
- 自动进度计算；
- 手动进度 override 不被自动值静默覆盖。

### 3.5 标签

必须让用户在主要业务对象上真正使用标签，而不仅是设置页管理标签。

最小支持：

- 标签创建/编辑；
- 给目标/计划/任务/主要领域记录关联标签；
- 移除标签；
- 详情展示；
- 参与 A8 搜索筛选。

不要求新增一套复杂 Tag 页面。

### A3 DoD

至少验证：

1. 任务含一层子任务，可编辑/完成/删除；
2. A→B 依赖创建后，B 在 A 未完成时不能自动排程；
3. 解除依赖后恢复正常；
4. 环依赖被拒绝；
5. Plan 可建立通用里程碑并关联任务；
6. Goal 可建立量化指标并记录进度；
7. 主要对象可增加/移除标签，A8 能按标签找回。

---

## A4. 重复规则五种修改行为

### PRD 权威语义

任务和日程都支持重复，必须支持：

1. 仅本次；
2. 本次及以后；
3. 整个系列；
4. 跳过一次；
5. 结束重复；
6. 保留实例与原规则关系。

审计重点指出重复日程生产闭环缺失，但 PRD 权威高于审计，因此共享 recurrence 机制不能只对 Event 做成半套。

### 最小映射

优先复用详细设计已有机制：

| 用户动作 | 最小后端语义 |
|---|---|
| 仅本次 | recurrence exception `OVERRIDE` |
| 本次及以后 | split old rule + create/update future rule |
| 整个系列 | update original rule + rebuild future non-occurring instances |
| 跳过一次 | recurrence exception `SKIP` |
| 结束重复 | set rule inactive / until，停止未来生成 |

UI 只需要一个统一“修改重复事项”确认选择器，不重新设计日历。

### 必须守住的不变量

- 已发生实例不被静默重写；
- 单次 override 不污染整个系列；
- split 后旧实例仍能追溯原规则；
- 重启补跑不重复生成；
- 删除/跳过/结束不制造幽灵实例；
- 任务与日程的系列关系一致。

### A4 DoD

对同一重复序列逐个执行五种行为，验证：

- 当前实例；
- 未来实例；
- 已发生实例；
- series/rule relation；
- restart 后幂等性。

---

## A8. 全局搜索闭环

### 最小实施方案

在现有搜索体系上补覆盖，不改成语义搜索。

搜索范围必须包含：

- 任务
- 计划
- 目标
- 日程
- 笔记
- 七个专属模块
- 附件**元数据**
- AI 会话/聊天文本

禁止把附件正文放入搜索索引。

### 必须支持的筛选

- `entityType/module`
- `category`
- `status`
- `tag`
- `from/to`

可保留当前 API 命名，只要能力等价。

### 搜索结果必须可直达对象

每条结果返回/拥有稳定目标描述，例如：

```ts
{
  entityType,
  entityId,
  categoryId?,
  title,
  snippet,
  eventAt?,
  routeTarget
}
```

`routeTarget` 可以由前端 resolver 生成，不要求数据库存路由。

不能再只跳到“饮食首页/任务首页”，必须打开对应具体对象详情。

### 索引最小改动

优先扩展现有 `search_documents`/projection builder：

- attachment：name / mime / description / ownership metadata；
- chat：session title + message plain text；
- domain records：结构化可检索字段；
- tags：作为 keywords/filter relation。

### A8 DoD

1. 同一个关键词可找回任务、领域记录、附件元数据、聊天消息；
2. 五类筛选维度生效；
3. 组合筛选生效；
4. 点击结果能稳定打开具体记录；
5. 附件正文没有任何索引路径。

### 关闭记录（2026-09-03）

- 搜索投影已覆盖四核心、Note、七专属模块主对象、Inbox、Attachment metadata 与 Chat session/message plain text；五类及组合筛选、附件正文隔离均有数据库/API/UI 自动化证据。
- 统一 resolver 与目标页已消费稳定对象身份；Note 通过所属 Work 对象直达 composer，Recipe/WorkoutPlan 在既有 Life 管理 Drawer 内直达编辑器。
- 隔离 Desktop Chrome 已连续从真实搜索结果打开 Task、跨日期 Event、DevProject、Note、Recipe、WorkoutPlan；结合完整主类型 resolver 矩阵与相关组件/服务测试，五项 DoD 均满足，A8=CLOSED。

---

## A9. 提醒闭环

**状态：CLOSED（2026-09-04）。** Event 已复用 Task 的多提醒编辑能力；提醒投递会读取目标最新时间计算相对触发时刻。定向自动化 4 文件 10/10 与固定 CDP 9333 的独立 Chrome Browser Harness 最终验收共同覆盖全部 DoD。

### 最小实施方案

复用现有任务提醒 UI/服务，把同等能力接到 Event。

必须支持：

- 一个任务多个提醒；
- 一个日程多个提醒；
- 提前 10 分钟、1 小时、1 天、自定义；
- 提醒中心未读；
- 标记已读；
- snooze；
- 跳到 target 具体对象。

关键点不是新增通知中心，而是统一 `targetEntityId → detail resolver`。

### A9 DoD

1. Task 添加两个不同提醒；
2. Event 添加两个不同提醒；
3. 到期进入提醒中心；
4. read/snooze 正常；
5. 点击提醒能进入正确 Task/Event 详情；
6. 目标时间修改后，相对提醒实际时间会重算。

---

## A10. 设置和首次启动闭环

### 10.1 分类模板

**切片状态：已完成（2026-09-01）；A10 总项仍为 OPEN。**

创建分类时必须能选择：

- SELF_MEDIA
- DEVELOPMENT
- LEARNING
- SHOPPING
- DIET
- FITNESS
- ENTERTAINMENT
- GENERIC

用户可见文案使用当前中文名即可，底层稳定码不必暴露。

重命名不能改变 module type。

### 10.2 日期作息覆盖

**切片状态：已完成（2026-09-01）；A10 总项仍为 OPEN。**

在现有设置/例行事务 UI 中补：

- 查看日期覆盖；
- 选择某日；
- 选现有模板；
- 或设置当天自定义片段；
- 删除当天覆盖。

只影响指定日期，除非用户明确修改模板。

### 10.3 首次启动

**切片状态：实现与自动化已完成（2026-09-01）；真实浏览器 E2E 暂缓，因此 A10 总项仍为 OPEN。**

如果已有 onboarding，不重写，只补缺失步骤：

1. 数据目录；
2. 工作日/周末/节假日作息；
3. 七个模块初始化；
4. 自动备份；
5. **可选** AI provider/model/API key；
6. 快速记录默认行为；
7. 完成进入 Today。

AI 配置可跳过；数据目录不可跳过。

### A10 DoD

- 新分类能选择专属模板或 Generic；
- 某日作息 override 新增/编辑/删除可完整完成；
- 新安装路径能完整走完首次启动；
- 跳过 AI 后本地功能仍可正常进入主界面。

---

## A12. 全局表单草稿自动保存

**当前状态：OPEN。共享 Adapter、Task/Goal/Plan/Event 新建与编辑表单，自媒体内容、开发项目、学习资源、购物 create/edit，以及饮食、健身、娱乐主要高输入成本表单均已接入；实现与自动化已完成，真实浏览器刷新/异常退出 E2E 仍待补。**

### 最小实施方案

不要给每个表单各写一套 localStorage。

优先复用已有 Draft API/Service，抽一个通用 Form Draft Adapter：

```text
draftKey = formType + ":" + mode + ":" + (entityId || "new")
```

最低行为：

1. 表单 dirty 后 debounce 自动保存；
2. 刷新/异常退出后重新打开可恢复；
3. 已正式保存 → 清 draft；
4. 用户明确取消/丢弃 → 清 draft；
5. 新建和编辑使用不同 key；
6. draft 不是正式业务版本，不进入 entity history。

### 接入范围

必须覆盖：

- Task
- Goal
- Plan
- Event
- 其他存在长文本或多字段、用户输入成本明显的主要领域表单

不必给一个只有 toggle 的小设置项做 draft。

### A12 DoD

至少对 Task/Goal/Plan/Event 各验证一次：

`填写未保存内容 → 刷新/模拟异常退出 → 重新打开 → 恢复 → 正式保存 → draft 消失`

---

# 3. M2 — AI 领域能力

## A13. AI 查询所有结构化业务模块

### 问题本质

搜索索引只能帮助“找记录”，不能代替结构化业务读取。

`get_domain_record` 或等价工具必须读取真实领域 DTO，而不是只返回 title/summary/date。

### 最小实施方案

建立一个**AI Read DTO Registry / Domain Read Router**，复用现有领域 service：

```text
recordType -> domain read service -> explicit AI context DTO
```

至少覆盖：

- Task
- Event
- Goal
- Plan
- Reminder / Schedule
- Self Media
- Development
- Learning
- Shopping
- Diet
- Fitness
- Entertainment
- Notes（相关时正文）
- Attachment metadata

### DTO 原则

只给完成请求需要的结构化字段：

- 不返回 API Key；
- 不返回本地绝对路径；
- 不返回内部日志；
- 不返回版本完整快照；
- 附件只给 filename/MIME/size/ownership/description；
- **绝不读取附件正文或图像内容。**

### 跨模块分析

AI 至少能通过已有 read tools + domain DTO 完成：

- 工作/生活总览；
- 目标→计划→任务关系；
- 购物预算与消费；
- 饮食/健身/时间/目标关联；
- 领域详情查询。

不要一次把整库塞给模型；按工具请求按需读取。

### A13 DoD

建立 fixture 数据后，用 AI/tool runtime 验证七模块逐个可读取真实结构化字段，而不是 search index 摘要；附件内容读取必须被证明不存在。

---

## A14. 补齐 PRD §13.8 缺失 AI 工具

**状态：CLOSED（2026-09-05）。** 九项工具全部通过参数、意图、风险、A15 审计及真实数据库测试；四类高风险工具统一进入 A16 action，独立 Chrome 验证真实聊天提案和确认卡片闭环。

审计明确缺 9 项等价能力：

1. `create_domain_record`
2. `update_domain_record`
3. `add_reminder`
4. `request_reschedule`
5. `restore_change_set`
6. `delete_record`
7. `bulk_update_records`
8. `clear_ai_memory`
9. `empty_recycle_bin`

### 实施原则

**不要求工具名、表名、路由名物理一致；要求能力等价并能被 Tool Registry 调用。**

所有写工具必须：

- 使用与 REST UI 相同的 application service；
- 走 A15 已关闭的 AI execution context；
- 校验 `userIntentReference` 或当前项目已有等价明确意图引用；
- 更新携带 entity/version 约束；
- 返回结构化 result；
- 低风险直接执行；
- 高风险进入 A16 confirmation。

### 各工具最小映射

#### create_domain_record / update_domain_record

按 `recordType` 路由到七专属模块的 application service。

不要提供任意表写入能力。

#### add_reminder

复用 reminder service，可指向 task/event。

#### request_reschedule

复用现有 schedule service。

- 小范围普通调整可低风险；
- 大范围覆盖必须转高风险确认。

#### restore_change_set

直接复用已关闭 A15/A6 的 change set undo/restore service，不另造恢复系统。

#### delete_record

统一软删除 intent + confirmation。

#### bulk_update_records

先 validate all → preview impact → confirmation → one atomic change set。

任何一项失败不得部分落库。

#### clear_ai_memory

高风险，必须确认。

#### empty_recycle_bin

高风险且不可逆，必须确认，复用已关闭 A7 的安全永久删除/GC。

### A14 DoD

九项分别具备：

- 正向测试；
- 参数校验失败；
- 无明确用户意图拒绝；
- 风险等级正确；
- AI 审计来源正确；
- high-risk 不确认不写入。

---

## A19. 快速记录跨模块真实写入

**状态：CLOSED（2026-09-05）。** 标准三对象、正确模块、单一原子上下文、第三项失败整批回滚及无 AI 原模式保留均有集成证据；真实 ChatRunner 的 tool call、assistant action card 与 changeSet 一致，独立 Chrome 生产 UI/API E2E 通过。

### PRD 标准场景

必须支持一句话：

> “周五前完成项目首页，今晚买牛奶，下个月减重两公斤。”

至少拆成：

1. 开发项目任务；
2. 购物待购项；
3. 健身/身体指标相关目标。

### 最小架构

不要给 quick capture 单独维护第二套写逻辑。

统一流程：

```text
raw text
  ↓
AI parse
  ↓
Typed ChangePlan
  ↓
validate every operation
  ↓
risk classification
  ↓
single atomic change_set
  ↓
existing application services
  ↓
operation cards / structured result
```

### Typed ChangePlan 最低支持

必须能承载：

- core：task / event / goal / plan / note
- domain record：七模块里 A14 `create_domain_record` 已支持的类型
- relation/reminder 等必要轻量操作

### 事务要求

- 所有 operation 先校验；
- 任何关键对象校验失败 → 整组不写；
- 禁止出现“前两条已写入，第三条失败后用自然语言说抱歉”；
- 整组成功对应一个 changeSetId 或当前项目等价原子操作标识；
- A15 审计语义必须完整。

### 无 AI

无 API Key / AI 不可用时：

- 保留进收集箱；
- UI 明确告诉用户可手动处理；
- 不得悄悄把 `AI_PROCESS` 改成另一种模式后假装成功。

### A19 DoD

E2E 至少：

1. 标准三对象句子全部正确入库；
2. 每个对象出现在正确模块；
3. 整组拥有同一个原子操作上下文；
4. 人为让第 3 个对象校验失败，前 2 个也不得落库；
5. 工具结果和 UI 操作卡片与真实数据一致。

---

# 4. M3 — AI 交互闭环

## A16. 高风险 AI 操作确认闭环

**状态：CLOSED（2026-09-05）。** Confirm、Reject、Expire、Duplicate Confirm、Execute Fail 和成功结果均有自动化；独立 Chrome 验证真实聊天 action part、拒绝、失败、成功与重复确认幂等。

### 需要完成的状态流

```text
tool proposed
  ↓
awaiting confirmation
  ├─ user reject → cancelled / no write
  ├─ expired → expired / no write
  └─ user confirm
         ↓
      execute once
         ↓
      succeeded / failed
         ↓
      structured action card
```

### 适用工具

至少包括：

- delete_record
- bulk_update_records
- replace_long_term_goal
- clear_ai_memory
- empty_recycle_bin
- 大范围 request_reschedule
- 其他当前项目风险分级为 HIGH_WRITE 的 action

### 前端最小改动

复用现有 Chat Action Card 视觉：

显示：

- 操作类型；
- 影响摘要；
- 主要对象数量；
- 风险说明；
- Confirm；
- Reject；
- 执行状态；
- 成功后的详情/撤销（可撤销时）。

不要新做完整“审批中心”。

### 后端/SSE

- ChatRunner 遇到 high-risk 不得直接执行；
- SSE 能通知 awaiting_confirmation；
- confirm 后只执行一次；
- 重复点击 confirm 幂等；
- reject/expiry 不得产生业务写入；
- action 状态和 audit 保留。

### A16 DoD

分别测试：

- confirm；
- reject；
- expire；
- duplicate confirm；
- execute fail；
- 成功后 action card 与真实数据一致。

---

## A17. AI 会话关键词搜索与历史管理

**状态：CLOSED（2026-09-04）。** 会话列表可搜索标题和消息正文、包含归档会话、打开继续、版本保护重命名及归档/恢复；消息正文同步由 A8 全局搜索召回。数据库/API 定向测试与固定 9333 独立 Chrome Browser Harness 验收通过。

### 最小实施方案

复用 A8 搜索索引/FTS：

- chat session title 进入索引；
- chat message `plain_text` 进入索引；
- 搜索结果可打开对应会话并定位/至少进入历史会话；
- AI 会话列表增加搜索能力。

会话最低管理：

- list；
- open/continue；
- rename；
- archive/delete 按当前项目语义；
- detail/messages。

不需要第一版做复杂标签、文件夹或语义搜索。

### A17 DoD

1. 历史会话中输入唯一关键词；
2. AI 会话内搜索能找到；
3. 全局 A8 搜索也能找到；
4. 点击可继续原会话；
5. rename 后搜索/列表同步。

---

## A18. 真正流式回答

**状态：CLOSED（2026-09-05）。** 存在工具定义时仍由 Provider SSE 真实增量驱动；支持完整 tool-call、工具结果回传、下一轮多 delta、取消及 Last-Event-ID 重连。自动化与独立 Chrome 联合验收覆盖四类 DoD。

### 禁止的假修复

不能把最终完整回答在前端按字符定时切开，这不叫真正流式。

必须由 Provider 流式增量驱动。

### 最小目标

即使给模型传了 tool definitions，也必须：

- 持续接收 text delta；
- 持续接收/组装 tool-call delta；
- tool call 完整后执行本地工具；
- 将 tool result 回传 Provider；
- 继续同一 run 的下一轮流式输出；
- 直到最终 completion。

### ChatRunner 最小状态机

```text
RUNNING
  ↓
provider stream
  ├─ text delta → persist/emit delta
  ├─ tool call delta → accumulate
  ├─ tool call complete
  │      ↓
  │   execute or AWAITING_CONFIRMATION
  │      ↓
  │   feed tool result
  │      ↓
  │   resume provider stream
  └─ final → COMPLETED
```

### 取消

用户取消时：

- abort provider network stream；
- stop tool loop where safe；
- run = CANCELLED；
- 不再继续发送 assistant delta；
- 已经提交的原子业务操作不能伪装回滚，按现有 change set 语义记录。

### 重连

复用当前 SSE retention / Last-Event-ID 或等价机制。

关键是不能因为前端重连导致：

- 重复工具执行；
- 重复 delta；
- completed 两次。

### 完成状态

如果 provider 没有产生有效 final output 且 run 非合法 tool-wait 状态，不能直接标 `COMPLETED`。

### A18 DoD

必须有至少四种测试：

1. 无工具普通流式；
2. 带工具定义但不调用工具；
3. 一轮或多轮 tool-call 后继续流式回答；
4. cancel + reconnect。

自动化测试应观察到**多个真实 delta**，而不是只在结尾收到一个最终 delta。

---

## A20. 主动 AI 建议覆盖范围

**状态：CLOSED（2026-09-05）。** 八类 PRD detector 全部以确定性 fixture 覆盖，evidence 指向真实对象且分析只新增建议通知；独立 Chrome 验证生产提醒卡显示 evidence 与“需明确执行”边界。

### PRD 必须覆盖的发现类型

至少：

1. 今日过载 / 空闲不足；
2. 连续工作过久；
3. 临近截止；
4. 依赖阻塞；
5. 目标长期无进展；
6. 预算接近上限；
7. 饮食、健身、时间、目标之间冲突；
8. 计划明显不可执行 / 需要重排。

审计已有“逾期任务”能力可保留。

### 最小实现建议

不必让 LLM 自己扫全库。

更稳定的最低方案：

```text
structured deterministic detector
  ↓
candidate finding
  ↓
optional AI wording/summary
  ↓
AI_SUGGESTION / suggestion card
```

检测器读取 A13 已稳定的领域 DTO / statistics / schedule data。

### 建议卡片至少包含

- finding type；
- message；
- evidence object IDs；
- generatedAt；
- severity/priority（如果现有模型已有）；
- 可选建议动作。

### 写入边界

主动分析**只能生成建议**。

不得自动：

- 创建任务；
- 修改计划；
- 调整目标；
- 执行重排。

只有用户点击“执行”或发出明确指令后，才创建新的 user intent 并进入正常工具链。

### A20 DoD

为每种 detector 准备 fixture，证明：

- 能生成对应建议；
- evidence 对应真实数据；
- 没有任何未确认业务写入；
- 用户明确执行后才进入工具/action 流程。

---

# 5. M4 — A21 最终浏览器验收

## A21. 最新 Chrome 和 Edge 完整验收

### 最小要求

不能用 Chromium 测试替代 Microsoft Edge 证据。

在 Windows 当前安装的最新稳定版：

- Google Chrome
- Microsoft Edge

运行同一套核心业务 E2E。

若 Playwright 使用 channel：

- `chrome`
- `msedge`

记录实际浏览器版本。

### 必跑路径

至少覆盖：

1. 七个专属模块；
2. Goal/Plan/Task/Event 生命周期；
3. 子任务/依赖/里程碑/指标/标签；
4. 重复规则五行为；
5. 搜索；
6. 提醒；
7. 设置/日期覆盖/首次启动关键路径；
8. 草稿；
9. AI 结构化查询；
10. AI tool；
11. high-risk confirmation；
12. chat search；
13. streaming/tool-call；
14. quick capture atomic write；
15. proactive suggestion。

### A21 DoD

输出验收证据：

```text
browser
browser_version
commit_sha
test_suite
passed
failed
skipped
artifact/log path
date
```

只有 Chrome 与 Edge 的 blocker suite 均通过，A21 才能 closed。

### 关闭记录（2026-09-06）

- Chrome 152.0.7977.82 已按相同隔离编排通过 73/73；Edge 稳定源 151.0.4129.107 安装到标准路径后，通过 `LIFE_ASSISTANT_BROWSER=msedge node scripts/run-isolated-e2e.mjs` 同样通过 73/73，失败 0、跳过 0。
- Edge 自动化由 Playwright `msedge` channel 启动，每套使用临时隔离 Profile；旧版 `C:\Program Files\Edge\App\msedge.exe` 116 与其 Profile 均未删除或复用。未修改默认浏览器、默认搜索引擎、浏览器策略或系统代理。
- 验收暴露 migration 021 后恢复上限和可靠性断言仍停留在旧 schema 版本；已改为从迁移列表读取最新版本并完成 31/31 定向回归。最终 `pnpm verify` 全绿：450 passed、7 skipped，contracts/build/Launcher 均通过。
- 结构化证据见 `artifacts/a21/a21-browser-acceptance.md` 与 `V2_PRD_Remaining_Blockers_Closure_Report.md`。A21=CLOSED。

---

# 6. 回归保护：已关闭 A5 / A6 / A7 / A11 / A15

这五项不重新实施，但因为剩余功能大量依赖它们，必须做最小 smoke regression。

## A5

- 完成任务释放未来时间块；
- 逾期自动重排；
- 调度历史仍可追踪。

## A6

- 核心/主要领域对象版本历史；
- restore 不破坏后续历史。

## A7

- 30 天清理；
- 启动补偿；
- 附件最后引用删除后才 GC。

## A11

- restore 后旧 credential reference 不能直接复用；
- 必须重新填写 Key。

## A15

对本轮新增所有 AI write tools 强制验证：

- source=AI；
- model/session/run/action 关联；
- before/after；
- changeSet；
- 原子性；
- 普通写入 undo。

**如果新增工具绕开 A15，视为 blocker 未关闭。**

---

# 7. Codex 推荐落地节奏

## Pass 0 — Audit Current HEAD

只读：

1. 建 16 项 blocker mapping；
2. 标出已经被此前修复顺带解决的项；
3. 列出真正需要改动的文件/服务/route/component/test；
4. 不改视觉；
5. 不立刻 migration。

产出：

`V2_Remaining_Blocker_Current_State.md`

## Pass 1 — M1-A Life Domain

处理 A1。

结束时跑 Life module unit/integration/E2E。

## Pass 2 — M1-B Core Planning

按 A2 → A3 → A4。

这是最容易产生业务数据漂移的一组；每项独立提交/独立验证更安全。

## Pass 3 — M1-C Common UX

处理 A8/A9/A10/A12。

优先做统一 detail resolver，因为 A8/A9 都依赖。

## Pass 4 — M2 AI Domain

A13 → A14 → A19。

禁止在 A13 DTO 未稳定前硬写跨模块 prompt hack。

## Pass 5 — M3 AI Interaction

A16/A17/A18/A20。

A17 可与 A18 并行，但 A16 必须确认 A14 已全部接入；A20 必须依赖 A13。

## Pass 6 — Full Regression

- 16 remaining blockers；
- 5 closed blockers smoke；
- `pnpm verify` / 项目当前标准 verification command；
- lint/typecheck/unit/integration/E2E；
- migration from clean DB + current stable DB（如果本轮有 migration）。

## Pass 7 — Browser Acceptance

Chrome + Edge。

---

# 8. 测试矩阵

| ID | 必须补的自动化/验收 |
|---|---|
| A1 | 七模块创建/详情/编辑/筛选/统计/删除/恢复，重点 Diet/Fitness/Entertainment |
| A2 | Goal→Plan→Task/Event 完整生命周期 |
| A3 | subtask、dependency add/remove/cycle reject、plan milestone、goal metric、tag |
| A4 | 单次/以后/系列/skip/end + series relation |
| A8 | chat + attachment metadata + domain search；所有筛选；detail jump |
| A9 | task/event 多提醒；read/snooze/detail |
| A10 | category template；routine override；onboarding |
| A12 | refresh/crash draft restore + save clear |
| A13 | 七模块 AI structured read；attachment metadata only |
| A14 | 9 tools 正向/校验/意图/风险/A15 audit |
| A16 | confirm/reject/expire/duplicate/failure |
| A17 | chat keyword search + continue + rename |
| A18 | true delta + tool-call stream + cancel + reconnect |
| A19 | canonical 3-object quick capture + atomic rollback |
| A20 | 全部 PRD finding types + no auto-write |
| A21 | latest Chrome + Edge same blocker suite |

---

# 9. 明确不在本轮修复范围

除非实现上述 blocker 不可避免，否则不得新增：

- 手机端 UI；
- Windows 桌面容器重构；
- 外部日历、邮箱、微信、健康设备接入；
- 内容平台自动同步；
- 附件 OCR/正文 AI 读取；
- 向量库/语义搜索；
- 云端数据库；
- 多用户；
- 新的复杂统计指标；
- Today Scene 新动效；
- V3 功能；
- 视觉重做。

---

# 10. 最终 Definition of Done

V2 剩余 Gap Closure 只有同时满足以下条件才算完成：

- [x] A1 closed
- [x] A2 closed
- [x] A3 closed
- [x] A4 closed
- [x] A8 closed
- [x] A9 closed
- [x] A10 closed
- [x] A12 closed
- [x] A13 closed
- [x] A14 closed
- [x] A16 closed
- [x] A17 closed
- [x] A18 closed
- [x] A19 closed
- [x] A20 closed
- [x] A21 closed
- [x] A5/A6/A7/A11/A15 regression pass
- [x] 无新增视觉回归
- [x] 无重复领域模型/重复服务
- [x] 如有 migration：clean DB 与 upgrade DB 均通过
- [x] OpenAPI/contracts 与实际生产行为一致
- [x] 项目标准 verify 全绿
- [x] 最新 Chrome 全量 blocker suite 通过
- [x] 最新 Edge 全量 blocker suite 通过
- [x] 当前工作树、migration、测试证据、审计状态一致

---

# 11. Codex 完工报告模板

实施完成后，必须生成：

`V2_PRD_Remaining_Blockers_Closure_Report.md`

每个 blocker 使用以下格式：

```md
## Axx - <title>

Status: CLOSED / STILL OPEN

### Existing capability reused
- ...

### Minimal changes made
- backend:
- api/contracts:
- frontend:
- tests:

### Acceptance evidence
- unit:
- integration:
- e2e:
- manual:

### Visual impact
- NONE / explain unavoidable minor wiring

### Migration
- NONE / migration id

### Regression
- related closed blockers checked:
```

最后追加：

```md
## RC Readiness

Remaining PRD blockers: 0 / N

Chrome:
- version:
- suite:
- result:

Edge:
- version:
- suite:
- result:

verify:
- command:
- result:

Recommendation:
- READY FOR RC
- NOT READY FOR RC
```

---

# 12. 关键设计约束索引

Codex 在实现时优先回看以下原始条款：

### 产品需求与系统架构设计书

- §5.1 / §5.2：全局能力、分类模板
- §6.2–6.6：Goal/Plan/Task/Event/Recurrence
- §8–§9：七个专属业务模块
- §10：计划、依赖、里程碑
- §11：Quick Capture
- §13.3–13.9：AI 读取、权限、工具、对话
- §14：搜索与提醒
- §15：统计
- §16：设置
- §22.3：草稿自动保存
- §23：首次启动
- §24：第一版硬验收

### 数据库与 API 详细设计书

优先复用现有设计语义：

- categories / tags / tag links
- goals / goal metrics / plans / milestones
- tasks / subtasks / dependencies
- events / recurrence
- routine/date overrides
- reminders / notifications
- drafts
- search projection / FTS
- life domain tables
- AI context DTO
- AI tool registry
- confirmations
- change sets / versions
- SSE
- domain application services

注意：详细设计是**实现参考，不是物理结构强制模板**。如果当前代码已有等价实现，保持现状，只补缺失业务闭环。
