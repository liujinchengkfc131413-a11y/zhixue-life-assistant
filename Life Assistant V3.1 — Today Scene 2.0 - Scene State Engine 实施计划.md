# Life Assistant V3.1 Today Scene 2.0 Scene State Engine 实施计划

## 1. 计划结论

V3.1 第一阶段将在现有 Today Scene V2 结构上增加独立的时间环境维度，不重做 Today 页面，不修改 Pressure 算法，也不生成 16 条 Pressure 与 Time 组合视频。

本阶段的最终组合保持为：

```text
TodaySceneState
├── pressureState → 继续驱动现有四档喷泉视频与 Crossfade
└── timeState     → 驱动轻量 Environment Modifier 与独立过渡

TodaySceneRenderer
= SceneBase
+ Pressure Video
+ Time Environment
+ UI Overlay
```

实施拆分为七个可独立验收的节点。每个节点完成后必须先执行节点内的小范围审阅，通过后才允许进入下一节点并建立 Git checkpoint。Feature Spec 直接放在对应节点末尾，不另建独立 Feature Spec 文档。

## 2. 设计依据与范围边界

唯一产品设计依据为《Life Assistant V3.1 — Today Scene 2.0 - Scene State Engine 设计方案》。当前代码只用于确认落点、既有能力和回归边界，不扩展设计范围。

### 2.1 第一阶段必须实现

- `TodaySceneState` 基础模型，只承载 `pressureState` 与 `timeState`。
- `getTodayTimeState()` 本地时间解析器。
- Morning、Day、Sunset、Night 四档 `SceneEnvironmentProfile`。
- Time Environment 的 3 至 8 秒平滑过渡。
- Pressure 与 Time 正交组合。
- 四档 Pressure、四档 Time、组合状态、Transition、生命周期、reduced-motion 和 UI 稳定性验证。

### 2.2 第一阶段明确不做

- 不生成 16 条组合视频，不替换现有四条视频资产。
- 不修改 `0–24 / 25–49 / 50–74 / 75–100` 的 Pressure 边界。
- 不修改当前已校准的 Pressure State 到视频文件映射。
- 不引入天气、定位、日出日落 API 或 AI 状态判断。
- 不增加天气粒子、Canvas 水体、CSS 水花、第二套 Mist、程序化喷泉、强 Glow、复杂动态灯光或 3D Scene。
- 不重做 Today UI，不改变布局、机位、水池位置、喷泉中心轴或场景比例。
- 不实现 Life Phase、Day Completed、Rest、Routine 或 Weekly Review；本阶段不为这些候选能力添加运行时判断。
- 不把 `MorningIntense`、`NightCalm` 等组合建立为业务枚举。
- 不修改已进入 RC 或 Release 的 migration。

## 3. 当前工程基线

### 3.1 必须原样保留的 V2 能力

- `fountain-scene-state.ts` 已实现四档 Pressure 映射和已校准的视频素材映射。
- `today-scene-media.tsx` 已实现 Static Master Frame、双 Video Layer Crossfade、队列取最新状态、预加载、播放失败 fallback、visibility 生命周期和 reduced-motion。
- 稳态最多一条视频播放，Crossfade 时最多两条视频播放。
- `today-immersive-layout.tsx` 已保持 Scene 与 UI Overlay 分层；Timeline、任务区和 AI Composer 是独立 React 组件。
- `today-immersive.css` 已固定 Scene Media 的构图、裁切、位移、缩放和 UI 层级。
- `today-scene-video.spec.ts` 已保护 Pressure Crossfade、fallback、AI 输入焦点、无 Canvas、视频播放数和多视口构图。

### 3.2 V3.1 的时钟来源

继续使用 `today-page.tsx` 已有的 `currentNow`：它基于服务端时间校准，并每 30 秒更新一次。V3.1 不新增高频计时器或持续 JS 动画循环。

`getTodayTimeState()` 按当前 Today UI 使用的本地民用时间解释 `currentNow`，第一阶段采用固定边界：

| Time State | 时间范围 |
|---|---|
| Morning | 05:00–10:59 |
| Day | 11:00–16:59 |
| Sunset | 17:00–19:29 |
| Night | 19:30–04:59 |

时间边界只有在同一节点的视觉证据证明效果不合适时才能微调；任何微调都必须同步修改测试、计划记录和修改日志，不允许只在 CSS 中暗改。

## 4. 节点执行纪律

每个节点统一遵循以下流程：

