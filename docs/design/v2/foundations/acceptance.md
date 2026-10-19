# V2 美术改进 Phase 1 验收

> 日期：2026-08-23  
> 范围：全局 Token、五空间 Theme、共享视觉基础、System Surface、Today 保护边界  
> 结论：Phase 1 通过；可以进入 Phase 2

## 1. 实现范围

- 建立字体、字号、间距、圆角、描边、语义色、层级和动效 Token。
- 建立 Work / Life / Vision / AI / System 五套精确主题映射，并由 AppShell 根据当前路由输出 `data-theme`。
- 建立 Button、Input、Select、Tabs、Badge、List Row、Dialog、Drawer、Form 与 Empty / Error / Loading State 的深色共享视觉基础。
- 快速记录和全局搜索固定使用 System Surface；所有主题补齐 `focus-visible`、禁用、错误和 `prefers-reduced-motion` 状态。
- 新增页面 CSS 直接色值静态审计，阻止后续页面样式绕开主题 Token。

## 2. 自动化结果

| 检查 | 结果 |
|---|---|
| AppShell 主题路由 + LoadingState 单元测试 | 17/17 通过 |
| V2 Foundations 隔离 Playwright | 4/4 通过，端口 43123 |
| 页面 CSS Token 静态审计 | 通过，0 个违规页面样式 |
| 全仓 ESLint | 通过，0 warning |
| 11 包 TypeScript | 通过 |
| 全仓 Vitest | 257 项通过，2 项按设计跳过 |
| Contracts | 通过 |
| 11 包 production build | 通过；保留既有主 chunk 大于 500 kB 提示 |
| Launcher Release build | 通过，0 warning / 0 error |

V2 Foundations 用例覆盖六个代表路由的主题属性、标题、控制台错误和横向溢出；覆盖跨主题快速记录/全局搜索的 System Surface、焦点和 Escape；覆盖 Today 三档视口保护。

## 3. 视觉与交互证据

基准视口为 1536×1024，Today 扩展视口为 1654×960、1920×1080，DPR 1。对比依据为 Phase 0 的 V1 事实基线与当前 Today V1 校准截图。

- 六空间：`today-1536x1024.png`、`work-1536x1024.png`、`life-1536x1024.png`、`vision-1536x1024.png`、`ai-1536x1024.png`、`system-1536x1024.png`
- System Surface：`quick-capture-work-1536x1024.png`、`search-ai-1536x1024.png`
- Today 保护：`today-protection-1536x1024.png`、`today-protection-1654x960.png`、`today-protection-1920x1080.png`

以上 Fixture 均位于本目录。目视复核确认五空间可辨、文本和控件可读、焦点清晰、弹窗为统一深色 System Surface；修复了首轮检查发现的 Inbox 白色详情面板与 Vision 白色看板卡残留。

Today 与 Phase 0 基线的像素差异只出现在实时钟和动态媒体区域；1536 与 1920 的变化像素占比分别约 0.50% 和 0.34%，未发现布局、共享控件或主题样式侵入。三档均无横向溢出。

## 4. 功能冻结结论

本阶段只增加展示层主题与共享样式。路由、导航、快捷键、Dialog/Drawer 行为、API 请求、数据关系、权限和风险确认协议均未修改。43123 使用独立测试数据目录，未连接或改写 43120 用户实例。

## 5. 遗留事项

- Edge 跨浏览器视觉验收按实施计划留到最终阶段。
- Phase 0 已登记的 7 项旧 Today V2 Canvas/WebGL 测试债与本阶段无关。
- 全仓 Prettier 仍受 8 份既有 Today V3 metrics JSON 格式状态影响；本阶段新增/修改的代码与文档将单独通过格式检查后交付。
