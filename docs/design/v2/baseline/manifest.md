# V2 Phase 0 视觉基线清单

> 主视口：1536×1024 CSS px  
> 补充视口：1366×768、1920×1080、1100×900 CSS px  
> DPR：1  
> 浏览器：项目 Playwright 配置选择的 Chrome；Edge 在最终验收阶段复核  
> 数据：`test-results/v2-visual/data` 隔离目录中的演示数据  
> 动效：`prefers-reduced-motion: reduce`，用于稳定基线；动效行为由独立测试保护

## 生成方式

```bash
pnpm test:e2e:v2-baseline
```

该命令使用独立端口 `43121` 和独立 bootstrap/data 目录，不读取或写入用户正式数据目录。

## 本次采集结果（2026-08-23）

- Playwright：6/6 通过，共 48.5 秒。
- 产物：Setup 3 张、1536×1024 全路由 16 张、补充视口核心六空间 18 张、布局指标 4 份。
- 交互：快速记录、全局搜索、跨空间导航、返回 Today 均通过。
- 控制台：全路由自动化采集期间未捕获 `console.error`。
- 目视抽检：Today、Work Overview、Life Overview、Plans & Goals、AI、Inbox 六空间页面身份和主要内容有效。
- 既有问题：`/work/learning` 在 1536×1024 下 `scrollWidth=1745`，横向溢出 209px；登记为 V1 基线缺陷，留待对应 V2 页面阶段处理。

全量既有 E2E 可使用 `pnpm test:e2e:isolated` 在独立端口 `43122` 执行，避免复用正在运行的 43120 用户实例。

### 改造前验证债登记

- `pnpm verify` 的首个 `format:check` 被 8 份既有 `docs/design/today/v3/phase2`–`phase9/metrics.json` 格式状态拦截；本轮文件定向 Prettier 通过，其余 lint、typecheck、test、contracts、build、Launcher build 独立通过。
- `pnpm test:e2e:isolated` 固定单 worker 后为 21/28 通过。7 项失败全部位于 `apps/web/e2e/today-v2.spec.ts`，仍寻找已停运的 `[data-fountain-layer="dynamic-water"]`、`webgl-water` 或旧 `grid-template-areas`。
- 当前 Today Scene / V3 的 6 项视频、失败回退、业务流、生命周期与多视口用例单 worker 复核 6/6 通过，因此上述 7 项登记为改造前测试债，不归因于 V2 美术实施。

## Setup 基线

- `setup-step1-1536x1024.png`
- `setup-step2-1536x1024.png`
- `setup-step3-1536x1024.png`

## 1536×1024 全路由基线

- `today-1536x1024.png`
- `work-overview-1536x1024.png`
- `work-self-media-1536x1024.png`
- `work-development-1536x1024.png`
- `work-learning-1536x1024.png`
- `life-overview-1536x1024.png`
- `life-shopping-1536x1024.png`
- `life-diet-1536x1024.png`
- `life-fitness-1536x1024.png`
- `life-entertainment-1536x1024.png`
- `plans-goals-1536x1024.png`
- `assistant-1536x1024.png`
- `inbox-1536x1024.png`
- `data-management-1536x1024.png`
- `reminders-1536x1024.png`
- `settings-1536x1024.png`

## 多视口六空间基线

Today、Work Overview、Life Overview、Plans & Goals、AI、Inbox 分别生成：

- `*-1366x768.png`
- `*-1920x1080.png`
- `*-1100x900.png`

## 判定要求

- 页面标题与 URL 对应。
- 页面不是空白页，无 Vite/React 错误覆盖层。
- 横向溢出数值记录在 `metrics-*.json`；既有溢出作为 V1 基线问题登记，V2 对应页面阶段修复。
- 自动化采集期间无 `console.error`。
- 快速记录、搜索、跨空间导航和返回 Today 的交互基线通过。
- 本目录图片仅是 V1 改造前事实基线，不是 V2 目标设计稿。
