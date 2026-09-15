import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import { benchmarkWeights, shapeMetrics, UNALLOCATED } from '../lib/analysis'
import TrendChart from '../components/TrendChart'
import DimensionPicker from '../components/DimensionPicker'
import ThresholdPlacement from '../components/ThresholdPlacement'
import { useI18n } from '../i18n'

const TREND_ASSETS = ['corporate_equities', 'private_business', 'real_estate']

export default function Benchmarks() {
  const { benchmarks, activeGroups, periodMode, mode, investableOnly } = useAppData()
  const { t, fmt, assetLabel, tierLabel, percentileRange } = useI18n()
  const [trendAsset, setTrendAsset] = useState('corporate_equities')
  const [trend, setTrend] = useState(null)
  // Shares answer "how is it held"; dollars per household answer "how much"
  // (BACKLOG F29). Shares stay the default -- they are what the page compares.
  const [perHousehold, setPerHousehold] = useState(false)

  // Split so the nested top 0.1% never sits in the same row as the four
  // tiers that partition the population -- they would not sum to anything.
  // Memoised because the trend effect depends on this identity; rebuilding it
  // every render would refetch the trend in a loop.
  const { allGroups, groups, nested } = useMemo(() => {
    const all = Object.values(activeGroups)
    return {
      allGroups: all,
      groups: all.filter((g) => !g.nested),
      nested: all.filter((g) => g.nested),
    }
  }, [activeGroups])

  const rows = useMemo(() => {
    const weightsByGroup = Object.fromEntries(
      allGroups.map((g) => [g.key, benchmarkWeights(g, { investableOnly })]),
    )
    const fullWeightsByGroup = Object.fromEntries(
      allGroups.map((g) => [g.key, benchmarkWeights(g, { investableOnly: false })]),
    )
    const keys = benchmarks.assetClasses
      .map((a) => a.key)
      .filter((k) => allGroups.some((g) => (weightsByGroup[g.key][k] ?? 0) > 0))

    // In an incomplete quarter the residual is holding the classes the Fed has
    // not released, so it says so rather than reading as a real category.
    const unavailable = [...new Set(allGroups.flatMap((g) => g.unavailable || []))]
    const missing = unavailable
      .map((k) => assetLabel(k, benchmarks.assetClasses.find((a) => a.key === k)?.label ?? k))
      .join(', ')

    return keys.map((key) => {
      const english = benchmarks.assetClasses.find((a) => a.key === key)?.label ?? key
      return {
        key,
        label:
          key === UNALLOCATED && missing
            ? `${t('status.pending')} (${missing})`
            : assetLabel(key, english),
        values: Object.fromEntries(allGroups.map((g) => [g.key, weightsByGroup[g.key][key] ?? null])),
        /* The same rows in dollars per household (BACKLOG F29). Measured
           against the whole balance sheet rather than the investable subtotal,
           so the figure is the same whichever way the investable switch is
           set: that switch changes which rows are listed, not how much a
           household holds.

           Read through benchmarkWeights rather than group.assets directly --
           the API sends shares there and the embedded snapshot sends dollars,
           and only the normalised form means the same thing in both. */
        perHousehold: Object.fromEntries(
          allGroups.map((g) => [
            g.key,
            g.household_count > 0
              ? ((fullWeightsByGroup[g.key][key] ?? 0) * g.total_assets) / g.household_count
              : null,
          ]),
        ),
      }
    })
  }, [allGroups, benchmarks, investableOnly, assetLabel, t])

  // Three single-number descriptions of each tier's balance sheet. Computed
  // here rather than read off the API response so they are identical in
  // offline mode, the same reason benchmarkWeights above is a client-side
  // mirror -- see lib/analysis.shapeMetrics.
  const metricRows = useMemo(() => {
    const liquidKeys = new Set(benchmarks.assetClasses.filter((a) => a.liquid).map((a) => a.key))
    const byGroup = Object.fromEntries(
      allGroups.map((g) => [g.key, shapeMetrics(g, benchmarkWeights(g, { investableOnly }), liquidKeys)]),
    )
    return [
      { key: 'leverage', label: t('benchmarks.leverage'), pick: (m) => m.leverage },
      { key: 'liquidity', label: t('benchmarks.liquidity'), pick: (m) => m.liquidity },
      {
        key: 'concentration',
        label: t('benchmarks.concentration'),
        pick: (m) => m.concentration,
        // The share alone is not the finding -- which class it sits in is.
        note: (m) =>
          m.concentrationClass
            ? assetLabel(
                m.concentrationClass,
                benchmarks.assetClasses.find((a) => a.key === m.concentrationClass)?.label ?? m.concentrationClass,
              )
            : null,
      },
    ].map((row) => ({
      ...row,
      values: Object.fromEntries(allGroups.map((g) => [g.key, byGroup[g.key]])),
    }))
  }, [allGroups, benchmarks, investableOnly, t, assetLabel])

  // Live mode fetches the full quarterly history; fallback mode uses the
  // annual samples embedded in the snapshot.
  useEffect(() => {
    let cancelled = false
    if (mode === 'fallback') {
      const embedded = benchmarks.trends?.[trendAsset]
      setTrend(
        embedded
          ? allGroups.map((g) => ({ key: g.key, label: g.label, points: embedded[g.key] })).filter((x) => x.points)
          : null,
      )
      return
    }
    Promise.all(allGroups.map((g) => api.trend({ group: g.key, assetClass: trendAsset })))
      .then((results) => {
        if (cancelled) return
        setTrend(allGroups.map((g, i) => ({ key: g.key, label: g.label, points: results[i].points })))
      })
      .catch(() => {
        if (!cancelled) setTrend(null)
      })
    return () => {
      cancelled = true
    }
  }, [trendAsset, mode, benchmarks, allGroups])

  // Nested tiers last, so the four partitioning tiers read left to right.
  const tableGroups = [...groups, ...nested]

  const countsHouseholds = allGroups.every((g) => g.household_count > 0)

  const trendLabel = assetLabel(
    trendAsset,
    benchmarks.assetClasses.find((a) => a.key === trendAsset)?.label ?? trendAsset,
  )

  // Two lines read clearly; four overlapping ones do not, so the trend
  // contrasts the ends of whichever axis is selected -- the top 1% against the
  // bottom 50% on net worth, the oldest cohort against the youngest on
  // generation. Taken from the published order rather than named keys, which
  // is what left every other axis with an empty chart.
  const extremes = useMemo(() => (groups.length ? [groups[0], groups[groups.length - 1]] : []), [groups])

  const trendSeries = useMemo(() => {
    if (!trend) return null
    const keys = extremes.map((g) => g.key)
    return trend.filter((s) => keys.includes(s.key)).map((s) => ({ ...s, label: tierLabel(s.key, s.label) }))
  }, [trend, extremes, tierLabel])

  return (
    <>
      <div className="controls">
        <DimensionPicker />
      </div>

      <div className="tiles">
        {groups.map((g) => (
          <div className="tile" key={g.key}>
            <div className="label">
              {tierLabel(g.key, g.label)}
              {g.percentile_range ? ` · ${percentileRange(g.key, g.percentile_range)}` : ''}
            </div>
            <div className="value">{fmt.usd(g.net_worth, { compact: true })}</div>
            <div className="note">{t('benchmarks.netWorth', { quarter: fmt.quarter(g.period) })}</div>
            {/* What it takes to be in this group at all, which is a different
                number from what the group holds -- and carries its own, older
                date, because the cutoffs are triennial. */}
            {g.threshold && (
              <div className="note">
                {/* Keyed by which cutoff it is: a net-worth floor and an income
                    floor are different facts, and this line sits directly under
                    a net-worth figure on both axes. */}
                {t(`placement.entryFrom.${g.threshold.field}`, {
                  amount: fmt.usd(g.threshold.value, { compact: true }),
                  quarter: fmt.quarter(g.threshold.period),
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <ThresholdPlacement />

      {nested.length > 0 && (
        <div className="tiles">
          {nested.map((g) => (
            <div className="tile" key={g.key} data-nested="true">
              <div className="label">
                {tierLabel(g.key, g.label)} · {percentileRange(g.key, g.percentile_range)}
              </div>
              <div className="value">{fmt.usd(g.net_worth, { compact: true })}</div>
              <div className="note">
                {t('benchmarks.nestedNote', {
                  tier: g.nested_in
                    ? tierLabel(g.nested_in, activeGroups[g.nested_in]?.label)
                    : t('benchmarks.tierAbove'),
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>{t('benchmarks.holdTitle')}</h2>
          {/* Only offered where the source publishes a household count to
              divide by; without one there is no per-household figure to show. */}
          {countsHouseholds && (
            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={perHousehold} onChange={(e) => setPerHousehold(e.target.checked)} />{' '}
              {t('benchmarks.perHousehold')}
            </label>
          )}
        </div>
        <p className="sub">
          {t('benchmarks.holdSub', {
            scope: investableOnly ? t('benchmarks.scopeInvestable') : t('benchmarks.scopeTotal'),
            quarter: fmt.quarter(periodMode === 'complete' ? benchmarks.completePeriod : benchmarks.latestPeriod),
          })}
        </p>
        {/* A mean over millions of households, and the spread inside a tier is
            the whole story of the tier above it -- so the figure is labelled an
            average rather than left to read as a typical household. */}
        {perHousehold && <p className="sub">{t('benchmarks.perHouseholdNote')}</p>}
        <div className="chart-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('benchmarks.assetClass')}</th>
                {tableGroups.map((g) => (
                  <th scope="col" className="num" key={g.key}>
                    {tierLabel(g.key, g.label)}
                    {g.nested && <span className="th-note">{t('benchmarks.subset')}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {tableGroups.map((g) => {
                    // A row hidden by the investable switch has no share; it
                    // still has a dollar figure, but showing one here would put
                    // a number in a column the reader has asked to exclude.
                    const share = row.values[g.key]
                    const value = perHousehold && share != null ? row.perHousehold[g.key] : share
                    return (
                      <td className={value == null ? 'num muted' : 'num'} key={g.key}>
                        {value == null ? '—' : perHousehold ? fmt.usd(value, { compact: true }) : fmt.pct(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('benchmarks.shapeTitle')}</h2>
        </div>
        <p className="sub">{t('benchmarks.shapeSub')}</p>
        <div className="chart-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('benchmarks.measure')}</th>
                {tableGroups.map((g) => (
                  <th scope="col" className="num" key={g.key}>
                    {tierLabel(g.key, g.label)}
                    {g.nested && <span className="th-note">{t('benchmarks.subset')}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {tableGroups.map((g) => {
                    const value = row.pick(row.values[g.key])
                    const note = row.note?.(row.values[g.key])
                    return (
                      <td className={value == null ? 'num muted' : 'num'} key={g.key}>
                        {value == null ? '—' : fmt.pct(value)}
                        {note && <span className="th-note">{note}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sub">{t('benchmarks.leverageNote')}</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('benchmarks.overTime', { asset: trendLabel })}</h2>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('benchmarks.assetClass')}{' '}
            <select value={trendAsset} onChange={(e) => setTrendAsset(e.target.value)}>
              {TREND_ASSETS.map((key) => (
                <option key={key} value={key}>
                  {assetLabel(key, benchmarks.assetClasses.find((a) => a.key === key)?.label ?? key)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="sub">
          {t('benchmarks.trendSub', {
            first: extremes[0] ? tierLabel(extremes[0].key, extremes[0].label) : '',
            last: extremes[1] ? tierLabel(extremes[1].key, extremes[1].label) : '',
          })}
        </p>
        {trendSeries ? (
          <TrendChart series={trendSeries} assetLabel={trendLabel} />
        ) : (
          <p className="empty">{t('benchmarks.trendUnavailable')}</p>
        )}
      </div>
    </>
  )
}
