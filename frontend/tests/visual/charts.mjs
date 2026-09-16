/* Visual regression for the charts (BACKLOG F70).
 *
 * The baseline is the chart's *markup*, not a screenshot. Two reasons, and the
 * second is why this exists at all rather than being promised:
 *
 * 1. A screenshot baseline encodes the machine's font rasterisation, so one
 *    rendered on a laptop fails on a CI runner for reasons that have nothing
 *    to do with the chart. Every coordinate in these SVGs is computed by our
 *    own code from committed data -- including the label gutter, which is
 *    estimated from character counts rather than measured -- so the markup is
 *    identical anywhere the same data meets the same code.
 * 2. A failure is readable. "This path changed" in a diff says what broke;
 *    "4,182 pixels differ" says only that something did.
 *
 * Styles are inlined the way the PNG export does it, so a colour or a stroke
 * width changing in the stylesheet shows up here too -- the CSS is as much a
 * part of a chart as the geometry.
 *
 * One consequence of comparing markup: the hatch pattern ids come from
 * useId(), so a React major that changes its id format rewrites the three
 * hatched baselines without changing a pixel. React 19 did exactly that --
 * `:r2:` became `«r2»`, and these charts strip the punctuation, so `r2` became
 * `_r_2_`. That is a baseline update rather than a bug, but check the diff is
 * *only* the id before adopting it: a reference that has stopped matching its
 * pattern looks much the same here and is not benign.
 *
 *     node tests/visual/charts.mjs            # compare against the baseline
 *     node tests/visual/charts.mjs --update   # adopt the current output
 *
 * Needs the API on :8000 and the built dashboard on :4173, which is what
 * `npm run test:visual` and .github/workflows/visual.yml both arrange.
 */

import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASELINE = join(HERE, '__baseline__')
const APP = process.env.FINANCERT_APP_URL ?? 'http://localhost:4173/'
const UPDATE = process.argv.includes('--update')

/* One portfolio, one quarter, one language, fixed. A visual baseline is only
   worth having if the only thing that can change it is the code. */
const HOLDINGS = { corporate_equities: 240000, pension: 180000, real_estate: 420000, deposits: 35000 }
const DEBTS = { home_mortgages: 260000, consumer_credit: 8000 }

/** Each case names a chart, how to reach it, and which SVG on that page it is. */
const CASES = [
  { name: 'allocation', tab: 0, card: 'Your allocation vs' },
  { name: 'gap', tab: 0, card: 'Where you differ' },
  { name: 'slope', tab: 0, card: 'Your order against' },
  { name: 'scenario-compare', tab: 0, card: 'Two of yours' },
  { name: 'similarity-over-time', tab: 0, card: 'Would your mix ever' },
  { name: 'tier-composition', tab: 2, card: 'The same mix' },
  { name: 'shape-scatter', tab: 2, card: 'Liquid, or concentrated' },
  { name: 'composition', tab: 2, card: 'How one group' },
  { name: 'trend', tab: 2, card: 'over time' },
]

// Only what the charts paint with; see lib/png.js, which inlines the same set.
const PAINTED = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'font-size',
  'font-weight',
  'text-anchor',
  'opacity',
]

async function markup(page, cardText) {
  const card = page.locator('.card').filter({ hasText: cardText }).first()
  await card.scrollIntoViewIfNeeded()
  await card.locator('svg.chart-svg').first().waitFor({ state: 'visible', timeout: 15000 })
  return card.locator('svg.chart-svg').first().evaluate((svg, painted) => {
    const copy = svg.cloneNode(true)
    const from = [svg, ...svg.querySelectorAll('*')]
    const to = [copy, ...copy.querySelectorAll('*')]
    from.forEach((node, i) => {
      const computed = getComputedStyle(node)
      let style = ''
      for (const property of painted) {
        const value = computed.getPropertyValue(property)
        if (value && value !== 'none' && value !== 'normal') style += `${property}:${value};`
      }
      to[i].setAttribute('style', style)
    })
    // One attribute per line: a diff should point at the thing that changed,
    // not at a 40 kB single line.
    return new XMLSerializer()
      .serializeToString(copy)
      .replace(/></g, '>\n<')
      .replace(/" /g, '"\n  ')
  }, painted())
}

function painted() {
  return PAINTED
}

async function main() {
  mkdirSync(BASELINE, { recursive: true })
  for (const stale of readdirSync(BASELINE).filter((f) => f.endsWith('.actual.svg'))) {
    unlinkSync(join(BASELINE, stale))
  }

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.addInitScript(
    ([holdings, debts]) => {
      localStorage.setItem('financert.holdings.v1', JSON.stringify(holdings))
      localStorage.setItem('financert.debts.v1', JSON.stringify(debts))
      localStorage.setItem(
        'financert.scenarios.v1',
        JSON.stringify([{ name: 'All in equities', holdings: { corporate_equities: 900000 }, debts: {} }]),
      )
    },
    [HOLDINGS, DEBTS],
  )
  await page.goto(APP, { waitUntil: 'networkidle' })

  const failures = []
  let checked = 0
  let currentTab = null
  for (const testCase of CASES) {
    if (testCase.tab !== currentTab) {
      await page.locator('.tabs .tab').nth(testCase.tab).click()
      // The composition and history charts fetch; the rest render at once.
      await page.waitForLoadState('networkidle')
      currentTab = testCase.tab
    }
    const svg = await markup(page, testCase.card)
    const file = join(BASELINE, `${testCase.name}.svg`)
    checked += 1

    const had = existsSync(file)
    if (UPDATE || !had) {
      writeFileSync(file, svg)
      console.log(`${had ? 'updated' : 'created'} ${testCase.name}`)
      continue
    }
    const expected = readFileSync(file, 'utf8')
    if (expected === svg) {
      console.log(`ok      ${testCase.name}`)
    } else {
      writeFileSync(join(BASELINE, `${testCase.name}.actual.svg`), svg)
      failures.push({ name: testCase.name, expected, actual: svg })
    }
  }

  await browser.close()

  if (failures.length) {
    console.error(`\n${failures.length} of ${checked} charts changed:\n`)
    for (const failure of failures) {
      console.error(`--- ${failure.name}`)
      for (const line of firstDifference(failure.expected, failure.actual)) console.error(`    ${line}`)
      console.error(`    baseline: tests/visual/__baseline__/${failure.name}.svg`)
      console.error(`    current:  tests/visual/__baseline__/${failure.name}.actual.svg\n`)
    }
    console.error('If the change was intended: node tests/visual/charts.mjs --update, and commit the diff.')
    process.exitCode = 1
    return
  }
  console.log(`\n${checked} charts match their baseline.`)
}

/** The first few lines that differ, which is usually the whole story. */
function firstDifference(expected, actual, lines = 3) {
  const a = expected.split('\n')
  const b = actual.split('\n')
  const out = []
  for (let i = 0; i < Math.max(a.length, b.length) && out.length < lines * 2; i += 1) {
    if (a[i] !== b[i]) {
      out.push(`- ${(a[i] ?? '(end)').trim().slice(0, 110)}`)
      out.push(`+ ${(b[i] ?? '(end)').trim().slice(0, 110)}`)
    }
  }
  return out.length ? out : ['(differs only in length)']
}

await main()
