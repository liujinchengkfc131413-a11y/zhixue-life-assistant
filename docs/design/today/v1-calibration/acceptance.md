# Today V1 视觉校准验收记录

## 结论

本轮按《Today V1 视觉校准实施方案》完成现有 Today Scene 的视觉校准。它不是新一轮重构：侧栏、业务结构、压力映射、四状态媒体控制、时间轴实时游标和 AI 交互均保持原有逻辑。

## 已落地的校准

- 统一视觉焦点轴为主场景宽度的 39%，Current Time 与喷泉主体共轴。
- 静态 master 与 Calm / Balanced / Busy / Intense 四档视频共用同一 `object-position` 与水平位移；不使用放大、模糊或锐化滤镜。
- 压力入口定位到主场景 5%，状态浮卡定位到 56%，右侧计划栏保留 32px 外边距。
- Timeline 从主场景 5% 开始，AI Composer 从 3% 开始，两者右侧均与计划栏保持 60px 间距。
- “重新安排”从环境标题区迁入“今日计划”标题操作区，业务回调、pending 状态与可访问名称保持不变。
- 减轻全场景暗色覆盖层，保留文字可读性与右侧媒体羽化过渡。
- 增加 `?todayV1Debug=1` 开发态对齐辅助线，不进入生产用户界面。

## 自动化几何基准

| 视口 | 焦点轴 | 压力入口 | 状态浮卡 | Timeline 左侧 | AI 左侧 | 计划栏右距 |
|---|---:|---:|---:|---:|---:|---:|
| 1536×1024 | 39% | 5% | 56% | 5% | 3% | 32px |
| 1654×960 | 39% | 5% | 56% | 5% | 3% | 32px |
| 1920×1080 | 39% | 5% | 56% | 5% | 3% | 32px |

静态 master 和活动视频还会逐项断言位置、宽度、`object-position`、transform 与 `filter` 一致。四档状态切换、首段视频加载失败的静态回退、页面生命周期与 reduced-motion 由既有 Final Scene / Phase 7 回归共同覆盖。

## 素材审计

四段源视频均为 H.264、1152×768、24fps；时长分别为 Balanced 7.166667s、Calm 7.166667s、Busy 6.583333s、Intense 7.416667s。当前实现避免 CSS 放大和滤镜，因此没有人为损失清晰度；但源分辨率仍是全屏显示的清晰度上限，如需继续提升只能替换更高分辨率素材。

## 视觉证据

- 改前：`before-1536x1024.png`、`before-1654x960.png`、`before-1920x1080.png`
- 改后：`after-1536x1024.png`、`after-1654x960.png`、`after-1920x1080.png`
- 对照：`reference-after-1536x1024.png`、`before-after-1536x1024.png`
- 对齐辅助线：`debug-1536x1024.png`
- 概念依据：`../concept-reference.png`

## 验证说明

Codex 内置浏览器可完成页面结构、坐标和交互检查，但热更新后连续两次截图均在 `Page.captureScreenshot` 超时。按前端测试降级规则，固定视口截图改由项目 Playwright 使用系统 Chrome 生成；这不影响同一运行页面的布局与交互验收。最终结果以 Playwright 截图、几何断言、组件测试、typecheck 和 production build 共同判断。

## 遗留事项

- 源视频为 1152×768，超大屏近看仍受素材本身细节上限约束。
- production build 仍提示既有主 JS chunk 超过 500kB，本轮未新增媒体运行逻辑，暂不在视觉校准中拆包。
