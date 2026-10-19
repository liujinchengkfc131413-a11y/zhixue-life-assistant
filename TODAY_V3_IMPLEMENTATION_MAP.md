# Today V3 Phase 0 实施映射

> 状态：Phase 0 冻结与审计产物  
> 审计日期：2026-08-22  
> 适用范围：`apps/web` 的“今日”页面及其直接依赖  
> 视觉基准：`docs/design/today/concept-reference.png`（1536 × 1024）  
> 上位方案：`今日沉浸式界面 V3 重构设计与实施方案.md`

## 1. Phase 0 结论

当前工程不是旧 Dashboard 的空白起点，而是一套正在工作区中演进的 Today V2 实现：它已经具备统一 Today 数据入口、场景 ViewModel、压力视觉映射、横向时间轴、三段计划区、可用 AI 输入、WebGL 主渲染、Canvas 兼容回退、六状态 Fixture 和视觉 QA 脚本。

V3 应采用“保留业务骨架，替换视觉外壳”的策略：

- 不修改 Today API、压力算法、排程规则、任务状态机和 AI 权限边界。
- 保留 `TodayPage` 作为数据与操作编排层，保留一个统一 Scene Model 作为 UI 与 Renderer 的共享输入。
- 重构 `TodayImmersiveLayout`、Today 专属 CSS、场景资产组合和 Overlay 坐标，使静态 1536 × 1024 构图先通过 Gate 1–3。
- 现有 Fountain 模型、WebGL/Canvas Renderer 先冻结为可回退资产；Gate 3 以前不继续调 Shader，也不大规模删除。
- Gate 4 以后再按 V3 的 MainJet / 主弧 / 中层水束 / 细流 / Droplets / Splash / Ripple / Mist / Lighting 分层标准评估复用或替换现有水体实现。

审计时工作区已存在大量未提交的 Today V2/Fountain V2 修改和新文件。它们视为现有实现基线与用户资产；后续阶段不得通过 reset、checkout、批量覆盖或删除来“清理”这些变化。

## 2. 当前入口与运行链路

```text
TanStack Router `/`
  → AppShell
      → Today 路由主题：sidebar--today / content--today
      → TodayPage
          ├─ setup / categories
          ├─ GET /api/v1/today（60 秒轮询）
          ├─ GET /api/v1/tasks
          ├─ GET /api/v1/schedules/warnings
          ├─ create / update / complete task
          ├─ create event / reschedule
          └─ TodayImmersiveLayout
              → buildTodaySceneViewModel（UI 与 Fountain 的共享模型入口）
                  ├─ TodayEnvironmentHeader
                  ├─ TodayFountainScene
                  │   ├─ FountainWebGLRenderer（主路径，动态导入）
                  │   └─ FountainCanvasRenderer（初始化失败时回退）
                  ├─ TodayStatusFloats
                  ├─ TodayStateAxis
                  ├─ TodayPlanColumn / TodayAddForm
                  ├─ TodayHorizontalTimeline
                  └─ TodayAiComposer
```

当前时间不是单纯读取浏览器时钟：`TodayPage` 使用 Today API 的 `serverNow` 计算偏移，并每 30 秒更新 `currentNow`；Today 数据本身每 60 秒刷新。该机制必须保留。

## 3. 数据来源审计

### 3.1 Today 单一事实来源

| 层级 | 文件 / 模块 | 当前职责 | V3 决策 |
| --- | --- | --- | --- |
| 前端查询 | `apps/web/src/features/time-system/api.ts` | `useToday(date)` 调用 `GET /api/v1/today`；定义 `TodayData`、`TodayPlanItem`、`TodayBlock` | 保留 |
| API 契约 | `packages/contracts/src/m3.ts`、生成的 OpenAPI 类型 | 固定 date、Asia/Shanghai、serverNow、timelineVersion、blocks、plan、freeTime、totals、pressure | 保留，不为视觉坐标改契约 |
| HTTP 路由 | `apps/server/src/m3-routes.ts` | 将 `/api/v1/today`、timeline、plan、free-time、totals、pressure 转给 `TodayService` | 保留 |
| 聚合服务 | `packages/scheduler/src/today-service.ts` | 从排程块生成 24h blocks、计划、四类分钟数、空闲段和压力输入 | 保留 |
| 排程来源 | `ScheduleService` + `schedule_blocks` | 固定日程、任务、睡眠和休息的真实时间块 | 保留 |
| 前端场景模型 | `today/today-scene-view-model.ts` | 计算当前块、当前领域、未来 4 小时、弹性任务、状态块和 Fountain 输入 | 保留接口，V3 中扩展为正式 Today Scene Model |

