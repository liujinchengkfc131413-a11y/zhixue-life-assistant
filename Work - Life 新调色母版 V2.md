# Work / Life 新调色母版 V2

> 适用范围：生活助手 V2 美术阶段  
> 作用：替换上一版 Work / Life Theme 中过暗、过闷的主色与环境方案  
> 本轮性质：视觉与材质调整，不修改业务结构、数据关系和交互逻辑

---

# 1. 本轮设计结论

上一版 Work / Life 已经建立了正确的空间方向：

- Work：专注、精密、玻璃
- Life：治愈、生命力、柔雾

但实际实现后暴露出一个核心问题：

> **两套 Theme 都过度依赖低明度深色背景，导致页面虽然完成了色相区分，却没有真正建立情绪区分。**

当前主要问题表现为：

```text
背景太暗
+
卡片太暗
+
表单太暗
+
空气层不足
+
环境光不足
=
整体压抑、发闷、缺乏生命力
```

因此 V2 调色方案正式调整为：

## Work

> **深青灰 + 冷晨雾 + 清透玻璃 + 冷蓝自然光**

目标：

> 深，但不黑。  
> 冷，但不死。  
> 专注，但不压迫。

---

## Life

> **浅鼠尾草绿 + 米雾白 + 林间晨雾 + 暖杏阳光**

目标：

> 浅而不甜。  
> 暖而不俗。  
> 柔和，但仍然是成熟的生产力产品。

---

# 2. 两个空间的环境隐喻

## Work — 清晨冷光工作室

Work Theme 的环境想象为：

> 清晨，室外温度仍然偏低。  
> 冷色自然光透过玻璃进入安静的工作室。  
> 空气中有极淡的薄雾，但视线清楚，物体边缘精准。  
> 整个空间让人自然进入专注状态。

视觉关键词：

```text
Cold Morning
Clear Air
Glass
Focus
Precision
Quiet
Professional
```

Work 不做：

- 夜店蓝
- 赛博朋克
- 夜间深黑控制台
- 大面积霓虹
- 高饱和蓝

---

## Life — 晨光进入树林

Life Theme 的环境想象为：

> 清晨树林中薄雾尚未散去。  
> 阳光穿过枝叶进入空气，形成非常柔和的散射光。  
> 空气温润、明亮，但不是白色网页。  
> 空间有生命力，同时足够安静。

视觉关键词：

```text
Morning Forest
Soft Sage
Mist
Sunlight
Air
Healing
Alive
Warm
```

Life 不做：

- 奶油少女风
- 大量植物贴图
- 森林照片背景
- 黄色夕阳滤镜
- 大量绿色
- 浅绿色 SaaS Dashboard

---

# 3. 最重要的调整：明度策略

上一版的问题之一，是两个 Theme 的大量元素都集中在：

```text
低明度区间
```

本版重新分配。

---

# 4. Work 明度结构

Work 继续属于 Dark Theme。

但整体视觉明度提高约：

> **10%–15%**

视觉关系：

```text
背景          低明度
      ↓
环境冷雾      中低明度
      ↓
玻璃卡片      中低明度
      ↓
内部 Field    中等明度
      ↓
文字 / Accent 高明度
```

不能再出现：

```text
背景  #101A1E
卡片  #132126
Field #16272C
```

三层几乎没有区别。

---

# 5. Life 明度结构

Life 正式从 Dark Theme 改为：

> **Soft Light / Mist Theme**

不是纯 Light Mode。

视觉关系：

```text
环境背景      浅鼠尾草
      ↓
空气与阳光    浅暖雾
      ↓
柔雾卡片      米雾白
      ↓
Field         灰鼠尾草浅层
      ↓
文字           深灰绿
```

Life 不再使用大面积深绿作为主背景。

深鼠尾草仅作为：

- 阴影
- 边缘
- 局部深层色
- 导航辅助色
- 深色文字来源

---

# 6. Work Color Foundation

## 6.1 页面背景

推荐：

```css
--work-bg-base: #142129;
--work-bg-deep: #0F1B21;
--work-bg-mid: #192A33;
--work-bg-mist: #223943;
```

页面第一感受应该是：

> 青灰。

而不是：

> 蓝黑 / 墨绿。

---

## 6.2 Work 环境渐变

推荐基础背景：

```css
background:
  radial-gradient(
    circle at 34% 16%,
    rgba(116, 170, 194, 0.12) 0%,
    rgba(116, 170, 194, 0.045) 26%,
    transparent 48%
  ),
  radial-gradient(
    circle at 72% 32%,
    rgba(84, 125, 145, 0.055) 0%,
    transparent 34%
  ),
  linear-gradient(
    110deg,
    #101B21 0%,
    #17272F 38%,
    #15252D 66%,
    #0F1C22 100%
  );
```

