/** Hand a file to the browser.
 *
 *  A Blob and a synthetic click, which is the only way to name a download
 *  without a server -- and there is no server in this path on purpose: both
 *  the CSV (F53) and the PNG (F54) are built in the page, so nothing about the
 *  portfolio leaves it to produce a file.
 *
 *  Takes a Blob or a string. The object URL is revoked on the next frame, not
 *  immediately: Safari has not started reading it when the click returns.
 */
export function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}
