# V2 RC3 AI Provider Robustness Report

- 基线：`v2.0.0-rc.2`（commit `eeb6f262d82ee7115368f488c3c279f30fe5614d`）
- 修复分支：`codex/v2-rc3-ai-provider-hotfix`
- 范围：只修复 AI Provider 异常恢复、会话协议、时间上下文与诊断日志；无业务功能、视觉或 AI 架构重构。
- 报告日期：2026-09-07

## 候选定位

- RC2：首次真实 Provider 手测暴露鲁棒性缺口的历史候选。
- RC3：Provider robustness hardened candidate。

## 真实手测发现

真实 DeepSeek Provider 手测发现：Provider 已经输出部分 text delta，但在 `response.completed` 前断流时，旧实现会让 adapter 正常结束迭代；ChatRunner 随后仅依据“本轮没有工具调用”进入完成路径，导致半截 assistant message 可能被错误写成 `COMPLETED`。同类风险也覆盖半截 tool-call，以及工具已成功执行后最终 assistant 续答断流的场景。

## 根因结论

### 已确认

1. `OpenAiProvider.streamTools()` 旧实现遇到 EOF 直接结束，没有断言必须收到 `response.completed`。
2. `ChatRunner` 旧实现只用 `calls.length === 0` 判定流式多轮结束，没有逐轮校验合法完成事件。
3. history builder 已经只接纳 `COMPLETED` assistant message；FAILED、CANCELLED、STREAMING、PENDING assistant 原本不会进入下一轮，但缺少覆盖全部状态的精准回归。
4. Provider 的跨轮 `previousResponseItems/toolOutputs` 只存在于当前 Run 的内存循环；下一 Run 从 canonical message history 重建，不会主动读取旧 `ai_tool_calls`。风险来自把半截 assistant 错标成完成，而不是 serializer 主动重放数据库 tool turn。
5. `failRun/cancelRun` 旧实现没有收敛同 Run 中可能残留的 `ai_tool_calls.RUNNING`。
6. ChatRunner 旧实现没有为每个 Run 统一注入可信当前时间；只有从“今日”页面发出的特定消息可能携带页面上下文。
7. 旧失败日志只有 `runId/errorCode`，部分 adapter 诊断还嵌套在 `diagnostics`，不能稳定提供本次要求的终止原因与 completed/event 证据。

### 仅推测

1. 真实 DeepSeek silent EOF 的上游原因可能是网络代理、连接复用、Provider 侧提前关闭或客户端 socket interruption；本仓库没有足够外部链路证据区分这些来源。
2. 手测时模型通过搜索更新时间反推日期，推测是因为普通 Chat Run 缺少服务端时间锚点；无法从既有日志恢复当时 Provider 的完整内部推理，也不记录敏感 prompt 来佐证。

## 修改文件

- `packages/ai-adapters/src/index.ts`：严格完成信号、silent EOF/socket/timeout/解析/HTTP/Provider failure 归一化与脱敏诊断。
- `packages/ai-adapters/src/index.test.ts`：adapter silent EOF、socket interruption、解析异常和敏感内容不入诊断的回归。
- `apps/server/src/chat-runner.ts`：逐轮 completed gate、Run 级结构化故障日志、服务端 temporal context。
- `apps/server/src/chat-runner.test.ts`：多 delta silent EOF、半截 tool-call、工具成功后续答断流、下一轮恢复、日志字段、时间上下文与正常流保持测试。
- `apps/server/src/runtime-probe.ts`：向 ChatRunner 注入统一服务端 Clock。
- `packages/database/src/chat-repository.ts`：失败/取消 Run 的 RUNNING tool-call 收敛；保留已成功业务执行；处理取消与工具真实成功竞态。
- `packages/database/src/chat-repository.test.ts`：未完成 assistant history 隔离及 tool-call 状态收敛回归。
- `修改日志.md`：RC3 hotfix 变更与验证记录。
- `V2_RC3_AI_Provider_Robustness_Report.md`：本报告。

## 新增回归测试与结果

| 场景 | 预期 | 结果 |
|---|---|---|
| 多个 text delta 后在 `response.completed` 前 silent EOF | Run/message FAILED；同 session 下一轮 `1+1` 完成；半截 assistant 不进 history | PASS |
| tool-call arguments 生成一半后 silent EOF | 本轮失败、工具 0 次执行、下一轮正常 | PASS |
| tool 已成功执行，最终 assistant 续答 silent EOF | 本轮失败、工具保持只执行 1 次、下一轮不携带旧 `function_call_output` | PASS |
| FAILED/CANCELLED/STREAMING/PENDING assistant history | 全部不进入下一轮 Provider history | PASS |
| 失败/取消时残留 RUNNING tool-call | 收敛为 FAILED；既有 SUCCEEDED 不变 | PASS |
| 取消与本地工具真实成功竞态 | 真实成功最终记为 SUCCEEDED，不伪装回滚 | PASS |
| 正常文本流与正常 tool-call 多轮 | 行为保持，仍须每轮合法 completed | PASS |
| temporal context | 每 Run 包含 UTC、本地时间、Asia/Shanghai、weekday、周一起始日 | PASS |
| 诊断隐私 | 不含 API Key、Authorization、完整 prompt 或流式正文 | PASS |

