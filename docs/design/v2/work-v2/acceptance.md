# 生活助手 V2 — Phase 2 Work Rebaseline 验收

日期：2026-08-25  
最高规则依据：《生活助手 V2 美术设计规范 V2》《生活助手 V2 美术改进实施计划 V2》  
直接视觉母版：`../work-life-color-masters-v2/work-theme-master-v2-1536x1024.png`  
环境背景资产：`../../../../apps/web/src/assets/work/work-cold-morning-studio-v2.png`  
基准视口：1536×1024，DPR 1  
扩展视口：1366×768、1920×1080、1100×900，DPR 1  
隔离 Fixture：`test-results/v2-work/data`

## 阶段范围

本阶段只对 Work 的背景、环境层、玻璃材质、Field 明度、微 Accent、动效和视觉验收证据进行新版校准。工作总览、自媒体、开发项目、学习四个入口的路由、字段、数据关系、API、创建/编辑/删除语义、筛选、视图切换和 master-detail 行为保持不变。

`work-page.tsx` 仅增加展示用 `data-work-section`，供冷青、钢蓝、雾紫微 Accent 选择器使用；未修改 mutation、query、表单字段或业务条件。

## 用户可感知变化

- 页面从旧深绿黑/近黑后台重校为深青灰与蓝灰空间；以母版为源重建无 UI 的 1536×1024 环境背景，原样保留右上冷晨光、斜向光束、远山、针叶林和低饱和冷雾。
- 背景按右上锚定、原生比例覆盖，避免拉伸山体；首屏以下逐步过渡到 Deep Base，长页面不重复或机械拉长同一片山景。
- Work 环境由 Deep Base、Cold Mist、Environmental Light 三层组成；32 秒环境运动仅改变低幅位置，reduced-motion 下停止运动但保留静态光雾。
- Standard Glass 使用细边框、顶部高光、14px Blur 和克制阴影；Elevated Glass 通过更亮、更清楚、略强边框与阴影提升，不再通过变黑表达。
- Field 使用 `rgba(46, 67, 78, .68)`，Hover 使用 `rgba(53, 76, 87, .76)`，视觉上比 Standard Glass 亮一级；Focus 使用冷蓝 `#8FC8F2`。
- 自媒体、开发项目、学习的冷青、钢蓝、雾紫仅进入当前 Tab、Selected State、链接和小进度，不形成独立 Theme。
- Work 保留 170ms Hover、210ms Panel；交互最多上移 1px，无 Spotlight、Neon、Glow everywhere、Overshoot 或持续漂浮 Card。

## 功能冻结

- 工作总览继续使用稳定 12 栏、主 8 栏 / 侧 4 栏与紧凑 Metric Strip。
- 自媒体继续保留五列管线、日历、趋势、内容详情、表现录入、笔记和附件。
- 开发项目与学习继续保留 7/5 master-detail，1100px 按既有断点堆叠。
- 未修改 `apps/web/src/features/work/api.ts`、服务端路由、数据库、权限、导航信息架构和快捷键。

## 自动化结果

| 命令 / 检查 | 结果 |
|---|---|
| `pnpm audit:v2-css` | 通过；9 个 component/page 样式文件无违规直接色值 |
| `pnpm lint` | 通过；0 warning / 0 error |
| `pnpm typecheck` | 通过；11 / 11 包 |
| `pnpm test` | 通过；257 项通过，2 项按设计跳过 |
| `pnpm contracts:check` | 通过 |
| `pnpm build` | 通过；11 / 11 包，保留既有主 JS chunk > 500kB 警告 |
| `pnpm test:e2e:v2-work` | 通过；4 / 4 |
| `pnpm test:e2e:v2-foundations` | 通过；5 / 5，包含三档 Today 保护性截图 |

Work 专用 E2E 覆盖 4 个入口 × 4 个视口，共 16 个路由/视口组合；全部 `data-theme="work"`、页面标题、`data-work-section`、横向溢出、Framework Error Overlay 和 console error 检查通过。reduced-motion 下 16 个组合的 Atmosphere 动画名均为 `none`，静态背景仍保留。

