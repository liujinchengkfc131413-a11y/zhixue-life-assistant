# Today Scene 最终集成验收

日期：2026-08-23  
基准方案：`Today Scene 最终集成执行方案：底图 + 状态视频 + UI.md`  
基准视口：1536 × 1024

## 结论

最终场景已按方案完成集成。Today 主内容区由静态母版、A/B 双视频层、轻量环境统一层和原有 UI 层组成；旧 Canvas/WebGL 喷泉不再挂载。压力值驱动 Calm / Balanced / Busy / Intense 四档视频，跨档采用 1500ms 双视频交叉淡化，同档更新不触发切换。2026-09-14 根据首轮盲测录屏校准两组素材映射，未修改状态阈值或播放机制。

## 阶段验收

| 阶段 | 结果 | 验收摘要 |
|---|---|---|
| 1. 代码与素材审计 | 通过 | 四段素材均为 1152×768、24fps、H.264、无音轨；确认 `today.pressure.score` 为唯一状态输入 |
| 2. SceneBase + VideoLayer | 通过 | 静态母版与两条视频覆盖完整主内容区，使用同一 `object-fit: cover` / `object-position` |
| 3. Balanced 单态接入 | 通过 | 1536×1024 下媒体层边界为 x=240、y=0、1296×1024，未出现矩形素材边界 |
| 4. 四档映射 | 通过 | 0–24 Calm、25–49 Balanced、50–74 Busy、75–100 Intense；Calm / Balanced 与 Busy / Intense 两组素材映射按动态辨识结果分别互换；边界、越界钳制与四档素材对应共 17 项单元测试 |
| 5. 双视频交叉淡化 | 通过 | 1500ms ease-in-out；切换期间两条播放，稳定态一条；按归一化播放进度同步；快速连续切换以最新状态为准 |
| 6. 预加载与回退 | 通过 | 首态先加载，随后预载其余三态；视频失败保留静态母版；页面隐藏暂停、恢复可见继续；reduced-motion 使用静态母版 |
| 7. 停运旧渲染器 | 通过 | Today 运行态 Canvas 数量为 0；生产构建不再包含旧喷泉运行时入口 |
| 8. 环境统一层 | 通过 | 仅保留轻量顶部/底部/暗角渐变，不遮盖喷泉主体 |
| 9. UI 精修 | 通过 | 保留压力、状态、计划、时间轴与 AI 交互层；修正压力说明断词；切换不抢占 AI 输入焦点或清空输入 |
| 10. 最终 QA | 通过 | 四态、交叉淡化、失败回退、快速切换、同档更新、可见性、reduced-motion、无横向溢出均通过自动化 |

## 证据

- 设计对照：`comparison-reference-balanced.png`
- 四态总览：`four-states-contact-sheet.png`
- 四态原图：`state-calm-1536x1024.png`、`state-balanced-1536x1024.png`、`state-busy-1536x1024.png`、`state-intense-1536x1024.png`
- 交叉淡化中间态：`crossfade-balanced-to-busy-1536x1024.png`
- 视频失败回退：`fallback-master-1536x1024.png`

## 自动化结果

- Today 单元/组件测试：16 个文件、78 项通过。
- Final Scene Playwright：2 项通过（四态集成与故障回退）。
- 既有 V3 Phase 8/9 已迁移为视频架构断言；旧 WebGL 性能档参数不再是当前运行时验收条件。
- Web TypeScript typecheck 与 production build 通过。

Browser Harness 因 Chrome 的远程调试授权弹窗无法建立连接；按项目降级规则使用隔离 bootstrap 的 Playwright Chromium 完成真实浏览器验证，未触碰正式用户数据。

## 遗留事项

无阻断项。四段视频约 13MB，后续若部署网络环境需要更低首屏带宽，可另做 WebM/AV1 或分辨率自适应版本；本次不降低现有素材质量。校准后的用户复验准确率为 6–7/8，达到既定 6/8 门槛，方案验收有效；本次未保留逐题结果 JSON，证据边界见盲测结果记录。
