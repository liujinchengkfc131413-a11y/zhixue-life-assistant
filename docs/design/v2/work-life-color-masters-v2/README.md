# Work / Life / Vision 母版 V2 视觉参考

> 基准视口：1536 × 1024  
> 最高设计规范：[`生活助手 V2 美术设计规范 V2.md`](../../../../生活助手%20V2%20美术设计规范%20V2.md)  
> 生成日期：2026-08-25—2026-08-26

规范优先级：

1. `生活助手 V2 美术设计规范 V2.md`：V2 后续设计、Token、组件美术、页面重构与视觉 QA 的最高规范；其 3.5 节已确立母版视觉复刻与产品层适配原则。
2. 本目录的 Work / Life / Vision 四张母版：用户确认的正式视觉基准，对应四个空间必须复刻其 Theme Environment 与内容组件材质，不是可选参考。
3. `生活助手 V2 美术设计规范 V1.md` 与 `Work - Life 新调色母版 V2.md`：保留为设计演进和调色过程文档；发生冲突时不得覆盖 V2 规范和正式母版。

## 复刻口径

四个拥有母版的空间（Work、Life、Plan & Goals、AI Assistant）的 Theme Environment 与内容组件材质必须复刻母版，依据 V2 规范 3.5 节：

- 母版背景已经从母版图上扣出并复刻进生产环境；相关页面与母版是“复刻关系”，不是“参考关系”。
- 背景层次、环境光、雾效、色彩关系必须与母版逐一对齐，不得自行发挥、简化或重新设计。
- 色值、明度关系和综合色温以母版实际呈现为准；文档中的推荐色值仅作记录，与母版冲突时以母版为准。
- Card、Field、Button 等组件的材质与明暗层级必须落在母版建立的环境上，与背景构成同一空间。
- Sidebar、品牌、导航分组和全局交互属于产品家族层。Work、Life、Plan & Goals、AI Assistant 与 System 共享生产环境中的统一深色导航壳，不按四张母版拆成四套 Sidebar；Today 按已确认的 Today Scene 独立维护。
- 母版中的示例文案、示例卡片和概念按钮不覆盖真实 PRD、数据结构和操作链路。Plan / AI 的允许适配与禁止偏离见 `../master-adaptation-boundaries.md`。

## 文件

- `work-theme-master-v2-1536x1024.png`：Work「清晨冷光工作室」母版。
- `life-theme-master-v2-1536x1024.png`：Life「晨光进入树林」母版。
- `vision-plan-goals-master-v2-1448x1086.png`：Vision「方向与时间」计划与目标母版。
- `vision-ai-assistant-master-v2-1448x1086.png`：Vision「思考与执行」AI 助手母版。

四张图是后续 Theme Token、背景、Atmosphere、Card、Field、Button、Tabs、Badge 与文字层级调整时必须复刻的视觉基准；母版图本身不替代统一 Sidebar、真实页面、交互和响应式验收——视觉 QA 以母版为基准图对比，功能验收仍以生产页面为准。Today 以 Today Scene 总参考图独立维护，System 没有母版，均不在复刻范围内。

## Vision 母版判断

- Plan 第一眼是远景打开、第二眼是计划结构、第三眼才注意到雾青玻璃和蓝紫光。
- 背景保留右上暖白晨光、层叠远山、贯穿山谷的光路与左下树影；不得替换为星空、粒子或霓虹宇宙。
- Plan Card 使用明亮通透的 Air Glass，Column 仍是轻量空间容器；蓝紫渐变仅用于 Selection、Primary Action 和极少量高光。
- AI 与 Plan 共用远景家族，但通过更明确的蓝紫光弧、会话空间和 Operation Card 建立“思考与执行”身份；具体实现留在 Phase 5。

## Work 母版判断

- 第一眼应是清冷、安静、专业，而不是黑色后台。
- 环境、清透玻璃与更亮 Field 形成三个明确明度层级。
- 冷雾薄、透明、低模糊；Accent 只落在焦点和少量关键状态。
- Elevated Card 靠更清晰、更亮获得层级，不靠变黑。

核心色：`#0E141B`、`#18232E`、`#21313F`、`#2C3F50`、`#8BA6BF`、`#D5E4F2`；主 Accent 为 `#6FAEE8`。

## Life 母版判断

- 第一眼应是明亮、温和、有空气，而不是普通浅绿色后台。
- 背景同时包含 Sage Base、Morning Mist、Warm Sunlight 与 Soft Edge Shadow，第一感受仍为浅鼠尾草。
- 卡片带米雾和浅绿，Field 略深；最亮层也不使用纯白。
- 光线统一由左上进入，暖杏只承担操作和少量状态，不成为页面主色。
- 可感知极弱森林层次、模糊树影与树冠遮光变化，但必须先看到 UI，不能形成清晰照片或主题壁纸感。

核心色：`#EAF2EC`、`#D7E6D8`、`#C8D3C9`、`#F6F7F4`、`#FFF7EC`；暖杏 Accent 为 `#F4A74C`，辅助 Sage 为 `#8EB796`。

## 共同约束

- 组件样本保持同类，靠明暗、空气、卡片质感和空间感觉区分 Work / Life。
- 母版只展示 Background、Atmosphere、Card、Elevated Card、Field、Button、Tabs、Badge 与 Text hierarchy。
- 后续实现优先采用 CSS Gradient、Pseudo Element 与 Static Blur Layer；不得引入清晰摄影壁纸、背景粒子、复杂 3D、游戏 HUD 或无处不在的 Glow。
- Work、Life、Plan & Goals、AI Assistant 与 System 的 Sidebar 使用统一深色导航壳，仅 Active Accent 随空间变化；Today Scene 保留已确认的轻色例外。

## 母版来源

- Work：用户在 GPT 网页端依据项目性质生成的 `ChatGPT Image 2026年8月25日 15_06_09.png`，原文件未经重绘或调色直接保存；SHA-256：`0eef140a7f55be96fbc6ae0ef6e5f6d9bfea417f596d3271854eb27c1e00e720`。
- Life：用户在 GPT 网页端依据项目性质生成的 `ChatGPT Image 2026年8月25日 15_06_14.png`，原文件未经重绘或调色直接保存；SHA-256：`9410049c7857c0568452f2e6a95dd3301544ab7d338adb3ea44afec3818efe8e`。
- Vision Plan：用户提供的 `ChatGPT Image 2026年8月26日 09_23_18.png`，1448×1086 原文件未经重绘、压缩或调色直接保存；SHA-256：`213cc3c1393a530573ed6517960e8ad8ab46da4ef05e16e750092cde3c06ba28`。
- Vision AI：用户提供的 `ChatGPT Image 2026年8月26日 09_27_56.png`，1448×1086 原文件未经重绘、压缩或调色直接保存；SHA-256：`855713d527726a878bfc4ce1bc4f21713652232c5dc5937804a64238fe66c228`。

## 使用顺序

1. 先只实现背景与 Atmosphere，空白页面也必须成立。
2. 再按母版校准 Standard / Elevated Card 和 Field 明度关系。
3. 最后收敛 Border、Shadow、Accent 与 Button；Sidebar 按统一产品家族层验收，不逐张复刻母版示例。
4. 套入业务页后重新做 1536×1024 基准和扩展视口回归；视觉 QA 以对应母版为基准图逐项对比，但验收仍以生产页面的真实回归为准，母版图本身不是验收结果。
5. 具体实现与执行顺序在实施计划后续正式同步前，均以 V2 规范和本目录母版解释冲突，不反向改写业务结构。
