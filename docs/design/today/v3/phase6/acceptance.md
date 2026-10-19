# Today V3 Phase 6 Visual State 验收

- 验收日期：2026-08-22
- 基准视口：1536×1024，deviceScaleFactor=1
- 唯一视觉基准：[reference.png](./reference.png)
- Balanced 实现：[implementation.png](./implementation.png)
- 基准并排对照：[comparison.png](./comparison.png)
- 四 Profile 对照：[profiles-comparison.png](./profiles-comparison.png)
- 四态原始截图：[profile-calm.png](./profile-calm.png)、[profile-balanced.png](./profile-balanced.png)、[profile-busy.png](./profile-busy.png)、[profile-intense.png](./profile-intense.png)
- 浏览器指标：[metrics.json](./metrics.json)

## Phase 6 结论

**通过。** 已建立统一 `FountainVisualState`，完整接收 pressure、四类时间占比、currentMode、timeProgress 与 priorityState，并集中输出主柱、弧流、飞沫、雾、波纹、光照、暖度及稳定性 11 个标准化参数。Calm / Balanced / Busy / Intense 使用同一喷泉结构与连续 Profile 曲线；WebGL 场景更新通过 700ms 平滑过渡，避免状态变化造成整座喷泉瞬时跳变。

## Fidelity Ledger

| 对照点 | 参考图 / Phase 6 要求 | 最新实现证据 | 结论 |
|---|---|---|---|
| 单一视觉状态 | 渲染器不应继续分别猜测压力、领域和时间 | `FountainVisualStateInput` 集中 8 项输入，`FountainVisualState` 集中 11 项输出；模型、几何、水面和氛围共享同一状态 | 通过 |
| 四 Profile | Calm / Balanced / Busy / Intense 必须可辨识 | 12/37/62/87 四档截图保持同一构图；主柱高度 0.580→0.960、宽度 0.468→0.940、流密度 0.361→0.941 | 通过 |
| 水体动势 | 压力升高应增加速度、飞沫、雾和波纹，而非替换整座喷泉 | 四档速度 0.275→0.935、飞沫 0.176→0.976、雾 0.173→0.713、波纹 0.202→0.942；粒子预算同步递增 | 通过 |
| 稳定性 | 平静状态更稳定，高压状态更破碎 | stability 从 Calm 0.909 连续下降到 Intense 0.349，所有 0–100 分逐点单调测试通过 | 通过 |
| 平滑插值 | Profile 边界不得产生几何跳变 | Profile 内使用 smoothstep；24/25、49/50、74/75 三组边界连续性专项测试通过 | 通过 |
| 场景过渡 | 数据变化不得导致喷泉瞬时跳变 | WebGL renderer 保留当前显示模型，并在 0.7 秒内插值 pressure、domain、lighting、streams、pool 与 visualState；起点、中点、终点及钳制测试通过 | 通过 |
| 业务语义 | 工作、生活、睡眠、空闲与优先级仍需影响水体 | 工作增强速度与聚焦、生活增强暖度、睡眠增强雾、空闲降低密度并增加呼吸空间、优先级增强飞沫与波纹；模型回归测试通过 | 通过 |
| 构图保护 | Phase 6 不应破坏 Gate 1–5 | 240px 侧栏、930×700 喷泉、三张计划卡、810px 时间轴与 Composer 坐标不变；WebGL full ownership 与 2/6/4 水束角色不变 | 通过 |

## 首屏文案差异审计

- Phase 6 未新增、删除或改写产品首屏文案。
- 四态图左上角的英文 Profile 胶囊仅由验收拼图脚本生成，不进入产品界面。
- 压力数值与状态文案来自同一固定 Fixture 的四个受控压力档位，不伪造天气、任务或其他业务信息。

## 运行态证据

- `phase=6`，`composition=v3-visual-state`；WebGL canvas 1、Canvas fallback 0，`webglMode=full`。
- Calm / Balanced / Busy / Intense 的状态数据集分别可读，GPU 粒子预算为 120 / 165 / 219 / 271，Splash 为 28 / 40 / 53 / 65。
- 水体 ownership 仍为 `surface,main-jet,arc-streams,droplets,splash,ripple,mist,lighting,reflection`，几何角色仍为 Primary 2、Mid 6、Fine 4。
- 1536×1024 下零页面错误、零控制台错误、无横向溢出；参考图、最终图与四态拼图均已用 `view_image` 人工复核。

## 有意保留的差异与后续边界

- Calm 到 Intense 的变化保持克制：以主柱高度/宽度、亮度、弧流动势、粒子与雾的连续变化为主，不切换资产或结构，因此静态缩略图中的差异小于动态实机观感。
- Phase 6 只建立视觉状态层与渲染过渡；Today 操作全链路、详情、重排、天气及 AI 的系统性回归属于 Phase 7。
- Browser Harness 诊断仍显示 daemon 与活动连接不可用，因此按既有降级决策使用项目 Playwright 的真实 Chromium；隔离服务显式使用 `.codex/tmp/today-v3-phase1-qa/bootstrap.json`。