1. 开始前确认分支仍为 `codex/V3`，并记录当前 `master` 指针。
2. 只修改该节点列出的文件；发现必须扩大范围时先停止并回到计划评审。
3. 先完成定向测试，再执行该节点的小范围审阅。
4. 审阅同时检查功能、回归、diff 边界和 `修改日志.md`。
5. 未通过的节点不得标记完成，不得进入下一节点。
6. 通过后只显式暂存相关路径；禁止使用 `git add .` 或 `git add -A`。
7. 每个 checkpoint 后确认 `master` 未移动，`.codex/local-preview` 数据库、备份和其他临时文档未进入暂存区。

节点审阅记录直接追加在本计划对应节点的“节点审阅记录”处，至少记录日期、提交前状态、验证命令、结果、发现的问题和遗留事项。

## 5. 节点 0 V2 基线锁定与 V3.1 测试入口

### 5.1 目标

在写入新状态逻辑前固定 V2 行为基线，确认新增 Time State 不会借机改变 Pressure、视频映射、布局或 UI 生命周期。

### 5.2 工作内容

- 运行现有 Pressure 单元测试和 Today Scene 视频 E2E，记录基线结果。
- 固定 V3.1 视觉基准视口为 `1536×1024`；保留 `1654×960`、`1920×1080` 作为构图回归视口。
- 在现有 `today-scene-video.spec.ts` 基础上规划可控 `serverNow`，使测试能以同一 Pressure 构造四个 Time State，并能在页面不 remount 的情况下触发时间变化。
- 建立 V3.1 证据目录约定：`docs/design/today/v3.1-scene-state/`。
- 不改生产实现；如现有测试不能稳定控制时间，只补最小测试夹具能力。

### 5.3 拟涉及文件

- `apps/web/src/features/time-system/today/fountain-scene-state.test.ts`
- `apps/web/e2e/today-scene-video.spec.ts`
- `docs/design/today/v3.1-scene-state/`
- `修改日志.md`

### 5.4 验证

- Pressure 边界测试全部通过。
- 四档状态仍分别加载当前已校准素材。
- 现有 Crossfade、fallback、visibility、reduced-motion 和 UI 稳定性 E2E 通过。
- 三档桌面视口的 Scene 构图数据不变。

### 5.5 节点完成后的小范围审阅

- 对比生产代码 diff，确认本节点没有修改业务实现、CSS 或视频资产。
- 检查测试夹具没有形成生产环境调试入口。
- 检查所有新证据路径均位于 V3.1 专属目录。
- 检查暂存区只包含基线测试、证据说明、本计划和修改日志。

### 5.6 节点审阅记录

状态：已通过，2026-09-14。

- 分支与边界：执行期间保持在 `codex/V3`；本节点未修改生产代码、CSS、视频资产或现有测试。
- 定向验证：`fountain-scene-state.test.ts` 17/17 通过；`today-scene-video.spec.ts` Chromium 3/3 通过。
- 已确认基线：四档已校准素材映射、双视频 Crossfade、失败 fallback、visibility、reduced-motion、AI 输入稳定性、无 Canvas、稳态/过渡播放数和 `1536×1024`、`1654×960`、`1920×1080` 三档构图均受现有测试保护。
- 审阅结论：现有 E2E fixture 已支持独立 Pressure 控制；Time State 可在后续节点通过同一 `/api/v1/today` route 的 `serverNow` 控制，无需新增生产调试入口。
- 遗留事项：四时间态证据目录和截图在节点 6 实际生成，本节点不提前创建空目录或伪造证据。

### 5.7 Feature Spec V3.1-F0 V2 基线保护

**用户价值**：V3.1 增加一天中的时间感时，用户已经验收的喷泉强弱、空间构图和 Today 功能保持不变。

**输入**：现有四档 Pressure fixture、现有 Today Scene 页面、三个桌面视口、reduced-motion 与视频失败条件。

**行为**：在任何 V3.1 生产改动前运行并保存 V2 的自动化结果；后续节点复用同一组断言作为回归门禁。

**输出**：可重复执行的 V2 基线测试和 V3.1 证据目录约定。

**验收标准**：Pressure Mapping、素材映射、Crossfade、fallback、视频播放数量、场景构图、AI 输入和 Timeline 均有既有测试证据；本节点不改变用户可见效果。

**非目标**：不新增时间视觉、不调整资产、不重写现有测试套件。

## 6. 节点 1 TodaySceneState 与 Time State Resolver

### 6.1 目标

建立 Pressure 与 Time 两个正交维度的基础模型，并用纯函数稳定解析 Morning、Day、Sunset、Night。

### 6.2 工作内容

