/* The client's own arithmetic (BACKLOG F69).
 *
 * Everything here is a pure function over plain objects, and until now the only
 * thing checking any of it was opening the app and looking. Two of these
 * functions shipped a bug that only showed up offline, because the API sends
 * shares where the embedded snapshot sends dollars -- the "normalises either
 * form" cases below are that bug, written down.
 *
 * lib/analysis.js mirrors backend/app/services/allocation.py. Where a rule
 * exists on both sides, the test names the rule rather than the implementation,
 * so it reads as a statement about the product.
 */

import { describe, expect, it } from 'vitest'

import {
  analyse,
  benchmarkWeights,
  computeGaps,
  cosineSimilarity,
  debtWeights,
  placeByThreshold,
  portfolioWeights,
  rebalanceMoves,
  sensitivity,
  shapeMetrics,
} from './analysis'

/** A group as the API sends it: `assets` are already shares. */
const apiGroup = {
  key: 'top1',
  label: 'Top 1%',
  period: '2026-01-01',
  complete: true,
  total_assets: 1_000_000,
  total_liabilities: 100_000,
  household_count: 10,
  assets: { corporate_equities: 0.5, real_estate: 0.2, consumer_durables: 0.1, unallocated: 0.2 },
  liabilities: { home_mortgages: 0.8, consumer_credit: 0.2 },
}

/** The same group as the embedded snapshot sends it: raw dollars. */
const offlineGroup = {
  ...apiGroup,
  assets: { corporate_equities: 500_000, real_estate: 200_000, consumer_durables: 100_000, unallocated: 200_000 },
  liabilities: { home_mortgages: 80_000, consumer_credit: 20_000 },
}

describe('benchmarkWeights', () => {
  it('normalises either form to the same shares', () => {
    // Compared key by key rather than deep-equal: the two divide by different
    // denominators to reach the same fraction, so they agree to within
    // floating point and not to the last bit.
    const fromApi = benchmarkWeights(apiGroup)
    const fromSnapshot = benchmarkWeights(offlineGroup)
    expect(Object.keys(fromApi).sort()).toEqual(Object.keys(fromSnapshot).sort())
    for (const [key, share] of Object.entries(fromApi)) {
      expect(share).toBeCloseTo(fromSnapshot[key], 12)
    }
  })

  it('drops the non-investable classes and the residual, then renormalises', () => {
    const w = benchmarkWeights(apiGroup, { investableOnly: true })
    expect(Object.keys(w).sort()).toEqual(['corporate_equities', 'real_estate'])
    expect(w.corporate_equities + w.real_estate).toBeCloseTo(1)
    expect(w.corporate_equities).toBeCloseTo(5 / 7)
  })

  it('keeps the residual in an incomplete quarter', () => {
    // It is holding classes the Fed has not published, so dropping it would
    // renormalise the rest upward and overstate every one of them.
    const w = benchmarkWeights({ ...apiGroup, complete: false }, { investableOnly: true })
    expect(w.unallocated).toBeGreaterThan(0)
  })

  it('returns nothing for a group with no assets rather than a row of zeros', () => {
    expect(benchmarkWeights({ ...apiGroup, assets: {} })).toEqual({})
  })
})

describe('debtWeights', () => {
  it('normalises either form to the same shares', () => {
    expect(debtWeights(apiGroup)).toEqual(debtWeights(offlineGroup))
    expect(debtWeights(apiGroup).home_mortgages).toBeCloseTo(0.8)
  })

  it('is empty for a group that owes nothing', () => {
    // Which is a different statement from owing nothing of any one kind.
    expect(debtWeights({ ...apiGroup, liabilities: {} })).toEqual({})
    expect(debtWeights({ ...apiGroup, liabilities: undefined })).toEqual({})
  })
})

describe('portfolioWeights', () => {
  it('ignores zero and negative lines', () => {
    expect(portfolioWeights({ a: 50, b: 50, c: 0, d: -10 })).toEqual({ a: 0.5, b: 0.5 })
  })

  it('has no answer for an empty portfolio', () => {
    expect(portfolioWeights({})).toEqual({})
    expect(portfolioWeights({ a: 0 })).toEqual({})
  })
})

