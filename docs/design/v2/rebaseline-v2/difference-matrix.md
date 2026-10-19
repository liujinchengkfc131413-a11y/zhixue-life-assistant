# V2 新计划 Phase 0 · 差异矩阵

> 审计日期：2026-08-25  
> 对比范围：当前代码与《生活助手 V2 美术设计规范 V2》  
> 说明：本表记录改造起点，不代表对应视觉已经通过。

## 1. Foundation

| 项目 | 当前实现 | 新版目标 | 处理阶段 |
|---|---|---|---|
| Theme 路由 | `AppShell` 已输出六类 `data-theme` | 保留六类 Theme | Phase 1 复核 |
| Typography | H1 30px；H2 19px；H3 16px | H1 30—32px；H2 22—24px；H3 17—18px | Phase 1 |
| Semantic Colors | 使用 `--color-*`，部分色值与新版不同 | 统一新版 success / warning / danger / info | Phase 1 |
| Field Token | 缺少完整 Field / Hover / Border 契约 | 所有 Theme 映射统一 Field 角色 | Phase 1 |
| Focus Token | 以 `--focus-ring` 和 `--border-strong` 为主 | 明确 `--border-focus` 与一致状态逻辑 | Phase 1 |
| Environment | 页面渐变为主，缺少独立环境层 | 可响应、可降级、不可交互的 Atmosphere 层 | Phase 1 |
| CSS 审计 | 只审计 `styles/pages/*.css` | 覆盖所有新版页面和主题组件样式 | Phase 1 |
| 旧直接色值 | `global.css` 当前检测到 269 处颜色函数或 Hex | 页面主题色迁出 `global.css` | Phase 4—6，Phase 7 清理 |

## 2. Today

| 项目 | 当前实现 | 新版目标 | 处理阶段 |
|---|---|---|---|
| Scene Theme | 已确认的独立场景、视频状态和布局 | 独立维护，不作为其他 Theme 模板 | 全程保护 |
| Sidebar | 独立白色 Sidebar | 允许保留，统一信息架构和几何逻辑 | Phase 7 |
| Foundation 影响 | 共享控件仍可能受 Token 变化影响 | 非动态区域无视觉侵入 | 每阶段回归 |

## 3. Work

| 项目 | 当前实现 | 新版目标 | 处理阶段 |
|---|---|---|---|
| 背景基底 | `#0d171b / #122127`，容易偏墨绿黑 | 深青灰 / 蓝灰，禁止墨绿黑 | Phase 2 |
| 环境层 | 一个 Radial + 一个 Linear Gradient | Deep Base + Cold Mist + Environmental Light | Phase 2 |
| Glass | 已有 18px Blur 和半透明 Surface | 约 14px Blur、顶部高光、克制阴影 | Phase 2 |
| Elevated | 已有独立 Surface | 通过更亮、更清楚和略强边框提升 | Phase 2 |
| Field | 未形成独立、稳定的亮一级契约 | Field 比 Card 亮一级 | Phase 1—2 |
| 布局 | 12 栏、8/4 主次、master-detail 已成立 | 保留结构与高扫描效率 | Phase 2 |

## 4. Life

| 项目 | 当前实现 | 新版目标 | 处理阶段 |
|---|---|---|---|
| 明度 | 深鼠尾草 Theme | 浅鼠尾草 + 米雾白 | Phase 3 重建 |
| 环境层 | 深色 Radial + Linear Gradient | Sage Base + Morning Mist + Warm Sunlight + Soft Edge Shadow | Phase 3 |
| 丁达尔效应 | 不存在正式宽光区 | 左上至右下 2—3 个宽光区，高 Blur、无硬边 | Phase 3 |
| Card | 深色半透明 Fog | 暖白 / 浅灰绿 Soft Fog | Phase 3 |
| Elevated | 深色 Surface 提升 | 更白、更清楚，不加深 | Phase 3 |
| 文字 | 浅色文字 | 深灰绿正文，避免纯黑 | Phase 3 |
| Field | 深色控件体系 | 略深于 Card 的灰鼠尾草 | Phase 1—3 |
| 布局 | 7/5、4/8 与 master-detail 已成立 | 保留有序非对称和功能骨架 | Phase 3 |

## 5. Vision

| 项目 | 当前实现 | 新版目标 | 处理阶段 |
|---|---|---|---|
| 四视图 | 看板、日历、时间轴、目标树已可运行 | 四视图成为主 Workspace | Phase 4 |
| Material | 共享基础 Surface，旧直接色值仍多 | Air Glass、弱边框、少阴影、大留白 | Phase 4 |
| 看板 | 接近传统列与卡片 | Column 为空间容器 | Phase 4 |
| 时间轴 | 已有轨道结构 | 细线、大留白、里程碑高光 | Phase 4 |
| 背景 | Vision Token 初步存在 | 深蓝灰、雾青、极弱蓝紫远光，无星空粒子 | Phase 4 |

## 6. AI

| 项目 | 当前实现 | 新版目标 | 处理阶段 |
|---|---|---|---|
| 页面结构 | 设置区、会话记录列表和嵌套内容 | Session List + Main Conversation | Phase 5 |
| 消息 | 通用记录列表语言 | User 轻气泡、AI 文档流 | Phase 5 |
| Operation | 已展示工具结果和撤销，但沿用通用 Row | 高权重结构化 Operation Card | Phase 5 |
| Activity | 已有 `--ai-glow` Token | 只在 Composer 活动状态使用极弱 Glow | Phase 5 |

## 7. System

| 项目 | 当前实现 | 新版目标 | 处理阶段 |
|---|---|---|---|
| Material | Theme Token 已有 Matte 倾向，页面仍有旧白色硬编码 | 全面 Matte，中性灰 + 少量灰青 | Phase 6 |
| Inbox | 列表 + 详情已成立 | 待处理内容优先，强化处理流程 | Phase 6 |
| Data | 历史与回收站功能已存在 | 可靠性优先，危险区独立置底 | Phase 6 |
| Reminders | 通知列表已存在 | 今天 / 更早时间序列，四类状态不过度 Warning 化 | Phase 6 |
| Settings / Setup | 路由回退到 System | 作为 Utility 衍生页面做兼容检查 | Phase 6 |

## 8. 旧断言处置

- 旧 Work / Life 的功能、路由、字段和布局断言可以保留。
- 旧 Work “墨绿黑仍通过”的颜色判断必须替换。
- 旧 Life “深鼠尾草通过”的颜色、文字和材质判断必须删除或重写。
- 旧 H2 19px、H3 16px 等精确值不得继续作为新版 Foundation 通过条件。
- 新验收材料不得引用 V1 规范作为通过依据。
