# Today Fountain V2 方案符合性审计

> 审计日期：2026-08-21；最近复核：2026-08-22  
> 审计范围：今日沉浸式界面与 Fountain Renderer 现有工作区实现  
> 总参考：`Today Fountain V2 图形渲染方案.md`  
> 视觉参考：`docs/design/today/concept-reference.png`（1536 × 1024）

## 1. 结论

当前实现已经完成 Fountain V2 的核心架构和主要视觉能力，但**尚不能认定为按方案全部优化完成**。

- Phase 1–3：主要目标已完成。
- Phase 4：Canvas 路径已完成，WebGL 路径为混合实现，真实水面/反射/深度仍是近似。
- Phase 5：状态差异已有自动化证据，但“隐藏数字后的盲测辨识”尚无独立人工评审记录。
- 性能：具备动态质量分级、后台暂停与运行时采样，但没有普通/低配/高配真实设备矩阵上的持续 60 FPS 基准。

因此当前状态定义为：**核心能力完成，真实水体与最终验收仍需加强**。

## 2. 方案逐项核查

| 方案要求 | 当前证据 | 状态 | 说明 |
| --- | --- | --- | --- |
| Today Scene 七层结构 | Environment、Pool、WebGL Water、Canvas Dynamic Water、状态轴、时间轴、Plan Overlay 已分层 | 已完成 | 喷泉已成为页面主场景，不再是普通 Dashboard 卡片 |
| 环境与水池资产拆分 | `today-environment-atmosphere-v2.png`、`today-environment-v2.webp`、`fountain-water-photoreal-v2.png` | 已完成（有保留） | 运行时职责已拆分；水池源资产仍包含被遮罩的环境内容，不是纯透明池体切片 |
| Fountain Visual State | `fountain-model.ts` 将压力、工作/生活/睡眠/空闲、当前领域、时间进度转为 Visual Profile | 已完成 | 低压/均衡/繁忙及领域语义均进入统一状态模型 |
| 中央主水柱 | WebGL Ribbon 几何、流动 Shader、多层高光与状态参数 | 已完成 | WebGL 成功时由 GPU 动态主体决定轮廓；摄影水体仅保留低透明材质底色 |
| 大量弧形水流 | 12 条 WebGL Ribbon 主弧及移动高光、扰动、落点 | 已完成 | 弧线几何、领域暖光和湍流均由 WebGL 管理；Canvas 仅为失败回退 |
| 水滴粒子 200–1000 | Canvas 粒子 + WebGL GPU Points，WebGL 上限 1000 | 已完成（按质量档缩放） | 当前低性能档会主动降低预算；本次运行态为 low、120 个 GPU 粒子 |
| Splash / Ripple | 落点飞溅、圆环与水面波纹 | 已完成 | Canvas 与 Shader 水面共同表达 |
| Mist / Lighting | 独立 profile 模块、雾粒子、屏幕空间体积雾和三类光照语义 | 已完成（屏幕空间近似） | 新增双区域噪声体积雾；仍不是物理体积散射 |
| Three.js + Shader | 水面、主柱、12 条弧流、Splash、水滴和水雾均进入 WebGL 主路径 | 已完成 | WebGL 成功后 Canvas 实例为 0；初始化失败才挂载完整 Canvas fallback |
| Fresnel / Reflection / Real water surface / Depth | Fresnel、水面 Shader、离屏 RenderTarget、DepthTexture、场景采样反射/折射 | 已完成（实时近似） | 已形成真实 GPU 场景捕获与深度纹理链路；仍不是物理流体求解或光线追踪 |
| 60 FPS、粒子上限、后台暂停 | P50/P95 采样、high/balanced/low 档、目标门槛、粒子/捕获缩放、运行时 pass/fail、低硬件封顶、visibility/IntersectionObserver 暂停 | 已实现，设备证据待补 | 三档可由 `?fountainTier=` 强制复现；内置浏览器本轮处于 hidden，RAF 暂停，不能伪造持续帧率结果；仍需真实高/中/低设备各跑一次 |
| Renderer 文件职责拆分 | WebGL 与 Canvas 均按 surface/jet/arcs/particles/atmosphere 等职责拆分 | 已完成 | Canvas 编排器从约 1034 行降至约 304 行，六个独立 fallback 模块承接绘制职责 |
| 1536 × 1024 参考图对比 | 当前运行态与参考图均已核查；六状态 Fixture 已存在 | 已完成（仍有视觉差距） | 当前喷泉主体、空间色调和层级已接近；参考图的自然水束密度、体积水雾、折射与摄影真实度仍更强 |
| 隐藏数字判断平静/正常/紧张 | 新增匿名 A/B/C QA 状态、隐藏压力轴与领域读数、确定性差异测试、运行时粒子/Splash 证据 | 已实现，人工结果待补 | 答案顺序为 A=balanced、B=busy、C=calm；工程代理证据通过，但独立评审者正确率仍待记录 |

