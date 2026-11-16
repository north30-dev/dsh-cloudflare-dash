/** Host-route client used by every view in the panel. */

const PROXY_STORAGE_KEY = 'dsh-cloudflare-dash:proxy'

/** Default proxy address offered in the settings view. */
export const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'

/** Where the Host half listens, relative to the page's own mount. */
export function apiBase() {
  return new URL('cloudflare-dash/api/v1/', document.baseURI).toString()
}

/**
 * Call one Host route.
 * @param {string} path
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<any>}
 */
export async function callApi(path, options = {}) {
  const init = { method: options.method ?? 'GET', credentials: 'same-origin' }
  if (options.body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(options.body)
  }
  let response
  try {
    response = await fetch(apiBase() + path, init)
  } catch {
    throw new Error('无法连接插件后端')
  }
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const error = new Error(payload?.error ?? `请求失败（HTTP ${response.status}）`)
    error.code = payload?.code
    error.missing = payload?.missing
    error.status = response.status
    throw error
  }
  return payload ?? {}
}

/** Read the non-secret proxy preference. */
export function readProxyPrefs() {
  try {
    const raw = window.localStorage.getItem(PROXY_STORAGE_KEY)
    if (raw === null) return { enabled: false, url: DEFAULT_PROXY_URL }
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed?.enabled === true,
      url: typeof parsed?.url === 'string' ? parsed.url : DEFAULT_PROXY_URL,
    }
  } catch {
    return { enabled: false, url: DEFAULT_PROXY_URL }
  }
}

/** Persist the non-secret proxy preference. */
export function writeProxyPrefs(prefs) {
  try {
    window.localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // A blocked storage quota must not break configuration.
  }
}

/**
 * Query string carrying the proxy preference for GET routes.
 * @param {{ enabled: boolean, url: string }} proxy
 * @returns {string}
 */
export function proxyQuery(proxy) {
  if (proxy.enabled !== true) return ''
  return `proxy=1&proxyUrl=${encodeURIComponent(proxy.url)}`
}
