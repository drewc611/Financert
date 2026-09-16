import { useId, useRef, useState } from 'react'
import ChartFrame from './ChartFrame'
import Hatch from './Hatch'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { useI18n } from '../i18n'
import { labelGutter } from '../lib/chartLabels'

const ROW_H = 30
const BAR_H = 12
const PAD_R = 24
const VALUE_GUTTER = 62 // room for the "-35.4pp" label at the end of a full-length bar
const PAD_T = 10
const PAD_B = 26

/** Diverging bars around a zero baseline: how far each asset class sits
 *  above or below the benchmark. Polarity is the whole point, so this uses
 *  the diverging pair with a neutral midpoint rather than categorical hues. */
export default function GapChart({ gaps, benchmarkLabel }) {
  const { tip, show, showAt, hide } = useTooltip()
  const { t, fmt } = useI18n()
  // Punctuation stripped: a fragment reference is matched literally, and
  // useId() is punctuated. See AllocationChart for the same note.
  const hatchId = `hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [focusRow, setFocusRow] = useState(0)
  const rowRefs = useRef([])

  // "Pending" rows have no verdict to plot -- a bar on a diverging over/under
  // axis would assert a gap the data cannot support. They stay in the table.
  const rows = gaps.filter(
    (g) => g.status !== 'pending' && (g.status !== 'in_line' || Math.abs(g.gap_pp) > 0.05),
  )
  if (!rows.length) return <p className="empty">{t('chart.allInLine', { tier: benchmarkLabel })}</p>

  // Sized to the translated labels -- a fixed gutter clips them.
  const LABEL_W = labelGutter(rows.map((r) => r.label))

  const height = PAD_T + rows.length * ROW_H + PAD_B
  const max = Math.max(5, ...rows.map((r) => Math.abs(r.gap_pp)))
  const plotW = 1000 - LABEL_W - PAD_R
  const mid = LABEL_W + plotW / 2
  // Each arm stops short of the plot edge so a full-length bar's value label
  // still has room to sit outside it, instead of colliding with the row
  // labels on the left or running off the viewBox on the right.
  const armW = plotW / 2 - VALUE_GUTTER
  const x = (v) => (v / max) * armW

  function onKeyDown(event, index) {
    const next = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: rows.length - 1 }[event.key]
    if (next == null) {
      if (event.key === 'Escape') hide()
      return
    }
    event.preventDefault()
    const clamped = Math.min(rows.length - 1, Math.max(0, next))
    setFocusRow(clamped)
    rowRefs.current[clamped]?.focus()
  }

  return (
    <>
      {/* Under-weight is the hatched side here as well as the red one:
          over/under is the whole reading, and red against blue is the pair
          most often lost to colour-vision deficiency (BACKLOG F48). */}
      <ChartFrame
        filename={`financert-gaps-${benchmarkLabel}`}
        caption={t('chart.gapAria', { tier: benchmarkLabel })}
        legend={[
          { key: 'over', label: t('chart.moreThan', { tier: benchmarkLabel }), color: 'var(--diverge-over)' },
          {
            key: 'under',
            label: t('chart.lessThan', { tier: benchmarkLabel }),
            color: 'var(--diverge-under)',
            hatched: true,
          },
        ]}
      >
      <div className="chart-scroll">
        <svg
          className="chart-svg"
          viewBox={`0 0 1000 ${height}`}
          role="group"
          aria-label={t('chart.gapAria', { tier: benchmarkLabel })}
        >
          <Hatch id={hatchId} color="var(--diverge-under)" />

          {/* `tick`, not `t` -- `t` is the translation function in this scope. */}
          {[-max, -max / 2, 0, max / 2, max].map((tick, i) => (
            <g className="tick" key={i}>
              <line x1={mid + x(tick)} x2={mid + x(tick)} y1={PAD_T} y2={PAD_T + rows.length * ROW_H} />
              <text x={mid + x(tick)} y={height - 8} textAnchor="middle">
                {fmt.pp(tick, { digits: 0 })}
              </text>
            </g>
          ))}

          {rows.map((row, i) => {
            const top = PAD_T + i * ROW_H
            const y = top + (ROW_H - BAR_H) / 2
            const over = row.gap_pp > 0
            const w = Math.max(Math.abs(x(row.gap_pp)), 2)
            const tipContent = (
              <TooltipRows
                title={row.label}
                rows={[
                  { label: t('chart.you'), value: fmt.pct(row.user_pct / 100) },
                  { label: benchmarkLabel, value: fmt.pct(row.benchmark_pct / 100) },
                  { label: t('chart.difference'), value: fmt.pp(row.gap_pp) },
                ]}
              />
            )
            return (
              <g
                key={row.asset_class}
                className="chart-row"
                ref={(node) => {
                  rowRefs.current[i] = node
                }}
                tabIndex={i === focusRow ? 0 : -1}
                role="img"
                aria-label={`${row.label}: ${t('chart.you')} ${fmt.pct(row.user_pct / 100)}, ${benchmarkLabel} ${fmt.pct(row.benchmark_pct / 100)}, ${t('chart.difference')} ${fmt.pp(row.gap_pp)}`}
                onMouseMove={(e) => show(e, tipContent)}
                onMouseLeave={hide}
                onFocus={(e) => {
                  setFocusRow(i)
                  showAt(e.currentTarget, tipContent)
                }}
                onBlur={hide}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <text className="bar-label" x={LABEL_W - 12} y={top + ROW_H / 2 + 4} textAnchor="end">
                  {row.label}
                </text>
                <rect
                  x={over ? mid : mid - w}
                  y={y}
                  width={w}
                  height={BAR_H}
                  rx="4"
                  fill={over ? 'var(--diverge-over)' : `url(#${hatchId})`}
                />
                <text
                  className="bar-value"
                  x={over ? mid + w + 8 : mid - w - 8}
                  y={top + ROW_H / 2 + 4}
                  textAnchor={over ? 'start' : 'end'}
                >
                  {fmt.pp(row.gap_pp)}
                </text>
                <rect className="hit" x={0} y={top} width={1000} height={ROW_H} />
              </g>
            )
          })}

          <line className="baseline" x1={mid} x2={mid} y1={PAD_T} y2={PAD_T + rows.length * ROW_H} />
        </svg>
      </div>
      </ChartFrame>
      <Tooltip tip={tip} />
    </>
  )
}
