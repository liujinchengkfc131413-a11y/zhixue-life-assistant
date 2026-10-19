# V2 Phase 2 · Work Theme 验收

> 日期：2026-08-23  
> 基准视口：1536×1024  
> 扩展视口：1366×768、1920×1080、1100×900  
> Fixture：`test-results/v2-work/data`（隔离演示数据）  
> 对比依据：`docs/design/v2/baseline/work-*.png` 与《生活助手 V2 美术设计规范 V1》第 5–9 节

## 结论

Phase 2 Work Theme 通过本阶段验收。Overview、自媒体、开发项目、学习四个入口已形成深青灰、冷调玻璃、稳定网格的 Work 空间；页面功能、业务结构、数据关系、接口与权限语义未修改。

## 需求核对

| Phase 2 要求 | 实现与证据 | 结果 |
|---|---|---|
| 深青灰为第一感知，蓝色只用于焦点/当前项/主操作 | 页面背景读取 Work Token；Accent 仅用于选中、进度与主按钮 | 通过 |
| 总览 12 栏、主要 8 栏、辅助 4 栏 | 自媒体主模块 8 栏，开发与学习各 4 栏；统计位于低一层 Metric Strip | 通过 |
| 四项指标为高密度 Metric Strip | 单一弱表面、内部分隔，不再是四张同权重发光卡 | 通过 |
| 自媒体保留五列功能 | 五状态列原样保留；列为 Soft 边界，卡为 Normal，选中仅 Focus 边框 | 通过 |
| 开发与学习保持 master-detail | 宽桌面 7/5，1100px 按既有 1120px 断点堆叠 | 通过 |
| 编辑器/附件/趋势/里程碑/缺陷/仓库使用共享 Token | 所有页面级颜色、边框、表面、进度与语义色均读取通用 Token | 通过 |
| Hover 160–180ms、亮度 +2%～4%、最多上移 1px | `--motion-hover: 170ms`，页面 Hover 为 `brightness(1.02–1.03)` / `translateY(-1px)` | 通过 |
| Soft / Normal / Focus 三档边框 | 普通容器 Soft、条目 Normal、选择/焦点 Strong；无 2px 边框或双层发光 | 通过 |

## 自动化与浏览器 QA

目标流程：`/work` → Work 模块导航 → `/work/self-media` → “趋势” → 趋势图可见。

| 检查 | 结果 |
|---|---|
| 页面身份与 `data-theme="work"` | 通过 |
| 页面非空 | 通过 |
| Framework Error Overlay | 0 |
| Console warning/error | 0 |
| 16 个路由/视口组合横向溢出 | 0 |
| 筛选、视图切换、选中详情、键盘焦点 | 通过 |
| 18px 主玻璃、170ms Hover、辅助卡无阴影 | 通过 |
| reduced-motion | 通过 |

专用命令：`pnpm test:e2e:v2-work`，结果 4/4 通过。

完整阶段门禁（本次新鲜运行）：

| 命令 | 结果 |
|---|---|
| `pnpm lint` | 通过，0 warning / 0 error |
| `pnpm audit:v2-css` | 通过，检查 1 个页面样式文件 |
| `pnpm typecheck` | 通过，11/11 包 |
| `pnpm test` | 通过，257 项；2 项手动/性能测试按设计跳过 |
| `pnpm build` | 通过，11/11 包；保留既有主 JS chunk > 500kB 提示 |
| `pnpm format:check` | 未通过；仅为 Phase 1 已登记的 8 份 `docs/design/today/v3/phase{2..9}/metrics.json` 既有格式债，本阶段所有改动文件定向 Prettier 通过 |

## 视觉对照与修正记录

| 对照项 | 首轮渲染 | 修正 / 保留理由 |
|---|---|---|
| Work 总览 | 旧版为三张同权重浅色模块 | 改为 8/4 主次网格和紧凑指标条 |
| 自媒体 | 旧列面板与卡片存在浅色硬编码和双层选中描边 | 改为 Work Token、弱列边界、Normal 卡和单层 Focus |
| 学习详情 | 首轮 Phase 2 在 1536px 仍横向溢出 98px | 三进度输入改为 `repeat(3, minmax(0, 1fr))`，复跑为 0 |
| 1100px | 双栏空间不足 | 延续既有断点堆叠，不新增移动端布局 |

## 截图证据

目录 `docs/design/v2/work/` 共 16 张：

- `overview-{1536x1024,1366x768,1920x1080,1100x900}.png`
- `self-media-{1536x1024,1366x768,1920x1080,1100x900}.png`
- `development-{1536x1024,1366x768,1920x1080,1100x900}.png`
- `learning-{1536x1024,1366x768,1920x1080,1100x900}.png`

## 遗留事项

- 本阶段只验收桌面 Chrome；Edge 核心路径留到 Phase 8。
- 自动化以非破坏性交互保护为主，删除确认及真实 mutation 全链路沿用既有全量 E2E，Phase 8 再统一复跑。
- Life 仍共享部分旧 `work-*` 类名，按计划在 Phase 3 继续迁移中性视觉契约。