## 3. 本轮运行态证据

- 1536 × 1024 本地隔离数据环境中，Today Scene、状态浮层、压力中轴、Plan Rail、时间轴和 AI 输入均进入单视口。
- WebGL Host 状态为 `running`，领域为 `free`，质量档为 `low`，GPU 粒子预算为 `120`；同时保留一个 Canvas 动态水体实例。
- 页面主体没有实际横向溢出；计划栏完整位于视口内。
- 当前空闲低压状态下，喷泉视觉平稳、对称、雾和喷溅较弱，和状态语义一致。
- 当前视觉仍明显依赖生成的摄影水体资产；动态主柱与水弧尚非全 WebGL 几何。

## 4. 下一阶段顺序

1. 【已完成】主水柱、弧形水流、Splash 迁移到 WebGL 几何/粒子路径，Canvas 成为真正 fallback。
2. 【已完成】引入离屏 RenderTarget、DepthTexture 与场景采样反射/折射。
3. 【已完成】Canvas fallback 已拆为 surface/jet/arcs/particles/atmosphere/shared 六个模块，编排器约 304 行。
4. 【实现完成，真实设备证据待补】已建立 high/balanced/low 性能矩阵、强制档位入口、目标阈值与运行时 pass/fail；本轮内置浏览器处于 hidden，无法取得新的 RAF P50/P95，沿用 2026-08-21 low 档 59.5 FPS P95 单环境证据，不能冒充三台真实设备。
5. 【实现完成，独立人工结果待补】已加入 `?fountainBlind=A|B|C`，隐藏数字与领域读数；自动化验证高度、粒子预算、水面平静度单调分离，运行态确认 A/B/C 隐号生效。
6. 【已完成工程调优】主水柱加入双频形变、边缘破碎噪声、层次高光与更自然收束；新增屏幕空间体积雾层，并让雾密度、能量与领域暖度受模型驱动。

## 6. 2026-08-22 加强阶段 3–6 证据

### Canvas fallback 模块化

- `fountain-renderer.ts` 只保留生命周期、平滑过渡、质量档和绘制编排。
- `fountain-canvas-surface.ts`、`fountain-canvas-jet.ts`、`fountain-canvas-arcs.ts`、`fountain-canvas-particles.ts`、`fountain-canvas-atmosphere.ts`、`fountain-canvas-shared.ts` 分别承接水面、主柱、水弧、粒子/飞溅、雾光和共享工具。

### 性能矩阵

| 档位 | P95 FPS 目标 | P95 帧耗时上限 | 粒子比例 | 场景捕获比例 | 本轮可验证结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| high | 55 | 18.2ms | 1.00 | 1.00 | WebGL running；主路径所有权完整；hidden 标签无 RAF 样本 |
| balanced | 50 | 20.0ms | 0.68 | 0.70 | 强制档位、阈值与缩放单测通过；hidden 标签无 RAF 样本 |
| low | 45 | 22.3ms | 0.28 | 0.45 | WebGL running；busy 280 粒子 / 67 Splash，calm 120 / 24；2026-08-21 单环境 P95 59.5 FPS |

### 隐号辨识集

- A/B/C URL 不出现状态名称，CSS 隐藏 `.today-state-axis` 与 `.today-status-floats`。
- 自动化答案键：A=balanced、B=busy、C=calm。
- 结构判定：水柱高度、粒子预算从 calm→balanced→busy 严格递增；水面平静度严格递减。
- 运行态：B low 档为 280 粒子 / 67 Splash；C low 档为 120 粒子 / 24 Splash；两者均 WebGL running、数字层 hidden。
- 尚缺独立人类评审者在不知道答案键时的正确率记录，因此不能把工程代理检查写成“人工盲测通过”。

### 视觉证据边界

同视口参考图与旧 release-candidate 已在同一比较输入中复核；本轮最新 WebGL 画面的 Browser `Page.captureScreenshot` 连续超时，故根目录 `design-qa.md` 按规则标记 blocked。源码、DOM、运行态和测试可以证明功能已实现，但不能替代最新像素级终检。

## 5. 证据边界

本结论基于当前工作区源码、单元/E2E/构建结果、确定性 Fixture、1536 × 1024 当前运行态和概念参考图。它不等同于物理正确性证明、跨 GPU 兼容性认证或完整 WCAG 合规声明。