作用：

- 页面中央打开
- 左右轻微收深
- 上方有冷自然光
- 不再是一整块纯色

---

# 7. Work 冷雾系统

Work 的“雾”不能像 Life 那么柔。

应该更薄、更透明。

建议两层：

## Mist A — Ambient Fog

```css
background:
  radial-gradient(
    ellipse at 42% 10%,
    rgba(164, 205, 221, 0.07),
    transparent 52%
  );
```

用途：

> 提升整个页面空气感。

---

## Mist B — Workspace Focus

在主要 Workspace 背后：

```css
background:
  radial-gradient(
    ellipse at center,
    rgba(108, 160, 184, 0.055),
    transparent 68%
  );
```

作用：

> 让视觉中心自然落到内容区。

不是发光。

---

# 8. Work 玻璃卡片

## Standard Glass

```css
--work-card-bg: rgba(27, 44, 53, 0.66);

background:
  linear-gradient(
    180deg,
    rgba(255,255,255,0.052),
    rgba(255,255,255,0.012)
  ),
  var(--work-card-bg);

border:
  1px solid rgba(193, 221, 231, 0.14);

backdrop-filter:
  blur(15px) saturate(112%);

box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.048),
  0 18px 44px rgba(3,12,17,0.16);
```

---

## Elevated Glass

用于：

- Detail Panel
- Current Project
- 重要工作区域

```css
--work-card-elevated: rgba(34, 53, 63, 0.73);

border:
  1px solid rgba(199, 228, 238, 0.18);
```

不要进一步加深。

提升层级应该靠：

> 更清晰 + 更亮。

而不是：

> 更黑。

---

# 9. Work Field

当前实现里 Field 与 Card 太接近。

新版：

```css
--work-field-bg: rgba(48, 69, 78, 0.64);
--work-field-hover: rgba(54, 77, 87, 0.72);

--work-field-border: rgba(191, 218, 228, 0.14);

--work-field-focus-border:
  rgba(139, 200, 232, 0.56);

--work-field-focus-ring:
  rgba(139, 200, 232, 0.10);
```

Field 必须比父卡：

> **亮一个层级。**

---

# 10. Work 文字

```css
--work-text-primary: #F0F5F7;
--work-text-secondary: #B5C4CA;
--work-text-tertiary: #8DA0A8;
--work-text-muted: #71858E;
```

当前很多 Secondary Text 太灰暗。

新版要求：

> Secondary 必须可以直接阅读，而不是“努力看才看得见”。

---

# 11. Work Accent

```css
--work-accent-primary: #8BC7E8;
--work-accent-hover: #A4D6EF;
--work-accent-active: #B7E1F4;

--work-accent-soft:
  rgba(139, 199, 232, 0.13);

--work-accent-border:
  rgba(139, 199, 232, 0.40);
```

使用范围：

- 当前 Tab
- Focus
- Primary Action
- Selected Item
- Progress
- 少量重要数据

禁止铺满 KPI。

---

# 12. Work 子模块微色差

三个工作模块允许有极弱色温差。

不要另建 Theme。

## 自媒体

偏：

> Cool Cyan

```css
--work-sub-accent: #80C7CF;
```

气质：

> 内容 / 流动 / 创作。

---

## 开发项目

偏：

> Steel Blue

```css
--work-sub-accent: #85AED8;
```

气质：

> 工程 / 精确 / 系统。

---

## 学习

偏：

> Mist Violet

```css
--work-sub-accent: #A8A8D1;
```

气质：

> 思考 / 知识 / 沉静。

强度必须非常弱。

---

# 13. Work 目标画面

Work 页面最终应该出现三个明显视觉层：

```text
冷青灰环境
        ↓
清透玻璃卡
        ↓
更亮的内容 / Field
```

而不是：

```text
深背景
深卡片
深表单
白字
```

---

# 14. Life Color Foundation

Life 正式退出深色 Theme。

## 14.1 页面基础色

推荐：

```css
--life-bg-base: #DEE8DE;
--life-bg-soft: #E7EEE4;
--life-bg-sage: #D2DFD2;
--life-bg-warm: #ECE9DD;
```

整体不使用：

```text
纯白
```

即使最亮区域也应该带：

> 少量鼠尾草 / 米色。

---

# 15. Life 环境背景

建议：

