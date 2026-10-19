# Today V3 Phase 2 环境资产拆分验收

- 验收日期：2026-08-22
- 基准视口：1536×1024，deviceScaleFactor=1
- 唯一视觉基准：[reference.png](./reference.png)
- 完整实现：[implementation.png](./implementation.png)
- Gate 2 纯场景：[scene-only.png](./scene-only.png)
- 并排对照：[comparison.png](./comparison.png)
- 指标记录：[metrics.json](./metrics.json)

## Gate 2 结论

**通过。** 默认关闭 Canvas/WebGL 动态水体时，环境、池体、水面、静态喷泉和场景光晕可独立组成完整沉浸场景；环境不再被中央 930px 舞台裁成明显矩形图片块。

## 资产与职责

| 层 | DOM 标识 | 职责 | 不包含 / 不负责 |
|---|---|---|---|
| Environment | `environment` | 雾化深青背景、地面环境光；横向延伸并独立羽化 | UI、压力、任务、动态水柱 |
| Scene glow | `scene-glow` | 中央暖光、池面青色反射氛围 | 数据状态、粒子、动画 |
| Pool base | `pool` | 池沿、池壁、地面反射；使用椭圆遮罩隔离池体 | 主水柱、动态水滴、UI |
| Water surface | `water-surface` | 独立池面材质和椭圆透视 | 主水柱、压力状态、任务 |
| Static fountain | `static-fountain` | Phase 2 Gate 使用的静态喷泉占位 | Canvas/WebGL 动画所有权 |
| Dynamic renderer | `webgl-water` / `dynamic-water` | 后续动态水体挂载点 | Phase 2 默认不挂载 |

## Gate 检查

| 检查项 | 证据 | 结果 |
|---|---|---|
| 动态水体关闭 | `canvasCount=0`，默认不渲染 WebGL/Canvas host | 通过 |
| 五个静态职责层存在 | metrics 记录 environment / scene-glow / pool / water-surface / static-fountain | 通过 |
| 环境无明显矩形边界 | 环境宽度延伸出舞台，环境层、池体层分别羽化；见 `scene-only.png` | 通过 |
| 纯场景仍完整 | `?todayV3Gate=2` 隐藏 UI 后，背景、静态喷泉、水面与水池关系完整 | 通过 |
| 环境不承载产品信息 | 环境与光晕均为空替代文本装饰层，不含 UI、压力或任务内容 | 通过 |
| Phase 1 构图未漂移 | 侧栏、喷泉、压力、状态、计划、时间轴与 AI 坐标保持 Gate 1 数值 | 通过 |
| 运行稳定性 | 1536×1024 Chromium：零页面错误、零控制台错误、无横向溢出 | 通过 |

## 保留到后续阶段

- 静态喷泉仍是摄影占位资产，喷泉几何所有权将在 Phase 4 交还 Renderer。
- 更真实的 Ripple、Splash、Mist、Lighting 和 Reflection 属于 Phase 5。
- Typography、卡片材质和 UI 细节属于 Phase 3，本阶段未顺手改写。

