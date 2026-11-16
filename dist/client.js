window.__ModuleLoader__.load({
  id: "@local/dsh-cloudflare-dash",
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = __toESM(require("react"), 1);

// src/client/app.jsx
var import_react = __toESM(require("react"), 1);
var PROXY_STORAGE_KEY = "dsh-cloudflare-dash:proxy";
var DEFAULT_PROXY_URL = "http://127.0.0.1:7890";
function apiBase() {
  return new URL("cloudflare-dash/api/v1/", document.baseURI).toString();
}
async function callApi(path, options = {}) {
  const init = {
    method: options.method ?? "GET",
    credentials: "same-origin"
  };
  if (options.body !== void 0) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  let response;
  try {
    response = await fetch(apiBase() + path, init);
  } catch {
    throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u63D2\u4EF6\u540E\u7AEF");
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(payload?.error ?? `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
    error.code = payload?.code;
    error.missing = payload?.missing;
    throw error;
  }
  return payload ?? {};
}
function readProxyPrefs() {
  try {
    const raw = window.localStorage.getItem(PROXY_STORAGE_KEY);
    if (raw === null) return { enabled: false, url: DEFAULT_PROXY_URL };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled === true,
      url: typeof parsed?.url === "string" ? parsed.url : DEFAULT_PROXY_URL
    };
  } catch {
    return { enabled: false, url: DEFAULT_PROXY_URL };
  }
}
function writeProxyPrefs(prefs) {
  try {
    window.localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
  }
}
function formatMs(value) {
  return typeof value === "number" ? `${value} ms` : "\u2014";
}
function formatTime(value) {
  if (typeof value !== "number") return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return null;
  }
}
function suspiciousToken(value) {
  const trimmed = value.trim();
  if (/^[0-9a-f]{32}$/i.test(trimmed)) return "token-id";
  if (/^[0-9a-f]{37}$/i.test(trimmed)) return "global-key";
  return null;
}
function Panel({ t }) {
  const [phase, setPhase] = (0, import_react.useState)("loading");
  const [status, setStatus] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [probing, setProbing] = (0, import_react.useState)(false);
  const [token, setToken] = (0, import_react.useState)("");
  const [replacing, setReplacing] = (0, import_react.useState)(false);
  const [proxyEnabled, setProxyEnabled] = (0, import_react.useState)(false);
  const [proxyUrl, setProxyUrl] = (0, import_react.useState)(DEFAULT_PROXY_URL);
  const [notice, setNotice] = (0, import_react.useState)(null);
  const [probeResult, setProbeResult] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    const prefs = readProxyPrefs();
    setProxyEnabled(prefs.enabled);
    setProxyUrl(prefs.url);
    let cancelled = false;
    callApi("status").then((data) => {
      if (cancelled) return;
      setStatus(data);
      setPhase("ready");
    }).catch((error) => {
      if (cancelled) return;
      setNotice({ kind: "error", text: error.message });
      setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const proxy = () => ({ enabled: proxyEnabled, url: proxyUrl });
  function describeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const missing = Array.isArray(error?.missing) ? error.missing.filter((entry) => typeof entry === "string") : [];
    let text = message;
    if (missing.length > 0) text += `
${t("error.missingHint")}: ${missing.join("; ")}`;
    if (error?.code === "unauthorized") text += `
${t("hint.unauthorized")}`;
    return text;
  }
  async function handleSave() {
    const value = token.trim();
    if (value === "") {
      setNotice({ kind: "error", text: t("step.token.placeholder") });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const data = await callApi("token", { method: "POST", body: { token: value, proxy: proxy() } });
      setStatus(data);
      setToken("");
      setReplacing(false);
      writeProxyPrefs(proxy());
      setNotice({ kind: "ok", text: t("msg.saved") });
    } catch (error) {
      setNotice({ kind: "error", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }
  async function handleDelete() {
    setBusy(true);
    setNotice(null);
    try {
      const data = await callApi("token", { method: "DELETE" });
      setStatus(data);
      setNotice({ kind: "ok", text: t("msg.deleted") });
    } catch (error) {
      setNotice({ kind: "error", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }
  async function handleProbe() {
    setProbing(true);
    setNotice(null);
    try {
      const data = await callApi("probe", { method: "POST", body: { proxy: proxy() } });
      setProbeResult(data);
      writeProxyPrefs(proxy());
    } catch (error) {
      setNotice({ kind: "error", text: describeError(error) });
    } finally {
      setProbing(false);
    }
  }
  const configured = status?.configured === true;
  const verifiedAt = formatTime(status?.verifiedAt);
  function renderTokenForm() {
    const suspicious = suspiciousToken(token);
    return /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-step" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-label" }, t("step.token.title")), /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-desc" }, t("step.token.desc"), " ", /* @__PURE__ */ import_react.default.createElement("span", { className: "cfd-desc" }, t("perm.list"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-row" }, /* @__PURE__ */ import_react.default.createElement(
      "input",
      {
        className: "cfd-input",
        type: "password",
        autoComplete: "off",
        spellCheck: false,
        placeholder: t("step.token.placeholder"),
        value: token,
        onChange: (event) => setToken(event.target.value),
        onKeyDown: (event) => {
          if (event.key === "Enter") void handleSave();
        }
      }
    ), /* @__PURE__ */ import_react.default.createElement("button", { className: "cfd-btn cfd-btn--primary", disabled: busy, onClick: () => void handleSave() }, busy ? t("step.token.saving") : t("step.token.save"))), suspicious === null ? null : /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-hint cfd-warn" }, suspicious === "token-id" ? t("warn.tokenId") : t("warn.globalKey")), /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-hint" }, /* @__PURE__ */ import_react.default.createElement("a", { className: "cfd-link", href: "https://dash.cloudflare.com/profile/api-tokens", target: "_blank", rel: "noreferrer" }, t("step.token.console"))));
  }
  function renderProxy() {
    return /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-step" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-label" }, t("step.proxy.title")), /* @__PURE__ */ import_react.default.createElement("label", { className: "cfd-check" }, /* @__PURE__ */ import_react.default.createElement(
      "input",
      {
        type: "checkbox",
        checked: proxyEnabled,
        onChange: (event) => {
          const enabled = event.target.checked;
          setProxyEnabled(enabled);
          writeProxyPrefs({ enabled, url: proxyUrl });
        }
      }
    ), t("step.proxy.toggle")), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-row", style: { marginTop: "10px" } }, /* @__PURE__ */ import_react.default.createElement(
      "input",
      {
        className: "cfd-input",
        type: "text",
        spellCheck: false,
        disabled: !proxyEnabled,
        placeholder: t("step.proxy.placeholder"),
        value: proxyUrl,
        onChange: (event) => setProxyUrl(event.target.value),
        onBlur: () => writeProxyPrefs({ enabled: proxyEnabled, url: proxyUrl })
      }
    ), /* @__PURE__ */ import_react.default.createElement("button", { className: "cfd-btn", disabled: probing, onClick: () => void handleProbe() }, probing ? t("action.probing") : t("action.probe"))), /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-hint" }, t("step.proxy.hint")));
  }
  function renderProbe() {
    if (probeResult === null) return null;
    const rows = [
      ["direct", probeResult.direct, t("probe.direct")],
      ["proxied", probeResult.proxied, t("probe.proxied")]
    ].filter(([, value]) => value !== void 0 && value !== null);
    return /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-probe" }, rows.map(([key, value, label]) => /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-probe-row", key }, /* @__PURE__ */ import_react.default.createElement("span", { className: "cfd-probe-name" }, label), /* @__PURE__ */ import_react.default.createElement("span", null, value.ok ? t("probe.ok") : t("probe.fail")), value.ok ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("span", null, "DNS ", formatMs(value.timings?.dnsMs)), /* @__PURE__ */ import_react.default.createElement("span", null, "TLS ", formatMs(value.timings?.tlsMs)), /* @__PURE__ */ import_react.default.createElement("span", null, "TTFB ", formatMs(value.timings?.ttfbMs)), /* @__PURE__ */ import_react.default.createElement("span", null, "Total ", formatMs(value.timings?.totalMs))) : /* @__PURE__ */ import_react.default.createElement("span", null, (value.error?.code ?? "network") + " \xB7 " + (value.error?.message ?? "")))));
  }
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-page" }, /* @__PURE__ */ import_react.default.createElement("header", { className: "cfd-head" }, /* @__PURE__ */ import_react.default.createElement("h2", { className: "cfd-title" }, t("title")), /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-sub" }, t("subtitle"))), phase === "loading" ? /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-hint" }, t("loading")) : /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-card" }, configured ? /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-meta" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-value cfd-metric-value--small" }, status.masked ?? "\u2014"), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-label" }, t("status.masked"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-value" }, typeof status.accounts === "number" ? status.accounts : "\u2014"), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-label" }, t("status.accounts"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-value" }, typeof status.rumSites === "number" ? status.rumSites : "\u2014"), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-label" }, t("status.sites"))), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-value cfd-metric-value--small" }, verifiedAt ?? t("status.neverVerified")), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-metric-label" }, t("status.verified")))), /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-hint" }, status.source === "environment" ? t("status.source.environment") : t("status.source.stored"), status.source === "environment" ? ` \xB7 ${t("hint.envFallback")}` : ""), status.rumSites === 0 ? /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-hint" }, t("status.noSites")) : null, typeof status.hint === "string" ? /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-hint" }, status.hint) : null, replacing ? renderTokenForm() : null, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-actions" }, /* @__PURE__ */ import_react.default.createElement("button", { className: "cfd-btn", disabled: busy, onClick: () => setReplacing(!replacing) }, t("action.replace")), /* @__PURE__ */ import_react.default.createElement("button", { className: "cfd-btn", disabled: busy, onClick: () => void handleDelete() }, t("action.delete")))) : renderTokenForm(), renderProxy(), notice === null ? null : /* @__PURE__ */ import_react.default.createElement("p", { className: notice.kind === "ok" ? "cfd-hint cfd-ok" : "cfd-error" }, notice.text), renderProbe()));
}
function PanelIcon({ size = 20, active = false }) {
  return /* @__PURE__ */ import_react.default.createElement(
    "svg",
    {
      className: "cfd-icon",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      role: "img",
      "aria-hidden": "true",
      style: { opacity: active ? 1 : 0.78 }
    },
    /* @__PURE__ */ import_react.default.createElement("rect", { x: "3.5", y: "13", width: "3.4", height: "7.5", rx: "1.7", fill: "currentColor", opacity: "0.75" }),
    /* @__PURE__ */ import_react.default.createElement("rect", { x: "10.3", y: "8.5", width: "3.4", height: "12", rx: "1.7", fill: "currentColor", opacity: "0.88" }),
    /* @__PURE__ */ import_react.default.createElement("rect", { x: "17.1", y: "3.8", width: "3.4", height: "16.7", rx: "1.7", fill: "currentColor" })
  );
}

// src/client/locale.js
var NS = "cloudflare-dash";
var zh = {
  "panel.label": "Cloudflare \u770B\u677F",
  title: "Cloudflare \u770B\u677F",
  subtitle: "\u8BFB\u53D6 Cloudflare \u5B98\u65B9 API \u7684 Web Analytics \u6570\u636E\u3002Token \u53EA\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u4E0D\u4E0A\u4F20\u3001\u4E0D\u5199\u5165\u4F1A\u8BDD\u3002",
  loading: "\u6B63\u5728\u8BFB\u53D6\u914D\u7F6E\u2026",
  "step.token.title": "1. \u521B\u5EFA\u53EA\u8BFB API Token",
  "step.token.desc": "\u5728 Cloudflare \u540E\u53F0\u521B\u5EFA API Token\uFF0C\u53EA\u52FE\u9009 Read \u6743\u9650\u3002\u5EFA\u8BAE\u6743\u9650\uFF1A",
  "perm.list": "Account Settings:Read \xB7 Account Analytics:Read",
  "step.token.console": "\u6253\u5F00 Cloudflare API Token \u9875\u9762",
  "step.token.placeholder": "\u7C98\u8D34 API Token",
  "step.token.save": "\u9A8C\u8BC1\u5E76\u4FDD\u5B58",
  "step.token.saving": "\u6B63\u5728\u9A8C\u8BC1\u2026",
  "step.proxy.title": "2. \u7F51\u7EDC\u4E0E\u4EE3\u7406\uFF08\u53EF\u9009\uFF09",
  "step.proxy.toggle": "\u901A\u8FC7 HTTP \u4EE3\u7406\u8BBF\u95EE Cloudflare",
  "step.proxy.placeholder": "http://127.0.0.1:7890",
  "step.proxy.hint": "\u4EC5\u652F\u6301 http://host:port \u7684 CONNECT \u4EE3\u7406\uFF1B\u4E0D\u586B\u5219\u76F4\u8FDE\u3002",
  "action.probe": "\u7F51\u7EDC\u8BCA\u65AD",
  "action.probing": "\u8BCA\u65AD\u4E2D\u2026",
  "action.delete": "\u5220\u9664 Token",
  "action.replace": "\u66F4\u6362 Token",
  "action.verify": "\u91CD\u65B0\u9A8C\u8BC1",
  "status.configured": "\u5DF2\u914D\u7F6E",
  "status.source.stored": "\u4FDD\u5B58\u5728 DSH \u51ED\u636E\u5E93",
  "status.source.environment": "\u6765\u81EA\u73AF\u5883\u53D8\u91CF CLOUDFLARE_API_TOKEN",
  "status.masked": "Token",
  "status.verified": "\u9A8C\u8BC1\u65F6\u95F4",
  "status.accounts": "\u53EF\u89C1\u8D26\u6237",
  "status.sites": "Web Analytics \u7AD9\u70B9",
  "status.neverVerified": "\u672C\u6B21\u542F\u52A8\u5C1A\u672A\u9A8C\u8BC1",
  "status.noSites": "\u672A\u53D1\u73B0\u5DF2\u542F\u7528 Web Analytics \u7684\u7AD9\u70B9",
  "hint.envFallback": "\u5220\u9664\u540E\u4ECD\u4F1A\u56DE\u9000\u5230\u73AF\u5883\u53D8\u91CF\u4E2D\u7684 Token\u3002",
  "probe.direct": "\u76F4\u8FDE",
  "probe.proxied": "\u4EE3\u7406",
  "probe.notRun": "\u5C1A\u672A\u8BCA\u65AD",
  "probe.ok": "\u53EF\u8FBE",
  "probe.fail": "\u4E0D\u53EF\u8FBE",
  "msg.saved": "\u9A8C\u8BC1\u901A\u8FC7\uFF0CToken \u5DF2\u4FDD\u5B58",
  "msg.deleted": "\u5DF2\u5220\u9664\u4FDD\u5B58\u7684 Token",
  "error.generic": "\u8BF7\u6C42\u5931\u8D25",
  "error.missingHint": "\u7F3A\u5C11\u6743\u9650",
  "warn.tokenId": "\u8FD9\u770B\u8D77\u6765\u662F 32 \u4F4D Token ID\uFF0C\u4E0D\u662F Token \u503C",
  "warn.globalKey": "\u8FD9\u770B\u8D77\u6765\u662F Global API Key\uFF0C\u672C\u63D2\u4EF6\u53EA\u652F\u6301 API Token",
  "hint.unauthorized": "\u8BF7\u786E\u8BA4\uFF1A\u2460 \u590D\u5236\u7684\u662F\u521B\u5EFA\u5B8C\u6210\u65F6\u663E\u793A\u7684 Token \u503C\uFF0C\u4E0D\u662F Token ID\uFF1B\u2461 \u521B\u5EFA\u6D41\u7A0B\u5DF2\u8D70\u5B8C Continue to summary \u2192 Create Token\uFF1B\u2462 \u6CA1\u6709\u4F7F\u7528 Global API Key\u3002"
};
var en = {
  "panel.label": "Cloudflare dashboard",
  title: "Cloudflare dashboard",
  subtitle: "Reads Web Analytics data from the official Cloudflare API. The token stays on this machine and never enters a session.",
  loading: "Reading configuration\u2026",
  "step.token.title": "1. Create a read-only API token",
  "step.token.desc": "Create an API token in the Cloudflare dashboard with Read permissions only. Suggested permissions:",
  "perm.list": "Account Settings:Read \xB7 Account Analytics:Read",
  "step.token.console": "Open the Cloudflare API token page",
  "step.token.placeholder": "Paste your API token",
  "step.token.save": "Verify and save",
  "step.token.saving": "Verifying\u2026",
  "step.proxy.title": "2. Network and proxy (optional)",
  "step.proxy.toggle": "Reach Cloudflare through an HTTP proxy",
  "step.proxy.placeholder": "http://127.0.0.1:7890",
  "step.proxy.hint": "Accepts an http://host:port CONNECT proxy only; leave empty to connect directly.",
  "action.probe": "Run diagnostics",
  "action.probing": "Measuring\u2026",
  "action.delete": "Remove token",
  "action.replace": "Replace token",
  "action.verify": "Verify again",
  "status.configured": "Configured",
  "status.source.stored": "Stored in the DSH credential store",
  "status.source.environment": "From the CLOUDFLARE_API_TOKEN environment variable",
  "status.masked": "Token",
  "status.verified": "Verified at",
  "status.accounts": "Visible accounts",
  "status.sites": "Web Analytics sites",
  "status.neverVerified": "Not verified in this run",
  "status.noSites": "No site with Web Analytics enabled was found",
  "hint.envFallback": "Removing the stored token falls back to the environment variable.",
  "probe.direct": "Direct",
  "probe.proxied": "Proxy",
  "probe.notRun": "Not measured yet",
  "probe.ok": "Reachable",
  "probe.fail": "Unreachable",
  "msg.saved": "Verification passed, token saved",
  "msg.deleted": "Stored token removed",
  "error.generic": "Request failed",
  "error.missingHint": "Missing permission",
  "warn.tokenId": "This looks like a 32-character token ID, not the token value",
  "warn.globalKey": "This looks like the Global API Key; only API tokens are supported",
  "hint.unauthorized": "Check that you copied the token value shown after creation (not the token ID), that the create flow finished with Continue to summary \u2192 Create Token, and that you did not paste the Global API Key."
};

// src/client/styles.css
var styles_default = ".cfd-page {\n  box-sizing: border-box;\n  max-width: 760px;\n  padding: 28px 28px 40px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-head {\n  margin-bottom: 20px;\n}\n\n.cfd-title {\n  margin: 0;\n  font-size: 18px;\n  font-weight: 600;\n  line-height: 1.4;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-sub {\n  margin: 8px 0 0;\n  font-size: 13px;\n  line-height: 1.7;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-card {\n  margin-top: 16px;\n  padding: 20px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.cfd-step + .cfd-step {\n  margin-top: 22px;\n  padding-top: 20px;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n\n.cfd-label {\n  margin-bottom: 8px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-desc {\n  margin: 0 0 10px;\n  font-size: 12px;\n  line-height: 1.7;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-row {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  flex-wrap: wrap;\n}\n\n.cfd-input {\n  box-sizing: border-box;\n  flex: 1 1 260px;\n  min-width: 0;\n  height: 34px;\n  padding: 0 10px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  outline: none;\n}\n\n.cfd-input:focus {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.cfd-btn {\n  height: 32px;\n  padding: 0 14px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  cursor: pointer;\n}\n\n.cfd-btn:hover:not(:disabled) {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.cfd-btn--primary {\n  border-color: var(--dsw-alias-brand-primary);\n  background: var(--dsw-alias-brand-primary);\n  /* Theme-aware contrast: the label uses the base background, which is the\n     inverse of the brand fill in both light and dark themes. A literal #fff\n     disappears whenever the dark theme's brand accent is near-white. */\n  color: var(--dsw-alias-bg-base);\n}\n\n.cfd-btn:disabled {\n  opacity: 0.55;\n  cursor: default;\n}\n\n.cfd-check {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n}\n\n.cfd-check input {\n  accent-color: var(--dsw-alias-brand-primary);\n}\n\n.cfd-hint {\n  margin: 8px 0 0;\n  font-size: 12px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-warn {\n  color: var(--dsw-alias-state-warn-primary);\n}\n\n.cfd-link {\n  font-size: 13px;\n  color: var(--dsw-alias-brand-primary);\n  text-decoration: none;\n}\n\n.cfd-link:hover {\n  text-decoration: underline;\n}\n\n.cfd-ok {\n  color: var(--dsw-alias-state-success-primary);\n}\n\n.cfd-error {\n  margin: 10px 0 0;\n  font-size: 13px;\n  line-height: 1.6;\n  color: var(--dsw-alias-state-error-primary);\n  white-space: pre-wrap;\n}\n\n.cfd-meta {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n  gap: 10px;\n  margin-top: 4px;\n}\n\n.cfd-metric {\n  padding: 12px;\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-2);\n}\n\n.cfd-metric-value {\n  font-size: 20px;\n  font-weight: 600;\n  line-height: 1.3;\n  color: var(--dsw-alias-label-primary);\n  word-break: break-all;\n}\n\n.cfd-metric-value--small {\n  font-size: 13px;\n  font-weight: 500;\n}\n\n.cfd-metric-label {\n  margin-top: 4px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-actions {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n  margin-top: 16px;\n}\n\n.cfd-probe {\n  display: grid;\n  gap: 6px;\n  margin-top: 12px;\n  font-size: 12px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-probe-row {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.cfd-probe-name {\n  min-width: 56px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-icon {\n  display: block;\n}\n";

// src/client/index.jsx
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-cloudflare-dash";
    style.textContent = styles_default;
    document.head.appendChild(style);
    return () => style.remove();
  }, "cloudflare-dash: styles");
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "cloudflare-dash: dictionaries");
  const CloudflarePanel = () => import_react2.default.createElement(Panel, { t: ctx.locale.bind(NS) });
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: "cloudflare",
    order: 40,
    label: () => ctx.locale.bind(NS)("panel.label")
  }, PanelIcon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "cloudflare"
  }, CloudflarePanel));
}
    return module.exports;
  },
});

