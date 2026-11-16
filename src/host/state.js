/**
 * Non-secret plugin state.
 *
 * Two values live here: the Account ID an account-owned token belongs to, and
 * the proxy preference. Neither is a credential — the Account ID appears in
 * dashboard URLs and the proxy address refuses embedded credentials — but both
 * are durable facts about this machine that belong to the plugin, so
 * `$DSH_HOME/cloudflare-dash/state.json` keeps them out of the repository and
 * out of the profile's YAML layers.
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
 * Read the state document. A missing or unreadable file is an empty state: this
 * file is a convenience, never a source of truth for the token.
 * @returns {{ accountId?: string, proxy?: { enabled: boolean, url: string } }}
 */
export function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object') return {}
    /** @type {{ accountId?: string, proxy?: { enabled: boolean, url: string } }} */
    const state = {}
    if (typeof parsed.accountId === 'string') state.accountId = parsed.accountId
    if (parsed.proxy !== null && typeof parsed.proxy === 'object' && typeof parsed.proxy.url === 'string') {
      state.proxy = { enabled: parsed.proxy.enabled === true, url: parsed.proxy.url }
    }
    return state
  } catch {
    return {}
  }
}

/**
 * Merge a patch into the state document.
 * @param {{ accountId?: string | undefined, proxy?: { enabled: boolean, url: string } | undefined }} patch
 * @returns {{ accountId?: string, proxy?: { enabled: boolean, url: string } }}
 */
export function writeState(patch) {
  const next = { ...readState(), ...patch }
  if (next.accountId === undefined) delete next.accountId
  if (next.proxy === undefined || next.proxy === null) delete next.proxy
  try {
    const file = statePath()
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  } catch {
    // Persisting plugin state must never fail a verification.
  }
  return next
}
