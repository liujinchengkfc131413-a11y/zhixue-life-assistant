## RCA 结论

Root cause 已明确：DeepSeek 返回了有效的 Responses API 正文，但当前非流式 OpenAI Compatible 解析器只读取顶层 `payload.output_text`，没有读取标准原始结构中的 `output[].content[].text`，于是把有效回答解析成空字符串。随后服务端又无条件把空字符串写入数据库并标记 `COMPLETED`。

本轮未修改任何代码或数据，Git 工作区仍然干净。

## 实际调用链

```text
前端 POST /api/v1/ai/chats/{id}/messages
  ↓
ChatRepository.sendMessage()
  ├─ 创建 USER message：COMPLETED
  ├─ 创建 ASSISTANT placeholder：PENDING、content=[]
  └─ 创建 ai_run：QUEUED
  ↓
ChatRunner.run(runId)
  ├─ run → RUNNING
  ├─ assistant placeholder → STREAMING
  ├─ SSE: ai.run.started
  ├─ 读取 Provider、API Key、会话上下文和工具定义
  └─ ToolCallingOrchestrator.run()
       ↓
OpenAiCompatibleProvider.executeTools()
  └─ POST https://api.deepseek.com/responses
       ↓
解析结果 text=""
       ↓
ChatRunner
  ├─ 因 text 为空，不发送 ai.run.delta
  ├─ completeRun(runId, "")
  └─ SSE: ai.run.completed
       ↓
前端收到 completed
  ├─ invalidate canonical messages query
  └─ GET /api/v1/ai/chats/{id}/messages
       ↓
读取到数据库中的空白 COMPLETED assistant message
  ↓
UI 使用 COMPLETED fallback，显示“已完成”
```

关键代码：

- 路由创建消息并异步启动 runner：[m7-routes.ts](</D:/Documents/知雪的生活助手/apps/server/src/m7-routes.ts:182>)
- placeholder 和 ai_run 创建：[chat-repository.ts](</D:/Documents/知雪的生活助手/packages/database/src/chat-repository.ts:99>)
- runner/provider 调用：[chat-runner.ts](</D:/Documents/知雪的生活助手/apps/server/src/chat-runner.ts:29>)
- 非流式 Responses 解析：[index.ts](</D:/Documents/知雪的生活助手/packages/ai-adapters/src/index.ts:202>)
- 无条件完成空消息：[chat-repository.ts](</D:/Documents/知雪的生活助手/packages/database/src/chat-repository.ts:221>)
- 前端 completed 后重新读取 canonical message：[assistant-page.tsx](</D:/Documents/知雪的生活助手/apps/web/src/features/assistant/assistant-page.tsx:263>)

## 真实请求协议

本次不是 Chat Completions API，而是 Responses API 非流式请求：

```http
POST https://api.deepseek.com/responses
Authorization: Bearer <redacted>
Content-Type: application/json
```

实际请求体由当前代码构造成类似：

```json
{
  "model": "deepseek-v4-flash",
  "input": [
    {
      "role": "user",
      "content": "[userIntentReference: 01M16DS73F8CXA2DX44V4W43JW]\nhi，你好啊，我是你的这个app的开发者"
    }
  ],
  "tools": [
    {
      "type": "function",
      "name": "...",
      "description": "...",
      "parameters": {},
      "strict": true
    }
  ]
}
```

关键点：

- `stream` 没有设置，等价于非流式。
- 生产 runtime 注册了大量本地工具，因此 `definitions.length !== 0`，runner 固定进入非流式 `ToolCallingOrchestrator`。
- `tool_choice` 未设置，使用服务端默认选择。
- `nativeWebSearch=false`，因此请求没有加入 `web_search_preview`。
- 当前持久化的 `streaming=false` 并不是选择非流式的直接原因；runner 根本没有依据该 capability 选择协议。

## DeepSeek 原始响应结构

本次 run 的精确原始 HTTP body 没有被保存，现有生产日志只记录了启动信息，也没有 provider request ID 或脱敏响应摘要，因此无法还原本次响应的具体 ID、token usage 和实际回答文字。

但可以确定：

- 响应是 HTTP 2xx，否则 adapter 会抛错并将 run 标记 `FAILED`。
- 响应存在 `output` 数组，否则会抛 `AI_INVALID_RESPONSE`。
- `output_text` 顶层字段不存在或不是字符串，否则数据库不会得到空字符串。
- 没有被解析出的 function call，否则 orchestrator 会继续下一轮请求。

DeepSeek 官方原始 Responses JSON 结构为：

