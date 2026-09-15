import { useEffect, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import { useI18n } from '../i18n'

/* What changed about one group's mix between two quarters (BACKLOG F33), and
 * what it looked like at each end (F32).
 *
 * Shares rather than dollars, deliberately: every tier's balance sheet grew
 * over any long window, so a dollar comparison would rank the classes by asset
 * prices instead of by what changed about the mix. The top 1% went from 20% to
 * 50% in equities since 1989 while private business fell by 14 points -- that
 * is the finding, and it is invisible in dollars.
 */
export default function Movers() {
  const { benchmarks, groupKey, activeGroups, investableOnly, mode } = useAppData()
  const { t, fmt, assetLabel, tierLabel } = useI18n()
  const [from, setFrom] = useState('earliest')
  // { state: 'loading' | 'ready' | 'failed', rows }
  const [answer, setAnswer] = useState({ state: 'loading', rows: null })
  const [reload, setReload] = useState(0)
  /* Which tier this card is about, chosen here rather than page-wide: the
     tables above show every tier at once, so a control in the page header
     would read as filtering them. Starts from the comparison tab's choice. */
  const [tier, setTier] = useState(groupKey)

  const shown = activeGroups[tier] ? tier : groupKey
  const to = activeGroups[shown]?.period
  const live = mode === 'live'

  useEffect(() => {
    if (!live || !to) return
    let cancelled = false
    // Cleared while the next answer is in flight: the sentence under this
    // table names the tier and the two quarters it is about, so leaving the
    // previous tier's rows under a changed heading is a wrong answer rather
    // than a stale one (BACKLOG F50).
    setAnswer({ state: 'loading', rows: null })
    api
      .movers({ group: shown, from, to, investableOnly })
      .then((data) => !cancelled && setAnswer({ state: 'ready', rows: data }))
      .catch(() => !cancelled && setAnswer({ state: 'failed', rows: null }))
    return () => {
      cancelled = true
    }
  }, [shown, from, to, investableOnly, live, reload])

  /* Three reasons there is no table, and they used to read as one: the API is
     not there at all (offline, where this card has no answer to give), the
     request is still running, and the request failed (where trying again is
     the obvious next move, so there is a button for it). */
  if (!live || answer.state !== 'ready') {
    return (
      <div className="card">
        <div className="card-head">
          <h2>{t('movers.title')}</h2>
        </div>
        {!live && <p className="empty">{t('movers.needsApi')}</p>}
        {live && answer.state === 'loading' && <p className="empty">{t('app.loading')}</p>}
        {live && answer.state === 'failed' && (
          <p className="empty">
            {t('movers.failed')}{' '}
            <button type="button" className="link-btn" onClick={() => setReload((n) => n + 1)}>
              {t('benchmarks.retry')}
            </button>
          </p>
        )}
      </div>
    )
  }

  const rows = answer.rows
  const label = tierLabel(shown, activeGroups[shown]?.label)

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('movers.title')}</h2>
        <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <select value={shown} onChange={(e) => setTier(e.target.value)}>
            {Object.values(activeGroups).map((g) => (
              <option key={g.key} value={g.key}>
                {tierLabel(g.key, g.label)}
              </option>
            ))}
          </select>{' '}
          {t('movers.since')}{' '}
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="earliest">{fmt.quarter(benchmarks.periods[0])}</option>
            {[...benchmarks.periods]
              .reverse()
              .filter((p) => p !== rows.to_period && p !== benchmarks.periods[0])
              .map((period) => (
                <option key={period} value={period}>
                  {fmt.quarter(period)}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="sub">
        {t('movers.sub', {
          tier: label,
          from: fmt.quarter(rows.from_period),
          to: fmt.quarter(rows.to_period),
        })}
      </p>
      <div className="chart-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('benchmarks.assetClass')}</th>
              <th scope="col" className="num">
                {fmt.quarter(rows.from_period)}
              </th>
              <th scope="col" className="num">
                {fmt.quarter(rows.to_period)}
              </th>
              <th scope="col" className="num">
                {t('movers.change')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.movers.map((row) => (
              <tr key={row.asset_class}>
                <td>{assetLabel(row.asset_class, row.label)}</td>
                <td className="num">{fmt.pct(row.from_share)}</td>
                <td className="num">{fmt.pct(row.to_share)}</td>
                <td className="num">{fmt.pp(row.change_pp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