`today.data` 是页面显示、时间轴和喷泉的共同源。V3 禁止复制第二份计划数据，也禁止让 CSS/Renderer 自行重新解释业务记录。

### 3.2 压力来源

```text
schedule_blocks / tasks
  → TodayService：15 分钟槽分类、连续工作、排程分钟、截止计数
  → packages/domain/src/pressure.ts：pressure-v1（0–100 + 四等级 + factors）
  → GET /api/v1/today.pressure
  → toPressureVisualState
  → buildTodaySceneViewModel
  → buildFountainSceneModel
  → UI + WebGL/Canvas Renderer
```

- 领域算法分值由负荷、优先级、截止紧迫、连续工作和缓冲不足组成，属于业务层，冻结。
- `pressure-visual-state.ts` 是前端语义适配层，现有等级与 PRD 一致，可保留；V3 可以在其后建立 Calm / Balanced / Busy / Intense Profile，不得改变领域分值。
- `fountain-model.ts` 已进行压力档插值，并同时接收 totals、activeArea、nowMinute 和任务优先级。它是 V3 `FountainVisualState` 的现有基础，不应在静态构图阶段删除。

## 4. 业务交互审计

### 4.1 任务、日程与排程

| 用户能力 | 前端入口 | API / 后端行为 | V3 保护要求 |
| --- | --- | --- | --- |
| 完成任务 | `TodayPlanColumn` → `TodayPage.onCompleteTask` | `POST /tasks/{id}/complete`，携带版本；后端状态迁移并自动排程 | 保留版本校验、查询失效和喷泉不重挂载更新 |
| 打开任务详情 | 计划项或任务时间块 → `TaskDetail` | 读取已加载 task；可更新任务和提醒 | 保留 |
| 打开非任务时间块 | 横向时间轴 → `selectedBlockId` 详情层 | 使用 Today block | 保留键盘点击语义 |
| 更新任务 | `TaskDetail` | `PATCH /tasks/{id}` + If-Match；成功后刷新 Today/任务/时间轴等查询 | 保留 |
| 添加弹性任务 | `TodayAddForm` | `POST /tasks`；后端自动排程 | 保留 |
| 添加固定日程 | `TodayAddForm` | `POST /events`；后端自动排程 | 保留 |
| 手动重排 | 顶部“重新安排今日” | `POST /schedules:reschedule` | 功能保留，V3 可重新安排视觉位置 |

所有 time-system 写操作通过 `invalidateTimeSystemQueries` 统一刷新 tasks、events、timeline、warnings、goals、plans、today 和 planning views。V3 视觉组件不能绕开这条失效链。

### 4.2 时间轴

`TodayHorizontalTimeline` 当前具备以下稳定能力：

- 将真实 blocks 投影到 00:00–24:00，并补齐 FREE 段。
- 固定显示 00、06、12、18、24 五个刻度。
- 以 `serverNow` 定位当前时间光标。
- 对真实 block 保留透明按钮交互层、键盘聚焦、状态文本和详情回调。
- 对重叠数据按开始时间稳定裁剪显示带，但不裁剪真实交互对象。

V3 重做尺寸与材质时保留这些函数和交互语义；时间轴仍只负责精确，不进入 Fountain 几何。

### 4.3 AI 输入

`TodayAiComposer` 已经是真实能力而非跳转占位：

- 读取 AI Provider 列表并要求存在唯一、可用、已验证的默认 Provider。
- 创建对话后向 `/api/v1/ai/chats/{id}/messages` 发送消息。
- 同时发送最小化的 Today context：日期、时区、当前时间、压力、totals、当前块和最多五项 upcoming。
- 成功后精确跳转到对应 `sessionId` / `runId`；失败时保留输入并复用已创建的会话重试。
- 无可用 Provider 时显示明确恢复入口，不伪装为可发送。

