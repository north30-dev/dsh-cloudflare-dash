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
  '30d': { ms: 30 * 24 * 3600 * 1000, dimension: 'date', orderBy: 'date_ASC' },
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
 * Build the fixed dashboard document for one range.
 * Values are validated (hex tags, ISO instants) before interpolation, so the
 * document never carries caller-controlled text.
 * @param {{ accountTag: string, siteTag: string, from: string, to: string, previousFrom: string, previousTo: string, dimension: string, orderBy: string }} input
 * @returns {string}
 */
function buildQuery(input) {
  const current = `filter: { siteTag: "${input.siteTag}", datetime_geq: "${input.from}", datetime_leq: "${input.to}", bot: 0 }`
  const previous = `filter: { siteTag: "${input.siteTag}", datetime_geq: "${input.previousFrom}", datetime_leq: "${input.previousTo}", bot: 0 }`
  const top = (alias, dimension) =>
    `${alias}: rumPageloadEventsAdaptiveGroups(limit: ${TOP_LIMIT}, orderBy: [count_DESC], ${current}) { count sum { visits } dimensions { ${dimension} } }`
  return `query {
  viewer { accounts(filter: { accountTag: "${input.accountTag}" }) {
    totals: rumPageloadEventsAdaptiveGroups(limit: 1, ${current}) { count sum { visits } }
    previous: rumPageloadEventsAdaptiveGroups(limit: 1, ${previous}) { count sum { visits } }
    series: rumPageloadEventsAdaptiveGroups(limit: 400, orderBy: [${input.orderBy}], ${current}) { count sum { visits } dimensions { ${input.dimension} } }
    ${top('paths', 'requestPath')}
    ${top('referrers', 'refererHost')}
    ${top('countries', 'countryName')}
    ${top('browsers', 'userAgentBrowser')}
    ${top('devices', 'deviceType')}
    ${top('os', 'userAgentOS')}
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

  const query = buildQuery({
    accountTag: options.accountId,
    siteTag: site.siteTag,
    from: iso(from),
    to: iso(to),
    previousFrom: iso(new Date(now - spec.ms * 2)),
    previousTo: iso(from),
    dimension: spec.dimension,
    orderBy: spec.orderBy,
  })

  const data = await graphql(query, { token: options.token, proxy: options.proxy })
  const account = data?.viewer?.accounts?.[0] ?? {}
  const totalsRow = account.totals?.[0]
  const previousRow = account.previous?.[0]
  const series = Array.isArray(account.series) ? account.series : []

  const payload = {
    site: { siteTag: site.siteTag, host: site.host, enabled: site.enabled },
    range: options.range,
    window: { from: iso(from), to: iso(to) },
    totals: { visits: num(totalsRow?.sum?.visits), pageLoads: num(totalsRow?.count) },
    previous: { visits: num(previousRow?.sum?.visits), pageLoads: num(previousRow?.count) },
    series: series.map((row) => ({
      t: typeof row?.dimensions?.[spec.dimension] === 'string' ? row.dimensions[spec.dimension] : '',
      visits: num(row?.sum?.visits),
      pageLoads: num(row?.count),
    })).filter((point) => point.t !== ''),
    top: {
      paths: (account.paths ?? []).map((row) => rowOf(row, 'requestPath')).filter((row) => row.name !== ''),
      referrers: (account.referrers ?? []).map((row) => rowOf(row, 'refererHost')),
      countries: (account.countries ?? []).map((row) => rowOf(row, 'countryName')).filter((row) => row.name !== ''),
      browsers: (account.browsers ?? []).map((row) => rowOf(row, 'userAgentBrowser')).filter((row) => row.name !== ''),
      devices: (account.devices ?? []).map((row) => rowOf(row, 'deviceType')).filter((row) => row.name !== ''),
      os: (account.os ?? []).map((row) => rowOf(row, 'userAgentOS')).filter((row) => row.name !== ''),
    },
    vitals: vitalsOf(account.vitals?.[0]),
    performance: performanceOf(account.performance?.[0]),
    generatedAt: Date.now(),
  }

  overviewCache.set(cacheKey, { at: Date.now(), payload })
  return { ...payload, cached: false }
}
