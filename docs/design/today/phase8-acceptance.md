# Today V2 Phase 8 验收记录

> 日期：2026-08-21  
> 固定视口：1536 × 1024，DPR 1  
> 时区：Asia/Shanghai  
> 当前状态：通过

## 1. 验收依据

- `今日界面_V2_开发执行计划.md` 第 15、18 节。
- `今日沉浸式界面独立重构设计书.md` 第 8–10、13 节。
- 概念参考：`docs/design/today/concept-reference.png`。
- 发布候选：`docs/design/today/00-phase8-release-candidate.png`。
- 确定性状态：`docs/design/today/fixtures/manifest.json` 与六组 JSON/PNG。

## 2. 发布门槛结果

| 门槛 | 证据 | 结果 |
| --- | --- | --- |
| 连续 Today Scene | 固定视口截图；Scene 五层 DOM 断言 | 通过 |
| 环境无明显矩形硬边 | 单一椭圆 mask；发布候选人工并排检查 | 通过 |
| 动态水体所有权 | 环境层与 Canvas 层独立；关闭 Canvas 无完整主喷泉 | 通过 |
| 四压力等级可辨 | relaxed / comfortable / elevated / high reduced-motion 静态帧互不相同 | 通过 |
| 压力—时间—Cursor—时间轴中轴 | 轴、五刻度、连续区段与 Cursor E2E | 通过 |
| 状态浮层与 Plan Rail | 当前领域文字标识、主次层级、Rail 内滚动 | 通过 |
| Today AI 真实发送 | 明确默认 Provider、真实 session/run、失败重试 | 通过 |
| 非主视口与 200% 缩放 | 1024×900、720×1000、768×512 | 通过 |
| 键盘与焦点 | 时间块、压力因素、添加 Overlay、焦点返回与焦点循环 | 通过 |
| 动效与性能降级 | reduced-motion 静态帧；hidden 暂停；低性能模式 | 通过 |
| 功能回归 | Today E2E + M1–M8 纵向业务流，共 22 项 | 通过 |
| 全仓单元/集成测试 | 58 个测试文件通过，198 项通过，2 项手动测试按配置跳过 | 通过 |

## 3. 状态矩阵

| 状态 | 覆盖位置 |
| --- | --- |
| 低压力、工作日 | `1-workday-relaxed` |
| 高压力、工作密集、任务密集 | `2-high-pressure` |
| 生活密集 | `3-rest-day` |
| 睡眠不足 | `4-sleep-deprived` |
| 任务为空、空闲充足 | `5-empty` |
| 正常压力、进行中状态 | `6-in-progress` |
| 当前任务结束边界 | `today-scene-view-model.test.ts` 的 end-exclusive 边界测试 |
| 长标题、长压力因素、右栏长列表 | Phase 8 768×512 E2E |
| 无天气 | 六组 Fixture 均使用明确不可用状态 |

## 4. 动态、无障碍与性能证据

- 页面隐藏后 Canvas 状态切换为 `hidden`，连续帧保持一致；恢复后回到 `running`。
- `navigator.hardwareConcurrency <= 4` 时使用 `low` 模式，降低 DPR 与粒子数量。
- `prefers-reduced-motion` 下停止连续位移，四种压力仍保留不同静态构图。
- `SmoothValue` 在 600ms 内连续抵达目标；中途重定向从当前值续接，不产生跳变。
- 完成当前任务后 Today 压力与计划数据原位更新，喷泉 Canvas 保持同一实例。
- 添加事项 Dialog 限制 Tab 焦点在 Overlay 内，Escape 关闭并返回触发按钮。
- 压力因素支持 Escape 关闭并返回触发按钮，不改变主场景几何。
- 768×512 等效 200% 缩放下无页面横向溢出，添加任务仍可完成。
- 本地固定数据截图的 `domContentLoadedEventEnd` 约为 176–235ms；构建仍提示主 JS chunk 约 926kB，列为后续代码分包优化项，不阻断本次 Today V2 验收。

## 5. 视觉差异台账

| 参考图差异 | 处理或决策 |
| --- | --- |
| 概念图包含真实天气与农历 | 无天气时明确显示不可用；农历保持 P2，不伪造数据 |
| 概念图水体更接近摄影材质 | 当前 Canvas 2D 保证状态所有权和连续结构；更精细折射、水雾保持 P2 |
| 概念图侧栏含头像与辅助文字 | 保留现有导航业务结构，只应用 Today 独立主题 |
| 发布候选的完成项更克制 | 提高到仍可读的 0.64 opacity，同时保留完成态弱化 |

## 6. 验证命令

```text
pnpm build
node scripts/today-visual-qa.mjs --phase8
pnpm exec playwright test apps/web/e2e/today-v2.spec.ts apps/web/e2e/app-shell.spec.ts
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

内置浏览器无法访问测试进程的 `127.0.0.1:43120`，返回连接拒绝；渲染与交互证据因此使用仓库 Playwright Chromium 流程。该流程固定数据、时间、视口和截图位置，且不读取真实个人数据。

## 7. 结论

Today V2 的 P0 发布门槛、Phase 7 P1 质量门槛与 Phase 8 工程质量门槛均已通过。天气真实适配、农历、更精细折射/水雾、手动低性能模式和 Today 内完整对话抽屉继续保持为 P1/P2，不作为已实现能力声明。
