/* A chart as a picture (BACKLOG F54).
 *
 * The charts are plain SVG in the document, which means they are drawn by the
 * page's stylesheet and its custom properties: serialise one on its own and
 * every `fill="var(--series-you)"` resolves to nothing, every label loses its
 * size and colour, and what lands on disk is a stack of black rectangles. So
 * the copy is flattened first -- the computed value of the handful of
 * properties these charts actually use is written onto each node -- and only
 * then handed to a canvas.
 *
 * Done in the browser, like the CSV export beside it: nothing about the
 * portfolio leaves the page to produce the file.
 */

// Only what the charts use. Copying every computed property would inflate a
// 40 kB chart into a megabyte of inline style and change nothing on screen.
const PAINTED = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'font-family',
  'font-size',
  'font-weight',
  'font-variant-numeric',
  'text-anchor',
  'opacity',
]

/** Flatten a live SVG into a standalone one: same picture, no stylesheet. */
function inlineStyles(source) {
  const copy = source.cloneNode(true)
  const from = [source, ...source.querySelectorAll('*')]
  const to = [copy, ...copy.querySelectorAll('*')]
  from.forEach((node, i) => {
    const computed = getComputedStyle(node)
    let style = ''
    for (const property of PAINTED) {
      const value = computed.getPropertyValue(property)
      // A pattern fill is already a fragment reference into this same SVG, and
      // the computed value keeps it that way -- the <defs> come along in the
      // clone, so the hatch survives (BACKLOG F48).
      if (value && value !== 'none' && value !== 'normal') style += `${property}:${value};`
    }
    to[i].setAttribute('style', style)
    // The focus ring and the invisible hover targets are interface, not chart.
    to[i].removeAttribute('tabindex')
  })
  for (const hit of to[0].querySelectorAll('.hit')) hit.remove()
  return copy
}

const SVG_NS = 'http://www.w3.org/2000/svg'
// viewBox units, and these charts are 1000 units wide by convention.
const HEADER = { caption: 30, legend: 26, pad: 8 }

function text(content, { x, y, size, fill, weight = 'normal' }) {
  const node = document.createElementNS(SVG_NS, 'text')
  node.setAttribute('x', x)
  node.setAttribute('y', y)
  node.setAttribute('style', `font-family:system-ui,sans-serif;font-size:${size}px;font-weight:${weight};fill:${fill}`)
  node.textContent = content
  return node
}

/* The caption and key, drawn into the exported picture.
 *
 * On screen the legend is HTML beside the chart; in a file there is no beside.
 * Rather than move the chart, the viewBox is extended *upwards* -- the origin
 * moves, the content does not -- and the header drawn at negative y.
 */
function addHeader(copy, { caption, legend, ink }) {
  // Read out as plain numbers first: baseVal is live, so every coordinate
  // below would move with the viewBox the moment it is rewritten -- which is
  // exactly what happened, and the header was drawn a header's height above
  // the top of the picture.
  const { x: vbX, y: vbY, width: vbWidth, height: vbHeight } = copy.viewBox.baseVal
  const rows = (caption ? HEADER.caption : 0) + (legend.length ? HEADER.legend : 0)
  if (!rows) return 0
  const height = rows + HEADER.pad
  copy.setAttribute('viewBox', `${vbX} ${vbY - height} ${vbWidth} ${vbHeight + height}`)

  if (caption) copy.appendChild(text(caption, { x: vbX, y: vbY - height + 20, size: 17, fill: ink, weight: '600' }))

  let x = vbX
  const y = vbY - HEADER.pad - 8
  // The hatch is already defined in the clone's <defs>; there is exactly one
  // per chart, and it is the fill the second series uses.
  const pattern = copy.querySelector('pattern')
  for (const entry of legend) {
    if (entry.dashed) {
      const line = document.createElementNS(SVG_NS, 'line')
      line.setAttribute('x1', x)
      line.setAttribute('x2', x + 18)
      line.setAttribute('y1', y - 4)
      line.setAttribute('y2', y - 4)
      line.setAttribute('style', `stroke:${entry.color};stroke-width:3;stroke-dasharray:7 4`)
      copy.appendChild(line)
    } else {
      const chip = document.createElementNS(SVG_NS, 'rect')
      chip.setAttribute('x', x)
      chip.setAttribute('y', y - 11)
      chip.setAttribute('width', 14)
      chip.setAttribute('height', 11)
      chip.setAttribute('rx', 3)
      chip.setAttribute('style', `fill:${entry.hatched && pattern ? `url(#${pattern.id})` : entry.color}`)
      copy.appendChild(chip)
    }
    x += 24
    const label = text(entry.label, { x, y, size: 14, fill: ink })
    copy.appendChild(label)
    // No text metrics on a node that is not in the document yet, so the step
    // is estimated from the string. Generous: a legend that overlaps is worse
    // than one with a gap in it.
    x += entry.label.length * 8.5 + 22
  }
  return height
}

/** The chart on screen, as a PNG blob.
 *
 *  `scale` is a device-pixel multiplier: 2 by default, because the usual
 *  destination is a slide or a document where a 1x chart looks soft.
 */
export async function chartToPng(svg, { scale = 2, background = '#ffffff', ink = '#000000', caption, legend = [] } = {}) {
  const copy = inlineStyles(svg)
  const viewBox = svg.viewBox.baseVal
  const added = addHeader(copy, { caption, legend, ink })

  const box = svg.getBoundingClientRect()
  // The rendered size, not the viewBox: the viewBox is 1000 units wide by
  // convention here and the chart is laid out at whatever width the card is.
  const width = Math.max(1, Math.round(box.width))
  const height = Math.max(1, Math.round(box.height * ((viewBox.height + added) / viewBox.height)))
  copy.setAttribute('width', width)
  copy.setAttribute('height', height)
  copy.setAttribute('xmlns', SVG_NS)

  const markup = new XMLSerializer().serializeToString(copy)
  /* A data: URL, not an object URL. This app ships a real Content-Security-
     Policy (`img-src 'self' data:` -- see vite.config.js), and a blob: image
     is refused by it: the first version of this function got as far as a
     console line reading "Refused to load the image" and an empty download.
     encodeURIComponent rather than base64 because an axis label can be
     Arabic and btoa is Latin-1 only. */
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('the chart could not be rasterised'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  // Painted rather than left transparent: a transparent PNG of dark-theme
  // labels is invisible the moment it lands on a white slide.
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the canvas produced no image'))), 'image/png'),
  )
}
