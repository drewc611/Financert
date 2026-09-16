import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import { benchmarkWeights, debtWeights, portfolioWeights, shapeMetrics, UNALLOCATED } from '../lib/analysis'
import TrendChart from '../components/TrendChart'
import DimensionPicker from '../components/DimensionPicker'
import ThresholdPlacement from '../components/ThresholdPlacement'
import PeriodPicker from '../components/PeriodPicker'
import Movers from '../components/Movers'
import CompositionChart from '../components/CompositionChart'
import ShapeScatter from '../components/ShapeScatter'
import TierComposition from '../components/TierComposition'
import SourceNote from '../components/SourceNote'
import { useI18n } from '../i18n'

const TREND_ASSETS = ['corporate_equities', 'private_business', 'real_estate']

export default function Benchmarks() {
  const { benchmarks, activeGroups, periodMode, mode, holdings, investableOnly, setInvestableOnly } = useAppData()
  const { t, fmt, assetLabel, assetBlurb, debtLabel, debtBlurb, tierLabel, percentileRange } = useI18n()
  const [trendAsset, setTrendAsset] = useState('corporate_equities')
  // { state: 'loading' | 'ready' | 'empty' | 'failed', series }
  const [trend, setTrend] = useState(null)
  // Bumped by the retry button; the fetch reads it only to depend on it.
  const [reloadTrend, setReloadTrend] = useState(0)
  /* One group's whole mix over time (BACKLOG F42), for whichever group the
     card's own picker is on. Live-only: the embedded snapshot carries annual
     samples of three classes, which is a trend, not a composition. */
  const [compositionOf, setCompositionOf] = useState(null)
  const [composition, setComposition] = useState({ state: 'loading', points: [] })
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
      const spec = benchmarks.assetClasses.find((a) => a.key === key)
      const english = spec?.label ?? key
      return {
        key,
        // The DFA columns this bucket sums, for the provenance note (F56).
        columns: spec?.columns ?? [],
        blurb: spec?.blurb ?? '',
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

  /* The other side of the balance sheet (BACKLOG F26). Shares of what each
     tier owes, not of what it holds -- the two have nothing in common but the
     household, and mixing them into one table would invite exactly that
     reading. Same per-household treatment as the asset rows. */
  const debtRows = useMemo(() => {
    const byGroup = Object.fromEntries(allGroups.map((g) => [g.key, debtWeights(g)]))
    return (benchmarks.liabilityClasses ?? [])
      .filter((c) => allGroups.some((g) => (byGroup[g.key][c.key] ?? 0) > 0))
      .map((c) => ({
        key: c.key,
        label: debtLabel(c.key, c.label),
        columns: c.columns ?? [],
        blurb: c.blurb ?? '',
        values: Object.fromEntries(allGroups.map((g) => [g.key, byGroup[g.key][c.key] ?? null])),
        perHousehold: Object.fromEntries(
          allGroups.map((g) => [
            g.key,
            g.household_count > 0
              ? ((byGroup[g.key][c.key] ?? 0) * g.total_liabilities) / g.household_count
              : null,
          ]),
        ),
      }))
  }, [allGroups, benchmarks, debtLabel])

  // Three single-number descriptions of each tier's balance sheet. Computed
  // here rather than read off the API response so they are identical in
  // offline mode, the same reason benchmarkWeights above is a client-side
  // mirror -- see lib/analysis.shapeMetrics.
  const liquidKeys = useMemo(
    () => new Set(benchmarks.assetClasses.filter((a) => a.liquid).map((a) => a.key)),
    [benchmarks],
  )

  const metricRows = useMemo(() => {
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
  }, [allGroups, benchmarks, investableOnly, liquidKeys, t, assetLabel])

  /* Every group's mix side by side, in band order (BACKLOG F43). The table
     above is the better tool for reading any one number; this is for the
     shape, which eleven rows of arithmetic do not show. */
  const multiples = useMemo(
    () =>
      groups.map((g) => ({
        key: g.key,
        label: g.label,
        weights: benchmarkWeights(g, { investableOnly }),
      })),
    [groups, investableOnly],
  )

  /* The two shape numbers as a position rather than two columns (BACKLOG
     F44), with the reader's own mix among them when they have entered one --
     which is what makes it a chart about them rather than about strangers. */
  const scatterPoints = useMemo(() => {
    const label = (key) =>
      assetLabel(key, benchmarks.assetClasses.find((a) => a.key === key)?.label ?? key)
    const points = allGroups.map((g) => {
      const metrics = shapeMetrics(g, benchmarkWeights(g, { investableOnly }), liquidKeys)
      return {
        key: g.key,
        label: tierLabel(g.key, g.label),
        liquidity: metrics.liquidity,
        concentration: metrics.concentration,
        largest: metrics.concentrationClass ? label(metrics.concentrationClass) : '—',
      }
    })
    const mine = portfolioWeights(holdings)
    if (Object.keys(mine).length) {
      const metrics = shapeMetrics({ total_assets: 0, total_liabilities: 0 }, mine, liquidKeys)
      points.push({
        key: 'you',
        you: true,
        label: t('chart.you'),
        liquidity: metrics.liquidity,
        concentration: metrics.concentration,
        largest: metrics.concentrationClass ? label(metrics.concentrationClass) : '—',
      })
    }
    return points.filter((p) => p.liquidity != null && p.concentration != null)
  }, [allGroups, benchmarks, holdings, investableOnly, liquidKeys, assetLabel, tierLabel, t])

  /* Live mode fetches the full quarterly history; fallback mode uses the
     annual samples embedded in the snapshot.

     Three outcomes, kept apart (BACKLOG F50): still fetching, the request
     failed, and the source has nothing for this asset class. They used to
     render as one sentence -- "trend data unavailable" -- which told a reader
     nothing about whether waiting or retrying was the answer. */
  useEffect(() => {
    let cancelled = false
    if (mode === 'fallback') {
      const embedded = benchmarks.trends?.[trendAsset]
      const series = embedded
        ? allGroups.map((g) => ({ key: g.key, label: g.label, points: embedded[g.key] })).filter((x) => x.points)
        : []
      setTrend({ state: series.length ? 'ready' : 'empty', series })
      return
    }
    // Cleared rather than left up: the heading above the chart names the asset
    // class being fetched, and the previous one's line under that heading
    // would be a wrong answer rather than a stale one.
    setTrend({ state: 'loading', series: [] })
    Promise.all(allGroups.map((g) => api.trend({ group: g.key, assetClass: trendAsset })))
      .then((results) => {
        if (cancelled) return
        const series = allGroups.map((g, i) => ({ key: g.key, label: g.label, points: results[i].points }))
        setTrend({ state: series.some((s) => s.points.length) ? 'ready' : 'empty', series })
      })
      .catch(() => {
        if (!cancelled) setTrend({ state: 'failed', series: [] })
      })
    return () => {
      cancelled = true
    }
  }, [trendAsset, mode, benchmarks, allGroups, reloadTrend])

  const compositionGroup = compositionOf && activeGroups[compositionOf] ? compositionOf : groups[0]?.key

  useEffect(() => {
    if (mode !== 'live' || !compositionGroup) {
      setComposition({ state: mode === 'live' ? 'loading' : 'offline', points: [] })
      return
    }
    let cancelled = false
    setComposition({ state: 'loading', points: [] })
    api
      .composition({ group: compositionGroup, investableOnly })
      .then((data) => !cancelled && setComposition({ state: 'ready', points: data.points }))
      .catch(() => !cancelled && setComposition({ state: 'failed', points: [] }))
    return () => {
      cancelled = true
    }
  }, [compositionGroup, investableOnly, mode])

  // Nested tiers last, so the four partitioning tiers read left to right.
  const tableGroups = [...groups, ...nested]

  const countsHouseholds = allGroups.every((g) => g.household_count > 0)

  const labelFor = useCallback(
    (key) => assetLabel(key, benchmarks.assetClasses.find((a) => a.key === key)?.label ?? key),
    [assetLabel, benchmarks],
  )

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
    if (!trend) return []
    const keys = extremes.map((g) => g.key)
    return trend.series.filter((s) => keys.includes(s.key)).map((s) => ({ ...s, label: tierLabel(s.key, s.label) }))
  }, [trend, extremes, tierLabel])

  return (
    <>
      <div className="controls">
        <DimensionPicker />
        <PeriodPicker />
        {/* The table says "share of investable assets" and, until now, gave no
            way to see the other view -- the switch lived only on the Compare
            tab, which also made the unallocated residual unreachable here. */}
        <label>
          <input type="checkbox" checked={investableOnly} onChange={(e) => setInvestableOnly(e.target.checked)} />
          {t('controls.investableOnly')}
        </label>
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
        {/* The residual has a row in the table and, until now, an explanation
            only in the README (BACKLOG F60). It is a rounding artefact today,
            and saying so is the difference between a reader trusting the
            percentages and wondering what is missing from them. */}
        {rows.some((r) => r.key === UNALLOCATED) && <p className="sub">{t('benchmarks.unallocatedNote')}</p>}
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
                  <td>
                    {row.label}
                    <SourceNote label={row.label} columns={row.columns} blurb={assetBlurb(row.key, row.blurb)} />
                  </td>
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

      {debtRows.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>{t('benchmarks.owesTitle')}</h2>
          </div>
          <p className="sub">{t('benchmarks.owesSub')}</p>
          <div className="chart-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('benchmarks.debtKind')}</th>
                  {tableGroups.map((g) => (
                    <th scope="col" className="num" key={g.key}>
                      {tierLabel(g.key, g.label)}
                      {g.nested && <span className="th-note">{t('benchmarks.subset')}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debtRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.label}
                      <SourceNote label={row.label} columns={row.columns} blurb={debtBlurb(row.key, row.blurb)} />
                    </td>
                    {tableGroups.map((g) => {
                      const value = perHousehold ? row.perHousehold[g.key] : row.values[g.key]
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
      )}

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
          <h2>{t('benchmarks.multiplesTitle')}</h2>
        </div>
        <p className="sub">{t('benchmarks.multiplesSub')}</p>
        <TierComposition groups={multiples} labelFor={labelFor} tierLabel={tierLabel} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('benchmarks.scatterTitle')}</h2>
        </div>
        <p className="sub">{t('benchmarks.scatterSub')}</p>
        <ShapeScatter points={scatterPoints} youLabel={t('chart.you')} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('benchmarks.compositionTitle')}</h2>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <select value={compositionGroup ?? ''} onChange={(e) => setCompositionOf(e.target.value)}>
              {Object.values(activeGroups).map((g) => (
                <option key={g.key} value={g.key}>
                  {tierLabel(g.key, g.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="sub">{t('benchmarks.compositionSub')}</p>
        {composition.state === 'ready' && (
          <CompositionChart
            points={composition.points}
            label={tierLabel(compositionGroup, activeGroups[compositionGroup]?.label)}
            labelFor={labelFor}
          />
        )}
        {composition.state === 'loading' && <p className="empty">{t('app.loading')}</p>}
        {composition.state === 'offline' && <p className="empty">{t('benchmarks.compositionNeedsApi')}</p>}
        {composition.state === 'failed' && (
          <p className="empty">
            {t('benchmarks.compositionFailed')}{' '}
            <button type="button" className="link-btn" onClick={() => setCompositionOf(compositionGroup)}>
              {t('benchmarks.retry')}
            </button>
          </p>
        )}
      </div>

      <Movers />

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
        {trendSeries.length > 0 && <TrendChart series={trendSeries} assetLabel={trendLabel} />}
        {trend?.state === 'loading' && <p className="empty">{t('app.loading')}</p>}
        {trend?.state === 'empty' && <p className="empty">{t('benchmarks.trendEmpty', { asset: trendLabel })}</p>}
        {trend?.state === 'failed' && (
          <p className="empty">
            {t('benchmarks.trendFailed')}{' '}
            <button type="button" className="link-btn" onClick={() => setReloadTrend((n) => n + 1)}>
              {t('benchmarks.retry')}
            </button>
          </p>
        )}
      </div>
    </>
  )
}
