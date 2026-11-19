window.__ModuleLoader__.load({
  id: "dsh-cloudflare-dash",
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
var import_react5 = __toESM(require("react"), 1);

// src/client/app.jsx
var import_react4 = __toESM(require("react"), 1);

// src/client/api.js
var PROXY_STORAGE_KEY = "dsh-cloudflare-dash:proxy";
var DEFAULT_PROXY_URL = "http://127.0.0.1:7890";
function apiBase() {
  return new URL("cloudflare-dash/api/v1/", document.baseURI).toString();
}
async function callApi(path, options = {}) {
  const init = { method: options.method ?? "GET", credentials: "same-origin" };
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
    error.status = response.status;
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
  callApi("prefs", { method: "POST", body: { proxy: prefs } }).catch(() => {
  });
}
function proxyQuery(proxy) {
  if (proxy.enabled !== true) return "";
  return `proxy=1&proxyUrl=${encodeURIComponent(proxy.url)}`;
}

// src/client/overview.jsx
var import_react2 = __toESM(require("react"), 1);

// src/client/chart.jsx
var import_react = __toESM(require("react"), 1);

// src/client/format.js
function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function fmtInt(value) {
  return toNumber(value).toLocaleString("en-US");
}
function fmtCompact(value) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(value >= 1e7 ? 0 : 1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(value));
}
function fmtDelta(current, previous) {
  const now = toNumber(current);
  const before = toNumber(previous);
  if (before === 0) return { pct: now === 0 ? 0 : null, dir: now === 0 ? "flat" : "up" };
  const pct = (now - before) / before * 100;
  if (Math.abs(pct) < 0.05) return { pct: 0, dir: "flat" };
  return { pct, dir: pct > 0 ? "up" : "down" };
}
function fmtDuration(microseconds) {
  if (typeof microseconds !== "number" || !Number.isFinite(microseconds)) return "\u2014";
  const ms2 = microseconds / 1e3;
  if (ms2 >= 1e3) return `${(ms2 / 1e3).toFixed(2)} s`;
  if (ms2 >= 100) return `${Math.round(ms2)} ms`;
  return `${ms2.toFixed(1)} ms`;
}
function fmtRatio(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "\u2014";
  return value.toFixed(2);
}
function daysSince(iso, now = Date.now()) {
  if (typeof iso !== "string" || iso === "") return null;
  const normalized = iso.replace(/(\.\d{3})\d+/, "$1");
  const at = Date.parse(normalized);
  if (!Number.isFinite(at) || !Number.isFinite(now)) return null;
  const days = Math.floor((now - at) / 864e5);
  return days >= 0 ? days : null;
}
function fmtBucket(iso, step, withDate) {
  if (iso === "") return "";
  if (step === "day") {
    const [, month, day] = iso.split("-");
    return `${month}-${day}`;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, "0");
  const label = `${hh}:00`;
  if (!withDate) return label;
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")} ${label}`;
}

// src/client/chart.jsx
var WIDTH = 760;
var HEIGHT = 240;
var PAD = { left: 44, right: 16, top: 16, bottom: 28 };
function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 1.5 ? 1.5 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 3 ? 3 : normalized <= 4 ? 4 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
function stampToMs(stamp) {
  if (typeof stamp !== "string" || stamp === "") return Number.NaN;
  return Date.parse(stamp);
}
function TrendChart({ points, step = "day", note, labels }) {
  const [hover, setHover] = (0, import_react.useState)(-1);
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  if (points.length === 0) {
    return /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-chart-empty" }, labels.empty);
  }
  const peak = Math.max(1, ...points.map((point) => Math.max(point.visits, point.pageLoads)));
  const max = niceMax(peak);
  const stepMs = step === "hour" ? 36e5 : 864e5;
  const times = points.map((point) => stampToMs(point.t));
  const byTime = times.every((value) => Number.isFinite(value));
  let domainFrom = 0;
  let domainTo = 0;
  if (byTime) {
    domainFrom = times[0];
    domainTo = times[times.length - 1];
    if (!(domainTo > domainFrom)) {
      domainFrom -= stepMs / 2;
      domainTo += stepMs / 2;
    }
  }
  const xOf = (index) => {
    if (byTime) {
      const ratio2 = (times[index] - domainFrom) / (domainTo - domainFrom);
      return PAD.left + Math.min(1, Math.max(0, ratio2)) * innerWidth;
    }
    if (points.length === 1) return PAD.left + innerWidth / 2;
    return PAD.left + index / (points.length - 1) * innerWidth;
  };
  const yOf = (value) => PAD.top + innerHeight - value / max * innerHeight;
  const visitsLine = points.map((point, index) => `${index === 0 ? "M" : "L"}${xOf(index)},${yOf(point.visits)}`).join(" ");
  const visitsArea = `${visitsLine} L${xOf(points.length - 1)},${PAD.top + innerHeight} L${xOf(0)},${PAD.top + innerHeight} Z`;
  const loadsLine = points.map((point, index) => `${index === 0 ? "M" : "L"}${xOf(index)},${yOf(point.pageLoads)}`).join(" ");
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(max * fraction));
  const active = hover >= 0 && hover < points.length ? points[hover] : null;
  const showDots = points.length <= 14;
  const slot = Math.max(innerWidth / Math.max(points.length, 1), 8);
  const ticks = [];
  if (byTime) {
    const count2 = 5;
    const span = domainTo - domainFrom;
    for (let index = 0; index < count2; index += 1) {
      const at = domainFrom + span * index / (count2 - 1);
      const iso = step === "hour" ? new Date(at).toISOString() : new Date(at).toISOString().slice(0, 10);
      const label = fmtBucket(iso, step, false);
      if (label !== "" && !ticks.some((tick) => tick.label === label)) {
        ticks.push({ at, label });
      }
    }
  }
  const tickX = (at, index) => {
    if (!byTime) return index === 0 ? PAD.left : index === ticks.length - 1 ? WIDTH - PAD.right : PAD.left + index / (ticks.length - 1) * innerWidth;
    return PAD.left + Math.min(1, Math.max(0, (at - domainFrom) / (domainTo - domainFrom))) * innerWidth;
  };
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-chart" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-legend" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "cfd-legend-item" }, /* @__PURE__ */ import_react.default.createElement("i", { className: "cfd-swatch cfd-swatch--area" }), labels.visits), /* @__PURE__ */ import_react.default.createElement("span", { className: "cfd-legend-item" }, /* @__PURE__ */ import_react.default.createElement("i", { className: "cfd-swatch cfd-swatch--line" }), labels.pageLoads)), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-chart-plot" }, /* @__PURE__ */ import_react.default.createElement("svg", { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, className: "cfd-chart-svg", role: "img" }, /* @__PURE__ */ import_react.default.createElement("defs", null, /* @__PURE__ */ import_react.default.createElement("linearGradient", { id: "cfd-area", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ import_react.default.createElement("stop", { offset: "0%", stopColor: "var(--dsw-alias-brand-primary)", stopOpacity: "0.28" }), /* @__PURE__ */ import_react.default.createElement("stop", { offset: "100%", stopColor: "var(--dsw-alias-brand-primary)", stopOpacity: "0.02" }))), gridValues.map((value) => /* @__PURE__ */ import_react.default.createElement("g", { key: value }, /* @__PURE__ */ import_react.default.createElement(
    "line",
    {
      x1: PAD.left,
      x2: WIDTH - PAD.right,
      y1: yOf(value),
      y2: yOf(value),
      className: "cfd-grid-line"
    }
  ), /* @__PURE__ */ import_react.default.createElement("text", { x: PAD.left - 8, y: yOf(value) + 4, className: "cfd-axis-label", textAnchor: "end" }, fmtCompact(value)))), /* @__PURE__ */ import_react.default.createElement("path", { d: visitsArea, fill: "url(#cfd-area)" }), /* @__PURE__ */ import_react.default.createElement("path", { d: visitsLine, className: "cfd-line cfd-line--area" }), /* @__PURE__ */ import_react.default.createElement("path", { d: loadsLine, className: "cfd-line cfd-line--loads" }), showDots ? points.map((point, index) => /* @__PURE__ */ import_react.default.createElement("g", { key: `dot-${point.label}` }, /* @__PURE__ */ import_react.default.createElement("circle", { cx: xOf(index), cy: yOf(point.visits), r: "3", className: "cfd-dot cfd-dot--visits" }), /* @__PURE__ */ import_react.default.createElement("circle", { cx: xOf(index), cy: yOf(point.pageLoads), r: "3", className: "cfd-dot cfd-dot--loads" }))) : null, active === null ? null : /* @__PURE__ */ import_react.default.createElement("g", null, /* @__PURE__ */ import_react.default.createElement(
    "line",
    {
      x1: xOf(hover),
      x2: xOf(hover),
      y1: PAD.top,
      y2: PAD.top + innerHeight,
      className: "cfd-hover-line"
    }
  ), /* @__PURE__ */ import_react.default.createElement("circle", { cx: xOf(hover), cy: yOf(active.visits), r: "4", className: "cfd-dot cfd-dot--visits" }), /* @__PURE__ */ import_react.default.createElement("circle", { cx: xOf(hover), cy: yOf(active.pageLoads), r: "4", className: "cfd-dot cfd-dot--loads" })), points.map((point, index) => /* @__PURE__ */ import_react.default.createElement(
    "rect",
    {
      key: point.label,
      x: xOf(index) - slot / 2,
      y: PAD.top,
      width: slot,
      height: innerHeight,
      fill: "transparent",
      onMouseEnter: () => setHover(index),
      onMouseLeave: () => setHover(-1)
    }
  )), ticks.map((tick, index) => /* @__PURE__ */ import_react.default.createElement(
    "text",
    {
      key: `x-${tick.label}`,
      x: tickX(tick.at, index),
      y: HEIGHT - 8,
      className: "cfd-axis-label",
      textAnchor: index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"
    },
    tick.label
  ))), active === null ? null : /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-tooltip", style: { left: `${xOf(hover) / WIDTH * 100}%` } }, /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-tooltip-title" }, active.label), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-tooltip-row" }, /* @__PURE__ */ import_react.default.createElement("i", { className: "cfd-swatch cfd-swatch--area" }), labels.visits, /* @__PURE__ */ import_react.default.createElement("b", null, fmtInt(active.visits))), /* @__PURE__ */ import_react.default.createElement("div", { className: "cfd-tooltip-row" }, /* @__PURE__ */ import_react.default.createElement("i", { className: "cfd-swatch cfd-swatch--line" }), labels.pageLoads, /* @__PURE__ */ import_react.default.createElement("b", null, fmtInt(active.pageLoads))))), typeof note === "string" && note !== "" ? /* @__PURE__ */ import_react.default.createElement("p", { className: "cfd-chart-note" }, note) : null);
}

