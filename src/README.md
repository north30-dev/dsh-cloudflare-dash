# src

插件源码。Host 与 Client 两半，构建后由根 `index.js` 与 `dist/client.js` 加载。

| 目录 | 职责 |
|---|---|
| `host/` | Host 侧：HTTP 路由、Cloudflare API 客户端、凭据存储、出网与代理 |
| `client/` | 浏览器侧：侧边栏图标、主面板、样式与文案 |
| `shared/` | 预留：两端共享的常量（当前两端无需共享代码） |

约定：

- Host 侧是原生 ESM，Node 直接加载，改动无需构建。
- 浏览器侧必须打包：`dist/client.js` 是单文件 bundle（loader 只接受一个自包含模块），改完执行 `pnpm run build`。
- 浏览器侧只能 `require('react')`，不要引入其他 Harness 内部包（它们会随版本变化且不被支持）。
- 样式只用 `--dsw-alias-*` 主题 token，文案走 `locale.js` + `ctx.locale`。
- 新增运行期文件后同步更新 `package.json` 的 `files`。