- 新增 `TodayTimeState = 'morning' | 'day' | 'sunset' | 'night'`。
- 新增 `TodaySceneState`，第一阶段只包含：

```ts
interface TodaySceneState {
  readonly pressureState: FountainSceneState;
  readonly timeState: TodayTimeState;
}
```

- 新增 `getTodayTimeState(currentNow)`，按本计划固定本地时间边界解析状态。
- 新增构建函数，以现有 `getFountainSceneState()` 计算 `pressureState`，不复制 Pressure 阈值。
- 不在状态层创建 Pressure 与 Time 组合枚举。
- Life Phase 和 Special State 只保留在设计路线中，本节点不增加无消费方的判断逻辑。

### 6.3 拟涉及文件

- 新增 `apps/web/src/features/time-system/today/today-scene-state.ts`
- 新增 `apps/web/src/features/time-system/today/today-scene-state.test.ts`
- `apps/web/src/features/time-system/today/index.ts`
- `修改日志.md`

### 6.4 单元测试矩阵

- Night：00:00、04:59、19:30、23:59。
- Morning：05:00、10:59。
- Day：11:00、16:59。
- Sunset：17:00、19:29。
- 每个 Pressure 边界与任意 Time State 的组合不改变 Pressure 结果。
- 同一 Pressure 在 09:00 和 22:00 得到相同 `pressureState`、不同 `timeState`。

### 6.5 节点完成后的小范围审阅

- 检查时间解析器是纯函数，不读取天气、定位、AI 或网络。
- 检查没有复制或改写 Pressure 阈值和素材映射。
- 搜索并确认不存在 `MorningIntense`、`NightCalm` 等组合类型。
- 运行新增单元测试、原 Fountain State 测试、typecheck 和相关 lint。
- 检查公开导出仅包含后续节点需要的类型与函数。

### 6.6 节点审阅记录

状态：已通过，2026-09-14。

- 实现：新增 `TodayTimeState`、第一阶段 `TodaySceneState`、`getTodayTimeState()` 和 `buildTodaySceneState()`；Pressure 直接复用 `getFountainSceneState()`。
- 边界测试：Night 00:00/04:59/19:30/23:59，Morning 05:00/10:59，Day 11:00/16:59，Sunset 17:00/19:29 全部通过。
- 正交测试：09:00 与 22:00 的 Pressure 10 均保持 Calm；八个 Pressure 边界在 Day 环境下保持 V2 原映射。
- 定向验证：新增 Scene State 测试 19/19，原 Fountain State 测试 17/17，合计 36/36；Web typecheck、相关 ESLint 和 Prettier 通过。
- 职责搜索：无组合枚举、天气、定位、网络请求或散乱时间样式判断。
- 审阅结论：节点 1 Feature Spec 验收项已满足，可进入节点 2。

### 6.7 Feature Spec V3.1-F1 多维 Scene State 基础

**用户价值**：Today Scene 能同时理解“今天有多忙”和“今天进行到什么时间”，且两个含义互不污染。

**输入**：Pressure 数值和已有 `currentNow` 时间戳。

**行为**：Pressure 继续走原四档映射；时间按固定本地时间段解析为四档；两个结果只在 `TodaySceneState` 中组合。

**输出**：稳定、可测试的 `{ pressureState, timeState }`。

**验收标准**：所有边界分钟结果明确；同一 Pressure 跨时间不改档；同一时间跨 Pressure 不改 Time State；无组合枚举。

**非目标**：不判断 Work/Life，不判断 Day Completed/Rest，不访问外部服务。

## 7. 节点 2 SceneEnvironmentProfile

### 7.1 目标

将四档时间环境的视觉参数集中为强类型 Profile，避免数值散落在 JSX 和条件分支中，并以 Day 作为 V2 基准。

### 7.2 Profile 职责

Profile 只允许描述轻量环境统一参数：

- scene brightness
- scene contrast
- temperature tint 与 opacity
- environment overlay opacity
- vignette opacity
- UI readability gradient 强度
- transition duration

Profile 不控制喷泉视频选择、播放速度、水体、Mist、Splash、粒子、Canvas 或 UI 布局。

### 7.3 四档方向

- Morning：相对 Day 略亮、稍冷、对比度稍低、保持柔和；不得出现明显蓝滤镜或额外晨雾。
- Day：所有参数以当前 V2 Scene 为基准，不产生可感知的额外主题处理。
- Sunset：略暖、亮度略降、保留青绿色空间身份；不得出现强橙、紫红或电影 LUT。
- Night：曝光下降、稍冷、结构仍可识别、UI 保持可读；不得黑屏、深蓝覆盖、霓虹化或 HUD 化。

