# Life Assistant V3.1
# Today Scene 2.0 / Scene State Engine 设计方案

## 1. V3.1 版本定位

V3.1 不重新设计 Today 页面，也不重新制作一套独立的 Today Scene。

V2 已经完成了 Today Scene 的核心转变：

> Today Scene 不再是“网页 + 喷泉视频”，而是一个由 Today Data 驱动、会随当天状态发生变化的完整环境。

当前 V2 数据链路已经形成：

```text
Today Data
↓
Pressure
↓
Scene State
↓
Calm / Balanced / Busy / Intense
↓
Today Scene Video
+
Environment
+
UI Overlay
```

V2 的最终目标也已经明确：

> 用户感知的不是“这里切换了一段视频”，而是“我今天的状态变了，所以这个空间也随之发生了变化”。

因此 V3.1 不推翻这一逻辑。

V3.1 的任务是：

> **在“Today Scene 能理解今天的压力”基础上，让它进一步理解用户当前所处的时间和生活阶段。**

最终将 Today Scene 从单一 Pressure State，升级为：

# Multi-dimensional Scene State

即：

```text
Today Scene
=
Pressure State
+
Time State
+
Life Phase
+
Special Scene State
```

但所有新增状态仍然必须服务于一个核心原则：

> **用户看到的是同一个空间随着一天自然变化，而不是在切换不同主题、皮肤或场景。**

---

# 2. V3.1 核心原则

## 2.1 V2 是基础，不重构成熟能力

必须继续保留：

- StaticMasterFrame
- SceneVideoLayer
- 双 Video Layer Crossfade
- Calm / Balanced / Busy / Intense
- Pressure Score
- UI Overlay
- 视频 preload
- fallback
- visibility 生命周期
- reduced-motion
- 页面离开暂停
- UI 独立 React / HTML 组件

当前 Today Scene 已明确采用：

```text
SceneBase
↓
SceneVideoLayer
↓
EnvironmentOverlay
↓
UIOverlay
```

其中：

> Scene 是底层世界，UI 是浮在世界上方的信息层。

V3.1 必须继续遵循这一分层。

不得为了实现新的环境状态重新破坏现有结构。

---

# 3. V3.1 最大变化：Scene State 从一维升级为多维

V2 的 Scene State 只有一个主要维度：

```text
Pressure
```

当前映射继续保持：

```text
0–24
→ Calm

25–49
→ Balanced

50–74
→ Busy

75–100
→ Intense
```

这一映射已经是 Today Scene 的核心业务关系，V3.1 不修改。

V3.1 在 Pressure State 旁边增加新的环境状态维度。

建议最终状态模型：

```text
TodaySceneState
│
├── PressureState
│   ├── calm
│   ├── balanced
│   ├── busy
│   └── intense
│
├── TimeState
│   ├── morning
│   ├── day
│   ├── sunset
│   └── night
│
├── LifePhase
│   ├── work
│   ├── life
│   └── neutral
│
└── SpecialState
    ├── none
    ├── dayCompleted
    └── rest
```

注意：

V3.1 第一阶段不一定必须全部实现。

核心优先级为：

```text
PressureState
+
TimeState
```

LifePhase 和 SpecialState 可以作为第二阶段能力。

---

# 4. Pressure State 的职责保持不变

Pressure State 只回答一个问题：

> **今天现在有多忙？**

它负责：

- 喷泉强度
- 水流视觉强弱
- 场景动态程度

对应：

```text
Calm
Balanced
Busy
Intense
```

不要让 Time State、Work / Life 或其他状态重新修改 Pressure 的业务含义。

例如：

```text
09:00
pressure = 10
```

仍然是：

```text
Calm
```

```text
22:00
pressure = 10
```

仍然也是：

```text
Calm
```

区别只能来自时间环境。

不能因为晚上就自动把 Calm 改成 Balanced。

---

# 5. Time State

Time State 是 V3.1 最重要的新能力。

它回答：

> **现在处于一天中的哪个阶段？**

初步划分建议：

```text
Morning
Day
Sunset
Night
```

默认时间段可以先使用固定本地时间规则，例如：

