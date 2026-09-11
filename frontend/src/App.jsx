import { useEffect, useState } from 'react'
import { AppDataProvider, useAppData } from './context/AppDataContext'
import Compare from './views/Compare'
import Portfolio from './views/Portfolio'
import Benchmarks from './views/Benchmarks'
import { applyTheme, nextTheme, readTheme } from './lib/theme'
import { I18nProvider, LOCALES, useI18n } from './i18n'
import { useInstallPrompt } from './lib/install'

const TABS = [
  { key: 'compare', view: Compare },
  { key: 'portfolio', view: Portfolio },
  { key: 'benchmarks', view: Benchmarks },
]

export default function App() {
  return (
    <I18nProvider>
      <AppDataProvider>
        <Shell />
      </AppDataProvider>
    </I18nProvider>
  )
}

function Shell() {
  const { mode, benchmarks } = useAppData()
  const { t } = useI18n()
  const [tab, setTab] = useState('compare')
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const Active = TABS.find((t) => t.key === tab).view

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>{t('app.name')}</h1>
          <span className="tag">{t('app.tagline')}</span>
        </div>
        <div className="topbar-actions">
          <span className="datasource" data-mode={mode}>
            {t(`mode.${mode === 'live' ? 'live' : mode === 'fallback' ? 'fallback' : 'loading'}`)}
          </span>
          <InstallButton />
          <LanguagePicker />
          <button
            className="icon-btn"
            onClick={() => setTheme(nextTheme(theme))}
            aria-label={t('theme.label', { theme: t(`theme.${theme}`) })}
          >
            {t(`theme.${theme}`)}
          </button>
        </div>
      </header>

      {mode === 'loading' || !benchmarks ? (
        <p className="empty">{t('app.loading')}</p>
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.key}
                className="tab"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
              >
                {t(`tabs.${item.key}`)}
              </button>
            ))}
          </nav>

          <Active />

          <Disclaimer benchmarks={benchmarks} />
        </>
      )}
    </div>
  )
}

function LanguagePicker() {
  const { locale, setLocale, t } = useI18n()
  return (
    <label className="lang-picker">
      <span className="sr-only">{t('app.language')}</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value)} aria-label={t('app.language')}>
        {LOCALES.map((l) => (
          // `lang` on the option so a screen reader pronounces each endonym
          // in its own language rather than the page's.
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Only rendered once the browser has offered an install prompt -- Chrome and
 *  Edge fire `beforeinstallprompt`, Safari never does, so on iOS this button
 *  simply never appears and the user installs via Share → Add to Home Screen. */
function InstallButton() {
  const { t } = useI18n()
  const { canInstall, promptInstall } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <button className="icon-btn" onClick={promptInstall} title={t('app.installHint')}>
      {t('app.install')}
    </button>
  )
}

function Disclaimer({ benchmarks }) {
  const { t, fmt, locale } = useI18n()
  const note = t('disclaimer.translationNote')
  return (
    <footer className="disclaimer">
      <p style={{ margin: '0 0 8px' }}>
        <strong>{t('disclaimer.whatTitle')}</strong> {t('disclaimer.whatBody')}{' '}
        <a href={benchmarks.source.url} target="_blank" rel="noreferrer">
          {t('disclaimer.dfaLink')}
        </a>
        . {t('disclaimer.dataThrough', { quarter: fmt.quarter(benchmarks.latestPeriod) })}
        {benchmarks.latestPeriod !== benchmarks.completePeriod &&
          t('disclaimer.newestComplete', { quarter: fmt.quarter(benchmarks.completePeriod) })}
        .
      </p>
      <p style={{ margin: 0 }}>
        <strong>{t('disclaimer.notTitle')}</strong> {t('disclaimer.notBody')}
      </p>
      {/* Empty in English, where there is nothing to disclaim. Elsewhere it
          says the English original governs -- these translations have not been
          through legal review, and this paragraph is the one that matters. */}
      {note && (
        <p className="translation-note" lang={locale}>
          {note}
        </p>
      )}
    </footer>
  )
}
