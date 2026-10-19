# V2 新计划 Phase 0 · Rebaseline Manifest

> 日期：2026-08-25  
> 最高依据：根目录《生活助手 V2 美术设计规范 V2》  
> 执行计划：根目录《生活助手 V2 美术改进实施计划 V2》  
> 状态：Phase 0 已签核；可以进入 Phase 1

## 1. 历史材料状态

以下文件和目录保留用于说明实现历史，不再作为新版视觉通过依据：

- 根目录《生活助手 V2 美术改进实施计划》
- `docs/design/v2/baseline/`
- `docs/design/v2/foundations/acceptance.md`
- `docs/design/v2/work/acceptance.md`
- `docs/design/v2/life/acceptance.md`
- 上述旧验收引用的《生活助手 V2 美术设计规范 V1》结论

旧材料不得删除或覆盖。功能冻结、隔离数据、路由身份和可重复测试资产可以继承；颜色、明度、材质、环境层、字号和心理感受必须依据新版规范重新验收。

## 2. 基准参数

- 主基准：1536×1024，DPR 1。
- 扩展基准：1366×768、1920×1080、1100×900，DPR 1。
- 浏览器：Desktop Chrome channel。
- 动效：截图时启用 `prefers-reduced-motion: reduce`，保留静态环境。
- 服务端口：43126。
- Bootstrap：`test-results/v2-rebaseline/bootstrap.json`。
- 数据目录：`test-results/v2-rebaseline/data`。
- 用户实例：不得连接或修改 43120 及其数据目录。

## 3. 路由范围

1536×1024 捕获当前全部 16 个路由：

- Today：今日。
- Work：总览、自媒体、开发项目、学习。
- Life：总览、购物、饮食、健身、娱乐。
- Vision：计划与目标。
- AI：AI 助手。
- System：收集箱、数据管理、提醒中心、设置。

其余三档视口各捕获 Today、Work、Life、Vision、AI、System 六个代表路由。

## 4. 预期证据

- 初始化流程截图：3 张。
- 1536×1024 全路由截图：16 张。
- 三档扩展视口六空间截图：18 张。
- 布局 metrics：4 份 JSON。
- 合计：37 张 PNG + 4 份 JSON。

## 5. 自动化入口

```bash
pnpm test:e2e:v2-rebaseline
```

测试必须检查页面标题、`data-theme`、非空渲染、Vite Error Overlay、console warning / error、页面异常、布局 metrics，以及导航、快速记录、全局搜索和 Today 时间轴的冻结流程。

初始化完成前，未配置 Shell 会探测业务接口并产生资源 500；该行为记录为现状，不作为已配置应用的控制台结论。完成初始化后必须刷新页面，并从零重新检查 console warning / error。

## 6. 签核记录

### 自动化结果

- `pnpm test:e2e:v2-rebaseline`：6/6 通过，串行运行约 40.2 秒。
- 生产构建：由 Playwright `webServer` 在本次运行中执行并成功启动 43126。
- 页面身份：全部受测路由标题与 `data-theme` 一致。
- Framework Error Overlay：0。
- 已配置应用 console warning / error 与 page error：0。
- 导航、快速记录、Escape 关闭、全局搜索与 Today 时间轴冻结流程：通过。

### 证据结果

- PNG：37 张。
- Metrics JSON：4 份。
- 1536×1024：16 个路由，页面级横向溢出 0。
- 1366×768：6 个代表空间，页面级横向溢出 0。
- 1920×1080：6 个代表空间，页面级横向溢出 0。
- 1100×900：6 个代表空间，页面级横向溢出 0。

### Browser Harness 交互复核

- 浏览器：独立 Chrome for Testing 自动化实例。
- CDP：`127.0.0.1:9333`。
- 应用：隔离实例 `http://127.0.0.1:43126`。
- 路径：`/work` → 点击“生活” → `/life` → 打开“快速记录” → Escape 关闭。
- 结果：Work / Life 页面 H1 与 Theme 正确；两页 overflow 为 0；无 Vite Error Overlay；Dialog 打开后焦点进入“记录内容”，Escape 后 Dialog 数量为 0。
- 记录：`C:\Users\Administrator\.config\browser-harness\agent-workspace\recordings\v2-rebaseline-phase0`，5 帧。
- 限制：单独调用 browser-harness `capture_screenshot()` 超时；本阶段正式截图证据由已通过的项目 Playwright 产出，browser-harness 记录用于交互复核。

### 人工视觉审计

- Today：当前独立 Scene Theme 构图、侧栏、主场景、计划区、时间轴和 Composer 均完整，无明显裁切或共享样式侵入。
- Work：网格和主次结构可继承；背景仍偏深绿黑且环境层次平，尚不符合新版冷晨雾与自然光要求。
- Life：当前仍为深鼠尾草视觉，与新版 Morning Sage Theme 直接冲突，Phase 3 必须重建。
- Vision：四视图功能存在，但双创建表单和重型列容器压过 Workspace，尚未形成 Air Glass 与空间距离层级。
- AI：当前为空状态记录列表式页面，尚未形成 Session List + Main Conversation、AI 文档流和 Operation Card。
- System：功能结构可用，仍需迁移和收束为可靠、克制的 Matte 层级。

### Phase 0 结论

Phase 0 仅新增新版计划的测试编排、隔离证据与审计文档，未修改生产页面、业务逻辑、API、数据库、数据映射或生产资源。当前截图是 Phase 1 之后的对比起点，不代表 Work、Life、Vision、AI、System 已符合新版视觉规范。
