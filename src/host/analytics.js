/**
 * Web Analytics (RUM) data layer.
 *
 * Queries are built here, never accepted from the browser: the Token can only be
 * spent on this module's fixed documents. All aggregation uses `bot: 0` so the
 * numbers track what the Cloudflare dashboard shows, and the hourly dimension is
 * returned in UTC for the browser to localize.
 */
import { CloudflareError, callApi, graphql } from './cloudflare.js'

const SITE_CACHE_MS = 60_000
const TOP_LIMIT = 6

/** How long one dashboard payload may be served from memory before re-querying. */
const OVERVIEW_TTL_MS = { '24h': 60_000, '7d': 120_000, '30d': 300_000 }

/**
 * In-memory dashboard cache. A manual refresh bypasses it; automatic refreshes
 * reuse it so a 60s poll cannot burn the GraphQL budget.
 * @type {Map<string, { at: number, payload: any }>}
 */
const overviewCache = new Map()

/** Drop every cached dashboard payload (after a Token change). */
export function clearOverviewCache() {
  overviewCache.clear()
}

/** @type {{ key: string, at: number, sites: Array<{ siteTag: string, host: string, enabled: boolean, created?: string }> }} */
let siteCache = { key: '', at: 0, sites: [] }

/** Supported time ranges and their aggregation step. */
export const RANGES = {
  '24h': { ms: 24 * 3600 * 1000, dimension: 'datetimeHour', orderBy: 'datetimeHour_ASC' },
  '7d': { ms: 7 * 24 * 3600 * 1000, dimension: 'date', orderBy: 'date_ASC' },
  // A month is fetched as weeks: Cloudflare's ABR sampling coarsens a 30-day
  // aggregate to the point of returning a couple of days with counts rounded to
  // tens, while the same days queried a week at a time come back exact. Ranges
  // without `chunkMs` stay a single query.
  '30d': { ms: 30 * 24 * 3600 * 1000, dimension: 'date', orderBy: 'date_ASC', chunkMs: 7 * 24 * 3600 * 1000 },
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Pick the display host out of one RUM site record.
 * @param {any} site
 * @returns {string}
 */
function hostOf(site) {
  const ruleHost = Array.isArray(site?.rules) ? site.rules.find((rule) => typeof rule?.host === 'string' && rule.host !== '')?.host : undefined
  if (typeof ruleHost === 'string') return ruleHost
  if (typeof site?.ruleset?.zone_name === 'string') return site.ruleset.zone_name
  return 'unknown'
}

/**
 * List the account's Web Analytics sites.
 * @param {{ accountId: string, token: string, proxy?: { host: string, port: number } }} options
 * @returns {Promise<Array<{ siteTag: string, host: string, enabled: boolean, created?: string }>>}
 */
export async function listSites(options) {
  const key = options.accountId
  if (siteCache.key === key && Date.now() - siteCache.at < SITE_CACHE_MS) return siteCache.sites
  const result = await callApi(`/accounts/${options.accountId}/rum/site_info/list?per_page=50`, options)
  const sites = (Array.isArray(result) ? result : [])
    .map((site) => ({
      siteTag: typeof site?.site_tag === 'string' ? site.site_tag : '',
      host: hostOf(site),
      enabled: site?.ruleset?.enabled !== false,
      ...(typeof site?.created === 'string' ? { created: site.created } : {}),
    }))
    .filter((site) => site.siteTag !== '')
  siteCache = { key, at: Date.now(), sites }
  return sites
}

/**
 * Shape one grouped row.
 * @param {any} row
 * @param {string} dimension
 */
function rowOf(row, dimension) {
  return {
    name: typeof row?.dimensions?.[dimension] === 'string' ? row.dimensions[dimension] : '',
    visits: num(row?.sum?.visits),
    pageLoads: num(row?.count),
  }
}

/**
 * Shape the Core Web Vitals dataset.
 * @param {any} row
 */
function vitalsOf(row) {
  if (row === undefined || row === null) return null
  const sum = row.sum ?? {}
  const quantiles = row.quantiles ?? {}
  /**
   * @param {string} key
   * @param {string} p75
   */
  const metric = (key, p75) => ({
    good: num(sum[`${key}Good`]),
    needs: num(sum[`${key}NeedsImprovement`]),
    poor: num(sum[`${key}Poor`]),
    total: num(sum[`${key}Total`]),
    p75: typeof quantiles[p75] === 'number' ? quantiles[p75] : null,
  })
  return {
    samples: num(row.count),
    visits: num(sum.visits),
    lcp: metric('lcp', 'largestContentfulPaintP75'),
    inp: metric('inp', 'interactionToNextPaintP75'),
    cls: metric('cls', 'cumulativeLayoutShiftP75'),
    fcp: metric('fcp', 'firstContentfulPaintP75'),
    ttfb: metric('ttfb', 'timeToFirstByteP75'),
  }
}

/**
 * Shape the loading-performance dataset.
 * @param {any} row
 */
function performanceOf(row) {
  if (row === undefined || row === null) return null
  const quantiles = row.quantiles ?? {}
  /** @param {string} key */
  const phase = (key) => (typeof quantiles[key] === 'number' ? quantiles[key] : null)
  return {
    samples: num(row.count),
    pageLoad: phase('pageLoadTimeP75'),
    phases: {
      dns: phase('dnsTimeP75'),
      connection: phase('connectionTimeP75'),
      tls: phase('tlsTimeP75'),
      request: phase('requestTimeP75'),
      response: phase('responseTimeP75'),
      render: phase('pageRenderTimeP75'),
      firstPaint: phase('firstPaintP75'),
      firstContentfulPaint: phase('firstContentfulPaintP75'),
    },
  }
}

/**
 * Build the grouped-rows document for one slice of the window: the trend series,
 * the six dimension lists, and that slice's own totals.
 *
 * Slices exist because Cloudflare lowers the resolution of these aggregates as
 * the requested window grows (ABR sampling). A 30-day request came back with two
 * of the six days that held traffic and counts rounded to tens, while the same
 * week queried alone came back complete; the Cloudflare docs recommend weekly
 * ranges over monthly ones for exactly this reason.
 *
 * Values are validated (hex tags, ISO instants) before interpolation, so the
 * document never carries caller-controlled text.
 * @param {{ accountTag: string, siteTag: string, from: string, to: string, dimension: string, orderBy: string }} input
 * @returns {string}
 */
function buildSliceQuery(input) {
  const current = `filter: { siteTag: "${input.siteTag}", datetime_geq: "${input.from}", datetime_leq: "${input.to}", bot: 0 }`
  const top = (alias, dimension) =>
    `${alias}: rumPageloadEventsAdaptiveGroups(limit: ${TOP_LIMIT}, orderBy: [count_DESC], ${current}) { count sum { visits } dimensions { ${dimension} } }`
  return `query {
  viewer { accounts(filter: { accountTag: "${input.accountTag}" }) {
    totals: rumPageloadEventsAdaptiveGroups(limit: 1, ${current}) { count sum { visits } }
    series: rumPageloadEventsAdaptiveGroups(limit: 400, orderBy: [${input.orderBy}], ${current}) { count sum { visits } dimensions { ${input.dimension} } }
    ${top('paths', 'requestPath')}
    ${top('referrers', 'refererHost')}
    ${top('countries', 'countryName')}
    ${top('browsers', 'userAgentBrowser')}
    ${top('devices', 'deviceType')}
    ${top('os', 'userAgentOS')}
  } }
}`
}

/**
 * Build the document for the rows that cannot be summed across slices: the
 * previous window's totals, and the two quantile datasets (a P75 does not add
 * up). They stay whole-window, so their numbers may be a sampled estimate.
 * @param {{ accountTag: string, siteTag: string, from: string, to: string, previousFrom: string, previousTo: string }} input
 * @returns {string}
 */
function buildSummaryQuery(input) {
  const current = `filter: { siteTag: "${input.siteTag}", datetime_geq: "${input.from}", datetime_leq: "${input.to}", bot: 0 }`
  const previous = `filter: { siteTag: "${input.siteTag}", datetime_geq: "${input.previousFrom}", datetime_leq: "${input.previousTo}", bot: 0 }`
  return `query {
  viewer { accounts(filter: { accountTag: "${input.accountTag}" }) {
    previous: rumPageloadEventsAdaptiveGroups(limit: 1, ${previous}) { count sum { visits } }
    performance: rumPerformanceEventsAdaptiveGroups(limit: 1, ${current}) {
      count
      quantiles { pageLoadTimeP75 dnsTimeP75 connectionTimeP75 tlsTimeP75 requestTimeP75 responseTimeP75 pageRenderTimeP75 firstPaintP75 firstContentfulPaintP75 }
    }
    vitals: rumWebVitalsEventsAdaptiveGroups(limit: 1, ${current}) {
      count
      sum { visits lcpGood lcpNeedsImprovement lcpPoor lcpTotal inpGood inpNeedsImprovement inpPoor inpTotal clsGood clsNeedsImprovement clsPoor clsTotal fcpGood fcpNeedsImprovement fcpPoor fcpTotal ttfbGood ttfbNeedsImprovement ttfbPoor ttfbTotal }
      quantiles { largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 firstContentfulPaintP75 timeToFirstByteP75 }
    }
  } }
}`
}

/**
 * Cut a window into disjoint slices, newest first. A range without a chunk size
 * stays one slice, so its result is the query the dashboard always made.
 *
 * Both guards are load-bearing: a chunk size of 0 or a NaN window used to leave
 * `begin === end`, so the loop never advanced and the Host allocated slices until
 * it hit its heap limit. Nothing may spin here — the caller runs inside a request.
 * @param {number} fromMs
 * @param {number} toMs
 * @param {number | undefined} chunkMs
 * @returns {Array<{ from: Date, to: Date }>}
 */
export function sliceWindow(fromMs, toMs, chunkMs) {
  const chunk = typeof chunkMs === 'number' && Number.isFinite(chunkMs) && chunkMs > 0    ? chunkMs
    : toMs - fromMs
  if (!Number.isFinite(chunk) || chunk <= 0 || !(toMs > fromMs)) {
    return [{ from: new Date(fromMs), to: new Date(toMs) }]
  }
  const slices = []
  let end = toMs
  // At most one slice per day of the window: a wrong chunk size can never make
  // this loop more than a few dozen times.
  for (let guard = 0; guard < 400; guard += 1) {
    if (!(end > fromMs)) break
    const begin = Math.max(end - chunk, fromMs)
    if (!(begin < end)) break
    slices.push({ from: new Date(begin), to: new Date(end) })
    end = begin
  }
  if (slices.length === 0) return [{ from: new Date(fromMs), to: new Date(toMs) }]
  return slices
}

/**
 * Fold per-slice top lists into one ranking. Each slice contributes only its own
 * rows, so a name that stays below the cut in every slice can miss the merged
 * list; the panel wants a short list, and the alternative — unbounded group
 * sizes — is what makes Cloudflare lower the resolution in the first place.
 * @param {any[]} accounts
 * @param {string} alias
 * @param {string} dimension
 * @param {boolean} keepBlank whether a blank dimension value is a real row (direct referrers)
 * @returns {Array<{ name: string, visits: number, pageLoads: number }>}
 */
function mergeTop(accounts, alias, dimension, keepBlank) {
  const merged = new Map()
  for (const account of accounts) {
    const rows = Array.isArray(account?.[alias]) ? account[alias] : []
    for (const row of rows) {
      const entry = rowOf(row, dimension)
      if (entry.name === '' && keepBlank !== true) continue
      const current = merged.get(entry.name)
      if (current === undefined) {
        merged.set(entry.name, entry)
      } else {
        current.visits += entry.visits
        current.pageLoads += entry.pageLoads
      }
    }
  }
  return [...merged.values()]
    .sort((left, right) => right.pageLoads - left.pageLoads)
    .slice(0, TOP_LIMIT)
}

/**
 * Fetch one dashboard payload.
 * @param {{
 *   accountId: string,
 *   siteTag: string,
 *   range: string,
 *   token: string,
 *   proxy?: { host: string, port: number },
 *   fresh?: boolean,
 * }} options
 * @returns {Promise<object>}
 */
export async function fetchOverview(options) {
  const spec = RANGES[options.range]
  if (spec === undefined) throw new CloudflareError('bad-range', '不支持的时间范围')
  if (!/^[0-9a-f]{32}$/i.test(options.siteTag)) throw new CloudflareError('bad-site', 'siteTag 不合法')

  const cacheKey = `${options.accountId}:${options.siteTag}:${options.range}`
  const cached = overviewCache.get(cacheKey)
  if (options.fresh !== true && cached !== undefined && Date.now() - cached.at < OVERVIEW_TTL_MS[options.range]) {
    return { ...cached.payload, cached: true }
  }

  const sites = await listSites(options)
  const site = sites.find((entry) => entry.siteTag === options.siteTag)
  if (site === undefined) throw new CloudflareError('unknown-site', '该站点不属于当前账户')

  const now = Date.now()
  const from = new Date(now - spec.ms)
  const to = new Date(now)
  const iso = (value) => value.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const slices = sliceWindow(from.getTime(), to.getTime(), spec.chunkMs)
  const window = { from: iso(from), to: iso(to) }
  const filter = { accountTag: options.accountId, siteTag: site.siteTag }
  const transport = { token: options.token, proxy: options.proxy }

  // The summary and every slice go out together: a 30d view is six requests
  // instead of one, which is what buys back the days Cloudflare's sampling drops.
  const [summary, ...parts] = await Promise.all([
    graphql(buildSummaryQuery({
      ...filter,
      ...window,
      previousFrom: iso(new Date(now - spec.ms * 2)),
      previousTo: iso(from),
    }), transport),
    ...slices.map((slice) => graphql(buildSliceQuery({
      ...filter,
      from: iso(slice.from),
      to: iso(slice.to),
      dimension: spec.dimension,
      orderBy: spec.orderBy,
    }), transport)),
  ])

  const accounts = parts.map((part) => part?.viewer?.accounts?.[0] ?? {})
  const summaryAccount = summary?.viewer?.accounts?.[0] ?? {}

  // Totals come from the slices, not from a whole-window aggregate: on a sampled
  // window that aggregate is an estimate that can disagree with the very series
  // drawn underneath it.
  const totals = { visits: 0, pageLoads: 0 }
  const seriesByBucket = new Map()
  for (const account of accounts) {
    totals.visits += num(account.totals?.[0]?.sum?.visits)
    totals.pageLoads += num(account.totals?.[0]?.count)
    for (const row of Array.isArray(account.series) ? account.series : []) {
      const key = row?.dimensions?.[spec.dimension]
      if (typeof key !== 'string' || key === '') continue
      const bucket = seriesByBucket.get(key) ?? { t: key, visits: 0, pageLoads: 0 }
      // Slices share their boundary instant, so a bucket cut by one slice
      // continues in the next; adding the parts restores the whole bucket.
      bucket.visits += num(row?.sum?.visits)
      bucket.pageLoads += num(row?.count)
      seriesByBucket.set(key, bucket)
    }
  }
  const series = [...seriesByBucket.values()].sort((left, right) => (left.t < right.t ? -1 : left.t > right.t ? 1 : 0))
  const previousRow = summaryAccount.previous?.[0]

  const payload = {
    site: { siteTag: site.siteTag, host: site.host, enabled: site.enabled },
    range: options.range,
    window,
    slices: slices.length,
    totals,
    previous: { visits: num(previousRow?.sum?.visits), pageLoads: num(previousRow?.count) },
    series,
    top: {
      paths: mergeTop(accounts, 'paths', 'requestPath', false),
      referrers: mergeTop(accounts, 'referrers', 'refererHost', true),
      countries: mergeTop(accounts, 'countries', 'countryName', false),
      browsers: mergeTop(accounts, 'browsers', 'userAgentBrowser', false),
      devices: mergeTop(accounts, 'devices', 'deviceType', false),
      os: mergeTop(accounts, 'os', 'userAgentOS', false),
    },
    // Quantiles do not add up across slices, so these stay whole-window: they
    // can be a sampled estimate, but a P75 is still a P75.
    vitals: vitalsOf(summaryAccount.vitals?.[0]),
    performance: performanceOf(summaryAccount.performance?.[0]),
    generatedAt: Date.now(),
  }

  overviewCache.set(cacheKey, { at: Date.now(), payload })
  return { ...payload, cached: false }
}