定向命令：

```text
pnpm vitest run packages/ai-adapters/src/index.test.ts apps/server/src/chat-runner.test.ts packages/database/src/chat-repository.test.ts
```

结果：3 files，43 tests passed，0 failed。

AI/Chat integration：`a15.integration`、`m7.integration`、Assistant action card 共 35 passed；自动 DeepSeek smoke 5 tests 因环境变量门控未开启而 skipped，之后由用户通过本地预览完成真实 Provider 验收。

## silent EOF 的新状态语义

只有合法 `response.completed` 才能结束一个 Provider stream round。`delta → EOF`、`[DONE] → EOF` 但无 completed、socket interruption、timeout、截断事件、JSON 解析异常、显式 `response.failed/error` 均不得进入 `COMPLETED`。

- silent EOF / socket / request interruption：Run=`FAILED`，当前错误码沿用 `AI_UNAVAILABLE`；日志用 `streamTerminationReason` 精确区分。
- timeout：Run=`FAILED`，错误码=`AI_TIMEOUT`。
- 协议/解析/不完整 tool-call：Run=`FAILED`，错误码=`AI_INVALID_RESPONSE`。
- 用户主动取消优先保持 Run/message=`CANCELLED`，不被随后到达的 Provider 异常覆盖。

UI 继续使用既有普通失败/取消状态文案和样式；本轮没有修改视觉。

## 重复工具执行风险

本轮验证未发现旧工具跨 Run 重复执行：下一 Run 不序列化 FAILED/CANCELLED/STREAMING/PENDING assistant，也不会从旧 Run 的 `ai_tool_calls` 重建 `previousResponseItems/toolOutputs`。工具已成功但最终续答失败时，业务执行与 tool-call 的 SUCCEEDED 事实保留；下一轮不会再次调用该旧工具。

剩余固有风险：外部业务工具如果自身在进程崩溃前已产生副作用、但来不及持久化成功结果，仍需依赖既有 Change Set/idempotency 机制识别；本 hotfix 不重构工具事务架构。

## 可观测性

Run 失败日志现在以扁平脱敏字段记录：`provider`、`model`、`sessionId`、`runId`、`providerRequestId`（若有）、`httpStatus`、`providerErrorCode`（若有）、`streamTerminationReason`、`completedEventReceived`、`lastEventType`、`durationMs`、`errorCode`、`errorSummary`。不记录 API Key、Authorization、完整个人数据、完整 prompt 或完整模型正文。

## DeepSeek smoke

`PASS（用户真实 Provider 手测）`：用户在 RC3 本地预览中接入 `https://api.deepseek.com` / `deepseek-v4-flash`，完成验收并确认功能无异常。验收后只读取非敏感运行元数据复核：最近多轮 `OPENAI_COMPATIBLE` Run 均为 `COMPLETED`；`search_records`、`get_task_detail`、`get_free_time`、`get_today_schedule` 等 read tool 为 `SUCCEEDED`；`create_task`、`delete_record` write tool 为 `SUCCEEDED` 且持久化了 Change Set。结合用户对后续聊天的确认，真实链路 `普通多轮 → read tool → tool 后续聊 → write tool → write 后续聊` 判定通过。

自动 `deepseek-real-smoke.test.ts` 仍如实记录为 5 skipped：测试进程没有 `DEEPSEEK_API_KEY` 或 `DEEPSEEK_CREDENTIAL_REF` 环境变量。真实手测使用 UI 配置与 Windows Credential Store，API Key、prompt 和回答正文均未读取或写入报告。

## 完整验证

- `pnpm verify`：PASS。最终运行结果为 106 test files passed、3 skipped；458 tests passed、7 skipped；format、lint、V2 CSS audit、11 包 typecheck、contracts check、11 包 build、Launcher Release build 全部成功，Launcher 为 0 warning / 0 error。
- Chrome 完整隔离 E2E：73/73 PASS；最终代码运行 `node scripts/run-isolated-e2e.mjs`。其中 Assistant 子套件 3/3，覆盖初始化、五视口 Assistant 渲染、会话切换/键盘发送/操作展开/失败/撤销。
- Edge 完整隔离 E2E：73/73 PASS；最终代码运行 `LIFE_ASSISTANT_BROWSER=msedge node scripts/run-isolated-e2e.mjs`，与 Chrome 完全相同的 73 项编排；其中 Assistant 子套件 3/3。
- 视觉：NONE；未改 CSS、布局、主题、图片或交互视觉，不新增视觉基准。

## RC3 建议

推荐基于本 hotfix commit 创建 `v2.0.0-rc.3` 候选 tag。理由：新增故障注入、AI/Chat integration、完整 `pnpm verify`、Chrome/Edge 同套完整 73 项 E2E，以及用户通过 UI 接入真实 DeepSeek 的 read/write tool 多轮手测均通过。`v2.0.0-rc.2` tag 与其原提交保持不变，并正式保留为“首次真实 Provider 手测暴露鲁棒性缺口的历史候选”；RC3 定位为“Provider robustness hardened candidate”。
