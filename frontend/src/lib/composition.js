/* Turning a mix into bands (BACKLOG F42, F43).
 *
 * Both composition charts -- one group over 147 quarters, and every group in
 * one quarter -- want the same thing: a fixed, ordered set of bands that sum
 * to 1, with the long tail collected rather than drawn as eleven hairlines
 * nobody can tell apart.
 *
 * The cut is by *mean* share rather than by the latest quarter's, so a class
 * that was large for thirty years and is small now keeps its own band instead
 * of vanishing into "other" at the point the chart is about.
 */

export const OTHER = 'other'

/** The classes worth their own band, largest first, plus OTHER if anything is
 *  left over. `mixes` is a list of {key: share} maps -- quarters, or groups. */
export function bandKeys(mixes, { limit = 6 } = {}) {
  const totals = {}
  for (const mix of mixes) {
    for (const [key, share] of Object.entries(mix)) {
      totals[key] = (totals[key] ?? 0) + share
    }
  }
  const ranked = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
  const kept = ranked.slice(0, limit)
  return ranked.length > kept.length ? [...kept, OTHER] : kept
}

/** One mix as cumulative bands in `keys` order: [{key, from, to}], where `to`
 *  of the last band is the sum of the mix (1, for a normalised one). */
export function bands(mix, keys) {
  let cursor = 0
  const kept = new Set(keys)
  return keys.map((key) => {
    const share =
      key === OTHER
        ? Object.entries(mix).reduce((sum, [k, v]) => (kept.has(k) ? sum : sum + v), 0)
        : (mix[key] ?? 0)
    const band = { key, share, from: cursor, to: cursor + share }
    cursor += share
    return band
  })
}
