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
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeToken(raw) {
  if (typeof raw !== 'string') throw new Error('Token 必须是字符串')
  const token = raw.trim()
  if (token === '') throw new Error('Token 为空')
  if (/\s/.test(token)) throw new Error('Token 中不能包含空白字符')
  if (token.length < 20 || token.length > 200) throw new Error('Token 长度不合法，请检查是否复制完整')
  return token
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
