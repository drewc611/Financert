import { useRef, useState } from 'react'
import ChartFrame from './ChartFrame'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { useI18n } from '../i18n'

const W = 1000
const H = 440
const PAD = { top: 18, right: 28, bottom: 46, left: 58 }
const R = 9

/* Liquidity against concentration, one point per tier (BACKLOG F44).
 *
 * The shape table above states both numbers; this states the relationship
 * between them, which the table cannot: the tiers do not sit on a line. The
 * top 1% is both the most concentrated and among the most liquid, because the
 * class it is concentrated in *is* a liquid one -- an arrangement no single
 * column of that table shows.
 *
 * The reader's own portfolio is drawn alongside when there is one, which is
 * the whole reason the chart earns its space: it turns two numbers about
 * strangers into a position relative to them.
 */
export default function ShapeScatter({ points, youLabel }) {
  const { tip, show, showAt, hide } = useTooltip()
  const { t, fmt } = useI18n()
  const [focusPoint, setFocusPoint] = useState(0)
  const refs = useRef([])

  if (points.length < 2) return <p className="empty">{t('chart.noShape')}</p>

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (share) => PAD.left + share * plotW
  const y = (share) => PAD.top + plotH - share * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  function onKeyDown(event, index) {
    const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: points.length - 1 }[
      event.key
    ]
    if (next == null) {
      if (event.key === 'Escape') hide()
      return
    }
    event.preventDefault()
    const clamped = Math.min(points.length - 1, Math.max(0, next))
    setFocusPoint(clamped)
    refs.current[clamped]?.focus()
  }

  return (
    <>
      <ChartFrame
        filename="financert-shape"
        caption={t('chart.scatterAria')}
        table={<ScatterTable points={points} />}
      >
        <div className="chart-scroll">
          <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('chart.scatterAria')}>
            {ticks.map((tick) => (
              <g className="tick" key={tick}>
                <line x1={x(tick)} x2={x(tick)} y1={PAD.top} y2={PAD.top + plotH} />
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(tick)} y2={y(tick)} />
                <text x={x(tick)} y={H - 24} textAnchor="middle">
                  {fmt.pct(tick, { digits: 0 })}
                </text>
                <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
                  {fmt.pct(tick, { digits: 0 })}
                </text>
              </g>
            ))}

            <text className="axis-label" x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle">
              {t('chart.axisLiquidity')}
            </text>
            {/* Rotated about its own midpoint, so it reads bottom-to-top like
                every other vertical axis label. */}
            <text
              className="axis-label"
              x={14}
              y={PAD.top + plotH / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${PAD.top + plotH / 2})`}
            >
              {t('chart.axisConcentration')}
            </text>

            {points.map((point, i) => {
              const cx = x(point.liquidity)
              const cy = y(point.concentration)
              const tipContent = (
                <TooltipRows
                  title={point.label}
                  rows={[
                    { label: t('chart.axisLiquidity'), value: fmt.pct(point.liquidity) },
                    { label: t('chart.axisConcentration'), value: fmt.pct(point.concentration) },
                    { label: t('benchmarks.concentration'), value: point.largest },
                  ]}
                />
              )
              return (
                <g
                  key={point.key}
                  className="chart-row"
                  ref={(node) => {
                    refs.current[i] = node
                  }}
                  tabIndex={i === focusPoint ? 0 : -1}
                  role="img"
                  aria-label={`${point.label}: ${t('chart.axisLiquidity')} ${fmt.pct(point.liquidity)}, ${t('chart.axisConcentration')} ${fmt.pct(point.concentration)}`}
                  onMouseMove={(e) => show(e, tipContent)}
                  onMouseLeave={hide}
                  onFocus={(e) => {
                    setFocusPoint(i)
                    showAt(e.currentTarget, tipContent)
                  }}
                  onBlur={hide}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={R}
                    fill={point.you ? 'var(--series-you)' : 'var(--series-bench)'}
                    fillOpacity={point.you ? 1 : 0.75}
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                  {/* Direct labels rather than a legend: five points, five
                      names, and a legend would be a second lookup. Placed
                      right of the point, or left when that would run off. */}
                  <text
                    className="bar-value"
                    x={cx > PAD.left + plotW - 150 ? cx - R - 6 : cx + R + 6}
                    y={cy + 4}
                    textAnchor={cx > PAD.left + plotW - 150 ? 'end' : 'start'}
                  >
                    {point.label}
                  </text>
                  <circle className="hit" cx={cx} cy={cy} r={R + 12} />
                </g>
              )
            })}
          </svg>
        </div>
      </ChartFrame>
      <Tooltip tip={tip} />
      <p className="sub" style={{ margin: '10px 0 0' }}>
        {t('chart.scatterNote', { you: youLabel })}
      </p>
    </>
  )
}

function ScatterTable({ points }) {
  const { t, fmt } = useI18n()
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('benchmarks.measure')}</th>
          <th scope="col" className="num">
            {t('chart.axisLiquidity')}
          </th>
          <th scope="col" className="num">
            {t('chart.axisConcentration')}
          </th>
          <th scope="col">{t('benchmarks.concentration')}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.key}>
            <td>{point.label}</td>
            <td className="num">{fmt.pct(point.liquidity)}</td>
            <td className="num">{fmt.pct(point.concentration)}</td>
            <td>{point.largest}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
