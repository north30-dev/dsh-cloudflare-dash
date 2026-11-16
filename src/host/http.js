/**
 * Outbound HTTP for the Cloudflare client.
 *
 * One code path over `node:https` so direct and proxied requests report the same
 * stage timings, and so a proxy can tunnel with CONNECT without pulling in a
 * third-party HTTP stack. Only HTTPS targets are allowed: the bearer Token never
 * travels over plain HTTP.
 */
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

const MAX_BODY_BYTES = 1024 * 1024
const DEFAULT_TIMEOUT_MS = 20000
const CLOUDFLARE_HOST = 'api.cloudflare.com'

/** A transport failure with a stable code for the UI to translate. */
export class HttpError extends Error {
  /**
   * @param {'dns'|'network'|'tls'|'timeout'|'proxy'|'proxy-invalid'|'too-large'|'unsupported'} code
   * @param {string} message
   * @param {{ timings?: Record<string, number> }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    if (extra.timings !== undefined) this.timings = extra.timings
  }
}

/**
 * Parse a user-supplied proxy address.
 * @param {unknown} raw
 * @returns {{ host: string, port: number }}
 */
export function normalizeProxy(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new HttpError('proxy-invalid', '代理地址为空')
  }
  let url
  try {
    url = new URL(raw.trim())
  } catch {
    throw new HttpError('proxy-invalid', '代理地址格式不合法，示例：http://127.0.0.1:7890')
  }
  if (url.protocol !== 'http:') {
    throw new HttpError('proxy-invalid', '目前仅支持 http:// 代理（CONNECT 隧道）')
  }
  if (url.username !== '' || url.password !== '') {
    throw new HttpError('proxy-invalid', '代理地址不支持账号密码')
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new HttpError('proxy-invalid', '代理地址只能是 http://host:port，不要带路径')
  }
  const port = Number(url.port === '' ? 80 : url.port)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new HttpError('proxy-invalid', '代理端口不合法')
  }
  return { host: url.hostname.replace(/^\[|\]$/g, ''), port }
}

/**
 * Whether a proxy settings pair asks for a tunnel.
 * @param {{ enabled?: boolean, url?: string } | undefined} settings
 * @returns {{ host: string, port: number } | undefined}
 */
export function proxyFromSettings(settings) {
  if (settings === undefined || settings === null) return undefined
  if (settings.enabled !== true) return undefined
  if (typeof settings.url !== 'string' || settings.url.trim() === '') {
    throw new HttpError('proxy-invalid', '已开启代理，但代理地址为空')
  }
  return normalizeProxy(settings.url)
}

/**
 * Resolve once an event fires or the emitter errors.
 * @param {import('node:events').EventEmitter} emitter
 * @param {string} event
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
function once(emitter, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new HttpError('timeout', '连接超时'))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      emitter.removeListener(event, onEvent)
      emitter.removeListener('error', onError)
    }
    const onEvent = () => {
      cleanup()
      resolve()
    }
    const onError = (error) => {
      cleanup()
      reject(error)
    }
    emitter.once(event, onEvent)
    emitter.once('error', onError)
  })
}

/**
 * Open a CONNECT tunnel through an HTTP proxy.
 * @param {{ host: string, port: number }} proxy
 * @param {string} targetHost
 * @param {number} targetPort
 * @param {number} timeoutMs
 * @returns {Promise<import('node:net').Socket>}
 */
async function openTunnel(proxy, targetHost, targetPort, timeoutMs) {
  const socket = net.connect({ host: proxy.host, port: proxy.port })
  try {
    await once(socket, 'connect', timeoutMs)
    socket.write(
      `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n`
      + `Host: ${targetHost}:${targetPort}\r\n`
      + 'Proxy-Connection: keep-alive\r\n\r\n',
    )
    const status = await new Promise((resolve, reject) => {
      let buffer = ''
      const timer = setTimeout(() => {
        cleanup()
        socket.destroy()
        reject(new HttpError('proxy', '代理 CONNECT 超时'))
      }, timeoutMs)
      const cleanup = () => {
        clearTimeout(timer)
        socket.removeListener('data', onData)
        socket.removeListener('error', onError)
      }
      const onError = (error) => {
        cleanup()
        reject(error)
      }
      const onData = (chunk) => {
        buffer += chunk.toString('latin1')
        const end = buffer.indexOf('\r\n\r\n')
        if (end === -1) return
        cleanup()
        const line = buffer.slice(0, buffer.indexOf('\r\n'))
        const match = /^HTTP\/\d\.\d\s+(\d{3})/.exec(line)
        resolve(match === null ? 0 : Number(match[1]))
      }
      socket.on('data', onData)
      socket.once('error', onError)
    })
    if (status !== 200) {
      socket.destroy()
      throw new HttpError('proxy', `代理拒绝了 CONNECT（HTTP ${status || '未知'}）`)
    }
    return socket
  } catch (error) {
    socket.destroy()
    throw error instanceof HttpError ? error : new HttpError('proxy', `无法连接代理：${error.message}`)
  }
}

