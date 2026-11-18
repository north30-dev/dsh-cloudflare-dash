/**
 * The plugin's exact HTTP surface.
 *
 * Every route answers only the plugin's own panel: exact registrations win over
 * the host's `/api` fence, so this module carries its own admission. It reuses
 * the host's request rejection when that service exists and otherwise refuses
 * anything that is not loopback, which is the same rule the host applies.
 */
import { CloudflareError, describeAccess } from './cloudflare.js'
import { HttpError, probe, proxyFromSettings } from './http.js'
import { RANGES, clearOverviewCache, fetchOverview, listSites } from './analytics.js'
import { readState, writeState } from './state.js'
import { createTokenStore, normalizeAccountId, normalizeToken } from './store.js'

const PREFIX = '/cloudflare-dash/api/v1'
const MAX_BODY_BYTES = 4096

/**
 * Present a JSON value without caching it.
 * @param {import('node:http').ServerResponse} response
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

/**
 * Whether a `Host` authority names this machine.
 * @param {string | undefined} host
 * @returns {boolean}
 */
function isLoopbackAuthority(host) {
  if (typeof host !== 'string') return false
  const lower = host.toLowerCase()
  const name = lower.startsWith('[') ? lower.slice(0, lower.indexOf(']') + 1) : lower.split(':')[0]
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]'
}

/**
 * Admit or refuse one request; `true` means it was answered here.
 * @param {{ get: (name: string) => unknown }} ctx
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @returns {boolean}
 */
function refuse(ctx, request, response) {
  if (request.headers['sec-fetch-site'] === 'cross-site') {
    sendJson(response, 403, { error: '跨站请求已拒绝' })
    return true
  }
  const connection = ctx.get('connection')
  if (connection !== undefined && connection !== null && typeof connection.requestRejection === 'function') {
    let status
    try {
      status = connection.requestRejection(request)
    } catch {
      status = 403
    }
    if (status !== undefined && status !== null) {
      sendJson(response, typeof status === 'number' ? status : 403, {
        error: '请求未通过 DSH 的连接校验，请刷新页面后重试',
      })
      return true
    }
    return false
  }
  if (!isLoopbackAuthority(request.headers.host)) {
    sendJson(response, 403, { error: '只允许来自本机的请求' })
    return true
  }
  return false
}

/**
 * Read a bounded JSON body.
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<Record<string, unknown>>}
 */
async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new HttpError('too-large', '请求体过大')
    chunks.push(buffer)
  }
  if (size === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new HttpError('bad-request', '请求体不是合法 JSON')
  }
}

/**
 * Shape a client proxy preference for storage. The panel sends this shape on
 * every save, so it is also how the agent tool learns which proxy to use.
 * @param {unknown} raw
 * @returns {{ enabled: boolean, url: string } | undefined}
 */
function storedProxy(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  if (typeof raw.url !== 'string' || raw.url.trim() === '') return undefined
  return { enabled: raw.enabled === true, url: raw.url.trim() }
}

/**
 * Translate a thrown value into an HTTP answer.
 * @param {import('node:http').ServerResponse} response
 * @param {unknown} error
 */
