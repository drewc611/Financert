/* Named "what if" portfolios, kept in this browser (BACKLOG F38, F39).
 *
 * A scenario is a set of holdings and debts with a name. It is deliberately
 * *not* the saved portfolio: the point of asking "what if I moved the house
 * money into equities" is to ask it without overwriting the answer to "what do
 * I actually own", which is what every keystroke on the portfolio page does.
 *
 * Local storage rather than the API, for the same reason the portfolio works
 * offline: a scenario is a thought, and the app should hold one whether or not
 * a backend is running. Nothing here is sent anywhere.
 */

const KEY = 'financert.scenarios.v1'
// Storage is a few megabytes per origin and shared with the portfolio; a
// scenario is under a kilobyte, so this is generous and still bounded.
export const MAX_SCENARIOS = 20
export const MAX_NAME = 60

export function readScenarios() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.map(clean).filter(Boolean) : []
  } catch {
    // Storage disabled, or something else wrote here: an unreadable store is
    // an empty one, never an exception on the way to rendering a page.
    return []
  }
}

export function writeScenarios(scenarios) {
  try {
    localStorage.setItem(KEY, JSON.stringify(scenarios.slice(0, MAX_SCENARIOS)))
    return true
  } catch {
    return false
  }
}

/** Add or replace by name, newest first. Same name replaces, which is what
 *  "save" means when the name is already on the list. */
export function upsert(scenarios, scenario) {
  const cleaned = clean(scenario)
  if (!cleaned) return scenarios
  const rest = scenarios.filter((s) => s.name !== cleaned.name)
  return [cleaned, ...rest].slice(0, MAX_SCENARIOS)
}

export function remove(scenarios, name) {
  return scenarios.filter((s) => s.name !== name)
}

/** A name that is free, given what is already saved: "Scenario", "Scenario 2",
 *  … so saving twice in a row does not silently replace the first. */
export function suggestName(scenarios, base) {
  if (!scenarios.some((s) => s.name === base)) return base
  for (let n = 2; n < MAX_SCENARIOS + 2; n += 1) {
    const candidate = `${base} ${n}`
    if (!scenarios.some((s) => s.name === candidate)) return candidate
  }
  return base
}

/* Everything that comes back out of storage is shaped defensively: this is a
   store anything on the origin could have written, and its numbers end up in
   the arithmetic behind every percentage on the page. */
function clean(scenario) {
  if (!scenario || typeof scenario !== 'object') return null
  const name = typeof scenario.name === 'string' ? scenario.name.trim().slice(0, MAX_NAME) : ''
  if (!name) return null
  const holdings = numbersOnly(scenario.holdings)
  if (!Object.keys(holdings).length) return null
  return { name, holdings, debts: numbersOnly(scenario.debts), savedAt: scenario.savedAt ?? null }
}

function numbersOnly(source) {
  const out = {}
  for (const [key, value] of Object.entries(source && typeof source === 'object' ? source : {})) {
    const amount = Number(value)
    if (Number.isFinite(amount) && amount > 0) out[key] = amount
  }
  return out
}
