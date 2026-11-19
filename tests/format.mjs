/**
 * Date helper checks.
 *
 * `daysSince` feeds the "created N days ago" note in the panel header, from
 * Cloudflare's own `created` stamp. That stamp carries six fractional digits
 * (`2026-11-11T15:04:46.023839Z`), which older engines refuse to parse, so the
 * trimming is the part worth pinning — a silent NaN there would simply hide the
 * note, which looks like the API never sent a date.
 *
 * Run: node tests/format.mjs
 */
import assert from 'node:assert/strict'
import { daysSince } from '../src/client/format.js'

const DAY = 86_400_000

// The real shape Cloudflare returns, measured one week later.
const CREATED = '2026-11-11T15:04:46.023839Z'
const WEEK_LATER = Date.parse('2026-11-18T15:04:46.023Z')
assert.equal(daysSince(CREATED, WEEK_LATER), 7)

// Four minutes earlier is still six whole days: the note counts elapsed days,
// so it must not round up.
assert.equal(daysSince(CREATED, WEEK_LATER - 4 * 60_000), 6)

// Three fractional digits and none at all parse the same way.
assert.equal(daysSince('2026-11-11T15:04:46.023Z', WEEK_LATER), 7)
assert.equal(daysSince('2026-11-11T15:04:46Z', WEEK_LATER), 7)

// A site set up this morning is day zero, not a negative age.
assert.equal(daysSince('2026-11-18T09:00:00.000000Z', WEEK_LATER), 0)

// Anything unusable reads as "unknown", never as a number.
for (const value of [undefined, null, '', 123, {}, 'not-a-date', '2026-13-45T00:00:00Z']) {
  assert.equal(daysSince(value, WEEK_LATER), null, `daysSince(${JSON.stringify(value)}) must be null`)
}

// A future stamp is not an age either.
assert.equal(daysSince('2026-12-01T00:00:00.000000Z', WEEK_LATER), null)

// A caller that forgets `now` still gets a number for a past stamp.
assert.equal(typeof daysSince('2026-01-01T00:00:00.000000Z'), 'number')
assert.equal(daysSince('2026-01-01T00:00:00.000000Z', WEEK_LATER + 300 * DAY) > 300, true)

console.log('format: all assertions passed')
