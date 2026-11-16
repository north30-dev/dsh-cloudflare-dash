# Cloudflare 看板

在 DeepSeek Harness 侧边栏增加一个 Cloudflare 面板，通过 Cloudflare 官方 API 展示 Web Analytics 数据。

## 当前状态

**M4：Agent 工具。** 已实现：

- 配置：UI 内粘贴 API Token（用户级 / 帐户级 + Account ID）、校验、保存到 DSH 凭据库、删除
- 可选 HTTP 代理与直连/代理网络诊断（DNS / TLS / TTFB / 总耗时）
- 看板：站点选择、24h / 7d / 30d 切换、访问数/页面加载 KPI 与环比、访问趋势曲线（本地时区）、热门页面 / 来源 / 国家 / 浏览器 / 设备 / 操作系统、Core Web Vitals P75 与 good/needs/poor 分布、加载性能阶段分解（DNS/TCP/TLS/请求/响应/渲染/首绘）
- 60 秒后台自动刷新；Host 侧按范围缓存（24h 60s / 7d 120s / 30d 300s），手动刷新绕过缓存
- agent 工具 `cloudflare_analytics`：一个工具、`action` 参数（`overview` / `sites` / `status`），按需调用才产生数据；未配置 Token 时不出现在 agent 的工具列表里

尚未实现：单独的加载性能页。

## 数据说明

指标来自 Cloudflare Web Analytics（RUM）数据集，查询已排除 bot 流量。**不提供带宽/流量字节**：RUM 数据集没有这个指标，不会为了凑数而伪造。

**关于采样**：Cloudflare 对 RUM 做 ABR 自适应采样，小流量站点只统计部分事件再按倍数外推。结果是较长的范围可能反而更少、更整（实测 30d 只有 30 访问 / 2 个日期桶，且数值都是 10 的倍数；7d 却有 60 访问 / 6 个桶）。跨范围比大小没有意义，要看准确数字请用较短范围。该聚合节点没有采样倍数字段，面板无法标注采样率。

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

面板中的代理开关只影响本插件的出网请求，保存为浏览器本地偏好（非机密），并同步一份到 `$DSH_HOME/cloudflare-dash/state.json`，让 agent 工具与看板走同一条网络路径。仅支持 `http://` 代理的 CONNECT 隧道；不支持 SOCKS、不支持带账号密码的代理地址。

## Agent 工具

工具名 `cloudflare_analytics`，只有一个，用 `action` 区分用途：`overview`（流量、Top 榜、Core Web Vitals、加载阶段）、`sites`（站点与 siteTag）、`status`（只报告配置状态，不访问 Cloudflare）。

- 返回紧凑文本报告（总量与环比、逐桶访问、Top 榜、CWV、阶段耗时），不是原始 JSON；完整列表与图表在面板里。
- 未配置 Token 时工具不可见（`when` 条件门控），所以未使用本插件的 profile 不会为它付出任何上下文成本。
- 与看板共用同一套只读查询与缓存；`fresh: true` 跳过缓存。
- 站点可用 siteTag 或域名指定，缺省取账户下第一个站点。

## 限制

- 依赖 Cloudflare 官方 API，受 Token 权限与速率限制约束。
- 未启用 Web Analytics 的站点不会出现在统计中。
- 需要 DSH 0.2.2-rc.3 或更高版本（`engines.dsh`）。
- 只发只读请求：插件没有任何写操作（改 DNS、清缓存等）。
- 不提供带宽/流量字节：RUM 数据集没有该指标，不做伪造。
