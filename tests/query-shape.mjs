/**
 * Query-shape checks: the bot clause and the merged Top lists.
 *
 * Both decide what a user is looking at without changing any pixel of layout:
 * the bot clause changes what a number means, and the merge decides whether the
 * ranking shown is the one the fetched rows imply. Neither needs a network.
 *
 * Run: node tests/query-shape.mjs
 */
import assert from 'node:assert/strict'
import { botFilter, mergeTop } from '../src/host/analytics.js'

// --- bot clause ---

// Only the exact string 'all' includes bots; every other value keeps them out,
// so a wrong value can never silently change the meaning of a total.
assert.equal(botFilter('all'), '')
for (const value of ['exclude', undefined, null, '', 'ALL', 'true', 1, {}]) {
  assert.equal(botFilter(value), ', bot: 0', `bots=${JSON.stringify(value)} must exclude`)
}

// --- merged Top lists ---

/** One grouped row. */
const row = (name, pageLoads, visits) => ({
  count: pageLoads,
  sum: { visits },
  dimensions: { requestPath: name },
})

// The same path in two slices adds up instead of appearing twice.
const merged = mergeTop([
  { paths: [row('/a', 5, 3), row('/b', 12, 11)] },
  { paths: [row('/a', 4, 2), row('/c', 1, 1)] },
], 'paths', 'requestPath', false)
assert.deepEqual(merged.map((entry) => entry.name), ['/b', '/a', '/c'])
const a = merged.find((entry) => entry.name === '/a')
assert.deepEqual(a, { name: '/a', visits: 5, pageLoads: 9 })

// A blank dimension is a real row only where the caller says so: a direct
// referrer has no host, but a path with no request path is noise.
assert.deepEqual(
  mergeTop([{ paths: [row('', 7, 7)] }], 'paths', 'requestPath', false),
  [],
)
const blankKept = mergeTop([{ referrers: [{ count: 7, sum: { visits: 7 }, dimensions: { refererHost: '' } }] }], 'referrers', 'refererHost', true)
assert.deepEqual(blankKept, [{ name: '', visits: 7, pageLoads: 7 }])

// The merge caps at the per-slice fetch limit of twenty, keeping the biggest.
const many = Array.from({ length: 25 }, (_, index) => row(`/p${index}`, index + 1, index + 1))
const capped = mergeTop([{ paths: many }], 'paths', 'requestPath', false)
assert.equal(capped.length, 20)
assert.equal(capped[0].pageLoads, 25)
assert.equal(capped[capped.length - 1].pageLoads, 6)

// A missing alias or a non-array is an empty list, not a crash.
for (const accounts of [[{}], [undefined], [], null]) {
  assert.deepEqual(mergeTop(accounts, 'paths', 'requestPath', false), [])
}

console.log('query-shape: all assertions passed')
