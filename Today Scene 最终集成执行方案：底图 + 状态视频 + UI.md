# Today Scene 最终集成执行方案

## 1. 本轮任务定义

目前 Today Scene 的静态环境底图已经完成，Calm / Balanced / Busy / Intense 四档喷泉视频素材也已经上传到项目文件夹，并已经进行了基本连贯性处理。

本轮进入 Today 页最后一个核心集成阶段。

不要再重新设计喷泉，不要再重做视频资产，也不要回到 Canvas 高拟真喷泉方案。

本轮目标是：

> **将场景底图、四档喷泉视频、Today 实时数据和现有 UI 真正融合成一个统一的 Today Scene，并根据压力指数平滑切换喷泉状态。**

最终用户不应该感觉到：

> 页面里嵌入了一段视频。

而应该感觉：

> **整个 Today 页面本身就是一个会随着当天状态变化而呼吸的场景。**

---

# 2. 本轮需要完成的 5 个核心模块

本轮重点完成：

1. **Today Scene 视频播放层**
2. **压力状态映射**
3. **双视频交叉切换**
4. **UI Overlay 融合**
5. **轻量环境增强与性能处理**

五项完成后，再进行最终视觉 QA。

---

# 3. 开始编码前先做资产与现有代码审计

不要先直接写播放器。

首先检查：

## 3.1 当前 Today Scene 结构

确认：

- Today 页面根组件
- Scene 背景层
- 当前静态喷泉层
- 当前环境底图
- Pressure 数据来源
- Current Time 数据来源
- Today Timeline
- 今日计划
- 即将开始
- 弹性任务
- AI 输入框
- reduced-motion
- 页面可见性生命周期

明确哪些现有代码继续保留。

---

## 3.2 检查项目内视频资产

自动找到实际上传的：

- Calm
- Balanced
- Busy
- Intense

四档视频。

不要根据本任务描述猜文件名，以项目中的实际文件为准。

检查：

- 文件路径
- 视频格式
- 宽高比
- 分辨率
- 时长
- 是否包含音轨

如果四条视频存在不同尺寸或比例：

不要拉伸。

优先保证统一的视觉裁切策略。

如果差异已经明显影响喷泉位置一致性，应先报告问题，而不是用 CSS 强行掩盖。

---

# 4. 最终 Today Scene 分层结构

建议最终结构明确为：

```text
TodayPage
│
├── Sidebar
│
└── TodayScene
    │
    ├── SceneBase
    │   └── StaticMasterFrame
    │
    ├── SceneVideoLayer
    │   ├── VideoLayerA
    │   └── VideoLayerB
    │
    ├── EnvironmentOverlay
    │
    └── UIOverlay
        ├── TodayHeader
        ├── PressurePanel
        ├── TimeStatusCards
        ├── CurrentTime
        ├── PlanCards
        ├── TodayTimeline
        └── AIComposer
```

核心原则：

> **Scene 是底层世界。**
>
> **UI 是浮在世界上方的信息层。**

不要再次把视频包成独立的：

```text
fountain-video-box
```

或其他肉眼能识别出的矩形媒体区域。

---

# 5. SceneBase：静态母版的角色

现有 Today Scene Master Frame / 场景底图继续保留。

但从这一阶段开始，它的主要职责调整为：

### 1. 首次加载占位

视频还没有 ready 时：

显示静态母版。

禁止出现：

- 黑屏
- 闪白
- 空背景
- 视频第一帧加载跳变

### 2. 视频失败 fallback

视频加载失败时：

自动回退到静态 Today Scene。

页面功能继续正常。

### 3. reduced-motion fallback

用户启用：

```css
prefers-reduced-motion
```

时，可以停止持续视频运动，并保持完整静态场景。

---

# 6. SceneVideoLayer：视频必须覆盖整个 Today Scene

视频不是喷泉中央的小矩形。

视频应该作为：

> **整个主环境动态层。**

