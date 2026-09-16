/* The gap chart's keyboard and its honesty about what it plots
 * (BACKLOG F48, F69).
 *
 * The visual baseline (tests/visual) already holds this chart's geometry to the
 * pixel-free equivalent of a pixel. What it cannot see is behaviour: that the
 * whole chart is one tab stop rather than eleven, that the arrows move within
 * it, and that a row with no verdict is not given a bar. The roving tabindex
 * here is the pattern every chart in the app uses.
 */

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import GapChart from './GapChart'
import { renderApp } from '../../tests/harness'

const GAPS = [
  { asset_class: 'corporate_equities', label: 'Corporate equities', user_pct: 25, benchmark_pct: 50, gap_pp: -25, status: 'under' },
  { asset_class: 'real_estate', label: 'Real estate', user_pct: 75, benchmark_pct: 20, gap_pp: 55, status: 'over' },
  { asset_class: 'pension', label: 'Pension entitlements', user_pct: 0, benchmark_pct: 20, gap_pp: -20, status: 'under' },
]

/* One with no verdict and one that matches: neither earns a bar on a diverging
   over/under axis -- the first because the data cannot support one, the second
   because there is nothing to show. */
const PENDING = { asset_class: 'other', label: 'Other', user_pct: 0, benchmark_pct: 0, gap_pp: 0, status: 'pending' }
const IN_LINE = { asset_class: 'deposits', label: 'Deposits', user_pct: 10, benchmark_pct: 10, gap_pp: 0.01, status: 'in_line' }

afterEach(() => {
  vi.unstubAllGlobals()
})

async function open(gaps = GAPS) {
  renderApp(<GapChart gaps={gaps} benchmarkLabel="Top 1%" />)
  const rows = await waitFor(() => {
    const found = screen.getAllByRole('img')
    expect(found.length).toBeGreaterThan(0)
    return found
  })
  return { rows, user: userEvent.setup() }
}

describe('GapChart', () => {
  it('reads each row out, so the chart is not the only way to have it', async () => {
    const { rows } = await open()
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Corporate equities'),
    )
    // Both sides and the difference, which is the whole content of the row.
    expect(rows[0].getAttribute('aria-label')).toMatch(/25/)
    expect(rows[0].getAttribute('aria-label')).toMatch(/50/)
  })

  /* One tab stop for the chart, not one per row: eleven asset classes is
     eleven presses to get past a chart someone is not reading. */
  it('is a single tab stop', async () => {
    const { rows } = await open()
    expect(rows.filter((row) => row.getAttribute('tabindex') === '0')).toHaveLength(1)
    expect(rows[0]).toHaveAttribute('tabindex', '0')
  })

  it('moves the tab stop with the arrows', async () => {
    const { rows, user } = await open()

    rows[0].focus()
    await user.keyboard('{ArrowDown}')

    expect(rows[1]).toHaveFocus()
    expect(rows[1]).toHaveAttribute('tabindex', '0')
    expect(rows[0]).toHaveAttribute('tabindex', '-1')
  })

  it('stops at the ends rather than wrapping', async () => {
    const { rows, user } = await open()

    rows[0].focus()
    await user.keyboard('{ArrowUp}')
    expect(rows[0]).toHaveFocus()

    await user.keyboard('{End}')
    expect(rows[2]).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(rows[2]).toHaveFocus()

    await user.keyboard('{Home}')
    expect(rows[0]).toHaveFocus()
  })

  it('tells the reader what the chart says when no row has a bar', async () => {
    renderApp(<GapChart gaps={[PENDING, IN_LINE]} benchmarkLabel="Top 1%" />)
    // Not an empty chart and not a crash: the sentence that is the answer.
    expect(await screen.findByText(/in line/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('leaves out rows with no verdict rather than plotting a zero gap', async () => {
    const { rows } = await open([...GAPS, PENDING])
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.getAttribute('aria-label')).join(' ')).not.toContain('Other')
  })
})
