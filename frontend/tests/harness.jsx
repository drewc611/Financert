/* Rendering a component with the app around it (BACKLOG F69).
 *
 * Every component worth testing here reads the two contexts -- translations and
 * the portfolio -- so each test would otherwise rebuild the same two providers
 * and the same fake API.
 *
 * The API is faked at `fetch` rather than by mocking src/lib/api.js, for two
 * reasons: vi.mock is hoisted per file and so cannot live in a helper at all,
 * and stubbing the boundary the browser actually has keeps api.js itself --
 * its query strings, its timeout, its error shape -- inside what is under test.
 */

import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { AppDataProvider } from '../src/context/AppDataContext'
import { I18nProvider } from '../src/i18n'

/* Two groups and four classes: enough for a gap to have a sign, an allocation
   to have an order, and a scenario to differ from a portfolio. The field names
   are the API's own -- this fixture is the response contract, so a rename on
   the backend should break these tests rather than pass silently. */
const CLASSES = [
  { key: 'corporate_equities', label: 'Corporate equities', columns: ['Corporate equities'] },
  { key: 'real_estate', label: 'Real estate', columns: ['Real estate'] },
  { key: 'pension', label: 'Pension entitlements', columns: ['Pension entitlements'] },
  { key: 'deposits', label: 'Deposits', columns: ['Checkable deposits and currency', 'Time deposits'] },
]

const LIABILITY_CLASSES = [
  { key: 'home_mortgages', label: 'Home mortgages', columns: ['Home mortgages'] },
  { key: 'consumer_credit', label: 'Consumer credit', columns: ['Consumer credit'] },
]

export const PERIODS = ['2023-01-01', '2023-04-01', '2023-07-01', '2023-10-01']

function allocation(group, label, weights, period) {
  return {
    group,
    label,
    percentile_range: group === 'top1' ? 'Top 1%' : '50-90%',
    nested: false,
    nested_in: null,
    threshold: null,
    period,
    complete: true,
    unavailable: [],
    total_assets: 1_000_000,
    total_liabilities: 200_000,
    net_worth: 800_000,
    household_count: 1_200_000,
    weights,
    debt_weights: { home_mortgages: 0.8, consumer_credit: 0.2 },
  }
}

function benchmarksBody(period) {
  return {
    source: { name: 'DFA', retrieved_via: 'dfa-networth-levels.csv', retrieved_at: '2026-01-05T00:00:00' },
    period,
    periods: PERIODS,
    group_order: ['top1', 'next40'],
    dimension: 'networth',
    dimensions: [{ key: 'networth', label: 'Net worth' }],
    asset_classes: CLASSES,
    liability_classes: LIABILITY_CLASSES,
    allocations: [
      allocation('top1', 'Top 1%', { corporate_equities: 0.5, real_estate: 0.2, pension: 0.2, deposits: 0.1 }, period),
      allocation('next40', 'Next 40%', { corporate_equities: 0.2, real_estate: 0.5, pension: 0.2, deposits: 0.1 }, period),
    ],
  }
}

function json(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

/** Routes on the path alone; the provider is the only caller and it asks for
 *  the same four things in every test. */
export function stubApi() {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      calls.push(String(url))
      const path = String(url)
      if (path.includes('/api/benchmarks')) {
        return json(benchmarksBody(path.includes('period=complete') ? PERIODS[2] : PERIODS[3]))
      }
      if (path.includes('/api/portfolios')) return json([])
      // 404, which is what a browser with nothing saved server-side gets.
      if (path.includes('/api/portfolio')) {
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ detail: 'not found' }) })
      }
      return Promise.reject(new Error(`unstubbed request: ${path}`))
    }),
  )
  return calls
}

/** Seeds this browser's storage, since the provider reads it before it renders
 *  anything. Anything not named is cleared, so one test cannot leak into the
 *  next through the store. */
export function seedStorage({ holdings, debts, scenarios } = {}) {
  localStorage.clear()
  if (holdings) localStorage.setItem('financert.holdings.v1', JSON.stringify(holdings))
  if (debts) localStorage.setItem('financert.debts.v1', JSON.stringify(debts))
  if (scenarios) localStorage.setItem('financert.scenarios.v1', JSON.stringify(scenarios))
}

export function renderApp(ui, { holdings, debts, scenarios } = {}) {
  seedStorage({ holdings, debts, scenarios })
  const calls = stubApi()
  const result = render(
    <I18nProvider>
      <AppDataProvider>{ui}</AppDataProvider>
    </I18nProvider>,
  )
  return { ...result, calls }
}

/** What the store actually holds, which is the thing a scenario must not
 *  change until it is applied. */
export function storedHoldings() {
  return JSON.parse(localStorage.getItem('financert.holdings.v1') ?? 'null')
}
