/* The period scrubber (BACKLOG F46, F69).
 *
 * The claim this control makes is about *when* it commits, not what it shows:
 * each quarter costs a request, and a drag across 147 of them at one request
 * per input event is a hundred and forty requests. That was measured once in a
 * browser; this is the same measurement, kept.
 */

import { screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PeriodScrubber from './PeriodScrubber'
import { PERIODS, renderApp } from '../../tests/harness'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The count of benchmark requests, which is what the drag must not multiply.
 *  Two on load: the latest quarter and the newest complete one. */
const benchmarkCalls = (calls) => calls.filter((url) => url.includes('/api/benchmarks')).length

async function open() {
  const { calls } = renderApp(<PeriodScrubber />)
  const slider = await screen.findByRole('slider')
  await waitFor(() => expect(benchmarkCalls(calls)).toBe(2))
  return { slider, calls }
}

describe('PeriodScrubber', () => {
  /* fireEvent rather than userEvent: a synthetic mouse drag does not move a
     range thumb, which is the same reason the browser check drove it by
     setting the value directly. */
  it('costs nothing until the handle is released', async () => {
    const { slider, calls } = await open()

    for (const index of [0, 1, 2]) {
      fireEvent.change(slider, { target: { value: String(index) } })
    }

    expect(slider).toHaveValue('2')
    expect(benchmarkCalls(calls)).toBe(2)

    fireEvent.pointerUp(slider)
    await waitFor(() => expect(benchmarkCalls(calls)).toBe(3))
    expect(calls.at(-1)).toContain(`period=${PERIODS[2]}`)
  })

  it('says the view has not moved yet while the handle is off its mark', async () => {
    const { slider } = await open()
    const output = screen.getByRole('status')

    fireEvent.change(slider, { target: { value: '0' } })
    expect(output).toHaveTextContent(/release/i)

    fireEvent.pointerUp(slider)
    await waitFor(() => expect(output).not.toHaveTextContent(/release/i))
  })

  /* The newest quarter is 'latest', not its own date: that mode keeps
     following the data as it is refreshed, where a date pins it to a quarter
     that will stop being the newest one. */
  it('returns to latest rather than pinning the newest quarter', async () => {
    const { slider, calls } = await open()

    fireEvent.change(slider, { target: { value: '0' } })
    fireEvent.pointerUp(slider)
    await waitFor(() => expect(benchmarkCalls(calls)).toBe(3))

    fireEvent.change(slider, { target: { value: String(PERIODS.length - 1) } })
    fireEvent.pointerUp(slider)

    // 'latest' is already held, so coming back to it costs no request at all.
    await waitFor(() => expect(slider).toHaveValue(String(PERIODS.length - 1)))
    expect(benchmarkCalls(calls)).toBe(3)
  })

  it('commits a keyboard step, which is a deliberate one', async () => {
    const { slider, calls } = await open()

    fireEvent.change(slider, { target: { value: '1' } })
    fireEvent.keyUp(slider, { key: 'ArrowLeft' })

    await waitFor(() => expect(benchmarkCalls(calls)).toBe(3))
    expect(calls.at(-1)).toContain(`period=${PERIODS[1]}`)
  })
})