```text
Morning
05:00–10:59

Day
11:00–16:59

Sunset
17:00–19:29

Night
19:30–04:59
```

具体边界在实施阶段可根据实际视觉效果微调。

V3.1 初期不需要依赖：

- 天气 API
- 地理位置
- 实际日出日落 API
- AI

优先保持：

> 本地、稳定、低成本、可预测。

未来如果产品需要，再考虑真实 sunrise / sunset。

---

# 6. Time State 不应该成为“主题切换”

用户不能感受到：

```text
Morning Theme
↓
Day Theme
↓
Night Theme
```

Today Scene 不是主题商城。

正确体验应该是：

```text
早晨
↓
空间自然变亮

下午
↓
保持正常状态

傍晚
↓
环境逐渐变暖

夜晚
↓
环境自然变暗
```

整个过程中：

- 水池位置不变
- 喷泉位置不变
- UI 构图不变
- 场景机位不变
- 页面布局不变

用户应该始终认为：

> **这里还是今天早上看到的那个空间，只是时间过去了。**

---

# 7. Time State 的视觉职责

## Morning

视觉目标：

> 清晨、刚开始、安静、空气清透。

建议：

- 整体略亮
- 色温稍冷
- 对比度稍低
- Mist 感知可以略明显，但不新增程序化 Mist
- 保持柔和

禁止：

- 明显蓝色滤镜
- 夸张晨雾
- 大面积白雾
- Sunrise 特效

---

## Day

Day 作为标准基准环境。

尽量接近当前 V2 已完成的 Scene Video 原始综合色调。

建议：

```text
Day = baseline
```

这样其他状态全部相对于 Day 做微调。

---

## Sunset

目标：

> 一天正在过渡，而不是突然变成橙色滤镜。

建议：

- 略暖
- 局部高光稍暖
- 整体亮度略降
- 保留原有青绿色环境身份

禁止：

- 强橙色遮罩
- 紫红天空滤镜
- 电影级夸张 sunset LUT

---

## Night

目标：

> 今天进入夜间，但仍然是同一个 Today Scene。

建议：

- 整体曝光下降
- 色温稍冷
- UI 周围保持可读
- 场景仍应保留空间结构
- 水池和喷泉仍能识别

禁止：

- 直接黑屏式变暗
- 大面积深蓝遮罩
- 霓虹化
- 游戏 HUD 化
- Cyberpunk 化

---

# 8. V3.1 第一阶段不要直接生成 16 条视频

理论上：

```text
4 Pressure States
×
4 Time States
=
16 Scene Variants
```

但 V3.1 第一阶段禁止直接采用这种实现。

原因不是技术上做不到，而是会迅速增加：

- 视频资产数量
- 包体积
- preload 成本
- QA 数量
- 视频构图一致性风险
- Crossfade 复杂度
- 状态组合维护成本

因此第一阶段采用：

```text
4 个 Pressure 视频
+
Time Environment Modifier
```

即：

```text
Calm Video
Balanced Video
Busy Video
Intense Video

↓

Time Environment
Morning / Day / Sunset / Night
```

V2 视频仍然负责主要真实环境内容。

V3 的 Time State 只负责：

> **环境级统一变化。**

---

# 9. Environment Modifier 原则

V2 已明确规定：

视频本身已经负责：

- 水
- Mist
- Splash
- Light
- Reflection

CSS / EnvironmentOverlay 只进行轻量环境统一。

V3.1 必须继承这一原则。

所以 Time State 可以控制：

```text
brightness
contrast
temperature
overlay opacity
vignette
UI readability gradient
```

但不能重新增加：

- Canvas 水体
- CSS 水花
- 大量粒子
- 第二套 Mist
- 程序化喷泉
- 强 Glow
- 动态光斑系统

原则：

> **Time State 改变空气，不重新制造世界。**

---

# 10. 建议新增 Scene Environment Model

建议在当前 FountainSceneState 之外建立一个更高层的 Today Scene 状态模型。

例如：

```text
TodaySceneState {
  pressureState
  timeState
  lifePhase
  specialState
}
```

视觉配置单独建立：

```text
SceneEnvironmentProfile
```

例如概念结构：

