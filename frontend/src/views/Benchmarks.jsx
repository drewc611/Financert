import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import { benchmarkWeights, PENDING_LABEL, UNALLOCATED } from '../lib/analysis'
import TrendChart from '../components/TrendChart'
import { pct, quarterLabel, usd } from '../lib/format'

const TREND_ASSETS = ['corporate_equities', 'private_business', 'real_estate']

export default function Benchmarks() {
  const { benchmarks, activeGroups, periodMode, mode, investableOnly } = useAppData()
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
      .map((k) => benchmarks.assetClasses.find((a) => a.key === k)?.label ?? k)
      .join(', ')

    return keys.map((key) => ({
      key,
      label:
        key === UNALLOCATED && missing
          ? `${PENDING_LABEL} (${missing})`
          : (benchmarks.assetClasses.find((a) => a.key === key)?.label ?? key),
      values: Object.fromEntries(
        allGroups.map((g) => [g.key, weightsByGroup[g.key][key] ?? null]),
      ),
    }))
  }, [allGroups, benchmarks, investableOnly])

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

  const trendLabel = benchmarks.assetClasses.find((a) => a.key === trendAsset)?.label ?? trendAsset

  // Two lines read clearly; four overlapping ones do not, so the trend
  // contrasts the extremes rather than plotting every tier.
  const trendSeries = useMemo(
    () => (trend ? trend.filter((s) => s.key === 'top1' || s.key === 'bottom50') : null),
    [trend],
  )

  return (
    <>
      <div className="tiles">
        {groups.map((g) => (
          <div className="tile" key={g.key}>
            <div className="label">
              {g.label} · {g.percentile_range}
            </div>
            <div className="value">{usd(g.net_worth, { compact: true })}</div>
            <div className="note">net worth, {quarterLabel(g.period)}</div>
          </div>
        ))}
      </div>

      {nested.length > 0 && (
        <div className="tiles">
          {nested.map((g) => (
            <div className="tile" key={g.key} data-nested="true">
              <div className="label">
                {g.label} · {g.percentile_range}
              </div>
              <div className="value">{usd(g.net_worth, { compact: true })}</div>
              <div className="note">
                net worth — counted inside the {activeGroups[g.nested_in]?.label ?? 'tier above'}, not
                alongside it
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>How each tier holds its assets</h2>
        </div>
        <p className="sub">
          Share of {investableOnly ? 'investable' : 'total'} assets,{' '}
          {quarterLabel(periodMode === 'complete' ? benchmarks.completePeriod : benchmarks.latestPeriod)}.
          Each column sums to 100%. The top 0.1% is a subset of the top 1%, not a fifth group.
        </p>
        <div className="chart-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Asset class</th>
                {tableGroups.map((g) => (
                  <th scope="col" className="num" key={g.key}>
                    {g.label}
                    {g.nested && <span className="th-note">subset</span>}
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
                      {row.values[g.key] == null ? '—' : pct(row.values[g.key])}
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
          <h2>{trendLabel} over time</h2>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Asset class{' '}
            <select value={trendAsset} onChange={(e) => setTrendAsset(e.target.value)}>
              {TREND_ASSETS.map((key) => (
                <option key={key} value={key}>
                  {benchmarks.assetClasses.find((a) => a.key === key)?.label ?? key}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="sub">
          Share of each tier&apos;s total assets, since 1989. Top 1% and bottom 50% shown; the middle tiers sit
          between them.
        </p>
        {trendSeries ? (
          <TrendChart series={trendSeries} assetLabel={trendLabel} />
        ) : (
          <p className="empty">Trend data unavailable.</p>
        )}
      </div>
    </>
  )
}
