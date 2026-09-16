import { useId, useRef, useState } from 'react'
import { chartToPng } from '../lib/png'
import { download } from '../lib/download'
import { useI18n } from '../i18n'

/* A chart, its key, and the same numbers as a table (BACKLOG F47, F54).
 *
 * The SVGs carry a label, which tells a screen reader what the picture is and
 * nothing about what it shows. The table is the part that can be read: every
 * value, in the reading order of the chart. It is also what a chart is for
 * anyone who wants the number rather than the shape -- which is most people,
 * some of the time -- so the switch is a plain control rather than an
 * accessibility affordance tucked away.
 *
 * The legend lives here rather than in each chart because the PNG export needs
 * it: a picture of two unlabelled series is not a chart, and the swatches
 * rendered here are also what the export reads its colours from, so nothing
 * has to resolve a CSS custom property by hand.
 *
 * GapChart passes no `table`: the Compare view already prints the same rows
 * directly beneath it, and a second copy behind a toggle would be two tables
 * of one thing. It keeps the rest.
 */
export default function ChartFrame({ table, legend = [], caption, filename = 'financert-chart', children }) {
  const [asTable, setAsTable] = useState(false)
  const [failed, setFailed] = useState(false)
  const { t } = useI18n()
  const id = useId()
  const holder = useRef(null)
  const swatches = useRef([])

  /* The picture, as a picture. Reads the SVG out of the DOM rather than
     re-rendering it, so what lands on disk is what is on screen -- the
     selected tier, the selected quarter, the theme in use. */
  async function savePng() {
    const svg = holder.current?.querySelector('svg.chart-svg')
    if (!svg) return
    setFailed(false)
    try {
      const surface = getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#ffffff'
      const ink = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#000000'
      // The name carries a tier label, which is translated: "Top 1%" and
      // "الأعلى 1%" are both filenames a file manager has to accept.
      const safe = filename.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'financert-chart'
      const blob = await chartToPng(svg, {
        background: surface,
        ink,
        caption,
        // Read off the rendered swatches, so the exported key is the same
        // colour as the one on screen in whichever theme is active.
        legend: legend.map((entry, i) => ({
          label: entry.label,
          dashed: entry.dashed,
          hatched: entry.hatched,
          color: swatches.current[i] ? getComputedStyle(swatches.current[i]).backgroundColor : '#888',
        })),
      })
      download(`${safe}.png`, blob, 'image/png')
    } catch {
      // Canvas rasterisation is the one step here that a browser can refuse.
      setFailed(true)
    }
  }

  return (
    <>
      {legend.length > 0 && (
        <div className="legend">
          {legend.map((entry, i) => (
            <span key={entry.key ?? entry.label}>
              <i
                className="swatch"
                data-hatch={entry.hatched ? '' : undefined}
                data-dash={entry.dashed ? '' : undefined}
                style={{ backgroundColor: entry.color }}
                ref={(node) => {
                  swatches.current[i] = node
                }}
              />{' '}
              {entry.label}
            </span>
          ))}
        </div>
      )}

      <div className="chart-actions">
        {failed && <span className="th-note">{t('chart.pngFailed')}</span>}
        {/* Hidden while the table is showing: it would save the chart the
            reader has just switched away from. */}
        {!asTable && (
          <button type="button" className="link-btn" onClick={savePng}>
            {t('chart.savePng')}
          </button>
        )}
        {table && (
          <button
            type="button"
            className="link-btn"
            aria-expanded={asTable}
            aria-controls={id}
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? t('chart.showChart') : t('chart.showTable')}
          </button>
        )}
      </div>
      <div id={id} ref={holder}>
        {asTable ? <div className="chart-scroll">{table}</div> : children}
      </div>
    </>
  )
}