```text
morning {
  brightness
  contrast
  warmth
  overlayOpacity
}

day {
  ...
}

sunset {
  ...
}

night {
  ...
}
```

不要把这些值直接散落到 React JSX。

也不要出现：

```text
if night
style...
else if sunset
style...
```

大量散乱判断。

---

# 11. Pressure 与 Time 必须正交

必须保证：

```text
PressureState
```

和：

```text
TimeState
```

各自拥有清晰职责。

正确关系：

```text
pressure = 82
time = morning

↓

PressureState = intense
TimeState = morning

↓

Intense Fountain
+
Morning Environment
```

另一个例子：

```text
pressure = 8
time = night

↓

Calm Fountain
+
Night Environment
```

不能建立诸如：

```text
MorningIntense
NightCalm
SunsetBusy
```

这样的业务状态枚举。

否则状态组合会快速爆炸。

组合应该发生在：

> Rendering / Scene Composition

而不是业务状态层。

---

# 12. Time State Transition

时间状态切换也必须遵循 Today Scene 原本的哲学：

> 像环境变化，而不是 UI 切换。

不能：

```text
18:59 Day
19:00 Night
```

瞬间跳变。

建议 Time Environment 使用较长的过渡动画。

例如：

```text
3–8 秒
```

甚至未来可以进一步支持非常缓慢的连续变化。

V3.1 第一阶段只需要保证：

```text
Morning → Day
Day → Sunset
Sunset → Night
Night → Morning
```

不存在明显闪变即可。

---

# 13. Pressure Crossfade 与 Time Transition 必须解耦

当前 V2 Pressure 视频使用双层 Crossfade。

这一逻辑继续独立工作。

例如：

```text
Balanced
→
Busy
```

继续使用原有 Video A / Video B。

同时 Time Environment：

```text
Day
→
Sunset
```

通过 EnvironmentOverlay 自己完成渐变。

不要把两套 transition 合并成一套复杂状态机。

---

# 14. Life Phase

Life Phase 是 V3.1 的第二阶段能力。

它回答：

> **用户现在处于工作还是生活阶段？**

状态：

```text
work
life
neutral
```

但 V3.1 不应该依赖用户手动点一个：

```text
Work Mode
Life Mode
```

如果现有系统已经存在可靠状态来源，可以使用。

如果目前没有可靠数据来源：

> 第一阶段先保留接口，不强行实现自动判断。

不能为了让 Life Phase 工作而凭空猜测用户正在工作还是生活。

---

# 15. Life Phase 的视觉影响必须极弱

当前产品已经有 Work / Life 的视觉语言。

但 Today Scene 不应该因此突然变成两个不同 App。

Life Phase 最多影响：

- 极轻色温
- UI Accent
- 少量环境偏色
- 某些状态卡强调色

不应该：

```text
Work = 蓝色场景
Life = 绿色场景
```

大幅切换。

Today Scene 的空间身份必须始终保持一致。

---

# 16. Special Scene State

V3.1 后期可以加入：

```text
dayCompleted
rest
```

但不是第一阶段必做。

## Day Completed

触发条件可以来自：

- 今日关键计划完成
- 今日计划全部完成

表现建议：

非常轻微。

例如：

- 环境稍微放松
- UI 给出完成反馈
- Scene 恢复更平静的状态表达

禁止：

- 烟花
- 大量粒子庆祝
- 游戏结算页
- 全屏动画

---

## Rest

Rest 表示：

> 今天的主动工作已经结束。

它不是新的 Pressure State。

即使当前 Pressure 原始数据很高，也不应该直接篡改历史压力值。

Rest 更接近：

```text
Scene Phase
```

而不是：

```text
Pressure
```

具体业务规则等 V3.2 Automation 设计完成后再决定。

V3.1 可以仅预留结构。

---

# 17. Today Scene 最终组合逻辑

V3.1 最终目标：

```text
Today Data
│
├── Pressure
│   ↓
│   PressureState
│   ↓
│   Calm / Balanced / Busy / Intense Video
│
├── Current Local Time
│   ↓
│   TimeState
│   ↓
│   Morning / Day / Sunset / Night Environment
│
├── Life State
│   ↓
│   LifePhase
│
└── Special Conditions
    ↓
    SpecialState
```

