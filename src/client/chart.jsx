/** A dependency-free area chart for the dashboard's trend card. */
import React, { useState } from 'react'
import { fmtBucket, fmtCompact, fmtInt } from './format.js'

const WIDTH = 760
const HEIGHT = 240
const PAD = { left: 44, right: 16, top: 16, bottom: 28 }

/**
 * Round an axis maximum up to a readable step.
 * @param {number} value
 * @returns {number}
 */
function niceMax(value) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  // Includes 3 and 4 so a peak of 30 keeps a 30 ceiling instead of doubling the
  // empty space above the line by rounding up to 50.
  const step = normalized <= 1 ? 1
    : normalized <= 1.5 ? 1.5
      : normalized <= 2 ? 2
        : normalized <= 2.5 ? 2.5
          : normalized <= 3 ? 3
            : normalized <= 4 ? 4
              : normalized <= 5 ? 5
                : 10
  return step * magnitude
}

/**
 * Milliseconds for one bucket stamp, or NaN when it cannot be placed in time.
 * @param {unknown} stamp
 * @returns {number}
 */
function stampToMs(stamp) {
  if (typeof stamp !== 'string' || stamp === '') return Number.NaN
  return Date.parse(stamp)
}

/**
 * @param {{
 *   points: Array<{ t: string, label: string, visits: number, pageLoads: number }>,
 *   window?: { from?: string, to?: string },
 *   step: 'hour' | 'day',
 *   note?: string | null,
 *   labels: { visits: string, pageLoads: string, empty: string },
 * }} props
 */
