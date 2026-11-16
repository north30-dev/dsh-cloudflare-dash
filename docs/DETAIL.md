# Cloudflare 看板

在 DeepSeek Harness 侧边栏增加一个 Cloudflare 面板，通过 Cloudflare 官方 API 展示 Web Analytics 数据。

## 当前状态

**M1：配置闭环。** 已实现：

- 侧边栏图标 + 主面板（点击切换）
- UI 内粘贴 API Token、校验并保存到 DSH 凭据库
- 已配置态：Token 掩码、可见账户数、Web Analytics 站点数、验证时间
- 删除已保存的 Token
- 可选 HTTP 代理（`http://host:port`），以及直连/代理的网络诊断（DNS / TLS / TTFB / 总耗时）

尚未实现：站点指标、图表、时间范围、缓存刷新、agent 工具。

## 使用方法

1. 创建只读 Token（`Account.Read`、`Account Analytics.Read`）。
2. 安装插件并刷新页面。
3. 点侧边栏柱状图标，粘贴 Token，点「验证并保存」。
4. 验证通过后面板显示账户与站点计数；点击「网络诊断」可确认当前链路质量。

Token 只保存在本机 DSH 凭据库，浏览器与面板只看到掩码。也可通过启动环境变量 `CLOUDFLARE_API_TOKEN` 提供（UI 保存的记录优先）。

## 代理

面板中的代理开关只影响本插件的出网请求，保存为浏览器本地偏好（非机密）。仅支持 `http://` 代理的 CONNECT 隧道；不支持 SOCKS、不支持带账号密码的代理地址。

## 限制

- 依赖 Cloudflare 官方 API，受 Token 权限与速率限制约束。
- 未启用 Web Analytics 的站点不会出现在统计中。
- 需要 DSH 0.2.2-rc.3 或更高版本（`engines.dsh`）。
- 当前不包含任何写作操作：插件只发只读请求。
