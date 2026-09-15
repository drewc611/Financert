/* CSV of the comparison on screen (BACKLOG F53).
 *
 * Built here rather than server-side because the comparison itself is computed
 * here -- offline included, where there is no server to ask. It is the same
 * rows the gap table shows, in the same order, with the period and the
 * benchmark named in the file so a spreadsheet three months from now still
 * says what it is a comparison of.
 */

/** RFC 4180: quote anything containing a comma, quote or newline, and double
 *  any quote inside. Asset labels are translated, and several languages use a
 *  comma where English uses a decimal point. */
function cell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows) {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

/** The comparison as rows, ready for `toCsv`. Numbers are plain decimals in
 *  en-US form: this is a file for a spreadsheet, not for reading, and a
 *  localised "12,3 %" would import as text or as 123. */
export function comparisonRows(result, { labels = {}, benchmarkLabel, headers }) {
  const head = [
    [headers.assetClass, headers.you, benchmarkLabel, headers.difference, headers.dollars],
  ]
  const body = result.gaps.map((gap) => [
    labels[gap.asset_class] || gap.label || gap.asset_class,
    (gap.user_pct / 100).toFixed(4),
    (gap.benchmark_pct / 100).toFixed(4),
    gap.gap_pp.toFixed(2),
    gap.status === 'pending' ? '' : ((gap.gap_pp / 100) * result.portfolio_total).toFixed(2),
  ])
  return [
    [headers.benchmark, benchmarkLabel],
    [headers.period, result.period],
    [headers.total, result.portfolio_total.toFixed(2)],
    /* TRUE/FALSE rather than the on-screen wording: those strings are
       sentence fragments ("share of the *investable assets*, Q1 2026") and
       stand badly alone, while a spreadsheet reads these as booleans. */
    [headers.investableOnly, result.investable_only ? 'TRUE' : 'FALSE'],
    [],
    ...head,
    ...body,
  ]
}

/** Hand the file to the browser.
 *
 *  A Blob and a synthetic click, which is the only way to name a download
 *  without a server. The object URL is revoked on the next frame -- not
 *  immediately, because Safari has not started reading it yet when the click
 *  returns.
 */
export function download(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}
