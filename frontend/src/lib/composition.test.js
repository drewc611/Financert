/* Bands for the composition charts (BACKLOG F42, F43). */

import { describe, expect, it } from 'vitest'

import { bandKeys, bands, OTHER } from './composition'

const QUARTER = { corporate_equities: 0.5, real_estate: 0.2, pension: 0.15, deposits: 0.1, annuities: 0.05 }

describe('bandKeys', () => {
  it('ranks by total share across every mix, largest first', () => {
    expect(bandKeys([QUARTER], { limit: 3 })).toEqual(['corporate_equities', 'real_estate', 'pension', OTHER])
  })

  it('adds no OTHER when nothing is left over', () => {
    expect(bandKeys([QUARTER], { limit: 5 })).not.toContain(OTHER)
    expect(bandKeys([QUARTER], { limit: 9 })).toHaveLength(5)
  })

  it('cuts by the whole history, not by the last quarter', () => {
    /* A class that was large for decades and is small now keeps its own band.
       Ranking on the newest quarter would fold it into "other" at exactly the
       point the chart is about. */
    const old = { private_business: 0.9, corporate_equities: 0.1 }
    const recent = { private_business: 0.05, corporate_equities: 0.95 }
    // 1.85 against 1.15 over these three quarters, though the last one says
    // the opposite.
    expect(bandKeys([old, old, recent], { limit: 1 })).toEqual(['private_business', OTHER])
    expect(bandKeys([recent], { limit: 1 })).toEqual(['corporate_equities', OTHER])
  })
})

describe('bands', () => {
  it('stacks in the order given, with no gaps', () => {
    const keys = ['corporate_equities', 'real_estate']
    const out = bands(QUARTER, [...keys, OTHER])
    expect(out.map((b) => b.key)).toEqual([...keys, OTHER])
    expect(out[0]).toMatchObject({ from: 0, to: 0.5 })
    expect(out[1]).toMatchObject({ from: 0.5, to: 0.7 })
    // Every class the mix has is in a band: the top of the stack is the whole
    // mix, so a stacked area never shows a gap the data does not have.
    expect(out.at(-1).to).toBeCloseTo(1, 10)
  })

  it('collects everything outside the kept keys into OTHER', () => {
    const out = bands(QUARTER, ['corporate_equities', OTHER])
    expect(out[1].share).toBeCloseTo(0.5, 10)
  })

  it('gives a missing class a zero band rather than dropping it', () => {
    // The bands have to line up across quarters, and a quarter that predates
    // a class still needs its slot.
    const out = bands({ corporate_equities: 1 }, ['corporate_equities', 'pension'])
    expect(out[1]).toMatchObject({ share: 0, from: 1, to: 1 })
  })
})
