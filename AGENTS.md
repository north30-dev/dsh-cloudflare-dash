# AGENTS.md

给在本仓库工作的编码 agent 的项目说明。人类读者请看 [README.md](README.md)。

## 这是什么

DeepSeek Harness（DSH）插件：在侧边栏增加一个 Cloudflare **Web Analytics** 看板。
- 插件包名：`@local/dsh-cloudflare-dash`
- 插件行 id：`cloudflare-dash`（见 `cordis.patch.yml`）
- 侧边栏面板 id / `main` 面板 key：`cloudflare`
- 已验证的 DSH 版本：`0.2.2-rc.3`（`package.json` 的 `engines.dsh`）

## 技术形态（不要改错）

插件分两半，**没有官方 Host RPC 给静态插件**（`host.call` 只属于 `cordis_run` 动态包，`@Remote` 是构建期封闭集合）：

```
浏览器 (dist/client.js)
  └─ fetch → /cloudflare-dash/api/v1/*   （Host 注册的 exact HTTP 路由）
       └─ src/host/*  → api.cloudflare.com（Token 只在 Host 侧）
```

- Host：原生 ESM，Node 直接加载，`index.js` → `src/host/index.js` → `apply(ctx)`，`ctx.inject(['webServer'])` 后注册路由。
- Client：必须是**单个自包含 bundle**（loader 一个插件只接受一个模块节点，不能相对 import），由 `scripts/build-client.mjs`（esbuild，`format:'cjs'`，`external:['react']`）打包成 `window.__ModuleLoader__.load({ id, factory })` 形式。
- `dist/client.js` **提交进仓库**（用户克隆后无需构建即可安装）；改客户端源码后必须重新构建并一起提交。

## 常用命令

```bash
pnpm install --allow-build=esbuild   # 首次（esbuild 的 postinstall 需要放行）
pnpm run build                       # 重新生成 dist/client.js
node --check src/host/*.js           # Host 语法检查
```

安装/更新到本机 profile（需要 DSH 的 plugin_manager 工具）：

```
plugin_manager install_bundle  target=<本目录绝对路径>
# 已安装时更新 Host 代码：先 remove_bundle 再 install_bundle
```

生效方式：
- **只改客户端** → `pnpm run build` + 刷新页面
- **改了 Host**（`src/host/**`、`index.js`、`cordis.patch.yml`）→ 需要 `remove_bundle` + `install_bundle`，或重启 DSH
- 改了 `package.json`（版本、exports、files）→ 也要重装

## 目录

| 路径 | 说明 |
| --- | --- |
| `index.js` | Host 入口，只做 re-export |
| `src/host/index.js` | `apply()`：注入 `webServer`，注册路由 |
| `src/host/routes.js` | `/cloudflare-dash/api/v1/*` 路由 + 请求栅栏 + 错误映射 |
| `src/host/tool.js` | agent 工具 `cloudflare_analytics`（单工具 + `action` 参数） |
| `src/host/cloudflare.js` | Cloudflare REST/GraphQL 客户端、Token 校验（用户级/帐户级） |
| `src/host/analytics.js` | RUM GraphQL 查询模板与数据整形 |
| `src/host/http.js` | 零依赖出网：直连 / HTTP CONNECT 代理 / 阶段计时 |
| `src/host/store.js` | Token 存取（凭据记录）与格式识别 |
| `src/host/state.js` | 非机密状态：Account ID、代理偏好，存 `$DSH_HOME/cloudflare-dash/state.json` |
| `src/client/` | 浏览器侧：`index.jsx` 注册、`app.jsx` 控制器、`overview.jsx` 看板、`settings.jsx` 配置、`chart.jsx`、`format.js`、`api.js`、`locale.js`、`styles.css` |
| `dist/client.js` | 构建产物（提交） |
| `tests/` | 目前为空占位，无测试框架 |

## 硬性约束

1. **Token 永不进入浏览器、日志、工具返回值、仓库**。UI 只显示掩码；错误信息不得包含 Token 原文。
2. **只读**：不要新增任何写 Cloudflare 的接口（改 DNS、清缓存等）。所有 API 调用只允许 GET / GraphQL query。
3. **GraphQL 文档只能由 Host 拼装**：客户端不能传 query 文本；`analytics.js` 里用校验过的 `siteTag`/账户 hex 和自生成的 ISO 时间插值。
4. **客户端只能 `require('react')`**：不要 import `@deepseek-ai/*` 客户端包（会随版本变化、且不被支持）。Host 侧只依赖 Node 内置模块。
5. **样式只使用 `--dsw-alias-*` 主题 token**，不写死颜色（深色主题下会看不见）；可见文案走 `src/client/locale.js` + `ctx.locale`。
6. **面板自己负责滚动**：DSH 主面板给的是固定高度容器，页面根节点必须 `height:100%; overflow-y:auto`，否则滚轮无效、窗口变化不跟随。
   滚动容器同时是**布局查询容器**（`container: cfd-page / inline-size`）：卡片列的响应式断点用 `@container` 而不是 `@media`，因为面板宽度 ≠ 窗口宽度（旁边还有侧边栏）。列表卡片最多 3 列，宽面板下不要退回 `auto-fit`——它会在 1600px+ 铺出 5 列，每列太窄且容易横向溢出。
