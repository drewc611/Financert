/**
 * How much horizontal room the row labels in the bar charts need.
 *
 * The charts draw labels right-aligned against a fixed gutter in SVG user
 * space, so a gutter sized for English silently clips anything longer --
 * "Private Business Equity" fits at 168px, "Participations dans des
 * entreprises privées" does not, and German is longer still. Text expansion
 * of 30-50% over English is normal, so the gutter is measured rather than
 * guessed.
 *
 * An estimate from character count, not a real text measurement: the charts
 * render inside a viewBox that scales, so there is no reliable pixel context
 * to measure against, and getting this slightly wrong only shifts where the
 * bars start. The clamp is what matters -- it stops one pathological label
 * from squeezing the plot to nothing.
 */

const CHAR_W = 6.4 // ~12px system font, averaged over mixed-case Latin
const GUTTER = 14 // gap between the label and the baseline
const MIN = 120
const MAX = 340

export function labelGutter(labels) {
  const longest = labels.reduce((n, label) => Math.max(n, String(label ?? '').length), 0)
  return Math.round(Math.min(MAX, Math.max(MIN, longest * CHAR_W + GUTTER)))
}