初始值采用保守的小幅度范围；最终数值必须在节点 5 的同 Pressure 对比图中校准。计划不提前把未经视觉验证的参数写成最终设计事实。

### 7.4 拟涉及文件

- 新增 `apps/web/src/features/time-system/today/scene-environment-profile.ts`
- 新增 `apps/web/src/features/time-system/today/scene-environment-profile.test.ts`
- `apps/web/src/features/time-system/today/index.ts`
- `修改日志.md`

### 7.5 验证

- 四个 Time State 均有完整 Profile，无运行时缺项。
- Day Profile 是明确 baseline。
- 数值通过只读对象集中维护，不在 JSX 中出现时间分支样式。
- Profile 不引用 Pressure State。
- transition duration 位于 3000–8000ms。

### 7.6 节点完成后的小范围审阅

- 审查 Profile 字段是否都属于设计文档允许的环境参数。
- 检查是否出现强滤镜、持续动画配置或未授权视觉系统。
- 检查 Day 是否保持 V2 原始综合色调。
- 运行 Profile 单元测试、typecheck 和相关 lint。
- 检查本节点没有修改视频文件、Pressure 代码或 UI 组件。

### 7.7 节点审阅记录

状态：已通过，2026-09-14。

- 实现：新增集中、冻结、强类型的四档 `SceneEnvironmentProfile`，字段限定为 brightness、contrast、temperature tint/opacity、overlay、vignette、readability gradient 和 transition duration。
- 基准关系：Day 明确为 brightness 1、contrast 1、temperature opacity 0、overlay 1；Morning、Sunset、Night 均采用围绕 Day 的克制调整。
- 参数边界：非 Day brightness 保持 0.8–1.05、contrast 保持 0.95–1.05、temperature/vignette/readability opacity 均设置上限；四档过渡统一为 5000ms。
- 定向验证：Profile 测试 4/4；连同 Scene State 和 Fountain State 共 40/40；Web typecheck、相关 ESLint 和 Prettier 通过。
- 职责搜索：Profile 不包含 Pressure、视频、Canvas、Mist、Splash、timer 或条件分支。
- 审阅结论：节点 2 Feature Spec 验收项已满足；参数仍须在节点 6 用真实截图校准，不提前视为最终视觉值。

### 7.8 Feature Spec V3.1-F2 时间环境配置

**用户价值**：早晨、白天、傍晚和夜间具有可辨认但克制的空气变化，空间身份始终一致。

**输入**：`TodayTimeState`。

**行为**：从唯一 Profile Map 读取视觉参数；Day 使用 V2 baseline，其他状态只做相对微调。

**输出**：供渲染层消费的完整 `SceneEnvironmentProfile`。

**验收标准**：四档配置完整、类型安全、无 Pressure 耦合；允许参数不超出设计清单；过渡时长满足 3 至 8 秒。

**非目标**：不生成视频、不生成天气效果、不定义组合场景。

## 8. 节点 3 Environment Modifier 渲染与独立过渡

### 8.1 目标

在现有 SceneBase、SceneVideoLayer 和 UIOverlay 之间加入可平滑变化的 Time Environment，并与 Pressure Crossfade 完全解耦。

### 8.2 工作内容

- 将当前静态 `today-scene__environment-overlay` 收敛为独立的 Time Environment 渲染组件或等价的集中渲染入口。
- 通过 `data-time-state` 和集中 Profile 输出必要 CSS variables；React JSX 中不出现成组 `if night` / `else if sunset` 样式判断。
- SceneBase 和 Static/Video Media 接受同一时间环境的亮度、对比度和色温影响；UI Overlay 不整体套用 Scene filter。
- Overlay 负责温度 tint、vignette 和 UI readability gradient。
- 使用 CSS transition 完成 3 至 8 秒变化，不启动 `requestAnimationFrame` 或高频 JS 循环。
- 不给 Time State 复用或侵入 `TodaySceneMedia` 的双视频 Transition 状态机。
- reduced-motion 下保留 Time State 的静态视觉表达；只禁用持续运动，不删除状态。

### 8.3 拟涉及文件

- 新增 `apps/web/src/features/time-system/today/today-scene-environment.tsx`
- 新增 `apps/web/src/features/time-system/today/today-scene-environment.test.tsx`
- `apps/web/src/features/time-system/today/today-immersive-layout.tsx`
- `apps/web/src/styles/today-immersive.css`
- `修改日志.md`

### 8.4 分层约束

