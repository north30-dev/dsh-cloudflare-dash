/**
 * Slice-window checks.
 *
 * The Host must never spin inside a request: an early version returned an empty
 * or zero-width slice when the chunk size was 0, so `sliceWindow` looped until
 * the process hit its heap limit and the desktop app died. These assertions pin
 * the terminating behaviour without needing a Token or a network.
 *
 * Run: node tests/slice-window.mjs
 */
import assert from 'node:assert/strict'
import { sliceWindow } from '../src/host/analytics.js'

const DAY = 24 * 3600 * 1000
const toMs = Date.UTC(2026, 10, 16, 12, 0, 0)

// A range without a chunk size stays exactly one slice covering the window.
const single = sliceWindow(toMs - 7 * DAY, toMs, undefined)
assert.equal(single.length, 1)
assert.equal(single[0].from.getTime(), toMs - 7 * DAY)
assert.equal(single[0].to.getTime(), toMs)

// A month in weeks: five contiguous slices, newest first, ending at the window.
const weekly = sliceWindow(toMs - 30 * DAY, toMs, 7 * DAY)
assert.equal(weekly.length, 5)
assert.equal(weekly[0].to.getTime(), toMs)
assert.equal(weekly[weekly.length - 1].from.getTime(), toMs - 30 * DAY)
for (let index = 0; index < weekly.length; index += 1) {
  assert.ok(weekly[index].from.getTime() < weekly[index].to.getTime(), 'every slice must have positive width')
  if (index > 0) assert.equal(weekly[index].to.getTime(), weekly[index - 1].from.getTime(), 'slices must be contiguous')
}

// Zero, negative and NaN chunk sizes are the shapes that used to loop forever.
for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const slices = sliceWindow(toMs - 7 * DAY, toMs, bad)
  assert.equal(slices.length, 1, `chunk ${String(bad)} must collapse to one slice`)
}

// A zero-width or inverted window still returns exactly one slice.
assert.equal(sliceWindow(toMs, toMs, 7 * DAY).length, 1)
assert.equal(sliceWindow(toMs, toMs - DAY, 7 * DAY).length, 1)

console.log('slice-window: all assertions passed')
