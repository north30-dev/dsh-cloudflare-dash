# Cloudflare 看板

通过 Cloudflare 官方 API 在 DeepSeek Harness 中提供与 Cloudflare 控制台相似的看板视图。

## 当前状态

项目脚手架阶段，**尚未实现任何功能**：

- Host 侧 `apply()` 为空。
- Client 侧工厂不注册任何 slot，安装后不会出现界面。
- 未实现 Cloudflare API 调用、凭据配置、图表或数据展示。

## 计划能力

以下能力尚未实现，仅作为设计方向记录，插件当前不提供：

- 账户与 Zone 概览
- 流量与请求分析图表
- DNS 记录查看
- 缓存与安全相关指标

## 目录

| 路径 | 用途 |
| --- | --- |
| `index.js` | Host 入口，随 bundle patch 激活 |
| `client.js` | Web Client 入口，由模块加载器加载 |
| `src/host` | 预留：API 访问、凭据、Host 服务与工具 |
| `src/client` | 预留：看板 UI 与 slot 注册 |
| `src/shared` | 预留：共享常量与类型 |
| `locale/` | 界面标题与描述的多语言资源 |
| `docs/` | 文档 |

## 使用

安装插件后，仅会在插件列表中看到 `cloudflare-dash` 条目；看板界面不可用，直到后续版本实现。

## 限制

- 依赖 Cloudflare 官方 API，需要用户自备 API Token，且受该 Token 的权限与速率限制约束。
- 仅展示 Token 有权访问的账户与 Zone。
