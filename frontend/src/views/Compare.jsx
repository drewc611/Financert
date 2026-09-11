import { useMemo } from 'react'
import { useAppData } from '../context/AppDataContext'
import { analyse } from '../lib/analysis'
import AllocationChart from '../components/AllocationChart'
import GapChart from '../components/GapChart'
import { useI18n } from '../i18n'

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
  const { t, fmt, assetLabel, tierLabel } = useI18n()

  const labels = useMemo(
    () => Object.fromEntries(benchmarks.assetClasses.map((a) => [a.key, assetLabel(a.key, a.label)])),
    [benchmarks, assetLabel],
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

  const benchmarkLabel = tierLabel(groupKey, activeGroups[groupKey].label)

  const controls = (
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
  )

  if (!hasHoldings) {
    return (
      <>
        {controls}
        <div className="card">
          <h2>{t('compare.emptyTitle')}</h2>
          <p className="sub">{t('compare.emptyBody', { tier: benchmarkLabel })}</p>
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
  // analysis.js calls the group key `nearest`, and the English label
  // `nearest_label`; the key is what the translation is looked up by.
  const nearestLabel = tierLabel(nearest.nearest, nearest.nearest_label)

  return (
    <>
      {controls}

      <PendingNotice
        result={result}
        labels={labels}
        completePeriod={benchmarks.completePeriod}
        onUseComplete={() => setPeriodMode('complete')}
      />

      <div className="tiles">
        <div className="tile">
          <div className="label">{t('compare.portfolioCompared')}</div>
          <div className="value">{fmt.usd(result.portfolio_total, { compact: true })}</div>
          <div className="note">
            {result.excluded_value > 0
              ? t('compare.excluded', { amount: fmt.usd(result.excluded_value, { compact: true }) })
              : t('compare.acrossHoldings')}
          </div>
        </div>
        <div className="tile">
          <div className="label">{t('compare.closestTier')}</div>
          <div className="value">{nearest.confident ? nearestLabel : t('compare.noCloseMatch')}</div>
          <div className="note">
            {nearest.confident
              ? t('compare.similarityOf', { value: fmt.num(nearest.similarity) })
              : t('compare.bestWas', { tier: nearestLabel, value: fmt.num(nearest.similarity) })}
          </div>
        </div>
        <div className="tile">
          <div className="label">{t('compare.similarityTo', { tier: benchmarkLabel })}</div>
          <div className="value">{fmt.num(result.similarity)}</div>
          <div className="note">{t('compare.identicalMix')}</div>
        </div>
        <div className="tile">
          <div className="label">{t('compare.benchmarkPeriod')}</div>
          <div className="value">{fmt.quarter(result.period)}</div>
          <div className="note">{t('compare.source')}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('compare.allocationTitle', { tier: benchmarkLabel })}</h2>
        </div>
        <p className="sub">{t('compare.allocationSub')}</p>
        <AllocationChart rows={chartRows} benchmarkLabel={benchmarkLabel} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('compare.differTitle')}</h2>
        </div>
        <p className="sub">{t('compare.differSub', { tier: benchmarkLabel })}</p>
        <GapChart gaps={result.gaps} benchmarkLabel={benchmarkLabel} />

        <div className="chart-scroll">
          <table>
            <caption className="sr-only">{t('compare.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('compare.colAssetClass')}</th>
                <th scope="col" className="num">
                  {t('compare.colYou')}
                </th>
                <th scope="col" className="num">
                  {benchmarkLabel}
                </th>
                <th scope="col" className="num">
                  {t('compare.colDifference')}
                </th>
                <th scope="col">{t('compare.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {result.gaps.map((g) => (
                <tr key={g.asset_class}>
                  <td>{g.label}</td>
                  <td className="num">{fmt.pct(g.user_pct / 100)}</td>
                  <td className="num">{fmt.pct(g.benchmark_pct / 100)}</td>
                  <td className={g.status === 'pending' ? 'num muted' : 'num'}>
                    {g.status === 'pending' ? '—' : fmt.pp(g.gap_pp)}
                  </td>
                  <td>
                    <span className="pill" data-status={g.status}>
                      {t(`status.${g.status}`)}
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
  const { t, fmt, tierLabel, percentileRange } = useI18n()
  return (
    <div className="controls">
      <label>
        {t('controls.compareAgainst')}
        <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
          {Object.values(groups).map((g) => (
            <option key={g.key} value={g.key}>
              {tierLabel(g.key, g.label)} ({percentileRange(g.key, g.percentile_range)})
              {g.nested ? t('controls.insideTop1') : ''}
            </option>
          ))}
        </select>
      </label>
      {/* Only meaningful when the newest quarter is missing a class. With the
          bulk DFA source every quarter is complete, so the two options would
          be the same date and the control would be noise. */}
      {benchmarks.latestPeriod !== benchmarks.completePeriod && (
        <label>
          {t('controls.quarter')}
          <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="latest">
              {t('controls.mostRecent', { quarter: fmt.quarter(benchmarks.latestPeriod) })}
            </option>
            <option value="complete">
              {t('controls.fullyPublished', { quarter: fmt.quarter(benchmarks.completePeriod) })}
            </option>
          </select>
        </label>
      )}
      <label>
        <input type="checkbox" checked={investableOnly} onChange={(e) => setInvestableOnly(e.target.checked)} />
        {t('controls.investableOnly')}
      </label>
    </div>
  )
}

/** Shown when the selected quarter is missing a class the Fed publishes late.
 *  The other percentages are still correct -- the denominator is the Fed's own
 *  asset total, which already includes whatever has not been broken out. */
function PendingNotice({ result, labels, onUseComplete, completePeriod }) {
  const { t, fmt } = useI18n()
  if (result.period_complete) return null
  const missing = result.period_unavailable.map((k) => labels[k] || k).join(', ')
  return (
    <div className="notice" role="status">
      <strong>{t('compare.pendingTitle', { quarter: fmt.quarter(result.period) })}</strong>{' '}
      {t('compare.pendingBody', { classes: missing })}{' '}
      <button className="link-btn" onClick={onUseComplete}>
        {t('compare.usePeriodInstead', { quarter: fmt.quarter(completePeriod) })}
      </button>
    </div>
  )
}
