import { useEffect, useState } from 'react'
import { AppDataProvider, useAppData } from './context/AppDataContext'
import Compare from './views/Compare'
import Portfolio from './views/Portfolio'
import Benchmarks from './views/Benchmarks'
import { applyTheme, nextTheme, readTheme, THEME_LABEL } from './lib/theme'
import { quarterLabel } from './lib/format'

const TABS = [
  { key: 'compare', label: 'Compare', view: Compare },
  { key: 'portfolio', label: 'Your portfolio', view: Portfolio },
  { key: 'benchmarks', label: 'The tiers', view: Benchmarks },
]

export default function App() {
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  )
}

function Shell() {
  const { mode, benchmarks } = useAppData()
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
          <h1>Financert</h1>
          <span className="tag">where the top 1% actually keep their money</span>
        </div>
        <div className="topbar-actions">
          <span className="datasource" data-mode={mode}>
            {mode === 'live' ? 'Live API' : mode === 'fallback' ? 'Offline snapshot' : 'Loading…'}
          </span>
          <button
            className="icon-btn"
            onClick={() => setTheme(nextTheme(theme))}
            aria-label={`Theme: ${THEME_LABEL[theme]}. Click to change.`}
          >
            {THEME_LABEL[theme]}
          </button>
        </div>
      </header>

      {mode === 'loading' || !benchmarks ? (
        <p className="empty">Loading Federal Reserve data…</p>
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                className="tab"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
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

function Disclaimer({ benchmarks }) {
  return (
    <footer className="disclaimer">
      <p style={{ margin: '0 0 8px' }}>
        <strong>What this is.</strong> Financert compares a portfolio against how American households in each
        wealth tier actually hold their assets, measured by the Federal Reserve&apos;s{' '}
        <a href={benchmarks.source.url} target="_blank" rel="noreferrer">
          Distributional Financial Accounts
        </a>
        . Data through {quarterLabel(benchmarks.latestPeriod)}; the newest fully published quarter is{' '}
        {quarterLabel(benchmarks.completePeriod)}.
      </p>
      <p style={{ margin: 0 }}>
        <strong>What it is not.</strong> It is descriptive, not advice. Matching the top 1%&apos;s allocation
        would not reproduce their returns: much of their wealth sits in private businesses they own and run,
        and the data says nothing about risk, taxes, time horizon, or whether any allocation suits you.
      </p>
    </footer>
  )
}
