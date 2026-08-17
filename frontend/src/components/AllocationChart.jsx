import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { pct } from '../lib/format'

const ROW_H = 34
const BAR_H = 11
const BAR_GAP = 2 // surface gap between the paired bars
const LABEL_W = 168
// Wide enough for the direct label ("52% / 13%") to sit past the longest bar
// without being clipped by the viewBox.
const PAD_R = 96
const PAD_T = 8

/** Paired horizontal bars: the user's allocation against one wealth tier.
 *  Two series, so a legend is always present; values are direct-labeled. */
export default function AllocationChart({ rows, benchmarkLabel, userLabel = 'You' }) {
  const { tip, show, hide } = useTooltip()

  if (!rows.length) return <p className="empty">No allocation to show yet.</p>

  const height = PAD_T + rows.length * ROW_H + 26
  const max = Math.max(0.01, ...rows.flatMap((r) => [r.user, r.benchmark]))
  const plotW = 1000 - LABEL_W - PAD_R
  const x = (v) => (v / max) * plotW

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)

  return (
    <>
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--series-you)' }} /> {userLabel}
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--series-bench)' }} /> {benchmarkLabel}
        </span>
      </div>

      <div className="chart-scroll">
        <svg
          className="chart-svg"
          viewBox={`0 0 1000 ${height}`}
          role="img"
          aria-label={`Allocation of ${userLabel} compared with ${benchmarkLabel}, by asset class`}
        >
          {ticks.map((t, i) => (
            <g className="tick" key={i}>
              <line x1={LABEL_W + x(t)} x2={LABEL_W + x(t)} y1={PAD_T} y2={PAD_T + rows.length * ROW_H} />
              <text x={LABEL_W + x(t)} y={height - 8} textAnchor="middle">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}

          {rows.map((row, i) => {
            const top = PAD_T + i * ROW_H
            const yUser = top + (ROW_H - BAR_H * 2 - BAR_GAP) / 2
            const yBench = yUser + BAR_H + BAR_GAP
            const tipContent = (
              <TooltipRows
                title={row.label}
                rows={[
                  { label: userLabel, value: pct(row.user) },
                  { label: benchmarkLabel, value: pct(row.benchmark) },
                  { label: 'Difference', value: `${row.user > row.benchmark ? '+' : ''}${((row.user - row.benchmark) * 100).toFixed(1)}pp` },
                ]}
              />
            )
            return (
              <g key={row.key} onMouseMove={(e) => show(e, tipContent)} onMouseLeave={hide}>
                <text className="bar-label" x={LABEL_W - 12} y={top + ROW_H / 2 + 4} textAnchor="end">
                  {row.label}
                </text>
                <rect x={LABEL_W} y={yUser} width={Math.max(x(row.user), 1)} height={BAR_H} rx="4" fill="var(--series-you)" />
                <rect x={LABEL_W} y={yBench} width={Math.max(x(row.benchmark), 1)} height={BAR_H} rx="4" fill="var(--series-bench)" />
                <text className="bar-value" x={LABEL_W + Math.max(x(Math.max(row.user, row.benchmark)), 1) + 8} y={top + ROW_H / 2 + 4}>
                  {pct(row.user, 0)} / {pct(row.benchmark, 0)}
                </text>
                <rect className="hit" x={0} y={top} width={1000} height={ROW_H} />
              </g>
            )
          })}

          <line className="baseline" x1={LABEL_W} x2={LABEL_W} y1={PAD_T} y2={PAD_T + rows.length * ROW_H} />
        </svg>
      </div>
      <Tooltip tip={tip} />
    </>
  )
}
