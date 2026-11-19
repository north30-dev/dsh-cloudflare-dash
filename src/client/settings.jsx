/** Token configuration, proxy settings, and network diagnostics. */
import React, { useState } from 'react'
import { DEFAULT_PROXY_URL, callApi, readProxyPrefs, writeProxyPrefs } from './api.js'

/**
 * Recognise the values users most often paste instead of a user token value.
 * @param {string} value
 * @returns {'token-id' | 'global-key' | 'account-token' | 'bad-length' | null}
 */
function suspiciousToken(value) {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (/^cfat[-_]/i.test(trimmed)) return 'account-token'
  if (/^[0-9a-f]{32}$/i.test(trimmed)) return 'token-id'
  if (/^[0-9a-f]{37}$/i.test(trimmed)) return 'global-key'
  if (trimmed.length !== 40) return 'bad-length'
  return null
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
 * @param {{
 *   t: (key: string) => string,
 *   status: any,
 *   onStatus: (status: any) => void,
 *   onClose?: () => void,
 * }} props
 */
export function SettingsView({ t, status, onStatus, onClose }) {
  const [token, setToken] = useState('')
  const [accountId, setAccountId] = useState(typeof status?.accountId === 'string' ? status.accountId : '')
  const [proxyEnabled, setProxyEnabled] = useState(() => readProxyPrefs().enabled)
  const [proxyUrl, setProxyUrl] = useState(() => readProxyPrefs().url || DEFAULT_PROXY_URL)
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [probing, setProbing] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [notice, setNotice] = useState(null)
  const [probeResult, setProbeResult] = useState(null)

  const configured = status?.configured === true
  const showTokenForm = !configured || replacing
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

  async function save() {
    const value = token.trim()
    if (value === '') {
      setNotice({ kind: 'error', text: t('step.token.placeholder') })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const payload = await callApi('token', {
        method: 'POST',
        body: { token: value, accountId: accountId.trim(), proxy: proxy() },
      })
      onStatus(payload)
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

  async function remove() {
    setBusy(true)
    setNotice(null)
    try {
      const payload = await callApi('token', { method: 'DELETE' })
      onStatus(payload)
      setNotice({ kind: 'ok', text: t('msg.deleted') })
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) })
    } finally {
      setBusy(false)
    }
  }

  /**
   * Ask the Host to verify the Token again. Counts and the timestamp can come
   * from a snapshot written by an earlier run, so this is how the user replaces
   * "last known" with "just measured" without re-entering the Token.
   */
  async function revalidate() {
    setVerifying(true)
    setNotice(null)
    try {
      const payload = await callApi('status?verify=1')
      onStatus(payload)
      if (typeof payload?.accessError === 'string') {
        setNotice({ kind: 'error', text: payload.accessError })
      } else {
        setNotice({ kind: 'ok', text: t('msg.verified') })
      }
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) })
    } finally {
      setVerifying(false)
    }
  }

  async function runProbe() {
    setProbing(true)
    setNotice(null)
    try {
      const payload = await callApi('probe', { method: 'POST', body: { proxy: proxy() } })
      setProbeResult(payload)
      writeProxyPrefs(proxy())
    } catch (error) {
      setNotice({ kind: 'error', text: describeError(error) })
    } finally {
      setProbing(false)
    }
  }

  const suspicious = suspiciousToken(token)
  const verifiedAt = formatTime(status?.verifiedAt)

  return (
    <div className="cfd-page">
      <header className="cfd-topbar">
        <div>
          <h2 className="cfd-title">{t('title')}</h2>
          <p className="cfd-sub">{t('subtitle')}</p>
        </div>
        {onClose === undefined ? null : (
          <div className="cfd-toolbar">
            <button className="cfd-btn" onClick={onClose}>
              {t('settings.back')}
            </button>
          </div>
        )}
      </header>

      <div className="cfd-card">
        {configured && !replacing ? (
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
                <div className="cfd-metric-value cfd-metric-value--small">
                  {verifiedAt ?? t('status.neverVerified')}
                  {status.verifiedStale === true ? ` · ${t('status.stale')}` : ''}
                </div>
                <div className="cfd-metric-label">{t('status.verified')}</div>
              </div>
            </div>
            <p className="cfd-hint">
              {status.source === 'environment' ? t('status.source.environment') : t('status.source.stored')}
              {typeof status.accountId === 'string' ? ` · Account ID: ${status.accountId}` : ''}
            </p>
            {typeof status.accessError === 'string' ? <p className="cfd-hint cfd-warn">{status.accessError}</p> : null}
            <div className="cfd-actions">
              <button className="cfd-btn" disabled={busy || verifying} onClick={() => void revalidate()}>
                {verifying ? t('action.verifying') : t('action.verify')}
              </button>
              <button className="cfd-btn" disabled={busy || verifying} onClick={() => setReplacing(true)}>
                {t('action.replace')}
              </button>
              <button className="cfd-btn" disabled={busy || verifying} onClick={() => void remove()}>
                {t('action.delete')}
              </button>
            </div>
          </>
        ) : null}

        {showTokenForm ? (
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
                  if (event.key === 'Enter') void save()
                }}
              />
              <button className="cfd-btn cfd-btn--primary" disabled={busy} onClick={() => void save()}>
                {busy ? t('step.token.saving') : t('step.token.save')}
              </button>
            </div>
            {suspicious === null ? null : (
              <p className="cfd-hint cfd-warn">
                {suspicious === 'token-id'
                  ? t('warn.tokenId')
                  : suspicious === 'global-key'
                    ? t('warn.globalKey')
                    : suspicious === 'account-token'
                      ? t('warn.accountToken')
                      : t('warn.tokenLength')}
              </p>
            )}
            <div className="cfd-row" style={{ marginTop: '10px' }}>
              <input
                className="cfd-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={t('placeholder.accountId')}
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              />
            </div>
            <p className="cfd-hint">
              <span className="cfd-desc">{t('label.accountId')}</span> {t('hint.accountId')}
            </p>
            <p className="cfd-hint">
              <a className="cfd-link" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">
                {t('step.token.console')}
              </a>
            </p>
          </div>
        ) : null}

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
            <button className="cfd-btn" disabled={probing} onClick={() => void runProbe()}>
              {probing ? t('action.probing') : t('action.probe')}
            </button>
          </div>
          <p className="cfd-hint">{t('step.proxy.hint')}</p>
        </div>

        {notice === null ? null : (
          <p className={notice.kind === 'ok' ? 'cfd-hint cfd-ok' : 'cfd-error'}>{notice.text}</p>
        )}

        {probeResult === null ? null : (
          <div className="cfd-probe">
            {[
              ['direct', probeResult.direct, t('probe.direct')],
              ['proxied', probeResult.proxied, t('probe.proxied')],
            ]
              .filter(([, value]) => value !== undefined && value !== null)
              .map(([key, value, label]) => (
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
                    <span>{`${value.error?.code ?? 'network'} · ${value.error?.message ?? ''}`}</span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