## 浏览器 QA

内置浏览器使用本地隔离实例 `http://127.0.0.1:43124`：

- 1536×1024：`/work` 页面身份、非空渲染、`data-theme="work"`、Atmosphere `pointer-events: none`、无错误层、无 console warning/error、无横向溢出。
- 核心交互：`/work` → “自媒体” → “趋势” → `近月内容表现趋势` 可见；URL、H1、`data-work-section="self-media"` 与 Selected View 同步正确。
- 1100×900：总览主模块保持整行，两个侧模块保持双列；无横向溢出、无错误层、无 console warning/error。

移动端不属于当前 Windows Desktop 产品阶段，本阶段按计划使用 1100×900 窄桌面作为最窄验收视口。

## 母版对照与 Fidelity Ledger

对照母版：`../work-life-color-masters-v2/work-theme-master-v2-1536x1024.png`  
实现截图：`overview-1536x1024.png` 及同目录其余 15 张页面截图。

| 对照点 | 母版证据 | 实现证据与处理 | 结论 |
|---|---|---|---|
| 背景身份 | 深青灰 / 蓝灰，不是黑色后台 | 母版衍生环境图 + `#0E141B` Deep Base，保留蓝灰空间与纵深 | 用户确认通过 |
| 环境光 | 右上冷自然光，低饱和向左下扩散 | 背景资产保留右上冷白光源、斜向光束和自然扩散，不使用 Spotlight | 用户确认通过 |
| 山景与雾 | 中上部薄、冷、清透，右侧有远山与林线 | 右上锚定的 1536×1024 环境资产保留远山、针叶林与层叠冷雾 | 用户确认通过 |
| Standard Glass | 细边框、顶部高光、14px Blur、背景可感知 | 降低遮罩浓度，让光影与山景可透过顶层 Workspace、Metric Strip、Tabs | 用户确认通过 |
| Elevated Glass | 比 Standard 更亮、更清楚 | Overview 主 8 栏及 Detail 使用更亮 Elevated 背景、边框和阴影 | 用户确认通过 |
| Field | 比 Card 亮一级 | Field / Hover 使用 V2 规范精确值，计算样式断言锁定 | 一致 |
| Accent | 蓝为主，冷青/钢蓝/雾紫仅作微状态 | 仅进入 Selected、链接、小进度与当前 Tab | 一致 |
| 布局密度 | 专业、稳定、高扫描效率 | 12 栏总览、紧凑指标条、五列管线、7/5 master-detail 均保留 | 一致 |
| 响应式 | 中桌面收紧，窄桌面优先可达性 | 四档桌面无横向溢出，1100px 详情按既有断点堆叠 | 一致 |

母版为组件与视觉效果基准，不替代真实业务页面构图；实现保留 V1 已有业务信息架构，因此不会复制母版中的示例文案、示例 Sidebar 分组或样例卡片。

## 截图与 Metrics

- 截图目录：`docs/design/v2/work-v2/`
- 文件：`overview-*`、`self-media-*`、`development-*`、`learning-*`，每组均含 1536×1024、1366×768、1920×1080、1100×900。
- Metrics：`work-metrics.json`，记录 Fixture、DPR、路由、视口、页面尺寸、横向溢出、reduced-motion Atmosphere 状态和截图文件名。

## 遗留与风险

- Edge 核心路径按总计划留到 Phase 8；本阶段使用项目配置的 Chrome 与内置浏览器完成验收。
- 未执行真实删除确认后的破坏性提交；删除、保存和写入语义由既有集成测试与本阶段非破坏性交互保护。
- 主 JS chunk > 500kB 为既有构建警告；本阶段未新增运行时依赖，新增一张本地 Work 环境背景资产。
- 自动化验收已通过；用户于 2026-08-25 审查最终截图并确认通过，Phase 2 已同步写入根目录 `修改日志.md`。
