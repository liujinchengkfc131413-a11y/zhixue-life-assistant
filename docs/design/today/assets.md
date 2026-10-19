# 今日沉浸式界面——资产清单（T2）

> 记录今日页使用的全部视觉资产：来源、用途、尺寸与许可。
> 规则见《今日沉浸式界面独立重构设计书》§7.3（不整图铺底、不拉伸、图标统一、不烘焙文字）。

## 1. 概念图（构图基准，非运行资产）

| 文件 | 来源 | 用途 | 说明 |
|---|---|---|---|
| `concept-reference.png` | `D:/Downloads/ChatGPT Image 2026年8月15日 15_20_54.png`（用户提供，生成式 AI 概念图） | 1536×1024 构图 / 光色 / 材质参考 | 仅作视觉基准与同尺寸对比输入；禁止整图作为页面背景铺底 |

## 2. 喷泉场景资产

| 文件 | 来源 | 用途 | 说明 |
|---|---|---|---|
| `apps/web/src/assets/today/fountain-scene-v1.png` | 2026-08-15，内置 Image Gen；输入为用户提供概念图的构图、光色与材质参考 | 今日页中央喷泉的静态水体、环境、水池和光照基底 | 1536×1024；不包含 UI、文字、数字或任务。Canvas 仅叠加数据驱动的水压高光、落水、波纹和粒子，不替代资产主体。 |

已移除内联程序化 SVG 水池/水弧作为正式视觉主体。动态层仍保留以下职责：

| 图形层 | 用途 | 实现 |
|---|---|---|
| 水柱流动高光 | 压力驱动的持续升腾感 | Canvas 细窄贝塞尔高光 |
| 水弧轮廓与高光 | 工作、生活、空闲对水流活跃度的映射 | Canvas 低透明轮廓与移动短高光段 |
| 落水光点、粒子和波纹 | 压力与喷溅反馈 | Canvas 粒子与椭圆波纹 |

> 水体分层（底色/主体/高光三通道）与动态在 T4 接入；本资产为构图与材质基准。

## 3. 图标（统一图标库）

依赖：`lucide-react`（ISC 许可，npm 统一图标库）。

| 使用位置 | 图标 |
|---|---|
| 侧栏导航：今日 / 工作 / 生活 / 计划与目标 / AI 助手 | Home / Briefcase / Heart / Target / Bot |
| 侧栏辅助：收集箱 / 数据管理 / 提醒中心 / 设置 | Inbox / Database / Bell / Settings |
| 侧栏全局：快速记录 / 全局搜索 | PenLine / Search |
| 今日时间分布状态块 | Moon / Briefcase / Heart / Leaf |

## 4. 背景与材质（CSS，无位图）

- 深青绿沉浸背景：CSS 多层 radial-gradient 光晕 + linear-gradient（见 `today-immersive.css` 主题 token）。
- 玻璃卡片：`backdrop-filter: blur` + 半透明背景 + 边框高光 + 投影（右栏 / 添加表单 / 时间轴 / AI 输入 / 压力块）。

## 5. 主题 token

定义于 `today-immersive.css` 的 `.today-immersive` 作用域（不污染全局）：

- 色系：深青绿背景（`--today-bg-*`）、湖水蓝绿主色（`--today-accent`）、暖白文字（`--today-ink-*`）。
- 类别色：睡眠冷蓝紫 / 工作青绿 / 生活珊瑚橙暖金 / 空闲低饱和灰青。
- 层级：玻璃透明度（`--today-glass*`）、圆角（`--today-radius-*`）、阴影（`--today-shadow`）、光晕（`--today-glow`）。

## 6. 许可与维护

- `lucide-react`：ISC，随 pnpm-lock 记录。
- Canvas 动态层与 CSS：项目自有，MIT（随仓库）。
- `fountain-scene-v1.png`：本项目内由 Image Gen 创建，供本项目使用；替换时须更新本清单。
- 概念图：用户提供，仅本项目内使用；重新生成或替换须更新本清单。