```css
background:
  radial-gradient(
    circle at 24% 10%,
    rgba(255, 227, 192, 0.33) 0%,
    rgba(255, 227, 192, 0.11) 25%,
    transparent 43%
  ),
  radial-gradient(
    ellipse at 58% 20%,
    rgba(205, 223, 203, 0.52) 0%,
    transparent 46%
  ),
  linear-gradient(
    115deg,
    #D5E2D5 0%,
    #E4ECE1 36%,
    #DFE9DE 67%,
    #D1DED1 100%
  );
```

重点：

> 暖光不是主色。

页面第一眼仍然是：

> 浅鼠尾草。

---

# 16. Life 空气系统

Life 可以拥有比 Work 更明显的 Atmosphere。

但必须抽象。

---

## Air Layer A — Morning Mist

```css
background:
  radial-gradient(
    ellipse at 45% 18%,
    rgba(255,255,248,0.22),
    transparent 58%
  );
```

作用：

> 空气被照亮。

---

## Air Layer B — Sage Fog

```css
background:
  radial-gradient(
    ellipse at 75% 52%,
    rgba(172, 196, 173, 0.16),
    transparent 46%
  );
```

作用：

> 页面不至于完全变成米白。

---

# 17. Life 丁达尔光效

丁达尔效果采用：

> **抽象光区，而不是可见光柱。**

最多三束。

例如：

```css
.life-rays::before {
  content: "";
  position: absolute;
  inset: -10%;

  background:
    linear-gradient(
      104deg,
      transparent 14%,
      rgba(255, 233, 201, 0.00) 23%,
      rgba(255, 233, 201, 0.10) 31%,
      rgba(255, 233, 201, 0.025) 40%,
      transparent 50%
    );

  filter: blur(24px);
  pointer-events: none;
}
```

要求：

```text
Opacity：
视觉最终约 5%～10%

Blur：
20～40px

面积：
宽

边缘：
不可见
```

用户不能明确指出：

> “这里有一道黄色光柱。”

用户只能觉得：

> “这个页面里面有阳光。”

这才合格。

---

# 18. Life 光源方向

全 Life Theme 建议统一：

> **左上 → 右下**

原因：

- 与常见自然窗光一致
- 页面顶部 Header 更容易有呼吸感
- 卡片顶部可以自然获得轻高光
- CTA 暖杏色容易融入环境

后续所有生活页面不要各自改变光线方向。

---

# 19. Life Card

生活区卡片从深绿色彻底调整。

## Standard Fog Card

```css
background:
  linear-gradient(
    145deg,
    rgba(255, 253, 246, 0.62),
    rgba(239, 245, 237, 0.52)
  );

border:
  1px solid rgba(124, 151, 128, 0.16);

backdrop-filter:
  blur(8px);

box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.42),
  0 14px 34px rgba(70, 92, 72, 0.09);
```

---

## Elevated Fog Card

```css
background:
  rgba(251, 249, 242, 0.72);

border:
  1px solid rgba(133, 155, 134, 0.19);

box-shadow:
  0 18px 42px rgba(72, 92, 73, 0.11);
```

Elevated 不等于纯白。

---

# 20. Life Field

新版 Field：

```css
--life-field-bg:
  rgba(226, 234, 224, 0.82);

--life-field-hover:
  rgba(220, 230, 218, 0.92);

--life-field-border:
  rgba(126, 151, 129, 0.20);

--life-field-focus-border:
  rgba(214, 164, 119, 0.58);

--life-field-focus-ring:
  rgba(232, 187, 145, 0.16);
```

Field 与 Card 的层级关系：

```text
Card
浅暖雾

Field
略深的鼠尾草灰
```

这样输入框自然被识别。

不需要加深黑色。

---

# 21. Life 文字

浅背景以后必须重新做文字体系。

```css
--life-text-primary: #344239;
--life-text-secondary: #637269;
--life-text-tertiary: #7E8C83;
--life-text-muted: #98A39B;
```

标题不要纯黑。

正文也不要黑灰。

全部带一点：

> 深灰绿。

---

# 22. Life Accent

主 Accent：

```css
--life-accent-primary: #E5AD7C;
--life-accent-hover: #DB9D68;
--life-accent-active: #CF8E58;

--life-accent-soft:
  rgba(229, 173, 124, 0.18);

--life-accent-border:
  rgba(209, 149, 96, 0.42);
```

辅助 Sage：

```css
--life-sage-primary: #87AA8C;
--life-sage-soft:
  rgba(135,170,140,0.14);
```

---

# 23. Life Button

Primary Button 不建议使用非常亮的橙色。

推荐：

```text
暖杏
+
微米白
```

按钮表现：

