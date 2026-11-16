/**
 * Browser half of the Cloudflare dashboard bundle.
 *
 * Registers one global panel icon and its matching main panel. Everything the
 * panel shows comes from the Host routes; this module never sees a Token value.
 */
import React from 'react'
import { Panel, PanelIcon } from './app.jsx'
import { NS, en, zh } from './locale.js'
import css from './styles.css'

export const inject = ['slots', 'locale']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-cloudflare-dash'
    style.textContent = css
    document.head.appendChild(style)
    return () => style.remove()
  }, 'cloudflare-dash: styles')

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'cloudflare-dash: dictionaries')

  const CloudflarePanel = () => React.createElement(Panel, { t: ctx.locale.bind(NS) })

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: 'cloudflare',
    order: 40,
    label: () => ctx.locale.bind(NS)('panel.label'),
  }, PanelIcon))

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: 'cloudflare',
  }, CloudflarePanel))
}
