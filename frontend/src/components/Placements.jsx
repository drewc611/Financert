import { useEffect, useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { api } from '../lib/api'
import { useI18n } from '../i18n'

/* Where one mix lands on all six axes at once (BACKLOG F19).
 *
 * The rest of the dashboard answers "how do I compare with this group"; this
 * answers "whose balance sheet does mine look like", six times over, and asks
 * nothing of the reader to do it.
 *
 * Server-side because the answer needs every axis, and the client holds one at
 * a time -- so this is the one part of the dashboard with no offline mirror.
 * It says so rather than rendering an empty table.
 */
export default function Placements() {
  const { holdings, debts, investableOnly, mode, dimension, groupKey, showGroup } = useAppData()
  const { t, fmt, dimensionLabel, tierLabel } = useI18n()
  // { state: 'loading' | 'ready' | 'failed', data }
  const [answer, setAnswer] = useState({ state: 'loading', data: null })
  const [reload, setReload] = useState(0)

  const hasHoldings = Object.keys(holdings).length > 0

  useEffect(() => {
    if (mode !== 'live' || !hasHoldings) return
    let cancelled = false
    // The previous answer stays up while the next one loads: this card
    // refetches on every keystroke in the holdings form, and blanking it each
    // time would make it flicker rather than update. Every row it shows is
    // about the same portfolio either way.
    setAnswer((prev) => ({ state: 'loading', data: prev.data }))
    api
      .placements(
        {
          name: 'current',
          holdings: Object.entries(holdings).map(([asset_class, value]) => ({ asset_class, value })),
          debts: Object.entries(debts).map(([liability_class, value]) => ({ liability_class, value })),
        },
        { investableOnly },
      )
      .then((data) => !cancelled && setAnswer({ state: 'ready', data }))
      .catch(() => !cancelled && setAnswer({ state: 'failed', data: null }))
    return () => {
      cancelled = true
    }
  }, [holdings, debts, investableOnly, mode, hasHoldings, reload])

  if (!hasHoldings) return null

  /* Offline, still loading and failed are three different things, and this
     card answered all three with "needs the API" (BACKLOG F50). */
  const result = answer.data
  if (!result) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>{t('placements.title')}</h2>
        </div>
        {mode !== 'live' ? (
          <p className="empty">{t('placements.needsApi')}</p>
        ) : answer.state === 'failed' ? (
          <p className="empty">
            {t('placements.failed')}{' '}
            <button type="button" className="link-btn" onClick={() => setReload((n) => n + 1)}>
              {t('benchmarks.retry')}
            </button>
          </p>
        ) : (
          <p className="empty">{t('app.loading')}</p>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t('placements.title')}</h2>
      </div>
      <p className="sub">{t('placements.sub')}</p>
      <div className="chart-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('placements.axis')}</th>
              <th scope="col">{t('placements.nearest')}</th>
              <th scope="col" className="num">
                {t('placements.similarity')}
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {result.placements.map((p) => {
              const shown = p.dimension === dimension && p.nearest === groupKey
              return (
                <tr key={p.dimension}>
                  <td>{dimensionLabel(p.dimension, p.label)}</td>
                  <td>
                    {tierLabel(p.nearest, p.nearest_label)}
                    {/* Below the confidence floor the mix does not really
                        resemble any group on this axis, and printing the
                        closest one unqualified would be an overclaim. */}
                    {!p.confident && <span className="th-note">{t('placements.notConfident')}</span>}
                  </td>
                  <td className="num">{fmt.num(p.similarity)}</td>
                  <td className="num">
                    {shown ? (
                      <span className="th-note">{t('placements.showing')}</span>
                    ) : (
                      <button type="button" className="link-btn" onClick={() => showGroup(p.dimension, p.nearest)}>
                        {t('placements.show')}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* The same six readings for what is owed (BACKLOG F27), and a genuinely
          different answer: a household can hold assets like the Next 9% and
          owe like the bottom 50%, because a mortgage and a brokerage account
          are not the same decision. Absent until the reader enters a debt
          side, which nothing else on the page requires. */}
      {result.debt_placements.length > 0 && (
        <>
          <p className="sub" style={{ marginTop: 22 }}>
            {t('placements.debtSub', { amount: fmt.usd(result.total_debt, { compact: true }) })}
          </p>
          <div className="chart-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('placements.axis')}</th>
                  <th scope="col">{t('placements.nearestDebt')}</th>
                  <th scope="col" className="num">
                    {t('placements.similarity')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.debt_placements.map((p) => (
                  <tr key={p.dimension}>
                    <td>{dimensionLabel(p.dimension, p.label)}</td>
                    <td>
                      {tierLabel(p.nearest, p.nearest_label)}
                      {!p.confident && <span className="th-note">{t('placements.notConfident')}</span>}
                    </td>
                    <td className="num">{fmt.num(p.similarity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
