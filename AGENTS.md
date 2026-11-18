# AGENTS.md

给在本仓库工作的编码 agent 的项目说明。人类读者请看 [README.md](README.md)。

## 这是什么

DeepSeek Harness（DSH）插件：在侧边栏增加一个 Cloudflare **Web Analytics** 看板。
- 插件包名：`dsh-cloudflare-dash`
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
node scripts/check-manifest.mjs      # 包名 / cordis.patch.yml / bundle id / files 一致性
node --check src/host/*.js           # Host 语法检查
pnpm test                            # 全部纯函数单测（不联网）
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
| `src/host/state.js` | 非机密状态：Account ID、代理偏好、上次验证快照（`accounts`/`rumSites`/`verifiedAt`），存 `$DSH_HOME/cloudflare-dash/state.json` |
| `src/client/` | 浏览器侧：`index.jsx` 注册、`app.jsx` 控制器、`overview.jsx` 看板、`settings.jsx` 配置、`chart.jsx`、`csv.js`（导出）、`format.js`、`api.js`、`locale.js`、`styles.css` |
| `dist/client.js` | 构建产物（提交） |
| `tests/` | 纯函数单测：`tests/slice-window.mjs`（切片终止性）、`tests/sampling.mjs`（采样摘要）、`tests/query-shape.mjs`（bot 过滤子句 + Top 榜合并）、`tests/csv.mjs`（导出格式与转义）、`tests/state.mjs`（验证快照读写，用临时 `DSH_HOME`）。`pnpm test` 跑全部 |

## 硬性约束

1. **Token 永不进入浏览器、日志、工具返回值、仓库**。UI 只显示掩码；错误信息不得包含 Token 原文。
2. **只读**：不要新增任何写 Cloudflare 的接口（改 DNS、清缓存等）。所有 API 调用只允许 GET / GraphQL query。
3. **GraphQL 文档只能由 Host 拼装**：客户端不能传 query 文本；`analytics.js` 里用校验过的 `siteTag`/账户 hex 和自生成的 ISO 时间插值。
4. **客户端只能 `require('react')`**：不要 import `@deepseek-ai/*` 客户端包（会随版本变化、且不被支持）。Host 侧只依赖 Node 内置模块。
5. **样式只使用 `--dsw-alias-*` 主题 token**，不写死颜色（深色主题下会看不见）；可见文案走 `src/client/locale.js` + `ctx.locale`。
6. **面板自己负责滚动**：DSH 主面板给的是固定高度容器，页面根节点必须 `height:100%; overflow-y:auto`，否则滚轮无效、窗口变化不跟随。
   滚动容器同时是**布局查询容器**（`container: cfd-page / inline-size`）：卡片列的响应式断点用 `@container` 而不是 `@media`，因为面板宽度 ≠ 窗口宽度（旁边还有侧边栏）。列表卡片最多 3 列，宽面板下不要退回 `auto-fit`——它会在 1600px+ 铺出 5 列，每列太窄且容易横向溢出。
7. 路由是 exact 注册，绕过 DSH `/api` 栅栏，因此必须自己调 `connection.requestRejection`，缺失时退化为 loopback 校验，并拒绝 `sec-fetch-site: cross-site`。
8. **许可证是 MIT，且已提交进仓库**：`LICENSE` 全文与 `package.json` 的 `license` 字段必须同时存在、保持一致，README 的许可证说明同步为 MIT；不要引入其他许可证，也不要删掉 `LICENSE`。
9. **agent 工具只有一个**（`cloudflare_analytics`，用 `action` 区分用途），返回紧凑文本报告而不是原始 JSON；不要改成「每个视图一个工具」。注册必须带 `when` 条件，未配置 Token 时不出现。
10. Host 侧**不能** `import '@deepseek-ai/dsh-tools'`（链接安装的插件目录解析不到 dsh 的 node_modules），所以工具定义手写：`parameters` 是**原始 JSON Schema**（不是首方工具 `defineTool` 用的 property-map 写法），`output.schema` 同为一个 JSON Schema 子集。
11. **CSV 导出是纯客户端**（`src/client/csv.js`，不新增 Host 路由、不重新取数）：数据已经在面板手里，为导出再加接口只会多一份口径。CSV 必须带 `meta` 行（站点/范围/口径/窗口/采样/`top_limit`），否则导出的数字会脱离它们的前提；字段要过 `cell()` —— `referrerHost`、`requestPath` 是访客可控的，以 `= + - @` 开头会被表格当公式执行。

## API 事实（踩过的坑，别再踩）

- **没有** `Account.Read` / `Web Analytics:Read` 这类权限名。需要的只有：
  - `Account Settings:Read` —— 账户列表 **和** `rum/site_info/list`
  - `Account Analytics:Read` —— GraphQL RUM 数据集
- 用户级 Token 是 **40 位**字符，长度不对 Cloudflare 返回 `400 code 6003 Invalid request headers`（不是 401）。
- 帐户级 Token 值以 `cfat` 开头，**不能**用 `/user/tokens/verify`，要 `/accounts/{id}/tokens/verify`；Account ID 必填（32 位 hex）。
- RUM 数据集：`rumPageloadEventsAdaptiveGroups`（`count`、`sum.visits`、维度 `datetimeHour`/`date`/`requestPath`/`refererHost`/`countryName`/`userAgentBrowser`/`deviceType`/`userAgentOS`）、`rumWebVitalsEventsAdaptiveGroups`（good/needs/poor + P75 分位数）、`rumPerformanceEventsAdaptiveGroups`（`quantiles` 里的 `pageLoadTimeP75` / `dnsTimeP75` / `connectionTimeP75` / `tlsTimeP75` / `requestTimeP75` / `responseTimeP75` / `pageRenderTimeP75` / `firstPaintP75` / `firstContentfulPaintP75`）。
- **Core Web Vitals 与加载性能的时长单位都是微秒**（`1212000` → 1.212 s），展示前除以 1000；CLS 是无量纲比值。
- 查询统一带 `bot: 0`，与官网口径对齐；时间桶按 UTC 取回，前端按本地时区格式化。
- **bot 开关**：`botFilter(bots)` 只在 `bots === 'all'` 时返回空串（即去掉过滤）——判 `'all'` 而不是判 `'exclude'`，这样调用方传错值也只会退化成「排除 bot」，不会静默改变数字含义。要点：
  - `vitals` / `performance` 两个数据集**永远** `bot: 0`。爬虫没有 Core Web Vital，混进去的 P75 不是「另一口径」而是噪音；`buildSliceQuery` 里因此有两个 filter 字符串（`current` 与 `humans`）。
  - 当前窗口与上一周期必须用**同一个** `bots` 值，否则环比是拿「含 bot 的本期」比「排除 bot 的上期」。
  - 缓存键必须带上 `bots`（`账户:站点:范围:bots`），否则切换开关会命中另一模式的结果。
  - `bot: 1` 语法合法（实测不报错），但很多站点返回空：RUM 只统计执行了 JS 的访问，爬虫通常不会。
- 每个维度每个切片取 **20 行**（`TOP_LIMIT`），面板默认显示 6 行、点「展开全部」看全；`mergeTop` 已导出，`tests/query-shape.mjs` 钉住合并、排序、去空名和 20 行上限。
- RUM **没有带宽/字节指标**，「Data served」无法复现，禁止编造。
- RUM 聚合是 **ABR 采样**，而且**窗口越长分辨率越低**：一次 30 天查询实测只回 8 天里带流量的 2 天、数值全是 10 的倍数，同一批日期按 7 天查就完整。所以 30d 用 `RANGES['30d'].chunkMs` **按周切片**，切片并发查询后：总量/趋势/Top 榜相加合并（精确）。加长范围时沿用这个模式，不要单发一个长窗口聚合。
- **上一周期必须单独开一套切片网格**：`sliceWindow(now - 2*ms, now - ms, chunkMs)`。30 天不是 7 的整数倍，拿当前窗口那套网格去凑上一周期，会有一个切片横跨两个周期（2 天属于本期、5 天属于上期），切片的数字无法归属。
- **分位数（CWV、加载性能）不可相加**：不再走整窗 summary 查询，而是**每个切片自己带 `vitals`/`performance` alias**，取**最新的、`count > 0` 的切片**，并把这个切片的 `window` 一起返回给面板标注。整窗 30 天的 P75 实测是 7 个样本外推出的 70（同一站点 LCP 7.40 s vs 按周 1.42 s），别再用它。
- `confidence(level: 0.95)` 是**可以**标注采样的：节点上只有 `avg`/`confidence`/`count`/`dimensions`/`sum`，**没有 `sampleInterval`**（请求它返回 `unknown field`），但 `confidence.count` 里有 `{ estimate, lower, upper, sampleSize, isValid }`。`sampleSize` 与 `estimate` 的比值就是采样率：30d 整窗实测 `sampleSize=5 / estimate=50`，7d 切片是 `107 / 107`（无采样），`summarizeSampling` 把所有切片的这两个数加起来。
- **只查 `confidence.count`**：请求 `confidence.sum.visits` 会让 Cloudflare 把整行返回成 `[]`（实测，无报错），所以 `sum` 的置信区间拿不到，也别试着取。
- 采样状态有**两个层级**，别混：
  - `summarizeSampling()` 汇总所有切片的 `totals` → `payload.sampling.current` / `.previous`，驱动面板顶部的提示（总量/趋势/Top 榜、以及环比口径）；
  - `rowSampling()` 看单个数据集的 `confidence.count` → `payload.vitals.sampling` / `.performance.sampling`，因为分位数只来自**一个**切片，能不能信要单独判断。`confidence.count` 在这两个数据集上实测可用（7d：`58/58`、`70/70`；30d 整窗：`70/7`），行不会被打空。
  - `known: false`（没有 confidence 块）= 未知，**不能**当成 exact 展示。
- 概览 payload 还带 `cached` / `cacheAgeMs` / `cacheTtlMs`（缓存命中时按实际年龄算），面板脚注用它显示「缓存 · 42 秒前」；不要把 age 写进缓存的 payload 里，否则会冻结在生成时刻。
- `confidence.count.isValid` **不能当采样标志**：实测无采样的 7d 窗口也返回 `isValid: false`，区间还退化成 `lower === upper === estimate`。判采样只看 `sampleSize < estimate`。
- 概览结果在 Host 内存里按 `账户:站点:范围:bots` 缓存（24h 60s / 7d 120s / 30d 300s）；手动刷新传 `fresh=1` 绕过缓存，Token 变更时清空缓存。
- **`GET /status` 的验证语义**：`lastAccess`/`verifiedAt` 是进程内变量，重启即失效；之前这导致设置页的「可见账户 / Web Analytics 站点」在每次重启后都显示 `—`。现在验证结果会以**非机密快照**存进 `state.json` 的 `access`，并且：
  - 响应里带了快照但本进程尚未验证 → 加 `verifiedStale: true`，时间戳是**上一次运行**的；
  - 完全没有任何信息（首次、或快照被删）且 Token 已配置 → 懒验证一次；
  - `?verify=1` 强制重新验证（设置页「重新验证」按钮走这条）；
  - 验证失败不返回 500，只带 `accessError` 文本，快照继续可用。
  改这块时别把快照字段扩成任何能反推 Token 的东西，也不要把验证塞进每次 `GET /status`（会伤 API 额度）。
- `ctx.tools.register(definition, { when })` 的硬性要求：`definition` 必须带 `output: { schema, render(args, value) => ContentBlock[] }`（文本块形状是 `{ type: 'text', text }`），缺 `render` 会直接抛 `TypeError`；`run_code` 是保留工具名。`when` 每个模型步求值一次，可返回 Promise，返回 false 表示该步不向模型暴露这个工具。
- 工具定义不能只靠注册时的条件做安全边界：`execute` 里仍要自己校验参数（手写注册没有 `defineTool` 的入参校验）。

## 自检方式

- Host 语法：`node --check src/host/*.js`
- 客户端产物：构建后用 stub 加载验证注册（`window.__ModuleLoader__` 假实现 + `require('react')` 桩），确认 exports 为 `apply`/`inject`
- 路由是否注册：用 `curl -i` 请求 `/cloudflare-dash/api/v1/status|sites|overview`，未带浏览器 Cookie 时应返回 **401** 且 body 是插件的 JSON；返回 404 说明 Host 旧代码还在运行。**不要用 PowerShell 的 `Invoke-WebRequest` 判断**——它对本站路由会误报 404（curl 同一时刻是 401）。
- 真实数据验证：用本机凭据里的 Token 跑一次性 Node 脚本查询 `analytics.js` 的导出函数，**只打印结果，不打印 Token**
- 路由逻辑可以**不重启 DSH** 就验证：用假 ctx（`get('credentials')` 返回带 Token 的桩、`webServer.register` 捕获 handler）调 `registerRoutes(ctx)`，再伪造 `request`/`response` 打 `/status`，能覆盖「快照 / 懒验证 / `verify=1`」三条路径
- 视觉与交互无法自动化：让用户刷新页面后截图确认

## 事故记录（2026-11-17，已修复）

**desktop Host 进程 OOM 崩溃**（5 次，`exited with 134`，堆 ~4 GB，20 秒内从 340 MB 冲到 4 GB）。根因在自己写的 `sliceWindow`：

- `RANGES['7d'].chunkMs` 写成 `0`，调用处用 `spec.chunkMs ?? spec.ms`——`??` 只兜 `null`/`undefined`，**0 会原样传下去**；
- `chunk = 0` 时 `begin = Math.max(end - 0, fromMs) === end`，循环永不推进，每轮 push 一个 `Date` 对 → 面板一请求 24h/7d（默认 7d）宿主就死循环 → OOM → 应用崩溃。
- 误导之处：`30d` 反而正常（它真的有 7 天切片）；「停用插件就稳定」只是因为没面板就不发请求；agent 工具一度被冤枉（它调 7d 同样触发）。

**教训（写代码时守住）**
1. **请求路径里不允许任何不受限循环**：给循环加上界，并且在进入前把参数归一化（`chunkMs > 0 ? chunkMs : 窗口长度`）。
2. `??` 不兜 `0`/`NaN`/空串；数值兜底用显式比较。
3. 关键纯函数要能脱离网络单测：`sliceWindow` 已导出，`tests/slice-window.mjs` 钉住 0/负数/NaN/Infinity 的终止行为；`summarizeSampling` 由 `tests/sampling.mjs` 钉住「拿不到 confidence 时必须说不知道、不能声称精确」。

## 当前状态

- ✅ M1 配置闭环（Token UI、用户级/帐户级校验、代理开关、网络诊断）
- ✅ M2 概览看板（站点/时间范围、趋势曲线、热门页面/来源/国家/浏览器、Core Web Vitals）
- ✅ M3 缓存与后台刷新（60s 轮询 + Host TTL 缓存）、设备/系统维度、加载性能阶段分解
- ✅ M4 单个聚合 agent 工具 `cloudflare_analytics`（`action` 参数，`when` 门控，已用真实数据端到端验证）
- ✅ M5 开源准备（`SECURITY.md`、CI、安装章节、市场图标与截图）
- ✅ M6 采样透明化：分位数改为「每个切片自带、取最新有样本的那片」并标注窗口；上一周期独立切片网格，环比精确；`confidence.count.sampleSize` 判断采样，命中时面板顶部提示（`summarizeSampling` + `tests/sampling.mjs`）
- ✅ M7 视角控制：Top 榜每维度取 20 行、默认显示 6 行可展开（`mergeTop` + `tests/query-shape.mjs`）；bot 口径开关（`botFilter`，只影响总量/趋势/榜单/环比，缓存键带上 `bots`）
- ✅ M8 导出 CSV：纯客户端 `csv.js`，长表 `section,key,metric,value`，含 `meta`（站点/范围/口径/窗口/采样/`top_limit`），字段过公式注入防护（`tests/csv.mjs`）
- ⬜ 发布：npm 包、GitHub Release、收录到插件目录
