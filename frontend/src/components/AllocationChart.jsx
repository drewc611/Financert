import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { useI18n } from '../i18n'
import { labelGutter } from '../lib/chartLabels'

const ROW_H = 34
const BAR_H = 11
const BAR_GAP = 2 // surface gap between the paired bars
// Wide enough for the direct label ("52% / 13%") to sit past the longest bar
// without being clipped by the viewBox.
const PAD_R = 96
const PAD_T = 8

/** Paired horizontal bars: the user's allocation against one wealth tier.
 *  Two series, so a legend is always present; values are direct-labeled. */
export default function AllocationChart({ rows, benchmarkLabel, userLabel }) {
  const { tip, show, hide } = useTooltip()
  const { t, fmt } = useI18n()
  const you = userLabel ?? t('chart.you')

  if (!rows.length) return <p className="empty">{t('chart.noAllocation')}</p>

  const height = PAD_T + rows.length * ROW_H + 26
  // Sized to the translated labels -- a fixed gutter clips them.
  const LABEL_W = labelGutter(rows.map((r) => r.label))
  const max = Math.max(0.01, ...rows.flatMap((r) => [r.user, r.benchmark]))
  const plotW = 1000 - LABEL_W - PAD_R
  const x = (v) => (v / max) * plotW

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)

  return (
    <>
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--series-you)' }} /> {you}
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
          aria-label={t('chart.allocationAria', { you, tier: benchmarkLabel })}
        >
          {/* `tick`, not `t` -- `t` is the translation function in this scope. */}
          {ticks.map((tick, i) => (
            <g className="tick" key={i}>
              <line x1={LABEL_W + x(tick)} x2={LABEL_W + x(tick)} y1={PAD_T} y2={PAD_T + rows.length * ROW_H} />
              <text x={LABEL_W + x(tick)} y={height - 8} textAnchor="middle">
                {fmt.pct(tick, { digits: 0 })}
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
                  { label: you, value: fmt.pct(row.user) },
                  { label: benchmarkLabel, value: fmt.pct(row.benchmark) },
                  { label: t('chart.difference'), value: fmt.pp((row.user - row.benchmark) * 100) },
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
                  {fmt.pct(row.user, { digits: 0 })} / {fmt.pct(row.benchmark, { digits: 0 })}
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
