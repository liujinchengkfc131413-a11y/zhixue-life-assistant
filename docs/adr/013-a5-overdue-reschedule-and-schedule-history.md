# ADR-013：A5 逾期自动重排与调度历史

- 状态：已实施（2026-08-30，待独立只读复审判定 CLOSED）
- 日期：2026-08-30
- 对应缺口：A5（完成释放、逾期自动重排、调度历史用户闭环）

## 决策

### 1. 持久 overdue next-due job（复用 background_jobs + JobRunner）

- jobType `schedule.overdue`，handler 在服务进程内运行（与浏览器无关），
  到点调用 `reschedule(now 对齐 15 分钟网格, +3 天, 'OVERDUE')`。
- 下一次检查时间 = `min(未完成任务活动块的最早 end_at, 无块未完成任务的最早 due_at)`，
  同一任务只按一个检查点触发（有块看块结束，无块看 due），避免重复处理。
- 幂等：enqueue 以 `schedule:overdue:<epoch>` 为幂等键；handler 按 `checkpoint <= now`
  批量处理，处理过的块软删除/任务获得新块后不再命中；重复执行不产生重复块/释放。
- 重启补跑：启动时 `refreshOverdueNextDue()` 保留已到期 PENDING job，
  `jobRunner.start()` 的 `recoverExpiredLeases + runDueJobs` 自动补跑。
- 每次 `reschedule()` 成功后内部刷新 next-due job（更早检查点出现即提前入队）。

### 2. Overdue 任务的 dueAt 语义

- 非逾期任务保持"尽量在 dueAt 之前安排"不变。
- 逾期任务（now > dueAt）：`dueAt` 原值不改，但不再作为硬性上限；
  `deterministic-scheduler` 通过可选 `effectiveDueAt`（= 排程窗口 end）允许从当前时间
  向未来寻找最早合法时间。无魔法 fallback 常量。
- 其余不变量（15 分钟网格、sleep/fixed/immovable 不占用、无 overlap、dependency 未满足
  不排、locked 不覆盖、split 每块 ≥ 30 分钟、无空位出 UNSCHEDULED 警告）全部沿用引擎。

### 3. 旧块处理

- `reschedule` 开头幂等释放"已结束但仍未完成"任务的旧块：软删除（30 天清理语义）+
  块行写 `reason_code='RELEASED'`、`reason_json={reason: trigger, releasedAt}`；
  释放后时间立即重新计为空闲。释放的旧块保持其创建 run（原时间追溯链不变），
  本次 run 的释放清单写入 `schedule_runs.summary_json.releasedBlocks`。

### 4. 完成/取消释放

- `releaseTaskBlocks` 在完成/取消/更新时同样软删除块并写 RELEASED 原因
  （TASK_COMPLETED / TASK_CANCELLED / TASK_UPDATED），进入 schedule history。

### 5. Schedule-specific history（不进入 A6 canonical restore）

- 新块 `reason_json = { outcome: RESCHEDULED|SCHEDULED, previousBlocks: [...] }`；
  previousBlocks/newBlocks 均为数组，支持 split 多块。
- 任务维度历史由 `schedule_blocks`（active + 软删除）+ `schedule_warnings` + `schedule_runs`
  组合回答：原本时间、失效原因、重排原因、新时间、失败原因。
- 运行维度历史：`schedule_runs` + `summary_json`（createdBlocks/releasedBlocks/
  affected/rescheduled/unscheduled）+ warnings。
- **不新增 migration**：复用既有 `schedule_runs`、`schedule_blocks`、`schedule_warnings`
  的 `reason_code`/`reason_json`/`summary_json`/`schedule_run_id` 列。

### 6. 失败隔离

- `autoSchedule`（canonical 写操作之后的 derived reschedule）捕获异常：
  不返回错误，记录日志并 enqueue `schedule.reschedule` 重试 job
  （原死链 handler 复用为重试路径），`finally` 刷新 next-due job。
- canonical 任务完成成功后，derived schedule 失败不得伪装成操作失败。

## 验证

- 服务级 9 项 + deterministic 2 项 + 后台 drill 4 项 + m2 历史 API 1 项 + 抽屉 UI 3 项。
- 完整 `pnpm verify` exit 0（Vitest 77 文件 342 项通过、7 跳过）。

A15 保持 OPEN；本决策不进入 AI OperationContext / canonical restore。
