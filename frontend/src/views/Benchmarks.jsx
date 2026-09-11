import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import { benchmarkWeights, UNALLOCATED } from '../lib/analysis'
import TrendChart from '../components/TrendChart'
import { useI18n } from '../i18n'

const TREND_ASSETS = ['corporate_equities', 'private_business', 'real_estate']

export default function Benchmarks() {
  const { benchmarks, activeGroups, periodMode, mode, investableOnly } = useAppData()
  const { t, fmt, assetLabel, tierLabel, percentileRange } = useI18n()
  const [trendAsset, setTrendAsset] = useState('corporate_equities')
  const [trend, setTrend] = useState(null)

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
      }
    })
  }, [allGroups, benchmarks, investableOnly, assetLabel, t])

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

  const trendLabel = assetLabel(
    trendAsset,
    benchmarks.assetClasses.find((a) => a.key === trendAsset)?.label ?? trendAsset,
  )

  // Two lines read clearly; four overlapping ones do not, so the trend
  // contrasts the extremes rather than plotting every tier.
  const trendSeries = useMemo(
    () =>
      trend
        ? trend
            .filter((s) => s.key === 'top1' || s.key === 'bottom50')
            .map((s) => ({ ...s, label: tierLabel(s.key, s.label) }))
        : null,
    [trend, tierLabel],
  )

  return (
    <>
      <div className="tiles">
        {groups.map((g) => (
          <div className="tile" key={g.key}>
            <div className="label">
              {tierLabel(g.key, g.label)} · {percentileRange(g.key, g.percentile_range)}
            </div>
            <div className="value">{fmt.usd(g.net_worth, { compact: true })}</div>
            <div className="note">{t('benchmarks.netWorth', { quarter: fmt.quarter(g.period) })}</div>
          </div>
        ))}
      </div>

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
        </div>
        <p className="sub">
          {t('benchmarks.holdSub', {
            scope: investableOnly ? t('benchmarks.scopeInvestable') : t('benchmarks.scopeTotal'),
            quarter: fmt.quarter(periodMode === 'complete' ? benchmarks.completePeriod : benchmarks.latestPeriod),
          })}
        </p>
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
                  {tableGroups.map((g) => (
                    <td className={row.values[g.key] == null ? 'num muted' : 'num'} key={g.key}>
                      {row.values[g.key] == null ? '—' : fmt.pct(row.values[g.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <p className="sub">{t('benchmarks.trendSub')}</p>
        {trendSeries ? (
          <TrendChart series={trendSeries} assetLabel={trendLabel} />
        ) : (
          <p className="empty">{t('benchmarks.trendUnavailable')}</p>
        )}
      </div>
    </>
  )
}
