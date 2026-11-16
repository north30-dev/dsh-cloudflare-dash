# Cloudflare 看板插件（dsh-cloudflare-dash）

DeepSeek Harness（DSH）的 Cloudflare 看板插件：计划通过 Cloudflare 官方 API 提供与官网类似的看板能力。

> 当前状态：**仅完成项目脚手架**。没有实现任何看板功能，Host 与 Client 入口均为空壳，安装后不会显示任何界面。

## 目录结构

```
.
├── package.json          # DSH bundle 清单：bundle patch + Web Client 入口
├── cordis.patch.yml      # 插入 Host 插件行 cloudflare-dash
├── index.js              # Host 入口（空壳 apply）
├── client.js             # Web Client 入口（空壳工厂，未注册任何 slot）
├── icon.svg              # 插件图标
├── locale/
│   ├── en.json           # 英文标题/描述/详情文档路径
│   └── zh.json           # 中文标题/描述/详情文档路径
├── docs/
│   └── DETAIL.md         # 插件详情页文档
├── src/
│   ├── host/             # 预留：Cloudflare API 访问、凭据、Host 服务与工具
│   ├── client/           # 预留：看板 UI 组件与 slot 注册
│   └── shared/           # 预留：两端共享的常量与类型
└── tests/                # 预留：测试
```

`src/`、`tests/` 目前只有占位文件，不含任何实现。

## 开发约定

- **无构建步骤**：入口文件是原生 ESM（`index.js`）与 Web loader 工厂（`client.js`），不引入打包器、TypeScript 或依赖，保持首次安装即可激活。
- **Client 模块格式**：浏览器侧由 `window.__ModuleLoader__.load({ id, factory })` 注册，`id` 必须等于包名 `@local/dsh-cloudflare-dash`，React 从 loader 的 `require('react')` 获取。
- **资源归属**：`apply` 内注册的样式、定时器、监听器等资源需要用 `ctx.effect` / `ctx.on` 注册并返回清理函数。
- **UI 文案**：可见文案走 Client locale 服务，并同步维护 `locale/en.json`、`locale/zh.json`。
- **Cloudflare 凭据**：不得写入仓库，后续按 DSH 配置约定保存，并提供可运行的未配置状态提示。
- 新增运行期文件时，同时更新 `package.json` 的 `files` 字段。

## 安装到 DSH

在 **Plugins** 中通过 **Add plugin** 选择本目录安装（本地目录安装会直接链接当前目录），或由 `plugin_manager` 的 `install_bundle` 以本目录绝对路径安装。

安装后请确认 **Plugins** 中出现 `cloudflare-dash` 行：该行只会显示标题、描述与详情文档，没有看板界面。

## 后续计划（尚未实现）

1. 确定看板在 DSH 中的位置（slot / 面板）并注册 Client slot。
2. 增加 Host 侧的 Cloudflare API 访问层与凭据配置。
3. 实现概览、流量分析、DNS 等看板视图。
4. 补充测试与详情页文档。