/**
 * Map a Node socket error onto a transport code.
 * @param {unknown} error
 * @param {boolean} viaProxy
 * @returns {HttpError}
 */
function mapError(error, viaProxy) {
  if (error instanceof HttpError) return error
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message : String(error)
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new HttpError('dns', `DNS 解析失败：${message}`)
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return viaProxy ? new HttpError('proxy', `代理不可用：${message}`) : new HttpError('network', `网络不可达：${message}`)
  }
  if (code.startsWith('CERT_') || code.startsWith('ERR_TLS') || code === 'EPROTO') {
    return new HttpError('tls', `TLS 握手失败：${message}`)
  }
  return viaProxy ? new HttpError('proxy', message) : new HttpError('network', message)
}

/**
 * Issue one HTTPS request and collect the response body.
 * @param {{
 *   url: string,
 *   method?: string,
 *   headers?: Record<string, string>,
 *   body?: string,
 *   proxy?: { host: string, port: number },
 *   timeoutMs?: number,
 * }} options
 * @returns {Promise<{ status: number, headers: Record<string, string | string[] | undefined>, text: string, timings: Record<string, number> }>}
 */
export async function request(options) {
  const { url, method = 'GET', body, proxy } = options
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const target = new URL(url)
  if (target.protocol !== 'https:') {
    throw new HttpError('unsupported', '只允许访问 https 目标')
  }
  const port = Number(target.port === '' ? 443 : target.port)
  const path = `${target.pathname}${target.search}`
  const headers = {
    host: target.host,
    'user-agent': 'dsh-cloudflare-dash',
    'accept-encoding': 'identity',
    ...options.headers,
  }

  const started = performance.now()
  const timings = {}
  const mark = (name) => {
    timings[name] = Math.round(performance.now() - started)
  }

  let agentSocket
  if (proxy !== undefined) {
    const socket = await openTunnel(proxy, target.hostname, port, timeoutMs)
    mark('proxyConnectMs')
    agentSocket = tls.connect({ socket, servername: target.hostname })
    try {
      await once(agentSocket, 'secureConnect', timeoutMs)
    } catch (error) {
      agentSocket.destroy()
      throw mapError(error, true)
    }
    mark('tlsMs')
  }

  const requestOptions = {
    host: target.hostname,
    port,
    path,
    method,
    headers,
    agent: false,
    timeout: timeoutMs,
    ...(agentSocket === undefined ? {} : { createConnection: () => agentSocket }),
  }

  return await new Promise((resolve, reject) => {
    const req = https.request(requestOptions)
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      req.destroy()
      if (agentSocket !== undefined) agentSocket.destroy()
      reject(mapError(error, proxy !== undefined))
    }
    if (agentSocket === undefined) {
      req.on('socket', (socket) => {
        socket.once('lookup', () => mark('dnsMs'))
        socket.once('connect', () => mark('connectMs'))
        socket.once('secureConnect', () => mark('tlsMs'))
      })
    }
    req.setTimeout(timeoutMs, () => fail(new HttpError('timeout', `请求超时（${timeoutMs} ms）`)))
    req.on('error', fail)
    req.on('response', (response) => {
      mark('ttfbMs')
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_BODY_BYTES) {
          fail(new HttpError('too-large', '响应体超过 1 MiB 上限'))
          return
        }
        chunks.push(chunk)
      })
      response.on('error', fail)
      response.on('end', () => {
        if (settled) return
        settled = true
        mark('totalMs')
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          text: Buffer.concat(chunks).toString('utf8'),
          timings,
        })
      })
    })
    if (body !== undefined) req.write(body)
    req.end()
  })
}

/**
 * Measure reachability and stage timings for the Cloudflare API.
 * An unauthenticated request answers 401, which still proves the path works.
 * @param {{ proxy?: { host: string, port: number } }} options
 * @returns {Promise<{ ok: boolean, status?: number, timings?: Record<string, number>, error?: { code: string, message: string } }>}
 */
export async function probe(options) {
  try {
    const response = await request({
      url: `https://${CLOUDFLARE_HOST}/client/v4/user/tokens/verify`,
      method: 'GET',
      timeoutMs: 15000,
      ...(options.proxy === undefined ? {} : { proxy: options.proxy }),
    })
    return {
      ok: response.status === 200 || response.status === 401 || response.status === 403,
      status: response.status,
      timings: response.timings,
    }
  } catch (error) {
    const mapped = error instanceof HttpError ? error : new HttpError('network', String(error))
    return { ok: false, error: { code: mapped.code, message: mapped.message } }
  }
}
