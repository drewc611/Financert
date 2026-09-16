import { useMemo, useState } from 'react'
import ChartFrame from './ChartFrame'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { useI18n } from '../i18n'

const W = 1000
const H = 300
const PAD = { top: 14, right: 18, bottom: 30, left: 46 }

const SERIES_COLORS = ['var(--series-you)', 'var(--series-bench)']
// The second line is dashed as well as differently coloured, so the pair
// survives greyscale print and colour-vision deficiency (BACKLOG F48). A line
// takes a dash where a bar takes a hatch; both say "this is the other one".
const SERIES_DASH = [undefined, '7 4']

/** Multi-line trend of one asset class's share of assets, over time.
 *  Crosshair + tooltip on hover, as line charts should have by default. */
export default function TrendChart({ series, assetLabel }) {
  const { tip, show, showAt, hide } = useTooltip()
  const { t, fmt } = useI18n()
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

  if (!periods.length) return <p className="empty">{t('chart.noHistory')}</p>

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
        title={fmt.quarter(periods[best])}
        rows={series.map((s) => ({ label: s.label, value: fmt.pct(s.points[best].share) }))}
      />,
    )
  }

  function onLeave() {
    setHoverIdx(null)
    hide()
  }

  /** The crosshair, driven from the keyboard (BACKLOG F49): the chart is one
   *  tab stop, and left/right walk the quarters. The tooltip is a live region,
   *  so each step is announced as well as drawn. */
  function moveTo(index, element) {
    const clamped = Math.min(periods.length - 1, Math.max(0, index))
    setHoverIdx(clamped)
    showAt(
      element,
      <TooltipRows
        title={fmt.quarter(periods[clamped])}
        rows={series.map((s) => ({ label: s.label, value: fmt.pct(s.points[clamped].share) }))}
      />,
    )
  }

  function onKeyDown(event) {
    const from = hoverIdx ?? 0
    const next = {
      ArrowRight: from + 1,
      ArrowUp: from + 1,
      ArrowLeft: from - 1,
      ArrowDown: from - 1,
      Home: 0,
      End: periods.length - 1,
    }[event.key]
    if (next == null) {
      if (event.key === 'Escape') onLeave()
      return
    }
    event.preventDefault()
    moveTo(next, event.currentTarget)
  }

  const showLegend = series.length > 1

  return (
    <>
      <ChartFrame
        filename={`financert-trend-${assetLabel}`}
        caption={t('chart.trendAria', { asset: assetLabel })}
        legend={
          // One line needs no key; two or more do.
          showLegend
            ? series.map((s, i) => ({
                key: s.key,
                label: s.label,
                color: SERIES_COLORS[i % SERIES_COLORS.length],
                dashed: Boolean(SERIES_DASH[i % SERIES_DASH.length]),
              }))
            : []
        }
        table={<TrendTable series={series} />}
      >
      <div className="chart-scroll">
        <svg
          className="chart-svg chart-row"
          viewBox={`0 0 ${W} ${H}`}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          onFocus={(e) => moveTo(hoverIdx ?? 0, e.currentTarget)}
          onBlur={onLeave}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="img"
          aria-label={t('chart.trendAria', { asset: assetLabel })}
        >
          {/* `tick`, not `t` -- `t` is the translation function in this scope. */}
          {yTicks.map((tick, i) => (
            <g className="tick" key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yFor(tick)} y2={yFor(tick)} />
              <text x={PAD.left - 8} y={yFor(tick) + 4} textAnchor="end">
                {fmt.pct(tick, { digits: 0 })}
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
            <path
              key={series[i].key}
              d={d}
              fill="none"
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeDasharray={SERIES_DASH[i % SERIES_DASH.length]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
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
      </ChartFrame>
      <Tooltip tip={tip} />
    </>
  )
}

/** One row per quarter, one column per line on the chart. */
function TrendTable({ series }) {
  const { t, fmt } = useI18n()
  const periods = series[0]?.points.map((p) => p.period) ?? []
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('controls.quarter')}</th>
          {series.map((s) => (
            <th scope="col" className="num" key={s.key}>
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {periods.map((period, i) => (
          <tr key={period}>
            <td>{fmt.quarter(period)}</td>
            {series.map((s) => (
              <td className="num" key={s.key}>
                {fmt.pct(s.points[i]?.share)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
