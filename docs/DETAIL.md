# Cloudflare 看板

在 DeepSeek Harness 侧边栏增加一个 Cloudflare 面板，通过 Cloudflare 官方 API 展示 Web Analytics 数据。

## 当前状态

**M2：概览首屏。** 已实现：

- 配置：UI 内粘贴 API Token（用户级 / 帐户级 + Account ID）、校验、保存到 DSH 凭据库、删除
- 可选 HTTP 代理与直连/代理网络诊断（DNS / TLS / TTFB / 总耗时）
- 看板：站点选择、24h / 7d / 30d 切换、访问数/页面加载 KPI 与环比、访问趋势曲线（本地时区）、热门页面 / 来源 / 国家 / 浏览器、Core Web Vitals P75 与 good/needs/poor 分布

尚未实现：缓存与后台自动刷新、设备与系统维度拆分、单独的加载性能页、agent 工具。

## 数据说明

指标来自 Cloudflare Web Analytics（RUM）数据集，查询已排除 bot 流量。**不提供带宽/流量字节**：RUM 数据集没有这个指标，不会为了凑数而伪造。

## 使用方法

1. 创建只读 Token：Profile → API Tokens → Create Custom Token，勾选 `Account Settings:Read`、`Account Analytics:Read`，资源选自己的账户（没有 Web Analytics 这个权限组）。
2. 安装插件并刷新页面。
3. 点侧边栏柱状图标，粘贴 Token，点「验证并保存」。用户级 Token 留空 Account ID；「帐户 API 令牌」（`cfat…`）必须填 Account ID（后台概览页 URL 里的 32 位十六进制）。
4. 验证通过后面板显示账户与站点计数；点击「网络诊断」可确认当前链路质量。

Token 只保存在本机 DSH 凭据库，浏览器与面板只看到掩码。也可通过启动环境变量 `CLOUDFLARE_API_TOKEN` 提供（UI 保存的记录优先）。

### 常见失败

- `Invalid API Token`：多半复制成了 32 位 Token ID、或创建流程未完成、或用了 Global API Key（37 位）；面板会在输入阶段提示这两种格式。
- 账户级（Account-owned）Token 无法通过用户级校验接口，插件会退化为账户列表校验；仍失败时请改用用户级 Token。
- 站点数为 0：读取站点列表需要 `Account Settings:Read`；也可能账号尚未启用 Web Analytics。

## 代理

面板中的代理开关只影响本插件的出网请求，保存为浏览器本地偏好（非机密）。仅支持 `http://` 代理的 CONNECT 隧道；不支持 SOCKS、不支持带账号密码的代理地址。

## 限制

- 依赖 Cloudflare 官方 API，受 Token 权限与速率限制约束。
- 未启用 Web Analytics 的站点不会出现在统计中。
- 需要 DSH 0.2.2-rc.3 或更高版本（`engines.dsh`）。
- 当前不包含任何写作操作：插件只发只读请求。
