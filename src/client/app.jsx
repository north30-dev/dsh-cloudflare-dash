/**
 * Cloudflare dashboard panel and its sidebar icon.
 *
 * M1 scope: configuration only. The panel reads the Host's status, accepts a
 * Token through the UI, triggers verification, and can measure the network path.
 * No Cloudflare metric is rendered yet.
 */
import React, { useEffect, useState } from 'react'

const PROXY_STORAGE_KEY = 'dsh-cloudflare-dash:proxy'
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7890'

/** Where the Host half listens, relative to the page's own mount. */
function apiBase() {
  return new URL('cloudflare-dash/api/v1/', document.baseURI).toString()
}

/**
 * Call one Host route.
 * @param {string} path
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<any>}
 */
async function callApi(path, options = {}) {
  const init = {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
  }
  if (options.body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(options.body)
  }
  let response
  try {
    response = await fetch(apiBase() + path, init)
  } catch {
    throw new Error('无法连接插件后端')
  }
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const error = new Error(payload?.error ?? `请求失败（HTTP ${response.status}）`)
    error.code = payload?.code
    error.missing = payload?.missing
    throw error
  }
  return payload ?? {}
}

/** Read the non-secret proxy preference. */
function readProxyPrefs() {
  try {
    const raw = window.localStorage.getItem(PROXY_STORAGE_KEY)
    if (raw === null) return { enabled: false, url: DEFAULT_PROXY_URL }
    const parsed = JSON.parse(raw)
    return {
      enabled: parsed?.enabled === true,
      url: typeof parsed?.url === 'string' ? parsed.url : DEFAULT_PROXY_URL,
    }
  } catch {
    return { enabled: false, url: DEFAULT_PROXY_URL }
  }
}

/** Persist the non-secret proxy preference. */
function writeProxyPrefs(prefs) {
  try {
    window.localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // A blocked storage quota must not break configuration; the panel still works.
  }
}

/** @param {unknown} value */
function formatMs(value) {
  return typeof value === 'number' ? `${value} ms` : '—'
}

/** @param {unknown} value */
function formatTime(value) {
  if (typeof value !== 'number') return null
  try {
    return new Date(value).toLocaleString()
  } catch {
    return null
  }
}

/**
 * Recognise the two values users most often paste instead of a token.
 * @param {string} value
 * @returns {'token-id' | 'global-key' | null}
 */
function suspiciousToken(value) {
  const trimmed = value.trim()
  if (/^[0-9a-f]{32}$/i.test(trimmed)) return 'token-id'
  if (/^[0-9a-f]{37}$/i.test(trimmed)) return 'global-key'
  return null
}

/**
 * @param {{ t: (key: string) => string }} props
 */
