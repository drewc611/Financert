/* The "you are looking at a what if" banner (BACKLOG F38, F69).
 *
 * The banner's job is that a draft cannot be mistaken for the portfolio, and
 * that its three exits stay three different acts. AppDataContext.test.jsx
 * covers what each act does to storage; this covers that the banner offers
 * them, and that it disappears when there is nothing to warn about.
 */

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ScenarioBar from './ScenarioBar'
import { useAppData } from '../context/AppDataContext'
import { renderApp, storedHoldings } from '../../tests/harness'
/* The bundle rather than the English strings themselves: what is being tested
   is that the banner offers these three acts, not how they are worded this
   week. Rewriting the copy should not turn a test red. */
import en from '../i18n/locales/en.json'

const MINE = { corporate_equities: 100_000, real_estate: 300_000 }

afterEach(() => {
  vi.unstubAllGlobals()
})

function Start() {
  const { startScenario } = useAppData()
  return (
    <button type="button" onClick={startScenario}>
      start
    </button>
  )
}

async function open({ start = true } = {}) {
  renderApp(
    <>
      <Start />
      <ScenarioBar />
    </>,
    { holdings: MINE },
  )
  const user = userEvent.setup()
  if (start) {
    await user.click(await screen.findByText('start'))
    await screen.findByRole('status')
  }
  return user
}

describe('ScenarioBar', () => {
  it('stays out of the way when there is no draft', async () => {
    await open({ start: false })
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  /* role="status" rather than a plain div: a draft changes every number on
     every page, and someone who cannot see the banner still has to be told
     they are in one. */
  it('announces the draft and what it is worth', async () => {
    await open()
    const bar = screen.getByRole('status')

    expect(bar).toHaveTextContent(en.scenario.unsaved)
    // $400K, the two holdings it started from.
    expect(bar).toHaveTextContent(/400/)
  })

  it('offers the three exits, and they stay separate', async () => {
    await open()
    const bar = screen.getByRole('status')

    for (const action of [en.scenario.save, en.scenario.apply, en.scenario.discard]) {
      expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
    }
    expect(bar.querySelectorAll('button')).toHaveLength(3)
  })

  it('takes a name for the draft and keeps showing it', async () => {
    const user = await open()

    await user.type(screen.getByRole('textbox'), 'Sell the house')
    await user.click(screen.getByRole('button', { name: en.scenario.save }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sell the house'))
    // Naming a draft is not adopting it.
    expect(storedHoldings()).toEqual(MINE)
    // The field is cleared, so the next save does not re-use the typed name.
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('goes away when the draft is discarded', async () => {
    const user = await open()
    await user.click(screen.getByRole('button', { name: en.scenario.discard }))

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})