```css
background: #E9B888;
color: #3F392F;
```

Hover：

```css
background: #E3AA76;
```

不要：

```text
橙底 + 纯白粗字
```

容易变成营销页。

---

# 24. Life 子模块的轻情绪

生活区四个模块允许存在非常轻微的环境色差。

---

## 购物

关键词：

> 温暖 / 整理 / 获得

倾向：

```css
--life-sub-accent: #E3AF80;
```

暖杏稍明显。

---

## 饮食

关键词：

> 新鲜 / 温润 / 滋养

倾向：

```css
--life-sub-accent: #9DBD99;
```

偏柔绿。

---

## 健身

关键词：

> 清爽 / 活力 / 恢复

倾向：

```css
--life-sub-accent: #8CB7A5;
```

稍偏薄荷。

---

## 娱乐

关键词：

> 松弛 / 兴趣 / 愉悦

倾向：

```css
--life-sub-accent: #C6A6A0;
```

可以非常轻地偏：

> 暖粉灰 / 杏灰。

不是粉色娱乐页。

---

# 25. Life 模块色使用限制

子模块色只能出现：

- 图标
- 小型 Badge
- Highlight
- Progress
- 当前状态
- 极小面积 Environment Tint

禁止：

> 整页换背景。

Life 永远保持同一个浅鼠尾草森林环境。

---

# 26. Work / Life 光照差异

这是本版最重要的视觉区别之一。

## Work

光：

```text
冷
方向弱
边缘清晰
扩散较少
```

感觉：

> 冷空气中的窗光。

---

## Life

光：

```text
暖
方向明显一点
边缘柔
扩散更大
```

感觉：

> 阳光穿过薄雾。

---

# 27. Work / Life 雾气差异

## Work Mist

```text
蓝灰
透明
薄
低 Blur
```

主要功能：

> 清透。

---

## Life Mist

```text
米白 + 浅绿
柔软
厚一点
高 Blur
```

主要功能：

> 温润。

---

# 28. Work / Life 边框差异

## Work Border

```text
细
冷
清楚
玻璃高光
```

例如：

```css
rgba(195, 222, 232, 0.15)
```

---

## Life Border

```text
柔
暖
低对比
几乎融入卡片
```

例如：

```css
rgba(126, 151, 129, 0.16)
```

---

# 29. Work / Life 阴影差异

## Work

偏黑青：

```css
rgba(3, 12, 17, 0.16)
```

阴影：

> 短、清晰、薄。

---

## Life

偏灰绿：

```css
rgba(70, 92, 72, 0.09)
```

阴影：

> 更宽、更柔、更淡。

---

# 30. Sidebar 处理

Sidebar 的业务结构保持统一。

但允许跟随 Theme 产生环境变化。

---

## Work Sidebar

推荐：

```css
background:
  rgba(13, 27, 33, 0.88);
```

Border：

```css
rgba(177, 205, 216, 0.10)
```

Active：

```text
冷蓝柔光背景
+
左侧细蓝线
```

---

## Life Sidebar

不能继续使用现在的深森林绿。

建议调整为：

```css
background:
  rgba(210, 223, 210, 0.86);
```

文字：

```text
深灰绿
```

Active：

```text
暖杏浅底
+
深鼠尾草文字
```

这样切换 Work → Life 时，

整个页面的环境才真的会改变。

---

# 31. Life 页面不要纯浅色铺满

浅鼠尾草不是：

```text
整个背景 #DDE8DE
```

然后结束。

必须有：

```text
Base
+
Mist
+
Sunlight
+
Soft Shadow
```

四层。

否则会退化成：

> 普通浅绿色后台。

---

# 32. Work 页面不要靠纯渐变救场

Work 也不能：

```text
dark blue gradient
```

然后认为做完。

必须同时存在：

```text
Background
+
Cold Mist
+
Glass
+
Light hierarchy
```

否则仍然只是：

> 深色 Dashboard。

---

# 33. 页面明暗分布

## Work

建议：

```text
页面顶部           中暗
内容核心区         中等
卡片               中等
Field              中亮
页面边缘           稍暗
```

形成：

> 中央聚焦。

---

## Life

建议：

```text
顶部左侧           稍暖亮
页面中央           明亮
卡片               明亮柔和
边缘               稍深
底部               稍稳定
```

形成：

> 光进入空间。

---

# 34. 空白区域也属于设计

本版要求：

不要因为背景漂亮，就继续填满卡片。

尤其 Life：

空白区域应该允许用户看到：

- 雾
- 浅绿
- 暖光
- 空气

这些不是浪费空间。

这些就是：

