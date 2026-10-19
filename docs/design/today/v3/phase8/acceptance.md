# Today V3 Phase 8 动态性能验收

- 验收日期：2026-08-22
- 基准视口：1536×1024，deviceScaleFactor=1
- 唯一视觉基准：[reference.png](./reference.png)
- High 实现态：[implementation.png](./implementation.png)
- 基准并排对照：[comparison.png](./comparison.png)
- 三档运行态：[high.png](./high.png)、[balanced.png](./balanced.png)、[low.png](./low.png)
- Low + reduced-motion：[low-reduced-motion.png](./low-reduced-motion.png)
- 浏览器指标：[metrics.json](./metrics.json)

## Gate 8 结论

**通过。** 主桌面固定 Fixture 的 High 档 90 帧采样为 P50 59.9 FPS、P95 59.5 FPS、P95 帧耗时 16.8ms；常态 GPU 粒子预算收敛至 500。High / Balanced / Low 依次降低 Droplets、Ripple、Mist 与渲染分辨率，中央 MainJet 和 2/6/4 水弧结构始终保留。页面隐藏、reduced-motion、低性能档和 RAF resize throttling 均有自动化证据。

## 性能与降级矩阵

| 档位 | Droplets | Ripple | Mist | 分辨率 | GPU 粒子 | Splash | Ripple | 主水流 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| High | 1.00 | 1.00 | 1.00 | 1.00 | 485 | 116 | 36 | 保留 |
| Balanced | 0.68 | 0.82 | 0.90 | 0.96 | 330 | 79 | 30 | 保留 |
| Low | 0.28 | 0.52 | 0.68 | 0.76 | 136 | 33 | 19 | 保留 |

- 显式顺序固定为 `droplets → ripple → mist → resolution`；单元测试锁定顺序和各档单调关系。
- 常态压力 37 的模型预算不超过 500；高压 87 的预算高于常态且不超过 1000。
- resize 通过 `requestAnimationFrame` 合并；本次首屏记录 3 次实际 resize，不按 ResizeObserver 通知次数直接重建缓冲区。
- 两窗口滞回继续保护自动分档，避免短时帧抖动造成 High / Balanced / Low 反复切换。

## 生命周期与无障碍动效

| 场景 | 自动化检查 | 结论 |
|---|---|---|
| 页面隐藏 | 模拟 `document.hidden` 后 atmosphere elapsed 保持不变；恢复可见后继续递增 | 通过 |
| reduced-motion | 媒体查询切换后 RAF 停止，静态帧仍同步最新模型 | 通过 |
| Low performance | 粒子、Splash、Ripple、Mist 和像素比按矩阵降低 | 通过 |
| 主水流保护 | 三档均为 `mainFlow=preserved`，角色始终为 `primary_arc:2,mid_stream:6,fine_stream:4` | 通过 |
| Canvas fallback | 延续相同分辨率矩阵、页面隐藏/离屏暂停、reduced-motion 与 RAF resize 策略 | 通过 |

## Fidelity Ledger

| 对照点 | 参考图意图 | 最新实现 | 结论 |
|---|---|---|---|
| 第一视觉重心 | 喷泉优先于卡片与导航 | 三档截图中中央喷泉、水池亮面和纵向主柱仍是首要视觉对象 | 通过 |
| 喷泉结构 | 主柱与多层弧流不能因性能下降消失 | High、Balanced、Low 均保留 MainJet 和 2/6/4 弧流角色 | 通过 |
| 动态细节 | 优先牺牲高频微细节 | Low 档飞沫与落水圆波明显收敛，Mist 和像素比随后降低 | 通过 |
| 页面构图 | 性能策略不能改变 240px 侧栏、中央场景、右栏与底部时间轴 | 各档布局坐标一致，无横向溢出 | 通过 |
| 业务可读性 | 压力、状态、计划和时间轴不得受质量档位影响 | 三档只调整 WebGL 动态预算，业务 DOM、文字与交互未降级 | 通过 |
| 静态可访问态 | 减弱动效后仍应呈现完整画面 | Low + reduced-motion 截图保留完整喷泉和业务层 | 通过 |

## 首屏文案差异审计

- Phase 8 未新增、删除或改写产品文案；性能档位和采样数据仅通过测试用 `data-*` 标记暴露，不进入用户界面。
- 固定 Fixture 继续显示真实日期、压力、计划以及明确的天气不可用状态，未复制参考图中的虚构数据。

## 验证证据

- Phase 8 Playwright 真实 Chromium 用例通过，覆盖 90 帧采样、三档预算、主水流保护、页面隐藏、恢复可见、reduced-motion 与截图。
- 定向模型、性能、水体和氛围测试通过；Web TypeScript 检查与 production build 通过。
- High 运行态：WebGL full 1、Canvas fallback 0；零页面错误、零控制台错误、无横向溢出。
- `reference.png`、`implementation.png`、`balanced.png`、`low.png` 与 `low-reduced-motion.png` 均按原始分辨率人工复核。

## 有意保留的边界

- 本 Gate 验证 V3 方案要求的 1536×1024 主桌面环境；1920×1080、1600×900、1440×900、1366×768 属 Phase 9。
- 当前性能值来自本机真实 Chromium 的固定 Fixture，不冒充三台物理设备的持续跑分；Fountain V2 独立设备实验仍保留为单独验收项。
- Browser Harness 诊断显示 daemon 与活动连接不可用，因此依照既有降级决策使用项目 Playwright 的真实 Chrome。