describe('cosineSimilarity', () => {
  it('is 1 for the same mix at any scale', () => {
    expect(cosineSimilarity({ a: 0.5, b: 0.5 }, { a: 0.25, b: 0.25 })).toBeCloseTo(1)
  })

  it('is 0 when the two share nothing', () => {
    expect(cosineSimilarity({ a: 1 }, { b: 1 })).toBe(0)
  })

  it('is 0 rather than NaN when one side is empty', () => {
    expect(cosineSimilarity({}, { a: 1 })).toBe(0)
  })
})

describe('computeGaps', () => {
  const gaps = computeGaps({ a: 0.6, b: 0.4 }, { a: 0.5, b: 0.5 }, { a: 'A', b: 'B' })

  it('reports the difference in percentage points, biggest first', () => {
    expect(gaps[0].gap_pp).toBeCloseTo(10)
    expect(gaps[1].gap_pp).toBeCloseTo(-10)
  })

  it('calls a difference inside the tolerance in line', () => {
    const small = computeGaps({ a: 0.505, b: 0.495 }, { a: 0.5, b: 0.5 }, {})
    expect(small.every((g) => g.status === 'in_line')).toBe(true)
  })
})

describe('shapeMetrics', () => {
  const liquid = new Set(['corporate_equities'])

  it('measures leverage against the whole balance sheet, not the investable part', () => {
    // Liabilities are owed against everything owned; dividing by an
    // investable-only subtotal would overstate the ratio for every tier.
    const m = shapeMetrics(apiGroup, benchmarkWeights(apiGroup, { investableOnly: true }), liquid)
    expect(m.leverage).toBeCloseTo(0.1)
  })

  it('names the largest class, not just its share', () => {
    const m = shapeMetrics(apiGroup, benchmarkWeights(apiGroup, { investableOnly: true }), liquid)
    expect(m.concentrationClass).toBe('corporate_equities')
    expect(m.concentration).toBeCloseTo(5 / 7)
  })

  it('answers null rather than zero when there is nothing to measure', () => {
    // A tier with no assets has no meaningful leverage, and 0.0 would read as
    // "no debt" when the truth is "no answer".
    const m = shapeMetrics({ ...apiGroup, total_assets: 0 }, {}, liquid)
    expect(m.leverage).toBeNull()
    expect(m.concentration).toBeNull()
    expect(m.liquidity).toBeNull()
  })
})

describe('placeByThreshold', () => {
  const groups = {
    next40: { key: 'next40', threshold: { value: 241_362, period: '2022-07-01' } },
    next9: { key: 'next9', threshold: { value: 2_148_339, period: '2022-07-01' } },
    top1: { key: 'top1', threshold: { value: 11_146_846, period: '2022-07-01' } },
    bottom50: { key: 'bottom50', threshold: null },
  }

  it('picks the highest band the figure clears', () => {
    expect(placeByThreshold(groups, 3_000_000).group.key).toBe('next9')
    expect(placeByThreshold(groups, 3_000_000).next.key).toBe('top1')
    expect(placeByThreshold(groups, 3_000_000).toNext).toBeCloseTo(11_146_846 - 3_000_000)
  })

  it('places nothing below the lowest threshold', () => {
    // The bottom group publishes no floor, so there is nothing to place
    // against and inventing one would be inventing a fact.
    const below = placeByThreshold(groups, 50_000)
    expect(below.group).toBeNull()
    expect(below.next.key).toBe('next40')
  })

  it('has no answer above the top band beyond naming it', () => {
    const top = placeByThreshold(groups, 50_000_000)
    expect(top.group.key).toBe('top1')
    expect(top.next).toBeNull()
    expect(top.toNext).toBeNull()
  })

  it('declines to place a figure of zero or less', () => {
    expect(placeByThreshold(groups, 0)).toBeNull()
    expect(placeByThreshold(groups, -5)).toBeNull()
  })

  it('declines when no group publishes a threshold at all', () => {
    expect(placeByThreshold({ a: { key: 'a', threshold: null } }, 1000)).toBeNull()
  })
})

