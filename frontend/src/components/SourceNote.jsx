import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

const WIDTH = 280

/* "Where does this number come from?", beside the number (BACKLOG F56).
 *
 * The whole claim of this product is that every figure traces to a published
 * Federal Reserve column, and until now the only place that trace existed was
 * backend/app/constants.py. This says it in the page: which columns the bucket
 * is the sum of, which file they were read from, and when that file was
 * fetched. The column names are the Fed's own strings, untranslated on
 * purpose -- they are what a reader would search the source for.
 *
 * Positioned from the button's own rectangle and rendered into <body>, for the
 * same reason the chart tooltip escapes its chart: these sit in table cells
 * inside a horizontal scroller and in a pinned first column. Absolute
 * positioning is clipped by the scroller; fixed positioning is not, but a
 * fixed element is still painted inside its ancestors' stacking context, and
 * the pinned column is one -- the note came out *behind* the rows below it
 * until it was portalled out.
 */
export default function SourceNote({ label, columns, blurb }) {
  const { benchmarks } = useAppData()
  const { t } = useI18n()
  const [at, setAt] = useState(null)
  const id = useId()
  const panel = useRef(null)

  useEffect(() => {
    if (!at) return
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      // A drag to select the column name inside the note is not a click away
      // from it.
      if (event.type === 'pointerdown' && panel.current?.contains(event.target)) return
      setAt(null)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    // Capture, so the table's own scroller counts: the panel is anchored to a
    // rectangle measured once, and scrolling moves the thing it points at.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [at])

  /* Flip above the marker when there is no room below it. Measured rather
     than estimated: the note is three or four lines depending on how many
     columns the bucket sums and how long the blurb is in this language. */
  useLayoutEffect(() => {
    if (!at || at.settled) return
    const box = panel.current?.getBoundingClientRect()
    if (!box) return
    const overflows = box.bottom > window.innerHeight - 8
    setAt((prev) => ({
      ...prev,
      top: overflows ? Math.max(8, prev.anchorTop - box.height - 6) : prev.top,
      settled: true,
    }))
  }, [at])

  if (!columns?.length) return null

  const source = benchmarks.source ?? {}

  function toggle(event) {
    /* These sit inside the <label> of each holdings field, and a click on
       anything inside a label is forwarded to the field it labels -- opening
       this note would put the cursor in the box beside it. */
    event.preventDefault()
    // pointerdown has already closed whatever was open by the time this runs,
    // so a second click on the same marker reads as "open" unless it is the
    // one that just closed.
    if (at) return setAt(null)
    const rect = event.currentTarget.getBoundingClientRect()
    setAt({
      top: rect.bottom + 6,
      anchorTop: rect.top,
      // Clamped so a marker in the last column does not put half the panel
      // off the side of the window.
      left: Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8)),
    })
  }

  return (
    <>
      <button
        type="button"
        className="source-btn"
        aria-expanded={Boolean(at)}
        aria-controls={id}
        aria-label={t('source.aria', { label })}
        onClick={toggle}
      >
        ⓘ
      </button>
      {at &&
        createPortal(
          <span
            className="source-pop"
            id={id}
            role="note"
            ref={panel}
            style={{ top: at.top, left: at.left, width: WIDTH }}
          >
            <strong>{label}</strong>
            {blurb && <span>{blurb}</span>}
            <span>
              {t('source.columns')}
              <ul>
                {columns.map((column) => (
                  <li key={column}>{column}</li>
                ))}
              </ul>
            </span>
            <span className="source-file">
              {t('source.from', {
                file: source.retrieved_via ?? source.name ?? 'DFA',
                when: (source.retrieved_at ?? '').slice(0, 10),
              })}
            </span>
          </span>,
          document.body,
        )}
    </>
  )
}
