import { useEffect, useMemo, useState } from 'react'
import ChartFrame from './ChartFrame'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { api } from '../lib/api'
import { cosineSimilarity, portfolioWeights } from '../lib/analysis'
import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

const W = 1000
const H = 280
const PAD = { top: 14, right: 18, bottom: 30, left: 46 }

/* Your mix, held still, against a group that moves (BACKLOG F31).
 *
 * The rest of the dashboard compares one quarter. This holds the reader's
 * allocation fixed and runs the *tier* through 147 of them, which answers a
 * question the single-quarter view cannot: was this mix ever like theirs? For
 * a household mostly in a house the answer is usually no and getting worse --
 * the top 1% held a fifth in equities in 1989 and half of it now, so the
 * distance has been growing for thirty years rather than being a fact about
 * today.
 *
 * Computed here from the composition endpoint rather than server-side: the
 * reader's holdings are the other half of every one of these points, and they
 * do not leave the page.
 */
export default function GapOverTime({ groupKey, label }) {
  const { holdings, investableOnly, mode } = useAppData()
  const { tip, show, showAt, hide } = useTooltip()
  const { t, fmt } = useI18n()
  const [answer, setAnswer] = useState({ state: 'loading', points: [] })
  const [hoverIdx, setHoverIdx] = useState(null)

  const mine = useMemo(() => portfolioWeights(holdings), [holdings])
  const hasHoldings = Object.keys(mine).length > 0

  useEffect(() => {
    if (mode !== 'live' || !hasHoldings) {
      setAnswer({ state: mode === 'live' ? 'loading' : 'offline', points: [] })
      return
    }
    let cancelled = false
    setAnswer({ state: 'loading', points: [] })
    api
      .composition({ group: groupKey, investableOnly })
      .then((data) => !cancelled && setAnswer({ state: 'ready', points: data.points }))
      .catch(() => !cancelled && setAnswer({ state: 'failed', points: [] }))
    return () => {
      cancelled = true
    }
  }, [groupKey, investableOnly, mode, hasHoldings])

  const series = useMemo(
    () => answer.points.map((point) => ({ period: point.period, similarity: cosineSimilarity(mine, point.shares) })),
    [answer, mine],
  )

  if (!hasHoldings) return null
  if (answer.state !== 'ready' || !series.length) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>{t('compare.overTimeTitle', { tier: label })}</h2>
        </div>
        <p className="empty">
          {answer.state === 'offline' ? t('compare.overTimeNeedsApi') : answer.state === 'failed' ? t('compare.overTimeFailed') : t('app.loading')}
        </p>
      </div>
    )
  }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const xs = series.map((_, i) => PAD.left + (i / (series.length - 1)) * plotW)
  // Fixed 0–1 rather than fitted: a similarity of 0.9 means the same thing in
  // every quarter, and an axis that rescales itself would turn a flat line
  // into a dramatic one.
  const y = (value) => PAD.top + plotH - value * plotH
  const path = series.map((point, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y(point.similarity).toFixed(1)}`).join(' ')

  const best = series.reduce((a, b) => (b.similarity > a.similarity ? b : a))
  const worst = series.reduce((a, b) => (b.similarity < a.similarity ? b : a))
  const now = series[series.length - 1]

  function indexAt(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    let bestIdx = 0
    for (let i = 1; i < xs.length; i += 1) {
      if (Math.abs(xs[i] - px) < Math.abs(xs[bestIdx] - px)) bestIdx = i
    }
    return bestIdx
  }

  const tipFor = (index) => (
    <TooltipRows
      title={fmt.quarter(series[index].period)}
      rows={[{ label: t('compare.similarityTo', { tier: label }), value: fmt.num(series[index].similarity) }]}
    />
  )

  function moveTo(index, element) {
    const clamped = Math.min(series.length - 1, Math.max(0, index))
    setHoverIdx(clamped)
    showAt(element, tipFor(clamped))
  }

  function onKeyDown(event) {
    const from = hoverIdx ?? series.length - 1
    const next = { ArrowRight: from + 1, ArrowUp: from + 1, ArrowLeft: from - 1, ArrowDown: from - 1, Home: 0, End: series.length - 1 }[
      event.key
    ]
    if (next == null) {
      if (event.key === 'Escape') {
        setHoverIdx(null)
        hide()
      }
      return
    }
    event.preventDefault()
    moveTo(next, event.currentTarget)
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('compare.overTimeTitle', { tier: label })}</h2>
      </div>
      <p className="sub">
        {t('compare.overTimeSub', { tier: label })}{' '}
        {t('compare.overTimeRange', {
          best: fmt.quarter(best.period),
          bestValue: fmt.num(best.similarity),
          worst: fmt.quarter(worst.period),
          worstValue: fmt.num(worst.similarity),
          now: fmt.num(now.similarity),
        })}
      </p>

      <ChartFrame
        filename={`financert-similarity-${label}`}
        caption={t('compare.overTimeTitle', { tier: label })}
        table={<OverTimeTable series={series} label={label} />}
      >
        <div className="chart-scroll">
          <svg
            className="chart-svg chart-row"
            viewBox={`0 0 ${W} ${H}`}
            tabIndex={0}
            role="img"
            aria-label={t('compare.overTimeTitle', { tier: label })}
            onMouseMove={(e) => {
              const index = indexAt(e)
              setHoverIdx(index)
              show(e, tipFor(index))
            }}
            onMouseLeave={() => {
              setHoverIdx(null)
              hide()
            }}
            onFocus={(e) => moveTo(hoverIdx ?? series.length - 1, e.currentTarget)}
            onBlur={() => {
              setHoverIdx(null)
              hide()
            }}
            onKeyDown={onKeyDown}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <g className="tick" key={tick}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
                {/* Two digits, because one rounds the 0.25 gridline to "0.3"
                    and the 0.75 one to "0.8" -- an axis that lies about where
                    its own lines are. */}
                <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
                  {fmt.num(tick, { digits: 2 })}
                </text>
              </g>
            ))}

            {series.map((point, i) =>
              i % Math.ceil(series.length / 8) === 0 ? (
                <text className="axis-label" key={point.period} x={xs[i]} y={H - 9} textAnchor="middle">
                  {point.period.slice(0, 4)}
                </text>
              ) : null,
            )}

            <path d={path} fill="none" stroke="var(--series-you)" strokeWidth="2" strokeLinejoin="round" />

            {hoverIdx != null && (
              <>
                <line x1={xs[hoverIdx]} x2={xs[hoverIdx]} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--axis)" strokeWidth="1" />
                <circle cx={xs[hoverIdx]} cy={y(series[hoverIdx].similarity)} r="4.5" fill="var(--series-you)" stroke="var(--surface)" strokeWidth="2" />
              </>
            )}

            <line className="baseline" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
          </svg>
        </div>
      </ChartFrame>
      <Tooltip tip={tip} />
    </div>
  )
}

function OverTimeTable({ series, label }) {
  const { t, fmt } = useI18n()
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('controls.quarter')}</th>
          <th scope="col" className="num">
            {t('compare.similarityTo', { tier: label })}
          </th>
        </tr>
      </thead>
      <tbody>
        {series.map((point) => (
          <tr key={point.period}>
            <td>{fmt.quarter(point.period)}</td>
            <td className="num">{fmt.num(point.similarity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