7. 路由是 exact 注册，绕过 DSH `/api` 栅栏，因此必须自己调 `connection.requestRejection`，缺失时退化为 loopback 校验，并拒绝 `sec-fetch-site: cross-site`。
8. 不提交 `LICENSE`：MIT 由仓库维护者自己维护。
9. **agent 工具只有一个**（`cloudflare_analytics`，用 `action` 区分用途），返回紧凑文本报告而不是原始 JSON；不要改成「每个视图一个工具」。注册必须带 `when` 条件，未配置 Token 时不出现。
10. Host 侧**不能** `import '@deepseek-ai/dsh-tools'`（链接安装的插件目录解析不到 DSH 的 node_modules），所以工具定义手写：`parameters` 是**原始 JSON Schema**（不是首方工具 `defineTool` 用的 property-map 写法），`output.schema` 同为一个 JSON Schema 子集。

## API 事实（踩过的坑，别再踩）

- **没有** `Account.Read` / `Web Analytics:Read` 这类权限名。需要的只有：
  - `Account Settings:Read` —— 账户列表 **和** `rum/site_info/list`
  - `Account Analytics:Read` —— GraphQL RUM 数据集
- 用户级 Token 是 **40 位**字符，长度不对 Cloudflare 返回 `400 code 6003 Invalid request headers`（不是 401）。
- 帐户级 Token 值以 `cfat` 开头，**不能**用 `/user/tokens/verify`，要 `/accounts/{id}/tokens/verify`；Account ID 必填（32 位 hex）。
- RUM 数据集：`rumPageloadEventsAdaptiveGroups`（`count`、`sum.visits`、维度 `datetimeHour`/`date`/`requestPath`/`refererHost`/`countryName`/`userAgentBrowser`/`deviceType`/`userAgentOS`）、`rumWebVitalsEventsAdaptiveGroups`（good/needs/poor + P75 分位数）、`rumPerformanceEventsAdaptiveGroups`（`quantiles` 里的 `pageLoadTimeP75` / `dnsTimeP75` / `connectionTimeP75` / `tlsTimeP75` / `requestTimeP75` / `responseTimeP75` / `pageRenderTimeP75` / `firstPaintP75` / `firstContentfulPaintP75`）。
- **Core Web Vitals 与加载性能的时长单位都是微秒**（`1212000` → 1.212 s），展示前除以 1000；CLS 是无量纲比值。
- 查询统一带 `bot: 0`，与官网口径对齐；时间桶按 UTC 取回，前端按本地时区格式化。
- RUM **没有带宽/字节指标**，「Data served」无法复现，禁止编造。
- RUM 聚合是 **ABR 采样**：小流量站点的 30d 结果可能比 7d 更小、数值全是 10 的整数倍、日期桶更少（Cloudflare 只取部分事件再 ×N 外推）。这不是本插件的 bug，跨范围比较大小无意义。节点 `AccountRumPageloadEventsAdaptiveGroups` 只暴露 `avg` / `confidence` / `count` / `dimensions` / `sum`——**没有 `sampleInterval` 字段**（introspection 实测，请求它返回 `unknown field`），别再试着靠这个字段标注采样率。
- 概览结果在 Host 内存里按 `账户:站点:范围` 缓存（24h 60s / 7d 120s / 30d 300s）；手动刷新传 `fresh=1` 绕过缓存，Token 变更时清空缓存。
- `ctx.tools.register(definition, { when })` 的硬性要求：`definition` 必须带 `output: { schema, render(args, value) => ContentBlock[] }`（文本块形状是 `{ type: 'text', text }`），缺 `render` 会直接抛 `TypeError`；`run_code` 是保留工具名。`when` 每个模型步求值一次，可返回 Promise，返回 false 表示该步不向模型暴露这个工具。
- 工具定义不能只靠注册时的条件做安全边界：`execute` 里仍要自己校验参数（手写注册没有 `defineTool` 的入参校验）。

## 自检方式

- Host 语法：`node --check src/host/*.js`
- 客户端产物：构建后用 stub 加载验证注册（`window.__ModuleLoader__` 假实现 + `require('react')` 桩），确认 exports 为 `apply`/`inject`
- 路由是否注册：用 `curl -i` 请求 `/cloudflare-dash/api/v1/status|sites|overview`，未带浏览器 Cookie 时应返回 **401** 且 body 是插件的 JSON；返回 404 说明 Host 旧代码还在运行。**不要用 PowerShell 的 `Invoke-WebRequest` 判断**——它对本站路由会误报 404（curl 同一时刻是 401）。
- 真实数据验证：用本机凭据里的 Token 跑一次性 Node 脚本查询 `analytics.js` 的导出函数，**只打印结果，不打印 Token**
- 视觉与交互无法自动化：让用户刷新页面后截图确认

## 当前状态

- ✅ M1 配置闭环（Token UI、用户级/帐户级校验、代理开关、网络诊断）
- ✅ M2 概览看板（站点/时间范围、趋势曲线、热门页面/来源/国家/浏览器、Core Web Vitals）
- ✅ M3 缓存与后台刷新（60s 轮询 + Host TTL 缓存）、设备/系统维度、加载性能阶段分解
- ✅ M4 单个聚合 agent 工具 `cloudflare_analytics`（`action` 参数，`when` 门控，已用真实数据端到端验证）
- 🟡 待修（已知，不在 M4 范围）：Cloudflare ABR 采样无法在 UI 标注（无 `sampleInterval` 字段）；可选做 `confidence(level)` 区间展示
- ⬜ M5 开源收尾（SECURITY.md、CI、npm 发布）
