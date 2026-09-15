import { useId, useState } from 'react'
import { useI18n } from '../i18n'

/* A chart and the same numbers as a table, one switch between them
 * (BACKLOG F47).
 *
 * The SVGs carry role="img" and a label, which tells a screen reader what the
 * picture is and nothing about what it shows. This is the part that can be
 * read: every value, in the reading order of the chart.
 *
 * The table is also what a chart is for anyone who wants the number rather
 * than the shape -- which is most people, some of the time -- so the switch is
 * a plain control rather than an accessibility affordance tucked away.
 *
 * GapChart is the one chart without this: the Compare view already prints the
 * same rows as a table directly beneath it, and a second copy behind a toggle
 * would be two tables of one thing.
 */
export default function ChartFrame({ table, children }) {
  const [asTable, setAsTable] = useState(false)
  const { t } = useI18n()
  const id = useId()

  return (
    <>
      <div className="chart-actions">
        <button
          type="button"
          className="link-btn"
          aria-expanded={asTable}
          aria-controls={id}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? t('chart.showChart') : t('chart.showTable')}
        </button>
      </div>
      <div id={id}>{asTable ? <div className="chart-scroll">{table}</div> : children}</div>
    </>
  )
}
