/**
 * CSV export of the current view.
 *
 * Pure string building, no DOM: the panel hands it a payload and gets text back,
 * so the shape can be unit-tested without a browser.
 *
 * The export leads with `meta` rows on purpose. A CSV that carried only the
 * numbers would strip them of everything the panel says about them — which
 * window the quantiles describe, whether a slice was sampled, whether bots are
 * included — and those are exactly the caveats that make the numbers usable.
 *
 * Layout is long-form (`section,key,metric,value`) rather than one wide table:
 * the six dimensions, the trend and the quantile blocks have nothing in common,
 * and a wide table would either drop sections or fill with empty cells.
 */

/** Quantile blocks, in the order the panel shows them: [key, label, isRatio]. */
const VITALS = [
  ['lcp', 'LCP', false],
  ['inp', 'INP', false],
  ['cls', 'CLS', true],
  ['fcp', 'FCP', false],
  ['ttfb', 'TTFB', false],
]

/** Loading phases, in timeline order. */
const PHASES = [
  ['dns', 'DNS'],
  ['connection', 'TCP connect'],
  ['tls', 'TLS'],
  ['request', 'request'],
  ['response', 'response'],
  ['render', 'render'],
  ['firstPaint', 'first paint'],
  ['firstContentfulPaint', 'FCP'],
]

/** Top lists, in the order the panel shows them. */
const LISTS = ['paths', 'referrers', 'countries', 'browsers', 'devices', 'os']

/**
 * One CSV field.
 *
 * A referrer host is visitor-controlled, so a value may begin with a character
 * that spreadsheets treat as a formula (`=`, `+`, `-`, `@`). Prefixing those
 * with an apostrophe keeps Excel and Numbers from evaluating an export that
 * came from an analytics stream.
 * @param {unknown} value
 * @returns {string}
 */
function cell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const text = String(value)
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/**
 * Join one row.
 * @param {unknown[]} fields
 * @returns {string}
 */
function line(fields) {
  return fields.map(cell).join(',')
}

/**
 * Microseconds to milliseconds, with one decimal.
 * @param {unknown} micros
 * @returns {string | number}
 */
function ms(micros) {
  if (typeof micros !== 'number' || !Number.isFinite(micros)) return ''
  return Math.round(micros / 100) / 10
}

/**
 * A unitless score such as CLS, to three decimals. It is not a duration, so it
 * must not go through the microsecond conversion.
 * @param {unknown} value
 * @returns {string | number}
 */
function ratio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return Math.round(value * 1000) / 1000
}

/**
 * Sample counts, or blank when the block is missing.
 * @param {{ samples?: number, total?: number } | undefined} metric
 * @param {string} field
 * @returns {string | number}
 */
