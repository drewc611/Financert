import { useState } from 'react'
import { useAppData } from '../context/AppDataContext'
import { encodeShare } from '../lib/share'
import { useI18n } from '../i18n'

/* A link to the comparison on screen (BACKLOG F52).
 *
 * Built only when asked for, never kept in sync with the page: writing the
 * holdings into the address bar as the reader types would put them in the
 * browser's history, and in a screen-share, without anyone asking for that.
 *
 * The numbers ride in the fragment, which is never sent in an HTTP request --
 * see lib/share.js. That keeps them out of server logs; it does not make the
 * link private, and the line under the button says so, because someone about
 * to paste their balance sheet into a group chat deserves to be told once.
 */
export default function ShareLink() {
  const { holdings, debts, groupKey, dimension, periodMode, investableOnly } = useAppData()
  const { t } = useI18n()
  const [state, setState] = useState(null)

  if (!Object.keys(holdings).length) return null

  async function copy() {
    const fragment = encodeShare({ holdings, debts, groupKey, dimension, periodMode, investableOnly })
    const link = `${window.location.origin}${window.location.pathname}${fragment}`
    try {
      await navigator.clipboard.writeText(link)
      setState('copied')
    } catch {
      /* The clipboard needs a secure context and a permission, and this app is
         meant to run from a laptop over plain http as much as from a domain.
         Putting the link in the address bar is the fallback that always works
         -- the reader copies it from there. */
      window.history.replaceState(null, '', fragment)
      setState('inUrl')
    }
  }

  return (
    <p className="sub share-link">
      <button type="button" className="link-btn" onClick={copy}>
        {t('share.copy')}
      </button>{' '}
      {state ? <strong>{t(`share.${state}`)}</strong> : t('share.note')}
    </p>
  )
}