```json
{
  "status": "completed",
  "model": "deepseek-v4-flash",
  "output": [
    {
      "type": "reasoning",
      "content": [
        {
          "type": "reasoning_text",
          "text": "..."
        }
      ]
    },
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "Hello! How can I help you today?"
        }
      ]
    }
  ],
  "usage": {}
}
```

正文位于：

```text
output[]
  → type == "message"
  → content[]
  → type == "output_text"
  → text
```

DeepSeek 文档中的 Python `response.output_text` 是 SDK 便捷属性；官方原始 JSON 示例的正文在嵌套 `output` 中。[DeepSeek Responses API 原始结构](https://api-docs.deepseek.com/api/create-response/)

我用该官方结构对当前 adapter 做了纯 mock 复现，结果为：

```json
{
  "parsedText": "",
  "toolCalls": [],
  "providerItemTypes": ["reasoning", "message"]
}
```

因此不需要再次调用真实 API，已经可以确定解析错误。

## Capability probe 来源

Provider 验证当前执行：

```http
GET https://api.deepseek.com/models/deepseek-v4-flash
```

但成功后：

1. 不解析模型响应中的任何能力信息。
2. 直接调用 `capabilitiesForModel(modelId)`。
3. 该函数只用 OpenAI 模型名正则判断能力。

正则仅识别类似：

```text
gpt-4.1*
gpt-4o*
gpt-5*
o3*
o4*
```

所以 `deepseek-v4-flash` 必然得到：

```json
{
  "chat": true,
  "streaming": false,
  "toolCalling": false,
  "nativeWebSearch": false
}
```

本地直接执行当前函数也复现了同一结果。

这不是实际 capability probe，而是“模型端点连通性验证 + OpenAI 模型名称猜测”。对所有非 OpenAI 命名的 Compatible Provider 都会产生系统性假阴性。

DeepSeek 官方文档确认其 Responses API 支持：

- `deepseek-v4-flash`
- `stream: true`
- `response.output_text.delta` SSE
- function tools
- `web_search` 服务端工具

因此当前三个 `false` 对此模型均为误判。[DeepSeek Responses API 指南](https://api-docs.deepseek.com/guides/responses_api/)

另一个重要问题：capability 数据目前只影响设置页展示和 chat readiness，并未真正控制 ChatRunner 的协议分支。即使把 `streaming` 改为 `true`，生产环境工具列表非空时仍走非流式。

## Assistant message 最终数据库内容

本次 assistant message：

```json
{
  "id": "01M16DS73FVEAP6T464R610E05",
  "session_id": "01M16DRDEVDWXJ2TF1Z153YHQP",
  "role": "ASSISTANT",
  "content_json": [
    {
      "type": "text",
      "text": ""
    }
  ],
  "plain_text": "",
  "model_id": null,
  "status": "COMPLETED",
  "completed_at": "2026-08-29T09:32:07.932Z"
}
```

对应 run：

```json
{
  "id": "01M16DS73GPWBCDVDC7DRT1K11",
  "status": "COMPLETED",
  "startedAt": "2026-08-29T09:32:05.563Z",
  "finishedAt": "2026-08-29T09:32:07.932Z",
  "errorCode": null
}
```

同时：

- `ai_actions=0`
- `change_sets=0`
- `ai_web_sources=0`

所以这次没有文本、tool result、change set、source 或其他合法持久化输出。

`model_id=null` 是额外的可观测性缺口：placeholder 创建和 `completeRun()` 都没有把实际模型 ID 写回 message，但它不是本次空白正文的直接原因。

## SSE 实际事件序列

从当前运行中的 server 重放该 run，得到：

```text
id: ...-1
event: ai.run.started
data: {"runId":"01M16DS73GPWBCDVDC7DRT1K11"}

id: ...-2
event: ai.run.completed
data: {"runId":"01M16DS73GPWBCDVDC7DRT1K11"}
```

不存在：

```text
ai.run.delta
ai.run.failed
```

原因是 [chat-runner.ts](</D:/Documents/知雪的生活助手/apps/server/src/chat-runner.ts:157>) 只有在 `result.text` 为 truthy 时才发 delta；空字符串直接跳过，然后无条件调用 `completeRun()`。

前端收到 `completed` 后确实重新读取了 canonical message。重新读取的 API 请求也出现在真实服务日志中。因此前端不是根因，只是按 canonical `COMPLETED + empty text` 显示了 fallback“已完成”。

## Root cause

完整故障链为：

```text
DeepSeek 返回 output[].content[].text
  ↓
adapter 只读取 payload.output_text
  ↓
有效回答被解析成 ""
  ↓
没有 ai.run.delta
  ↓
completeRun("", ...) 不做输出不变量校验
  ↓
assistant message + ai_run 被错误标记 COMPLETED
  ↓
前端 completed 后重新读取 canonical message
  ↓
canonical message 为空且状态为 COMPLETED
  ↓
UI 显示“已完成”
```

这是服务端 adapter 与完成状态不变量的组合缺陷，不是 DeepSeek 响应为空，也不是前端漏刷新。

## 最小修复方案

1. 修复通用 Responses 文本提取，不增加 DeepSeek 专用正文分支。

   - 优先兼容已有顶层 `output_text`。
   - 顶层不存在时，遍历所有 `output[type=message].content[type=output_text].text` 并按顺序拼接。
   - 忽略 reasoning 文本，不把 chain-of-thought 写入 assistant 正文。
   - 同时校验 `status=failed/incomplete` 和 provider `error`。
   - 保持 function-call、sources 和 providerItems 现有解析方式。
   - 这样同时兼容 OpenAI、DeepSeek 和其他正确实现 Responses API 的 Compatible Provider。OpenAI 官方也将原始内容定义在 `output` items 中，并说明 `output_text` 可能是 SDK 便捷属性。[OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)

2. 增加完成不变量。

   - 非流式终态只有在存在非空 assistant text、待执行 tool call 或其他明确可持久化输出时才视为有效。
   - orchestrator 的最终响应若 `text.trim()===""` 且没有 tool call/结构化输出，抛 `AI_INVALID_RESPONSE` 或新增更精确的 `AI_EMPTY_RESPONSE`。
   - `ChatRunner` 在调用 `completeRun()` 前再次做防御性校验。
   - streaming 结束时若从未收到有效 text delta/tool call/合法输出，同样必须 `FAILED`。
   - `ChatRepository.completeRun()` 最好保留最后一道防线，拒绝创建纯空 `COMPLETED` message。

3. 记录脱敏 provider error。

   至少记录：

   ```json
   {
     "errorCode": "AI_EMPTY_RESPONSE",
     "providerType": "OPENAI_COMPATIBLE",
     "modelId": "deepseek-v4-flash",
     "endpointKind": "responses",
     "httpStatus": 200,
     "providerRequestId": "<if available>",
     "responseStatus": "completed",
     "outputItemTypes": ["reasoning", "message"]
   }
   ```

   不记录：

   - Authorization header
   - API Key
   - 完整请求正文
   - 完整模型回答
   - 原始可能含隐私的数据

   `ai_runs.error_code` 写标准化错误码，同时写一条结构化脱敏生产日志。

4. 修复 capability detection，但保持 Compatible Provider 保守策略。

   最小安全做法：

   - OpenAI 继续使用自己的能力映射。
   - 引入按 `providerType + normalized baseUrl + modelId` 的协议 profile。
   - 对官方 `api.deepseek.com` 和受支持模型声明 Responses/stream/function/web-search 能力。
   - 未知 OpenAI Compatible Provider 仍保持保守能力，不因为“DeepSeek 能用”就把所有 Compatible Provider 都设为 true。
   - 后续若采用主动能力探测，应分别使用最小、无副作用请求探测 Responses、stream 和 forced no-op function；暂时不要把一次 `/models/{id}` 成功等价为全部能力支持。

5. 不切换到 Chat Completions 作为临时绕过。

   DeepSeek 的 Responses API 本身工作正常。切换协议会增加第二套 message/tool/reasoning 适配路径，也更容易影响 OpenAI 和其他 Compatible Provider。最小修复应当修正现有通用 Responses 解析。

## 必补测试

- OpenAI Compatible 非流式：

  - 原始响应只有嵌套 `output[].content[].text`
  - 包含 reasoning + message
  - 正确提取正文
  - 顶层 `output_text` 仍兼容

- OpenAI Compatible 流式 SSE：

  - 覆盖 DeepSeek 的 `event:` + `data:` 格式
  - `response.output_text.delta`
  - 以 `response.completed` 结束
  - 没有 `[DONE]`
  - 最终持久化文本与 delta 拼接一致

- 空响应不得完成：

  - `output=[]`
  - 只有 reasoning、没有 assistant text/tool call
  - message content 为空
  - streaming 只有 completed、没有 delta
  - 断言 run/message 均为 `FAILED`
  - SSE 为 `started → failed`，绝不能 `completed`

- Capability detection：

  - `api.deepseek.com + deepseek-v4-flash` 返回官方能力
  - OpenAI 现有模型能力不回退
  - 未知 Compatible Provider 保持保守
  - 临时网络错误不能被误记为永久不支持

- DeepSeek 真实 smoke：

  - 手工或环境门控的可选集成测试
  - API Key 只来自 Windows Credential Store 或进程环境
  - 不进入 fixture、snapshot、日志、Git diff
  - 同时检查 non-stream、stream delta、最终 canonical message、SSE terminal event 和脱敏日志。