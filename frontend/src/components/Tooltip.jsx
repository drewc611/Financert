import { useCallback, useState } from 'react'

/** Shared hover-tooltip plumbing for the SVG charts.
 *  Position is viewport-fixed so the tooltip escapes the chart's clip box. */
export function useTooltip() {
  const [tip, setTip] = useState(null)

  const show = useCallback((event, content) => {
    setTip({ x: event.clientX, y: event.clientY, content })
  }, [])

  /** The same tooltip, anchored to an element instead of a pointer — what a
   *  keyboard user gets on focus (BACKLOG F49). Centred on the row, at its top
   *  edge, because a row spans the whole chart and its middle is where the
   *  reader's attention already is. */
  const showAt = useCallback((element, content) => {
    const rect = element.getBoundingClientRect()
    setTip({ x: rect.left + rect.width / 2, y: rect.top, content })
  }, [])

  const hide = useCallback(() => setTip(null), [])

  return { tip, show, showAt, hide }
}

export function Tooltip({ tip }) {
  if (!tip) return null
  // Nudge away from the cursor, and flip left near the right edge so the
  // tooltip never runs off-screen on narrow viewports.
  const flip = tip.x > window.innerWidth - 260
  const style = {
    left: flip ? tip.x - 16 : tip.x + 16,
    top: Math.max(8, tip.y - 12),
    transform: flip ? 'translateX(-100%)' : 'none',
  }
  return (
    <div className="tooltip" style={style} role="status">
      {tip.content}
    </div>
  )
}

export function TooltipRows({ title, rows }) {
  return (
    <>
      <div className="t-title">{title}</div>
      {rows.map((r) => (
        <div className="t-row" key={r.label}>
          <span>{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
    </>
  )
}
