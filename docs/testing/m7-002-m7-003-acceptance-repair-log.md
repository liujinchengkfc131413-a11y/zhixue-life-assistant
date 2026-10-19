# M7-002 / M7-003 验收修复记录

## 修复范围

- M7-002：将 `CredentialStore` 改为异步端口，并为 Windows Credential Manager 提供真实平台集成测试。
- M7-003：建立 OpenAI Responses API 的原生函数工具调用闭环、流式事件解析、错误映射、独立能力声明和 OpenAPI 合约。

## 发现的问题与处理

| 问题 | 处理 | 验证 |
|---|---|---|
| Windows 凭据访问使用同步进程调用，调用方无法安全地按异步 I/O 组合 | 改为异步 `CredentialStore` 和异步 PowerShell 子进程；限制 Windows 凭据密钥 UTF-16 大小 | Windows 平台集成测试覆盖写、跨实例读、存在、删和 `finally` 清理 |
| Provider 只能验证配置，缺少工具调用多轮闭环 | 增加工具定义、调用、结果和运行时端口；保留 Responses 输出项，按 `call_id` 回传 `function_call_output` | 本地 HTTP Mock Responses API contract test 覆盖两轮请求 |
| 流式、能力和错误边界未被单独证明 | 分别增加 SSE 单元测试、能力测试和服务端 Problem Details 映射测试 | 各类测试独立执行并纳入全量验证 |
| `toolCalling` 与 `nativeWebSearch` 曾可能被混同 | 按模型能力分别声明；当前未实现原生联网搜索，因此始终为 `false` | Provider 能力测试 |
| API 文档未覆盖已实现的 Provider 管理端点 | 将配置、凭据和验证端点登记到 OpenAPI，并增加路径测试 | contracts 生成一致性检查 |

## 验收边界

本地 mock/contract 测试证明的是 Provider runtime 与本地 Tool Runtime 的协议闭环，不证明真实 OpenAI 服务已经验证。

项目提供可选的 `pnpm test:openai-smoke`。只有操作者显式设置 `OPENAI_API_KEY` 后才会执行真实网络请求；本次修复未调用真实 OpenAI API。没有 Key、网络或余额时测试跳过，不能阻塞本地自动化验收。

## 交付状态

- M7-002：READY（本地自动化及真实 Windows 凭据管理器集成测试）。
- M7-003：READY（本地自动化验收）。真实 OpenAI smoke test 未在本次执行，故不声称真实服务已验证。
