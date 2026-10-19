# 生活助手 V2 — Phase 3 Life Rebuild 验收

日期：2026-08-25  
最高规则依据：《生活助手 V2 美术设计规范 V2》《生活助手 V2 美术改进实施计划 V2》  
直接视觉母版：`../work-life-color-masters-v2/life-theme-master-v2-1536x1024.png`  
环境背景资产：`../../../../apps/web/src/assets/life/life-morning-sage-forest-v2.png`  
基准视口：1536×1024，DPR 1  
扩展视口：1366×768、1920×1080、1100×900，DPR 1  
隔离 Fixture：`test-results/v2-life/data`

环境底图通过内置图像编辑以 Life 母版为唯一编辑目标生成：仅移除 Sidebar、文字、Card、Field、Button、Badge、Progress 等全部示例 UI，并要求不重构场景、不改变光线、色温、雾、丁达尔效应与右上树林结构。产物 SHA-256：`9e29d781a7dfdb904acca712d358879e3d805113b39edcc5cf6f12c6923facc1`。

## 阶段范围

本阶段只重建 Life 的 Morning Sage Theme、四层环境、Soft Fog / Elevated Fog 材质、Field 明度、文字对比度、微 Accent、柔和动效和新版视觉证据。生活总览、购物、饮食、健身、娱乐五个入口的路由、字段、数据关系、API、创建/编辑/删除/购买/记录语义和 master-detail 行为保持不变。

`life-page.tsx` 仅增加展示用 `data-life-section`，供购物、饮食、健身、娱乐微 Accent 选择器使用；未修改 query、mutation、表单字段或业务条件。

## 用户可感知变化

- 页面从历史深鼠尾草视觉重建为浅鼠尾草、米雾白与低饱和灰绿空间，不以整页单一浅绿色代替环境层次。
- 以母版为唯一视觉源去除全部示例 UI，生成无界面的 1536×1024 Life 环境底图；完整保留母版右上阳光、树林剪影、纵深雾与左上至右下的丁达尔光，并按右上锚定、原生比例覆盖，避免拉伸。
- Atmosphere 由底图中的 Sage Base、Morning Mist、Warm Sunlight、Soft Edge Shadow 构成；首屏以下使用轻柔颜色延展，不重复或机械拉长树林。树林保持母版中的低对比、柔焦和环境语言，不形成清晰摄影壁纸感。
- Sidebar 改为母版中的浅米雾与鼠尾草材质，信息架构、图标、Active 逻辑、快速记录和搜索位置保持不变。
- Standard Card 使用暖白 / 浅灰绿 Soft Fog、7px Blur、柔和边框与宽轻阴影；Detail / Selected 所在 Elevated Card 通过更白、更清楚和略强边框阴影提升，不通过变深表达。
- Field 使用略深于 Card 的灰鼠尾草；Focus、Primary Action 与主 Selection 使用暖杏。购物、饮食、健身、娱乐微 Accent 仅进入链接、Selected State、局部边框和轻 Tint。
- Life 保留 22px Card Gap、7/5 与 4/8 有序非对称总览、7/5 master-detail、220ms Hover 和 260ms Panel；1100px 按既有断点堆叠。
- 58 秒环境运动仅做极低幅位置变化；reduced-motion 下动画停止，静态光、雾、背景与层级保留。

## 功能冻结

- 生活总览继续支持周、月、季度、年范围切换及四组概览数据。
- 购物继续保留清单筛选、选中详情、新增、编辑、删除确认、购买记账、购买记录与预算。
- 饮食继续保留餐食计划、食谱、实吃、饮水与偏好记录。
- 健身继续保留训练记录、动作库、计划、身体指标、个人纪录和恢复记录。
- 娱乐继续保留清单、进度、娱乐时间、活动 / 旅行详情与支出记录。
- 未修改 `apps/web/src/features/life/api.ts`、服务端路由、数据库、权限、导航信息架构和快捷键。

## 自动化结果

| 命令 / 检查 | 结果 |
|---|---|
| `pnpm format:check` | 未全量通过；仅有 8 个既有 Today Phase 2—9 `metrics.json` 格式债，本阶段文件无新增格式问题 |
| 本阶段文件定向 `prettier --check` | 通过；5 个代码 / 样式文件全部符合格式 |
| `pnpm audit:v2-css` | 通过；9 个 component/page 样式文件无违规直接色值 |
| `pnpm lint` | 通过；0 warning / 0 error |
| `pnpm typecheck` | 通过；11 / 11 包 |
| `pnpm test` | 通过；257 项通过，2 项按设计跳过 |
| `pnpm contracts:check` | 通过 |
| `pnpm build` | 通过；11 / 11 包，保留既有主 JS chunk > 500kB 警告；Life 背景产物 1,521.78kB |
| `pnpm test:e2e:v2-life` | 通过；5 / 5 |
| `pnpm test:e2e:v2-foundations` | 通过；5 / 5，包含三档 Today 保护性截图 |

