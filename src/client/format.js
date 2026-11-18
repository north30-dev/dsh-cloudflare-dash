/** Number and duration formatting shared by the dashboard views. */

/**
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Thousands-separated integer.
 * @param {unknown} value
 * @returns {string}
 */
export function fmtInt(value) {
  return toNumber(value).toLocaleString('en-US')
}

/**
 * Short form for axis labels.
 * @param {number} value
 * @returns {string}
 */
export function fmtCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(Math.round(value))
}

/**
 * Percentage change against the previous period.
 * @param {unknown} current
 * @param {unknown} previous
 * @returns {{ pct: number | null, dir: 'up' | 'down' | 'flat' }}
 */
export function fmtDelta(current, previous) {
  const now = toNumber(current)
  const before = toNumber(previous)
  if (before === 0) return { pct: now === 0 ? 0 : null, dir: now === 0 ? 'flat' : 'up' }
  const pct = ((now - before) / before) * 100
  if (Math.abs(pct) < 0.05) return { pct: 0, dir: 'flat' }
  return { pct, dir: pct > 0 ? 'up' : 'down' }
}

/**
 * Format a duration Cloudflare reports in microseconds.
 * @param {unknown} microseconds
 * @returns {string}
 */
export function fmtDuration(microseconds) {
  if (typeof microseconds !== 'number' || !Number.isFinite(microseconds)) return '—'
  const ms = microseconds / 1000
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  if (ms >= 100) return `${Math.round(ms)} ms`
  return `${ms.toFixed(1)} ms`
}

/**
 * Unitless ratio such as CLS.
 * @param {unknown} value
 * @returns {string}
 */
export function fmtRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

/**
 * Whole days since an ISO instant, or null when the value cannot be read.
 *
 * Cloudflare's RUM `created` carries six fractional digits
 * (`2026-11-11T15:04:46.023839Z`); some engines reject that shape, so the
 * fraction is trimmed to milliseconds before parsing. A future stamp reads as
 * null rather than as a negative age.
 * @param {unknown} iso
 * @param {number} [now]
 * @returns {number | null}
 */
export function daysSince(iso, now = Date.now()) {
  if (typeof iso !== 'string' || iso === '') return null
  const normalized = iso.replace(/(\.\d{3})\d+/, '$1')
  const at = Date.parse(normalized)
  if (!Number.isFinite(at) || !Number.isFinite(now)) return null
  const days = Math.floor((now - at) / 86_400_000)
  return days >= 0 ? days : null
}

/**
 * Local clock label for an hourly bucket, or the bucket's own date.
 * @param {string} iso
 * @param {'hour' | 'day'} step
 * @param {boolean} withDate
 * @returns {string}
 */
export function fmtBucket(iso, step, withDate) {
  if (iso === '') return ''
  if (step === 'day') {
    const [, month, day] = iso.split('-')
    return `${month}-${day}`
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const hh = String(date.getHours()).padStart(2, '0')
  const label = `${hh}:00`
  if (!withDate) return label
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')} ${label}`
}
