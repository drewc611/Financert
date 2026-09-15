import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* Which cut of the population the whole dashboard benchmarks against.
 *
 * The axis list comes from the API response rather than a constant here, so
 * adding a seventh cut on the server needs no frontend change.
 *
 * Offline it renders disabled with a reason instead of disappearing. The
 * embedded snapshot carries net worth only -- shipping six axes of quarterly
 * history to every visitor would be a 3 MB download for a fallback -- and a
 * control that silently vanishes reads as a missing feature rather than an
 * unavailable one. */
export default function DimensionPicker() {
  const { benchmarks, dimension, setDimension } = useAppData()
  const { t, dimensionLabel } = useI18n()

  const available = benchmarks?.dimensions
  if (!available) {
    return (
      <label>
        {t('controls.dimension')}
        <select value="networth" disabled>
          <option value="networth">{dimensionLabel('networth', 'Net worth')}</option>
        </select>
        <span className="th-note">{t('controls.dimensionOffline')}</span>
      </label>
    )
  }

  return (
    <label>
      {t('controls.dimension')}
      <select value={dimension} onChange={(e) => setDimension(e.target.value)}>
        {available.map((d) => (
          <option key={d.key} value={d.key}>
            {dimensionLabel(d.key, d.label)}
          </option>
        ))}
      </select>
    </label>
  )
}
