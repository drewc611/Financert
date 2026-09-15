import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* Which cut of the population the whole dashboard benchmarks against.
 *
 * The axis list comes from the API response rather than a constant here, so
 * adding a seventh cut on the server needs no frontend change.
 *
 * Each axis carries a one-line definition of the cut (BACKLOG F22). Six ways
 * of slicing the same households look interchangeable in a dropdown and are
 * not: "Top 1%" is a position in a distribution, "Baby Boom" is a birth
 * cohort, and the difference is exactly what a reader has to hold on to when
 * the numbers move. The line says what the group is and whose definition it
 * is, and nothing about why the groups differ -- the footer says that the data
 * does not answer that, and no axis gets to imply otherwise.
 *
 * Offline it renders disabled with a reason instead of disappearing. The
 * embedded snapshot carries net worth only -- shipping six axes of quarterly
 * history to every visitor would be a 3 MB download for a fallback -- and a
 * control that silently vanishes reads as a missing feature rather than an
 * unavailable one. */
export default function DimensionPicker() {
  const { benchmarks, dimension, setDimension } = useAppData()
  const { t, dimensionLabel, dimensionNote } = useI18n()

  const available = benchmarks?.dimensions

  return (
    <div className="axis-picker">
      <label>
        {t('controls.dimension')}
        {available ? (
          <select value={dimension} onChange={(e) => setDimension(e.target.value)}>
            {available.map((d) => (
              <option key={d.key} value={d.key}>
                {dimensionLabel(d.key, d.label)}
              </option>
            ))}
          </select>
        ) : (
          <select value="networth" disabled>
            <option value="networth">{dimensionLabel('networth', 'Net worth')}</option>
          </select>
        )}
        {!available && <span className="th-note">{t('controls.dimensionOffline')}</span>}
      </label>
      <p className="axis-note">{dimensionNote(available ? dimension : 'networth')}</p>
    </div>
  )
}
