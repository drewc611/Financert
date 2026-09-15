import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* "Compare me to my cohort" (BACKLOG F18).
 *
 * The axis picker already reaches every cut; this is the shortcut for the
 * question most readers actually have -- not "what does the generation axis
 * look like" but "what do households like mine hold". Choosing a value both
 * remembers it and moves the whole dashboard onto that axis and group.
 *
 * Only the three axes a reader can answer about themselves without guessing.
 * Income percentile is a fact about the national distribution rather than
 * something anyone knows offhand, and race is a cut to browse rather than a
 * box to tick before the product will talk to you; both stay in the axis
 * picker, which is where browsing belongs.
 *
 * Choices live in localStorage and are never sent anywhere -- the benchmark
 * request carries the axis, never who asked.
 */
const COHORT_AXES = ['generation', 'age', 'education']

export default function CohortPicker() {
  const { benchmarks, cohort, chooseCohort } = useAppData()
  const { t, dimensionLabel, tierLabel } = useI18n()

  const available = benchmarks?.dimensions
  if (!available) return null

  const axes = COHORT_AXES.map((key) => available.find((d) => d.key === key)).filter(Boolean)
  if (!axes.length) return null

  return (
    <div className="cohort">
      <span className="cohort-title">{t('cohort.title')}</span>
      {axes.map((axis) => (
        <label key={axis.key}>
          {dimensionLabel(axis.key, axis.label)}
          <select
            value={cohort.groups[axis.key] ?? ''}
            onChange={(e) => chooseCohort(axis.key, e.target.value || null)}
          >
            <option value="">{t('cohort.unset')}</option>
            {axis.group_order.map((key) => (
              <option key={key} value={key}>
                {tierLabel(key, key)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <span className="cohort-note">{t('cohort.privacy')}</span>
    </div>
  )
}
