import { useMemo, useState } from 'react'
import AllocationChart from './AllocationChart'
import { useAppData } from '../context/AppDataContext'
import { cosineSimilarity, portfolioWeights } from '../lib/analysis'
import { useI18n } from '../i18n'

const MINE = '__mine__'

/* Two portfolios side by side (BACKLOG F39).
 *
 * The rest of the dashboard compares one mix against a tier. This compares two
 * of the reader's own -- what they hold against what they were thinking of
 * holding -- and against the tier as a third reading, because "which of these
 * is closer to the top 1%" is the question a scenario is usually asked for.
 *
 * It reuses the allocation chart rather than inventing a fourth chart shape:
 * two series, paired bars, exactly what that chart is.
 */
export default function ScenarioCompare({ benchmarkWeights: tierWeights, benchmarkLabel }) {
  const { savedHoldings, scenario, scenarios } = useAppData()
  const { t, fmt, assetLabel } = useI18n()
  const [leftKey, setLeftKey] = useState(MINE)
  const [rightKey, setRightKey] = useState('')

  /* Everything comparable: the saved portfolio, the draft if one is open, and
     every scenario kept in this browser. */
  const options = useMemo(() => {
    const list = [{ key: MINE, label: t('scenario.myPortfolio'), holdings: savedHoldings }]
    if (scenario) list.push({ key: '__draft__', label: scenario.name || t('scenario.unsavedShort'), holdings: scenario.holdings })
    for (const s of scenarios) list.push({ key: `s:${s.name}`, label: s.name, holdings: s.holdings })
    return list.filter((option) => Object.keys(option.holdings ?? {}).length > 0)
  }, [savedHoldings, scenario, scenarios, t])

  // Nothing to compare *with* until there is a second thing.
  if (options.length < 2) return null

  const left = options.find((o) => o.key === leftKey) ?? options[0]
  const right = options.find((o) => o.key === rightKey) ?? options.find((o) => o.key !== left.key)

  const leftWeights = portfolioWeights(left.holdings)
  const rightWeights = portfolioWeights(right.holdings)
  const keys = [...new Set([...Object.keys(leftWeights), ...Object.keys(rightWeights)])]
  const rows = keys
    .map((key) => ({
      key,
      label: assetLabel(key, key),
      user: leftWeights[key] ?? 0,
      benchmark: rightWeights[key] ?? 0,
    }))
    .sort((a, b) => Math.max(b.user, b.benchmark) - Math.max(a.user, a.benchmark))

  const closeness = (weights) => cosineSimilarity(weights, tierWeights)

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('scenario.compareTitle')}</h2>
      </div>
      <p className="sub">{t('scenario.compareSub', { tier: benchmarkLabel })}</p>

      <div className="controls">
        <label>
          {t('scenario.left')}
          <select value={left.key} onChange={(e) => setLeftKey(e.target.value)}>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('scenario.right')}
          <select value={right.key} onChange={(e) => setRightKey(e.target.value)}>
            {options
              .filter((option) => option.key !== left.key)
              .map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="tiles">
        {[left, right].map((side, i) => {
          const weights = i === 0 ? leftWeights : rightWeights
          const total = Object.values(side.holdings).reduce((a, b) => a + b, 0)
          return (
            <div className="tile" key={side.key}>
              <div className="label">{side.label}</div>
              <div className="value">{fmt.num(closeness(weights))}</div>
              <div className="note">
                {t('scenario.similarityNote', { tier: benchmarkLabel, amount: fmt.usd(total, { compact: true }) })}
              </div>
            </div>
          )
        })}
      </div>

      <AllocationChart rows={rows} benchmarkLabel={right.label} userLabel={left.label} />
    </div>
  )
}
