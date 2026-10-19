# LifeAssistant V2 RC4 Release Notes

版本：`v2.0.0-rc.4`

RC4 修复 Windows x64 发行包在已有用户数据库上的冷启动阻断：

- 精确兼容已确认的 migration 20 历史校验值，未知 migration drift 仍拒绝启动；
- 修复已有 Schema 20 数据库导致 packaged backend 在 HTTP bind 前退出的问题；
- Launcher 仅在 health/READY 后打开浏览器，并持久记录脱敏启动日志及 child 输出/退出；
- 最终 artifact 门禁新增历史数据库 cold-start、未知 drift 拒绝和 bootstrap 隔离验证；
- 正式 release build 在 dirty worktree 下默认失败，artifact metadata 记录 RC4 产品版本、commit 与构建时间。

`v2.0.0-rc.3` 及其 Windows x64 artifact 已废弃，不得继续分发。