V3 只重做 AI Composer 的位置和弱视觉材质，不修改发送协议、上下文最小化、失败保留和 Provider 判定。

## 5. Canvas / WebGL 生命周期审计

### 5.1 组件级生命周期

`TodayFountainScene` 当前：

1. 由 `modelRef` 保存最新 Fountain Scene Model。
2. 动态导入 `FountainWebGLRenderer` 并异步 mount。
3. WebGL pending/fallback 时挂载 Canvas Renderer；WebGL ready 后销毁 Canvas 回退。
4. 模型变化调用 renderer 的 `render(model)`，不要求重挂载画布。
5. 监听 `prefers-reduced-motion` 并同步到两条 Renderer 路径。
6. 卸载时使用 token/disposed 保护，销毁对应 Renderer。

### 5.2 Canvas 回退

`FountainCanvasRenderer` 负责：

- `ResizeObserver` + RAF 节流重算尺寸。
- `visibilitychange` 与 `IntersectionObserver` 暂停后台/离屏动画。
- reduced-motion 静态帧。
- high / balanced / low 像素比、粒子预算和质量档。
- SmoothValue 平滑过渡，避免状态突跳。
- surface → arcs → main jet → crown spray → mist → particles → lighting 的绘制编排。

### 5.3 WebGL 主路径

`FountainWebGLRenderer` 当前拥有 water surface、main jet、arc streams、splash、droplets、volumetric mist，并使用 RenderTarget/DepthTexture 做屏幕空间反射折射近似；具备动态质量矩阵、帧时间采样、页面隐藏暂停和完整资源 dispose。

需要在 Phase 4/5 前处理的已知边界：

- WebGL 路径只监听 document visibility，未像 Canvas 一样使用 IntersectionObserver；V3 Phase 8 应统一离屏暂停策略。
- 当前场景仍同时叠加摄影水体纹理，视觉所有权需要在静态资产与动态水体之间重新界定。
- WebGL/Canvas 文件与测试均存在未提交修改，Gate 3 前只读冻结，不进行“顺手清理”。

## 6. 文件处置清单

### 6.1 保留

以下属于业务、协议、稳定交互或可复用基础：

- `apps/web/src/features/time-system/today-page.tsx`：数据获取、时间同步、选择态和操作编排。
- `apps/web/src/features/time-system/api.ts`：Today/任务/日程/排程 Query 与 Mutation。
- `apps/web/src/features/time-system/pressure-visual-state.ts` 及测试。
- `packages/contracts/src/m3.ts`、`apps/server/src/m3-routes.ts`、`packages/scheduler/src/today-service.ts`、`packages/domain/src/pressure.ts`。
- `today/today-horizontal-timeline.tsx` 的时间投影、FREE 补齐、光标和可访问交互。
- `today/today-plan-column.tsx`、`today/today-add-form.tsx` 的业务回调与表单语义。
- `today/today-ai-composer.tsx`、`features/assistant/api.ts`、`shared/assistant-draft.ts` 的发送闭环。
- `app-shell.tsx` 的路由、导航、提醒数量、快速记录和搜索快捷键业务逻辑。
- `docs/design/today/fixtures/*.json`、`manifest.json` 和现有确定性测试数据。
- Fountain 性能、reduced-motion、资源销毁、状态平滑和 Canvas fallback 能力。

### 6.2 重构

以下属于 V3 视觉外壳，允许大幅调整但应保留对外行为：

