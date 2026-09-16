/* Saved "what if" portfolios (BACKLOG F38, F39).
 *
 * Worth testing because everything here comes back out of a store anything on
 * the origin could have written, and its numbers end up in the arithmetic
 * behind every percentage on the page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_SCENARIOS, readScenarios, remove, suggestName, upsert, writeScenarios } from './scenarios'

const A = { name: 'All in equities', holdings: { corporate_equities: 500000 }, debts: {} }
const B = { name: 'Sell the house', holdings: { deposits: 400000 }, debts: { consumer_credit: 1000 } }

/* The tests run in node, where there is no localStorage, and a DOM
   implementation would be a dependency for one API with four methods. This is
   that API, which also makes the contract the module relies on explicit. */
function memoryStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('localStorage', memoryStorage())
})

describe('upsert', () => {
  it('puts the newest first', () => {
    expect(upsert(upsert([], A), B).map((s) => s.name)).toEqual(['Sell the house', 'All in equities'])
  })

  it('replaces by name rather than duplicating', () => {
    const list = upsert(upsert([], A), { ...A, holdings: { deposits: 1 } })
    expect(list).toHaveLength(1)
    expect(list[0].holdings).toEqual({ deposits: 1 })
  })

  it('refuses a scenario with no name or no holdings', () => {
    expect(upsert([], { ...A, name: '   ' })).toEqual([])
    expect(upsert([], { ...A, holdings: {} })).toEqual([])
  })

  it('keeps the list bounded', () => {
    let list = []
    for (let i = 0; i < MAX_SCENARIOS + 5; i += 1) list = upsert(list, { ...A, name: `s${i}` })
    expect(list).toHaveLength(MAX_SCENARIOS)
    // The ones kept are the newest.
    expect(list[0].name).toBe(`s${MAX_SCENARIOS + 4}`)
  })
})

describe('readScenarios', () => {
  it('round-trips through storage', () => {
    writeScenarios([A, B])
    expect(readScenarios().map((s) => s.name)).toEqual(['All in equities', 'Sell the house'])
  })

  it.each([
    ['not JSON', 'nonsense{'],
    ['not a list', '{"name":"x"}'],
    ['a list of junk', '[3, null, "x"]'],
  ])('reads %s as nothing rather than throwing', (_name, raw) => {
    localStorage.setItem('financert.scenarios.v1', raw)
    expect(readScenarios()).toEqual([])
  })

  it('drops values that are not positive numbers', () => {
    localStorage.setItem(
      'financert.scenarios.v1',
      JSON.stringify([{ name: 'odd', holdings: { corporate_equities: 100, real_estate: 'lots', pension: -5 } }]),
    )
    expect(readScenarios()[0].holdings).toEqual({ corporate_equities: 100 })
  })

  it('survives storage being switched off', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    expect(readScenarios()).toEqual([])
    expect(writeScenarios([A])).toBe(false)
  })
})

describe('suggestName', () => {
  it('leaves a free name alone', () => {
    expect(suggestName([A], 'Scenario')).toBe('Scenario')
  })

  it('counts up rather than replacing what is there', () => {
    const list = [{ ...A, name: 'Scenario' }, { ...A, name: 'Scenario 2' }]
    expect(suggestName(list, 'Scenario')).toBe('Scenario 3')
  })
})

describe('remove', () => {
  it('takes one out by name and leaves the rest', () => {
    expect(remove(upsert(upsert([], A), B), 'Sell the house').map((s) => s.name)).toEqual(['All in equities'])
  })
})