最后进入：

```text
TodaySceneRenderer
```

生成：

```text
SceneBase
+
Pressure Video
+
Environment Modifier
+
UI Overlay
```

---

# 18. UI 继续保持独立

V3.1 不重新设计 Today UI。

所有现有：

- Pressure Panel
- 时间
- Timeline
- 今日计划
- 即将开始
- 弹性任务
- AI Composer
- 状态文字

继续作为真实 UI Overlay。

V2 已明确要求这些内容不得烘焙进视频。

V3.1 环境变化不得：

- remount TodayPage
- 重置 Timeline
- 丢失 AI 输入
- 改变输入焦点
- 重置任务组件
- 导致右栏重新布局

---

# 19. 性能原则

V3.1 不应该显著提高 Today 页面持续运行成本。

继续遵守：

- 稳态最多播放 1 个视频
- Crossfade 时最多 2 个视频可见
- 页面离开暂停
- document 不可见暂停
- reduced-motion 停止持续视频
- 不重新启用 Canvas 水体

V2 已将这些作为正式性能目标。

Time State 应主要依赖：

- CSS variable
- overlay
- lightweight visual transform

不得为了时间环境引入持续高频 JS 动画循环。

---

# 20. reduced-motion

如果：

```text
prefers-reduced-motion
```

启用：

继续遵循 V2：

- 视频停止持续播放
- 使用 StaticMasterFrame 或静止帧
- Pressure / Timeline / Task / AI 正常工作

但 Time State 仍然可以存在。

例如：

```text
Static Scene
+
Night Environment Modifier
```

即：

> reduced-motion 禁止持续运动，不等于禁止状态表达。

---

# 21. V3.1 第一阶段实施范围

第一阶段只实现：

## A. TodaySceneState 基础模型

支持：

```text
pressureState
timeState
```

---

## B. Time State Resolver

建立：

```text
getTodayTimeState()
```

输出：

```text
morning
day
sunset
night
```

---

## C. Environment Profile

建立：

```text
SceneEnvironmentProfile
```

为四个 Time State 定义轻量环境参数。

---

## D. Environment Transition

四个时间状态之间平滑切换。

---

## E. 与现有 Pressure Scene 联动验证

测试：

```text
Morning + Calm
Morning + Intense

Day + Calm
Day + Intense

Sunset + Calm
Sunset + Intense

Night + Calm
Night + Intense
```

确认：

> Pressure 和 Time 可以任意组合。

---

# 22. 第一阶段明确不做

暂不：

1. 重新生成 16 条状态视频。
2. 接入实时天气。
3. 接入地理位置。
4. 请求 Sunrise / Sunset API。
5. 使用 AI 决定场景状态。
6. 做天气粒子。
7. 做雨雪场景。
8. 做大量动态灯光。
9. 做复杂 3D Scene。
10. 重做 Today UI。
11. 修改 Pressure 算法。
12. 修改四档 Pressure 边界。
13. 自动判断复杂 Work / Life 行为。
14. 实现完整 Day Completed Automation。
15. 实现 Routine。
16. 实现 Weekly Review。

后 15、16 属于 V3.2。

---

# 23. V3.1 第二阶段候选

第一阶段稳定后，根据实际视觉效果决定是否继续：

## Option A

加入 Life Phase。

## Option B

加入 Day Completed / Rest。

## Option C

如果 Night 环境仅靠 Environment Modifier 明显不够真实：

仅为 Night 制作专用环境资产。

## Option D

如果 Morning / Sunset 也确实需要不同光照：

逐步增加专用 Scene Asset。

原则：

> 根据视觉需求增加资产，而不是预先生成全部组合。

---

# 24. 资产升级规则

未来如果需要独立 Time Scene Video：

必须继续满足 V2 的一致性要求：

- 同一构图
- 同一机位
- 同一水池位置
- 同一喷泉中心轴
- 同一空间比例
- 相同主要环境结构

V2 已明确要求视频和 StaticMasterFrame、不同状态视频之间不能出现水池跳动、机位变化、缩放变化。

这一规则在 V3 继续有效。

---

# 25. V3.1 QA Matrix

至少测试：

