/** A dependency-free area chart for the dashboard's trend card. */
import React, { useState } from 'react'
import { fmtCompact, fmtInt } from './format.js'

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
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

/**
 * @param {{
 *   points: Array<{ label: string, visits: number, pageLoads: number }>,
 *   labels: { visits: string, pageLoads: string, empty: string },
 * }} props
 */
export function TrendChart({ points, labels }) {
  const [hover, setHover] = useState(-1)
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom

  if (points.length === 0) {
    return <div className="cfd-chart-empty">{labels.empty}</div>
  }

  const peak = Math.max(1, ...points.map((point) => Math.max(point.visits, point.pageLoads)))
  const max = niceMax(peak)
  /**
   * @param {number} index
   * @returns {number}
   */
  const xOf = (index) => {
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
              x={xOf(index) - innerWidth / Math.max(points.length, 1) / 2}
              y={PAD.top}
              width={Math.max(innerWidth / Math.max(points.length, 1), 8)}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(-1)}
            />
          ))}
          {points.map((point, index) => {
            const showLabel = points.length <= 12
              || index === 0
              || index === points.length - 1
              || index === Math.floor(points.length / 2)
            if (!showLabel) return null
            return (
              <text key={`x-${point.label}`} x={xOf(index)} y={HEIGHT - 8} className="cfd-axis-label" textAnchor="middle">
                {point.label}
              </text>
            )
          })}
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
    </div>
  )
}