```text
z0 Scene Backdrop
z1 Static Master Frame / Pressure Video
z2 Time Environment Modifier
z4–z5 Existing Today UI Overlay
```

不得改变现有 UI 的 stacking order、pointer events、焦点或布局几何。

### 8.5 验证

- Time State 切换时环境连续变化，无一帧闪白、黑屏或强色跳变。
- Pressure 不变时，视频 `src` 和 active Pressure State 不随 Time 变化。
- Time 不变时，Pressure Crossfade 的播放数和队列行为保持原样。
- reduced-motion 下视频停止，Static Master Frame 与 Time Environment 同时可见。
- Overlay 保持 `pointer-events: none`。

### 8.6 节点完成后的小范围审阅

- 审查 DOM 层级和 CSS stacking，确认 UI 仍位于世界层之上。
- 检查 transition 只有 CSS 属性变化，没有持续 JS 动画。
- 检查 Time transition 与 `transitioningRef`、Video A/B、preload 逻辑无共享状态。
- 用组件测试验证 rerender 不会 remount 子树或丢失焦点。
- 在 `1536×1024` 下人工查看四个静态时间状态和至少一次过渡。

### 8.7 节点审阅记录

状态：已通过，2026-09-14。

- 实现：新增 `TodaySceneEnvironment` 和集中 CSS variable 映射；Scene 根节点按本地 `timeState` 输出环境参数，现有 Overlay 收敛为时间环境渲染层。
- 分层：Backdrop 与 Scene Media 只接受 brightness/contrast；Environment Overlay 只接受 temperature tint、readability gradient、vignette 和 opacity；UI 未套用 Scene filter，原 z-index 与 pointer events 保持。
- Transition：亮度/对比度、环境 background/opacity 使用 5000ms CSS transition；无 `requestAnimationFrame` 或新增 timer；reduced-motion 下取消过渡但保留静态 Time State。
- 组件稳定性：组件 rerender 测试确认 Morning 切到 Night 时 Overlay DOM 不被替换。
- 定向验证：相关单元/组件测试 42/42，Web typecheck、ESLint、Prettier、V2 CSS audit 通过；现有 Today Scene Chromium E2E 3/3 通过。
- 浏览器路径：Browser Harness 因本机 Chrome 要求用户点击 “Allow remote debugging” 被阻断；未修改用户权限，按项目既有 Playwright 路径完成 Chromium 渲染回归。
- 审阅结论：节点 3 Feature Spec 的结构、独立 Transition 和无持续 JS 动画要求已满足；四时间态联合行为在节点 4 扩展 E2E。

### 8.8 Feature Spec V3.1-F3 时间环境渲染与过渡

**用户价值**：用户停留在 Today 页面跨过时间边界时，感觉空气和光线自然变化，而不是主题突然切换。

**输入**：当前 Profile、前一 Profile、reduced-motion 偏好。

**行为**：Scene 层应用轻量环境参数并在 3 至 8 秒内渐变；UI 保持独立；Pressure 视频状态机继续独立运行。

**输出**：同一 Today Scene 的连续时间环境表达。

**验收标准**：无闪变、无新动画循环、无 UI remount、无 Pressure 状态变化；reduced-motion 下仍能表达时间状态。

**非目标**：不切换主题、不建立第二套视频状态机、不改变 Scene 构图。

## 9. 节点 4 TodaySceneState 接入与正交组合回归

### 9.1 目标

让 `TodayImmersiveLayout` 使用统一的 `TodaySceneState` 驱动 Pressure Media 和 Time Environment，并证明 4×4 任意组合不存在业务耦合。

### 9.2 工作内容

- 在 Today Scene 的高层组合入口一次性构建 `TodaySceneState`。
- Pressure 子层只消费 `pressureState`，Time Environment 只消费 `timeState`。
- 保持 `TodaySceneMedia` 组件实例稳定，不用 `key` 强制重建。
- 保持 Timeline、任务卡、右栏、Header 和 AI Composer 的组件身份与 props 链路。
- 为 Scene 根节点增加稳定的 QA 数据属性，能分别观察 Pressure 与 Time 当前状态，不增加用户可见调试 UI。
- 扩展 E2E，使 `serverNow` 和 Pressure fixture 可分别变化。

### 9.3 拟涉及文件

- `apps/web/src/features/time-system/today/today-immersive-layout.tsx`
- `apps/web/src/features/time-system/today/today-scene-media.tsx`
- `apps/web/e2e/today-scene-video.spec.ts`
- 相关单元测试
- `修改日志.md`

### 9.4 组合验证矩阵

自动化必须覆盖全部 16 种状态的状态正确性：

