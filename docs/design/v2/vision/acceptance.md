# 生活助手 V2 — Phase 4 Vision 验收

日期：2026-08-26  
最高规则依据：《生活助手 V2 美术设计规范 V2》《生活助手 V2 美术改进实施计划 V2》  
正式母版：`../work-life-color-masters-v2/vision-plan-goals-master-v2-1448x1086.png`  
改造前对比：`../rebaseline-v2/plans-goals-1536x1024.png`  
母版视口：1448×1086，DPR 1  
扩展视口：1536×1024、1366×768、1920×1080、1100×900，DPR 1  
隔离 Fixture：`test-results/v2-vision/data`

## 阶段范围

本阶段只改造“计划与目标”的 Vision 展示层：Theme Token、环境背景、Air Glass、页面主次、看板、日历、时间轴、目标树、创建目标 / 计划面板、响应式和视觉证据。四视图继续调用原有 `usePlanningKanban`、`usePlanningCalendar`、`usePlanningTimeline`、`usePlanningGoalTree`，进度继续使用原有 Goal / Plan mutation；未修改 API、服务端、数据库、查询参数、表单字段或数据关系。AI 母版仅归档，具体页面实现仍留在 Phase 5。

## 母版资产

- Plan 正式母版原样归档为 `vision-plan-goals-master-v2-1448x1086.png`，SHA-256：`213cc3c1393a530573ed6517960e8ad8ab46da4ef05e16e750092cde3c06ba28`。
- AI 正式母版原样归档为 `vision-ai-assistant-master-v2-1448x1086.png`，SHA-256：`855713d527726a878bfc4ce1bc4f21713652232c5dc5937804a64238fe66c228`。
- 从 Plan 母版重建无 UI 的远景底图 `apps/web/src/assets/vision/vision-distant-horizon-v2.png`，保留右上暖白晨光、层叠远山、山谷光路与左下树影；SHA-256：`19efe3b62ce764067d6abd956c72b13b8984072566ce80918c8da8a2677e737d`。
- 按用户补充裁图分别重建 `vision-goal-ascent-v2.png` 与 `vision-plan-steps-v2.png`：前者保留山巅旗帜和蜿蜒上升路径，后者保留峡谷阶梯与右上星光；SHA-256 分别为 `c03eef42def7842a9a0e796c9ac8e3367614e7db9e5ef6aa5a3af0ef500d6eff`、`af337c1ee7b3352cdf5f925f5bff6f6a96f5dbd5859f896e31318875dcc80a07`。

## 用户可感知变化

- 页面背景完整采用母版的冷蓝远山、右上暖光、山谷光路、雾化纵深与左下树影，不使用星空、粒子或霓虹宇宙装饰。
- 工具栏、五列看板和卡片调整为母版的明亮通透 Air Glass；14px Blur、细亮边框与蓝紫 Selection / Primary Action 建立层级。
- 创建区域保留外层大玻璃框；“新建目标”和“新建计划”各自使用独立环境画面，真实字段仍置于左侧，右侧完整露出山路 / 阶梯视觉焦点。
- 四视图 Workspace 位于创建表单之前；表单字段、提交语义和原有操作不变。
- 日历、时间轴与目标树继续遵循 Phase 4 的轻网格、细线、大留白与层级规则，并统一消费 Vision Theme。
- 1100px 下工具栏换行、表单单列；页面无横向溢出，看板作为横向比较视图保留内部滚动。
- Atmosphere 动画在 reduced-motion 下停止，静态光影、雾与边缘暗化仍保留。

## 功能冻结

- 看板、日历、时间轴、目标树仍共享同一份目标、计划与任务数据，没有展示重构造成的数据分叉。
- 范围和工作 / 生活区域筛选、目标 / 计划创建、关联目标、自动进度、手动覆盖、恢复自动全部保留。
- 仅调整文案、展示类名、主题 Token、CSS 与静态图像资产；未改写 query、mutation 或业务判断。
- Today、Work、Life、AI、System 的路由和功能未进入本轮生产代码改造范围。

## 自动化结果

