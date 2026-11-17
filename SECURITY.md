# 安全策略 / Security Policy

## 报告漏洞 / Reporting a vulnerability

**请不要开公开 issue。** 使用 GitHub 的私有漏洞报告：

<https://github.com/north30-dev/dsh-cloudflare-dash/security/advisories/new>

报告里请给出：插件版本（`package.json` 的 `version`）、DSH 版本、操作系统、复现步骤、影响范围，以及（如果方便）PoC。**不要**粘贴真实的 Cloudflare API Token——用你自己吊销过的测试 Token 即可。

预期响应：

- 7 天内确认收到；
- 30 天内给出修复或明确的缓解方案；
- 修复版本发布前不公开细节；发布后会在 advisory 里致谢（可以要求匿名）。

这是一个个人维护的项目，没有付费漏洞赏金。

## 支持范围 / Supported versions

项目处于 pre-1.0，只对**最新发布版本**提供安全修复。

## 哪些算漏洞 / In scope

- **路由鉴权绕过**：`/cloudflare-dash/api/v1/*` 在没有浏览器 Cookie 时应返回 401；能绕过 `connection.requestRejection`、退化后的 loopback 校验，或 `sec-fetch-site: cross-site` 检查的，算漏洞。
- **Token 泄露**：Token 出现在浏览器、日志、agent 工具返回值、错误信息或仓库里（任何一处）。
- **SSRF**：通过代理设置、站点参数或 GraphQL 插值，把出网请求导向 `api.cloudflare.com` 之外的地址。
- **注入 / XSS**：面板渲染 Cloudflare 返回的页面路径、来源、国家、UA 等字段时的脚本注入。
- **产物完整性**：`dist/client.js` 与源码不一致，或构建可被替换。

## 哪些不算 / Out of scope

- DSH 本体的问题——报给 DeepSeek Harness。
- Cloudflare API 自身的问题——报给 Cloudflare。
- 你自己把 Token 权限开得过大：插件只需要两项只读权限（见 [README](README.md#快速开始)），多给的权限不是插件的漏洞。
- 已经攻破的本机环境，或对你自己实例的压测式拒绝服务。

## 设计上的安全边界 / Design boundaries

这些是插件**承诺**遵守的约束，偏离它们就是 bug：

- Token 只保存在本机 DSH 凭据库（记录 `dsh-cloudflare-dash/api-token`），只在 Host 侧使用；浏览器只拿到「已配置 + 掩码」。
- **只读**：只发 GET 和 GraphQL `query`，没有任何写 Cloudflare 的代码路径。
- 没有遥测、没有第三方上报；出网目标只有 `api.cloudflare.com`，可选经用户自己配置的 HTTP 代理。
- 浏览器的客户端 bundle 只 `require('react')`，不加载 `@deepseek-ai/*` 客户端包。
- 面板只使用 `--dsw-alias-*` 主题 token，不写死颜色。
- 错误信息与工具返回值不含 Token 原文。