```text
Calm     × Morning / Day / Sunset / Night
Balanced × Morning / Day / Sunset / Night
Busy     × Morning / Day / Sunset / Night
Intense  × Morning / Day / Sunset / Night
```

视觉重点检查至少覆盖设计文档指定的八种极值组合：

```text
Morning + Calm      Morning + Intense
Day + Calm          Day + Intense
Sunset + Calm       Sunset + Intense
Night + Calm        Night + Intense
```

### 9.5 联合 Transition 路径

```text
Morning + Calm
→ Morning + Busy
→ Day + Busy
→ Sunset + Intense
→ Night + Calm
→ Morning + Calm
```

联合路径中必须检查：

- Pressure Crossfade 正常且只在 Pressure 改变时发生。
- Time Environment Transition 正常且只在 Time 改变时发生。
- 两种变化同时发生时不互相取消、不共享队列、不超过两条可见视频。
- AI 输入内容和焦点不丢失。
- Timeline、任务区和右栏不重建、不重新布局。

### 9.6 节点完成后的小范围审阅

- 审查全部状态消费点，确认 Pressure 与 Time 各自只有明确职责。
- 搜索组合枚举和散乱时间条件，发现即视为节点未通过。
- 运行 16 组合自动化、联合 Transition E2E、现有 Pressure E2E 和组件测试。
- 检查浏览器 console、pageerror 和失败响应均无新增错误。
- 检查 diff 没有触及 Today 之外的产品主题或页面。

### 9.7 节点审阅记录

状态：已通过，2026-09-14。

- 架构接入：`TodayImmersiveLayout` 在高层一次构建 `TodaySceneState`；`TodaySceneMedia` 只消费 `pressureState`，`TodaySceneEnvironment` 只消费 `timeState`。
- V2 保留：Media 内部 Video A/B、queued latest state、preload、fallback、visibility 和 reduced-motion 状态机未重写；只把输入从 Pressure 数值收敛为已解析的 Pressure State。
- QA 属性：Scene 根节点分别暴露 `data-pressure-state` 与 `data-time-state`，仅供自动化观察，不增加可见调试 UI。
- 组合验证：Calm/Balanced/Busy/Intense × Morning/Day/Sunset/Night 全 16 组合通过。
- 联合 Transition：从 Intense Night 到 Calm Morning 同时触发 Pressure Crossfade 与 Time transition；最多两条活动视频，CSS duration 为 5s，两套 transition 不共享状态。
- UI 稳定性：AI 输入值与焦点、Timeline 原 DOM 标记、三段计划区均保持；console/page/HTTP 新增错误为 0。
- 定向验证：相关单元/组件 42/42，Web typecheck、ESLint、Prettier、V2 CSS audit 通过；Chromium Scene E2E 4/4。
- 审阅结论：节点 4 Feature Spec 验收项已满足，可进入节点 5。

### 9.8 Feature Spec V3.1-F4 Pressure 与 Time 正交组合

**用户价值**：用户可以看到“平静的夜晚”或“忙碌的清晨”，而不会感觉系统切换到了某个命名主题。

**输入**：任意合法 Pressure 数值、任意本地时间状态、运行中的 Today UI。

**行为**：Pressure 只选择喷泉强弱，Time 只改变环境；渲染层组合两者。

**输出**：16 种可组合 Scene 表达和连续联合 Transition。

**验收标准**：16 种状态值全部正确；极值组合视觉无冲突；同时变化不超过两条活动视频；AI 输入、焦点、Timeline 和任务组件保持稳定。

**非目标**：不为 16 种组合建立资产或业务枚举，不重新挂载 Today 页面。

## 10. 节点 5 生命周期 性能与无障碍回归

### 10.1 目标

确认 Time State 不增加持续运行成本，并完整保留 V2 的页面生命周期和 reduced-motion 行为。

### 10.2 工作内容

- 验证页面离开后视频暂停且 Time Environment 不产生后台动画循环。
- 验证 `document.visibilityState = hidden` 后视频暂停，恢复可见后按原逻辑继续。
- 验证 reduced-motion 使用 Static Master Frame，同时保留当前 Time Environment。
- 验证初始视频加载失败时 Static Master Frame 与 Time Environment 均存在。
- 验证 Time State 变化只由既有 30 秒 `currentNow` 更新驱动，不新增高频 timer。
- 验证稳定态一条视频、Crossfade 最多两条视频。

### 10.3 拟涉及文件

- `apps/web/e2e/today-scene-video.spec.ts`
- 必要的相关组件测试
- `修改日志.md`