| 命令 / 检查 | 结果 |
|---|---|
| `pnpm audit:v2-css` | 通过；10 个 component/page 样式文件无违规直接色值 |
| `pnpm lint` | 通过；0 warning / 0 error |
| `pnpm typecheck` | 通过；11 / 11 包 |
| `pnpm test` | 通过；257 项通过，2 项按设计跳过 |
| `pnpm contracts:check` | 通过 |
| `pnpm build` | 通过；由 Vision 与 Foundations E2E WebServer 执行生产构建 |
| `pnpm test:e2e:v2-vision` | 通过；4 / 4 |
| `pnpm test:e2e:v2-foundations` | 通过；5 / 5，包含 Today 保护截图 |

Vision 专用 E2E 覆盖 4 个视图 × 5 个桌面视口，共 20 个视图 / 视口组合；全部 `data-theme="vision"`、共享计划可见、页面级横向溢出、Framework Error Overlay、console error 和 reduced-motion 检查通过。交互回归覆盖目标 / 计划创建、四视图切换、区域筛选、Goal 手动进度覆盖、真实键盘 Focus 和表单可达性。

## 浏览器 QA

内置浏览器通过本地隔离开发实例完成：

- 进入 `/plans-goals`，确认页面身份、Vision Theme、母版背景、Workspace 优先顺序和创建区域完整。
- 切换“日历 → 看板”，确认视图选择器可用、共享数据不丢失、控制台 error 为 0。
- 目视核对右上晨光与山谷光路、五列玻璃容器，以及“新建目标 / 新建计划”两幅独立场景；未出现框架错误层。

## 视觉对照与 Fidelity Ledger

| 对照点 | 正式母版目标 | 当前结论 |
|---|---|---|
| 环境构图 | 右上暖白晨光、层叠远山、山谷光路、左下树影 | 一致；生产背景直接使用重建的无 UI 母版底图 |
| 光影纵深 | 冷蓝雾场、远近山层、柔和丁达尔光 | 一致；Atmosphere 与位图共同保留纵深 |
| Air Glass | 明亮通透、细亮边框、14px 柔雾 | 一致 |
| 看板结构 | 五个圆角玻璃 Column，Card 为更清晰内层 | 一致；保留真实计划与进度操作 |
| Accent | 蓝紫只用于 Selection、Primary Action 和极少量高光 | 一致 |
| 创建目标 | 山巅旗帜、蜿蜒向上的道路，控件位于左侧 | 一致；独立背景资产，不与计划面板复用 |
| 创建计划 | 峡谷阶梯通向右上星光，控件位于左侧 | 一致；独立背景资产，不与目标面板复用 |
| 响应式 | 母版宽屏比例成立，1100px 仍可用 | 一致；五档页面级横向溢出均为 0 |

母版原始高度为 1086px；隔离 Fixture 含完整真实进度控制，最新 `kanban-1448x1086.png` 的 full-page 高度为 1097px，比母版多 11px。该差异用于保留 V1 操作能力，未通过隐藏或删除控件换取截图高度。

## 截图与 Metrics

- 截图目录：`docs/design/v2/vision/`
- 文件：`kanban-*`、`calendar-*`、`timeline-*`、`goal-tree-*`，每组包含 1448×1086、1536×1024、1366×768、1920×1080、1100×900。
- Metrics：`vision-metrics.json`，记录 Fixture、视图、视口、页面尺寸、页面横向溢出、看板内部滚动、reduced-motion Atmosphere 状态和截图文件名。

## 遗留与风险

- Edge 核心路径按总计划留到 Phase 8；本阶段使用项目配置 Chrome 与内置浏览器。
- AI 母版已经归档，但 AI 助手页面视觉实现仍属于 Phase 5，本轮未提前改造。
- Sidebar 保留既有品牌标记、图标体系、导航几何与真实快捷键文案，因此不会逐像素复制母版中的示例品牌图形。
- 主 JS chunk 体积警告属于既有构建状态；本阶段没有新增运行时依赖。
- 全仓 `format:check` 的既有 Today Phase 2—9 Metrics 格式债单独记录，不改写历史证据；本阶段文件定向格式检查通过。
