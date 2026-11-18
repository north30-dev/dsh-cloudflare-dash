/**
 * The plugin's single agent tool.
 *
 * One tool with an `action` parameter instead of one tool per view: every tool
 * definition sits in the model's prompt on every step, and the panel is already
 * the place with charts. Registered only while a Token is configured, so a
 * profile that never sets one pays nothing.
 *
 * The result is a bounded text report, not the dashboard payload: the model
 * needs numbers and names, while the full lists, trend chart, and vitals bars
 * stay in the panel. Cloudflare's RUM API is read-only here — no call mutates
 * an account.
 */
import { CloudflareError } from './cloudflare.js'
import { RANGES, fetchOverview, listSites } from './analytics.js'
import { proxyFromSettings } from './http.js'
import { readState } from './state.js'
import { createTokenStore } from './store.js'

export const TOOL_NAME = 'cloudflare_analytics'

/** How long a credential-store read may answer the registration condition. */
const PRESENCE_TTL_MS = 30_000

const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: {
      type: 'string',
      enum: ['overview', 'sites', 'status'],
      description: 'overview reads traffic, Core Web Vitals, and loading phases; sites lists the Web Analytics sites and their site tags; status reports whether a Token and Account ID are configured, without calling Cloudflare.',
    },
    site: {
      type: 'string',
      description: 'For overview: a site tag or hostname from action=sites. Defaults to the first site of the account.',
    },
    range: {
      type: 'string',
      enum: ['24h', '7d', '30d'],
      description: 'For overview: the reporting window, ending now. Defaults to 7d.',
    },
    fresh: {
      type: 'boolean',
      description: 'For overview: skip the short-lived result cache and query Cloudflare again. Defaults to false.',
    },
  },
}

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['report'],
  properties: {
    report: {
      type: 'string',
      description: 'The answer as plain text: totals, previous-period deltas, top lists, Core Web Vitals, and loading phases.',
    },
  },
}

/**
 * Format a count with thousands separators.
 * @param {unknown} value
 * @returns {string}
 */
function int(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—'
}

/**
 * Format a microsecond duration. Cloudflare reports these in microseconds.
 * @param {number | null | undefined} micros
 * @returns {string}
 */
