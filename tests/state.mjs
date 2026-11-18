/**
 * Plugin-state checks.
 *
 * The settings page used to show empty account and site counts after every
 * restart, because the only copy of the verification result lived in the Host
 * process. It is now snapshotted into `state.json`, which makes the snapshot a
 * persisted claim about the world: it must round-trip, it must be cleared when
 * the Token is, and it must never carry anything but counts and a timestamp.
 *
 * Run: node tests/state.mjs
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = mkdtempSync(path.join(os.tmpdir(), 'cfd-state-'))
process.env.DSH_HOME = home

// Imported after DSH_HOME is set: the module resolves the path per call, but the
// environment has to be in place before the first one.
const { readState, writeState } = await import('../src/host/state.js')

const file = path.join(home, 'cloudflare-dash', 'state.json')

try {
  // A missing file is an empty state, not an error.
  assert.deepEqual(readState(), {})

  // A full document round-trips, snapshot included.
  writeState({
    accountId: '95d986d85154bdd18a0399650ad817e1',
    proxy: { enabled: true, url: 'http://127.0.0.1:7890' },
    access: { accounts: 3, rumSites: 7, verifiedAt: 1_700_000_000_000 },
  })
  const saved = readState()
  assert.equal(saved.accountId, '95d986d85154bdd18a0399650ad817e1')
  assert.deepEqual(saved.proxy, { enabled: true, url: 'http://127.0.0.1:7890' })
  assert.deepEqual(saved.access, { accounts: 3, rumSites: 7, verifiedAt: 1_700_000_000_000 })

  // Removing the Token drops the snapshot but keeps the account and proxy facts.
  writeState({ access: undefined })
  const cleared = readState()
  assert.equal(cleared.access, undefined)
  assert.equal(cleared.accountId, '95d986d85154bdd18a0399650ad817e1')
  assert.deepEqual(cleared.proxy, { enabled: true, url: 'http://127.0.0.1:7890' })

  // A malformed snapshot is dropped rather than surfaced as a count of NaN.
  for (const broken of [{ accounts: 1 }, { accounts: 1, rumSites: 2 }, { accounts: 'a', rumSites: 2, verifiedAt: 3 }, null]) {
    writeFileSync(file, JSON.stringify({ accountId: 'abc', access: broken }), 'utf8')
    const state = readState()
    assert.equal(state.access, undefined, `snapshot ${JSON.stringify(broken)} must be ignored`)
    assert.equal(state.accountId, 'abc')
  }

  // Counts are normalised: the panel renders them, so they are integers >= 0.
  writeState({ access: { accounts: 2.7, rumSites: -4, verifiedAt: 1_700_000_000_000.8 } })
  const normalised = readState().access
  assert.deepEqual(normalised, { accounts: 2, rumSites: 0, verifiedAt: 1_700_000_000_000 })

  // The file is state, not a credential store: no token-shaped field may appear.
  const text = readFileSync(file, 'utf8')
  for (const word of ['token', 'key', 'secret', 'Bearer']) {
    assert.equal(text.toLowerCase().includes(word.toLowerCase()), false, `state.json must not carry "${word}"`)
  }
} finally {
  rmSync(home, { recursive: true, force: true })
}

console.log('state: all assertions passed')
