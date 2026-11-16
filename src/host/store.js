/**
 * Token storage.
 *
 * The Token lives in the DSH credential store as a plugin-owned record, so it
 * never enters configuration, session logs, or the repository. An environment
 * reference is supported as a fallback for headless users, which keeps the
 * documented precedence: stored record first, then the launch environment.
 */

const RECORD_KEY = 'dsh-cloudflare-dash/api-token'
const ENV_REF = 'CLOUDFLARE_API_TOKEN'

/**
 * Mask a Token for display. Only the tail is kept, and short values are masked
 * whole so a mask can never rebuild a usable secret.
 * @param {string} token
 * @returns {string}
 */
export function maskToken(token) {
  if (typeof token !== 'string' || token === '') return ''
  if (token.length < 12) return '*'.repeat(token.length)
  return `${token.slice(0, 4)}${'*'.repeat(8)}${token.slice(-4)}`
}

/**
 * Validate a pasted Token before it is stored.
 *
 * Users paste a lot of things that are not a token value: a `Bearer ` prefix, a
 * quoted string, the Token ID from the token's detail page, or the Global API
 * Key. The first two are repaired here; the last two are refused with a message
 * that names what was pasted instead of a bare length error.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeToken(raw) {
  if (typeof raw !== 'string') throw new Error('Token 必须是字符串')
  let token = raw.trim()
  if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1).trim()
  if (token.startsWith("'") && token.endsWith("'")) token = token.slice(1, -1).trim()
  token = token.replace(/^bearer\s+/i, '').trim()
  if (token === '') throw new Error('Token 为空')
  if (/\s/.test(token)) throw new Error('Token 中不能包含空白字符')
  if (looksLikeTokenId(token)) throw new Error('这看起来是 32 位 Token ID，不是 Token 值；请复制创建时显示的 Token')
  if (looksLikeGlobalKey(token)) throw new Error('这看起来是 Global API Key，本插件只支持 API Token')
  if (token.length < 20 || token.length > 200) throw new Error('Token 长度不合法，请检查是否复制完整')
  return token
}

/**
 * Cloudflare token IDs are 32 hex characters; token values are not.
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeTokenId(value) {
  return /^[0-9a-f]{32}$/i.test(value)
}

/**
 * The Global API Key is 37 hex characters.
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeGlobalKey(value) {
  return /^[0-9a-f]{37}$/i.test(value)
}

/**
 * Validate an optional Account ID. Account-owned tokens are verified against an
 * account, so this value is required for them and harmless for user tokens.
 * @param {unknown} raw
 * @returns {string | undefined}
 */
export function normalizeAccountId(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw !== 'string') throw new Error('Account ID 必须是字符串')
  const value = raw.trim()
  if (value === '') return undefined
  if (!/^[0-9a-f]{32}$/i.test(value)) throw new Error('Account ID 应为 32 位十六进制字符串')
  return value.toLowerCase()
}

/**
 * Build the credential-backed Token store over the Host context.
 * @param {{ get: (name: string) => unknown }} ctx
 */
export function createTokenStore(ctx) {
  const credentials = () => ctx.get('credentials')

  /**
   * Read the stored record.
   * @returns {Promise<string | undefined>}
   */
  async function storedToken() {
    const service = credentials()
    if (service === undefined || service === null) return undefined
    const record = await service.readRecord(RECORD_KEY)
    if (record === undefined || record === null) return undefined
    if (record.kind !== 'api-key') return undefined
    if (typeof record.key === 'string') return record.key
    if (typeof record.payload?.key === 'string') return record.payload.key
    return undefined
  }

  /**
   * Read the environment/environment-file fallback.
   * @returns {Promise<string | undefined>}
   */
  async function envToken() {
    const service = credentials()
    if (service === undefined || service === null) return undefined
    const resolved = await service.resolve(ENV_REF)
    return typeof resolved?.value === 'string' && resolved.value !== '' ? resolved.value : undefined
  }

  return {
    /**
     * Resolve the effective Token, or undefined when this machine has none.
     * @returns {Promise<string | undefined>}
     */
    async resolve() {
      return (await storedToken()) ?? (await envToken())
    },

    /**
     * Report configured state without exposing the value.
     * @returns {Promise<{ configured: boolean, masked?: string, source?: 'stored' | 'environment' }>}
     */
    async describe() {
      const stored = await storedToken()
      if (stored !== undefined) return { configured: true, masked: maskToken(stored), source: 'stored' }
      const env = await envToken()
      if (env !== undefined) return { configured: true, masked: maskToken(env), source: 'environment' }
      return { configured: false }
    },

    /**
     * Persist a Token as this plugin's credential record.
     * @param {string} token
     * @returns {Promise<void>}
     */
    async save(token) {
      const service = credentials()
      if (service === undefined || service === null) {
        throw new Error('当前 profile 没有凭据服务，无法保存 Token')
      }
      await service.modifyRecord(RECORD_KEY, async () => ({ kind: 'api-key', key: token }))
    },

    /**
     * Remove the stored Token. An environment fallback stays in force.
     * @returns {Promise<void>}
     */
    async clear() {
      const service = credentials()
      if (service === undefined || service === null) return
      await service.deleteRecord(RECORD_KEY)
    },
  }
}
