import { useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { usd } from '../lib/format'

export default function Portfolio() {
  const { benchmarks, holdings, setHolding, clearHoldings, save, mode, slug, setSlug, portfolios, token, updateToken } =
    useAppData()
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tokenDraft, setTokenDraft] = useState(token)
  const [newSlug, setNewSlug] = useState('')

  const total = Object.values(holdings).reduce((a, b) => a + b, 0)

  async function onSave() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await save()
      setStatus(res.ok ? 'Saved to the API.' : 'Saved in this browser only — the API is unreachable.')
    } catch (err) {
      setStatus(
        err.status === 401
          ? 'Could not save: this server requires an API token. Add it below.'
          : `Could not save: ${err.message}`,
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
        <h2>Your portfolio</h2>
        <strong>{usd(total)}</strong>
      </div>
      <p className="sub">
        Enter what you hold in each category, in dollars. Leave anything you do not hold blank. Values stay in
        this browser{mode === 'live' ? ' and are saved to the API when you press Save' : ''}.
      </p>

      {mode === 'live' && (
        <div className="controls">
          <label>
            Portfolio
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
            placeholder="new-portfolio-name"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            aria-label="New portfolio slug"
          />
          <button
            className="icon-btn"
            disabled={!newSlug.trim()}
            onClick={() => {
              switchTo(newSlug.trim().toLowerCase())
              setNewSlug('')
            }}
          >
            Start a new one
          </button>
        </div>
      )}

      <div className="holdings-grid">
        <p className="hint">
          Categories match the Federal Reserve&apos;s own balance-sheet definitions, so the comparison is
          like-for-like.
        </p>
        {benchmarks.assetClasses
          .filter((a) => a.key !== 'unallocated')
          .map((asset) => (
            <Row key={asset.key} asset={asset} value={holdings[asset.key] ?? ''} onChange={setHolding} />
          ))}
      </div>

      <div className="row-actions">
        <button className="btn-primary" onClick={onSave} disabled={saving || total === 0}>
          {saving ? 'Saving…' : 'Save portfolio'}
        </button>
        <button className="icon-btn" onClick={clearHoldings} disabled={total === 0}>
          Clear all
        </button>
        {status && <span className="saved-note">{status}</span>}
      </div>

      {mode === 'live' && (
        <details className="token-box">
          <summary>API token</summary>
          <p className="sub" style={{ margin: '10px 0' }}>
            Only needed when the server sets <code>FINANCERT_API_TOKEN</code>. Stored in this browser and
            sent as a bearer header. Leave blank for a local server with no token configured.
          </p>
          <div className="row-actions" style={{ marginTop: 0 }}>
            <input
              type="password"
              value={tokenDraft}
              placeholder="paste token"
              onChange={(e) => setTokenDraft(e.target.value)}
              aria-label="API token"
              style={{ width: 260 }}
            />
            <button
              className="icon-btn"
              onClick={() => {
                updateToken(tokenDraft.trim())
                setStatus(tokenDraft.trim() ? 'Token saved in this browser.' : 'Token cleared.')
              }}
            >
              Save token
            </button>
          </div>
        </details>
      )}
    </div>
  )
}

function Row({ asset, value, onChange }) {
  const id = `holding-${asset.key}`
  return (
    <>
      <label htmlFor={id}>
        <strong style={{ fontWeight: 550 }}>{asset.label}</strong>
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{asset.blurb}</span>
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
