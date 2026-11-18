/**
 * Sampling-summary checks.
 *
 * The panel now tells the user how much of a window was measured instead of
 * extrapolated. That claim must never be invented: an absent or unusable
 * `confidence` block has to read as "unknown", not as "exact". These assertions
 * pin the shapes observed on real Cloudflare responses (107 samples for 107
 * loads on a 7-day slice, 5 samples for 50 loads on a 30-day one).
 *
 * Run: node tests/sampling.mjs
 */
import assert from 'node:assert/strict'
import { summarizeSampling } from '../src/host/analytics.js'

/** One `totals` row with a confidence block. */
const row = (estimate, sampleSize) => ({ count: estimate, confidence: { count: { estimate, sampleSize } } })

// A seven-day slice: the sample size equals the estimate, so nothing is inferred.
const exact = summarizeSampling([row(107, 107)])
assert.equal(exact.sampled, false)
assert.equal(exact.known, 1)
assert.equal(exact.samples, 107)
assert.equal(exact.estimated, 107)

// The 30-day document that came back from Cloudflare: 50 loads out of 5 samples.
const sampled = summarizeSampling([row(50, 5)])
assert.equal(sampled.sampled, true)
assert.equal(sampled.sampledSlices, 1)
assert.equal(sampled.samples, 5)
assert.equal(sampled.estimated, 50)

// A range built from several slices adds up, and one sampled slice is enough to
// stop the whole range being described as exact.
const mixed = summarizeSampling([row(107, 107), row(50, 5), row(20, 20)])
assert.equal(mixed.slices, 3)
assert.equal(mixed.sampled, true)
assert.equal(mixed.sampledSlices, 1)
assert.equal(mixed.samples, 132)
assert.equal(mixed.estimated, 177)

// No confidence block means "unknown", never "exact".
for (const rows of [[], [undefined], [{}], [{ count: 10 }], [{ confidence: {} }]]) {
  const unknown = summarizeSampling(rows)
  assert.equal(unknown.sampled, false, `sampled must stay false for ${JSON.stringify(rows)}`)
  assert.equal(unknown.known, 0, `known must stay 0 for ${JSON.stringify(rows)}`)
  assert.equal(unknown.samples, 0)
  assert.equal(unknown.estimated, 0)
}

// An estimate of zero carries no information and must not count as a sample.
const zero = summarizeSampling([row(0, 0)])
assert.equal(zero.known, 0)
assert.equal(zero.sampled, false)

// Rows with partial garbage keep the usable part instead of throwing.
const partial = summarizeSampling([{ confidence: { count: { estimate: 12 } } }, row(8, 8)])
assert.equal(partial.known, 2)
assert.equal(partial.estimated, 20)
assert.equal(partial.samples, 8)
assert.equal(partial.sampledSlices, 1)
assert.equal(partial.sampled, true)

// A caller that passes something that is not an array still gets a shape back.
const nothing = summarizeSampling(undefined)
assert.equal(nothing.slices, 0)
assert.equal(nothing.sampled, false)

console.log('sampling: all assertions passed')
