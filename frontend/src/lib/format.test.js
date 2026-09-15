/* The formatters, which are where a locale bug hides in plain sight: every
 * number renders, just wrongly. These assert the properties the product needs
 * -- a dash for no answer, the separators moving with the locale, dollars
 * staying dollars -- rather than exact strings, which move with ICU data.
 */

import { describe, expect, it } from 'vitest'

import { num, pct, pp, quarterLabel, usd } from './format'

const DASH = '—'

describe('usd', () => {
  it('is a dash when there is no answer', () => {
    // Not "$0": a tier with nothing measured is not a tier holding nothing.
    expect(usd(null)).toBe(DASH)
    expect(usd(undefined)).toBe(DASH)
    expect(usd(Number.NaN)).toBe(DASH)
    expect(usd(0)).not.toBe(DASH)
  })

  it('stays in dollars in every locale', () => {
    // The Fed's figures are dollars; converting them would invent an exchange
    // rate the source has no opinion on.
    for (const locale of ['en', 'de', 'fr', 'es', 'pt', 'ar']) {
      expect(usd(1234, { locale })).toMatch(/\$|US\$|USD/)
    }
  })

  it('moves the separators with the locale', () => {
    expect(usd(1234567, { locale: 'en' })).toContain(',')
    expect(usd(1234567, { locale: 'de' })).toContain('.')
  })

  it('signs a figure only when asked', () => {
    expect(usd(1234, { signed: true })).toContain('+')
    expect(usd(1234)).not.toContain('+')
    expect(usd(0, { signed: true })).not.toContain('+')
    expect(usd(-1234, { signed: true })).toContain('-')
  })

  it('compacts large figures', () => {
    expect(usd(55_000_000_000_000, { compact: true }).length).toBeLessThan(12)
  })
})

describe('pct', () => {
  it('is a dash when there is no answer', () => {
    expect(pct(null)).toBe(DASH)
    expect(pct(Number.NaN)).toBe(DASH)
  })

  it('takes a fraction, not a percentage', () => {
    expect(pct(0.5, { locale: 'en' })).toBe('50.0%')
  })
})

describe('pp', () => {
  it('keeps the sign, because a gap is a direction', () => {
    expect(pp(3.2)).toContain('+')
    expect(pp(-3.2)).toContain('-')
  })

  it('is a dash when there is no answer', () => {
    expect(pp(null)).toBe(DASH)
  })
})

describe('num', () => {
  it('is a dash when there is no answer', () => {
    expect(num(null)).toBe(DASH)
  })

  it('keeps the digits it is asked for', () => {
    expect(num(0.5, { locale: 'en' })).toBe('0.50')
    expect(num(0.5, { locale: 'en', digits: 4 })).toBe('0.5000')
  })
})

describe('quarterLabel', () => {
  it('reads a period start date as its quarter', () => {
    const template = 'Q{q} {year}'
    expect(quarterLabel('2026-01-01', { template })).toBe('Q1 2026')
    expect(quarterLabel('2026-04-01', { template })).toBe('Q2 2026')
    expect(quarterLabel('2026-07-01', { template })).toBe('Q3 2026')
    expect(quarterLabel('2026-10-01', { template })).toBe('Q4 2026')
  })

  it("follows the locale's own template", () => {
    // The quarter marker is not universal -- French writes T1, German Q1 --
    // so the label is assembled from a translated template rather than
    // hardcoded.
    expect(quarterLabel('2026-01-01', { template: 'T{q} {year}' })).toBe('T1 2026')
  })
})
