/* The provenance marker (BACKLOG F56, F69).
 *
 * Two of these behaviours are here because a browser found them and nothing
 * else would have: the marker sits inside the <label> of a holdings field, so
 * without preventDefault opening it puts the cursor in the box beside it; and
 * the panel is portalled to <body>, because a fixed element is still painted
 * inside its ancestors' stacking context and the pinned first column is one.
 */

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SourceNote from './SourceNote'
import { renderApp } from '../../tests/harness'

afterEach(() => {
  vi.unstubAllGlobals()
})

const COLUMNS = ['Checkable deposits and currency', 'Time deposits']

/** As it is actually used: inside the label of a field, which is the whole
 *  reason the click handler calls preventDefault. */
function Field() {
  return (
    <label>
      Deposits
      <SourceNote label="Deposits" columns={COLUMNS} blurb="Cash and near-cash." />
      <input type="number" />
    </label>
  )
}

async function open() {
  renderApp(<Field />)
  const marker = await screen.findByRole('button')
  return { marker, user: userEvent.setup() }
}

describe('SourceNote', () => {
  it('names the published columns the bucket sums', async () => {
    const { marker, user } = await open()
    await user.click(marker)

    const note = await screen.findByRole('note')
    for (const column of COLUMNS) expect(note).toHaveTextContent(column)
    // The file it was read from and when, which is the other half of a trace.
    expect(note).toHaveTextContent('dfa-networth-levels.csv')
    expect(note).toHaveTextContent('2026-01-05')
  })

  /* The bug this exists for: a click on anything inside a <label> is forwarded
     to the field it labels. */
  it('does not put the cursor in the field it sits beside', async () => {
    const { marker, user } = await open()
    await user.click(marker)

    await screen.findByRole('note')
    expect(screen.getByRole('spinbutton')).not.toHaveFocus()
  })

  /* Portalled out of the table, so it cannot be clipped by the horizontal
     scroller or painted behind the pinned column. */
  it('renders outside the table it was opened from', async () => {
    const { marker, user } = await open()
    await user.click(marker)

    const note = await screen.findByRole('note')
    expect(note.parentElement).toBe(document.body)
    expect(note.closest('label')).toBeNull()
  })

  it('says whether it is open', async () => {
    const { marker, user } = await open()
    expect(marker).toHaveAttribute('aria-expanded', 'false')

    await user.click(marker)
    await waitFor(() => expect(marker).toHaveAttribute('aria-expanded', 'true'))
    expect(marker).toHaveAttribute('aria-controls', screen.getByRole('note').id)
  })

  it('closes on Escape', async () => {
    const { marker, user } = await open()
    await user.click(marker)
    await screen.findByRole('note')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
  })

  /* A bucket with no published columns has nothing to say, and a marker that
     opens an empty panel is worse than no marker. */
  it('is absent when there is nothing to cite', async () => {
    renderApp(<SourceNote label="Deposits" columns={[]} />)
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
  })
})