// src/client/csv.js
var VITALS = [
  ["lcp", "LCP", false],
  ["inp", "INP", false],
  ["cls", "CLS", true],
  ["fcp", "FCP", false],
  ["ttfb", "TTFB", false]
];
var PHASES = [
  ["dns", "DNS"],
  ["connection", "TCP connect"],
  ["tls", "TLS"],
  ["request", "request"],
  ["response", "response"],
  ["render", "render"],
  ["firstPaint", "first paint"],
  ["firstContentfulPaint", "FCP"]
];
var LISTS = ["paths", "referrers", "countries", "browsers", "devices", "os"];
function cell(value) {
  if (value === null || value === void 0) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}
function line(fields) {
  return fields.map(cell).join(",");
}
function ms(micros) {
  if (typeof micros !== "number" || !Number.isFinite(micros)) return "";
  return Math.round(micros / 100) / 10;
}
function ratio(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Math.round(value * 1e3) / 1e3;
}
function count(metric, field) {
  const value = metric?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}
function buildOverviewCsv(data) {
  if (data === null || typeof data !== "object") return "";
  const rows = [line(["section", "key", "metric", "value"])];
  const meta = (metric, value) => rows.push(line(["meta", "", metric, value]));
  meta("site", data.site?.host ?? "");
  meta("site_tag", data.site?.siteTag ?? "");
  meta("range", data.range ?? "");
  meta("bots", data.bots ?? "");
  meta("window_from", data.window?.from ?? "");
  meta("window_to", data.window?.to ?? "");
  meta("generated_at", typeof data.generatedAt === "number" ? new Date(data.generatedAt).toISOString() : "");
  meta("cache_age_ms", typeof data.cacheAgeMs === "number" ? data.cacheAgeMs : "");
  meta("slices", typeof data.slices === "number" ? data.slices : "");
  meta("top_limit", typeof data.topLimit === "number" ? data.topLimit : "");
  meta("quantile_window_from", data.vitals?.window?.from ?? data.performance?.window?.from ?? "");
  meta("quantile_window_to", data.vitals?.window?.to ?? data.performance?.window?.to ?? "");
  for (const [prefix, sampling] of [["sampling_current", data.sampling?.current], ["sampling_previous", data.sampling?.previous]]) {
    if (sampling === void 0 || sampling === null) continue;
    meta(`${prefix}_sampled`, sampling.sampled === true ? "true" : "false");
    meta(`${prefix}_samples`, typeof sampling.samples === "number" ? sampling.samples : "");
    meta(`${prefix}_estimated`, typeof sampling.estimated === "number" ? sampling.estimated : "");
  }
  for (const [prefix, block] of [["vitals", data.vitals], ["performance", data.performance]]) {
    const sampling = block?.sampling;
    if (sampling === void 0 || sampling === null) continue;
    meta(`${prefix}_sampled`, sampling.sampled === true ? "true" : "false");
    meta(`${prefix}_samples`, typeof sampling.samples === "number" ? sampling.samples : "");
    meta(`${prefix}_estimated`, typeof sampling.estimated === "number" ? sampling.estimated : "");
  }
  rows.push(line(["totals", "", "visits", data.totals?.visits ?? 0]));
  rows.push(line(["totals", "", "page_loads", data.totals?.pageLoads ?? 0]));
  rows.push(line(["previous", "", "visits", data.previous?.visits ?? 0]));
  rows.push(line(["previous", "", "page_loads", data.previous?.pageLoads ?? 0]));
  for (const point of Array.isArray(data.series) ? data.series : []) {
    rows.push(line(["series", point.t, "visits", point.visits ?? 0]));
    rows.push(line(["series", point.t, "page_loads", point.pageLoads ?? 0]));
  }
  for (const key of LISTS) {
    const entries = Array.isArray(data.top?.[key]) ? data.top[key] : [];
    for (const entry of entries) {
      const name = entry.name === "" ? "(direct)" : entry.name;
      rows.push(line([`top_${key}`, name, "page_loads", entry.pageLoads ?? 0]));
      rows.push(line([`top_${key}`, name, "visits", entry.visits ?? 0]));
    }
  }
  if (data.vitals !== null && data.vitals !== void 0) {
    for (const [key, label, isRatio] of VITALS) {
      const metric = data.vitals[key];
      if (metric === void 0) continue;
      rows.push(line(["vitals", label, isRatio ? "p75_ratio" : "p75_ms", isRatio ? ratio(metric.p75) : ms(metric.p75)]));
      rows.push(line(["vitals", label, "good", count(metric, "good")]));
      rows.push(line(["vitals", label, "needs_improvement", count(metric, "needs")]));
      rows.push(line(["vitals", label, "poor", count(metric, "poor")]));
      rows.push(line(["vitals", label, "total", count(metric, "total")]));
    }
  }
  if (data.performance !== null && data.performance !== void 0) {
    rows.push(line(["performance", "page_load", "p75_ms", ms(data.performance.pageLoad)]));
    for (const [key, label] of PHASES) {
      rows.push(line(["performance", label, "p75_ms", ms(data.performance.phases?.[key])]));
    }
  }
  return `${rows.join("\n")}
`;
}
function csvFilename(data) {
  const host = String(data?.site?.host ?? "site").replace(/[^a-z0-9.-]+/gi, "_");
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return `cloudflare-${host}-${data?.range ?? "range"}-${stamp}.csv`;
}

