/* The shareable link (BACKLOG F52).
 *
 * Worth testing rather than eyeballing because the input is a URL: everything
 * decodeShare() reads is a stranger's text that ends up in the arithmetic
 * behind every percentage on the page.
 */

import { describe, expect, it } from 'vitest'

import { decodeShare, encodeShare } from './share'

const STATE = {
  holdings: { corporate_equities: 240000, real_estate: 420000 },
  debts: { home_mortgages: 260000 },
  groupKey: 'top1',
  dimension: 'networth',
  periodMode: 'latest',
  investableOnly: true,
}

describe('encodeShare', () => {
  it('round-trips the comparison on screen', () => {
    expect(decodeShare(encodeShare(STATE))).toEqual(STATE)
  })

  it('produces a fragment, never a query string', () => {
    // The whole privacy argument for this feature: a fragment is not sent in
    // an HTTP request and is stripped from the Referer header, so the numbers
    // never reach anyone's server log.
    const link = encodeShare(STATE)
    expect(link.startsWith('#')).toBe(true)
    expect(link).not.toContain('?')
  })

  it('carries no debt side when there is none', () => {
    const link = encodeShare({ ...STATE, debts: {} })
    expect(decodeShare(link).debts).toEqual({})
    // Shorter link, and "no debts" and "debts not shared" are the same state.
    expect(link.length).toBeLessThan(encodeShare(STATE).length)
  })

  it('survives a URL-safe alphabet', () => {
    // + and / would need escaping in a URL, and = is a delimiter here.
    expect(encodeShare(STATE)).toMatch(/^#p=[A-Za-z0-9_-]+$/)
  })
})

describe('decodeShare', () => {
  it.each([
    ['nothing', ''],
    ['an unrelated fragment', '#section-2'],
    ['a truncated payload', encodeShare(STATE).slice(0, 12)],
    ['a hand-edited payload', '#p=not-base64!!'],
    ['an empty portfolio', encodeShare({ ...STATE, holdings: {} })],
  ])('returns null for %s', (_name, hash) => {
    expect(decodeShare(hash)).toBeNull()
  })

  it('refuses a version it does not know', () => {
    const future = encodeShare(STATE).replace('#p=', '')
    const bumped = btoa(JSON.stringify({ ...JSON.parse(atob(future.replace(/-/g, '+').replace(/_/g, '/'))), v: 99 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(decodeShare(`#p=${bumped}`)).toBeNull()
  })

  it('drops values that are not positive numbers', () => {
    const link = encodeShare({
      ...STATE,
      holdings: { corporate_equities: 240000, real_estate: 'lots', deposits: -5, pension: null },
    })
    expect(decodeShare(link).holdings).toEqual({ corporate_equities: 240000 })
  })

  it('reads a link that sits alongside other fragment parameters', () => {
    const link = `${encodeShare(STATE)}&theme=dark`
    expect(decodeShare(link).holdings).toEqual(STATE.holdings)
  })
})