- `today/today-immersive-layout.tsx`：由现有 Grid 改为 V3 Today Visual Shell 和明确 Overlay 锚点。
- `today/today-scene-view-model.ts`：正式化为 UI 与 Renderer 共用的 Today Scene Model；避免 UI/Canvas 两套计算。
- `today/today-environment-header.tsx`：按参考图重排日期、环境语句、天气；重排入口降级但不删除。
- `today/today-state-axis.tsx`：拆分为喷泉左侧压力解释层与池面中央当前时间层。
- `today/today-status-floats.tsx`：固定为喷泉右侧竖向四块，不再随机或左右散布。
- `today/today-plan-column.tsx`：保持三段语义，但视觉上拆为三张独立玻璃卡。
- `today/today-horizontal-timeline.tsx`：收敛到约 800px 的场景内时间带。
- `today/today-ai-composer.tsx`：收敛到主场景底部约 800px。
- `today/today-fountain-scene.tsx`：重组 Environment / Pool / Fountain / Atmosphere / Lighting 的 DOM 与渲染所有权。
- `apps/web/src/styles/today-immersive.css`：当前 1442 行 V2 样式需要按 V3 坐标、token、弱玻璃和层级重写；不得只追加覆盖规则。
- `app-shell.tsx` 和 `global.css` 的 Today 主题表现：侧栏从当前 248px 调整到 V3 240px 基准，快速记录/搜索改为克制入口，但快捷键和业务逻辑保留。
- `apps/web/e2e/today-v2.spec.ts`、`scripts/today-visual-qa.mjs`：升级断言和产物命名以对应 V3 Gate，不抛弃既有功能回归覆盖。

### 6.3 删除候选（本阶段不删除）

只有在替代物已完成、引用扫描为零、对应 Gate 通过后，才可逐项删除：

- `fountain-scene-v1.png`：当前为环境图加载失败回退。
- `today-environment-atmosphere-v2.png`、`today-environment-v2.webp`、`fountain-water-photoreal-v2.png`：若 V3 正式拆分资产完全替代。
- 与 V2 左右散布状态、合并式 Plan Panel、全宽时间轴/AI 带绑定的旧 CSS 规则。
- `?fountainCanvas`、`?fountainDebug`、`?fountainBlind` 等旧 QA 入口：仅在 V3 QA 提供等价能力后评估；默认保留。
- 任何确认不再被 import、测试、脚本或视觉 Fixture 使用的旧 Renderer 辅助模块。

禁止将 `TodayPage`、Today API、压力算法、任务 Mutation、AI 发送链或 Canvas fallback 作为视觉重构的删除对象。

### 6.4 新增建议

后续阶段建议新增以下职责明确的文件；具体文件名可在实施时微调：

- `today/today-visual-shell.tsx`：V3 场景画布与 Overlay 锚点。
- `today/today-pressure-panel.tsx`：喷泉左侧压力解释层。
- `today/today-current-time.tsx`：池面中央当前时间与向下引导线。
- `today/today-plan-cards.tsx`：三张独立卡片的纯视觉组合层，复用现有业务行组件。
- `today/today-scene-model.ts`：若从现有 view-model 拆出正式共享模型；必须保证唯一计算源。
- `apps/web/src/assets/today/v3/`：environment、pool、scene glow 等不含 UI/动态水/数据的正式资产。
- `docs/design/today/v3/`：Phase 1–9 的 reference、implementation、diff 和 Gate 记录。
- V3 静态构图、Overlay 坐标、模型映射、交互回归、reduced-motion 与性能测试。

## 7. 现有测试与验收资产

### 自动化基础

- `pressure-visual-state.test.ts`：压力等级映射。
- `today-scene-view-model.test.ts`：状态、计划栏和 Fountain 输入。
- `today-horizontal-timeline.test.tsx`：时间段、FREE 补齐和交互。
- `today-plan-column.test.tsx`、`today-state-axis.test.tsx`、`today-status-floats.test.tsx`、`today-fountain-scene.test.tsx`。
- `fountain-model/geometry/motion/performance/webgl-water/blind-test` 等测试。
- `apps/web/e2e/today-v2.spec.ts`：六状态、1536×1024、无溢出、AI 发送、键盘、reduced-motion、低性能、任务完成后画布不重挂载。

### 视觉基础

- 总参考图：`docs/design/today/concept-reference.png`。
- 当前 V2 基线：`docs/design/today/00-phase0-current-baseline.png`。
- 六状态 Fixture：工作日低压、高压、休息日、睡眠不足、空状态、进行中。
- 复现脚本：`scripts/today-visual-qa.mjs`，使用隔离 bootstrap 和临时数据目录。

V3 Phase 1 必须新增独立输出目录，不能覆盖总参考图或 V2 基线。建议至少产出：

