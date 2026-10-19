# Today Scene 2.0 Scene State Engine 第一阶段验收报告

## 1. 验收结论

Life Assistant V3.1 Today Scene 2.0 第一阶段已完成实现与内部审阅。

Today Scene 现已在保留 V2 Pressure Scene 的基础上增加本地 Time State。Pressure 继续决定喷泉强弱，Time 只改变同一空间的亮度、对比度、色温、环境 Overlay、暗角和 UI 可读性渐变。两套状态在渲染层组合，不存在组合枚举或 16 条组合视频。

本报告中的“通过”仅指已列出的自动化与视觉证据通过。Life Phase、Special State 和 V3.2 能力未实现。

## 2. 实际 Scene State 架构

第一阶段实际实现：

```text
TodaySceneState
├── pressureState
│   ├── calm
│   ├── balanced
│   ├── busy
│   └── intense
└── timeState
    ├── morning
    ├── day
    ├── sunset
    └── night
```

实际渲染关系：

```text
TodayImmersiveLayout
├── Scene Backdrop
├── TodaySceneMedia ← pressureState
├── TodaySceneEnvironment ← timeState
└── Existing UI Overlay
```

`TodayImmersiveLayout` 在高层一次构建 `TodaySceneState`。`TodaySceneMedia` 不读取 Time State，`TodaySceneEnvironment` 不读取 Pressure State。组合只发生在 Scene Composition 层。

未实现：

- Life Phase 的 work、life、neutral 判断与视觉影响。
- Special State 的 dayCompleted、rest 判断与视觉影响。
- `MorningIntense`、`NightCalm` 等组合状态。

## 3. Time State 规则

Time State 使用 Today 页面已有的 `currentNow`。该时间由服务端时间校准，并由既有 30 秒计时更新；V3.1 未增加高频计时器。

解析规则使用当前 Today UI 的本地民用时间：

| Time State | 起始时间 | 结束时间 |
|---|---:|---:|
| Morning | 05:00 | 10:59 |
| Day | 11:00 | 16:59 |
| Sunset | 17:00 | 19:29 |
| Night | 19:30 | 次日 04:59 |

边界单元测试覆盖 00:00、04:59、05:00、10:59、11:00、16:59、17:00、19:29、19:30、23:59。

## 4. Environment Profile

Day 是 V2 baseline。四档最终实现参数如下：

| Time | Brightness | Contrast | Temperature RGB | Temperature opacity | Overlay opacity | Vignette | Readability top | Readability bottom | Transition |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| Morning | 1.04 | 0.97 | 205 232 229 | 0.035 | 0.88 | 0.04 | 0.09 | 0.08 | 5000ms |
| Day | 1.00 | 1.00 | 255 255 255 | 0 | 1.00 | 0.05 | 0.11 | 0.10 | 5000ms |
| Sunset | 0.96 | 1.00 | 224 157 102 | 0.065 | 0.96 | 0.065 | 0.12 | 0.11 | 5000ms |
| Night | 0.82 | 1.03 | 20 55 66 | 0.12 | 1.00 | 0.12 | 0.20 | 0.18 | 5000ms |

参数集中定义在 `scene-environment-profile.ts`，运行时冻结。React JSX 中不存在按时间散落的样式判断。

Time Environment 只使用 CSS filter、gradient、opacity 和 CSS transition。没有 Canvas、水花、粒子、第二套 Mist、程序化喷泉、动态光斑或高频 JS 动画循环。

## 5. V2 能力保留结果

| V2 能力 | 结果 | 证据摘要 |
|---|---|---|
| Pressure 边界 | 保留 | 原 `0–24 / 25–49 / 50–74 / 75–100` 测试继续通过 |
| 已校准素材映射 | 保留 | 四档素材断言继续通过，未修改 MP4 |
| 双 Video Layer Crossfade | 保留 | Pressure 改档仍通过 Video A/B，过渡最多两条活动视频 |
| preload | 保留 | 原预加载实现未重写 |
| fallback | 保留 | 初始视频失败后 Static Master Frame、Time Environment 和 UI 均存在 |
| visibility 生命周期 | 保留 | document hidden 后活动视频为 0，恢复后为 1 |
| 页面离开暂停 | 保留 | Today 客户端路由卸载后原 active video 已暂停 |
| reduced-motion | 保留 | 视频停止，Static Master Frame 与 Time Environment 继续表达状态 |
| UI Overlay 独立 | 保留 | AI 输入和焦点、Timeline DOM、三段计划区在联合 Transition 中保持 |
| 稳态性能 | 保留 | 稳态最多一条视频，Crossfade 最多两条，无新增持续 JS 循环 |

