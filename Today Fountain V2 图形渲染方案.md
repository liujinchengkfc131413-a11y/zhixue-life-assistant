Today Fountain V2 图形渲染方案
版本目标
当前 V1

技术结构：

背景 PNG
+
Canvas 水流线
+
状态 UI
+
时间轴

表现：

有动态
有数据绑定
有压力映射

但视觉结果：

一个 Dashboard 中间放了一座动态喷泉。

V2 目标

升级为：

Today Scene


环境层
  ↓
水池层
  ↓
动态喷泉层
  ↓
水滴粒子层
  ↓
水雾光效层
  ↓
状态映射层
  ↓
UI Overlay

最终效果：

喷泉不是页面里的组件，而是页面本身。

一、核心设计原则
1. 喷泉 = 状态引擎

不要：

压力数字
 ↓
改变几个参数
 ↓
喷泉动一下

而是：

用户状态
 ↓
视觉状态模型
 ↓
喷泉表现

中间增加：

Fountain Visual State

数据：

{
 pressure: 35,


 workRatio:0.45,
 lifeRatio:0.2,
 sleepRatio:0.3,


 currentMode:"work",


 timeProgress:0.62
}

转换：

Today Data


↓


Visual State


↓


Renderer
二、整体渲染架构
推荐最终结构
TodayScene
│
├── EnvironmentLayer
│
├── FountainRenderer
│
│   ├── WaterSurface
│   ├── MainJet
│   ├── ArcStreams
│   ├── Droplets
│   ├── Splash
│   ├── Mist
│   └── Lighting
│
├── TimelineOverlay
│
├── StatusOverlay
│
└── PlanOverlay
三、视觉分层设计
Layer 0：环境背景

职责：

创造空间。

包含：

深色渐变背景
环境光
雾气
远景空间

不要包含：

❌ 水柱

❌ 水滴

❌ 动态状态

原因：

现在你的 PNG 最大问题：

所有东西烘焙在一起。

导致：

动态水永远像贴上去。

推荐：

background.webp


内容：


天空
空间
光
环境色
Layer 1：水池

水池应该独立。

包含：

池壁
水面
反射
波纹

结构：

WaterSurface


+
Reflection


+
Ripple

水面动态：

参数：

{
 waveSpeed,
 rippleStrength,
 reflectionIntensity,
 distortion
}

状态影响：

压力高：

波纹增强
反射扰动增加

压力低：

水面平稳
Layer 2：中央主水柱

这是视觉中心。

不要画：

一条白线

应该：

外层光晕


+
主体水体


+
高光


+
透明边缘

结构：

      glow


      ||
    water


      ||
    highlight

参数：

{
height,
radius,
brightness,
flowSpeed,
noise
}

压力映射：

低压力

高度：

60%

特点：

柔和
稳定
光弱
正常

高度：

80%

特点：

饱满
连续
高压力

高度：

100%

特点：

更猛烈
更宽
水滴增加
Layer 3：弧形水流

这是当前版本最大缺失。

参考图真正有生命感的是：

大量弧形水流。

不要：

几条 SVG curve

建议：

粒子路径。

每条水流：

class WaterArc {


start


control


end


velocity


gravity


noise


}

轨迹：

贝塞尔曲线：

        *
     *
  *
*

加入：

随机扰动：

noise(t)

让每次不是完全一样。

Layer 4：水滴粒子系统

这是参考图高级感来源。

当前版本：

缺少：

飞溅
小水滴
落水碎片

粒子：

Particle{


x


y


velocity


gravity


life


size


alpha


}

生成位置：

水弧末端。

生命周期：

生成


↓


飞行


↓


落水


↓


消失

数量：

正常：

200~500

高压力：

500~1000

Layer 5：落水 Splash

落水位置：

水流
 ↓
水面
 ↓
飞溅

增加：

小圆环
水花
波纹
Layer 6：水雾 Mist

参考图里面大量柔光来自：

水雾。

不是简单 blur。

实现：

粒子：

低速度
低透明
大尺寸

参数：

{
opacity,
spread,
riseSpeed
}
Layer 7：光照系统

增加空间感。

三个光：

主光

中央水柱。

颜色：

白绿。

环境光

跟状态变化。

水面反射光

跟波纹变化。

四、状态映射系统

不要直接：

pressure → height

增加：

Visual Profile。

Calm

低压力：

{
waterHeight:0.6,
flowSpeed:0.5,
particleCount:200,
mist:0.8,
ripple:0.3
}
Balanced

正常：

{
waterHeight:0.8,
flowSpeed:0.7,
particleCount:500
}
Busy

高压力：

{
waterHeight:1,
flowSpeed:1,
particleCount:1000,
ripple:0.8
}
五、工作/生活/睡眠/空闲映射

不要颜色区分水柱。

应该影响：

工作

影响：

水流方向更集中
主柱更稳定
节奏更快
生活

影响：

暖色光
柔和波纹
睡眠

影响：

水面稳定
雾增加
流速降低
空闲

影响：

水流降低
空间呼吸感增加
六、技术方案选择
第一阶段

继续 Canvas 2D。

原因：

你当前已经有基础。

实现：

Canvas


+
Particle System


+
Layer Composite

目标：

达到参考图 80%。

第二阶段

如果需要更真实：

升级 WebGL。

结构：

Three.js


+
Shader


+
Particle System

支持：

Fresnel
Reflection
Real water surface
Depth
七、Renderer 文件设计

建议：

fountain/


├── fountain-renderer.ts


核心入口




├── fountain-state.ts


视觉状态




├── water-jet.ts


主水柱




├── water-arc.ts


弧形水流




├── water-particle.ts


水滴




├── water-surface.ts


水面




├── mist-system.ts


水雾




├── lighting.ts


光照




└── pressure-profile.ts


状态映射


八、性能要求

目标：

60 FPS

限制：

普通：

particles < 500

高：

particles < 1000

后台：

暂停。

已有能力保留。

九、开发顺序
Phase 1

拆环境资产。

目标：

解决：

“PNG 图片感”。

完成：

背景独立
水池独立
动态层透明
Phase 2

重写 Fountain Visual State。

目标：

建立：

Today Data


↓


Visual State


↓


Renderer
Phase 3

升级水流。

增加：

主水柱
弧形水流
水滴
Phase 4

增加：

水面
Splash
Mist
Lighting
Phase 5

状态调优。

测试：

低压力：

↓

正常：

↓

高压力：

确认：

肉眼明显。

十、验收标准

不是：

“代码运行。”

而是：

静态视觉

1536×1024：

参考图对比。

检查：

喷泉比例
水池位置
主视觉占比
空间感
动态视觉

必须看到：

水流持续变化
水滴随机运动
水面波动
水雾变化
状态视觉

隐藏数字：

只看喷泉。

用户仍应该判断：

平静
正常
紧张

三个状态。

最终目标

V1：

一个带动态效果的数据面板。

V2：

一个会随着用户一天状态变化而呼吸的生活场景。

给 Codex 的一句话任务定义

不要继续优化当前“Canvas 线条喷泉”。请按照 Fountain Visual System 的方式重构：保留已有 Today 数据、压力映射和生命周期管理，将喷泉从一个 UI 装饰组件升级为由状态驱动的实时环境渲染系统。优先解决图层职责、环境资产拆分、水体层级和视觉状态表达，而不是简单增加动画数量。