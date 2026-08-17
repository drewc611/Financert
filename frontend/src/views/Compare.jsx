import { useMemo } from 'react'
import { useAppData } from '../context/AppDataContext'
import { analyse } from '../lib/analysis'
import AllocationChart from '../components/AllocationChart'
import GapChart from '../components/GapChart'
import { pct, pp, quarterLabel, usd, STATUS_LABEL } from '../lib/format'

export default function Compare() {
  const { benchmarks, holdings, groupKey, setGroupKey, investableOnly, setInvestableOnly } = useAppData()

  const labels = useMemo(
    () => Object.fromEntries(benchmarks.assetClasses.map((a) => [a.key, a.label])),
    [benchmarks],
  )

  const result = useMemo(
    () => analyse(holdings, { groups: benchmarks.groups, groupKey, investableOnly, labels }),
    [holdings, benchmarks, groupKey, investableOnly, labels],
  )

  const hasHoldings = Object.keys(holdings).length > 0

  const chartRows = useMemo(() => {
    const keys = [...new Set([...Object.keys(result.user_weights), ...Object.keys(result.benchmark_weights)])]
    return keys
      .map((key) => ({
        key,
        label: labels[key] || key,
        user: result.user_weights[key] || 0,
        benchmark: result.benchmark_weights[key] || 0,
      }))
      .sort((a, b) => Math.max(b.user, b.benchmark) - Math.max(a.user, a.benchmark))
  }, [result, labels])

  const benchmarkLabel = benchmarks.groups[groupKey].label

  if (!hasHoldings) {
    return (
      <>
        <TierControls
          groups={benchmarks.groups}
          groupKey={groupKey}
          setGroupKey={setGroupKey}
          investableOnly={investableOnly}
          setInvestableOnly={setInvestableOnly}
        />
        <div className="card">
          <h2>Nothing to compare yet</h2>
          <p className="sub">
            Add what you hold on the <strong>Your portfolio</strong> tab and this page will show how your mix
            compares with {benchmarkLabel}.
          </p>
          <AllocationChart
            rows={Object.entries(result.benchmark_weights)
              .map(([key, v]) => ({ key, label: labels[key] || key, user: 0, benchmark: v }))
              .sort((a, b) => b.benchmark - a.benchmark)}
            benchmarkLabel={benchmarkLabel}
          />
        </div>
      </>
    )
  }

  const nearest = result.nearest_tier

  return (
    <>
      <TierControls
        groups={benchmarks.groups}
        groupKey={groupKey}
        setGroupKey={setGroupKey}
        investableOnly={investableOnly}
        setInvestableOnly={setInvestableOnly}
      />

      <div className="tiles">
        <div className="tile">
          <div className="label">Portfolio compared</div>
          <div className="value">{usd(result.portfolio_total, { compact: true })}</div>
          <div className="note">
            {result.excluded_value > 0
              ? `${usd(result.excluded_value, { compact: true })} excluded as non-investable`
              : 'across all entered holdings'}
          </div>
        </div>
        <div className="tile">
          <div className="label">Closest tier</div>
          <div className="value">{nearest.confident ? nearest.nearest_label : 'No close match'}</div>
          <div className="note">
            {nearest.confident
              ? `similarity ${nearest.similarity.toFixed(2)} of 1.00`
              : `best was ${nearest.nearest_label} at ${nearest.similarity.toFixed(2)}`}
          </div>
        </div>
        <div className="tile">
          <div className="label">Similarity to {benchmarkLabel}</div>
          <div className="value">{result.similarity.toFixed(2)}</div>
          <div className="note">1.00 would be an identical mix</div>
        </div>
        <div className="tile">
          <div className="label">Benchmark period</div>
          <div className="value">{quarterLabel(result.period)}</div>
          <div className="note">Federal Reserve DFA</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Your allocation vs {benchmarkLabel}</h2>
        </div>
        <p className="sub">Each asset class as a share of the portfolio being compared.</p>
        <AllocationChart rows={chartRows} benchmarkLabel={benchmarkLabel} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Where you differ</h2>
        </div>
        <p className="sub">
          Percentage points above or below {benchmarkLabel}. Differences under 1.5pp are treated as in line —
          the underlying survey data is not precise enough to read more finely.
        </p>
        <GapChart gaps={result.gaps} benchmarkLabel={benchmarkLabel} />

        <div className="chart-scroll">
        <table>
          <caption className="sr-only">Allocation differences by asset class</caption>
          <thead>
            <tr>
              <th scope="col">Asset class</th>
              <th scope="col" className="num">You</th>
              <th scope="col" className="num">{benchmarkLabel}</th>
              <th scope="col" className="num">Difference</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.gaps.map((g) => (
              <tr key={g.asset_class}>
                <td>{g.label}</td>
                <td className="num">{pct(g.user_pct / 100)}</td>
                <td className="num">{pct(g.benchmark_pct / 100)}</td>
                <td className="num">{pp(g.gap_pp)}</td>
                <td>
                  <span className="pill" data-status={g.status}>
                    {STATUS_LABEL[g.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  )
}

function TierControls({ groups, groupKey, setGroupKey, investableOnly, setInvestableOnly }) {
  return (
    <div className="controls">
      <label>
        Compare against
        <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
          {Object.values(groups).map((g) => (
            <option key={g.key} value={g.key}>
              {g.label} ({g.percentile_range})
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={investableOnly} onChange={(e) => setInvestableOnly(e.target.checked)} />
        Investable assets only
      </label>
    </div>
  )
}
