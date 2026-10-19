# 贡献与开发约定

## 提交前

1. 需求变化先同步产品文档，契约变化先同步数据库/API 设计。
2. 新依赖必须符合 `kernel → domain → application → infrastructure/interface` 的单向边界。
3. API 改动从 Zod 契约出发，并运行 `pnpm contracts:generate`。
4. 测试文件只能使用 `@life-assistant/test-support` 创建的临时数据目录，禁止指向真实用户目录。
5. 运行 `pnpm verify`；涉及浏览器流程时再运行 `pnpm test:e2e`。

## 完成定义

- 实现、测试与文档同步。
- 错误响应使用稳定错误码和 Problem Details。
- 时间相关逻辑可注入 `Clock`，测试使用固定时间。
- 新增重要架构取舍时创建或更新 ADR。

