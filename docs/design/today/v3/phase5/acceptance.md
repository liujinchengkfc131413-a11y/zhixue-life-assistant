# Today V3 Phase 5 水体细节与氛围验收

- 验收日期：2026-08-22
- 基准视口：1536×1024，deviceScaleFactor=1
- 唯一视觉基准：[reference.png](./reference.png)
- 最终实现：[implementation.png](./implementation.png)
- 并排对照：[comparison.png](./comparison.png)
- 30 秒动态取样：[motion-00.png](./motion-00.png)、[motion-10.png](./motion-10.png)、[motion-20.png](./motion-20.png)、[motion-30.png](./motion-30.png)
- 浏览器指标：[metrics.json](./metrics.json)

## Gate 5 结论

**通过。** 默认 WebGL 路径已从 Phase 4 `geometry` 模式切换为 Phase 5 `full` 模式，并接管 Droplets、Splash、Ripple、Mist、Lighting 与 Reflection。固定 Fixture 连续运行 33 秒，0/10/20/30 秒四帧均不同；人工逐帧检查未见统一循环起点、全水流同步、整组粒子重复轨迹或中央水柱突然重置。

## Fidelity Ledger

| 对照点 | 参考图 / Gate 证据 | 最新实现证据 | 结论 |
|---|---|---|---|
| 水滴 | 参考喷泉的弧线末端和主柱周围存在细碎水滴 | GPU Droplets 绑定 12 个真实落水点；低质量档运行态 120 粒子，粒子拥有独立 rate 与 phase | 通过 |
| Splash | 落水位置存在短生命周期碎水和亮点 | Splash 从 `activeLandingPoints` 生成；运行态 25 粒子，各自使用不同周期率 | 通过 |
| Ripple 因果 | 波纹来自水束落点，不是无关随机动画 | 16 个 Ripple 按 BACK/MID/FRONT 分配池面纵深并绑定落点；已修正首轮“整齐圆环栅栏”问题 | 通过 |
| Mist | 中央及水面上方有低速、低透明雾气 | 独立体积雾 Shader 使用双层非同速噪声，中央/冠部与水面分别形成雾区 | 通过 |
| Lighting | 暗环境托起暖白偏青水体 | 独立 Lighting layer 读取共享 key/ambient/reflected/warmth 参数，以双频慢呼吸控制中央光与水面反射光 | 通过 |
| Reflection | 水面反射与波动共同工作 | 水面使用 RenderTarget、DepthTexture、Fresnel、refraction 与 reflection；运行态 ownership 明确包含 reflection | 通过 |
| 30 秒连续性 | Gate 5 要求无明显循环起点、同步、重复轨迹或水柱重置 | 四帧 SHA-256 均不同；`atmosphereElapsed=33`；水弧高光、Droplets、Splash、Ripple 使用不同 rate/phase；人工 `view_image` 逐帧复核 | 通过 |
| 构图保护 | Phase 5 不应破坏 Gate 1–4 的视觉壳和几何 | 240px 侧栏、930×700 喷泉、三张计划卡、810px 时间轴与 Composer 坐标不变；2/6/4 水束角色不变 | 通过 |

## 首屏文案差异审计

- Phase 5 未新增、删除或改写首屏产品文案。
- 继续使用真实产品名、Fixture 日期、压力、任务和不可用天气状态；未伪造参考图中的农历、天气、头像或任务。

## 运行态证据

- `phase=5`，`composition=v3-water-atmosphere`。
- WebGL canvas 1，Canvas fallback 0，`webglMode=full`。
- 水体 ownership：`surface,main-jet,arc-streams,droplets,splash,ripple,mist,lighting,reflection`。
- 运行态预算：Droplets/Mist 粒子 120、Splash 25、Ripple 16。
- 12 束几何水流仍为 Primary 2、Mid 6、Fine 4。
- 连续观察 33 秒；零页面错误、零控制台错误、无横向溢出。

## 有意保留的差异与后续边界

- 当前程序化喷泉仍比参考图克制，参考图中更密集的细流和摄影级水体断裂不会在 Phase 5 通过无上限堆粒子来模拟；后续如需提升真实度，应继续改善水体材质与几何，而不是破坏 Gate 5 的稳定节奏。
- Phase 5 只完成水体细节与氛围，不新建 Calm / Balanced / Busy / Intense 四套正式 Profile。统一 `FountainVisualState`、四 Profile 与平滑插值属于 Phase 6。
- Browser Harness 诊断仍显示本地 daemon/远程调试连接不可用，因此按既有降级决策使用项目 Playwright 的真实 Chromium；隔离服务显式使用 `.codex/tmp/today-v3-phase1-qa/bootstrap.json`。

