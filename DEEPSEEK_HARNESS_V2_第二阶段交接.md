# DeepSeek Harness 交接：V2 第二阶段回归与 RC 终验

> 交接日期：2026-08-29
> 当前阶段：第二阶段实现与 `pnpm verify` 已收口；剩余为完整隔离 E2E 矩阵、独立 Chrome Browser Harness 终验、工作区污染复核和 RC 最终判断。

## 1. 不可改变的产品与设计边界

1. V2 产品设计已冻结：不增加功能、不重新设计 UI、不做无必要的大重构。
2. 功能优先级以根目录 `产品需求与系统架构设计书.md`（PRD）为最高。
3. 测试总入口与验收口径以 `生活助手 V2 全量功能验收与回归测试.md` 为准。
4. 实现前还需结合 `README`、`修改日志.md`、当前代码结构和已有测试理解现状。
5. 设计资料至少包括：
   - `数据库与API详细设计书.md`
   - `Today Scene 最终集成执行方案：底图 + 状态视频 + UI.md`
   - `今日沉浸式界面独立重构设计书.md`
   - `生活助手 V2 美术设计规范 V2.md`
6. 美术与视觉冲突时，以 `Today Scene 最终集成执行方案：底图 + 状态视频 + UI.md` 和 `生活助手 V2 美术设计规范 V2.md` 为最高优先级。
7. Today 的正式架构是“环境底图 + 双槽状态视频 + UI Overlay”，不是旧 Canvas/WebGL/Grid。
8. 全局 Sidebar 冻结为 248px；Today 媒体最终使用 106.66% 预扩展、`-11cqw` 横移、0.94 缩放，实际包围盒轴约为 -0.118。不要为旧 240px / -0.11 断言移动 UI。
9. 390px 移动端不属于 V2 范围；不要扩展移动端响应式开发。
10. 仓库任何文件变更必须同步追加根目录 `修改日志.md`。

## 2. 本轮已经完成的修改

### P1：Today 自动排程

- `packages/scheduler/src/schedule-service.ts`：当天可用区间的起点增加 `schedulingFloor`，由注入时钟向上取整到 15 分钟网格；新任务不会排入当前时刻之前。
- 当前时间恰好在网格点时允许从当前点开始。
- `apps/server/test/m2.integration.test.ts`：新增 01:42 → 01:45、精确 01:45 → 01:45 两组边界用例，并断言排程起点不早于当前时间。

### P1：verify 与临时数据隔离

- `.gitignore`、`.prettierignore`、`eslint.config.mjs` 已排除 `.codex/tmp`，不会通过修改 Chrome 或 Browser Harness 环境规避检查。
- `.prettierignore` 额外排除自动生成的 `docs/design/v2/**/*metrics*.json`；这些 tracked 视觉指标只应在显式基准更新时改写。

### E2E 基础设施

- 新增 `apps/web/e2e/evidence-directory.ts`：普通测试把截图/指标写到 `test-results/evidence`；只有 `LIFE_ASSISTANT_UPDATE_BASELINES=1` 时才写 `docs/design`。
- 新增显式命令：
  - `pnpm test:e2e:v2-baseline:update`
  - `pnpm test:e2e:v2-rebaseline:update`
- `playwright.config.ts` 默认排除 `v2-*.spec.ts`，核心 E2E 不再错误复用专项 fixture/bootstrap。
- 新增 `scripts/run-isolated-e2e.mjs`：`pnpm test:e2e:isolated` 先构建一次，再按独立 bootstrap、服务端口与 Playwright config 顺序执行核心及 V2 专项；普通 `v2-rebaseline` 不在默认矩阵内。
- 所有 Playwright config 支持 `LIFE_ASSISTANT_E2E_SKIP_BUILD=1`，仅 isolated 编排用来避免重复构建；单独运行专项仍默认先构建。

### 旧测试迁移与 P3

- `apps/web/e2e/{today-v2,today-scene-video,today-v3-phase7}.spec.ts` 已从旧 Canvas/WebGL/Grid 断言迁移到最终底图、状态视频、Overlay、降动效、页面可见性暂停/恢复、媒体节点不重挂载和冻结桌面几何。
- `apps/web/e2e/app-shell.spec.ts` 已适配 Settings 八分区、Vision 新建弹层、Life 浏览/创建/管理 Drawer，以及 Today 计划区可能同时呈现主计划与“即将开始”摘要的真实结构。
- `apps/web/src/styles/foundations/themes.css`：Work `--field-border` 从 30% 改为冻结规范要求的 15%。
- `apps/web/src/styles/today-immersive.css`：AI Provider 配置提示的外偏移从 3px 收为 1px，并设 `line-height: 1`；1536×1024 测试要求提示底边不超过 1016px，保留至少 8px 安全余量。

## 3. 已取得的验证结果

- `pnpm verify`：完整通过。
  - Prettier、ESLint、V2 CSS audit 全绿。
  - typecheck：11/11 包通过。
  - Vitest：68 个文件通过、2 个按设计跳过；264 项通过、2 项按设计跳过。
  - contracts check 通过。
  - production build：11/11 包通过。
  - Launcher Release build：0 warning、0 error。