也就是说：

```text
Today Scene
└── Full Scene Video
```

视频覆盖：

- 喷泉
- 水池
- 环境
- 雾
- 水面
- 场景背景

而 UI 浮在视频上。

---

# 7. 视频容器要求

视频层使用：

```text
position: absolute;
inset: 0;
width: 100%;
height: 100%;
```

根据素材比例选择合理的：

```text
object-fit: cover;
```

并固定：

```text
object-position
```

保证所有状态下：

- 喷泉中心轴不跳
- 水池位置不跳
- 视频切换时场景不缩放
- 水池尺寸不发生视觉变化

如果现有布局需要更精确定位：

优先使用统一的 scene media transform。

不要针对四条视频分别写不同位置。

---

# 8. 视频基础属性

所有视频：

- `muted`
- `playsInline`
- `loop`
- `preload`
- 无 controls
- `pointer-events: none`
- 对辅助技术隐藏

即：

视频只是环境。

不是一个可操作媒体播放器。

即使视频文件本身包含音轨，也不得在 Today 页面播放声音。

---

# 9. 压力状态映射

继续直接使用现有 Pressure Score。

不要重新计算压力。

映射严格为：

```text
0–24
→ calm

25–49
→ balanced

50–74
→ busy

75–100
→ intense
```

建议建立单独函数：

```text
getFountainSceneState(pressure)
```

输出：

```text
calm
balanced
busy
intense
```

不要把判断散落在 React JSX 或播放器逻辑中。

---

# 10. Scene State 模型

建议建立：

```text
FountainSceneState
```

至少包含：

```text
state:
calm | balanced | busy | intense

pressure:
number

videoSrc:
string
```

如果后续继续扩展，可增加：

```text
environmentIntensity
mistOverlay
warmth
contrast
```

但当前不要过度工程化。

---

# 11. 初始状态

页面打开时：

如果 Today Pressure 已经加载：

直接使用对应状态。

例如：

```text
pressure = 6
→ calm
```

不要：

先播 Balanced
→ 再突然切 Calm。

如果 Pressure 尚未加载：

先显示：

**StaticMasterFrame**

等 pressure ready 后，再启动对应视频。

这样可以避免打开 Today 时出现不必要的视频状态跳变。

---

# 12. 最重要：不要单 Video src 硬切

禁止使用：

```text
video.src = nextVideo
```

然后直接替换。

这种方式很容易产生：

- 黑帧
- 闪一下
- 第一帧跳变
- 视频重新加载
- 场景明显换片

本项目应使用：

# 双 Video Layer Crossfade

---

# 13. 双视频交叉切换结构

始终保留两个视频层：

```text
Video A
Video B
```

例如：

当前：

```text
A = Balanced
opacity 1

B = hidden
opacity 0
```

压力变成 Busy：

先：

```text
B preload Busy
```

等 Busy ready 后：

```text
A opacity 1 → 0
B opacity 0 → 1
```

完成后：

```text
B 成为 active
A 成为 standby
```

下一次继续交换角色。

---

# 14. Crossfade 时间

建议：

**1.4～1.8 秒。**

默认先使用：

```text
1500ms
```

目标：

用户感觉：

> 水压逐渐发生变化。

而不是：

> 页面换了一条视频。

不要使用非常短的：

```text
200–400ms
```

那会看起来像 UI 切换。

也不要超过约：

```text
2.5s
```

否则状态响应显得迟钝。

---

# 15. Crossfade easing

使用克制、平滑的：

```text
ease-in-out
```

或类似柔和 easing。

不要：

- bounce
- spring
- elastic
- overshoot

喷泉状态切换必须像环境变化。

---

# 16. 视频相位同步

如果四条视频：

- 时长相同
- 构图相同
- 都为循环素材

切换前尽量同步播放进度。

例如：

当前视频播放到：

```text
3.2 / 8 秒
```

新视频进入时：

也尽量从：

