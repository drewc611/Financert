import { useMemo, useRef, useState } from 'react'
import ChartFrame from './ChartFrame'
import { Tooltip, TooltipRows, useTooltip } from './Tooltip'
import { bandKeys, bands, OTHER } from '../lib/composition'
import { useI18n } from '../i18n'

const W = 1000
const H = 300
const PAD = { top: 14, bottom: 34 }
const BANDS = 7
const COLORS = Array.from({ length: BANDS }, (_, i) => `var(--stack-${i + 1})`)

/* Every group's mix, side by side in one quarter (BACKLOG F43).
 *
 * The table above gives the same numbers and is the better tool for reading
 * any one of them. This is for the shape: five columns in the same band order,
 * so the trade that runs down the distribution -- equities and private
 * business at the top, a house at the bottom -- is one glance rather than
 * eleven rows of arithmetic.
 *
 * The bands are the same seven for every column, ranked across all of them, so
 * a colour means the same class in each.
 */
export default function TierComposition({ groups, labelFor, tierLabel }) {
  const { tip, show, showAt, hide } = useTooltip()
  const { t, fmt } = useI18n()
  const [focusCol, setFocusCol] = useState(0)
  const refs = useRef([])

  const { keys, columns } = useMemo(() => {
    const mixes = groups.map((g) => g.weights)
    const keys = bandKeys(mixes, { limit: BANDS - 1 })
    return { keys, columns: mixes.map((mix) => bands(mix, keys)) }
  }, [groups])

  if (groups.length < 2) return <p className="empty">{t('chart.noShape')}</p>

  const plotH = H - PAD.top - PAD.bottom
  const slot = W / groups.length
  const barW = Math.min(110, slot * 0.6)
  const y = (share) => PAD.top + plotH - share * plotH
  const bandLabel = (key) => (key === OTHER ? t('chart.otherClasses') : labelFor(key))

  function onKeyDown(event, index) {
    const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: groups.length - 1 }[
      event.key
    ]
    if (next == null) {
      if (event.key === 'Escape') hide()
      return
    }
    event.preventDefault()
    const clamped = Math.min(groups.length - 1, Math.max(0, next))
    setFocusCol(clamped)
    refs.current[clamped]?.focus()
  }

  return (
    <>
      <ChartFrame
        filename="financert-tier-composition"
        caption={t('chart.multiplesAria')}
        legend={keys.map((key, i) => ({ key, label: bandLabel(key), color: COLORS[i] }))}
        table={<MultiplesTable groups={groups} columns={columns} keys={keys} bandLabel={bandLabel} tierLabel={tierLabel} />}
      >
        <div className="chart-scroll">
          <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('chart.multiplesAria')}>
            {groups.map((group, i) => {
              const cx = slot * i + slot / 2
              const label = tierLabel(group.key, group.label)
              const tipContent = (
                <TooltipRows
                  title={label}
                  rows={columns[i]
                    .filter((band) => band.share > 0)
                    .map((band) => ({ label: bandLabel(band.key), value: fmt.pct(band.share) }))
                    .reverse()}
                />
              )
              return (
                <g
                  key={group.key}
                  className="chart-row"
                  ref={(node) => {
                    refs.current[i] = node
                  }}
                  tabIndex={i === focusCol ? 0 : -1}
                  role="img"
                  aria-label={`${label}: ${columns[i]
                    .filter((band) => band.share >= 0.01)
                    .map((band) => `${bandLabel(band.key)} ${fmt.pct(band.share)}`)
                    .reverse()
                    .join(', ')}`}
                  onMouseMove={(e) => show(e, tipContent)}
                  onMouseLeave={hide}
                  onFocus={(e) => {
                    setFocusCol(i)
                    showAt(e.currentTarget, tipContent)
                  }}
                  onBlur={hide}
                  onKeyDown={(e) => onKeyDown(e, i)}
                >
                  {columns[i].map((band, index) => (
                    <rect
                      key={band.key}
                      x={cx - barW / 2}
                      y={y(band.to)}
                      width={barW}
                      height={Math.max(0, y(band.from) - y(band.to))}
                      fill={COLORS[index]}
                      stroke="var(--surface)"
                      strokeWidth="0.75"
                    />
                  ))}
                  {/* The largest band carries its own figure: it is the whole
                      headline of each column, and a tooltip is no use to
                      someone reading the five side by side. */}
                  {columns[i]
                    .filter((band) => band.share >= 0.2)
                    .map((band, index) => (
                      <text
                        className="bar-value"
                        key={band.key}
                        x={cx}
                        y={(y(band.to) + y(band.from)) / 2 + 4}
                        textAnchor="middle"
                        fill={index < 3 ? 'var(--surface)' : 'var(--text-primary)'}
                      >
                        {fmt.pct(band.share, { digits: 0 })}
                      </text>
                    ))}
                  <text className="bar-label" x={cx} y={H - 12} textAnchor="middle">
                    {label}
                  </text>
                  <rect className="hit" x={slot * i} y={0} width={slot} height={H} />
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

function MultiplesTable({ groups, columns, keys, bandLabel, tierLabel }) {
  const { t, fmt } = useI18n()
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('benchmarks.assetClass')}</th>
          {groups.map((group) => (
            <th scope="col" className="num" key={group.key}>
              {tierLabel(group.key, group.label)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {keys.map((key, index) => (
          <tr key={key}>
            <td>{bandLabel(key)}</td>
            {groups.map((group, i) => (
              <td className="num" key={group.key}>
                {fmt.pct(columns[i][index].share)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