- Scheduler 定向集成：3/3 通过。
- 核心 E2E：Today/Scene 相关 27 项通过；更新后的 M1–M8 纵向 `app-shell` 主流程单独运行通过（28.1 秒）。两部分最终需要由完整 isolated 矩阵再统一确认。
- Today 1536×1024 AI 配置提示边界测试通过。
- Today V3 五档桌面几何定向测试通过；旧 8px/相对位置差异已判定为旧侧栏/媒体基线，不是产品视觉回归。
- `pnpm test:e2e:v2-work`：4/4 通过；普通证据写入 `test-results/evidence`，未更新 tracked baseline。
- 既有、非阻塞构建提示：Vite 主 chunk 大于 500kB。不要借本轮做代码分割重构。

## 4. 交给 DeepSeek Harness 的剩余工作

### A. 完整隔离 E2E 矩阵

从仓库根目录执行：

```bash
pnpm test:e2e:isolated
```

该命令应依次运行：核心 E2E、Foundations、Work、Life、Vision、Assistant、System、Cross-theme、Visual baseline verification。每组使用自己的 bootstrap 与端口，且只构建一次。

注意：

- 如果某条旧断言仍失败，先判断是否仍在验证旧 Canvas/WebGL/Grid、旧 240px Sidebar 或旧表单常驻结构；冻结实现正确时改测试，不改产品。
- 不要运行 `*:update`，除非用户明确授权更新 tracked 视觉基准。
- 普通测试结束后，`docs/design` 不应出现新 diff。
- 修复任何文件时必须同步更新 `修改日志.md`。

### B. 独立 Chrome + Browser Harness 终验

必须使用独立 Chrome，不要连接用户主 Chrome。要求：独立 `user-data-dir`、固定 CDP 9333、可见窗口、`--remote-allow-origins=*`。

PowerShell 启动示例：

```powershell
$qaProfile = Join-Path $env:TEMP ("life-assistant-dsh-chrome-" + [guid]::NewGuid())
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  -ArgumentList "--remote-debugging-port=9333","--remote-allow-origins=*","--user-data-dir=$qaProfile","--no-first-run","--no-default-browser-check"
```

本机 Windows 代理会影响 Python/urllib 连接本地 CDP。调用 Browser Harness 时必须设置：

```bash
NO_PROXY=127.0.0.1,localhost BU_CDP_URL=http://127.0.0.1:9333 browser-harness --doctor
```

启动 QA 服务时使用隔离 bootstrap。完整 core E2E 结束后通常可复用其已初始化的 `test-results/e2e/bootstrap.json`：

```bash
LIFE_ASSISTANT_BOOTSTRAP_PATH="D:/Documents/知雪的生活助手/test-results/e2e/bootstrap.json" \
LIFE_ASSISTANT_PORT=43150 \
node apps/server/dist/main.cjs
```

开始任何浏览器操作前必须 `start_recording(name, title=...)` 并保留返回的精确目录；结束时调用 `stop_recording()`。Browser Harness 首次导航使用 `new_tab("http://127.0.0.1:43150")`。元素交互优先使用 AX Tree → backend node box → 坐标点击，不要用主 Chrome。

至少覆盖：

1. Today 1536×1024：底图/状态视频/Overlay、无 Canvas、Plan/Timeline/AI 完整可见。
2. 无默认 Provider 时提示完整显示，底边至少留 8px；无横向/纵向意外溢出。
3. Today 添加任务 → 自动排程 → 编辑 → 完成 → 手动重排；新任务时间不得早于当前时间。
4. Today 状态视频切换期间 AI 输入不丢失，隐藏页签暂停、恢复后继续；reduced-motion 显示 master frame。
5. Work 字段边框 computed color alpha 为 0.15，并按冻结母版人工检查，不做再设计。
6. Vision “＋ 新建”目标/计划弹层、Life 创建/管理 Drawer、Settings 八分区主路径。
7. 1366×768 再做一轮桌面保护；不测 390px。
8. 全流程收集 console error、page error、未处理 Promise、失败网络请求和 Vite error overlay；目标均为 0（预期业务 4xx mock 需单独说明，不能混作 console error）。

### C. Git 污染与 RC 判断

1. 在完整 E2E 前后各执行 `git status --short`。
2. 源码改动本身尚未提交，所以“工作区干净”应理解为：前后只有本交接所列的预期源码/测试/日志变更，没有测试新增或覆盖 tracked screenshot、metrics、录制、Profile、数据库和临时文件。
3. `test-results`、`.codex/tmp` 与独立 Chrome Profile 必须保持 untracked/ignored；不要提交。
4. 若完整 isolated、Browser Harness、console/Promise 和污染检查全部通过，才可把 `修改日志.md` 的“V2 第二阶段回归”改为“已验收”，并给出 V2 Release Candidate = 满足。
5. 若仍有失败，输出精确用例、原因、是否产品缺陷/旧基线/环境限制；不要把部分通过写成全部完成。

## 5. 交接时的预期源码变更范围

预期包含以下类别；不要无差别回退：

- 调度：`packages/scheduler/src/schedule-service.ts`、`apps/server/test/m2.integration.test.ts`
- 忽略规则：`.gitignore`、`.prettierignore`、`eslint.config.mjs`
- E2E 编排：`package.json`、`scripts/run-isolated-e2e.mjs`、`playwright*.config.ts`
- E2E 证据与测试：`apps/web/e2e/evidence-directory.ts`、本轮修改的 core/Today/V2 spec
- P3 样式：`apps/web/src/styles/foundations/themes.css`、`apps/web/src/styles/today-immersive.css`
- 文档：`修改日志.md`、本交接文档

不要提交 `test-results`、`.codex/tmp`、Chrome Profile，普通回归不要改 `docs/design` tracked baseline。
