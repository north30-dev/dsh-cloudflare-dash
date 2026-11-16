/**
 * Cloudflare API client used by the Host half.
 *
 * Read-only by construction: this module only knows the handful of GET
 * endpoints the dashboard needs, so a plugin build can never mutate an account.
 * The bearer Token is never echoed in an error, a log line, or a response body.
 */
import { HttpError, request } from './http.js'

const API_BASE = 'https://api.cloudflare.com/client/v4'
const MAX_ACCOUNTS_PROBED = 5

/** A Cloudflare or transport failure the UI can present verbatim. */
export class CloudflareError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ status?: number, missing?: string[] }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message)
    this.name = 'CloudflareError'
    this.code = code
    if (extra.status !== undefined) this.status = extra.status
    if (extra.missing !== undefined) this.missing = extra.missing
  }
}

/**
 * Turn a Cloudflare error envelope into a readable message.
 * @param {{ errors?: Array<{ code?: number, message?: string }> }} payload
 * @returns {{ message: string, missing: string[] }}
 */
function describeEnvelope(payload) {
  const errors = Array.isArray(payload.errors) ? payload.errors : []
  const messages = errors
    .map((entry) => (typeof entry?.message === 'string' ? entry.message : ''))
    .filter((entry) => entry !== '')
  const missing = messages.filter((entry) => /permission|not authorized|access/i.test(entry))
  return {
    message: messages.length > 0 ? messages.join('; ') : 'Cloudflare 返回了错误响应',
    missing,
  }
}

/**
 * Call one Cloudflare API endpoint.
 * @param {string} path - path after `/client/v4`, with its query string.
 * @param {{ token: string, proxy?: { host: string, port: number }, method?: string, body?: unknown, timeoutMs?: number }} options
 * @returns {Promise<unknown>} the `result` member.
 */
export async function callApi(path, options) {
  let response
  try {
    response = await request({
      url: `${API_BASE}${path}`,
      method: options.method ?? 'GET',
      headers: {
        authorization: `Bearer ${options.token}`,
        'content-type': 'application/json',
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.proxy === undefined ? {} : { proxy: options.proxy }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    })
  } catch (error) {
    const mapped = error instanceof HttpError ? error : new HttpError('network', String(error))
    throw new CloudflareError(mapped.code, mapped.message)
  }

  let payload
  try {
    payload = JSON.parse(response.text)
  } catch {
    throw new CloudflareError(
      'bad-response',
      `Cloudflare 返回了非 JSON 响应（HTTP ${response.status}）`,
      { status: response.status },
    )
  }

  if (response.status === 401) {
    const detail = describeEnvelope(payload).message
    throw new CloudflareError('unauthorized', `Token 被 Cloudflare 拒绝（${detail}）`, { status: 401 })
  }
  if (response.status === 403) {
    const described = describeEnvelope(payload)
    throw new CloudflareError('forbidden', described.message, { status: 403, missing: described.missing })
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers['retry-after'])
    throw new CloudflareError('rate-limited', 'Cloudflare 限流，请稍后重试', {
      status: 429,
      missing: Number.isFinite(retryAfter) ? [`retry-after:${retryAfter}`] : undefined,
    })
  }
  if (payload?.success !== true) {
    const first = Array.isArray(payload?.errors) ? payload.errors[0] : undefined
    // 6003 covers a malformed Authorization header, which Cloudflare returns for
    // a truncated token; the raw "Invalid request headers" never explains why.
    if (first?.code === 6003) {
      throw new CloudflareError(
        'bad-headers',
        'Token 格式不被接受（Cloudflare: Invalid request headers）。用户 API Token 通常为 40 位字符，请确认复制完整；「帐户 API 令牌」还需要填写 Account ID。',
        { status: 400 },
      )
    }
    const described = describeEnvelope(payload)
    throw new CloudflareError('api', described.message, { status: response.status, missing: described.missing })
  }
  return payload.result
}

/**
 * Count Web Analytics sites across the accounts the Token can see.
 * A missing Web Analytics permission is reported, not thrown: the token is still
 * valid and the dashboard can still show account-level state.
 * @param {{ token: string, proxy?: { host: string, port: number } }} options
 * @param {unknown[]} accountList
 * @returns {Promise<{ rumSites: number, rumDenied: boolean }>}
 */
