import { useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* The banner that says you are looking at a "what if" (BACKLOG F38).
 *
 * A draft changes every number on every page, so the state has to be visible
 * from all of them -- an edit mode you can forget you are in is how someone
 * ends up reading a scenario as their portfolio.
 *
 * Three ways out, and they are deliberately different acts: keep it as a named
 * scenario, make it the real portfolio (the only one here that overwrites what
 * is stored), or throw it away.
 */
export default function ScenarioBar() {
  const { scenario, saveScenario, applyScenario, discardScenario } = useAppData()
  const { t, fmt } = useI18n()
  const [name, setName] = useState('')

  if (!scenario) return null

  const total = Object.values(scenario.holdings).reduce((a, b) => a + b, 0)

  return (
    <div className="notice scenario-bar" role="status">
      <strong>
        {scenario.name
          ? t('scenario.editing', { name: scenario.name })
          : t('scenario.unsaved')}
      </strong>{' '}
      {t('scenario.total', { amount: fmt.usd(total, { compact: true }) })}
      <span className="scenario-actions">
        <input
          type="text"
          value={name}
          placeholder={scenario.name || t('scenario.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          aria-label={t('scenario.nameAria')}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            saveScenario(name || scenario.name)
            setName('')
          }}
        >
          {t('scenario.save')}
        </button>
        {/* The one action here that replaces what is saved, so it says so. */}
        <button type="button" className="icon-btn" onClick={applyScenario}>
          {t('scenario.apply')}
        </button>
        <button type="button" className="link-btn" onClick={discardScenario}>
          {t('scenario.discard')}
        </button>
      </span>
    </div>
  )
}
