# Phase 6 — System Theme 验收

基准：`生活助手 V2 美术改进实施计划 V2` Phase 6 与 `生活助手 V2 美术设计规范 V2` 的 System Theme。

## 实施范围

- Inbox：待处理内容优先、四步处理路径、列表与详情选中层级。
- Data：数据状态、目录、备份、数据库、版本、回收站、恢复和演示数据；危险操作独立置底。
- Reminders：按今天 / 更早分组，以文字和结构区分未读、即将到来、逾期与已读。
- Utility：设置页与初始化页保持 System Matte 兼容；快速记录和搜索继续使用 `data-surface="system"`。

## 可重复验证

```bash
pnpm test:e2e:v2-system
```

命令会生成四档桌面视口的 Inbox、Data、Reminders、Settings 截图，以及 `metrics.json`。功能回归覆盖 Inbox 处理、回收站恢复与永久删除、提醒已读与稍后提醒、对象跳转链接。

## 证据

- 截图：本目录下 `{page}-{width}x{height}.png`
- 指标：`metrics.json`
- 自动化：`apps/web/e2e/v2-system.spec.ts`
