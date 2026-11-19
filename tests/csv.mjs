/**
 * CSV export checks.
 *
 * The export is the one place where the panel's numbers leave the panel, so it
 * has to survive three things a UI does not: spreadsheets (quoting, UTF-8
 * detection), hostile input (a referrer host that looks like a formula), and
 * losing the context that makes a number interpretable (which window, which
 * sampling state).
 *
 * Run: node tests/csv.mjs
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const csvModule = await import(pathToFileURL(path.resolve('src/client/csv.js')).href)
const { buildOverviewCsv, csvFilename } = csvModule

const window = { from: '2026-10-19T12:00:00Z', to: '2026-11-18T12:00:00Z' }
const metric = (p75) => ({ good: 48, needs: 3, poor: 5, total: 56, p75 })

const data = {
  site: { siteTag: 'a'.repeat(32), host: 'example.com', enabled: true },
  range: '30d',
  bots: 'exclude',
  window,
  slices: 5,
  topLimit: 20,
  totals: { visits: 78, pageLoads: 107 },
  previous: { visits: 0, pageLoads: 0 },
  sampling: {
    current: { slices: 5, known: 2, sampled: true, sampledSlices: 1, samples: 96, estimated: 105 },
    previous: { slices: 5, known: 0, sampled: false, sampledSlices: 0, samples: 0, estimated: 0 },
  },
  series: [{ t: '2026-11-11', visits: 23, pageLoads: 23 }],
  top: {
    paths: [{ name: '/', visits: 61, pageLoads: 66 }, { name: '/a,b', visits: 1, pageLoads: 2 }],
    referrers: [{ name: '', visits: 72, pageLoads: 72 }, { name: "=cmd|' /C calc'!A0", visits: 1, pageLoads: 1 }],
    countries: [],
    browsers: [],
    devices: [],
    os: [],
  },
  vitals: {
    samples: 58,
    window,
    sampling: { known: true, samples: 58, estimated: 58, sampled: false },
    lcp: metric(1_212_000),
    inp: metric(8_000),
    cls: metric(0.05),
    fcp: metric(1_900_000),
    ttfb: metric(1_340_000),
  },
  performance: {
    samples: 70,
    window,
    sampling: { known: true, samples: 70, estimated: 70, sampled: false },
    pageLoad: 2_080_000,
    phases: { dns: 2_000, connection: 236_000, tls: 156_000, request: 305_000, response: 5_000, render: 837_000, firstPaint: 1_100_000, firstContentfulPaint: 1_220_000 },
  },
  generatedAt: 1_700_000_000_000,
  cacheAgeMs: 42_000,
}

const text = buildOverviewCsv(data)
const lines = text.trimEnd().split('\n')

// A header, then rows: the file must parse as one table, not several.
assert.equal(lines[0], 'section,key,metric,value')
assert.ok(lines.every((entry) => entry.split(',').length >= 4 || entry.includes('"')), 'every row must have four fields')

// The provider of the numbers and the window they cover.
assert.ok(text.includes('meta,,site,example.com'))
assert.ok(text.includes('meta,,range,30d'))
assert.ok(text.includes('meta,,bots,exclude'))
assert.ok(text.includes(`meta,,window_from,${window.from}`))
assert.ok(text.includes('meta,,generated_at,2023-11-14T22:13:20.000Z'))
// A truncated list must not read as a complete one.
assert.ok(text.includes('meta,,top_limit,20'))

// The caveats travel with the numbers: sampling and the quantile window.
assert.ok(text.includes('meta,,sampling_current_sampled,true'))
assert.ok(text.includes('meta,,sampling_current_samples,96'))
assert.ok(text.includes('meta,,sampling_previous_sampled,false'))
assert.ok(text.includes('meta,,vitals_sampled,false'))
assert.ok(text.includes(`meta,,quantile_window_from,${window.from}`))

// Totals and the trend.
assert.ok(text.includes('totals,,visits,78'))
assert.ok(text.includes('totals,,page_loads,107'))
assert.ok(text.includes('series,2026-11-11,visits,23'))
assert.ok(text.includes('series,2026-11-11,page_loads,23'))

// A comma in a page path stays one field.
assert.ok(text.includes('top_paths,"/a,b",page_loads,2'))
// A blank referrer is direct traffic, not an anonymous empty cell.
assert.ok(text.includes('top_referrers,(direct),visits,72'))
// An empty list contributes nothing, rather than a header with no rows.
assert.equal(lines.some((entry) => entry.startsWith('top_countries,')), false)

// Durations become milliseconds; a ratio must not be divided by 1000.
assert.ok(text.includes('vitals,LCP,p75_ms,1212'))
assert.ok(text.includes('vitals,CLS,p75_ratio,0.05'))
assert.ok(text.includes('performance,page_load,p75_ms,2080'))
assert.ok(text.includes('performance,DNS,p75_ms,2'))

// A visitor-controlled referrer must not reach a spreadsheet as a formula.
const formulaLine = lines.find((entry) => entry.startsWith('top_referrers,'))
assert.ok(!formulaLine.includes('top_referrers,=cmd'), 'a leading = must be neutralised')
assert.ok(text.includes("top_referrers,'=cmd"))

// A bad payload produces no file rather than a half-parsed one.
assert.equal(buildOverviewCsv(null), '')
assert.equal(buildOverviewCsv(undefined), '')

// A payload without quantiles simply has no quantile rows.
const bare = buildOverviewCsv({ site: { host: 'x' }, range: '7d', totals: {}, previous: {}, series: [], top: {} })
assert.equal(bare.includes('vitals,'), false)
assert.equal(bare.includes('performance,'), false)

// The filename names the view and stays filesystem-safe.
assert.match(csvFilename(data), /^cloudflare-example\.com-30d-\d{4}-\d{2}-\d{2}\.csv$/)
assert.match(csvFilename({ site: { host: 'a b/c' }, range: '7d' }), /^cloudflare-a_b_c-7d-/)

console.log('csv: all assertions passed')
