# Today V3 Phase 4 喷泉几何验收

- 验收日期：2026-08-22
- 基准视口：1536×1024，deviceScaleFactor=1
- 唯一视觉基准：[reference.png](./reference.png)
- 实现截图：[implementation.png](./implementation.png)
- 并排对照：[comparison.png](./comparison.png)
- 浏览器指标：[metrics.json](./metrics.json)

## Gate 4 结论

**通过。** 默认水体路径已从静态摄影喷泉切换为几何专用 WebGL：只渲染 MainJet、Primary Arcs、Mid Streams 与 Fine Streams，不提前启用水面动画、粒子、Splash 或复杂 Mist。中央水柱、展开点、左右多层水弧及前中后层次在首屏中均可直接辨认，水束采用有截面宽度的 ribbon mesh，而不是 Canvas 单线。

## Fidelity Ledger

| Gate 4 对照点 | 参考图证据 | 浏览器实现 | 结果 |
|---|---|---|---|
| 中央水柱 | 中轴存在高而明亮、由下至上收束的主柱 | 独立 MainJet ribbon 从池面贯穿中心，底部宽、顶部渐收并保留流动纹理 | 通过 |
| 展开点 | 多组水弧从中央主柱附近向左右展开 | 主弧起点锚定 MainJet 上半段，左右镜像，展开焦点清楚 | 通过 |
| 左右多层水弧 | 两侧均有高弧、中弧与内侧细弧 | 12 束水流固定为 Primary 2、Mid 6、Fine 4，左右成对生成 | 通过 |
| 前中后空间 | 外侧高弧、中层水束、前侧低细流形成景深 | role lift 与 BACK/MID/FRONT depth lift 共同控制弧高；静态底图仅以 10% 透明度辅助空间连续性 | 通过 |
| 非单条发光线 | 参考水流有宽度、边缘、内部高光和连续水体 | 每束水流为双边 ribbon mesh；主弧宽度倍率 1.55、中层 1、细流 0.58，并有 core/edge/highlight 着色 | 通过 |
| 水体厚度 | 主柱和主弧明显粗于细水束 | 单元测试锁定最宽主弧大于最宽细流 1.8 倍；截图中主柱、主弧和细流层级可见 | 通过 |
| 阶段边界 | Phase 4 暂不做大量粒子、复杂 Mist、状态映射 | `geometry` 模式所有权仅为 `main-jet,primary-arcs,mid-streams,fine-streams`；Canvas 回退 0、WebGL 画布 1 | 通过 |

## 首屏文案差异审计

- Phase 4 没有新增或改写产品文案；沿用 Phase 3 的真实产品名、Fixture 日期、压力、状态和计划数据。
- 参考图中的天气、农历、头像和示例任务仍未伪造；这些差异与喷泉几何门禁无关。

## 有意保留的视觉差异

- 当前几何水流更克制、洁净，尚未加入参考图中的大量水滴、飞溅、细雾、反射和落水扰动；这些属于 Phase 5。
- 几何模式保留静态摄影喷泉 10% 的弱轮廓，只用于维持尚未由 Phase 4 接管的水体连续感，不承担主喷泉轮廓。
- 当前状态数据尚未驱动喷泉性格切换；Phase 4 只验证稳定的默认几何基线。

## 自动验证摘要

- 4 个定向测试文件、21 项测试通过。
- 全仓 typecheck 与 production build 通过；Phase 4 涉及的 TypeScript/JavaScript 文件 ESLint 通过。
- Chromium 指标：`phase=4`、`composition=v3-fountain-geometry`、WebGL canvas 1、Canvas 0、无横向溢出、零页面错误、零控制台错误。
- 浏览器使用隔离的 `.codex/tmp/today-v3-phase1-qa/bootstrap.json`，未读写用户默认 bootstrap 数据。

## 留给下一阶段

- Droplets、Splash、Ripple、Mist、Lighting、Reflection 进入 Phase 5。
- 完整旧水体仅作为 `?todayV3Motion=1` 对照入口；`?todayV3Motion=0` 保留静态回退。