async function countRumSites(options, accountList) {
  let rumSites = 0
  let rumDenied = false
  for (const account of accountList.slice(0, MAX_ACCOUNTS_PROBED)) {
    if (typeof account?.id !== 'string') continue
    try {
      const sites = await callApi(`/accounts/${account.id}/rum/site_info/list`, options)
      rumSites += Array.isArray(sites) ? sites.length : 0
    } catch (error) {
      if (!(error instanceof CloudflareError)) throw error
      if (error.code === 'forbidden') {
        rumDenied = true
        continue
      }
      throw error
    }
  }
  return { rumSites, rumDenied }
}

/**
 * Build the access summary from an account list.
 * @param {{ token: string, proxy?: { host: string, port: number } }} options
 * @param {unknown[]} accountList
 * @param {'user' | 'account'} ownership
 */
async function summarize(options, accountList, ownership) {
  const { rumSites, rumDenied } = await countRumSites(options, accountList)
  return {
    accounts: accountList.length,
    rumSites,
    ownership,
    capabilities: { rum: rumSites > 0, zone: accountList.length > 0, rumDenied },
    ...(rumSites === 0 && rumDenied
      ? { hint: '读取站点列表需要 Account Settings:Read 权限' }
      : {}),
  }
}

/**
 * Verify an account-owned token against its account.
 * @param {{ token: string, proxy?: { host: string, port: number }, accountId?: string }} options
 * @param {string} accountId
 * @returns {Promise<object | undefined>} undefined when the value is not an account token.
 */
async function tryAccountOwnedToken(options, accountId) {
  let verified
  try {
    verified = await callApi(`/accounts/${accountId}/tokens/verify`, options)
  } catch (error) {
    if (error instanceof CloudflareError) {
      const inconclusive = ['unauthorized', 'forbidden', 'api', 'inactive']
      if (inconclusive.includes(error.code)) return undefined
    }
    throw error
  }
  if (verified?.status !== 'active') return undefined
  return await summarize(options, [{ id: accountId }], 'account')
}

/**
 * Verify a Token and report what it can reach.
 *
 * Three shapes are supported:
 * - a user-owned token: verified at `/user/tokens/verify`;
 * - an account-owned token plus its Account ID: verified at
 *   `/accounts/{id}/tokens/verify` (the user endpoint answers 401 for these);
 * - an account-owned token without an Account ID: `/user/tokens/verify` answers
 *   401, so account listing is tried as a last resort and the failure explains
 *   that an Account ID is the missing input.
 * @param {{ token: string, proxy?: { host: string, port: number }, accountId?: string }} options
 * @returns {Promise<{ accounts: number, rumSites: number, ownership: 'user' | 'account', capabilities: { rum: boolean, zone: boolean, rumDenied: boolean }, hint?: string }>}
 */
export async function describeAccess(options) {
  if (typeof options.accountId === 'string' && options.accountId !== '') {
    const viaAccount = await tryAccountOwnedToken(options, options.accountId)
    if (viaAccount !== undefined) return viaAccount
  }

  try {
    let verified
    try {
      verified = await callApi('/user/tokens/verify', options)
    } catch (error) {
      if (!(error instanceof CloudflareError) || error.code !== 'unauthorized') throw error
      let accounts
      try {
        accounts = await callApi('/accounts?per_page=50', options)
      } catch (fallbackError) {
        if (fallbackError instanceof CloudflareError) {
          // An invalid token answers 401 here too, but Cloudflare sometimes says
          // 403 "Invalid access token"; report those as the original 401 rather
          // than as a permission problem. A genuine permission error keeps its 403.
          if (fallbackError.code === 'unauthorized' || /invalid/i.test(fallbackError.message)) throw error
        }
        throw fallbackError
      }
      const accountList = Array.isArray(accounts) ? accounts : []
      if (accountList.length === 0) throw error
      return await summarize(options, accountList, 'account')
    }

    if (verified?.status !== 'active') {
      throw new CloudflareError('inactive', 'Token 当前状态不是 active，请重新创建')
    }
    const accounts = await callApi('/accounts?per_page=50', options)
    return await summarize(options, Array.isArray(accounts) ? accounts : [], 'user')
  } catch (error) {
    if (error instanceof CloudflareError && error.code === 'unauthorized') {
      throw new CloudflareError(
        'unauthorized',
        `${error.message}；若这是「帐户 API 令牌」，请填写 Account ID 后用账户级校验`,
        { status: 401 },
      )
    }
    throw error
  }
}