本节点原则上只补测试和修复已发现的 V3.1 局部问题；若需要重写 V2 生命周期逻辑，必须停止并重新评审计划。

### 10.4 验证

- 页面离开、document hidden、恢复可见、reduced-motion、视频失败五条路径均通过。
- 无 `requestAnimationFrame`、高频 interval、Canvas 或新增视频资源。
- console error、pageerror、HTTP 4xx/5xx 新增数量为 0。
- Time Environment DOM 层不接收用户输入，不影响 tab 顺序和可访问名称。

### 10.5 节点完成后的小范围审阅

- 检查 timer、event listener 和 media 清理是否成对。
- 检查 reduced-motion 语义是“停止持续运动”，不是“删除状态表达”。
- 检查 fallback 下 UI 和空间结构仍完整。
- 运行节点定向 E2E、web typecheck、lint 和测试。
- 检查修改仅处理本节点暴露的 V3.1 回归。

### 10.6 节点审阅记录

状态：已通过，2026-09-14。

- 页面离开：新增客户端路由卸载 E2E，保留离开前的 active video handle，确认进入 Work 后该视频已暂停。
- visibility：document hidden 后活动视频为 0，恢复 visible 后回到 1，原行为继续通过。
- reduced-motion：视频停止、Static Master Frame 保留、Day Time Environment 状态仍存在，UI 正常。
- fallback：初始视频失败时 Static Master Frame、Day Environment、Timeline、计划区和 AI 输入仍存在。
- 性能边界：稳态一条、Crossfade 最多两条；新增模块中不存在 `requestAnimationFrame`、`setInterval`、Canvas 或新视频资源。
- 定向验证：Web typecheck、ESLint、Prettier、V2 CSS audit 通过；Chromium Scene 生命周期/组合 E2E 5/5。
- 审阅结论：节点 5 Feature Spec 验收项已满足；未发现需要重写 V2 生命周期状态机的问题。

### 10.7 Feature Spec V3.1-F5 稳态性能与生命周期

**用户价值**：时间环境增强不会让 Today 页面更耗电、更不稳定，也不会损害减少动态效果的系统偏好。

**输入**：页面可见性、路由生命周期、媒体加载结果、reduced-motion 偏好和当前 Time State。

**行为**：继续沿用 V2 视频生命周期；Time Environment 使用静态 CSS 状态和有限过渡；不可见时不产生额外持续工作。

**输出**：性能边界和无障碍行为均受自动化保护的 Scene State Engine。

**验收标准**：稳态最多一条视频、Crossfade 最多两条；隐藏或离开后暂停；reduced-motion 下静态场景仍显示正确时间环境；无新增高频循环。

**非目标**：不进行新的渲染引擎优化，不引入性能监控平台。

## 11. 节点 6 视觉校准 全量门禁与完成报告

### 11.1 目标

以相同 Pressure 对比四个 Time State，完成最终视觉校准、技术门禁和 V3.1 第一阶段交付报告。

### 11.2 视觉材料

使用同一 `Balanced` Pressure fixture，在 `1536×1024` 输出：

- `balanced-morning-1536x1024.png`
- `balanced-day-1536x1024.png`
- `balanced-sunset-1536x1024.png`
- `balanced-night-1536x1024.png`

统一保存到：

`docs/design/today/v3.1-scene-state/`

Day 截图同时作为 V2 baseline 对照；另外在 `1654×960`、`1920×1080` 复核构图与 UI 可读性。视觉检查必须确认：

- 第一眼仍是完整 Today Scene，不是 Dashboard 加动态壁纸。
- Pressure 强弱仍由喷泉承担主要表达。
- 四个时间阶段可以大致辨认，但不会压过 Pressure。
- 水池、喷泉、机位、缩放、空间比例和 UI 构图不变。
- Morning 无明显蓝滤镜或夸张晨雾。
- Sunset 无强橙或紫红 LUT。
- Night 不黑屏、不霓虹化，水池和喷泉仍可识别。

### 11.3 技术门禁

- V3.1 定向单元测试。
- 16 组合与 Transition E2E。
- 现有 Today Scene Pressure/fallback/multi-viewport E2E。
- TypeScript、lint、production build。
- 最终执行根级 `pnpm verify`。
- 浏览器 console、pageerror 和失败响应无新增错误。
- `git diff --check`。
- 暂存区和提交边界检查。

### 11.4 完成报告内容

在 `docs/design/today/v3.1-scene-state/acceptance.md` 记录：

