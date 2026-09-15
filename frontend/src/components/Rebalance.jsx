import { useMemo } from 'react'
import { rebalanceMoves, sensitivity } from '../lib/analysis'
import { useI18n } from '../i18n'

/* What it would take to hold a tier's mix (BACKLOG F36), and which single
 * change would move you furthest (F40).
 *
 * Descriptive, like the rest of the product: these are the arithmetic of the
 * gap table above, not a recommendation to make any of them. The disclaimer
 * in the footer is the one that governs, and this card does not repeat it as
 * advice by another name -- it says "to match", never "you should".
 */
export default function Rebalance({ result, labels }) {
  const { t, fmt, assetLabel } = useI18n()

  const { moves, distance } = useMemo(
    () => rebalanceMoves(result.gaps, result.portfolio_total),
    [result],
  )
  const best = useMemo(
    () => sensitivity(result.user_weights, result.benchmark_weights).slice(0, 3),
    [result],
  )

  if (!moves.length) return null

  const name = (key) => assetLabel(key, labels[key] || key)

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('rebalance.title')}</h2>
        <strong>{fmt.usd(distance, { compact: true })}</strong>
      </div>
      <p className="sub">
        {t('rebalance.sub', {
          share: fmt.pct(distance / result.portfolio_total),
          count: moves.length,
        })}
      </p>
      <ul className="moves">
        {moves.map((m) => (
          <li key={`${m.from.key}-${m.to.key}`}>
            {t('rebalance.move', {
              amount: fmt.usd(m.amount, { compact: true }),
              from: name(m.from.key),
              to: name(m.to.key),
            })}
          </li>
        ))}
      </ul>
      {best.length > 0 && (
        <p className="sub">
          {t('rebalance.biggest', {
            asset: name(best[0].asset_class),
            gain: fmt.num(best[0].gain),
          })}
        </p>
      )}
    </div>
  )
}
