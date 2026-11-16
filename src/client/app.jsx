/** Panel controller: settings when unconfigured, the dashboard otherwise. */
import React, { useEffect, useState } from 'react'
import { callApi, readProxyPrefs } from './api.js'
import { Overview } from './overview.jsx'
import { SettingsView } from './settings.jsx'

/**
 * @param {{ t: (key: string) => string }} props
 */
export function Panel({ t }) {
  const [phase, setPhase] = useState('loading')
  const [status, setStatus] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [proxy, setProxy] = useState(() => readProxyPrefs())

  useEffect(() => {
    let cancelled = false
    callApi('status')
      .then((payload) => {
        if (cancelled) return
        setStatus(payload)
        setPhase('ready')
        if (payload.configured !== true) setShowSettings(true)
      })
      .catch(() => {
        if (cancelled) return
        setStatus({ configured: false })
        setPhase('ready')
        setShowSettings(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'loading') {
    return (
      <div className="cfd-page">
        <p className="cfd-hint">{t('loading')}</p>
      </div>
    )
  }

  const configured = status?.configured === true

  if (!configured || showSettings) {
    return (
      <SettingsView
        t={t}
        status={status}
        onStatus={(next) => {
          setStatus(next)
          if (next.configured !== true) setShowSettings(true)
        }}
        {...(configured
          ? {
              onClose: () => {
                setProxy(readProxyPrefs())
                setShowSettings(false)
              },
            }
          : {})}
      />
    )
  }

  return <Overview t={t} proxy={proxy} onOpenSettings={() => setShowSettings(true)} />
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
