# Phase 7 — Navigation / Cross-theme Consistency 验收

基准：《生活助手 V2 美术改进实施计划 V2》Phase 7，以及《生活助手 V2 美术设计规范 V2》第 44—46 节。用户补充约束优先：保留各空间既有视觉元素、情绪和背景；导航栏让 Today 与其他空间对等。

## 阶段范围

- 统一审计 Typography、Lucide 图标、Button / Field / Tab / Badge、Dialog、Sidebar 信息架构与状态逻辑。
- 让 Today Sidebar 与其他空间使用同一 248px 宽度、14px 导航文字、15px / 2 stroke 导航图标、11px 圆角、39px 导航行及 40px 快速记录 / 搜索控件。
- Today 继续保留白色轻盈 Sidebar、Sprout 品牌、陪伴文案、用户区和喷泉 Scene Theme；Work / Life / Vision / AI / System 的背景、材质、密度、光雾与情绪不变。
- 将共享状态面板的字符图标和全局搜索的 `⌕` 替换为 Lucide 线性图标。
- 为 AppShell、内容区和 Sidebar 增加仅作用于颜色、背景色、边框和阴影的克制跨 Theme 过渡；reduced-motion 下缩短到 `0.01ms`。
- 不修改路由、字段、API、query / mutation、快捷键、Dialog 行为、页面业务 DOM 或数据关系。

## 需求对应

| 编号 | 实现 / 审计结论 |
|---|---|
| P7-01 | 五个非 Today Theme 的 H1 32/600、H2 23/600、H3 18/600、Body 14/400 完全一致；Today 场景排版保持独立，Sidebar 导航统一为 14px。 |
| P7-02 | Sidebar 为 Lucide 15px / stroke 2；共享 Error / Empty / Loading 和搜索图标迁移为 Lucide，不再使用独立字符图标。 |
| P7-03 | 五个非 Today Theme 的 Button / Field 均为 40px / 11px，Tab 11px，Badge 24px；全局 Dialog 六 Theme 几何和 System Surface 一致。 |
| P7-04 | Page Header → Context Navigation → Workspace → Detail / Secondary Area 已在 Phase 2—6 形成；本阶段不重排业务 DOM。 |
| P7-05 / P7-06 | 六空间 Sidebar 导航顺序、图标、Active 逻辑、快速记录 / 搜索位置一致；颜色和材质继续随 Theme 变化。 |
| P7-07 | Shell 表面加入跨 Theme 过渡；真实键盘焦点随导航链接保留，无页面级横向跳动。 |
| P7-08 | Work / Life 灰度图仍显示相同控件与导航家族，但 Cold Glass 的高密度深层级与 Soft Fog 的明亮宽松层级清楚可分。 |
| P7-09 | 全仓审计未发现 `WorkCard`、`LifeCard`、`--work-*`、`--life-*` 或页面级直接色值违规。 |

## 视觉对照与 Fidelity Ledger

| 对比点 | 阶段前证据 | Phase 7 证据 | 结论 |
|---|---|---|---|
| Today 导航对等 | `foundations-v2/today-protection-phase1-1536x1024.png` | `cross-theme/today-1536x1024.png` | 快速记录 / 搜索恢复为与其他空间对等的完整入口；白色材质、品牌、喷泉和 Scene 构图保留。 |
| Work 情绪与材质 | `work-v2/overview-1536x1024.png` | `cross-theme/work-1536x1024.png` | 冷晨光、远山、深青灰、Cold Glass 与高密度结构无可见漂移。 |
| Life 情绪与材质 | `life-v2/overview-1536x1024.png` | `cross-theme/life-1536x1024.png` | 晨光树林、浅鼠尾草、Soft Fog 与有序非对称布局无可见漂移。 |
| Work / Life 灰度家族感 | — | `cross-theme/{work,life}-grayscale-1536x1024.png` | Sidebar、Header、Tab、控件和卡片几何属于同一系统；明暗、密度和材质差异仍明确。 |
| Vision / AI / System 特色 | 各 Phase 4—6 验收目录 | `cross-theme/{vision,assistant,system}-1536x1024.png` | Vision 远景、AI 智能活动、System Matte 均保留，没有被统一换色或换背景。 |

## 可重复验证

```bash
pnpm test:e2e:v2-cross-theme
```

专用 E2E 使用端口 `43129` 与隔离数据目录 `test-results/v2-cross-theme/data`，生成六空间 1536×1024 彩色截图、Work / Life 灰度截图和 `cross-theme-metrics.json`。

## 验证结果

- Phase 7 E2E：6/6 通过；六空间页面身份、Theme、导航结构、焦点、Dialog、图标、几何、console、错误层和页面级横向溢出通过。
- Foundations / Today 保护 E2E：5/5 通过；保护断言按空间验证可感知的 Field / Surface 分离，不再强制所有 Theme 使用同一明暗方向，从而保留各空间既有材质层级。
- 内置浏览器：1536×1024 依次 Today → Work → Life → Vision → AI → System → Today，焦点保留在目标导航，Theme 映射正确，console warning / error 为 0；全局搜索在 Today 上使用 System Surface、Lucide Search 且输入框自动聚焦；1100×900 Today 无页面级横向溢出。
- 人工视觉：使用 `view_image` 同轮检查阶段前 / 后 Today、Work、Life，以及 Vision、AI、System 和 Work / Life 灰度证据；未发现背景、情绪、材质、业务内容或页面骨架被统一化破坏。
- Above-the-fold copy diff：除 Today 新增显示既有“快速记录 / 全局搜索”导航操作外，没有新增、删除、重命名或重排页面正文。

## 证据

- 彩色截图：本目录 `{today,work,life,vision,assistant,system}-1536x1024.png`
- 灰度截图：`{work,life}-grayscale-1536x1024.png`
- 指标：`cross-theme-metrics.json`
- 自动化：`apps/web/e2e/v2-cross-theme.spec.ts`

## 遗留事项

- Edge、200% 缩放、全量异常数据状态与最终跨浏览器发布门禁按计划留在 Phase 8。
- Today 1100px 继续使用其已验收的图标侧栏响应式变体；桌面宽度下与其他空间保持完整导航对等。
