/**
 * Non-secret plugin state.
 *
 * Three values live here: the Account ID an account-owned token belongs to, the
 * proxy preference, and a snapshot of the last successful verification. None is
 * a credential — the Account ID appears in dashboard URLs, the proxy address
 * refuses embedded credentials, and the snapshot holds only counts — but all are
 * durable facts about this machine that belong to the plugin, so
 * `$DSH_HOME/cloudflare-dash/state.json` keeps them out of the repository and
 * out of the profile's YAML layers.
 *
 * The verification snapshot exists because the in-process copy dies with the
 * Host: without it, a restart left the settings page showing empty account and
 * site counts for a Token that was still perfectly configured.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Resolve the state file path.
 * @returns {string}
 */
function statePath() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : path.join(os.homedir(), '.dsh')
  return path.join(home, 'cloudflare-dash', 'state.json')
}

/**
 * Keep only the non-secret parts of a verification result.
 * @param {unknown} raw
 * @returns {{ accounts: number, rumSites: number, verifiedAt: number } | undefined}
 */
function accessOf(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  const value = /** @type {any} */ (raw)
  if (!Number.isFinite(value.accounts) || !Number.isFinite(value.rumSites)) return undefined
  if (!Number.isFinite(value.verifiedAt)) return undefined
  return {
    accounts: Math.max(0, Math.trunc(value.accounts)),
    rumSites: Math.max(0, Math.trunc(value.rumSites)),
    verifiedAt: Math.trunc(value.verifiedAt),
  }
}

/**
 * Read the state document. A missing or unreadable file is an empty state: this
 * file is a convenience, never a source of truth for the token.
 * @returns {{ accountId?: string, proxy?: { enabled: boolean, url: string }, access?: { accounts: number, rumSites: number, verifiedAt: number } }}
 */
export function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object') return {}
    /** @type {{ accountId?: string, proxy?: { enabled: boolean, url: string }, access?: { accounts: number, rumSites: number, verifiedAt: number } }} */
    const state = {}
    if (typeof parsed.accountId === 'string') state.accountId = parsed.accountId
    if (parsed.proxy !== null && typeof parsed.proxy === 'object' && typeof parsed.proxy.url === 'string') {
      state.proxy = { enabled: parsed.proxy.enabled === true, url: parsed.proxy.url }
    }
    const access = accessOf(parsed.access)
    if (access !== undefined) state.access = access
    return state
  } catch {
    return {}
  }
}

/**
 * Merge a patch into the state document.
 * @param {{
 *   accountId?: string | undefined,
 *   proxy?: { enabled: boolean, url: string } | undefined,
 *   access?: { accounts: number, rumSites: number, verifiedAt: number } | undefined,
 * }} patch
 * @returns {{ accountId?: string, proxy?: { enabled: boolean, url: string }, access?: { accounts: number, rumSites: number, verifiedAt: number } }}
 */
export function writeState(patch) {
  const next = { ...readState(), ...patch }
  if (next.accountId === undefined) delete next.accountId
  if (next.proxy === undefined || next.proxy === null) delete next.proxy
  if (next.access === undefined || next.access === null) delete next.access
  try {
    const file = statePath()
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  } catch {
    // Persisting plugin state must never fail a verification.
  }
  return next
}