function duration(micros) {
  if (typeof micros !== 'number' || !Number.isFinite(micros)) return '—'
  const ms = micros / 1000
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${Math.round(ms)} ms`
}

/**
 * Format the unitless CLS score, which is not a duration.
 * @param {number | null | undefined} value
 * @returns {string}
 */
function score(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3) : '—'
}

/**
 * Percentage of a total, or a dash when there are no samples.
 * @param {number} part
 * @param {number} total
 * @returns {string}
 */
function share(part, total) {
  if (!(total > 0)) return '—'
  return `${Math.round((part / total) * 100)}%`
}

/**
 * Percentage change against the previous period.
 * @param {number} current
 * @param {number} previous
 * @returns {string}
 */
function delta(current, previous) {
  if (!(previous > 0)) return 'n/a'
  const pct = ((current - previous) / previous) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * One comparable phrase for a total: change plus the baseline it was measured
 * against, or an explicit statement that there is no baseline at all.
 * @param {number} current
 * @param {number} previous
 * @returns {string}
 */
function comparison(current, previous) {
  if (!(previous > 0)) return 'no previous-period data'
  return `${delta(current, previous)} vs ${int(previous)} previous`
}

/**
 * Describe which period a quantile block covers, or nothing when it covers the
 * whole requested range. A 30d view answers from its newest sampled week, so
 * silence here would read as "these are 30-day numbers".
 * @param {{ from: string, to: string } | undefined} part
 * @param {{ from: string, to: string } | undefined} whole
 * @returns {string}
 */
function windowNote(part, whole) {
  if (part === undefined) return ''
  if (whole !== undefined && part.from === whole.from && part.to === whole.to) return ''
  return `, window ${part.from} → ${part.to}`
}

/**
 * One phrase about how much of a window was measured rather than extrapolated.
 * @param {{ slices: number, known: number, sampled: boolean, samples: number, estimated: number } | undefined} sampling
 * @returns {string}
 */
function samplingNote(sampling) {
  if (sampling === undefined) return ''
  if (sampling.known === 0) return 'no data in this range'
  if (sampling.sampled !== true) {
    return sampling.slices === 1
      ? 'exact (single query, not sampled)'
      : `exact (${sampling.slices} slices summed, none sampled)`
  }
  return `sampled: ${int(sampling.samples)} samples for ${int(sampling.estimated)} page loads`
}

/** Top lists, in the order the panel shows them. */
const LISTS = [
  ['paths', 'Top pages'],
  ['referrers', 'Referrers'],
  ['countries', 'Countries'],
  ['browsers', 'Browsers'],
  ['devices', 'Device types'],
  ['os', 'Operating systems'],
]

/** Core Web Vitals, in the order the panel shows them. */
const VITALS = [
  ['lcp', 'LCP'],
  ['inp', 'INP'],
  ['cls', 'CLS'],
  ['fcp', 'FCP'],
  ['ttfb', 'TTFB'],
]

/** Loading phases from the performance dataset, in timeline order. */
const PHASES = [
  ['dns', 'DNS'],
  ['connection', 'connect'],
  ['tls', 'TLS'],
  ['request', 'request'],
  ['response', 'response'],
  ['render', 'render'],
  ['firstPaint', 'first paint'],
  ['firstContentfulPaint', 'FCP'],
]

/**
 * Shorten one time bucket for the compact series line.
 * @param {string} stamp
 * @param {string} range
 * @returns {string}
 */
function bucket(stamp, range) {
  if (typeof stamp !== 'string') return ''
  if (range === '24h' && stamp.length >= 16) return stamp.slice(5, 16)
  return stamp.slice(5, 10)
}

/**
 * Render one overview payload as the model-facing report.
 * @param {any} data
 * @returns {string}
 */
function overviewReport(data) {
  const lines = []
  lines.push(`Cloudflare Web Analytics · ${data.site.host}${data.cached === true ? ' (cached)' : ''}`)
  lines.push(`range ${data.range} · ${data.window.from} → ${data.window.to} · siteTag ${data.site.siteTag}`)
  lines.push('')

  const totals = data.totals ?? { visits: 0, pageLoads: 0 }
  const previous = data.previous ?? { visits: 0, pageLoads: 0 }
  lines.push(
    `Visits ${int(totals.visits)} (${comparison(totals.visits, previous.visits)})`
    + ` · Page loads ${int(totals.pageLoads)} (${comparison(totals.pageLoads, previous.pageLoads)})`,
  )
  const basis = samplingNote(data.sampling?.current)
  if (basis !== '') lines.push(`Basis: ${basis}`)

  const series = Array.isArray(data.series) ? data.series : []
  if (series.length === 0) {
    lines.push('Visits by bucket: (no rows)')
  } else {
    const tail = series.slice(-12)
    const points = tail.map((point) => `${bucket(point.t, data.range)}=${point.visits}`).join(' ')
    const omitted = series.length - tail.length
    lines.push(`Visits by bucket: ${points}${omitted > 0 ? ` (+${omitted} earlier omitted)` : ''}`)
  }

  // Every section prints, even when Cloudflare returns no rows: a silently
  // missing list reads as "there are none" and hides a broken query.
  for (const [key, title] of LISTS) {
    const rows = data.top?.[key]
    lines.push('')
    lines.push(`${title} (page loads / visits)`)
    if (!Array.isArray(rows) || rows.length === 0) {
      lines.push('(no rows)')
      continue
    }
    rows.forEach((row, index) => {
      const name = row.name === '' ? '(direct)' : row.name
      lines.push(`${index + 1}. ${name} — ${int(row.pageLoads)} / ${int(row.visits)}`)
    })
  }

  lines.push('')
  if (data.vitals === null || data.vitals === undefined) {
    lines.push('Core Web Vitals: (no rows)')
  } else {
    lines.push(`Core Web Vitals (P75, ${int(data.vitals.samples)} samples, field data${windowNote(data.vitals.window, data.window)})`)
    for (const [key, label] of VITALS) {
      const metric = data.vitals[key]
      if (metric === undefined) continue
      const value = key === 'cls' ? score(metric.p75) : duration(metric.p75)
      lines.push(
        `${label} ${value} — good ${share(metric.good, metric.total)}`
        + ` / needs work ${share(metric.needs, metric.total)}`
        + ` / poor ${share(metric.poor, metric.total)}`,
      )
    }
  }

  lines.push('')
  if (data.performance === null || data.performance === undefined) {
    lines.push('Loading phases: (no rows)')
  } else {
    const phases = PHASES
      .filter(([key]) => data.performance.phases?.[key] !== null && data.performance.phases?.[key] !== undefined)
      .map(([key, label]) => `${label} ${duration(data.performance.phases[key])}`)
      .join(' · ')
    lines.push(`Loading phases (P75, page load ${duration(data.performance.pageLoad)}, ${int(data.performance.samples)} samples${windowNote(data.performance.window, data.window)})`)
    lines.push(phases === '' ? '(no phase rows)' : phases)
  }

  lines.push('')
  lines.push('Full lists and the trend chart are in the Cloudflare panel in the sidebar.')
  return lines.join('\n')
}

/**
 * Register the tool on the host's tool registry.
 * @param {{ get: (name: string) => unknown, tools: { register: (definition: object, options?: object) => () => void } }} ctx
 * @returns {() => void}
 */
export function registerAgentTool(ctx) {
  const store = createTokenStore(ctx)
  /** Last observed "a Token is configured", so a step does not re-read the store. */
  let presence = { at: 0, value: false }

  /**
   * Whether a Token is configured, cheaply enough to answer once per step.
   * @returns {Promise<boolean>}
   */
  async function configured() {
    if (Date.now() - presence.at < PRESENCE_TTL_MS) return presence.value
    try {
      const value = (await store.describe()).configured === true
      presence = { at: Date.now(), value }
      return value
    } catch {
      // A missing credential service is not a credential state to cache.
      return false
    }
  }

  /**
   * Resolve everything an outbound call needs, or explain what is missing.
   * @returns {Promise<{ token: string, accountId: string, proxy?: { host: string, port: number } }>}
   */
  async function connection() {
    const token = await store.resolve()
    if (token === undefined) {
      throw new CloudflareError('no-token', 'Cloudflare API Token 尚未配置：请在侧边栏的 Cloudflare 面板里保存 Token 后再调用', { status: 401 })
    }
    const state = readState()
    if (state.accountId === undefined) {
      throw new CloudflareError('no-account', '缺少 Account ID：请在 Cloudflare 面板里重新保存 Token（帐户级 Token 需要 Account ID）', { status: 400 })
    }
    /** A stored proxy that no longer parses is ignored rather than failing every call. */
    let proxy
    if (state.proxy !== undefined) {
      try {
        proxy = proxyFromSettings(state.proxy)
      } catch {
        proxy = undefined
      }
    }
    return { token, accountId: state.accountId, ...(proxy === undefined ? {} : { proxy }) }
  }

  /**
   * Pick the requested site, or the account's first one.
   * @param {{ token: string, accountId: string, proxy?: { host: string, port: number } }} options
   * @param {string | undefined} wanted
   * @returns {Promise<{ siteTag: string, host: string, enabled: boolean }>}
   */
  async function siteOf(options, wanted) {
    const sites = await listSites(options)
    if (sites.length === 0) throw new CloudflareError('no-site', '该账户下没有 Web Analytics 站点')
    const key = typeof wanted === 'string' ? wanted.trim().toLowerCase() : ''
    if (key === '') return sites[0]
    const match = sites.find((entry) => entry.host.toLowerCase() === key)
      ?? sites.find((entry) => entry.siteTag.toLowerCase() === key)
    if (match === undefined) {
      const known = sites.map((entry) => `${entry.host} (${entry.siteTag})`).join(', ')
      throw new CloudflareError('unknown-site', `找不到站点 "${wanted}"；可用站点：${known}`)
    }
    return match
  }

  /**
   * Build the report for one call.
   * @param {any} args
   * @returns {Promise<string>}
   */
  async function reportFor(args) {
    const action = typeof args?.action === 'string' ? args.action : ''

    if (action === 'status') {
      const described = await store.describe()
      const state = readState()
      if (described.configured !== true) {
        return 'Not configured: no Cloudflare API Token is stored. Open the Cloudflare panel in the sidebar and save one.'
      }
      const lines = [
        `Configured (token source: ${described.source ?? 'stored'})`,
        state.accountId === undefined ? 'Account ID: missing — re-save the token with an Account ID' : `Account ID: ${state.accountId}`,
        state.proxy === undefined || state.proxy.enabled !== true ? 'Proxy: off (direct connection)' : `Proxy: ${state.proxy.url}`,
      ]
      return lines.join('\n')
    }

    if (action === 'sites') {
      const options = await connection()
      const sites = await listSites(options)
      if (sites.length === 0) return 'The account has no Web Analytics sites.'
      const lines = [`${sites.length} Web Analytics site${sites.length === 1 ? '' : 's'} in account ${options.accountId}:`]
      for (const site of sites) {
        lines.push(`- ${site.host} — siteTag ${site.siteTag}${site.enabled === false ? ' (disabled)' : ''}`)
      }
      return lines.join('\n')
    }

    if (action === 'overview') {
      const range = typeof args.range === 'string' ? args.range : '7d'
      if (RANGES[range] === undefined) throw new CloudflareError('bad-range', `不支持的时间范围 "${range}"，可选 24h、7d、30d`)
      const options = await connection()
      const site = await siteOf(options, args.site)
      const data = await fetchOverview({
        ...options,
        siteTag: site.siteTag,
        range,
        fresh: args.fresh === true,
      })
      return overviewReport(data)
    }

    throw new CloudflareError('bad-action', `未知的 action "${action}"，可选 overview、sites、status`)
  }

  return ctx.tools.register({
    name: TOOL_NAME,
    description:
      'Read Cloudflare Web Analytics for the sites this machine\'s API Token can see: visits and page loads with previous-period deltas, top pages/referrers/countries/browsers/device types/operating systems, Core Web Vitals, and page-load phase timings. Read-only. Results are cached for a few minutes per site and range.',
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: typeof value?.report === 'string' ? value.report : '' }],
    },
    timeoutMs: 60_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      return { report: await reportFor(args ?? {}) }
    },
  }, { when: () => configured() })
}