function count(metric, field) {
  const value = metric?.[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : ''
}

/**
 * Build the CSV for one overview payload.
 * @param {any} data
 * @returns {string}
 */
export function buildOverviewCsv(data) {
  if (data === null || typeof data !== 'object') return ''
  const rows = [line(['section', 'key', 'metric', 'value'])]

  // Everything a reader needs to interpret the numbers, or to reproduce them.
  const meta = (metric, value) => rows.push(line(['meta', '', metric, value]))
  meta('site', data.site?.host ?? '')
  meta('site_tag', data.site?.siteTag ?? '')
  meta('range', data.range ?? '')
  meta('bots', data.bots ?? '')
  meta('window_from', data.window?.from ?? '')
  meta('window_to', data.window?.to ?? '')
  meta('generated_at', typeof data.generatedAt === 'number' ? new Date(data.generatedAt).toISOString() : '')
  meta('cache_age_ms', typeof data.cacheAgeMs === 'number' ? data.cacheAgeMs : '')
  meta('slices', typeof data.slices === 'number' ? data.slices : '')
  // A list longer than this was cut: say so, or the file implies it is complete.
  meta('top_limit', typeof data.topLimit === 'number' ? data.topLimit : '')

  // Which window the quantiles describe, and how much of each block was
  // extrapolated rather than measured.
  meta('quantile_window_from', data.vitals?.window?.from ?? data.performance?.window?.from ?? '')
  meta('quantile_window_to', data.vitals?.window?.to ?? data.performance?.window?.to ?? '')
  for (const [prefix, sampling] of [['sampling_current', data.sampling?.current], ['sampling_previous', data.sampling?.previous]]) {
    if (sampling === undefined || sampling === null) continue
    meta(`${prefix}_sampled`, sampling.sampled === true ? 'true' : 'false')
    meta(`${prefix}_samples`, typeof sampling.samples === 'number' ? sampling.samples : '')
    meta(`${prefix}_estimated`, typeof sampling.estimated === 'number' ? sampling.estimated : '')
  }
  for (const [prefix, block] of [['vitals', data.vitals], ['performance', data.performance]]) {
    const sampling = block?.sampling
    if (sampling === undefined || sampling === null) continue
    meta(`${prefix}_sampled`, sampling.sampled === true ? 'true' : 'false')
    meta(`${prefix}_samples`, typeof sampling.samples === 'number' ? sampling.samples : '')
    meta(`${prefix}_estimated`, typeof sampling.estimated === 'number' ? sampling.estimated : '')
  }

  rows.push(line(['totals', '', 'visits', data.totals?.visits ?? 0]))
  rows.push(line(['totals', '', 'page_loads', data.totals?.pageLoads ?? 0]))
  rows.push(line(['previous', '', 'visits', data.previous?.visits ?? 0]))
  rows.push(line(['previous', '', 'page_loads', data.previous?.pageLoads ?? 0]))

  for (const point of Array.isArray(data.series) ? data.series : []) {
    rows.push(line(['series', point.t, 'visits', point.visits ?? 0]))
    rows.push(line(['series', point.t, 'page_loads', point.pageLoads ?? 0]))
  }

  for (const key of LISTS) {
    const entries = Array.isArray(data.top?.[key]) ? data.top[key] : []
    for (const entry of entries) {
      // A blank dimension is a real row for referrers (direct traffic); keep it
      // visible instead of exporting an anonymous empty cell.
      const name = entry.name === '' ? '(direct)' : entry.name
      rows.push(line([`top_${key}`, name, 'page_loads', entry.pageLoads ?? 0]))
      rows.push(line([`top_${key}`, name, 'visits', entry.visits ?? 0]))
    }
  }

  if (data.vitals !== null && data.vitals !== undefined) {
    for (const [key, label, isRatio] of VITALS) {
      const metric = data.vitals[key]
      if (metric === undefined) continue
      rows.push(line(['vitals', label, isRatio ? 'p75_ratio' : 'p75_ms', isRatio ? ratio(metric.p75) : ms(metric.p75)]))
      rows.push(line(['vitals', label, 'good', count(metric, 'good')]))
      rows.push(line(['vitals', label, 'needs_improvement', count(metric, 'needs')]))
      rows.push(line(['vitals', label, 'poor', count(metric, 'poor')]))
      rows.push(line(['vitals', label, 'total', count(metric, 'total')]))
    }
  }

  if (data.performance !== null && data.performance !== undefined) {
    rows.push(line(['performance', 'page_load', 'p75_ms', ms(data.performance.pageLoad)]))
    for (const [key, label] of PHASES) {
      rows.push(line(['performance', label, 'p75_ms', ms(data.performance.phases?.[key])]))
    }
  }

  return `${rows.join('\n')}\n`
}

/**
 * A filename that survives a filesystem and still names the view.
 * @param {any} data
 * @returns {string}
 */
export function csvFilename(data) {
  const host = String(data?.site?.host ?? 'site').replace(/[^a-z0-9.-]+/gi, '_')
  const stamp = new Date().toISOString().slice(0, 10)
  return `cloudflare-${host}-${data?.range ?? 'range'}-${stamp}.csv`
}
