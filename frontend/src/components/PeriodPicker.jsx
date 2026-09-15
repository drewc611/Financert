import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* Which quarter to benchmark against (BACKLOG F30).
 *
 * The dashboard held two quarters -- the newest, and the newest fully
 * published one -- which is all the comparison needs and none of what the
 * history is for. The Fed has published this every quarter since 1989, and
 * "what did the top 1% hold in 2009?" is a better question than anything the
 * current quarter can answer on its own.
 *
 * Offline it renders disabled with a reason: the embedded snapshot carries the
 * latest quarter only, and a control that silently vanishes reads as a missing
 * feature rather than an unavailable one.
 */
export default function PeriodPicker() {
  const { benchmarks, periodMode, setPeriodMode, mode } = useAppData()
  const { t, fmt } = useI18n()

  const periods = benchmarks?.periods ?? []
  const live = mode === 'live'

  return (
    <label>
      {t('controls.quarter')}
      <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value)} disabled={!live}>
        <option value="latest">{t('controls.mostRecent', { quarter: fmt.quarter(benchmarks.latestPeriod) })}</option>
        {/* Only worth offering when the two differ; with the bulk DFA source
            every quarter is complete, so they are usually the same date. */}
        {benchmarks.latestPeriod !== benchmarks.completePeriod && (
          <option value="complete">
            {t('controls.fullyPublished', { quarter: fmt.quarter(benchmarks.completePeriod) })}
          </option>
        )}
        {live &&
          [...periods]
            .reverse()
            .filter((p) => p !== benchmarks.latestPeriod)
            .map((period) => (
              <option key={period} value={period}>
                {fmt.quarter(period)}
              </option>
            ))}
      </select>
      {!live && <span className="th-note">{t('controls.historyOffline')}</span>}
    </label>
  )
}