## 6. 状态与 Transition QA

### 6.1 组合状态

自动化验证以下全部 16 种组合：

```text
Calm     × Morning / Day / Sunset / Night
Balanced × Morning / Day / Sunset / Night
Busy     × Morning / Day / Sunset / Night
Intense  × Morning / Day / Sunset / Night
```

结果：16/16 状态组合正确。Pressure 与 Time 的 QA 属性分别更新，无组合枚举，无状态冲突。

### 6.2 联合 Transition

自动化联合切换覆盖 Pressure 与 Time 同时变化，并确认：

- Pressure Crossfade 和 Time Environment Transition 同时存在但不共享状态。
- Time transition duration 为 5 秒。
- 过渡期间活动视频不超过两条。
- AI 输入值与焦点不丢失。
- Timeline DOM 不替换，计划区结构不重建。
- 浏览器 console error、pageerror 和 HTTP 失败响应新增数量为 0。

### 6.3 生命周期

- document hidden → 活动视频 0。
- document visible → 活动视频恢复 1。
- Today route unmount → 原活动视频 paused。
- reduced-motion → 视频 0，Static Master Frame 与 Time Environment 保留。
- 视频初始加载失败 → Static Master Frame、Environment 与 UI 保留。

## 7. 技术门禁

### 7.1 定向验证

- Scene State、Profile、Environment 与 Fountain 相关单元/组件测试：42/42 通过。
- Today Scene Chromium E2E：6/6 通过。
- 正式四时间态 Fixture 生成测试：1/1 通过。
- Web typecheck、相关 ESLint、Prettier、V2 CSS audit 通过。

### 7.2 完整仓库验证

`pnpm verify` 通过：

- Prettier 通过。
- ESLint 通过。
- V2 CSS audit 通过。
- 11/11 package typecheck 通过。
- Vitest 109 个文件、487 项测试通过。
- 3 个文件、7 项真实服务或性能门控测试按既有设计跳过。
- Contracts check 通过。
- 11/11 package production build 通过。
- Launcher Release build 0 warning、0 error。
- Launcher 连续异常退出恢复门禁通过。

构建仍输出既有主 chunk 大于 500kB 提示；本阶段未增加媒体资产或新的依赖包，该提示不是 V3.1 新增失败。

## 8. 视觉材料与审阅

四张截图均使用 Balanced Pressure 35、`1536×1024`、相同 Scene 构图：

- [Balanced Morning](./balanced-morning-1536x1024.png)
- [Balanced Day](./balanced-day-1536x1024.png)
- [Balanced Sunset](./balanced-sunset-1536x1024.png)
- [Balanced Night](./balanced-night-1536x1024.png)

视觉审阅结果：

- Morning 相对 Day 更亮、对比更柔和，未出现明显蓝滤镜或额外晨雾。
- Day 保持现有 V2 Scene 的综合色调和原 Overlay 基准。
- Sunset 轻微转暖并降低曝光，青绿色空间身份仍在，没有强橙或紫红 LUT。
- Night 明显降低曝光并稍冷，但水池、喷泉、空间层次和 UI 仍可识别，没有黑屏、霓虹或游戏 HUD 感。
- 四张的机位、水池、喷泉中心轴、缩放、布局和 UI 构图一致。
- 即使忽略时间文字，四档的整体亮度、冷暖和对比方向可大致辨认；时间环境没有压过喷泉的 Pressure 表达。

现有 `1536×1024`、`1654×960`、`1920×1080` 三档桌面构图 E2E 继续通过。

## 9. 浏览器验证说明

项目 Playwright Chromium 完成全部自动化渲染、交互和截图验证。

Browser Harness 的独立交互检查因本机 Chrome 弹出 “Allow remote debugging” 权限确认而被阻断。未替用户修改 Chrome 权限，也未降低项目 Playwright 的断言。该限制不影响本报告列出的 Chromium E2E 和截图结果，但独立连接到用户 Chrome 的人工式复核未执行。

## 10. 未实现与后续候选

第一阶段未实现：

- Life Phase。
- Day Completed / Rest。
- 天气、定位、真实 sunrise/sunset 或 AI 状态判断。
- Morning、Sunset 或 Night 专用视频资产。
- Routine 与 Weekly Review。

后续只有在第一阶段真实使用证明 Environment Modifier 不足时，才评估最少量专用资产。第二阶段不会自动开始，需要单独确认范围。
