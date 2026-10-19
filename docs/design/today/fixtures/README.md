# Today V2 视觉基线 Fixture

`manifest.json` 是 Today V2 Phase 0 的唯一 Fixture 清单。它固定所有视觉基线的时区、视口、截图名称和状态覆盖范围；夹具 JSON 只承载 `GET /api/v1/today` 返回的业务数据，不包含真实个人数据。

## 使用方式

```bash
pnpm build
node scripts/today-visual-qa.mjs
pnpm exec playwright test apps/web/e2e/today-v2.spec.ts
```

视觉脚本会使用临时 bootstrap、临时数据目录和演示数据启动服务；每个 Fixture 又会 mock `GET /api/v1/today` 并冻结到其 `serverNow`。因此它不会访问正式 `bootstrap.json` 或用户 SQLite 数据库。

输出位置：

- `../00-phase0-current-baseline.png`：以 `6-in-progress.json` 渲染的当前实现稳定基线，不覆盖 `concept-reference.png`。
- 与每个 JSON 同名的 PNG：对应的确定性状态截图。
- Playwright 的性能采样和运行期截图：仅输出至 `test-results/`，不作为设计资产提交。

## Phase 0 状态覆盖

| 完成标准状态 | Fixture |
| --- | --- |
| 低压 | `1-workday-relaxed.json`、`3-rest-day.json`、`5-empty.json` |
| 正常压力 | `6-in-progress.json` |
| 高压 | `2-high-pressure.json` |
| 工作密集 | `2-high-pressure.json`、`4-sleep-deprived.json` |
| 生活密集 | `3-rest-day.json` |
| 睡眠不足 | `4-sleep-deprived.json` |
| 空闲充足 | `5-empty.json` |
| 任务为空 | `5-empty.json` |
| 任务密集 | `2-high-pressure.json`、`4-sleep-deprived.json` |
| 无天气 | 全部 Fixture（当前产品没有已授权天气源） |
| 进行中状态 | `6-in-progress.json` |

新增或调整 Fixture 时，必须同步更新 `manifest.json`、本表、`apps/web/e2e/today-v2.spec.ts` 的断言，并重新生成基线截图；不得以修改 `concept-reference.png` 的方式消除视觉差异。