> Life 的情绪设计。

---

# 35. 背景特效性能要求

所有环境光优先：

```text
CSS Gradient
Pseudo Element
Static Blur Layer
```

不要使用：

- Canvas 粒子
- WebGL
- 视频背景
- 大型动态噪点
- 实时光线 Shader

Work / Life 的背景不应该与 Today Scene 竞争性能。

---

# 36. 动态环境限制

允许非常轻的动态。

例如 Life：

```text
Mist Position
20–40 秒
移动 1%～2%
```

Work：

```text
冷雾 opacity
缓慢变化 2%～3%
```

但默认：

> 静态就必须已经成立。

动画只是加分。

---

# 37. reduced-motion

当：

```css
prefers-reduced-motion
```

启用时：

所有 Atmosphere 动画停止。

但保留：

- 雾
- 光
- 渐变
- 环境层级

页面视觉不能因此退化。

---

# 38. Work 验收标准

完成后截图快速判断：

### 第一眼

应该感受到：

> 清冷、安静、专业。

而不是：

> 黑。

### 第二眼

应该看到：

> 信息结构。

而不是：

> 卡片。

### 第三眼

才注意到：

> 玻璃材质和冷蓝细节。

如果第一眼就看到“大量玻璃特效”，说明过度。

---

# 39. Life 验收标准

### 第一眼

应该感受到：

> 明亮、温和、有空气。

### 第二眼

应该感受到：

> 鼠尾草绿与晨光。

### 第三眼

才注意到：

> 柔雾卡片和暖杏操作。

如果第一眼变成：

> “浅绿色网页”

说明情绪层不足。

如果第一眼变成：

> “森林主题 App”

说明自然元素过度。

---

# 40. Work / Life 最终对照

| 维度 | Work | Life |
|---|---|---|
| 环境 | 清晨工作室 | 晨间树林 |
| 明度 | 中低 | 中高 |
| 主色 | 深青灰 | 浅鼠尾草 |
| 光 | 冷白蓝 | 暖杏金 |
| 雾 | 冷薄雾 | 晨间柔雾 |
| 卡片 | 清透玻璃 | 柔雾卡 |
| Field | 冷青灰 | 灰鼠尾草 |
| 边框 | 清晰冷边 | 柔和绿灰边 |
| Accent | 冷蓝 | 暖杏 |
| 阴影 | 冷、薄 | 暖、柔 |
| 情绪 | 专注清醒 | 放松治愈 |

---

# 41. 改造执行顺序

不要同时重做所有组件。

严格按照：

```text
01
建立新 Theme Token

↓

02
只修改页面背景

↓

03
加入 Work Cold Mist
加入 Life Morning Mist / Sunlight

↓

04
截图验证两个空间情绪是否成立

↓

05
调整 Card

↓

06
调整 Field

↓

07
调整 Border / Shadow

↓

08
调整 Accent / Button

↓

09
调整 Sidebar Theme

↓

10
进入自媒体 / 开发 / 学习
以及
购物 / 饮食 / 健身 / 娱乐
逐页微调

↓

11
最终统一 QA
```

---

# 42. 第一轮不要做什么

背景还没有调对以前，不要：

- 大改布局
- 调字体
- 调大量间距
- 重做按钮组件
- 给所有页面分别选新颜色
- 调复杂动画

第一轮只有一个目标：

> **让 Work 和 Life 即使没有任何内容，仅看空白页面背景，就已经具有不同情绪。**

如果这一点成立，

后面的卡片才有意义。

---

# 43. 建议 Codex 第一轮只做两个 Master Preview

创建开发用预览：

```text
/work/theme-preview
/life/theme-preview
```

或者项目内等价 Preview。

只展示：

```text
Background
Atmosphere
Card
Elevated Card
Field
Button
Tabs
Badge
Text hierarchy
```

不要先套进几十个业务页面。

先把两套母版设计正确。

确认后再批量替换 Theme Token。

---

# 44. 最终设计判断

本版之后：

## Work 不再是：

> 一个暗色工作后台。

而应该是：

> **清晨冷空气中的个人专业工作室。**

---

## Life 不再是：

> 一个绿色版管理后台。

而应该是：

> **晨光穿过薄雾、具有生命力的个人生活空间。**

---

# 45. 本轮最核心原则

> **颜色负责身份，光负责情绪，雾负责空气，材质负责空间。**

如果只修改 Color Token：

这轮改造失败。

如果 Work 和 Life 即使转换成灰度图，仍然能够通过：

- 明暗
- 空气
- 卡片质感
- 空间感觉

被明显区分，

这轮改造才真正完成。