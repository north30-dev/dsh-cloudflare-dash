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