Life 专用 E2E 覆盖 5 个入口 × 4 个视口，共 20 个路由 / 视口组合；全部 `data-theme="life"`、页面标题、页面级横向溢出、Framework Error Overlay 和 console error 检查通过，并生成 20 张新版截图与 `life-metrics.json`。计算样式断言锁定 7px Fog Blur、22px Radius / Gap、220ms Hover、260ms Panel、Standard / Elevated / Field 明度角色、三档文字色、母版环境资产与 reduced-motion 静态保真。

文字对比度按 WCAG 相对亮度复核：Primary `#344239` 对 Page `#EAF2EC` 为 9.28:1；Secondary `#59675E` 对 Page 为 5.22:1；Muted `#607067` 对 Page 为 4.59:1；Primary 对 Field `#E1EADF` 为 8.59:1。正文、次要信息、Meta 与表单文本均达到小字号 4.5:1 门槛。

## 浏览器 QA

内置浏览器使用本地隔离实例 `http://127.0.0.1:43126`：

- 1536×1024 `/life`：页面标题“个人生活助手”、H1“生活总览”、`data-theme="life"`、4 张概览卡、母版环境资产加载、Atmosphere `pointer-events: none`、无错误层、无 console warning/error、无横向溢出。
- 核心交互：`/life` → “购物”后 URL、H1、`data-life-section="shopping"`、Selected Tab、Selected Item 与“待购详情”同步；无 console warning/error、无横向溢出。
- 1100×900：E2E 与截图确认五入口可达、概览双列、背景右上树林与晨光保留、无页面级横向溢出。

移动端不属于当前 Windows Desktop 产品阶段，本阶段按计划使用 1100×900 窄桌面作为最窄验收视口。

## 母版对照与 Fidelity Ledger

对照母版：`../work-life-color-masters-v2/life-theme-master-v2-1536x1024.png`  
实现截图：`overview-1536x1024.png` 及同目录其余 19 张页面截图。

| 对照点 | 母版证据 | 实现目标 | 当前结论 |
|---|---|---|---|
| 背景身份 | 浅鼠尾草、米雾白、柔雾共同构成空间 | 母版衍生环境底图 + 首屏以下 Sage 延展；不是单色浅绿 | 一致 |
| 晨光 | 光从左上进入，宽、柔、无光柱边界 | 母版原始光影、纵深雾与丁达尔光完整保留 | 一致 |
| 自然环境 | 右上树林剪影、极弱森林层次与遮光变化，先看到 UI | 母版衍生底图保留右上核心树林结构，维持低对比柔焦 | 一致 |
| Standard Fog | 暖白 / 浅灰绿、柔边框、7px Blur、宽轻阴影 | Overview、列表与 Workspace 共用语义材质 | 一致 |
| Elevated Fog | 更白、更清楚，不变深 | Detail Panel 使用 Elevated Surface 与增强边框阴影 | 一致 |
| Field | 略深于 Card 的灰鼠尾草 | `rgb(225 234 223 / 86%)`，计算样式断言锁定 | 一致 |
| Typography | 深灰绿正文，统一 32 / 24 / 18 / 14 层级 | Foundation Typography 不做 Life 分叉；四档文字对比度达标 | 一致 |
| Accent | 暖杏只负责操作与少量状态 | Primary / Selection / Focus；四模块仅微 Accent | 一致 |
| 布局与密度 | 比 Work 更松、更有呼吸，仍是生产力工具 | 22px Gap、有序非对称总览、7/5 master-detail | 一致 |
| 响应式 | 中桌面收紧，窄桌面优先可达 | 四档桌面无页面级横向溢出 | 一致 |

母版是背景、Atmosphere、Card、Field、Button、Tabs、Badge 与文字层级的正式视觉基准，不替代真实业务页面构图。实现保留 V1 已有业务信息架构，因此不会复制母版中的示例文案、示例 Sidebar 分组或样例卡片。

## 截图与 Metrics

- 截图目录：`docs/design/v2/life-v2/`
- 文件：`overview-*`、`shopping-*`、`diet-*`、`fitness-*`、`entertainment-*`，每组均应包含 1536×1024、1366×768、1920×1080、1100×900。
- Metrics：`life-metrics.json`，记录 Fixture、DPR、路由、视口、页面尺寸、横向溢出、reduced-motion Atmosphere 状态和截图文件名。

## 遗留与风险

- Edge 核心路径按总计划留到 Phase 8；本阶段优先使用项目配置的 Chrome 与内置浏览器。
- 未执行真实删除确认后的破坏性提交；删除、保存和写入语义由既有测试与本阶段非破坏性交互保护。
- 主 JS chunk > 500kB 为既有构建警告；本阶段未新增运行时依赖，新增一张 1.52MB 本地 Life 环境背景资产。
- 全仓 `format:check` 仍由既有 Today Phase 2—9 metrics 格式债拦截；本阶段文件定向格式检查通过，未改写不属于 Phase 3 的 Today 历史证据。
- 自动化、内置浏览器与母版 / 最新实现 `view_image` 同轮对照均未发现剩余可修复的重大视觉偏差；Edge 核心路径仍按总计划留到 Phase 8。
