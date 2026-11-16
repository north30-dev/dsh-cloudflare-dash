/**
 * Non-secret plugin state.
 *
 * The only thing kept here is the Account ID an account-owned token belongs to.
 * It is not a credential (it appears in dashboard URLs), but it is durable and
 * belongs to this plugin, so `$DSH_HOME/cloudflare-dash/state.json` keeps it out
 * of the repository and out of the profile's YAML layers.
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
 * @returns {{ accountId?: string }}
 */
export function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object') return {}
    return typeof parsed.accountId === 'string' ? { accountId: parsed.accountId } : {}
  } catch {
    return {}
  }
}

/**
 * Merge a patch into the state document.
 * @param {{ accountId?: string | undefined }} patch
 * @returns {{ accountId?: string }}
 */
export function writeState(patch) {
  const next = { ...readState(), ...patch }
  if (next.accountId === undefined) delete next.accountId
  try {
    const file = statePath()
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  } catch {
    // Persisting the account id must never fail a verification.
  }
  return next
}
