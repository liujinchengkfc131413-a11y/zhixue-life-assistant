# fixtures/performance——基准数据生成

M8-007 交付的 10 万记录 / 5 万消息基准数据生成配置与入口。

## 生成全量基准数据库

```bash
pnpm fixtures:benchmark --out test-results/benchmark/life-assistant.benchmark.db
```

默认配置见 `benchmark.config.json`：10 万任务、5 万聊天消息（250 会话 × 200 条），
并配套目标、计划、日程、笔记、七个专属模块记录与收集箱输入，覆盖数据库设计书 §22.2
的长期个人使用基准量。

## 常用参数

| 参数 | 说明 |
|---|---|
| `--out <path>` | 输出 SQLite 文件路径（必填） |
| `--seed <number>` | 覆盖配置中的确定性种子（默认 20260814） |
| `--scale <number>` | 按比例缩放目标数量（如 `--scale 0.01` 生成 1000 任务） |
| `--no-search` | 跳过搜索投影重建，加快生成 |
| `--verbose` | 打印搜索投影重建计数 |

生成完成后自动执行 `quick_check`、外键检查与记录数断言；任一失败以非零码退出。

## 生成内容

- `tasks`：100,000 条，分布在工作/生活分类，覆盖全部状态与优先级。
- `chat_sessions` / `chat_messages` / `ai_runs`：250 会话、50,000 条消息，
  用户/助手交替并附带已完成运行记录。
- `goals`、`plans`、`events`、`notes`、`inbox_items`：配套可聚合对象。
- 七专属模块：自媒体内容、开发项目、学习资源、购物项、食谱、餐食、
  动作库、训练记录、娱乐条目。
- 固定种子 + 固定时钟生成，同种子结果完全可重放；生成后 `rebuildSearchIndex()`
  重建 FTS 搜索投影。

## 验证

```bash
pnpm exec vitest run packages/database/src/benchmark-data-generator.test.ts
```

测试覆盖：记录数精确匹配、外键与完整性检查、搜索投影重建、同种子确定性、
独立路径建库（`BenchmarkDataGenerator.createAt`）。