// src/client/overview.jsx
var RANGE_OPTIONS = ["24h", "7d", "30d"];
var LIST_PREVIEW = 6;
function dayLabel(iso) {
  if (typeof iso !== "string") return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function spanLabel(window2) {
  return `${dayLabel(window2.from)} \u2192 ${dayLabel(window2.to)}`;
}
function ageText(ms2, t) {
  const seconds = Math.max(0, Math.round((typeof ms2 === "number" && Number.isFinite(ms2) ? ms2 : 0) / 1e3));
  if (seconds < 90) return `${seconds} ${t("unit.secondsAgo")}`;
  return `${Math.round(seconds / 60)} ${t("unit.minutesAgo")}`;
}
function sampledLabel(sampling, t) {
  return `${t("sampling.estimate")} ${fmtInt(sampling.samples)}/${fmtInt(sampling.estimated)}`;
}
function saveCsv(filename, text) {
  const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function Overview({ t, proxy, onOpenSettings }) {
  const [sites, setSites] = (0, import_react2.useState)([]);
  const [siteTag, setSiteTag] = (0, import_react2.useState)("");
  const [range, setRange] = (0, import_react2.useState)("7d");
  const [bots, setBots] = (0, import_react2.useState)("exclude");
  const [data, setData] = (0, import_react2.useState)(null);
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const [error, setError] = (0, import_react2.useState)(null);
  const [sitesError, setSitesError] = (0, import_react2.useState)(null);
  const proxyArgs = proxyQuery(proxy);
  (0, import_react2.useEffect)(() => {
    let cancelled = false;
    const query = proxyArgs === "" ? "" : `?${proxyArgs}`;
    callApi(`sites${query}`).then((payload) => {
      if (cancelled) return;
      const list = Array.isArray(payload.sites) ? payload.sites : [];
      setSites(list);
      if (list.length > 0) setSiteTag(list[0].siteTag);
      else setLoading(false);
    }).catch((loadError) => {
      if (cancelled) return;
      setSitesError(loadError.message);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [proxyArgs]);
  const load = (0, import_react2.useCallback)((fresh = false) => {
    if (siteTag === "") return;
    setLoading(true);
    setError(null);
    const params = [`siteTag=${encodeURIComponent(siteTag)}`, `range=${range}`, `bots=${bots}`];
    if (fresh) params.push("fresh=1");
    if (proxyArgs !== "") params.push(proxyArgs);
    callApi(`overview?${params.join("&")}`).then((payload) => {
      setData(payload);
      setLoading(false);
    }).catch((loadError) => {
      setError(loadError.message);
      setLoading(false);
    });
  }, [siteTag, range, bots, proxyArgs]);
  (0, import_react2.useEffect)(() => {
    load(false);
  }, [load]);
  (0, import_react2.useEffect)(() => {
    if (siteTag === "") return void 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load(false);
    }, 6e4);
    return () => window.clearInterval(timer);
  }, [load, siteTag]);
  const points = (0, import_react2.useMemo)(() => {
    if (data === null) return [];
    const step2 = data.range === "24h" ? "hour" : "day";
    return data.series.map((point) => ({
      t: point.t,
      label: fmtBucket(point.t, step2, false),
      visits: point.visits,
      pageLoads: point.pageLoads
    }));
  }, [data]);
  const step = data?.range === "24h" ? "hour" : "day";
  const spanNote = (0, import_react2.useMemo)(() => {
    if (data === null || data.series.length < 2) return null;
    const first = Date.parse(data.series[0].t);
    const last = Date.parse(data.series[data.series.length - 1].t);
    const from = Date.parse(data.window?.from ?? "");
    const to = Date.parse(data.window?.to ?? "");
    if (![first, last, from, to].every((value) => Number.isFinite(value))) return null;
    if (!(to > from) || !(last > first)) return null;
    if (last - first >= (to - from) * 0.6) return null;
    return `${t("chart.partial")} ${fmtBucket(data.series[0].t, step, false)} \u2192 ${fmtBucket(data.series[data.series.length - 1].t, step, false)}`;
  }, [data, step, t]);
  const site = data?.site ?? sites.find((entry) => entry.siteTag === siteTag);
  const currentSite = site?.siteTag === siteTag ? site : void 0;
  const createdDays = daysSince(currentSite?.created);
  if (sitesError !== null) {
    return /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-page cfd-page--wide" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-empty-card" }, /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-empty-title" }, t("overview.loadFailed")), /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-error" }, sitesError), /* @__PURE__ */ import_react2.default.createElement("button", { className: "cfd-btn", onClick: onOpenSettings }, t("overview.settings"))));
  }
  if (!loading && sites.length === 0) {
    return /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-page cfd-page--wide" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-empty-card" }, /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-empty-title" }, t("overview.noSites")), /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-hint" }, t("overview.noSitesHint")), /* @__PURE__ */ import_react2.default.createElement("button", { className: "cfd-btn", onClick: onOpenSettings }, t("overview.settings"))));
  }
  const totals = data?.totals ?? { visits: 0, pageLoads: 0 };
  const previous = data?.previous ?? { visits: 0, pageLoads: 0 };
  const top = data?.top ?? { paths: [], referrers: [], countries: [], browsers: [], devices: [], os: [] };
  const vitals = data?.vitals ?? null;
  const performance = data?.performance ?? null;
  const visitsDelta = fmtDelta(totals.visits, previous.visits);
  const loadsDelta = fmtDelta(totals.pageLoads, previous.pageLoads);
  const sampling = data?.sampling?.current;
  const sampled = sampling?.sampled === true;
  const previousSampled = data?.sampling?.previous?.sampled === true;
  const offRange = (block) => {
    if (block === null || block.window === void 0 || data === null) return false;
    return block.window.from !== data.window.from || block.window.to !== data.window.to;
  };
  const vitalsPartial = offRange(vitals);
  const performancePartial = offRange(performance);
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-page cfd-page--wide" }, /* @__PURE__ */ import_react2.default.createElement("header", { className: "cfd-topbar" }, /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement("h2", { className: "cfd-title" }, t("overview.title")), /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-sub" }, currentSite === void 0 ? t("overview.loading") : currentSite.host, createdDays === null ? null : /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-sub-note" }, `\xB7 ${t("overview.created")} ${createdDays} ${t("overview.days")}`))), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-toolbar" }, /* @__PURE__ */ import_react2.default.createElement("select", { className: "cfd-select", value: range, onChange: (event) => setRange(event.target.value) }, RANGE_OPTIONS.map((option) => /* @__PURE__ */ import_react2.default.createElement("option", { key: option, value: option }, t(`range.${option}`)))), /* @__PURE__ */ import_react2.default.createElement(
    "select",
    {
      className: "cfd-select",
      value: siteTag,
      onChange: (event) => setSiteTag(event.target.value)
    },
    sites.map((entry) => /* @__PURE__ */ import_react2.default.createElement("option", { key: entry.siteTag, value: entry.siteTag }, entry.host))
  ), /* @__PURE__ */ import_react2.default.createElement("label", { className: "cfd-check" }, /* @__PURE__ */ import_react2.default.createElement(
    "input",
    {
      type: "checkbox",
      checked: bots === "all",
      onChange: (event) => setBots(event.target.checked ? "all" : "exclude")
    }
  ), t("overview.bots")), /* @__PURE__ */ import_react2.default.createElement("button", { className: "cfd-btn", disabled: loading, onClick: () => load(true) }, loading ? t("overview.refreshing") : t("overview.refresh")), /* @__PURE__ */ import_react2.default.createElement(
    "button",
    {
      className: "cfd-btn",
      disabled: data === null,
      onClick: () => saveCsv(csvFilename(data), buildOverviewCsv(data))
    },
    t("action.export")
  ), /* @__PURE__ */ import_react2.default.createElement("button", { className: "cfd-btn", onClick: onOpenSettings }, t("overview.settings")))), error === null ? null : /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-error" }, error), /* @__PURE__ */ import_react2.default.createElement("section", { className: "cfd-kpi-row" }, /* @__PURE__ */ import_react2.default.createElement(
    KpiCard,
    {
      label: t("kpi.visits"),
      value: fmtInt(totals.visits),
      delta: visitsDelta,
      deltaLabel: t("kpi.previous")
    }
  ), /* @__PURE__ */ import_react2.default.createElement(
    KpiCard,
    {
      label: t("kpi.pageLoads"),
      value: fmtInt(totals.pageLoads),
      delta: loadsDelta,
      deltaLabel: t("kpi.previous")
    }
  ), /* @__PURE__ */ import_react2.default.createElement(
    KpiCard,
    {
      label: t("kpi.countries"),
      value: fmtInt(top.countries.length),
      hint: top.countries[0] === void 0 ? t("kpi.noData") : top.countries[0].name
    }
  ), /* @__PURE__ */ import_react2.default.createElement(
    KpiCard,
    {
      label: t("kpi.referrers"),
      value: fmtInt(top.referrers.filter((row) => row.name !== "").length),
      hint: t("kpi.referrersHint")
    }
  )), sampled || previousSampled ? /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-notice" }, sampled ? /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, t("sampling.warning"), ` \xB7 ${t("sampling.samples")} ${fmtInt(sampling.samples)} / ${t("sampling.estimated")} ${fmtInt(sampling.estimated)}`) : null, sampled && previousSampled ? " \xB7 " : "", previousSampled ? t("sampling.previousNote") : "") : null, /* @__PURE__ */ import_react2.default.createElement("section", { className: "cfd-card" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-card-head" }, /* @__PURE__ */ import_react2.default.createElement("h3", { className: "cfd-card-title" }, t("chart.title")), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-card-sub" }, t("chart.sub"))), /* @__PURE__ */ import_react2.default.createElement(
    TrendChart,
    {
      points,
      step,
      note: spanNote,
      labels: { visits: t("chart.visits"), pageLoads: t("chart.pageLoads"), empty: t("chart.empty") }
    }
  )), /* @__PURE__ */ import_react2.default.createElement("section", { className: "cfd-grid-2" }, /* @__PURE__ */ import_react2.default.createElement(ListCard, { title: t("list.paths"), rows: top.paths, t }), /* @__PURE__ */ import_react2.default.createElement(ListCard, { title: t("list.referrers"), rows: top.referrers, t, directLabel: t("list.direct") }), /* @__PURE__ */ import_react2.default.createElement(ListCard, { title: t("list.countries"), rows: top.countries, t }), /* @__PURE__ */ import_react2.default.createElement(ListCard, { title: t("list.browsers"), rows: top.browsers, t }), /* @__PURE__ */ import_react2.default.createElement(ListCard, { title: t("list.devices"), rows: top.devices, t }), /* @__PURE__ */ import_react2.default.createElement(ListCard, { title: t("list.os"), rows: top.os, t })), /* @__PURE__ */ import_react2.default.createElement("section", { className: "cfd-card" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-card-head" }, /* @__PURE__ */ import_react2.default.createElement("h3", { className: "cfd-card-title" }, t("vitals.title")), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-card-sub" }, t("vitals.sub"), vitalsPartial ? ` \xB7 ${t("window.label")} ${spanLabel(vitals.window)}` : "", vitals?.sampling?.sampled === true ? ` \xB7 ${sampledLabel(vitals.sampling, t)}` : "")), vitals === null ? /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-hint" }, t("vitals.empty")) : /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vitals" }, /* @__PURE__ */ import_react2.default.createElement(VitalTile, { label: "LCP", value: fmtDuration(vitals.lcp.p75), metric: vitals.lcp, t }), /* @__PURE__ */ import_react2.default.createElement(VitalTile, { label: "INP", value: fmtDuration(vitals.inp.p75), metric: vitals.inp, t }), /* @__PURE__ */ import_react2.default.createElement(VitalTile, { label: "CLS", value: fmtRatio(vitals.cls.p75), metric: vitals.cls, t }), /* @__PURE__ */ import_react2.default.createElement(VitalTile, { label: "FCP", value: fmtDuration(vitals.fcp.p75), metric: vitals.fcp, t }), /* @__PURE__ */ import_react2.default.createElement(VitalTile, { label: "TTFB", value: fmtDuration(vitals.ttfb.p75), metric: vitals.ttfb, t })), /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-foot" }, t("vitals.note"), vitalsPartial ? ` ${t("vitals.note.partial")}` : "")), /* @__PURE__ */ import_react2.default.createElement("section", { className: "cfd-card" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-card-head" }, /* @__PURE__ */ import_react2.default.createElement("h3", { className: "cfd-card-title" }, t("perf.title")), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-card-sub" }, t("perf.sub"), performancePartial ? ` \xB7 ${t("window.label")} ${spanLabel(performance.window)}` : "", performance?.sampling?.sampled === true ? ` \xB7 ${sampledLabel(performance.sampling, t)}` : "")), /* @__PURE__ */ import_react2.default.createElement(PerformanceCard, { performance, t, partial: performancePartial })), /* @__PURE__ */ import_react2.default.createElement("footer", { className: "cfd-foot" }, t("overview.footer"), ` \xB7 ${bots === "all" ? t("overview.footer.botsIncluded") : t("overview.footer.botsExcluded")}`, data === null ? "" : ` \xB7 ${new Date(data.generatedAt).toLocaleTimeString()}`, data === null || data.slices < 2 ? "" : ` \xB7 ${data.slices} ${t("overview.slices")}`, data === null ? "" : data.cached === true ? ` \xB7 ${t("overview.cached")} \xB7 ${ageText(data.cacheAgeMs, t)}` : ` \xB7 ${t("overview.justNow")}`));
}
function KpiCard({ label, value, delta, deltaLabel, hint }) {
  const hasDelta = delta !== void 0;
  const deltaText = delta === void 0 ? "" : delta.pct === null ? "\u2014" : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(1)}%`;
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-kpi" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-kpi-label" }, label), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-kpi-value" }, value), hasDelta ? /* @__PURE__ */ import_react2.default.createElement("div", { className: `cfd-kpi-delta cfd-kpi-delta--${delta.dir}` }, delta.dir === "up" ? "\u25B2" : delta.dir === "down" ? "\u25BC" : "\u2022", " ", deltaText, /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-kpi-delta-note" }, deltaLabel)) : /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-kpi-hint" }, hint ?? ""));
}
function ListCard({ title, rows, t, directLabel }) {
  const [expanded, setExpanded] = (0, import_react2.useState)(false);
  const visible = expanded ? rows : rows.slice(0, LIST_PREVIEW);
  const max = Math.max(1, ...rows.map((row) => row.pageLoads));
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-card" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-card-head" }, /* @__PURE__ */ import_react2.default.createElement("h3", { className: "cfd-card-title" }, title), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-card-sub" }, t("list.count"))), visible.length === 0 ? /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-hint" }, t("list.empty")) : /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement("ul", { className: "cfd-list" }, visible.map((row) => {
    const name = row.name === "" ? directLabel ?? t("list.direct") : row.name;
    return /* @__PURE__ */ import_react2.default.createElement("li", { className: "cfd-list-row", key: `${name}-${row.name === "" ? "direct" : ""}` }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-list-head" }, /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-list-name", title: name }, name), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-list-value" }, fmtInt(row.pageLoads))), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-bar" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-bar-fill", style: { width: `${Math.max(3, row.pageLoads / max * 100)}%` } })), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-list-sub" }, fmtInt(row.visits), " ", t("list.visits")));
  })), rows.length <= LIST_PREVIEW ? null : /* @__PURE__ */ import_react2.default.createElement("button", { type: "button", className: "cfd-list-more", onClick: () => setExpanded((value) => !value) }, expanded ? t("list.collapse") : `${t("list.expand")} \xB7 ${rows.length}`)));
}
function VitalTile({ label, value, metric, t }) {
  const total = Math.max(metric.total, metric.good + metric.needs + metric.poor);
  const share = (count2) => total === 0 ? 0 : count2 / total * 100;
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vital" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vital-head" }, /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-vital-name" }, label), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-vital-value" }, value)), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vital-bar" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vital-good", style: { width: `${share(metric.good)}%` } }), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vital-needs", style: { width: `${share(metric.needs)}%` } }), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vital-poor", style: { width: `${share(metric.poor)}%` } })), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-vital-foot" }, total === 0 ? t("vitals.noSamples") : `${Math.round(share(metric.good))}% ${t("vitals.good")} \xB7 ${fmtInt(total)} ${t("vitals.samples")}`));
}
function PerformanceCard({ performance, t, partial }) {
  if (performance === null) return /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-hint" }, t("perf.empty"));
  const phases = [
    ["dns", t("perf.dns")],
    ["connection", t("perf.connection")],
    ["tls", t("perf.tls")],
    ["request", t("perf.request")],
    ["response", t("perf.response")],
    ["render", t("perf.render")],
    ["firstPaint", t("perf.firstPaint")],
    ["firstContentfulPaint", t("perf.fcp")]
  ];
  const max = Math.max(performance.pageLoad ?? 0, ...phases.map(([key]) => performance.phases[key] ?? 0), 1);
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-perf" }, /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-perf-total" }, /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-perf-total-label" }, t("perf.total")), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-perf-total-value" }, fmtDuration(performance.pageLoad))), /* @__PURE__ */ import_react2.default.createElement("ul", { className: "cfd-perf-list" }, phases.map(([key, label]) => /* @__PURE__ */ import_react2.default.createElement("li", { className: "cfd-perf-row", key }, /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-perf-name" }, label), /* @__PURE__ */ import_react2.default.createElement("div", { className: "cfd-perf-bar" }, /* @__PURE__ */ import_react2.default.createElement(
    "div",
    {
      className: "cfd-perf-fill",
      style: { width: `${Math.max(2, (performance.phases[key] ?? 0) / max * 100)}%` }
    }
  )), /* @__PURE__ */ import_react2.default.createElement("span", { className: "cfd-perf-value" }, fmtDuration(performance.phases[key]))))), /* @__PURE__ */ import_react2.default.createElement("p", { className: "cfd-foot" }, t("perf.note"), partial === true ? ` ${t("perf.note.partial")}` : ""));
}

// src/client/settings.jsx
var import_react3 = __toESM(require("react"), 1);
function suspiciousToken(value) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (/^cfat[-_]/i.test(trimmed)) return "account-token";
  if (/^[0-9a-f]{32}$/i.test(trimmed)) return "token-id";
  if (/^[0-9a-f]{37}$/i.test(trimmed)) return "global-key";
  if (trimmed.length !== 40) return "bad-length";
  return null;
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
function SettingsView({ t, status, onStatus, onClose }) {
  const [token, setToken] = (0, import_react3.useState)("");
  const [accountId, setAccountId] = (0, import_react3.useState)(typeof status?.accountId === "string" ? status.accountId : "");
  const [proxyEnabled, setProxyEnabled] = (0, import_react3.useState)(() => readProxyPrefs().enabled);
  const [proxyUrl, setProxyUrl] = (0, import_react3.useState)(() => readProxyPrefs().url || DEFAULT_PROXY_URL);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [verifying, setVerifying] = (0, import_react3.useState)(false);
  const [probing, setProbing] = (0, import_react3.useState)(false);
  const [replacing, setReplacing] = (0, import_react3.useState)(false);
  const [notice, setNotice] = (0, import_react3.useState)(null);
  const [probeResult, setProbeResult] = (0, import_react3.useState)(null);
  const configured = status?.configured === true;
  const showTokenForm = !configured || replacing;
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
  async function save() {
    const value = token.trim();
    if (value === "") {
      setNotice({ kind: "error", text: t("step.token.placeholder") });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const payload = await callApi("token", {
        method: "POST",
        body: { token: value, accountId: accountId.trim(), proxy: proxy() }
      });
      onStatus(payload);
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
  async function remove() {
    setBusy(true);
    setNotice(null);
    try {
      const payload = await callApi("token", { method: "DELETE" });
      onStatus(payload);
      setNotice({ kind: "ok", text: t("msg.deleted") });
    } catch (error) {
      setNotice({ kind: "error", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }
  async function revalidate() {
    setVerifying(true);
    setNotice(null);
    try {
      const payload = await callApi("status?verify=1");
      onStatus(payload);
      if (typeof payload?.accessError === "string") {
        setNotice({ kind: "error", text: payload.accessError });
      } else {
        setNotice({ kind: "ok", text: t("msg.verified") });
      }
    } catch (error) {
      setNotice({ kind: "error", text: describeError(error) });
    } finally {
      setVerifying(false);
    }
  }
  async function runProbe() {
    setProbing(true);
    setNotice(null);
    try {
      const payload = await callApi("probe", { method: "POST", body: { proxy: proxy() } });
      setProbeResult(payload);
      writeProxyPrefs(proxy());
    } catch (error) {
      setNotice({ kind: "error", text: describeError(error) });
    } finally {
      setProbing(false);
    }
  }
  const suspicious = suspiciousToken(token);
  const verifiedAt = formatTime(status?.verifiedAt);
  return /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-page" }, /* @__PURE__ */ import_react3.default.createElement("header", { className: "cfd-topbar" }, /* @__PURE__ */ import_react3.default.createElement("div", null, /* @__PURE__ */ import_react3.default.createElement("h2", { className: "cfd-title" }, t("title")), /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-sub" }, t("subtitle"))), onClose === void 0 ? null : /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-toolbar" }, /* @__PURE__ */ import_react3.default.createElement("button", { className: "cfd-btn", onClick: onClose }, t("settings.back")))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-card" }, configured && !replacing ? /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-meta" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-value cfd-metric-value--small" }, status.masked ?? "\u2014"), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-label" }, t("status.masked"))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-value" }, typeof status.accounts === "number" ? status.accounts : "\u2014"), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-label" }, t("status.accounts"))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-value" }, typeof status.rumSites === "number" ? status.rumSites : "\u2014"), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-label" }, t("status.sites"))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-value cfd-metric-value--small" }, verifiedAt ?? t("status.neverVerified"), status.verifiedStale === true ? ` \xB7 ${t("status.stale")}` : ""), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-metric-label" }, t("status.verified")))), /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-hint" }, status.source === "environment" ? t("status.source.environment") : t("status.source.stored"), typeof status.accountId === "string" ? ` \xB7 Account ID: ${status.accountId}` : ""), typeof status.accessError === "string" ? /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-hint cfd-warn" }, status.accessError) : null, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-actions" }, /* @__PURE__ */ import_react3.default.createElement("button", { className: "cfd-btn", disabled: busy || verifying, onClick: () => void revalidate() }, verifying ? t("action.verifying") : t("action.verify")), /* @__PURE__ */ import_react3.default.createElement("button", { className: "cfd-btn", disabled: busy || verifying, onClick: () => setReplacing(true) }, t("action.replace")), /* @__PURE__ */ import_react3.default.createElement("button", { className: "cfd-btn", disabled: busy || verifying, onClick: () => void remove() }, t("action.delete")))) : null, showTokenForm ? /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-step" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-label" }, t("step.token.title")), /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-desc" }, t("step.token.desc"), " ", /* @__PURE__ */ import_react3.default.createElement("span", { className: "cfd-desc" }, t("perm.list"))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-row" }, /* @__PURE__ */ import_react3.default.createElement(
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
        if (event.key === "Enter") void save();
      }
    }
  ), /* @__PURE__ */ import_react3.default.createElement("button", { className: "cfd-btn cfd-btn--primary", disabled: busy, onClick: () => void save() }, busy ? t("step.token.saving") : t("step.token.save"))), suspicious === null ? null : /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-hint cfd-warn" }, suspicious === "token-id" ? t("warn.tokenId") : suspicious === "global-key" ? t("warn.globalKey") : suspicious === "account-token" ? t("warn.accountToken") : t("warn.tokenLength")), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-row", style: { marginTop: "10px" } }, /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      className: "cfd-input",
      type: "text",
      autoComplete: "off",
      spellCheck: false,
      placeholder: t("placeholder.accountId"),
      value: accountId,
      onChange: (event) => setAccountId(event.target.value)
    }
  )), /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-hint" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "cfd-desc" }, t("label.accountId")), " ", t("hint.accountId")), /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-hint" }, /* @__PURE__ */ import_react3.default.createElement("a", { className: "cfd-link", href: "https://dash.cloudflare.com/profile/api-tokens", target: "_blank", rel: "noreferrer" }, t("step.token.console")))) : null, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-step" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-label" }, t("step.proxy.title")), /* @__PURE__ */ import_react3.default.createElement("label", { className: "cfd-check" }, /* @__PURE__ */ import_react3.default.createElement(
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
  ), t("step.proxy.toggle")), /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-row", style: { marginTop: "10px" } }, /* @__PURE__ */ import_react3.default.createElement(
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
  ), /* @__PURE__ */ import_react3.default.createElement("button", { className: "cfd-btn", disabled: probing, onClick: () => void runProbe() }, probing ? t("action.probing") : t("action.probe"))), /* @__PURE__ */ import_react3.default.createElement("p", { className: "cfd-hint" }, t("step.proxy.hint"))), notice === null ? null : /* @__PURE__ */ import_react3.default.createElement("p", { className: notice.kind === "ok" ? "cfd-hint cfd-ok" : "cfd-error" }, notice.text), probeResult === null ? null : /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-probe" }, [
    ["direct", probeResult.direct, t("probe.direct")],
    ["proxied", probeResult.proxied, t("probe.proxied")]
  ].filter(([, value]) => value !== void 0 && value !== null).map(([key, value, label]) => /* @__PURE__ */ import_react3.default.createElement("div", { className: "cfd-probe-row", key }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "cfd-probe-name" }, label), /* @__PURE__ */ import_react3.default.createElement("span", null, value.ok ? t("probe.ok") : t("probe.fail")), value.ok ? /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("span", null, "DNS ", formatMs(value.timings?.dnsMs)), /* @__PURE__ */ import_react3.default.createElement("span", null, "TLS ", formatMs(value.timings?.tlsMs)), /* @__PURE__ */ import_react3.default.createElement("span", null, "TTFB ", formatMs(value.timings?.ttfbMs)), /* @__PURE__ */ import_react3.default.createElement("span", null, "Total ", formatMs(value.timings?.totalMs))) : /* @__PURE__ */ import_react3.default.createElement("span", null, `${value.error?.code ?? "network"} \xB7 ${value.error?.message ?? ""}`))))));
}

// src/client/app.jsx
function Panel({ t }) {
  const [phase, setPhase] = (0, import_react4.useState)("loading");
  const [status, setStatus] = (0, import_react4.useState)(null);
  const [showSettings, setShowSettings] = (0, import_react4.useState)(false);
  const [proxy, setProxy] = (0, import_react4.useState)(() => readProxyPrefs());
  (0, import_react4.useEffect)(() => {
    let cancelled = false;
    callApi("status").then((payload) => {
      if (cancelled) return;
      setStatus(payload);
      setPhase("ready");
      if (payload.configured !== true) setShowSettings(true);
    }).catch(() => {
      if (cancelled) return;
      setStatus({ configured: false });
      setPhase("ready");
      setShowSettings(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (phase === "loading") {
    return /* @__PURE__ */ import_react4.default.createElement("div", { className: "cfd-page" }, /* @__PURE__ */ import_react4.default.createElement("p", { className: "cfd-hint" }, t("loading")));
  }
  const configured = status?.configured === true;
  if (!configured || showSettings) {
    return /* @__PURE__ */ import_react4.default.createElement(
      SettingsView,
      {
        t,
        status,
        onStatus: (next) => {
          setStatus(next);
          if (next.configured !== true) setShowSettings(true);
        },
        ...configured ? {
          onClose: () => {
            setProxy(readProxyPrefs());
            setShowSettings(false);
          }
        } : {}
      }
    );
  }
  return /* @__PURE__ */ import_react4.default.createElement(Overview, { t, proxy, onOpenSettings: () => setShowSettings(true) });
}
function PanelIcon({ size = 20, active = false }) {
  return /* @__PURE__ */ import_react4.default.createElement(
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
    /* @__PURE__ */ import_react4.default.createElement("rect", { x: "3.5", y: "13", width: "3.4", height: "7.5", rx: "1.7", fill: "currentColor", opacity: "0.75" }),
    /* @__PURE__ */ import_react4.default.createElement("rect", { x: "10.3", y: "8.5", width: "3.4", height: "12", rx: "1.7", fill: "currentColor", opacity: "0.88" }),
    /* @__PURE__ */ import_react4.default.createElement("rect", { x: "17.1", y: "3.8", width: "3.4", height: "16.7", rx: "1.7", fill: "currentColor" })
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
  "label.accountId": "Account ID\uFF08\u300C\u5E10\u6237 API \u4EE4\u724C\u300D\u5FC5\u586B\uFF09",
  "placeholder.accountId": "32 \u4F4D\u5341\u516D\u8FDB\u5236\uFF0C\u4F8B\u5982 023e105f\u2026",
  "hint.accountId": "\u7528\u6237\u7EA7\u4EE4\u724C\uFF08Profile \u2192 API Tokens\uFF09\u53EF\u7559\u7A7A\uFF1B\u5E10\u6237\u7EA7\u4EE4\u724C\u5FC5\u987B\u586B\u5199\uFF0CAccount ID \u5728 Cloudflare \u540E\u53F0\u6982\u89C8\u9875\u7684 URL \u91CC\u3002",
  "step.token.save": "\u9A8C\u8BC1\u5E76\u4FDD\u5B58",
  "step.token.saving": "\u6B63\u5728\u9A8C\u8BC1\u2026",
  "step.proxy.title": "2. \u7F51\u7EDC\u4E0E\u4EE3\u7406\uFF08\u53EF\u9009\uFF09",
  "step.proxy.toggle": "\u901A\u8FC7 HTTP \u4EE3\u7406\u8BBF\u95EE Cloudflare",
  "step.proxy.placeholder": "http://127.0.0.1:7890",
  "step.proxy.hint": "\u4EC5\u652F\u6301 http://host:port \u7684 CONNECT \u4EE3\u7406\uFF1B\u4E0D\u586B\u5219\u76F4\u8FDE\u3002",
  "action.probe": "\u7F51\u7EDC\u8BCA\u65AD",
  "action.probing": "\u8BCA\u65AD\u4E2D\u2026",
  "action.export": "\u5BFC\u51FA CSV",
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
  "status.stale": "\u4E0A\u6B21\u9A8C\u8BC1",
  "action.verifying": "\u9A8C\u8BC1\u4E2D\u2026",
  "msg.verified": "\u9A8C\u8BC1\u901A\u8FC7\uFF0C\u8D26\u6237\u4E0E\u7AD9\u70B9\u6570\u91CF\u5DF2\u66F4\u65B0",
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
  "warn.accountToken": "\u8FD9\u662F\u300C\u5E10\u6237 API \u4EE4\u724C\u300D\uFF0C\u5FC5\u987B\u586B\u5199 Account ID \u624D\u80FD\u6821\u9A8C",
  "warn.tokenLength": "\u7528\u6237 API Token \u901A\u5E38\u662F 40 \u4F4D\u5B57\u7B26\uFF0C\u5F53\u524D\u957F\u5EA6\u4E0D\u5BF9\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u590D\u5236\u5B8C\u6574",
  "hint.unauthorized": "\u8BF7\u786E\u8BA4\uFF1A\u2460 \u590D\u5236\u7684\u662F\u521B\u5EFA\u5B8C\u6210\u65F6\u663E\u793A\u7684 Token \u503C\uFF0C\u4E0D\u662F Token ID\uFF1B\u2461 \u521B\u5EFA\u6D41\u7A0B\u5DF2\u8D70\u5B8C Continue to summary \u2192 Create Token\uFF1B\u2462 \u6CA1\u6709\u4F7F\u7528 Global API Key\u3002",
  "overview.title": "Web Analytics",
  "overview.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "overview.created": "\u5DF2\u521B\u5EFA",
  "overview.days": "\u5929",
  "overview.refresh": "\u5237\u65B0",
  "overview.refreshing": "\u5237\u65B0\u4E2D\u2026",
  "overview.settings": "\u8BBE\u7F6E",
  "overview.noSites": "\u6CA1\u6709\u53EF\u7528\u7684 Web Analytics \u7AD9\u70B9",
  "overview.noSitesHint": "\u8BF7\u786E\u8BA4\u8D26\u53F7\u5DF2\u5728 Cloudflare \u542F\u7528 Web Analytics\uFF0C\u5E76\u8BA9 Token \u5177\u5907 Account Settings:Read \u6743\u9650\u3002",
  "overview.loadFailed": "\u65E0\u6CD5\u8BFB\u53D6\u7AD9\u70B9\u5217\u8868",
  "overview.footer": "\u6570\u636E\u6765\u81EA Cloudflare Web Analytics\uFF08RUM\uFF09\xB7 \u4E0D\u542B\u5E26\u5BBD/\u6D41\u91CF\u5B57\u8282",
  "overview.footer.botsExcluded": "\u5DF2\u6392\u9664 bot \u6D41\u91CF",
  "overview.footer.botsIncluded": "\u542B bot \u6D41\u91CF\uFF08Core Web Vitals \u4E0E\u52A0\u8F7D\u6027\u80FD\u4ECD\u6392\u9664\uFF09",
  "overview.bots": "\u542B bot \u6D41\u91CF",
  "range.24h": "\u8FD1 24 \u5C0F\u65F6",
  "range.7d": "\u8FD1 7 \u5929",
  "range.30d": "\u8FD1 30 \u5929",
  "kpi.visits": "\u8BBF\u95EE\u6570",
  "kpi.pageLoads": "\u9875\u9762\u52A0\u8F7D",
  "kpi.countries": "\u56FD\u5BB6/\u5730\u533A",
  "kpi.referrers": "\u5916\u90E8\u6765\u6E90",
  "kpi.referrersHint": "\u4E0D\u542B\u76F4\u63A5\u8BBF\u95EE",
  "kpi.noData": "\u6682\u65E0\u6570\u636E",
  "kpi.previous": "\u5BF9\u6BD4\u4E0A\u4E00\u5468\u671F",
  "chart.title": "\u8BBF\u95EE\u8D8B\u52BF",
  "chart.sub": "\u6309\u672C\u5730\u65F6\u533A\u5C55\u793A",
  "chart.visits": "\u8BBF\u95EE\u6570",
  "chart.pageLoads": "\u9875\u9762\u52A0\u8F7D",
  "chart.empty": "\u6240\u9009\u65F6\u95F4\u6BB5\u6CA1\u6709\u6570\u636E",
  "chart.partial": "\u8BE5\u8303\u56F4\u4EC5\u4EE5\u4E0B\u65F6\u6BB5\u6709\u6570\u636E\uFF08\u56FE\u8868\u6309\u5B9E\u9645\u8DE8\u5EA6\u7F29\u653E\uFF09\uFF1A",
  "list.paths": "\u70ED\u95E8\u9875\u9762",
  "list.referrers": "\u6765\u6E90",
  "list.countries": "\u56FD\u5BB6/\u5730\u533A",
  "list.browsers": "\u6D4F\u89C8\u5668",
  "list.devices": "\u8BBE\u5907\u7C7B\u578B",
  "list.os": "\u64CD\u4F5C\u7CFB\u7EDF",
  "list.direct": "\u76F4\u63A5\u8BBF\u95EE",
  "list.visits": "\u6B21\u8BBF\u95EE",
  "list.count": "\u6309\u9875\u9762\u52A0\u8F7D\u6392\u5E8F",
  "list.empty": "\u6682\u65E0\u6570\u636E",
  "list.expand": "\u5C55\u5F00\u5168\u90E8",
  "list.collapse": "\u6536\u8D77",
  "vitals.title": "Core Web Vitals",
  "vitals.sub": "P75 \u5206\u4F4D\u6570",
  "vitals.empty": "\u6682\u65E0\u6027\u80FD\u91C7\u6837\u6570\u636E",
  "vitals.note": "\u6570\u503C\u4E3A P75 \u5206\u4F4D\u6570\uFF1B\u7EFF/\u9EC4/\u7EA2\u5206\u522B\u8868\u793A\u826F\u597D/\u9700\u6539\u8FDB/\u8F83\u5DEE\u7684\u6837\u672C\u5360\u6BD4\u3002",
  "vitals.good": "\u826F\u597D",
  "vitals.samples": "\u4E2A\u6837\u672C",
  "vitals.noSamples": "\u65E0\u6837\u672C",
  "vitals.note.partial": "\u5206\u4F4D\u6570\u4E0D\u53EF\u8DE8\u65F6\u95F4\u7A97\u76F8\u52A0\uFF0C\u957F\u8303\u56F4\u4E0B\u5C55\u793A\u6700\u8FD1\u4E00\u6BB5\u6709\u6837\u672C\u7684\u7A97\u53E3\u3002",
  "settings.back": "\u8FD4\u56DE\u770B\u677F",
  "overview.cached": "\u7F13\u5B58",
  "overview.justNow": "\u521A\u521A\u66F4\u65B0",
  "overview.slices": "\u6BB5\u5207\u7247\u67E5\u8BE2",
  "unit.secondsAgo": "\u79D2\u524D",
  "unit.minutesAgo": "\u5206\u949F\u524D",
  "window.label": "\u7A97\u53E3",
  "sampling.warning": "\u8BE5\u8303\u56F4\u542B Cloudflare \u91C7\u6837\u4F30\u7B97\uFF1A\u90E8\u5206\u9875\u9762\u52A0\u8F7D\u6570\u662F\u63A8\u7B97\u503C",
  "sampling.samples": "\u5B9E\u9645\u6837\u672C",
  "sampling.estimated": "\u4F30\u7B97\u9875\u9762\u52A0\u8F7D",
  "sampling.estimate": "\u91C7\u6837\u4F30\u8BA1",
  "sampling.previousNote": "\u73AF\u6BD4\u57FA\u4E8E\u91C7\u6837\u4F30\u7B97\u503C\uFF0C\u4EC5\u4F9B\u65B9\u5411\u53C2\u8003",
  "perf.title": "\u52A0\u8F7D\u6027\u80FD",
  "perf.sub": "P75 \u5206\u4F4D\u6570",
  "perf.total": "\u9875\u9762\u52A0\u8F7D\u603B\u65F6\u957F",
  "perf.empty": "\u6682\u65E0\u6027\u80FD\u6570\u636E",
  "perf.note": "\u5404\u9636\u6BB5\u4E3A\u8BE5\u65F6\u95F4\u7A97\u5185\u7684 P75 \u5206\u4F4D\u6570\uFF1B\u5355\u4F4D\u4E3A\u6BEB\u79D2\uFF08\u8D85\u8FC7 1 \u79D2\u663E\u793A\u4E3A\u79D2\uFF09\u3002",
  "perf.note.partial": "\u957F\u8303\u56F4\u4E0B\u9636\u6BB5\u6570\u636E\u540C\u6837\u53D6\u6700\u8FD1\u4E00\u6BB5\u6709\u6837\u672C\u7684\u7A97\u53E3\u3002",
  "perf.dns": "DNS \u89E3\u6790",
  "perf.connection": "TCP \u8FDE\u63A5",
  "perf.tls": "TLS \u63E1\u624B",
  "perf.request": "\u8BF7\u6C42\u53D1\u9001",
  "perf.response": "\u54CD\u5E94\u7B49\u5F85",
  "perf.render": "\u9875\u9762\u6E32\u67D3",
  "perf.firstPaint": "\u9996\u6B21\u7ED8\u5236",
  "perf.fcp": "\u9996\u6B21\u5185\u5BB9\u7ED8\u5236"
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
  "label.accountId": "Account ID (required for account API tokens)",
  "placeholder.accountId": "32 hex characters, e.g. 023e105f\u2026",
  "hint.accountId": "Leave empty for a user token (Profile \u2192 API Tokens). An account API token requires it; find the Account ID in the dashboard overview URL.",
  "step.token.save": "Verify and save",
  "step.token.saving": "Verifying\u2026",
  "step.proxy.title": "2. Network and proxy (optional)",
  "step.proxy.toggle": "Reach Cloudflare through an HTTP proxy",
  "step.proxy.placeholder": "http://127.0.0.1:7890",
  "step.proxy.hint": "Accepts an http://host:port CONNECT proxy only; leave empty to connect directly.",
  "action.probe": "Run diagnostics",
  "action.probing": "Measuring\u2026",
  "action.export": "Export CSV",
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
  "status.stale": "from the last run",
  "action.verifying": "Verifying\u2026",
  "msg.verified": "Verification passed; account and site counts updated",
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
  "warn.accountToken": "This is an account API token; fill in its Account ID to verify it",
  "warn.tokenLength": "A user API token is normally 40 characters; check that the whole value was copied",
  "hint.unauthorized": "Check that you copied the token value shown after creation (not the token ID), that the create flow finished with Continue to summary \u2192 Create Token, and that you did not paste the Global API Key.",
  "overview.title": "Web Analytics",
  "overview.loading": "Loading\u2026",
  "overview.created": "created",
  "overview.days": "days ago",
  "overview.refresh": "Refresh",
  "overview.refreshing": "Refreshing\u2026",
  "overview.settings": "Settings",
  "overview.noSites": "No Web Analytics site is available",
  "overview.noSitesHint": "Confirm that Web Analytics is enabled for the account and that the token has Account Settings:Read.",
  "overview.loadFailed": "Could not read the site list",
  "overview.footer": "Data from Cloudflare Web Analytics (RUM) \xB7 bandwidth bytes are not included",
  "overview.footer.botsExcluded": "bot traffic excluded",
  "overview.footer.botsIncluded": "bot traffic included (Core Web Vitals and loading phases still exclude it)",
  "overview.bots": "Include bots",
  "range.24h": "Last 24 hours",
  "range.7d": "Last 7 days",
  "range.30d": "Last 30 days",
  "kpi.visits": "Visits",
  "kpi.pageLoads": "Page loads",
  "kpi.countries": "Countries",
  "kpi.referrers": "External referrers",
  "kpi.referrersHint": "Direct traffic excluded",
  "kpi.noData": "No data",
  "kpi.previous": "vs previous period",
  "chart.title": "Traffic trend",
  "chart.sub": "Shown in your local time zone",
  "chart.visits": "Visits",
  "chart.pageLoads": "Page loads",
  "chart.empty": "No data in the selected range",
  "chart.partial": "Only part of the range has data (the chart zooms to it):",
  "list.paths": "Top pages",
  "list.referrers": "Referrers",
  "list.countries": "Countries",
  "list.browsers": "Browsers",
  "list.devices": "Device type",
  "list.os": "Operating system",
  "list.direct": "Direct",
  "list.visits": "visits",
  "list.count": "By page loads",
  "list.empty": "No data",
  "list.expand": "Show all",
  "list.collapse": "Show less",
  "vitals.title": "Core Web Vitals",
  "vitals.sub": "P75 quantiles",
  "vitals.empty": "No performance samples yet",
  "vitals.note": "Values are P75 quantiles; green/yellow/red are the good/needs-improvement/poor sample shares.",
  "vitals.good": "good",
  "vitals.samples": "samples",
  "vitals.noSamples": "No samples",
  "vitals.note.partial": "A P75 cannot be summed across windows, so a long range shows the newest window that has samples.",
  "settings.back": "Back to dashboard",
  "overview.cached": "cached",
  "overview.justNow": "just updated",
  "overview.slices": "slices",
  "unit.secondsAgo": "s ago",
  "unit.minutesAgo": "min ago",
  "window.label": "window",
  "sampling.warning": "This range includes Cloudflare sampling estimates: some page loads are extrapolated",
  "sampling.samples": "samples",
  "sampling.estimated": "estimated page loads",
  "sampling.estimate": "sampled",
  "sampling.previousNote": "the previous period is a sampling estimate, so treat the delta as directional",
  "perf.title": "Loading performance",
  "perf.sub": "P75 quantiles",
  "perf.total": "Total page load",
  "perf.empty": "No performance data yet",
  "perf.note": "Each phase is the P75 quantile for this window; durations are converted to milliseconds (seconds above 1s).",
  "perf.note.partial": "On a long range the phases also come from the newest window that has samples.",
  "perf.dns": "DNS",
  "perf.connection": "TCP connect",
  "perf.tls": "TLS handshake",
  "perf.request": "Request sent",
  "perf.response": "Waiting for response",
  "perf.render": "Page render",
  "perf.firstPaint": "First paint",
  "perf.fcp": "First contentful paint"
};

// src/client/styles.css
var styles_default = ".cfd-page {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  overflow-y: auto;\n  /* Breakpoints below should follow the panel width, not the window width: the\n     panel sits beside the sidebar, so the two differ. Inline-size containment\n     only constrains the inline axis, leaving the page's own scrolling intact. */\n  container: cfd-page / inline-size;\n  /* The main panel hands its page a fixed-height box: the page owns scrolling,\n     and inheriting the box height is what makes it follow the window. */\n  padding: 28px 28px 40px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-head {\n  margin-bottom: 20px;\n}\n\n.cfd-title {\n  margin: 0;\n  font-size: 18px;\n  font-weight: 600;\n  line-height: 1.4;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-sub {\n  margin: 8px 0 0;\n  font-size: 13px;\n  line-height: 1.7;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-sub-note {\n  margin-left: 10px;\n  font-size: 12px;\n  white-space: nowrap;\n}\n\n.cfd-card {\n  margin-top: 16px;\n  padding: 20px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.cfd-step + .cfd-step {\n  margin-top: 22px;\n  padding-top: 20px;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n\n.cfd-label {\n  margin-bottom: 8px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-desc {\n  margin: 0 0 10px;\n  font-size: 12px;\n  line-height: 1.7;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-row {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  flex-wrap: wrap;\n}\n\n.cfd-input {\n  box-sizing: border-box;\n  flex: 1 1 260px;\n  min-width: 0;\n  height: 34px;\n  padding: 0 10px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  outline: none;\n}\n\n.cfd-input:focus {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.cfd-btn {\n  height: 32px;\n  padding: 0 14px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  cursor: pointer;\n}\n\n.cfd-btn:hover:not(:disabled) {\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.cfd-btn--primary {\n  border-color: var(--dsw-alias-brand-primary);\n  background: var(--dsw-alias-brand-primary);\n  /* Theme-aware contrast: the label uses the base background, which is the\n     inverse of the brand fill in both light and dark themes. A literal #fff\n     disappears whenever the dark theme's brand accent is near-white. */\n  color: var(--dsw-alias-bg-base);\n}\n\n.cfd-btn:disabled {\n  opacity: 0.55;\n  cursor: default;\n}\n\n.cfd-check {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n}\n\n.cfd-check input {\n  accent-color: var(--dsw-alias-brand-primary);\n}\n\n.cfd-hint {\n  margin: 8px 0 0;\n  font-size: 12px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-warn {\n  color: var(--dsw-alias-state-warn-primary);\n}\n\n.cfd-link {\n  font-size: 13px;\n  color: var(--dsw-alias-brand-primary);\n  text-decoration: none;\n}\n\n.cfd-link:hover {\n  text-decoration: underline;\n}\n\n.cfd-ok {\n  color: var(--dsw-alias-state-success-primary);\n}\n\n.cfd-error {\n  margin: 10px 0 0;\n  font-size: 13px;\n  line-height: 1.6;\n  color: var(--dsw-alias-state-error-primary);\n  white-space: pre-wrap;\n}\n\n.cfd-notice {\n  margin: 10px 0 0;\n  padding: 8px 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-2);\n  font-size: 12px;\n  line-height: 1.6;\n  color: var(--dsw-alias-state-warn-primary);\n}\n\n.cfd-meta {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n  gap: 10px;\n  margin-top: 4px;\n}\n\n.cfd-metric {\n  padding: 12px;\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-2);\n}\n\n.cfd-metric-value {\n  font-size: 20px;\n  font-weight: 600;\n  line-height: 1.3;\n  color: var(--dsw-alias-label-primary);\n  word-break: break-all;\n}\n\n.cfd-metric-value--small {\n  font-size: 13px;\n  font-weight: 500;\n}\n\n.cfd-metric-label {\n  margin-top: 4px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-actions {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n  margin-top: 16px;\n}\n\n.cfd-probe {\n  display: grid;\n  gap: 6px;\n  margin-top: 12px;\n  font-size: 12px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-probe-row {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.cfd-probe-name {\n  min-width: 56px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-icon {\n  display: block;\n}\n\n/* ------------------------------------------------------------------ */\n/* Dashboard                                                          */\n/* ------------------------------------------------------------------ */\n\n.cfd-page--wide {\n  padding: 24px 32px 48px;\n}\n\n.cfd-topbar {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 16px;\n  flex-wrap: wrap;\n  margin-bottom: 18px;\n}\n\n.cfd-toolbar {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  flex-wrap: wrap;\n}\n\n.cfd-select {\n  height: 32px;\n  padding: 0 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-layer-1);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n.cfd-kpi-row {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n.cfd-kpi-row > *,\n.cfd-grid-2 > *,\n.cfd-vitals > * {\n  min-width: 0;\n}\n\n.cfd-kpi {\n  padding: 16px 18px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n\n.cfd-kpi-label {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-kpi-value {\n  margin-top: 6px;\n  font-size: 28px;\n  font-weight: 600;\n  line-height: 1.2;\n  letter-spacing: -0.01em;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-kpi-delta {\n  display: flex;\n  gap: 6px;\n  align-items: center;\n  margin-top: 8px;\n  font-size: 12px;\n}\n\n.cfd-kpi-delta--up {\n  color: var(--dsw-alias-state-success-primary);\n}\n\n.cfd-kpi-delta--down {\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.cfd-kpi-delta--flat {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-kpi-delta-note,\n.cfd-kpi-hint {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-kpi-hint {\n  margin-top: 8px;\n  font-size: 12px;\n}\n\n.cfd-card-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: 12px;\n  margin-bottom: 12px;\n}\n\n.cfd-card-title {\n  margin: 0;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-card-sub {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-grid-2 {\n  display: grid;\n  /* Fallback for browsers without container queries; the @container rules below\n     cap this at three columns. Plain auto-fit happily produced five columns in a\n     wide panel, which made every list too narrow to read. */\n  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));\n  gap: 12px;\n  margin: 12px 0;\n  /* Stretch makes every card in a row share one height, so the four lists keep\n     their bottoms aligned even when one has fewer rows. */\n  align-items: stretch;\n}\n\n@container cfd-page (min-width: 680px) {\n  .cfd-grid-2 {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n\n@container cfd-page (min-width: 1120px) {\n  .cfd-grid-2 {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n}\n\n/* Stacked cards: the page already scrolls, so an extra scrollbar inside each\n   card would nest two scroll areas for no benefit. */\n@container cfd-page (max-width: 679px) {\n  .cfd-grid-2 .cfd-card {\n    max-height: none;\n  }\n\n  .cfd-grid-2 .cfd-list {\n    overflow: visible;\n    padding-right: 0;\n  }\n}\n\n.cfd-grid-2 .cfd-card {\n  display: flex;\n  flex-direction: column;\n  max-height: 420px;\n  margin-top: 0;\n}\n\n/* Only the rows scroll; the card head stays put. */\n.cfd-grid-2 .cfd-list {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  padding-right: 6px;\n  scrollbar-width: thin;\n}\n\n.cfd-list {\n  display: grid;\n  gap: 12px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.cfd-list-more {\n  margin-top: 12px;\n  padding: 0;\n  border: none;\n  background: none;\n  font-size: 12px;\n  color: var(--dsw-alias-brand-primary);\n  cursor: pointer;\n}\n\n.cfd-list-more:hover {\n  text-decoration: underline;\n}\n\n.cfd-check {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n  user-select: none;\n}\n\n.cfd-check input {\n  margin: 0;\n  accent-color: var(--dsw-alias-brand-primary);\n}\n\n.cfd-list-head {\n  display: flex;\n  justify-content: space-between;\n  gap: 12px;\n  font-size: 13px;\n}\n\n.cfd-list-name {\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.cfd-list-value {\n  color: var(--dsw-alias-label-secondary);\n  font-variant-numeric: tabular-nums;\n}\n\n.cfd-bar {\n  height: 6px;\n  margin-top: 6px;\n  border-radius: 3px;\n  background: var(--dsw-alias-bg-layer-2);\n  overflow: hidden;\n}\n\n.cfd-bar-fill {\n  height: 100%;\n  border-radius: 3px;\n  background: var(--dsw-alias-brand-primary);\n  opacity: 0.75;\n}\n\n.cfd-list-sub {\n  margin-top: 4px;\n  font-size: 11px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-vitals {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));\n  gap: 12px;\n}\n\n.cfd-vital {\n  padding: 12px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 10px;\n}\n\n.cfd-vital-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.cfd-vital-name {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-vital-value {\n  font-size: 18px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-vital-bar {\n  display: flex;\n  height: 6px;\n  margin: 10px 0 6px;\n  border-radius: 3px;\n  background: var(--dsw-alias-bg-layer-2);\n  overflow: hidden;\n}\n\n.cfd-vital-good {\n  background: var(--dsw-alias-state-success-primary);\n}\n\n.cfd-vital-needs {\n  background: var(--dsw-alias-state-warn-primary);\n}\n\n.cfd-vital-poor {\n  background: var(--dsw-alias-state-error-primary);\n}\n\n.cfd-vital-foot {\n  font-size: 11px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-chart {\n  position: relative;\n}\n\n.cfd-chart-plot {\n  position: relative;\n}\n\n.cfd-chart-svg {\n  display: block;\n  width: 100%;\n  height: auto;\n}\n\n.cfd-grid-line {\n  stroke: var(--dsw-alias-border-l1);\n  stroke-width: 1;\n}\n\n.cfd-axis-label {\n  fill: var(--dsw-alias-label-secondary);\n  font-size: 11px;\n}\n\n.cfd-line {\n  fill: none;\n  stroke-width: 2;\n  stroke-linejoin: round;\n  stroke-linecap: round;\n}\n\n.cfd-line--area {\n  stroke: var(--dsw-alias-brand-primary);\n}\n\n.cfd-line--loads {\n  stroke: var(--dsw-alias-state-warn-primary);\n  stroke-dasharray: 4 3;\n}\n\n.cfd-dot--visits {\n  fill: var(--dsw-alias-brand-primary);\n}\n\n.cfd-dot--loads {\n  fill: var(--dsw-alias-state-warn-primary);\n}\n\n.cfd-hover-line {\n  stroke: var(--dsw-alias-border-l2);\n  stroke-dasharray: 3 3;\n}\n\n.cfd-legend {\n  display: flex;\n  gap: 16px;\n  padding: 0 8px 8px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-legend-item {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.cfd-swatch {\n  display: inline-block;\n  width: 10px;\n  height: 10px;\n  border-radius: 3px;\n}\n\n.cfd-swatch--area {\n  background: var(--dsw-alias-brand-primary);\n  opacity: 0.6;\n}\n\n.cfd-swatch--line {\n  background: var(--dsw-alias-state-warn-primary);\n}\n\n.cfd-tooltip {\n  position: absolute;\n  top: 8px;\n  transform: translateX(-50%);\n  z-index: 2;\n  padding: 8px 10px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 8px;\n  background: var(--dsw-alias-bg-overlay);\n  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);\n  font-size: 12px;\n  white-space: nowrap;\n  pointer-events: none;\n}\n\n.cfd-tooltip-title {\n  margin-bottom: 4px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-tooltip-row {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.cfd-tooltip-row b {\n  margin-left: auto;\n  padding-left: 12px;\n}\n\n.cfd-chart-empty {\n  padding: 48px 0;\n  text-align: center;\n  font-size: 13px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* Explains a narrowed x-axis: the chart spans the data, which may be shorter\n   than the requested range. */\n.cfd-chart-note {\n  margin: 6px 0 0;\n  padding: 0 8px;\n  font-size: 11px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-empty-card {\n  margin-top: 40px;\n  padding: 32px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  text-align: center;\n}\n\n.cfd-empty-title {\n  margin: 0 0 8px;\n  font-size: 15px;\n  font-weight: 600;\n}\n\n.cfd-foot {\n  margin-top: 16px;\n  font-size: 12px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-perf-total {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  padding: 12px 14px;\n  margin-bottom: 14px;\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-2);\n}\n\n.cfd-perf-total-label {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-perf-total-value {\n  font-size: 22px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n}\n\n.cfd-perf-list {\n  display: grid;\n  gap: 10px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.cfd-perf-row {\n  display: grid;\n  grid-template-columns: 120px 1fr 72px;\n  align-items: center;\n  gap: 12px;\n  font-size: 12px;\n}\n\n.cfd-perf-name {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.cfd-perf-bar {\n  height: 8px;\n  border-radius: 4px;\n  background: var(--dsw-alias-bg-layer-2);\n  overflow: hidden;\n}\n\n.cfd-perf-fill {\n  height: 100%;\n  border-radius: 4px;\n  background: var(--dsw-alias-brand-primary);\n  opacity: 0.7;\n}\n\n.cfd-perf-value {\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  color: var(--dsw-alias-label-primary);\n}\n\n@media (max-width: 640px) {\n  .cfd-page,\n  .cfd-page--wide {\n    padding: 16px 14px 32px;\n  }\n\n  .cfd-perf-row {\n    grid-template-columns: 96px 1fr 64px;\n  }\n\n  .cfd-kpi-value {\n    font-size: 24px;\n  }\n}\n";

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
  const CloudflarePanel = () => import_react5.default.createElement(Panel, { t: ctx.locale.bind(NS) });
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

