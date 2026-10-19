# 生活助手 V2 — Phase 1 Theme Foundation V2 验收

日期：2026-08-25  
依据：《生活助手 V2 美术设计规范 V2》《生活助手 V2 美术改进实施计划 V2》  
状态：通过，可以进入新版 Phase 2 Work Rebaseline

## 本阶段边界

Phase 1 只重建跨空间 Foundation：Typography、语义状态色、Theme 角色、Field / Focus、共享控件状态和 Atmosphere 宿主。业务数据结构、接口、路由信息架构和 Today Scene Theme 未修改。

Life 已从旧深鼠尾草切换为浅色 Morning Sage Foundation，以证明共享组件可在浅色环境成立；完整晨光、薄雾、丁达尔光和页面级构图仍属于 Phase 3。Work 本阶段只建立冷青灰 Token 与环境宿主，完整玻璃、冷雾、环境光和页面材质校准属于 Phase 2。

## 已实现契约

- Typography：H1 32px / 600、H2 23px / 600、H3 18px / 600、Important Body 16px、Body 14px、Secondary 13px、Meta 12px。
- Semantic Colors：success `#6FCF9D`、warning `#E4AE61`、danger `#E26D70`、info `#76B4E5`；旧 `--color-*` 仅保留为兼容映射。
- 五个非 Today Theme 均具备 Surface、Elevated、Field、Field Hover、Field Border、Focus Border、Accent Hover、环境光、阴影、色彩模式和动效时长角色。
- Work / Vision / AI / System 的 Field 明度高于 Standard Surface；Life 的 Field 略深于 Soft Fog Surface。Playwright 使用真实计算样式比较明度方向。
- Button 的 Primary / Secondary（基础 `.button`）/ Ghost / Danger 具备 Default、Hover、Active、Focus、Disabled 与 Error 规则；表单具备统一高度、圆角、Hover、Focus、Invalid 与 Autofill 规则。
- Atmosphere 作为 `main.content` 内不可交互、不可聚焦、位于业务内容之后的共享 DOM 层；System 保留宿主但关闭显示。`prefers-reduced-motion: reduce` 后停止环境动画并保留静态背景。
- 快速记录和搜索继续使用一致的 System Surface；Sidebar 信息架构、快捷入口与 Active State 位置未改变。
- CSS 直接色值审计从 Work / Life 页面扩展至 `styles/components` 与 `styles/pages` 共 9 个样式文件。

## 自动化结果

- `pnpm test:e2e:v2-foundations`：5 / 5 通过。
- 六类路由 `data-theme` 正确；1536×1024 下横向溢出均为 0。
- 非 Today Theme 的 Atmosphere 均存在且 `pointer-events: none`；Life 计算色彩模式为 `light`，其他非 Today Theme 为 `dark`。
- System Surface 在六类 Theme 中背景一致；快速记录焦点与 Escape 关闭、全局搜索焦点与 Escape 关闭均通过。
- Today 1536×1024、1654×960、1920×1080 三档保护回归通过；与 Phase 0 图像对照只见实时钟和时间轴游标变化，未见非动态区域侵入。
- `pnpm lint`、`pnpm audit:v2-css`、11 包 `pnpm typecheck`、257 项测试（另 2 项按设计跳过）、11 包 `pnpm build` 通过。
- Build 保留既有主 JS chunk 大于 500kB 警告；本阶段未增加视觉运行时依赖。

## 视觉与交互证据

- 基准视口：1536×1024，DPR 1。
- Today 保护扩展视口：1654×960、1920×1080。
- 最终截图使用 `*-phase1-*` 文件名；首轮无后缀截图保留为同阶段过程证据，没有覆盖旧 `docs/design/v2/foundations/**`。
- 布局与主题指标：[foundation-metrics.json](./foundation-metrics.json)。
- 正式对比依据：`../work-life-color-masters-v2/work-theme-master-v2-1536x1024.png`、`../work-life-color-masters-v2/life-theme-master-v2-1536x1024.png`。
- Browser Harness：独立 Chrome for Testing，CDP 端口 9333；验证 Work → Life → 快速记录 → Escape，录制位于 `C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\v2-foundations-phase1`，共 8 帧。

## 阶段遗留

- Work 当前页面级环境光、Standard / Elevated Glass 与模块微 Accent 尚未达到正式母版，转入 Phase 2。
- Life 当前已具备正确浅色明度关系，但完整四层环境、抽象自然空气感和页面密度重建转入 Phase 3。
- Vision、AI、System 的页面级视觉重建分别留给 Phase 4、Phase 5、Phase 6。
- 本阶段不把上述页面级差异写成已完成。
