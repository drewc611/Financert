import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import { benchmarkWeights } from '../lib/analysis'
import TrendChart from '../components/TrendChart'
import { pct, quarterLabel, usd } from '../lib/format'

const TREND_ASSETS = ['corporate_equities', 'private_business', 'real_estate']

export default function Benchmarks() {
  const { benchmarks, mode, investableOnly } = useAppData()
  const [trendAsset, setTrendAsset] = useState('corporate_equities')
  const [trend, setTrend] = useState(null)

  const groups = Object.values(benchmarks.groups)

  const rows = useMemo(() => {
    const weightsByGroup = Object.fromEntries(
      groups.map((g) => [g.key, benchmarkWeights(g, { investableOnly })]),
    )
    const keys = benchmarks.assetClasses
      .map((a) => a.key)
      .filter((k) => groups.some((g) => (weightsByGroup[g.key][k] ?? 0) > 0))
    return keys.map((key) => ({
      key,
      label: benchmarks.assetClasses.find((a) => a.key === key)?.label ?? key,
      values: Object.fromEntries(groups.map((g) => [g.key, weightsByGroup[g.key][key] ?? 0])),
    }))
  }, [groups, benchmarks, investableOnly])

  // Live mode fetches the full quarterly history; fallback mode uses the
  // annual samples embedded in the snapshot.
  useEffect(() => {
    let cancelled = false
    if (mode === 'fallback') {
      const embedded = benchmarks.trends?.[trendAsset]
      setTrend(
        embedded
          ? groups.map((g) => ({ key: g.key, label: g.label, points: embedded[g.key] }))
          : null,
      )
      return
    }
    Promise.all(groups.map((g) => api.trend({ group: g.key, assetClass: trendAsset })))
      .then((results) => {
        if (cancelled) return
        setTrend(groups.map((g, i) => ({ key: g.key, label: g.label, points: results[i].points })))
      })
      .catch(() => {
        if (!cancelled) setTrend(null)
      })
    return () => {
      cancelled = true
    }
  }, [trendAsset, mode, benchmarks, groups])

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

      <div className="card">
        <div className="card-head">
          <h2>How each tier holds its assets</h2>
        </div>
        <p className="sub">
          Share of {investableOnly ? 'investable' : 'total'} assets, {quarterLabel(benchmarks.latestPeriod)}.
          Columns sum to 100%.
        </p>
        <div className="chart-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Asset class</th>
                {groups.map((g) => (
                  <th scope="col" className="num" key={g.key}>
                    {g.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  {groups.map((g) => (
                    <td className="num" key={g.key}>
                      {pct(row.values[g.key])}
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
