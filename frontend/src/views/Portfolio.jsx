import { useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

export default function Portfolio() {
  const {
    benchmarks,
    holdings,
    setHolding,
    debts,
    setDebt,
    clearHoldings,
    save,
    mode,
    slug,
    setSlug,
    portfolios,
    token,
    updateToken,
  } = useAppData()
  const { t, fmt } = useI18n()
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tokenDraft, setTokenDraft] = useState(token)
  const [newSlug, setNewSlug] = useState('')

  const total = Object.values(holdings).reduce((a, b) => a + b, 0)
  const owed = Object.values(debts).reduce((a, b) => a + b, 0)

  async function onSave() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await save()
      setStatus(res.ok ? t('portfolio.savedApi') : t('portfolio.savedLocal'))
    } catch (err) {
      setStatus(
        err.status === 401 ? t('portfolio.needsToken') : t('portfolio.saveFailed', { message: err.message }),
      )
    } finally {
      setSaving(false)
    }
  }

  function switchTo(next) {
    if (!next || next === slug) return
    setSlug(next)
    clearHoldings()
    setStatus(null)
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('portfolio.title')}</h2>
        <strong>{fmt.usd(total)}</strong>
      </div>
      <p className="sub">{mode === 'live' ? t('portfolio.introLive') : t('portfolio.intro')}</p>

      {mode === 'live' && (
        <div className="controls">
          <label>
            {t('portfolio.select')}
            <select value={slug} onChange={(e) => switchTo(e.target.value)}>
              {[...new Set([slug, 'default', ...portfolios.map((p) => p.slug)])].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <input
            type="text"
            placeholder={t('portfolio.newPlaceholder')}
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            aria-label={t('portfolio.newAria')}
          />
          <button
            className="icon-btn"
            disabled={!newSlug.trim()}
            onClick={() => {
              switchTo(newSlug.trim().toLowerCase())
              setNewSlug('')
            }}
          >
            {t('portfolio.startNew')}
          </button>
        </div>
      )}

      <div className="holdings-grid">
        <p className="hint">{t('portfolio.categoriesHint')}</p>
        {benchmarks.assetClasses
          .filter((a) => a.key !== 'unallocated')
          .map((asset) => (
            <Row key={asset.key} asset={asset} value={holdings[asset.key] ?? ''} onChange={setHolding} />
          ))}
      </div>

      {/* Optional, and second: an allocation comparison needs no debt side at
          all. It is what makes net worth -- the figure the Fed's tiers are
          actually defined by -- something this app can state rather than ask
          the reader to work out (BACKLOG F25). */}
      <div className="card-head" style={{ marginTop: 28 }}>
        <h2>{t('portfolio.owedTitle')}</h2>
        <strong>{fmt.usd(owed)}</strong>
      </div>
      <p className="sub">{t('portfolio.owedSub')}</p>

      <div className="holdings-grid">
        {(benchmarks.liabilityClasses ?? []).map((debt) => (
          <DebtRow key={debt.key} debt={debt} value={debts[debt.key] ?? ''} onChange={setDebt} />
        ))}
      </div>

      {(total > 0 || owed > 0) && (
        <p className="placement-answer">
          <strong>{t('portfolio.netWorth', { amount: fmt.usd(total - owed) })}</strong>{' '}
          {t('portfolio.netWorthNote')}
        </p>
      )}

      <div className="row-actions">
        <button className="btn-primary" onClick={onSave} disabled={saving || total === 0}>
          {saving ? t('portfolio.saving') : t('portfolio.save')}
        </button>
        <button className="icon-btn" onClick={clearHoldings} disabled={total === 0 && owed === 0}>
          {t('portfolio.clearAll')}
        </button>
        {status && <span className="saved-note">{status}</span>}
      </div>

      {mode === 'live' && (
        <details className="token-box">
          <summary>{t('portfolio.tokenSummary')}</summary>
          <p className="sub" style={{ margin: '10px 0' }}>
            {t('portfolio.tokenHelp')}
          </p>
          <div className="row-actions" style={{ marginTop: 0 }}>
            <input
              type="password"
              value={tokenDraft}
              placeholder={t('portfolio.tokenPlaceholder')}
              onChange={(e) => setTokenDraft(e.target.value)}
              aria-label={t('portfolio.tokenAria')}
              style={{ width: 260 }}
            />
            <button
              className="icon-btn"
              onClick={() => {
                updateToken(tokenDraft.trim())
                setStatus(tokenDraft.trim() ? t('portfolio.tokenSaved') : t('portfolio.tokenCleared'))
              }}
            >
              {t('portfolio.saveToken')}
            </button>
          </div>
        </details>
      )}
    </div>
  )
}

function DebtRow({ debt, value, onChange }) {
  const { debtLabel, debtBlurb } = useI18n()
  const id = `debt-${debt.key}`
  return (
    <>
      <label htmlFor={id}>
        <strong style={{ fontWeight: 550 }}>{debtLabel(debt.key, debt.label)}</strong>
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{debtBlurb(debt.key, debt.blurb)}</span>
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="1000"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(debt.key, e.target.value)}
      />
    </>
  )
}

function Row({ asset, value, onChange }) {
  const { assetLabel, assetBlurb } = useI18n()
  const id = `holding-${asset.key}`
  return (
    <>
      <label htmlFor={id}>
        <strong style={{ fontWeight: 550 }}>{assetLabel(asset.key, asset.label)}</strong>
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{assetBlurb(asset.key, asset.blurb)}</span>
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="1000"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(asset.key, e.target.value)}
      />
    </>
  )
}