```text
≈ 3.2 秒
```

开始。

这样 Crossfade 时：

水流运动更容易对得上。

如果视频时长不同：

使用归一化进度：

```text
currentTime / currentDuration
```

映射到 next video。

例如：

```text
progress = 0.4

nextTime =
nextDuration × 0.4
```

这一步不是绝对要求，但如果实际效果更连贯，应保留。

如果相位同步反而造成某条生成视频跳变：

以实际视觉测试结果为准。

---

# 17. 视频预加载

四条视频都属于 Today 核心资产。

建议：

页面进入 Today 后：

### 第一优先级
加载当前状态视频。

### 第二优先级
后台预加载其他三条。

因为状态切换时不能等用户看到 loading。

四条视频数量有限，不需要设计复杂流媒体系统。

---

# 18. 防止重复切换

压力发生变化时：

只有当：

```text
nextState !== currentState
```

才切换。

例如：

```text
pressure 31 → 36
```

都属于：

```text
balanced
```

因此：

**不重新播放、不 Crossfade。**

只有跨档：

```text
49 → 50

balanced → busy
```

才执行状态切换。

---

# 19. 快速连续状态变化

如果正在 Crossfade：

```text
balanced → busy
```

此时压力又突然进入：

```text
intense
```

不要并发启动第三套动画。

应该：

- 结束或安全接管当前 transition
- 使用当前可见度最高的视频作为 active
- 再转向最新 state

确保始终：

**最多只有两个视频同时可见。**

---

# 20. UI Overlay

所有现有业务 UI：

必须继续使用真实 HTML / React 组件。

绝对不要把：

- 日期
- 压力数字
- 今日计划
- 时间
- 时间轴
- AI 输入

烘焙进视频。

---

# 21. UI Overlay z-index 层级

建议逻辑层级：

```text
Scene Base
z = 0

Video Layer
z = 1

Environment Enhancement
z = 2

UI Overlay
z = 10+
```

左侧导航继续位于 Today Scene 外层或独立更高层。

---

# 22. UI 必须“浮”在环境上

当前场景改造之后：

不要再给主内容添加大量不透明背景。

右侧：

- 今日计划
- 即将开始
- 弹性任务

继续保持独立玻璃卡。

视频场景必须能通过：

- 卡片之间
- 卡片透明区域
- 状态卡附近

被感知到。

否则视频仍然只是被 UI 挡住的背景素材。

---

# 23. 环境增强层 EnvironmentOverlay

视频本身负责主要视觉。

代码只允许进行：

**轻量环境统一。**

不要重新通过 CSS 特效“改造视频”。

---

# 24. 可以加入的轻量环境增强

### 顶部柔和暗层

为了保证：

- 日期
- 状态语句
- 天气

可读。

使用非常轻微：

```text
transparent
→ teal dark alpha
```

渐变。

---

### 底部柔和暗层

时间轴和 AI 输入附近：

可以轻微压暗环境。

但不要形成明显：

```text
footer rectangle
```

---

### 左右轻微 Vignette

非常弱。

目的：

让视觉自然向中央喷泉集中。

---

### 轻微统一色调

如果四条视频色温存在极微小差异：

可以在整个 Scene 上增加非常弱的：

```text
teal overlay
```

统一综合色调。

但不要用强 Filter 把视频压回目前那种：

**死绿色。**

---

# 25. 环境增强禁止项

禁止：

- 大面积绿色遮罩
- 高 opacity 色层
- 强 blur
- 强 glow
- 霓虹
- 强 saturation
- CSS 粒子铺满页面
- 再造一个“绿色游戏 HUD”

视频本身已经负责：

- 水
- Mist
- Splash
- 光
- Reflection

CSS 不需要重复造。

---

# 26. Pressure Panel 与视频的关系

压力数字继续真实展示。

例如：

```text
压力指数

6

轻松
```

同时视频：

```text
calm
```

两者来自：

**同一份 Pressure 数据。**