1. 实际 Scene State 架构，以及 Life Phase / Special State 未实现的明确说明。
2. Morning、Day、Sunset、Night 的最终时间边界。
3. 每个 Environment Profile 实际改变的参数和最终值。
4. Pressure Mapping、Crossfade、preload、fallback、reduced-motion、visibility 生命周期的保留结果。
5. 四档 Pressure、四档 Time、16 组合、Transition、build、lint、TypeScript 和 console 结果。
6. 四张同 Pressure 时间对比图及多视口复核结果。
7. 未完成、部分完成和第二阶段候选项；不得把候选能力写成已完成。

### 11.5 节点完成后的小范围审阅

- 逐项对照原设计文档第 21、22、25、26、27、28、29 节。
- 复核四张视觉材料确实来自相同 Pressure 和相同构图。
- 复核完成报告中的每一项“通过”都有命令或截图证据。
- 复核所有视觉调整已在修改日志记录基准视口、对比依据和 Fixture 路径。
- 复核 migration、其他主题、临时文件和本地数据库没有进入 V3.1 diff。
- 完成最终 Git checkpoint 后确认 `master` 指针未移动。

### 11.6 节点审阅记录

状态：已通过，2026-09-14。

- 视觉 Fixture：以 Balanced Pressure 35、`1536×1024` 生成 Morning、Day、Sunset、Night 四张同构图截图，并逐张查看。
- 视觉结论：Morning 更亮清透、Day 保持 V2 baseline、Sunset 轻微转暖降亮、Night 明显降曝光偏冷；四档可辨认但克制，水池、喷泉、UI 和空间身份一致。
- 多视口：现有 `1536×1024`、`1654×960`、`1920×1080` 构图 E2E 继续通过。
- 定向验证：相关单元/组件 42/42；Chromium Scene E2E 6/6；正式 Fixture 生成 1/1。
- 完整门禁：`pnpm verify` 通过；Prettier、ESLint、CSS audit、11/11 typecheck、487 passed / 7 gated skipped、contracts、11/11 build、Launcher 0 warning/error 和连续崩溃恢复门禁全绿。
- 完成报告：`docs/design/today/v3.1-scene-state/acceptance.md` 已记录架构、时间规则、最终 Profile、V2 保留结果、QA、视觉证据和未实现范围。
- 浏览器说明：Browser Harness 因 Chrome 远程调试授权弹窗阻断；项目 Playwright Chromium 的渲染、交互、console 和截图证据均已通过。
- 审阅结论：原设计第 21、22、25、26、27、28、29 节均有对应实现或明确未实现说明；节点 6 Feature Spec 验收项已满足。

### 11.7 Feature Spec V3.1-F6 第一阶段交付验收

**用户价值**：用户在一天中多次打开 Today 页面时，能感觉同一个空间与自己一起经历清晨、白天、傍晚和夜晚。

**输入**：完整 V3.1 第一阶段实现、16 组合矩阵、联合 Transition、四张同 Pressure 截图和完整工程门禁。

**行为**：对功能、视觉、性能、无障碍和 V2 回归进行最终验证，只按真实证据形成报告。

**输出**：通过门禁的 Scene State Engine、视觉 Fixture 和 `acceptance.md`。

**验收标准**：四档 Time 可辨认但克制；16 组合无冲突；Transition 无闪变；V2 能力无回归；`pnpm verify` 通过；完成报告与证据一致。

**非目标**：不在验收节点追加第二阶段功能，不用未验证描述替代真实证据。

## 12. 计划完成定义

V3.1 第一阶段只有同时满足以下条件才可宣布完成：

- 七个节点均有通过的小范围审阅记录。
- 每个节点的 Feature Spec 验收标准均已逐项核对。
- Pressure 与 Time 保持正交，没有组合枚举或组合视频资产。
- 四档时间环境在相同 Pressure 下可辨认且仍属于同一个空间。
- V2 Pressure Mapping、素材映射、Crossfade、preload、fallback、visibility、reduced-motion 和 UI Overlay 均无回归。
- 技术门禁与视觉材料齐全，完成报告只陈述已验证事实。
- `修改日志.md` 已同步更新。
- V3.1 Git checkpoints 只推进 `codex/V3`，`master` 未移动，临时文档、本地数据库和备份未进入提交。

## 13. 第二阶段决策门

第一阶段稳定后才评估 Life Phase、Day Completed/Rest 或专用 Time Scene Asset。评估顺序严格遵循设计方案：先看轻量 Environment Modifier 是否足够，再按真实视觉需要增加最少资产；不得预先生成全部组合。

第二阶段不属于本实施计划的自动延续范围，必须基于第一阶段完成报告另行确认后才能开始。
