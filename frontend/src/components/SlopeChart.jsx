import { useRef, useState } from 'react'
import ChartFrame from './ChartFrame'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { useI18n } from '../i18n'

const W = 1000
const H = 420
const PAD = { top: 34, bottom: 24 }
// The two columns sit well inside the width: the labels either side are the
// widest thing on the chart, not the lines.
const LEFT = 250
const RIGHT = 750
const MIN_LABEL_GAP = 15
// Below this, a class is a hairline at the bottom of both columns and its
// label is only in the way. It still has a line, and a row in the table.
const LABEL_FLOOR = 0.02

/* Your allocation against one tier, class by class (BACKLOG F45).
 *
 * The gap chart beside it ranks the differences; this shows the *order* of the
 * two mixes and where it changes hands. A household with half its money in a
 * house and a tier with half of its in equities have the same two classes at
 * the top in opposite order, and the crossing lines are that fact.
 */
export default function SlopeChart({ rows, benchmarkLabel, youLabel }) {
  const { tip, show, showAt, hide } = useTooltip()
  const { t, fmt } = useI18n()
  const [focusRow, setFocusRow] = useState(0)
  const refs = useRef([])

  if (!rows.length) return <p className="empty">{t('chart.noAllocation')}</p>

  const max = Math.max(0.05, ...rows.flatMap((r) => [r.user, r.benchmark]))
  const plotH = H - PAD.top - PAD.bottom
  const y = (share) => PAD.top + plotH - (share / max) * plotH

  // Labels are pushed apart where they would overlap, from the top down, so a
  // cluster of small classes at the bottom stays readable.
  const place = (key) => {
    const placed = []
    let previous = -Infinity
    for (const row of [...rows].sort((a, b) => b[key] - a[key])) {
      const wanted = y(row[key])
      const at = Math.max(wanted, previous + MIN_LABEL_GAP)
      placed.push({ row, at, show: row[key] >= LABEL_FLOOR })
      previous = at
    }
    return placed
  }
  const leftLabels = place('user')
  const rightLabels = place('benchmark')

  function onKeyDown(event, index) {
    const next = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: rows.length - 1 }[
      event.key
    ]
    if (next == null) {
      if (event.key === 'Escape') hide()
      return
    }
    event.preventDefault()
    const clamped = Math.min(rows.length - 1, Math.max(0, next))
    setFocusRow(clamped)
    refs.current[clamped]?.focus()
  }

  return (
    <>
      <ChartFrame
        filename={`financert-slope-${benchmarkLabel}`}
        caption={t('chart.slopeAria', { you: youLabel, tier: benchmarkLabel })}
        table={<SlopeTable rows={rows} you={youLabel} benchmarkLabel={benchmarkLabel} />}
      >
        <div className="chart-scroll">
          <svg
            className="chart-svg slope-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            aria-label={t('chart.slopeAria', { you: youLabel, tier: benchmarkLabel })}
          >
            <text className="bar-label" x={LEFT} y={18} textAnchor="middle">
              {youLabel}
            </text>
            <text className="bar-label" x={RIGHT} y={18} textAnchor="middle">
              {benchmarkLabel}
            </text>
            <line className="baseline" x1={LEFT} x2={LEFT} y1={PAD.top} y2={PAD.top + plotH} />
            <line className="baseline" x1={RIGHT} x2={RIGHT} y1={PAD.top} y2={PAD.top + plotH} />

            {rows.map((row, i) => {
              const left = leftLabels.find((l) => l.row.key === row.key)
              const right = rightLabels.find((l) => l.row.key === row.key)
              const rising = row.benchmark > row.user
              const tipContent = (
                <TooltipRows
                  title={row.label}
                  rows={[
                    { label: youLabel, value: fmt.pct(row.user) },
                    { label: benchmarkLabel, value: fmt.pct(row.benchmark) },
                    { label: t('chart.difference'), value: fmt.pp((row.user - row.benchmark) * 100) },
                  ]}
                />
              )
              return (
                <g
                  key={row.key}
                  className="chart-row"
                  ref={(node) => {
                    refs.current[i] = node
                  }}
                  tabIndex={i === focusRow ? 0 : -1}
                  role="img"
                  aria-label={`${row.label}: ${youLabel} ${fmt.pct(row.user)}, ${benchmarkLabel} ${fmt.pct(row.benchmark)}`}
                  onMouseMove={(e) => show(e, tipContent)}
                  onMouseLeave={hide}
                  onFocus={(e) => {
                    setFocusRow(i)
                    showAt(e.currentTarget, tipContent)
                  }}
                  onBlur={hide}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  {/* Dashed where the tier holds more than the reader does, so
                      the direction survives greyscale and colour-vision
                      deficiency like every other chart here (BACKLOG F48). */}
                  <line
                    x1={LEFT}
                    x2={RIGHT}
                    y1={y(row.user)}
                    y2={y(row.benchmark)}
                    stroke={rising ? 'var(--series-bench)' : 'var(--series-you)'}
                    strokeWidth="2"
                    strokeDasharray={rising ? '7 4' : undefined}
                  />
                  <circle cx={LEFT} cy={y(row.user)} r="4" fill="var(--series-you)" />
                  <circle cx={RIGHT} cy={y(row.benchmark)} r="4" fill="var(--series-bench)" />
                  {left?.show && (
                    <text className="bar-value" x={LEFT - 12} y={left.at + 4} textAnchor="end">
                      {row.label} {fmt.pct(row.user, { digits: 0 })}
                    </text>
                  )}
                  {right?.show && (
                    <text className="bar-value" x={RIGHT + 12} y={right.at + 4}>
                      {fmt.pct(row.benchmark, { digits: 0 })} {row.label}
                    </text>
                  )}
                  <rect className="hit" x={LEFT} y={Math.min(y(row.user), y(row.benchmark)) - 7} width={RIGHT - LEFT} height={Math.abs(y(row.user) - y(row.benchmark)) + 14} />
                </g>
              )
            })}
          </svg>
        </div>
      </ChartFrame>
      <Tooltip tip={tip} />
    </>
  )
}

function SlopeTable({ rows, you, benchmarkLabel }) {
  const { t, fmt } = useI18n()
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('benchmarks.assetClass')}</th>
          <th scope="col" className="num">
            {you}
          </th>
          <th scope="col" className="num">
            {benchmarkLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.label}</td>
            <td className="num">{fmt.pct(row.user)}</td>
            <td className="num">{fmt.pct(row.benchmark)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