describe('rebalanceMoves', () => {
  const gaps = [
    { asset_class: 'real_estate', label: 'Real Estate', gap_pp: 30, status: 'overweight' },
    { asset_class: 'deposits', label: 'Cash', gap_pp: 10, status: 'overweight' },
    { asset_class: 'corporate_equities', label: 'Stocks', gap_pp: -35, status: 'underweight' },
    { asset_class: 'bonds', label: 'Bonds', gap_pp: -5, status: 'underweight' },
    { asset_class: 'annuities', label: 'Annuities', gap_pp: 0.4, status: 'in_line' },
  ]

  it('moves half the sum of the gaps, not all of it', () => {
    // A dollar closes an overweight and an underweight at once; counting it
    // twice would double the distance.
    const { distance } = rebalanceMoves(gaps, 1_000_000)
    expect(distance).toBeCloseTo(400_000)
  })

  it('pairs the largest surplus with the largest deficit', () => {
    const { moves } = rebalanceMoves(gaps, 1_000_000)
    expect(moves[0].from.key).toBe('real_estate')
    expect(moves[0].to.key).toBe('corporate_equities')
    expect(moves[0].amount).toBeCloseTo(300_000)
  })

  it('leaves gaps inside the tolerance alone', () => {
    const { moves } = rebalanceMoves(gaps, 1_000_000)
    expect(moves.flatMap((m) => [m.from.key, m.to.key])).not.toContain('annuities')
  })

  it('has nothing to say about an empty portfolio', () => {
    expect(rebalanceMoves(gaps, 0)).toEqual({ moves: [], distance: 0 })
  })

  it('has nothing to say when every class is in line', () => {
    expect(rebalanceMoves([gaps[4]], 1_000_000).moves).toEqual([])
  })
})

describe('sensitivity', () => {
  const user = { a: 0.8, b: 0.1, c: 0.1 }
  const bench = { a: 0.3, b: 0.4, c: 0.3 }

  it('ranks the single change that closes the most distance', () => {
    const ranked = sensitivity(user, bench)
    expect(ranked[0].asset_class).toBe('a')
    expect(ranked[0].gain).toBeGreaterThan(0)
  })

  it('reports only changes that improve the match', () => {
    expect(sensitivity(user, bench).every((r) => r.gain > 0)).toBe(true)
  })

  it('has nothing to suggest for a portfolio already on the benchmark', () => {
    expect(sensitivity(bench, bench)).toEqual([])
  })
})

describe('analyse', () => {
  const groups = {
    top1: apiGroup,
    next9: { ...apiGroup, key: 'next9', label: 'Next 9%', assets: { corporate_equities: 0.3, real_estate: 0.7 } },
    top01: { ...apiGroup, key: 'top01', label: 'Top 0.1%', nested: true },
  }

  it('drops non-investable holdings from the user side too', () => {
    // Otherwise a car shows as an overweight against a benchmark that no
    // longer counts cars at all.
    const result = analyse({ corporate_equities: 900, consumer_durables: 100 }, { groups, groupKey: 'top1' })
    expect(result.portfolio_total).toBe(900)
    expect(result.excluded_value).toBe(100)
    expect(result.user_weights.consumer_durables).toBeUndefined()
  })

  it('never ranks a nested tier as the nearest', () => {
    // The top 0.1% is inside the top 1%; ranking both would put two
    // overlapping populations in one list.
    const result = analyse({ corporate_equities: 1000 }, { groups, groupKey: 'top1' })
    expect(result.nearest_tier.ranked.map((r) => r.group)).not.toContain('top01')
  })

  it('has no nearest tier for an empty portfolio', () => {
    expect(analyse({}, { groups, groupKey: 'top1' }).nearest_tier).toBeNull()
  })

  it('relabels the residual in an incomplete quarter instead of judging it', () => {
    // "Underweight not-yet-published" is not a verdict anyone can act on.
    const incomplete = {
      ...groups,
      top1: { ...apiGroup, complete: false, unavailable: ['private_business'] },
    }
    const result = analyse({ corporate_equities: 1000 }, { groups: incomplete, groupKey: 'top1' })
    const residual = result.gaps.find((g) => g.asset_class === 'unallocated')
    expect(residual.status).toBe('pending')
  })
})