禁止：

PressurePanel 使用一个判断，

Scene Video 使用另一套判断。

统一：

```text
Today Pressure
      ↓
Scene State
      ↓
Video + UI
```

---

# 27. 当前时间与时间轴

视频切换不能影响：

- 当前时间
- 当前状态
- 当前时间光标
- Timeline
- Timeline 点击
- 时间块详情

这些全部继续是 UI Overlay。

视频只改变：

**Today 的环境状态。**

---

# 28. 页面切换生命周期

用户离开 Today 页面时：

暂停视频播放。

避免后台持续解码。

再次进入 Today：

恢复对应状态。

如果当前 Pressure 已经改变：

直接恢复到最新对应状态。

---

# 29. document.visibilityState

浏览器标签页不可见时：

暂停所有 Scene Video。

恢复可见时：

只恢复：

**当前 Active Video。**

Standby Video 不需要同时播放。

除非正在 transition。

---

# 30. reduced-motion

检测：

```text
prefers-reduced-motion
```

如果启用：

不要持续播放喷泉视频。

使用：

- Scene Master Frame
或
- 视频静止帧

保持：

- Pressure 数字
- 状态文字
- Timeline
- 任务
- AI

正常工作。

---

# 31. 自动播放失败 fallback

如果浏览器因任何原因阻止播放：

Today 页面不能出错。

继续显示：

```text
Static Master Frame
```

UI 完全正常。

可以在内部记录播放失败，但不要弹出打断式错误。

---

# 32. 视频加载失败 fallback

某一状态资产加载失败：

优先：

1. 保留当前可播放状态
2. 或 fallback 静态母版

不要：

- 黑屏
- 白屏
- 隐藏整个 Today Scene
- 导致 React 页面报错

---

# 33. 视频和静态母版必须完全对齐

这是视觉验收的重点。

在加载过程：

```text
Master Frame
↓
Video
```

不应该看到：

- 水池跳动
- 喷泉位置移动
- 画面缩放
- 机位变化

如果出现：

首先调整统一的：

```text
object-position
transform
scene crop
```

而不是针对某条视频单独 hack。

---

# 34. 视频切换时也必须保持对齐

测试：

```text
Calm
→ Balanced
→ Busy
→ Intense
```

切换过程中：

用户应该主要感知：

> 水压增强。

而不是：

> 场景变化。

如果：

- 水池跳
- 背景变
- 喷泉左右移动

说明素材或媒体定位仍然存在问题。

优先解决。

---

# 35. 不再保留旧动态喷泉视觉

在视频方案稳定运行后：

当前旧的：

- Canvas 水柱
- Canvas Arc
- 旧粒子
- 重复 Mist
- 重复水面效果

如果只是为了旧喷泉视觉存在：

应停止渲染或移除。

不要出现：

```text
AI 视频喷泉
+
Canvas 喷泉
```

两套水体同时播放。

这不仅浪费性能，也容易产生违和感。

---

# 36. 可以保留的程序化元素

仅保留真正属于 UI / 数据表达的内容：

- 当前时间光标
- Timeline
- Pressure
- 状态文本
- Task UI
- Plan UI
- AI Composer
- 极轻的环境 Overlay

不要继续程序化模拟真实水。

---

# 37. 推荐组件职责

如果当前项目结构允许，可以抽象：

## TodaySceneMedia

负责：

- 视频播放器
- 双层 Crossfade
- preload
- pause / resume
- fallback

---

## FountainSceneState

负责：

```text
pressure
→
calm / balanced / busy / intense
```

---

## TodayEnvironmentOverlay

负责：

- 顶部可读性渐变
- 底部可读性渐变
- 极弱 vignette

---

## TodayScene

统一组合：

```text
SceneBase
SceneMedia
EnvironmentOverlay
UIOverlay
```

名称可根据现有工程规范调整。

不要为了完全匹配这些名字破坏已有组件结构。

---

