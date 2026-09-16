/* The portfolio state, and the one rule it has to keep (BACKLOG F38, F69).
 *
 * A draft is a question -- "what if the house money were in equities" -- and
 * asking it must not be the same act as recording that you did. That rule was
 * broken once already, in a way no unit test could have seen: edits were
 * applied to the draft *and* to the portfolio, with the storage effect relying
 * on skipping the write while a draft was open. The in-memory copy is what gets
 * persisted the moment the draft closes, so discarding a scenario kept its
 * edits. It took a browser to find. These are the tests that would have.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppDataProvider, useAppData } from './AppDataContext'
import { I18nProvider } from '../i18n'
import { seedStorage, stubApi, storedHoldings } from '../../tests/harness'

const MINE = { corporate_equities: 100_000, real_estate: 300_000 }

function Probe() {
  const { mode, holdings, savedHoldings, setHolding, clearHoldings, scenario, scenarios } = useAppData()
  const { startScenario, discardScenario, applyScenario, saveScenario } = useAppData()
  return (
    <div>
      <output data-testid="mode">{mode}</output>
      <output data-testid="shown">{JSON.stringify(holdings)}</output>
      <output data-testid="saved">{JSON.stringify(savedHoldings)}</output>
      <output data-testid="kept">{scenarios.map((s) => s.name).join(',')}</output>
      <output data-testid="draft">{scenario ? scenario.name || '(unnamed)' : 'none'}</output>
      <button onClick={startScenario}>start</button>
      <button onClick={() => setHolding('corporate_equities', 900_000)}>edit</button>
      <button onClick={() => setHolding('corporate_equities', '')}>zero</button>
      <button onClick={clearHoldings}>clear</button>
      <button onClick={discardScenario}>discard</button>
      <button onClick={applyScenario}>apply</button>
      <button onClick={() => saveScenario('Try it')}>save</button>
    </div>
  )
}

/** Renders the probe and waits for the provider to finish its opening fetch,
 *  so no assertion races a state update the page has not had yet. */
async function open(holdings = MINE) {
  seedStorage({ holdings })
  stubApi()
  render(
    <I18nProvider>
      <AppDataProvider>
        <Probe />
      </AppDataProvider>
    </I18nProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('live'))
  return userEvent.setup()
}

const shown = () => JSON.parse(screen.getByTestId('shown').textContent)
const saved = () => JSON.parse(screen.getByTestId('saved').textContent)

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a draft is separate from the portfolio', () => {
  it('shows the draft while leaving the portfolio as it was', async () => {
    const user = await open()
    await user.click(screen.getByText('start'))
    await user.click(screen.getByText('edit'))

    expect(shown()).toEqual({ corporate_equities: 900_000, real_estate: 300_000 })
    expect(saved()).toEqual(MINE)
    expect(storedHoldings()).toEqual(MINE)
  })

  /* The regression test for the bug above. It passed the old code's *first*
     assertion too -- the portfolio only came back wrong once the draft closed,
     which is why this one goes all the way to the discard. */
  it('throws the edits away with the draft', async () => {
    const user = await open()
    await user.click(screen.getByText('start'))
    await user.click(screen.getByText('edit'))
    await user.click(screen.getByText('discard'))

    expect(screen.getByTestId('draft')).toHaveTextContent('none')
    expect(shown()).toEqual(MINE)
    await waitFor(() => expect(storedHoldings()).toEqual(MINE))
  })

  it('clears only the draft', async () => {
    const user = await open()
    await user.click(screen.getByText('start'))
    await user.click(screen.getByText('clear'))

    expect(shown()).toEqual({})
    expect(storedHoldings()).toEqual(MINE)

    await user.click(screen.getByText('discard'))
    await waitFor(() => expect(storedHoldings()).toEqual(MINE))
  })

  it('keeps a scenario without making it the portfolio', async () => {
    const user = await open()
    await user.click(screen.getByText('start'))
    await user.click(screen.getByText('edit'))
    await user.click(screen.getByText('save'))

    expect(screen.getByTestId('kept')).toHaveTextContent('Try it')
    // Still open, and still not the portfolio: saving names a draft, it does
    // not close it or adopt it.
    expect(screen.getByTestId('draft')).toHaveTextContent('Try it')
    expect(storedHoldings()).toEqual(MINE)
  })

  it('overwrites the portfolio only when the draft is applied', async () => {
    const user = await open()
    await user.click(screen.getByText('start'))
    await user.click(screen.getByText('edit'))
    await user.click(screen.getByText('apply'))

    expect(screen.getByTestId('draft')).toHaveTextContent('none')
    await waitFor(() =>
      expect(storedHoldings()).toEqual({ corporate_equities: 900_000, real_estate: 300_000 }),
    )
  })
})

describe('edits outside a draft', () => {
  it('are written straight to storage', async () => {
    const user = await open()
    await user.click(screen.getByText('edit'))

    await waitFor(() =>
      expect(storedHoldings()).toEqual({ corporate_equities: 900_000, real_estate: 300_000 }),
    )
  })

  /* Emptying a field is how the form removes a class. Storing it as 0 instead
     would leave a class with no money in it in the weights, and every
     percentage on the page is computed over the classes present. */
  it('drop a class whose field is emptied rather than storing a zero', async () => {
    const user = await open({ corporate_equities: 100_000, deposits: 5_000 })
    await user.click(screen.getByText('zero'))

    expect(shown()).toEqual({ deposits: 5_000 })
    await waitFor(() => expect(storedHoldings()).toEqual({ deposits: 5_000 }))
  })
})
