# 开发计划：v0.6.0（一次装完三批功能）

> 交接文件。新会话开工前请先读 `AGENTS.md`（硬性约束 + API 事实 + 事故记录），再读本文件。
> 本文件只描述「下一步做什么」，不重复 AGENTS.md 里的约束。

## 基线与决策

- 当前基线：`v0.5.0`（`git tag v0.5.0`，npm `dsh-cloudflare-dash@0.5.0`，Trusted Publishing 发布；`dist/client.js` 已提交）。
- **发版策略调整**：原计划 0.6.0 / 0.7.0 / 0.8.0 三版合并为 **一个 0.6.0 版本**一次发布，避免版本号碎片化。
- 开工前提：`pnpm test` 全绿、`node --check src/host/*.js` 通过。

## 为什么是这几个功能（背景，别跑偏）

同生态里已有 `dsh-cloudflare-mcp`（npm，~212 下载/月，0.1.x，最后发布 2026-09-29）：它是 **MCP 客户端桥**，用 OAuth 接 `mcp.cloudflare.com`，把 Cloudflare 全部 API（DNS/Workers/Pages/R2/KV/D1）以 `mcp__cloudflare__*` 暴露给 agent。

它拿走了「接入」，没拿走「解读」。本插件的护城河只有三样，所有新功能都必须落在这三样里：

1. **判读正确性**：ABR 采样、按周切片、微秒换算、`bot: 0` 口径、`confidence.count` 而不是 `confidence.sum.visits`；
2. **可视化**：图表、环比、阶段分解；
3. **单面板信息密度**：一屏看全部站点。

由此得出三条**明确不做**：

- ❌ 不扩产品面到 DNS / 防火墙 / Workers / 缓存（撞车 + 违反「只读」硬约束）；
- ❌ 不做 MCP 协议层（官方 `mcp.cloudflare.com` 已免费覆盖）；
- ❌ 不引入 MCP SDK / zod 等依赖（零依赖是可维护性优势）。

## 任务清单

### A. 上手摩擦（原 0.6.0）

现状：`src/client/settings.jsx:256` 只有一条裸链接 `https://dash.cloudflare.com/profile/api-tokens`；建议权限与排错文案写在 `src/client/locale.js`（`step.token.title` / `step.token.desc` / `hint.unauthorized`），但没走到关键路径上。

- [ ] **A1 预填权限的 Token 创建深链**
  - 把裸链接换成「权限已勾好」的 dash 预填 URL：两个权限 `Account Settings:Read`、`Account Analytics:Read`。
  - ⚠️ **动手前必须验证**：dash 预填 URL 的真实参数格式（`permissionGroupKeys` 的 JSON 结构与 `type` 取值）和两个 permission group 的 **key 字符串**。不要凭印象写，先在浏览器里手工拼一次确认落地页已勾选。
  - 验收：点链接 → dash 打开 → 两个 Read 权限已勾好 → 走完 Create Token 拿到值。
- [ ] **A2 无 Token 时的空状态引导**
  - `app.jsx` / `overview.jsx`：未配置时不要空白，显示「三步走 + 深链 + 验证并保存」。
- [ ] **A3 失败信息可操作化**
  - 确认 `hint.unauthorized`（复制成 Token ID / 流程未走完 / 用了 Global API Key）真的渲染在错误卡片里；再补「站点数 0 = 缺 `Account Settings:Read`」与「权限不足」两类。

### B. 只有面板能做的事（原 0.7.0）

- [ ] **B1 多站点概览**
  - 一屏对比账户下全部站点（访问量、CWV 概况、是否在退），可点进单站。
  - ⚠️ 缓存与额度：一次要打 N 个站点的查询。必须复用 Host 现有 TTL 缓存（键含 `账户:站点:范围:bots`），并对站点抓取做**有限并发**（给上界，禁止无界 `Promise.all`——参见 AGENTS.md 事故记录里对无界循环的教训）。
  - 站点很多时要有分页/截断策略，并把「共 N 站，显示前 M」写进输出。
- [ ] **B2 自定义时间范围**
  - 在 24h / 7d / 30d 之外支持 `from`/`to`（日期选择）。
  - ⚠️ 关键：`sliceWindow` 的 `chunkMs` 归一化（0 / NaN / 负数必须有兜底）；**上一周期必须单独开一套切片网格**（`sliceWindow(now - 2*ms, now - ms, chunkMs)`），不要复用当前窗口的网格。
  - ⚠️ 分位数仍按「每个切片自带、取最新有样本的那片」，不要把整窗 summary 拼回来。
- [ ] **B3 环比可视化**
  - 趋势图上叠加上一周期曲线（现在只有数字环比）；图例与「口径 / 窗口」标注沿用 CSV 的 `meta` 语义。

### C. Drill-down（原 0.8.0）

- [ ] **C1 页面级下钻**
  - 点 Top 页面 → 看该 `requestPath` 自己的 CWV 与加载阶段。
  - ⚠️ 采样：下钻后样本数骤减，`rowSampling` 必须展示，样本不足时明确说「样本太少，不可判定」而不是给一个数。

## 待验证的 spike

| 编号 | 内容 | 阻塞谁 | 备注 |
| --- | --- | --- | --- |
| S1 | dash 预填 token URL 格式 + permission group key | **阻塞 A1** | 浏览器手验，约 15 分钟 |
| S2 | `mcp.cloudflare.com` 的 OAuth access token 能否**直接**打 `api.cloudflare.com/client/v4/graphql` | 不阻塞本版 | 结论为「能」才考虑做 OAuth 一键授权；「不能」则永久放弃该路线 |
| S3 | 多站点查询的单账户并发上限与额度感受 | 阻塞 B1 的实现细节 | 用真实账户试 |

## 分发（低成本，可与开发并行）

- [ ] **D1** 把 AGENTS.md 的「API 事实」整理成公开文档 `docs/cloudflare-rum-notes.md`（这是唯一一份讲清 ABR 采样与切片的材料，价值在**被引用**）。
- [ ] **D2** `package.json` 加 `bin`（如 `{"cf-rum": "./bin/cf-rum.mjs"}`），让 `npx dsh-cloudflare-dash report --site <tag> --range 7d` 可用。`files` 里已含 `src/host`，**零新增包、零新增仓库、复用现有发布链路**。
- [ ] **D3** Agensi 免费上架一份纯知识 skill（浓缩 D1 内容 + 指向官方 `mcp.cloudflare.com` + 指向本插件），目的是反向链接与漏斗，不收费。
- [ ] **D4** 给 `cloudflare/mcp` 提 issue/PR，把采样与切片陷阱写进他们的文档或工具描述（署名杠杆）。

## 发版（本版只发一次）

```bash
# 1. bump package.json version 到 0.6.0 并提交到 main
# 2. tag 名必须等于 v + version
git tag v0.6.0 && git push origin v0.6.0
```

发布前自检：`pnpm run build`（`dist/client.js` 不许漂移）、`node scripts/check-manifest.mjs`、`pnpm test`、`node --check src/host/*.js`。

## 已定：本文件不进 npm 包

`package.json` 的 `files` 已加 `"!docs/ROADMAP.md"`，其余 `docs/`（如 `DETAIL.md`）照常发布。改动后用 `npm pack --dry-run` 确认列表里没有 `ROADMAP.md`；若哪天挪动了本文件位置，记得同步这条否定规则。

- `AGENTS.md` 末尾「当前状态」的发布条目要随本版更新。