# 38. 性能目标

重点不是追求复杂渲染性能。

视频方案本身已经大幅减少 Canvas 运算。

要求：

- 只允许最多两个 video 同时处于过渡状态
- 正常稳定状态尽量只播放一个
- 页面不可见暂停
- 离开 Today 暂停
- reduced-motion 不播放
- 不重复叠加 Canvas 水体

目标：

普通桌面浏览器长期打开 Today 页面仍然稳定。

---

# 39. 本轮视觉 QA 状态

开发完成后，必须人工测试四档：

## Case A

```text
pressure = 10
```

期望：

```text
Calm
```

---

## Case B

```text
pressure = 35
```

期望：

```text
Balanced
```

---

## Case C

```text
pressure = 60
```

期望：

```text
Busy
```

---

## Case D

```text
pressure = 85
```

期望：

```text
Intense
```

---

# 40. 边界值测试

必须测试：

```text
0
24
25
49
50
74
75
100
```

确保：

```text
0–24 Calm
25–49 Balanced
50–74 Busy
75–100 Intense
```

不存在：

- overlap
- gap
- off-by-one

---

# 41. Crossfade QA

至少依次测试：

```text
Calm → Balanced
Balanced → Busy
Busy → Intense
Intense → Busy
Busy → Balanced
Balanced → Calm
```

检查：

- 无黑帧
- 无闪白
- 无缩放
- 无明显换场
- 无视频重置感
- 无场景跳动

---

# 42. 最重要的一组连续测试

模拟：

```text
6
→
32
→
58
→
82
→
40
```

用户应该感知：

> 喷泉逐级变强，
> 然后重新平静下来。

整个 Today Scene 不应该出现：

> 不断换视频文件。

的感觉。

---

# 43. UI QA

切换视频期间：

必须保证：

- Pressure 卡不闪
- 当前时间不重置
- Timeline 不重建
- 任务列表不消失
- 右栏不抖动
- AI 输入内容不丢失
- 输入焦点不被视频切换抢走

视频状态变化：

**不得触发整个 TodayPage remount。**

---

# 44. 静态视觉最终比较

再次使用：

**1536 × 1024**

与总参考图进行对比。

重点不再只看喷泉。

检查：

- 喷泉占比
- 水池位置
- Pressure Panel
- 四个状态卡
- 三张右栏卡
- 当前时间
- Timeline
- AI 输入
- 色彩
- 场景明暗
- 留白
- 整体沉浸感

---

# 45. UI 位置精调

注意：

之前场景底图改造阶段：

**UI 位置没有进行完整最终调整。**

因此视频集成稳定后，本轮还需要进行最后一次：

### UI Fine Tuning

重点调整：

- Pressure Panel 与喷泉距离
- 四状态块位置
- 三张右栏卡宽度与间距
- 当前时间位置
- Timeline 高度和宽度
- AI 输入框位置
- 顶部状态语句与天气
- 喷泉与 UI 的遮挡关系

目标继续以：

**总参考图的位置和感觉为基准。**

不要因为当前已有位置能用，就默认其已经完成。

---

# 46. 最终验收标准

## A. 场景

第一眼必须感受到：

> 完整 Today Scene。

而不是：

> 网页 + 视频背景。

---

## B. 视频

必须：

- 循环自然
- 状态明显
- 无黑帧
- 无明显切片
- 无场景跳动

---

## C. 数据

Pressure 与视频状态严格一致。

---

## D. UI

所有 UI 继续是真实可交互组件。

---

## E. 状态

即使遮住 Pressure 数字：

也能够从喷泉状态大致判断：

```text
平静
正常
忙碌
高压
```

---

## F. 整体风格

最终不应该：

- 像视频播放器
- 像游戏 HUD
- 像 Canvas 技术演示
- 像背景 GIF

而应该：

> 像整个产品拥有一个会随着今天状态变化的真实环境。

---

# 47. 明确禁止项

本轮禁止：

