/* A link that carries the comparison on screen (BACKLOG F52).
 *
 * In the URL *fragment*, not the query string, and that is the whole design:
 * a fragment is never sent in an HTTP request and is stripped from the Referer
 * header, so a link with someone's holdings in it does not put those numbers
 * into a web server's logs -- not the static host's, not the API's, not an
 * analytics vendor's. The person holding the link is the only one who reads
 * it, which is the same promise the rest of the app makes (see PRIVACY.md).
 *
 * That is a promise about *this* app's servers. A link is still a link: pasted
 * into a chat, it carries the numbers to whoever is in that chat, which is the
 * point of asking for one and worth saying out loud in the UI.
 */

// Bumped if the shape below stops meaning what it means. A link from a future
// version is refused rather than half-read.
const VERSION = 1

const KEY = 'p'

/* Short keys because this lands in a URL: h(oldings), d(ebts), g(roup),
   x(-axis, the dimension), q(uarter), i(nvestable only). */
export function encodeShare({ holdings, debts, groupKey, dimension, periodMode, investableOnly }) {
  const payload = {
    v: VERSION,
    h: holdings,
    ...(debts && Object.keys(debts).length ? { d: debts } : {}),
    g: groupKey,
    x: dimension,
    q: periodMode,
    i: investableOnly ? 1 : 0,
  }
  return `#${KEY}=${base64url(JSON.stringify(payload))}`
}

/** Read a fragment back. Returns null for anything this version cannot read --
 *  a truncated link, a hand-edited one, a future version. Never throws: the
 *  caller is rendering a page, not validating input. */
export function decodeShare(hash) {
  const raw = String(hash || '').replace(/^#/, '')
  const match = raw.split('&').find((part) => part.startsWith(`${KEY}=`))
  if (!match) return null
  try {
    const payload = JSON.parse(fromBase64url(match.slice(KEY.length + 1)))
    if (payload?.v !== VERSION) return null
    const holdings = numbersOnly(payload.h)
    // A link with no holdings in it is not a portfolio, whatever else it says.
    if (!Object.keys(holdings).length) return null
    return {
      holdings,
      debts: numbersOnly(payload.d),
      groupKey: typeof payload.g === 'string' ? payload.g : null,
      dimension: typeof payload.x === 'string' ? payload.x : null,
      periodMode: typeof payload.q === 'string' ? payload.q : null,
      investableOnly: payload.i !== 0,
    }
  } catch {
    return null
  }
}

/* Anything in a URL is a stranger's text, and this one ends up in arithmetic:
   a NaN would propagate into every percentage on the page, and a negative
   holding would produce shares that do not sum to 1. Keys are not checked
   against the taxonomy here -- the views already ignore classes they do not
   know, and a snapshot can gain one. */
function numbersOnly(source) {
  const out = {}
  for (const [key, value] of Object.entries(source && typeof source === 'object' ? source : {})) {
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) out[key] = amount
  }
  return out
}

/* btoa is Latin-1 only and the standard alphabet needs escaping in a URL.
   TextEncoder first (an asset key is ASCII today, but the value of a key is
   not a promise), then the URL-safe alphabet, then drop the padding. */
function base64url(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}
