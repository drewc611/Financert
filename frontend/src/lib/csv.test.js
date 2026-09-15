import { describe, expect, it } from 'vitest'

import { comparisonRows, toCsv } from './csv'

describe('toCsv', () => {
  it('quotes a field containing a comma, a quote or a newline', () => {
    // Asset labels are translated, and several locales use a comma where
    // English uses a decimal point.
    expect(toCsv([['Stocks, funds']])).toBe('"Stocks, funds"')
    expect(toCsv([['He said "no"']])).toBe('"He said ""no"""')
    expect(toCsv([['two\nlines']])).toBe('"two\nlines"')
  })

  it('leaves a plain field alone', () => {
    expect(toCsv([['Bonds', '0.0410']])).toBe('Bonds,0.0410')
  })

  it('separates rows with CRLF, as the format says', () => {
    expect(toCsv([['a'], ['b']])).toBe('a\r\nb')
  })

  it('writes an empty row as an empty line', () => {
    expect(toCsv([['a'], [], ['b']])).toBe('a\r\n\r\nb')
  })
})

describe('comparisonRows', () => {
  const result = {
    benchmark_group: 'top1',
    period: '2026-01-01',
    portfolio_total: 1_000_000,
    investable_only: true,
    gaps: [
      { asset_class: 'corporate_equities', label: 'Stocks', user_pct: 30, benchmark_pct: 50.3, gap_pp: -20.3, status: 'underweight' },
      { asset_class: 'unallocated', label: 'Pending', user_pct: 0, benchmark_pct: 0, gap_pp: 0, status: 'pending' },
    ],
  }
  const headers = {
    assetClass: 'Asset class', you: 'You', difference: 'Difference', dollars: 'In dollars',
    benchmark: 'Benchmark', period: 'Period', total: 'Portfolio compared',
    investableOnly: 'Investable assets only',
  }
  const rows = comparisonRows(result, { labels: { corporate_equities: 'Aktien' }, benchmarkLabel: 'Top 1%', headers })

  it('names what the file is a comparison of', () => {
    // A spreadsheet three months from now has no other way to know.
    expect(rows[0]).toEqual(['Benchmark', 'Top 1%'])
    expect(rows[1]).toEqual(['Period', '2026-01-01'])
    // TRUE/FALSE rather than the on-screen wording, which is a sentence
    // fragment in several locales and a boolean to a spreadsheet.
    expect(rows[3]).toEqual(['Investable assets only', 'TRUE'])
  })

  it('uses the translated label the reader saw', () => {
    expect(rows.at(-2)[0]).toBe('Aktien')
  })

  it('writes plain decimals, not localised percentages', () => {
    // This is a file for a spreadsheet: "12,3 %" imports as text or as 123.
    expect(rows.at(-2)[1]).toBe('0.3000')
    expect(rows.at(-2)[4]).toBe('-203000.00')
  })

  it('leaves the dollar figure empty for a pending row rather than writing zero', () => {
    expect(rows.at(-1)[4]).toBe('')
  })
})