export function Panel({ t }) {
  const [phase, setPhase] = useState('loading')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [probing, setProbing] = useState(false)
  const [token, setToken] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [proxyEnabled, setProxyEnabled] = useState(false)
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_PROXY_URL)
  const [notice, setNotice] = useState(null)
  const [probeResult, setProbeResult] = useState(null)

  useEffect(() => {
    const prefs = readProxyPrefs()
    setProxyEnabled(prefs.enabled)
    setProxyUrl(prefs.url)
    let cancelled = false
    callApi('status')
      .then((data) => {
        if (cancelled) return
        setStatus(data)
        setPhase('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setNotice({ kind: 'error', text: error.message })
        setPhase('ready')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const proxy = () => ({ enabled: proxyEnabled, url: proxyUrl })

  /** @param {unknown} error */
  function describeError(error) {
    const message = error instanceof Error ? error.message : String(error)
    const missing = Array.isArray(error?.missing) ? error.missing.filter((entry) => typeof entry === 'string') : []
    let text = message
    if (missing.length > 0) text += `\n${t('error.missingHint')}: ${missing.join('; ')}`
    if (error?.code === 'unauthorized') text += `\n${t('hint.unauthorized')}`
    return text
  }

  async function handleSave() {
    const value = token.trim()
    if (value === '') {
      setNotice({ kind: 'error', text: t('step.token.placeholder') })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const data = await callApi('token', { method: 'POST', body: { token: value, proxy: proxy() } })
      setStatus(data)
      setToken('')
      setReplacing(false)
      writeProxyPrefs(proxy())
      setNotice({ kind: 'ok', text: t('msg.saved') })
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setNotice(null)
    try {
      const data = await callApi('token', { method: 'DELETE' })
      setStatus(data)
      setNotice({ kind: 'ok', text: t('msg.deleted') })
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) })
    } finally {
      setBusy(false)
    }
  }

  async function handleProbe() {
    setProbing(true)
    setNotice(null)
    try {
      const data = await callApi('probe', { method: 'POST', body: { proxy: proxy() } })
      setProbeResult(data)
      writeProxyPrefs(proxy())
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) })
    } finally {
      setProbing(false)
    }
  }

  const configured = status?.configured === true
  const verifiedAt = formatTime(status?.verifiedAt)

  function renderTokenForm() {
    const suspicious = suspiciousToken(token)
    return (
      <div className="cfd-step">
        <div className="cfd-label">{t('step.token.title')}</div>
        <p className="cfd-desc">
          {t('step.token.desc')} <span className="cfd-desc">{t('perm.list')}</span>
        </p>
        <div className="cfd-row">
          <input
            className="cfd-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('step.token.placeholder')}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSave()
            }}
          />
          <button className="cfd-btn cfd-btn--primary" disabled={busy} onClick={() => void handleSave()}>
            {busy ? t('step.token.saving') : t('step.token.save')}
          </button>
        </div>
        {suspicious === null ? null : (
          <p className="cfd-hint cfd-warn">{suspicious === 'token-id' ? t('warn.tokenId') : t('warn.globalKey')}</p>
        )}
        <p className="cfd-hint">
          <a className="cfd-link" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">
            {t('step.token.console')}
          </a>
        </p>
      </div>
    )
  }

  function renderProxy() {
    return (
      <div className="cfd-step">
        <div className="cfd-label">{t('step.proxy.title')}</div>
        <label className="cfd-check">
          <input
            type="checkbox"
            checked={proxyEnabled}
            onChange={(event) => {
              const enabled = event.target.checked
              setProxyEnabled(enabled)
              writeProxyPrefs({ enabled, url: proxyUrl })
            }}
          />
          {t('step.proxy.toggle')}
        </label>
        <div className="cfd-row" style={{ marginTop: '10px' }}>
          <input
            className="cfd-input"
            type="text"
            spellCheck={false}
            disabled={!proxyEnabled}
            placeholder={t('step.proxy.placeholder')}
            value={proxyUrl}
            onChange={(event) => setProxyUrl(event.target.value)}
            onBlur={() => writeProxyPrefs({ enabled: proxyEnabled, url: proxyUrl })}
          />
          <button className="cfd-btn" disabled={probing} onClick={() => void handleProbe()}>
            {probing ? t('action.probing') : t('action.probe')}
          </button>
        </div>
        <p className="cfd-hint">{t('step.proxy.hint')}</p>
      </div>
    )
  }

  function renderProbe() {
    if (probeResult === null) return null
    const rows = [
      ['direct', probeResult.direct, t('probe.direct')],
      ['proxied', probeResult.proxied, t('probe.proxied')],
    ].filter(([, value]) => value !== undefined && value !== null)
    return (
      <div className="cfd-probe">
        {rows.map(([key, value, label]) => (
          <div className="cfd-probe-row" key={key}>
            <span className="cfd-probe-name">{label}</span>
            <span>{value.ok ? t('probe.ok') : t('probe.fail')}</span>
            {value.ok ? (
              <>
                <span>DNS {formatMs(value.timings?.dnsMs)}</span>
                <span>TLS {formatMs(value.timings?.tlsMs)}</span>
                <span>TTFB {formatMs(value.timings?.ttfbMs)}</span>
                <span>Total {formatMs(value.timings?.totalMs)}</span>
              </>
            ) : (
              <span>{(value.error?.code ?? 'network') + ' · ' + (value.error?.message ?? '')}</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="cfd-page">
      <header className="cfd-head">
        <h2 className="cfd-title">{t('title')}</h2>
        <p className="cfd-sub">{t('subtitle')}</p>
      </header>
      {phase === 'loading' ? (
        <p className="cfd-hint">{t('loading')}</p>
      ) : (
        <div className="cfd-card">
          {configured ? (
            <>
              <div className="cfd-meta">
                <div className="cfd-metric">
                  <div className="cfd-metric-value cfd-metric-value--small">{status.masked ?? '—'}</div>
                  <div className="cfd-metric-label">{t('status.masked')}</div>
                </div>
                <div className="cfd-metric">
                  <div className="cfd-metric-value">{typeof status.accounts === 'number' ? status.accounts : '—'}</div>
                  <div className="cfd-metric-label">{t('status.accounts')}</div>
                </div>
                <div className="cfd-metric">
                  <div className="cfd-metric-value">{typeof status.rumSites === 'number' ? status.rumSites : '—'}</div>
                  <div className="cfd-metric-label">{t('status.sites')}</div>
                </div>
                <div className="cfd-metric">
                  <div className="cfd-metric-value cfd-metric-value--small">{verifiedAt ?? t('status.neverVerified')}</div>
                  <div className="cfd-metric-label">{t('status.verified')}</div>
                </div>
              </div>
              <p className="cfd-hint">
                {status.source === 'environment' ? t('status.source.environment') : t('status.source.stored')}
                {status.source === 'environment' ? ` · ${t('hint.envFallback')}` : ''}
              </p>
              {status.rumSites === 0 ? <p className="cfd-hint">{t('status.noSites')}</p> : null}
              {typeof status.hint === 'string' ? <p className="cfd-hint">{status.hint}</p> : null}
              {replacing ? renderTokenForm() : null}
              <div className="cfd-actions">
                <button className="cfd-btn" disabled={busy} onClick={() => setReplacing(!replacing)}>
                  {t('action.replace')}
                </button>
                <button className="cfd-btn" disabled={busy} onClick={() => void handleDelete()}>
                  {t('action.delete')}
                </button>
              </div>
            </>
          ) : (
            renderTokenForm()
          )}
          {renderProxy()}
          {notice === null ? null : (
            <p className={notice.kind === 'ok' ? 'cfd-hint cfd-ok' : 'cfd-error'}>{notice.text}</p>
          )}
          {renderProbe()}
        </div>
      )}
    </div>
  )
}

/**
 * Sidebar glyph: three ascending bars, matching the bundle icon.
 * @param {{ size?: number, active?: boolean }} props
 */
export function PanelIcon({ size = 20, active = false }) {
  return (
    <svg
      className="cfd-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      style={{ opacity: active ? 1 : 0.78 }}
    >
      <rect x="3.5" y="13" width="3.4" height="7.5" rx="1.7" fill="currentColor" opacity="0.75" />
      <rect x="10.3" y="8.5" width="3.4" height="12" rx="1.7" fill="currentColor" opacity="0.88" />
      <rect x="17.1" y="3.8" width="3.4" height="16.7" rx="1.7" fill="currentColor" />
    </svg>
  )
}