1. 单 video 直接换 src 造成闪帧。
2. 视频放进独立矩形框。
3. 四条视频使用不同 CSS crop。
4. 状态改变导致整个 TodayPage 重建。
5. 同时运行旧 Canvas 喷泉和视频喷泉。
6. 视频播放声音。
7. CSS 再叠大量水粒子。
8. 强绿色滤镜破坏视频色彩。
9. 状态切换使用硬切。
10. 视频失败导致 Today 页面失败。
11. 页面后台继续播放视频。
12. reduced-motion 仍强制播放。
13. 为集成视频重构无关业务逻辑。
14. 未完成四档实际切换测试就宣称完成。
15. 视频接入后忽略最终 UI 位置精调。

---

# 48. 推荐执行顺序

严格按照下面顺序实施：

### Phase 1
审计现有代码与四个视频资产。

### Phase 2
建立统一 SceneBase + VideoLayer 结构。

### Phase 3
只接入 Balanced，验证：

- 视频尺寸
- 裁切
- 场景融合
- UI Overlay

### Phase 4
接入四个压力状态映射。

### Phase 5
实现双 Video Crossfade。

### Phase 6
处理 preload / fallback / pause / reduced-motion。

### Phase 7
关闭旧 Canvas 喷泉动态。

### Phase 8
添加极轻量 Environment Overlay。

### Phase 9
做 UI Fine Tuning。

### Phase 10
执行 1536×1024 最终视觉 QA。

---

# 49. 每个阶段的 Gate

不要一次性改完再验收。

## Gate 1

Balanced 单独播放时：

必须已经看不出视频矩形边界。

---

## Gate 2

四档单独播放：

场景位置必须一致。

---

## Gate 3

Crossfade：

不得出现黑帧、跳动或换场感。

---

## Gate 4

Pressure 数据：

必须准确驱动四档。

---

## Gate 5

UI：

所有业务交互无回归。

---

## Gate 6

最终截图：

整体构图与总参考图继续收敛。

---

# 50. 完成后需要输出的报告

本轮完成后，请不要只回复“已完成”。

请输出：

### 1. 视频资产识别结果

列出：

```text
Calm
Balanced
Busy
Intense
```

实际对应文件。

---

### 2. 视频播放架构

说明：

- 使用了哪些组件
- 如何 preload
- 如何 Crossfade
- 如何 fallback

---

### 3. 状态映射

明确：

```text
0–24
25–49
50–74
75–100
```

对应关系。

---

### 4. 删除 / 停止的旧视觉实现

说明：

- 哪些旧 Canvas 喷泉代码停止运行
- 哪些基础生命周期能力继续保留

---

### 5. UI Fine Tuning

说明具体调整了：

- Pressure
- 状态块
- 右栏
- Timeline
- AI 输入

哪些位置。

---

### 6. 验证结果

至少给出：

- 定向测试
- TypeScript
- lint
- production build
- 浏览器 console
- reduced-motion
- 页面后台暂停
- 四状态切换

结果。

---

### 7. 最终视觉材料

提供：

- 1536×1024 实现截图
- 与总参考图并排对比图
- 如果条件允许，提供四档状态切换录屏

---

### 8. 剩余问题

主动指出：

- 当前视觉还与参考图有哪些差距
- 视频素材是否存在微小跳帧
- 哪些 UI 位置还值得继续微调

不要直接宣称“100% 复刻完成”。

---

# 51. 最终任务定义

本轮的目标不是：

> 在 Today 页面播放四条喷泉视频。

而是：

> **把四条视频变成 Today Scene 自身的四种视觉状态。**

Today Data 决定压力。

压力决定 Scene State。

Scene State 决定喷泉环境。

UI 始终漂浮在这个环境之上。

最终形成：

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

用户最终看到的不应该是：

> “这里切换了一段视频。”

而应该是：

> **“我今天的状态变了，所以这个空间也随之发生了变化。”**