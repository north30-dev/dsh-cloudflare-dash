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
import { createTokenStore, normalizeToken } from './store.js'

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
 * Translate a thrown value into an HTTP answer.
 * @param {import('node:http').ServerResponse} response
 * @param {unknown} error
 */
function sendFailure(response, error) {
  if (error instanceof CloudflareError) {
    const status = error.status === 401 || error.status === 403 || error.status === 429 ? error.status : 502
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

  /**
   * Shared body for configured state.
   * @returns {Promise<Record<string, unknown>>}
   */
  async function describedState() {
    const described = await store.describe()
    return {
      ...described,
      ...(verifiedAt === undefined ? {} : { verifiedAt }),
      ...(lastAccess === undefined ? {} : lastAccess),
    }
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
            sendJson(response, 200, await describedState())
            return
          }
          const body = await readJsonBody(request)
          const token = normalizeToken(body.token)
          const proxy = proxyFromSettings(body.proxy)
          const access = await describeAccess({ token, proxy })
          await store.save(token)
          verifiedAt = Date.now()
          lastAccess = access
          sendJson(response, 200, await describedState())
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
