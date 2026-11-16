/** The Web Analytics overview: KPIs, trend, top lists, and Core Web Vitals. */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { callApi, proxyQuery } from './api.js'
import { TrendChart } from './chart.jsx'
import { fmtBucket, fmtDelta, fmtDuration, fmtInt, fmtRatio } from './format.js'

const RANGE_OPTIONS = ['24h', '7d', '30d']

/**
 * @param {{ t: (key: string) => string, proxy: { enabled: boolean, url: string }, onOpenSettings: () => void }} props
 */
export function Overview({ t, proxy, onOpenSettings }) {
  const [sites, setSites] = useState([])
  const [siteTag, setSiteTag] = useState('')
  const [range, setRange] = useState('7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sitesError, setSitesError] = useState(null)

  const proxyArgs = proxyQuery(proxy)

  useEffect(() => {
    let cancelled = false
    const query = proxyArgs === '' ? '' : `?${proxyArgs}`
    callApi(`sites${query}`)
      .then((payload) => {
        if (cancelled) return
        const list = Array.isArray(payload.sites) ? payload.sites : []
        setSites(list)
        if (list.length > 0) setSiteTag(list[0].siteTag)
        else setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        setSitesError(loadError.message)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [proxyArgs])

  const load = useCallback(() => {
    if (siteTag === '') return
    setLoading(true)
    setError(null)
    const params = [`siteTag=${encodeURIComponent(siteTag)}`, `range=${range}`]
    if (proxyArgs !== '') params.push(proxyArgs)
    callApi(`overview?${params.join('&')}`)
      .then((payload) => {
        setData(payload)
        setLoading(false)
      })
      .catch((loadError) => {
        setError(loadError.message)
        setLoading(false)
      })
  }, [siteTag, range, proxyArgs])

  useEffect(() => {
    load()
  }, [load])

  const points = useMemo(() => {
    if (data === null) return []
    const step = data.range === '24h' ? 'hour' : 'day'
    return data.series.map((point) => ({
      label: fmtBucket(point.t, step, false),
      visits: point.visits,
      pageLoads: point.pageLoads,
    }))
  }, [data])

  const site = data?.site ?? sites.find((entry) => entry.siteTag === siteTag)
  const currentSite = site?.siteTag === siteTag ? site : undefined

  if (sitesError !== null) {
    return (
      <div className="cfd-page cfd-page--wide">
        <div className="cfd-empty-card">
          <p className="cfd-empty-title">{t('overview.loadFailed')}</p>
          <p className="cfd-error">{sitesError}</p>
          <button className="cfd-btn" onClick={onOpenSettings}>
            {t('overview.settings')}
          </button>
        </div>
      </div>
    )
  }

  if (!loading && sites.length === 0) {
    return (
      <div className="cfd-page cfd-page--wide">
        <div className="cfd-empty-card">
          <p className="cfd-empty-title">{t('overview.noSites')}</p>
          <p className="cfd-hint">{t('overview.noSitesHint')}</p>
          <button className="cfd-btn" onClick={onOpenSettings}>
            {t('overview.settings')}
          </button>
        </div>
      </div>
    )
  }

  const totals = data?.totals ?? { visits: 0, pageLoads: 0 }
  const previous = data?.previous ?? { visits: 0, pageLoads: 0 }
  const top = data?.top ?? { paths: [], referrers: [], countries: [], browsers: [], devices: [] }
  const vitals = data?.vitals ?? null
  const visitsDelta = fmtDelta(totals.visits, previous.visits)
  const loadsDelta = fmtDelta(totals.pageLoads, previous.pageLoads)

  return (
    <div className="cfd-page cfd-page--wide">
      <header className="cfd-topbar">
        <div>
          <h2 className="cfd-title">{t('overview.title')}</h2>
          <p className="cfd-sub">{currentSite === undefined ? t('overview.loading') : currentSite.host}</p>
        </div>
        <div className="cfd-toolbar">
          <select className="cfd-select" value={range} onChange={(event) => setRange(event.target.value)}>
            {RANGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`range.${option}`)}
              </option>
            ))}
          </select>
          <select
            className="cfd-select"
            value={siteTag}
            onChange={(event) => setSiteTag(event.target.value)}
            disabled={sites.length <= 1}
          >
            {sites.map((entry) => (
              <option key={entry.siteTag} value={entry.siteTag}>
                {entry.host}
              </option>
            ))}
          </select>
          <button className="cfd-btn" disabled={loading} onClick={load}>
            {loading ? t('overview.refreshing') : t('overview.refresh')}
          </button>
          <button className="cfd-btn" onClick={onOpenSettings}>
            {t('overview.settings')}
          </button>
        </div>
      </header>

      {error === null ? null : <p className="cfd-error">{error}</p>}

      <section className="cfd-kpi-row">
        <KpiCard
          label={t('kpi.visits')}
          value={fmtInt(totals.visits)}
          delta={visitsDelta}
          deltaLabel={t('kpi.previous')}
        />
        <KpiCard
          label={t('kpi.pageLoads')}
          value={fmtInt(totals.pageLoads)}
          delta={loadsDelta}
          deltaLabel={t('kpi.previous')}
        />
        <KpiCard
          label={t('kpi.countries')}
          value={fmtInt(top.countries.length)}
          hint={top.countries[0] === undefined ? t('kpi.noData') : top.countries[0].name}
        />
        <KpiCard
          label={t('kpi.referrers')}
          value={fmtInt(top.referrers.filter((row) => row.name !== '').length)}
          hint={t('kpi.referrersHint')}
        />
      </section>

      <section className="cfd-card">
        <div className="cfd-card-head">
          <h3 className="cfd-card-title">{t('chart.title')}</h3>
          <span className="cfd-card-sub">{t('chart.sub')}</span>
        </div>
        <TrendChart
          points={points}
          labels={{ visits: t('chart.visits'), pageLoads: t('chart.pageLoads'), empty: t('chart.empty') }}
        />
      </section>

      <section className="cfd-grid-2">
        <ListCard title={t('list.paths')} rows={top.paths} t={t} />
        <ListCard title={t('list.referrers')} rows={top.referrers} t={t} directLabel={t('list.direct')} />
        <ListCard title={t('list.countries')} rows={top.countries} t={t} />
        <ListCard title={t('list.browsers')} rows={top.browsers} t={t} />
      </section>

      <section className="cfd-card">
        <div className="cfd-card-head">
          <h3 className="cfd-card-title">{t('vitals.title')}</h3>
          <span className="cfd-card-sub">{t('vitals.sub')}</span>
        </div>
        {vitals === null ? (
          <p className="cfd-hint">{t('vitals.empty')}</p>
        ) : (
          <div className="cfd-vitals">
            <VitalTile label="LCP" value={fmtDuration(vitals.lcp.p75)} metric={vitals.lcp} t={t} />
            <VitalTile label="INP" value={fmtDuration(vitals.inp.p75)} metric={vitals.inp} t={t} />
            <VitalTile label="CLS" value={fmtRatio(vitals.cls.p75)} metric={vitals.cls} t={t} />
            <VitalTile label="FCP" value={fmtDuration(vitals.fcp.p75)} metric={vitals.fcp} t={t} />
            <VitalTile label="TTFB" value={fmtDuration(vitals.ttfb.p75)} metric={vitals.ttfb} t={t} />
          </div>
        )}
        <p className="cfd-foot">{t('vitals.note')}</p>
      </section>

      <footer className="cfd-foot">
        {t('overview.footer')}
        {data === null ? '' : ` · ${new Date(data.generatedAt).toLocaleTimeString()}`}
      </footer>
    </div>
  )
}

