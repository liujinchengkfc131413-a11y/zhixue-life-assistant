# V2 RC2 发布就绪记录

日期：2026-09-07。目标标签：`v2.0.0-rc.2`。当前状态：RC2-03 已修复，全仓、双浏览器和发布包门禁通过，结论为 READY FOR RC。

## 范围

功能基线为《产品需求与系统架构设计书》，其次为《数据库与API详细设计书》。A1–A21 已有关闭证据，本轮仅收口发布范围、整理历史状态、执行验证并固定候选版本；不改变视觉、主题、布局或资源。

候选版本沿用 rc.1 约定：以 Git 标签标识，包内历史 `0.1.0` 字段保持不变。便携包清单的 Git commit 与 schemaVersion 用于精确识别构建。

不纳入功能修复提交且保留原样：用户已有美术规范 `生活助手 V2 美术设计规范 V2.md`、`docs/design/v2/work-life-color-masters-v2/README.md`、API 排查文本，以及 `.codex/local-preview` 本地预览数据。不得使用清理或还原工作树的方式处理这些文件。

## 验收依据与执行状态

- 历史 A21：Chrome 152.0.7977.82、Edge 151.0.4129.107 各 73/73；原始证据位于 `artifacts/a21/a21-browser-acceptance.md`。
- 本轮全仓 `pnpm verify`：退出码 0；106 个测试文件通过、3 个门控文件跳过，450 项测试通过、7 项跳过；格式、Lint、CSS audit、11 包类型检查、契约、11 包构建和 Launcher Release 构建通过。日志 `.codex/rc2-verify.log`。
- RC2-03 后最终全仓 `pnpm verify`：退出码 0；106 个测试文件通过、3 个门控文件跳过，450 项测试通过、7 项跳过；格式、Lint、CSS audit、11 包类型检查、契约、11 包构建和 Launcher Release 构建通过。日志 `.codex/rc2-final-verify.log`。
- RC2-03 后最终浏览器回归：Chrome 152.0.7977.82 与 Edge 152.0.4191.66 使用同一隔离编排，各 73/73，失败 0、跳过 0。日志 `.codex/rc2-final-chrome.log`、`.codex/rc2-final-edge.log`。
- 功能收口提交：`f83a9f89af07870e1c5363b13b3d0567bfa3d868`；RC2-03 修复提交在最终文档 amend 前为 `06ebad6d5d73514190268d33070b723ff2db77ea`。最终候选由 `v2.0.0-rc.2^{commit}` 唯一定位，分支 `codex/v2-rc2-release`。
- 自包含 Launcher publish、便携包构建、`release:verify`、`release:clean-check`：均退出码 0。`06ebad6` 产物为 60 文件、约 297 MB、Schema 21；完成 SHA-256/隐私/源码路径检查、私有 Node 启动、初始化、创建任务、备份、诊断、静态页面、Launcher 二次启动及单实例检查。本文随修复提交 amend 后将用最终 tag commit 重跑同一发布包门禁，命令失败则不得创建标签。
- 旧发布目录保留为 `distribution/LifeAssistant-0.1.0-before-rc2-20260906`；新包为 `distribution/LifeAssistant-0.1.0`。最终标签前将按最终提交重新生成清单并校验。
- Schema 019/020/021：既有 Blocker 修复迁移，本轮不新增业务 migration。
- 真实外部 Provider smoke：本轮未执行；已有 2026-08-29 DeepSeek 真实只读工具链记录。OpenAI 手工 smoke 为 PRD §13.2 明示的可选验证，门控跳过不得表述为通过；本地 HTTP/SSE 证据仅证明本地协议链。

## 发布结论与遗留边界

- PRD Blocker：0；Recommendation：READY FOR RC。
- 最终候选定位：`git rev-parse v2.0.0-rc.2^{commit}`；便携包 `distribution/LifeAssistant-0.1.0` 的 `app/package-manifest.json` 必须记录同一提交。
- 已保留旧包：`distribution/LifeAssistant-0.1.0-before-rc2-20260906`。
- 未执行真实全新 Windows 虚拟机验收；`release:clean-check` 是本机仓库外隔离安装模拟。
- 本轮未执行真实外部 Provider：OpenAI 1 项与 DeepSeek 5 项按凭据门控跳过；另有性能基准 1 项未运行。已有 2026-08-29 DeepSeek 真实只读工具链历史证据，但不冒充本轮结果。
- 未改视觉、主题、布局、CSS 或媒体资源。用户美术文档、本地预览数据库和 API 排查文本保留在工作树中，不属于 RC2 提交。

## RC2-03 门禁发现与修复

Edge A8 在首次启动最后按钮处超时。复现时尚未点击完成按钮就已进入 Today，原因是第六步“继续”与第七步 submit 复用同一 DOM 按钮，点击中更新类型后触发表单默认提交。SetupPage 的“继续”处理器显式 `preventDefault()`，避免提前初始化；不改变界面外观或七步流程。

共享 E2E helper 必须看到“准备完成”且服务端仍未初始化，再点击完成按钮；A8 复用此 helper，组件测试增加最终点击前零初始化断言。旧构建运行新断言失败（`.codex/rc2-setup-red.log`），失败页面快照已是 Today；修复后 Edge A8 定向通过（`.codex/rc2-setup-green.log`），随后全仓与 Chrome/Edge 同套门禁全部通过。原 `f83a9f8` 便携包仅作为中间证据，最终包在最后提交后重建。

## 验证边界

`release:clean-check` 是本机仓库外目录的隔离安装模拟，不能代替全新 Windows 虚拟机验收。真实虚拟机尚无本轮证据；不将此项写成已完成。外部 Provider 的本轮门控跳过项为 OpenAI 1 项、DeepSeek 5 项，另有性能基准 1 项未运行。
