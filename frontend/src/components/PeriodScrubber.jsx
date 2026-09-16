import { useEffect, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* Drag the dashboard through 147 quarters (BACKLOG F46).
 *
 * The select beside it is the right control for "show me Q1 2009"; it is the
 * wrong one for moving *through* the history, which is a different act and the
 * one that makes the shape visible -- real estate swelling into 2006 and
 * draining out of it again.
 *
 * The value is committed on release rather than on every input event: each
 * quarter costs a request, and dragging across the range would fire a hundred
 * and forty of them. The label tracks the handle all the way, so the control
 * still answers immediately even though the page does not.
 */
export default function PeriodScrubber() {
  const { benchmarks, periodMode, setPeriodMode, mode } = useAppData()
  const { t, fmt } = useI18n()

  const periods = benchmarks?.periods ?? []
  const live = mode === 'live'
  const resolved = periodMode === 'latest' ? benchmarks.latestPeriod : periodMode === 'complete' ? benchmarks.completePeriod : periodMode
  const committed = Math.max(0, periods.indexOf(resolved))
  const [draft, setDraft] = useState(committed)

  // The picker, a shared link and the cohort buttons all move the period too;
  // the handle follows whatever the dashboard is actually showing.
  useEffect(() => setDraft(committed), [committed])

  if (!live || periods.length < 2) return null

  const commit = (index) => {
    const period = periods[index]
    // The newest quarter has its own mode -- "latest" keeps following the data
    // as it is refreshed, where the date pins it.
    setPeriodMode(index === periods.length - 1 ? 'latest' : period)
  }

  return (
    <div className="scrubber">
      <label htmlFor="period-scrubber">{t('controls.scrub')}</label>
      <input
        id="period-scrubber"
        type="range"
        min={0}
        max={periods.length - 1}
        value={draft}
        aria-valuetext={fmt.quarter(periods[draft])}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={(e) => commit(Number(e.currentTarget.value))}
        onKeyUp={(e) => commit(Number(e.currentTarget.value))}
        onBlur={(e) => commit(Number(e.currentTarget.value))}
      />
      <output htmlFor="period-scrubber">
        {fmt.quarter(periods[draft])}
        {draft !== committed && <span className="th-note">{t('controls.scrubRelease')}</span>}
      </output>
    </div>
  )
}
