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
  const { holdings, investableOnly, mode, dimension, groupKey, showGroup } = useAppData()
  const { t, fmt, dimensionLabel, tierLabel } = useI18n()
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)

  const hasHoldings = Object.keys(holdings).length > 0

  useEffect(() => {
    if (mode !== 'live' || !hasHoldings) return
    let cancelled = false
    setFailed(false)
    api
      .placements(
        { name: 'current', holdings: Object.entries(holdings).map(([asset_class, value]) => ({ asset_class, value })) },
        { investableOnly },
      )
      .then((data) => !cancelled && setResult(data))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [holdings, investableOnly, mode, hasHoldings])

  if (!hasHoldings) return null
  if (mode !== 'live' || failed) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>{t('placements.title')}</h2>
        </div>
        <p className="empty">{t('placements.needsApi')}</p>
      </div>
    )
  }
  if (!result) return null

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
    </div>
  )
}
