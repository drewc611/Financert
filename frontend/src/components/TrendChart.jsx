import { useMemo, useState } from 'react'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { pct, quarterLabel } from '../lib/format'

const W = 1000
const H = 300
const PAD = { top: 14, right: 18, bottom: 30, left: 46 }

const SERIES_COLORS = ['var(--series-you)', 'var(--series-bench)']

/** Multi-line trend of one asset class's share of assets, over time.
 *  Crosshair + tooltip on hover, as line charts should have by default. */
export default function TrendChart({ series, assetLabel }) {
  const { tip, show, hide } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState(null)

  const { paths, xs, maxShare, periods } = useMemo(() => {
    const periods = series[0]?.points.map((p) => p.period) ?? []
    const maxShare = Math.max(0.05, ...series.flatMap((s) => s.points.map((p) => p.share)))
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const xs = periods.map((_, i) => PAD.left + (periods.length === 1 ? plotW / 2 : (i / (periods.length - 1)) * plotW))
    const y = (share) => PAD.top + plotH - (share / maxShare) * plotH
    const paths = series.map((s) => s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y(p.share).toFixed(1)}`).join(' '))
    return { paths, xs, maxShare, periods }
  }, [series])

  if (!periods.length) return <p className="empty">No history available.</p>

  const plotH = H - PAD.top - PAD.bottom
  const yFor = (share) => PAD.top + plotH - (share / maxShare) * plotH
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxShare)

  function onMove(event) {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < xs.length; i += 1) {
      if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i
    }
    setHoverIdx(best)
    show(
      event,
      <TooltipRows
        title={quarterLabel(periods[best])}
        rows={series.map((s) => ({ label: s.label, value: pct(s.points[best].share) }))}
      />,
    )
  }

  function onLeave() {
    setHoverIdx(null)
    hide()
  }

  const showLegend = series.length > 1

  return (
    <>
      {showLegend && (
        <div className="legend">
          {series.map((s, i) => (
            <span key={s.key}>
              <i className="swatch" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} /> {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="chart-scroll">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          role="img"
          aria-label={`${assetLabel} as a share of total assets over time`}
        >
          {yTicks.map((t, i) => (
            <g className="tick" key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yFor(t)} y2={yFor(t)} />
              <text x={PAD.left - 8} y={yFor(t) + 4} textAnchor="end">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}

          {periods.map((p, i) =>
            i % Math.ceil(periods.length / 8) === 0 ? (
              <text className="axis-label" key={p} x={xs[i]} y={H - 9} textAnchor="middle">
                {p.slice(0, 4)}
              </text>
            ) : null,
          )}

          {hoverIdx != null && (
            <line x1={xs[hoverIdx]} x2={xs[hoverIdx]} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--axis)" strokeWidth="1" />
          )}

          {paths.map((d, i) => (
            <path key={series[i].key} d={d} fill="none" stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {hoverIdx != null &&
            series.map((s, i) => (
              <circle
                key={s.key}
                cx={xs[hoverIdx]}
                cy={yFor(s.points[hoverIdx].share)}
                r="4.5"
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ))}

          <line className="baseline" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
        </svg>
      </div>
      <Tooltip tip={tip} />
    </>
  )
}