export function TrendChart({ points, step = 'day', note, labels }) {
  const [hover, setHover] = useState(-1)
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom

  if (points.length === 0) {
    return <div className="cfd-chart-empty">{labels.empty}</div>
  }

  const peak = Math.max(1, ...points.map((point) => Math.max(point.visits, point.pageLoads)))
  const max = niceMax(peak)

  // Cloudflare returns only the buckets that hold data, so a 24h window can come
  // back with three hours and a 30d window with six days. Two rules keep that
  // honest and readable:
  //   1. Points sit at their real timestamps, never evenly spaced by index — an
  //      index-fit ramp would claim traffic on days that had none.
  //   2. The axis spans the data, not the requested window. A new site with six
  //      days inside a 30-day request would otherwise squash every point into the
  //      last fifth of the card. `note` tells the reader the axis was narrowed.
  const stepMs = step === 'hour' ? 3_600_000 : 86_400_000
  const times = points.map((point) => stampToMs(point.t))
  const byTime = times.every((value) => Number.isFinite(value))

  let domainFrom = 0
  let domainTo = 0
  if (byTime) {
    domainFrom = times[0]
    domainTo = times[times.length - 1]
    if (!(domainTo > domainFrom)) {
      // One bucket (or several sharing an instant): give it a whole slot to sit
      // in so a single dot does not become a line with no length.
      domainFrom -= stepMs / 2
      domainTo += stepMs / 2
    }
  }

  /**
   * @param {number} index
   * @returns {number}
   */
  const xOf = (index) => {
    if (byTime) {
      const ratio = (times[index] - domainFrom) / (domainTo - domainFrom)
      return PAD.left + Math.min(1, Math.max(0, ratio)) * innerWidth
    }
    if (points.length === 1) return PAD.left + innerWidth / 2
    return PAD.left + (index / (points.length - 1)) * innerWidth
  }
  /**
   * @param {number} value
   * @returns {number}
   */
  const yOf = (value) => PAD.top + innerHeight - (value / max) * innerHeight

  const visitsLine = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xOf(index)},${yOf(point.visits)}`).join(' ')
  const visitsArea = `${visitsLine} L${xOf(points.length - 1)},${PAD.top + innerHeight} L${xOf(0)},${PAD.top + innerHeight} Z`
  const loadsLine = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xOf(index)},${yOf(point.pageLoads)}`).join(' ')

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(max * fraction))
  const active = hover >= 0 && hover < points.length ? points[hover] : null
  // Isolated buckets need a marker: without one a single day is just a dot with
  // no line, and a two-point series can look like a rendering accident.
  const showDots = points.length <= 14
  const slot = Math.max(innerWidth / Math.max(points.length, 1), 8)

  // Time ticks instead of per-bucket labels: labels sat on the buckets, so six
  // adjacent days printed as "11-111-121-13…".
  const ticks = []
  if (byTime) {
    const count = 5
    const span = domainTo - domainFrom
    for (let index = 0; index < count; index += 1) {
      const at = domainFrom + (span * index) / (count - 1)
      const iso = step === 'hour' ? new Date(at).toISOString() : new Date(at).toISOString().slice(0, 10)
      const label = fmtBucket(iso, step, false)
      if (label !== '' && !ticks.some((tick) => tick.label === label)) {
        ticks.push({ at, label })
      }
    }
  }
  const tickX = (at, index) => {
    if (!byTime) return index === 0 ? PAD.left : index === ticks.length - 1 ? WIDTH - PAD.right : PAD.left + (index / (ticks.length - 1)) * innerWidth
    return PAD.left + Math.min(1, Math.max(0, (at - domainFrom) / (domainTo - domainFrom))) * innerWidth
  }

  return (
    <div className="cfd-chart">
      <div className="cfd-legend">
        <span className="cfd-legend-item">
          <i className="cfd-swatch cfd-swatch--area" />
          {labels.visits}
        </span>
        <span className="cfd-legend-item">
          <i className="cfd-swatch cfd-swatch--line" />
          {labels.pageLoads}
        </span>
      </div>
      <div className="cfd-chart-plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="cfd-chart-svg" role="img">
          <defs>
            <linearGradient id="cfd-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dsw-alias-brand-primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--dsw-alias-brand-primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yOf(value)}
                y2={yOf(value)}
                className="cfd-grid-line"
              />
              <text x={PAD.left - 8} y={yOf(value) + 4} className="cfd-axis-label" textAnchor="end">
                {fmtCompact(value)}
              </text>
            </g>
          ))}
          <path d={visitsArea} fill="url(#cfd-area)" />
          <path d={visitsLine} className="cfd-line cfd-line--area" />
          <path d={loadsLine} className="cfd-line cfd-line--loads" />
          {showDots ? points.map((point, index) => (
            <g key={`dot-${point.label}`}>
              <circle cx={xOf(index)} cy={yOf(point.visits)} r="3" className="cfd-dot cfd-dot--visits" />
              <circle cx={xOf(index)} cy={yOf(point.pageLoads)} r="3" className="cfd-dot cfd-dot--loads" />
            </g>
          )) : null}
          {active === null ? null : (
            <g>
              <line
                x1={xOf(hover)}
                x2={xOf(hover)}
                y1={PAD.top}
                y2={PAD.top + innerHeight}
                className="cfd-hover-line"
              />
              <circle cx={xOf(hover)} cy={yOf(active.visits)} r="4" className="cfd-dot cfd-dot--visits" />
              <circle cx={xOf(hover)} cy={yOf(active.pageLoads)} r="4" className="cfd-dot cfd-dot--loads" />
            </g>
          )}
          {points.map((point, index) => (
            <rect
              key={point.label}
              x={xOf(index) - slot / 2}
              y={PAD.top}
              width={slot}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(-1)}
            />
          ))}
          {ticks.map((tick, index) => (
            <text
              key={`x-${tick.label}`}
              x={tickX(tick.at, index)}
              y={HEIGHT - 8}
              className="cfd-axis-label"
              textAnchor={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle'}
            >
              {tick.label}
            </text>
          ))}
        </svg>
        {active === null ? null : (
          <div className="cfd-tooltip" style={{ left: `${(xOf(hover) / WIDTH) * 100}%` }}>
            <div className="cfd-tooltip-title">{active.label}</div>
            <div className="cfd-tooltip-row">
              <i className="cfd-swatch cfd-swatch--area" />
              {labels.visits}
              <b>{fmtInt(active.visits)}</b>
            </div>
            <div className="cfd-tooltip-row">
              <i className="cfd-swatch cfd-swatch--line" />
              {labels.pageLoads}
              <b>{fmtInt(active.pageLoads)}</b>
            </div>
          </div>
        )}
      </div>
      {typeof note === 'string' && note !== '' ? <p className="cfd-chart-note">{note}</p> : null}
    </div>
  )
}