```text
docs/design/today/v3/phase1/reference.png
docs/design/today/v3/phase1/implementation.png
docs/design/today/v3/phase1/comparison.png
docs/design/today/v3/phase1/acceptance.md
```

## 8. 已知缺口与风险

1. **参考坐标尚未成为测试约束。** 当前 CSS 是两列 Grid，压力信息与当前时间合并在中央状态轴，状态块分散在喷泉两侧，右栏是一个容器；均与 V3 基准位置冲突。
2. **静态构图与动态水体耦合较深。** `TodayFountainScene` 同时负责资产、WebGL/Canvas 生命周期和水体纹理 CSS 变量；Phase 1 应先建立静态壳，不动 Renderer 内部。
3. **天气尚无真实数据适配层。** 组件正确显示“暂不可用”，V3 不得伪造；接入真实天气仍是后续独立能力。
4. **农历/辅助日期尚未实现。** 不阻塞 Phase 1 构图，可先保留明确空位或仅显示真实公历信息。
5. **Today notifications/suggestions 当前为空且 UI 未消费。** 不在视觉阶段虚构内容。
6. **弹性任务列表由 `useTasks(false)` 拉取全部未完成任务后前端筛选。** 长期数据量下可能扩大载荷，但属于既有业务/性能议题，不在 V3 视觉阶段顺手重构。
7. **REST 当前状态存在语义边界。** 服务端 totals 将 REST 视为空闲槽，但前端 `areaOfBlock` 对非 SLEEP 块按 WORK/LIFE 显示；Phase 7 业务回接时应补一项一致性验证，修正需单独确认业务语义。
8. **新增事项提交后立即关闭弹层。** Mutation 失败时错误可能不再可见；这是现有交互风险，不在 Phase 1–3 视觉构图中改动。
9. **工作区非干净状态。** Today/Fountain/AI/契约/截图等路径已有大量修改和未跟踪文件；所有后续差异核对必须以当前文件内容为基线，避免误认归属。

## 9. V3 分阶段执行边界

| Phase | 本仓库执行重点 | 进入条件 |
| --- | --- | --- |
| 1 静态构图 | 新建 V3 Visual Shell；关闭复杂动态水；按 1536×1024 锁定侧栏、喷泉、水池、压力、状态、三卡、时间轴、AI 位置 | 本 Phase 0 映射确认 |
| 2 资产拆分 | environment / pool / water surface / scene glow 职责分离 | Gate 1 构图通过 |
| 3 UI 美术 | Typography、弱玻璃、压力/状态/三卡/时间轴/AI 材质 | Gate 2 静态场景成立 |
| 4 喷泉几何 | MainJet、主弧、中层、细流；评估复用现有 WebGL/Canvas 模块 | Gate 3 静态画面接近参考图 |
| 5 水体氛围 | Droplets、Splash、Ripple、Mist、Lighting、Reflection | Gate 4 几何与厚度通过 |
| 6 Visual State | 统一输入/输出与四 Profile，平滑插值 | Gate 5 循环与空间关系通过 |
| 7 业务回接 | Today、任务、详情、重排、天气状态、AI 全链回归 | Renderer 与 UI 共用模型 |
| 8 性能 | 60 FPS 目标、降级、隐藏/离屏暂停、reduced-motion | 功能回归通过 |
| 9 桌面适配 | 1920×1080、1600×900、1440×900、1366×768 | 1536×1024 先通过 |

## 10. Gate 0 检查结果

- [x] Today 组件与路由入口已定位。
- [x] Today 数据来源与单一事实来源已确认。
- [x] pressure 领域算法、服务聚合和前端视觉映射已追踪。
- [x] 任务完成、更新、添加、详情和重排链路已追踪。
- [x] 横向时间轴的投影与交互逻辑已确认。
- [x] AI 输入的 Provider、创建会话、发送、失败重试和跳转逻辑已确认。
- [x] WebGL 主路径、Canvas fallback、reduced-motion、质量档、暂停与销毁逻辑已确认。
- [x] 保留、重构、删除候选和新增建议已列出。
- [x] 当前未提交工作区已列为后续保护边界。

Phase 0 不删除、不重写、不迁移现有业务或视觉代码。下一步是 Phase 1：只做静态构图，并以同尺寸截图比较作为 Gate 1。
