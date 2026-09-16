import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* A portfolio arrived in the link (BACKLOG F52).
 *
 * It asks rather than loads. Someone else's link is not a reason to overwrite
 * the numbers this browser has saved, and the offer says both what is in the
 * link and what taking it up costs -- there is no undo for a portfolio that
 * has been replaced.
 */
export default function SharedNotice() {
  const { shared, showShared, dismissShared, holdings } = useAppData()
  const { t, fmt } = useI18n()
  if (!shared) return null

  const total = Object.values(shared.holdings).reduce((a, b) => a + b, 0)
  const count = Object.keys(shared.holdings).length
  const replaces = Object.keys(holdings).length > 0

  return (
    <div className="notice" role="status">
      <strong>{t('share.incomingTitle', { amount: fmt.usd(total, { compact: true }), count })}</strong>{' '}
      {replaces ? t('share.incomingReplaces') : t('share.incomingEmpty')}{' '}
      <button type="button" className="link-btn" onClick={showShared}>
        {t('share.incomingShow')}
      </button>{' '}
      <button type="button" className="link-btn" onClick={dismissShared}>
        {t('share.incomingKeep')}
      </button>
    </div>
  )
}
