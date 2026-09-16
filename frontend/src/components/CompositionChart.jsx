import { useMemo, useState } from 'react'
import ChartFrame from './ChartFrame'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { bandKeys, bands, OTHER } from '../lib/composition'
import { useI18n } from '../i18n'

const W = 1000
const H = 340
const PAD = { top: 12, right: 18, bottom: 30, left: 46 }
// Seven is what the ramp in styles.css has, and about as many bands as anyone
// can hold in mind at once; everything else is collected into "other".
const BANDS = 7
const COLORS = Array.from({ length: BANDS }, (_, i) => `var(--stack-${i + 1})`)

/* One group's whole mix, quarter by quarter (BACKLOG F42).
 *
 * The trend chart answers "what happened to equities"; this answers "what
 * happened to the mix", which is the question the top 1% actually poses: they
 * went from a fifth in equities and a fifth in private business to half in
 * equities, and no single line shows that trade.
 *
 * Every quarter's bands sum to 1 -- the API renormalises over the classes that
 * quarter published -- so a gap at the top would mean a bug rather than wealth
 * that went somewhere unnamed.
 */
export default function CompositionChart({ points, label, labelFor }) {
  const { tip, show, showAt, hide } = useTooltip()
  const { t, fmt } = useI18n()
  const [hoverIdx, setHoverIdx] = useState(null)

  const { keys, columns, xs } = useMemo(() => {
    const mixes = points.map((p) => p.shares)
    const keys = bandKeys(mixes, { limit: BANDS - 1 })
    const plotW = W - PAD.left - PAD.right
    return {
      keys,
      columns: mixes.map((mix) => bands(mix, keys)),
      xs: points.map((_, i) =>
        PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW),
      ),
    }
  }, [points])

  if (!points.length) return <p className="empty">{t('chart.noHistory')}</p>

  const plotH = H - PAD.top - PAD.bottom
  const y = (share) => PAD.top + plotH - share * plotH
  const bandLabel = (key) => (key === OTHER ? t('chart.otherClasses') : labelFor(key))

  /* One filled path per band: across the tops of that band, then back along
     the bottoms. Drawn as polygons rather than eleven stacked <rect> columns
     per quarter, which would be 1,600 rectangles. */
  const area = (index) =>
    [
      ...columns.map((column, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y(column[index].to).toFixed(1)}`),
      ...columns
        .map((column, i) => `L${xs[i].toFixed(1)},${y(column[index].from).toFixed(1)}`)
        .reverse(),
      'Z',
    ].join(' ')

  function at(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < xs.length; i += 1) {
      if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i
    }
    return best
  }

  function tipFor(index) {
    return (
      <TooltipRows
        title={fmt.quarter(points[index].period)}
        rows={columns[index]
          .filter((band) => band.share > 0)
          .map((band) => ({ label: bandLabel(band.key), value: fmt.pct(band.share) }))
          .reverse()}
      />
    )
  }

  function moveTo(index, element) {
    const clamped = Math.min(points.length - 1, Math.max(0, index))
    setHoverIdx(clamped)
    showAt(element, tipFor(clamped))
  }

  function onKeyDown(event) {
    const from = hoverIdx ?? points.length - 1
    const next = { ArrowRight: from + 1, ArrowUp: from + 1, ArrowLeft: from - 1, ArrowDown: from - 1, Home: 0, End: points.length - 1 }[
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
    <>
      <ChartFrame
        filename={`financert-composition-${label}`}
        caption={t('chart.compositionAria', { tier: label })}
        legend={keys.map((key, i) => ({ key, label: bandLabel(key), color: COLORS[i] }))}
        table={<CompositionTable points={points} columns={columns} keys={keys} bandLabel={bandLabel} />}
      >
        <div className="chart-scroll">
          <svg
            className="chart-svg chart-row"
            viewBox={`0 0 ${W} ${H}`}
            tabIndex={0}
            role="img"
            aria-label={t('chart.compositionAria', { tier: label })}
            onMouseMove={(e) => {
              const index = at(e)
              setHoverIdx(index)
              show(e, tipFor(index))
            }}
            onMouseLeave={() => {
              setHoverIdx(null)
              hide()
            }}
            onFocus={(e) => moveTo(hoverIdx ?? points.length - 1, e.currentTarget)}
            onBlur={() => {
              setHoverIdx(null)
              hide()
            }}
            onKeyDown={onKeyDown}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <g className="tick" key={tick}>
                <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
                  {fmt.pct(tick, { digits: 0 })}
                </text>
              </g>
            ))}

            {keys.map((key, index) => (
              <path
                key={key}
                d={area(index)}
                fill={COLORS[index]}
                /* The hairline is what separates two adjacent steps of a ramp;
                   without it the boundary between the two lightest bands is
                   guesswork. */
                stroke="var(--surface)"
                strokeWidth="0.75"
              />
            ))}

            {points.map((point, i) =>
              i % Math.ceil(points.length / 8) === 0 ? (
                <text className="axis-label" key={point.period} x={xs[i]} y={H - 9} textAnchor="middle">
                  {point.period.slice(0, 4)}
                </text>
              ) : null,
            )}

            {hoverIdx != null && (
              <line x1={xs[hoverIdx]} x2={xs[hoverIdx]} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--text-primary)" strokeWidth="1" />
            )}

            <line className="baseline" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
          </svg>
        </div>
      </ChartFrame>
      <Tooltip tip={tip} />
    </>
  )
}

/** Every band at every quarter. Wide, so it scrolls like the others. */
function CompositionTable({ points, columns, keys, bandLabel }) {
  const { t, fmt } = useI18n()
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('controls.quarter')}</th>
          {keys.map((key) => (
            <th scope="col" className="num" key={key}>
              {bandLabel(key)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {points.map((point, i) => (
          <tr key={point.period}>
            <td>{fmt.quarter(point.period)}</td>
            {columns[i].map((band) => (
              <td className="num" key={band.key}>
                {fmt.pct(band.share)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
