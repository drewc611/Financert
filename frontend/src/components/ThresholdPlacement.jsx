import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { placeByThreshold } from '../lib/analysis'
import { useI18n } from '../i18n'

/* "What net worth puts you in the top 1%?" (BACKLOG F28)
 *
 * A different question from the rest of the dashboard, which compares the
 * *shape* of a balance sheet: someone can hold exactly the top 1%'s mix with a
 * thousandth of their money. This one is a threshold, and the Fed publishes it.
 *
 * The figure is typed here rather than taken from the portfolio on purpose.
 * Holdings are assets; these are net worth cutoffs, and quietly treating one as
 * the other would overstate anyone carrying a mortgage by the size of it.
 *
 * It is never stored or sent -- it lives in this component's state for as long
 * as the tab is open, which is all it needs.
 */
export default function ThresholdPlacement() {
  const { activeGroups, dimension } = useAppData()
  const { t, fmt, tierLabel } = useI18n()
  const [raw, setRaw] = useState('')

  const hasThresholds = useMemo(
    () => Object.values(activeGroups).some((g) => g.threshold),
    [activeGroups],
  )

  const value = Number(raw)
  const placement = useMemo(
    () => (hasThresholds && value > 0 ? placeByThreshold(activeGroups, value) : null),
    [activeGroups, value, hasThresholds],
  )

  // Generation, education, race and age have no cutoff to place against; the
  // control would be a question with no answer.
  if (!hasThresholds) return null

  const lowest = Object.values(activeGroups)
    .filter((g) => g.threshold)
    .sort((a, b) => a.threshold.value - b.threshold.value)[0]

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t(`placement.title.${dimension}`)}</h2>
      </div>
      <p className="sub">{t(`placement.sub.${dimension}`)}</p>
      <div className="controls">
        <label>
          {t(`placement.field.${dimension}`)}
          <input
            type="number"
            min="0"
            step="1000"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      {placement && (
        <p className="placement-answer">
          {placement.group ? (
            <>
              <strong>
                {t('placement.lands', { tier: tierLabel(placement.group.key, placement.group.label) })}
              </strong>{' '}
              {t('placement.floor', {
                amount: fmt.usd(placement.group.threshold.value, { compact: true }),
                quarter: fmt.quarter(placement.group.threshold.period),
              })}
            </>
          ) : (
            <strong>
              {t('placement.belowAll', {
                tier: tierLabel(lowest.key, lowest.label),
                amount: fmt.usd(lowest.threshold.value, { compact: true }),
              })}
            </strong>
          )}
          {/* Skipped below the lowest threshold: "belowAll" has just named
              that band and its floor, and repeating both reads as two
              different facts. */}
          {placement.group && placement.next && (
            <>
              {' '}
              {t('placement.toNext', {
                amount: fmt.usd(placement.toNext, { compact: true }),
                tier: tierLabel(placement.next.key, placement.next.label),
              })}
            </>
          )}
        </p>
      )}

      {/* The cutoffs come from the triennial Survey of Consumer Finances, so
          the newest one is years older than the allocations above it. Saying
          when it was measured is the whole difference between a fact and a
          number. */}
      <p className="sub">{t('placement.measured', { quarter: fmt.quarter(lowest.threshold.period) })}</p>
    </div>
  )
}
