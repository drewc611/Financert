import { useMemo } from 'react'
import { useAppData } from '../context/AppDataContext'
import { analyse } from '../lib/analysis'
import AllocationChart from '../components/AllocationChart'
import GapChart from '../components/GapChart'
import { pct, pp, quarterLabel, usd, STATUS_LABEL } from '../lib/format'

export default function Compare() {
  const {
    benchmarks,
    activeGroups,
    periodMode,
    setPeriodMode,
    holdings,
    groupKey,
    setGroupKey,
    investableOnly,
    setInvestableOnly,
  } = useAppData()

  const labels = useMemo(
    () => Object.fromEntries(benchmarks.assetClasses.map((a) => [a.key, a.label])),
    [benchmarks],
  )

  const result = useMemo(
    () => analyse(holdings, { groups: activeGroups, groupKey, investableOnly, labels }),
    [holdings, activeGroups, groupKey, investableOnly, labels],
  )

  const hasHoldings = Object.keys(holdings).length > 0

  const chartRows = useMemo(() => {
    const keys = [...new Set([...Object.keys(result.user_weights), ...Object.keys(result.benchmark_weights)])]
    // The residual carries a different meaning in an incomplete quarter, and
    // analyse() has already worked out the right wording for it.
    const pending = result.gaps.find((g) => g.status === 'pending')
    return keys
      .map((key) => ({
        key,
        label: pending && key === pending.asset_class ? pending.label : labels[key] || key,
        user: result.user_weights[key] || 0,
        benchmark: result.benchmark_weights[key] || 0,
      }))
      .sort((a, b) => Math.max(b.user, b.benchmark) - Math.max(a.user, a.benchmark))
  }, [result, labels])

  const benchmarkLabel = activeGroups[groupKey].label

  if (!hasHoldings) {
    return (
      <>
        <TierControls
          groups={activeGroups}
          groupKey={groupKey}
          setGroupKey={setGroupKey}
          investableOnly={investableOnly}
          setInvestableOnly={setInvestableOnly}
          periodMode={periodMode}
          setPeriodMode={setPeriodMode}
          benchmarks={benchmarks}
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
        groups={activeGroups}
        groupKey={groupKey}
        setGroupKey={setGroupKey}
        investableOnly={investableOnly}
        setInvestableOnly={setInvestableOnly}
        periodMode={periodMode}
        setPeriodMode={setPeriodMode}
        benchmarks={benchmarks}
      />

      <PendingNotice
        result={result}
        labels={labels}
        completePeriod={benchmarks.completePeriod}
        onUseComplete={() => setPeriodMode('complete')}
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
                <td className={g.status === 'pending' ? 'num muted' : 'num'}>
                  {g.status === 'pending' ? '\u2014' : pp(g.gap_pp)}
                </td>
                <td>
                  <span className="pill" data-status={g.status}>
                    {STATUS_LABEL[g.status] || 'Not yet published'}
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

function TierControls({
  groups,
  groupKey,
  setGroupKey,
  investableOnly,
  setInvestableOnly,
  periodMode,
  setPeriodMode,
  benchmarks,
}) {
  return (
    <div className="controls">
      <label>
        Compare against
        <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
          {Object.values(groups).map((g) => (
            <option key={g.key} value={g.key}>
              {g.label} ({g.percentile_range})
              {g.nested ? ' \u2014 inside the top 1%' : ''}
            </option>
          ))}
        </select>
      </label>
      {/* Only meaningful when the newest quarter is missing a class. With the
          bulk DFA source every quarter is complete, so the two options would
          be the same date and the control would be noise. */}
      {benchmarks.latestPeriod !== benchmarks.completePeriod && (
        <label>
          Quarter
          <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="latest">{quarterLabel(benchmarks.latestPeriod)} (most recent)</option>
            <option value="complete">{quarterLabel(benchmarks.completePeriod)} (fully published)</option>
          </select>
        </label>
      )}
      <label>
        <input type="checkbox" checked={investableOnly} onChange={(e) => setInvestableOnly(e.target.checked)} />
        Investable assets only
      </label>
    </div>
  )
}

/** Shown when the selected quarter is missing a class the Fed publishes late.
 *  The other percentages are still correct -- the denominator is the Fed's own
 *  asset total, which already includes whatever has not been broken out. */
function PendingNotice({ result, labels, onUseComplete, completePeriod }) {
  if (result.period_complete) return null
  const missing = result.period_unavailable.map((k) => labels[k] || k).join(', ')
  return (
    <div className="notice" role="status">
      <strong>{quarterLabel(result.period)} is not fully published yet.</strong> The Federal Reserve
      releases {missing} later than the rest of the balance sheet, so it appears as
      &ldquo;not yet published&rdquo; below rather than as a number. Every other share is still
      correct.{' '}
      <button className="link-btn" onClick={onUseComplete}>
        Use {quarterLabel(completePeriod)} instead
      </button>
    </div>
  )
}