function sendFailure(response, error) {
  if (error instanceof CloudflareError) {
    const passthrough = [400, 401, 403, 404, 429]
    const status = passthrough.includes(error.status) ? error.status : 502
    sendJson(response, status, {
      error: error.message,
      code: error.code,
      ...(error.missing === undefined ? {} : { missing: error.missing }),
    })
    return
  }
  if (error instanceof HttpError) {
    const status = error.code === 'proxy-invalid' || error.code === 'bad-request' ? 400 : 502
    sendJson(response, status, { error: error.message, code: error.code })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  sendJson(response, 400, { error: message, code: 'invalid-request' })
}

/**
 * Register the plugin's routes on the host web server.
 * @param {{ get: (name: string) => unknown, webServer: { register: (route: object) => () => void } }} ctx
 * @returns {() => void}
 */
export function registerRoutes(ctx) {
  const store = createTokenStore(ctx)
  /** Last successful verification, process-local: never a credential. */
  let verifiedAt
  let lastAccess
  /** Why the last verification attempt failed, for the settings page. */
  let accessError

  /**
   * Verify the configured Token and remember the result, both in memory and as
   * the non-secret snapshot in plugin state.
   *
   * The in-memory copy is lost on every restart, and the snapshot is only a
   * last-known answer, so this is the one place that spends the extra API calls.
   * @param {{ host: string, port: number } | undefined} proxy
   * @returns {Promise<boolean>} whether verification succeeded.
   */
  async function refreshAccess(proxy) {
    const token = await store.resolve()
    if (token === undefined) return false
    try {
      const access = await describeAccess({ token, proxy, accountId: readState().accountId })
      lastAccess = access
      verifiedAt = Date.now()
      accessError = undefined
      writeState({ access: { accounts: access.accounts, rumSites: access.rumSites, verifiedAt } })
      return true
    } catch (error) {
      accessError = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  /**
   * Shared body for configured state.
   *
   * Counts fall back to the persisted snapshot when this process has not verified
   * yet; that fallback is marked `verifiedStale` so the panel can say the numbers
   * are from an earlier run instead of pretending they were just measured.
   * @returns {Promise<Record<string, unknown>>}
   */
  async function describedState() {
    const described = await store.describe()
    const state = readState()
    const snapshot = state.access
    const live = lastAccess !== undefined
    const counts = live
      ? {
        accounts: lastAccess.accounts,
        rumSites: lastAccess.rumSites,
        ...(lastAccess.capabilities === undefined ? {} : { capabilities: lastAccess.capabilities }),
        ...(lastAccess.hint === undefined ? {} : { hint: lastAccess.hint }),
      }
      : snapshot === undefined
        ? {}
        : { accounts: snapshot.accounts, rumSites: snapshot.rumSites }
    const verified = live ? verifiedAt : snapshot?.verifiedAt
    return {
      ...described,
      ...(state.accountId === undefined ? {} : { accountId: state.accountId }),
      ...counts,
      ...(verified === undefined ? {} : { verifiedAt: verified }),
      ...(counts.accounts === undefined || live ? {} : { verifiedStale: true }),
      ...(accessError === undefined ? {} : { accessError }),
    }
  }

  /**
   * Proxy preference carried by a GET request, falling back to the stored one.
   * The query string stays authoritative for the panel so a changed setting
   * takes effect immediately; the stored copy is what the agent tool uses.
   * @param {import('node:http').IncomingMessage} request
   * @returns {{ host: string, port: number } | undefined}
   */
  function proxyOfRequest(request) {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const asked = proxyFromSettings({
      enabled: url.searchParams.get('proxy') === '1',
      url: url.searchParams.get('proxyUrl') ?? undefined,
    })
    if (asked !== undefined) return asked
    const stored = readState().proxy
    if (stored === undefined) return undefined
    try {
      return proxyFromSettings(stored)
    } catch {
      // A stale stored address must not break the panel; the query string wins.
      return undefined
    }
  }

  /**
   * Resolve what a data request needs, or explain what is missing.
   * @param {import('node:http').IncomingMessage} request
   * @returns {Promise<{ token: string, accountId: string, proxy?: { host: string, port: number } }>}
   */
  async function dataContext(request) {
    const token = await store.resolve()
    if (token === undefined) throw new CloudflareError('no-token', '尚未配置 Token', { status: 401 })
    const accountId = readState().accountId
    if (accountId === undefined) throw new CloudflareError('no-account', '缺少 Account ID，请重新保存 Token', { status: 400 })
    return { token, accountId, proxy: proxyOfRequest(request) }
  }

  const disposers = [
    ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/status`,
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        if (refuse(ctx, request, response)) return
        try {
          const url = new URL(request.url ?? '/', 'http://localhost')
          const force = url.searchParams.get('verify') === '1'
          const configured = (await store.describe()).configured === true
          // Verify when nothing at all is known (first run after a restart that
          // has no snapshot) or when the panel explicitly asks. Otherwise answer
          // from memory or the snapshot, so opening settings costs no API call.
          if (configured && (force || (lastAccess === undefined && readState().access === undefined))) {
            await refreshAccess(proxyOfRequest(request))
          }
          sendJson(response, 200, await describedState())
        } catch (error) {
          sendFailure(response, error)
        }
      },
    }),

    ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/token`,
      handler: async (request, response) => {
        if (request.method !== 'POST' && request.method !== 'DELETE') {
          response.writeHead(405, { allow: 'POST, DELETE' })
          response.end()
          return
        }
        if (refuse(ctx, request, response)) return
        try {
          if (request.method === 'DELETE') {
            await store.clear()
            verifiedAt = undefined
            lastAccess = undefined
            accessError = undefined
            // The snapshot describes a Token this machine no longer holds.
            writeState({ access: undefined })
            clearOverviewCache()
            sendJson(response, 200, await describedState())
            return
          }
          const body = await readJsonBody(request)
          const token = normalizeToken(body.token)
          const accountId = normalizeAccountId(body.accountId)
          const proxy = proxyFromSettings(body.proxy)
          const access = await describeAccess({ token, proxy, accountId })
          const savedAt = Date.now()
          await store.save(token)
          writeState({
            accountId,
            proxy: storedProxy(body.proxy),
            access: { accounts: access.accounts, rumSites: access.rumSites, verifiedAt: savedAt },
          })
          clearOverviewCache()
          verifiedAt = savedAt
          lastAccess = access
          accessError = undefined
          sendJson(response, 200, await describedState())
        } catch (error) {
          sendFailure(response, error)
        }
      },
    }),

    ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/prefs`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (refuse(ctx, request, response)) return
        try {
          const body = await readJsonBody(request)
          const proxy = storedProxy(body.proxy)
          if (proxy !== undefined) proxyFromSettings(proxy)
          writeState({ proxy })
          sendJson(response, 200, { proxy: proxy ?? null })
        } catch (error) {
          sendFailure(response, error)
        }
      },
    }),

    ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/sites`,
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        if (refuse(ctx, request, response)) return
        try {
          const context = await dataContext(request)
          sendJson(response, 200, { sites: await listSites(context) })
        } catch (error) {
          sendFailure(response, error)
        }
      },
    }),

    ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/overview`,
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        if (refuse(ctx, request, response)) return
        try {
          const url = new URL(request.url ?? '/', 'http://localhost')
          const range = url.searchParams.get('range') ?? '7d'
          if (RANGES[range] === undefined) throw new HttpError('bad-request', '不支持的时间范围')
          const siteTag = url.searchParams.get('siteTag') ?? ''
          const fresh = url.searchParams.get('fresh') === '1'
          // `all` includes bot traffic; every other value keeps the dashboard
          // default, so a typo can never quietly change what a number means.
          const bots = url.searchParams.get('bots') === 'all' ? 'all' : 'exclude'
          const context = await dataContext(request)
          sendJson(response, 200, await fetchOverview({ ...context, siteTag, range, fresh, bots }))
        } catch (error) {
          sendFailure(response, error)
        }
      },
    }),

    ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/probe`,
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (refuse(ctx, request, response)) return
        try {
          const body = await readJsonBody(request)
          const proxy = proxyFromSettings(body.proxy)
          const direct = await probe({})
          const proxied = proxy === undefined ? undefined : await probe({ proxy })
          sendJson(response, 200, { direct, ...(proxied === undefined ? {} : { proxied }) })
        } catch (error) {
          sendFailure(response, error)
        }
      },
    }),
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