```text
Calm + Morning
Calm + Day
Calm + Sunset
Calm + Night

Balanced + Morning
Balanced + Day
Balanced + Sunset
Balanced + Night

Busy + Morning
Busy + Day
Busy + Sunset
Busy + Night

Intense + Morning
Intense + Day
Intense + Sunset
Intense + Night
```

不一定每种组合都需要单独截图。

但必须确认：

- 无状态冲突
- 无错误视觉叠加
- Pressure 视频正常
- Time Environment 正常
- UI 可读
- 场景结构一致

---

# 26. Transition QA

必须测试：

```text
Morning
→ Day
→ Sunset
→ Night
```

以及：

```text
Night
→ Morning
```

同时模拟 Pressure 变化：

```text
Morning + Calm
↓
Morning + Busy
↓
Day + Busy
↓
Sunset + Intense
↓
Night + Calm
```

要求整个过程中用户始终感觉：

> 同一个 Today Scene 正在变化。

不能出现：

> 场景模式被切换。

---

# 27. V3.1 视觉验收标准

## A. 第一眼

仍然必须首先感受到：

> 完整 Today Scene。

不是：

> Dashboard + 动态壁纸。

---

## B. Pressure

即使隐藏 Pressure 数字：

仍然能够从喷泉大致感知：

```text
Calm
Balanced
Busy
Intense
```

这一点继续保持 V2 的验收原则。

---

## C. Time

即使没有显示时间文字：

用户也应该能够大致感受到：

```text
清晨
白天
傍晚
夜间
```

但不能强烈到抢走 Pressure Scene 的主要视觉职责。

---

## D. 两者组合

用户最终感受到的应该类似：

> “今天晚上比较平静。”

而不是：

> “现在是 Night Theme + Calm Animation。”

---

# 28. V3.1 技术验收

至少确认：

- TypeScript Pass
- lint Pass
- production build Pass
- 浏览器 console 无新增错误
- 四个 Pressure State 正常
- 四个 Time State 正常
- Pressure Crossfade 无回归
- Time Transition 无闪变
- 页面离开后视频暂停
- document hidden 后暂停
- reduced-motion 正常
- AI Composer 内容不丢失
- Timeline 不重建
- 任务卡无回归

---

# 29. V3.1 完成后的输出报告

完成后输出：

## 1. Scene State 架构

说明：

```text
PressureState
TimeState
LifePhase
SpecialState
```

实际实现了哪些。

---

## 2. Time State 规则

明确：

```text
Morning
Day
Sunset
Night
```

对应时间。

---

## 3. Environment Profile

说明每个 Time State 实际改变：

- brightness
- contrast
- warmth
- overlay
- vignette

中的哪些。

---

## 4. V2 保留能力

明确说明：

- Pressure Mapping
- Crossfade
- preload
- fallback
- reduced-motion
- lifecycle

是否保持原实现。

---

## 5. QA

提供：

- 四档 Pressure 测试
- 四档 Time 测试
- 组合状态测试
- build / lint / TypeScript
- console

---

## 6. 视觉材料

建议：

- Morning
- Day
- Sunset
- Night

各至少一张。

优先使用相同 Pressure State 进行比较。

例如：

```text
Balanced Morning
Balanced Day
Balanced Sunset
Balanced Night
```

这样更容易判断纯 Time Environment 的效果。

---

# 30. V3.1 最终定义

V2 完成的是：

> **Today Scene 能够感知今天的压力。**

V3.1 要完成的是：

> **Today Scene 开始感知“今天正在发生到哪里”。**

用户不需要：

- 选择主题
- 切换场景
- 设置喷泉
- 选择白天或夜晚

Today Scene 自己根据：

```text
Today Data
+
Current Time
```

自然发生变化。

最终形成：

```text
Pressure
决定空间的强弱

Time
决定空间的时间感

Life Phase
决定空间当前所处阶段

Special State
决定特殊生活节点
```

但无论多少状态叠加：

> **它始终是同一个 Today Scene。**

V3.1 最核心的验收标准不是增加了多少视觉效果。

而是：

> **当用户从早上到晚上多次打开 Today 页面时，他能够感觉这个空间和自己一起经历了这一天。**