/**
 * @param {{ label: string, value: string, delta?: { pct: number | null, dir: string }, deltaLabel?: string, hint?: string }} props
 */
function KpiCard({ label, value, delta, deltaLabel, hint }) {
  const hasDelta = delta !== undefined
  const deltaText = delta === undefined ? '' : delta.pct === null ? '—' : `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`
  return (
    <div className="cfd-kpi">
      <div className="cfd-kpi-label">{label}</div>
      <div className="cfd-kpi-value">{value}</div>
      {hasDelta ? (
        <div className={`cfd-kpi-delta cfd-kpi-delta--${delta.dir}`}>
          {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '•'} {deltaText}
          <span className="cfd-kpi-delta-note">{deltaLabel}</span>
        </div>
      ) : (
        <div className="cfd-kpi-hint">{hint ?? ''}</div>
      )}
    </div>
  )
}

/**
 * @param {{ title: string, rows: Array<{ name: string, visits: number, pageLoads: number }>, t: (key: string) => string, directLabel?: string }} props
 */
function ListCard({ title, rows, t, directLabel }) {
  const visible = rows.slice(0, 5)
  const max = Math.max(1, ...visible.map((row) => row.pageLoads))
  return (
    <div className="cfd-card">
      <div className="cfd-card-head">
        <h3 className="cfd-card-title">{title}</h3>
        <span className="cfd-card-sub">{t('list.count')}</span>
      </div>
      {visible.length === 0 ? (
        <p className="cfd-hint">{t('list.empty')}</p>
      ) : (
        <ul className="cfd-list">
          {visible.map((row) => {
            const name = row.name === '' ? (directLabel ?? t('list.direct')) : row.name
            return (
              <li className="cfd-list-row" key={`${name}-${row.name === '' ? 'direct' : ''}`}>
                <div className="cfd-list-head">
                  <span className="cfd-list-name" title={name}>
                    {name}
                  </span>
                  <span className="cfd-list-value">{fmtInt(row.pageLoads)}</span>
                </div>
                <div className="cfd-bar">
                  <div className="cfd-bar-fill" style={{ width: `${Math.max(3, (row.pageLoads / max) * 100)}%` }} />
                </div>
                <div className="cfd-list-sub">
                  {fmtInt(row.visits)} {t('list.visits')}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * @param {{ label: string, value: string, metric: { good: number, needs: number, poor: number, total: number }, t: (key: string) => string }} props
 */
function VitalTile({ label, value, metric, t }) {
  const total = Math.max(metric.total, metric.good + metric.needs + metric.poor)
  const share = (count) => (total === 0 ? 0 : (count / total) * 100)
  return (
    <div className="cfd-vital">
      <div className="cfd-vital-head">
        <span className="cfd-vital-name">{label}</span>
        <span className="cfd-vital-value">{value}</span>
      </div>
      <div className="cfd-vital-bar">
        <div className="cfd-vital-good" style={{ width: `${share(metric.good)}%` }} />
        <div className="cfd-vital-needs" style={{ width: `${share(metric.needs)}%` }} />
        <div className="cfd-vital-poor" style={{ width: `${share(metric.poor)}%` }} />
      </div>
      <div className="cfd-vital-foot">
        {total === 0
          ? t('vitals.noSamples')
          : `${Math.round(share(metric.good))}% ${t('vitals.good')} · ${fmtInt(total)} ${t('vitals.samples')}`}
      </div>
    </div>
  )
}
