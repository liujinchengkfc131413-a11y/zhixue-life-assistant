# Today V3 Phase 3 UI 美术验收

- 验收日期：2026-08-22
- 基准视口：1536×1024，deviceScaleFactor=1
- 唯一视觉基准：[reference.png](./reference.png)
- 实现截图：[implementation.png](./implementation.png)
- 并排对照：[comparison.png](./comparison.png)
- 浏览器指标：[metrics.json](./metrics.json)

## Gate 3 结论

**通过。** 在喷泉完全静止、Canvas/WebGL 未挂载的条件下，侧栏、Typography、弱玻璃、压力面板、四个状态块、三张计划卡、24h 时间轴和 AI Composer 已形成与总参考图一致的视觉语言和阅读层级。

## Phase 3 Design Tokens

| Token 族 | 实现约束 |
|---|---|
| Typography | Inter / Segoe UI / Microsoft YaHei / PingFang SC；标题 30px，右栏主标题 18px，正文 13–15px，辅助文字 10–11px |
| Glass surface | 8%–14% 浅色/青绿色渐变，18%–24% 高光边框，13–14px blur；不使用厚重不透明面板 |
| Text hierarchy | 主文字约 90%–94%，次文字约 68%–70%，三级文字约 50% |
| Radius | 压力与计划卡 18px，状态块 11px，时间带 9px，AI Composer 30px |
| Semantic color | 睡眠蓝、工作青绿、生活暖橙、空闲灰绿；状态块与时间轴共享同一语义色 |

## Fidelity Ledger

| 对照点 | 参考图证据 | 浏览器实现 | 结果 |
|---|---|---|---|
| 左侧导航 | 白底、清晰品牌、绿色今日选中态，主导航靠近首屏上部 | 240px 真白侧栏；叶片品牌标识与副标题；工具入口收敛为两个轻量图标，主导航上移 | 通过 |
| Typography | 今日标题约 30px，卡片标题和正文有清楚三级层级 | Today 标题 30px；计划主标题 18px；状态/条目 13–15px；辅助文字 10–11px | 通过 |
| Pressure Panel | 透明浅玻璃、42px 左右分数、状态和描述分层 | 190×265，18px 圆角、14px blur；分数 42px、等级 18px、说明 15px | 通过 |
| Time State Blocks | 四块纵排、每块约 68px、弱玻璃和语义色图标 | 四块总高 305px，单块 min-height 68px、11px 圆角、13px 标签与数值 | 通过 |
| Plan Cards | 三张独立透明卡，标题清楚、条目紧凑 | 三张 section 保持独立；18px 圆角、14px blur、18px/15px 标题层级 | 通过 |
| Timeline | 彩色时间段、段内类型名称、刻度位于下方、当前游标醒目 | 睡眠/工作/生活/空闲标签进入宽段；00/06/12/18/24 刻度位于带下方；游标保持中轴 | 通过 |
| AI Composer | 白色 60px 胶囊、右侧绿色按钮 | 810×60，30px 圆角；15px 输入文字，132×44 绿色按钮；不可用状态仍保留语义可见性 | 通过 |
| Palette / asset treatment | UI 浮在场景上，不形成深色模块墙 | 使用共享弱玻璃 token，保留 Phase 2 连续环境与静态喷泉，无额外色罩 | 通过 |

## 首屏文案差异审计

- 保留真实产品名称“知雪的生活助手”，没有替换为概念图示例名称“生活助手”。
- 保留真实 Fixture 日期、压力、计划标题与时长；不伪造天气、农历、用户头像或概念图示例任务。
- 新增可见文案仅为品牌副标题“陪你 · 看见生活”和时间轴真实类别“睡眠 / 工作 / 生活 / 空闲”，均来自概念图既有语义。
- 保留“重新安排今日”“添加”“查看压力因素”等真实操作入口；这些是业务能力，不为像素相似度删除。

## 仍留给后续阶段

- 喷泉几何、主柱厚度和前中后水弧属于 Phase 4；当前摄影喷泉仅用于静态 Gate。
- Droplets、Splash、Ripple、Mist、Lighting、Reflection 属于 Phase 5。
- 概念图天气和农历不是当前数据契约，本阶段继续显示真实不可用状态。

