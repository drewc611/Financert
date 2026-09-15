/* Client-side mirror of backend/app/services/allocation.py.
   Only used when the API is unreachable and the app is running off the
   embedded snapshot. Kept deliberately small and in step with the Python:
   if you change a rule there, change it here. */

export const NON_INVESTABLE = new Set(['consumer_durables'])
export const UNALLOCATED = 'unallocated'
export const GAP_TOLERANCE_PP = 1.5
// In an incomplete quarter the residual holds the classes the Fed has not
// released, so it is relabelled and given no over/underweight verdict.
export const PENDING_LABEL = 'Not yet published'
export const SIMILARITY_FLOOR = 0.5

export function benchmarkWeights(group, { investableOnly = true } = {}) {
  const assets = { ...group.assets }
  if (investableOnly) {
    for (const key of NON_INVESTABLE) delete assets[key]
    // The residual is only safe to drop in a fully published quarter. In an
    // incomplete one it also holds the classes the Fed has not released yet,
    // so dropping it would renormalise the rest upward and overstate them.
    if (group.complete !== false) delete assets[UNALLOCATED]
  }
  const total = Object.values(assets).reduce((a, b) => a + b, 0)
  if (total <= 0) return {}
  return Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, v / total]))
}

/* Mirrors benchmarks.shape_metrics in backend/app/services/benchmarks.py.
   Every value is null rather than 0 when the inputs cannot support it: a tier
   with no assets has no meaningful leverage, and 0 would read as "no debt".

   `liquidKeys` comes from the asset taxonomy the API (or the embedded
   snapshot) ships, so the liquid/illiquid split is never hardcoded here. */
/** A group's borrowing as shares of what it owes (BACKLOG F26).
 *
 *  Normalises whatever it is handed, because the API sends shares in this
 *  field and the embedded snapshot sends dollars -- the same reason
 *  benchmarkWeights exists. Empty for a group that owes nothing, which is a
 *  different statement from owing nothing of any one kind.
 */
export function debtWeights(group) {
  const debts = group.liabilities || {}
  const total = Object.values(debts).reduce((a, b) => a + b, 0)
  if (total <= 0) return {}
  return Object.fromEntries(Object.entries(debts).map(([k, v]) => [k, v / total]))
}

export function shapeMetrics(group, weights, liquidKeys) {
  const totalAssets = group.total_assets
  const entries = Object.entries(weights)
  let largest = null
  for (const [key, share] of entries) {
    if (!largest || share > largest[1]) largest = [key, share]
  }
  return {
    // Liabilities are owed against the whole balance sheet, so this divides by
    // the group's own total and not the investable-only subtotal the weights
    // are renormalised over -- that would overstate every tier.
    leverage: totalAssets > 0 ? group.total_liabilities / totalAssets : null,
    concentration: largest ? largest[1] : null,
    concentrationClass: largest ? largest[0] : null,
    liquidity: entries.length
      ? entries.reduce((sum, [key, share]) => (liquidKeys.has(key) ? sum + share : sum), 0)
      : null,
  }
}

export function portfolioWeights(holdings) {
  const positive = Object.entries(holdings).filter(([, v]) => v > 0)
  const total = positive.reduce((a, [, v]) => a + v, 0)
  if (total <= 0) return {}
  return Object.fromEntries(positive.map(([k, v]) => [k, v / total]))
}

export function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let dot = 0
  for (const k of keys) dot += (a[k] || 0) * (b[k] || 0)
  const na = Math.sqrt(Object.values(a).reduce((s, v) => s + v * v, 0))
  const nb = Math.sqrt(Object.values(b).reduce((s, v) => s + v * v, 0))
  if (na === 0 || nb === 0) return 0
  return dot / (na * nb)
}

export function computeGaps(user, benchmark, labels) {
  const keys = [...new Set([...Object.keys(user), ...Object.keys(benchmark)])].sort()
  return keys
    .map((key) => {
      const userPct = (user[key] || 0) * 100
      const benchPct = (benchmark[key] || 0) * 100
      const gap = userPct - benchPct
      let status = 'in_line'
      if (Math.abs(gap) > GAP_TOLERANCE_PP) status = gap > 0 ? 'overweight' : 'underweight'
      return {
        asset_class: key,
        label: labels[key] || key,
        user_pct: round2(userPct),
        benchmark_pct: round2(benchPct),
        gap_pp: round2(gap),
        status,
      }
    })
    .sort((a, b) => Math.abs(b.gap_pp) - Math.abs(a.gap_pp))
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/** Which band a net worth falls in, by the Fed's published entry thresholds
 *  (BACKLOG F28) -- a different question from `analyse`, which asks whose mix
 *  yours resembles. Someone can hold exactly the top 1%'s allocation with a
 *  thousandth of their money.
 *
 *  Returns the band with the highest threshold the figure clears, plus the
 *  next one up and what it would take to reach it. The band is null below
 *  every threshold: the bottom group publishes no floor, so there is nothing
 *  to place against, and inventing one would be inventing a fact.
 */
export function placeByThreshold(groups, netWorth) {
  const bands = Object.values(groups)
    .filter((g) => g.threshold && typeof g.threshold.value === 'number')
    .sort((a, b) => a.threshold.value - b.threshold.value)
  if (!bands.length || !(netWorth > 0)) return null

  let index = -1
  for (let i = 0; i < bands.length; i += 1) {
    if (netWorth >= bands[i].threshold.value) index = i
  }
  const group = index >= 0 ? bands[index] : null
  const next = bands[index + 1] ?? null
  return {
    group,
    next,
    // What it would take to clear the next threshold. Only meaningful while
    // there is a next one -- above the top band there is nothing to reach.
    toNext: next ? next.threshold.value - netWorth : null,
    // Every band is measured by the same triennial survey, so one date
    // describes the whole placement.
    measured: (group ?? bands[0]).threshold.period,
  }
}

/** The smallest set of moves that would put a portfolio on a tier's mix
 *  (BACKLOG F36).
 *
 *  Every class is either over or under its benchmark weight, and the two sides
 *  sum to the same amount, so the moves are a pairing of surpluses to
 *  deficits -- largest to largest, which keeps the count of moves down. The
 *  total moved is half the sum of the absolute gaps: moving a dollar closes
 *  both an overweight and an underweight at once, and counting it twice would
 *  double the distance.
 *
 *  Gaps under the tolerance are left alone. They are inside what the survey
 *  can resolve, and "sell $300 of annuities" is not a finding.
 */
export function rebalanceMoves(gaps, total) {
  if (!(total > 0)) return { moves: [], distance: 0 }
  const over = gaps
    .filter((g) => g.status === 'overweight')
    .map((g) => ({ key: g.asset_class, label: g.label, amount: (g.gap_pp / 100) * total }))
    .sort((a, b) => b.amount - a.amount)
  const under = gaps
    .filter((g) => g.status === 'underweight')
    .map((g) => ({ key: g.asset_class, label: g.label, amount: (-g.gap_pp / 100) * total }))
    .sort((a, b) => b.amount - a.amount)

  const moves = []
  let i = 0
  let j = 0
  while (i < over.length && j < under.length) {
    const amount = Math.min(over[i].amount, under[j].amount)
    if (amount > 0) moves.push({ from: over[i], to: under[j], amount })
    over[i].amount -= amount
    under[j].amount -= amount
    if (over[i].amount <= 0.005) i += 1
    if (under[j].amount <= 0.005) j += 1
  }
  return { moves, distance: moves.reduce((a, m) => a + m.amount, 0) }
}

/** Which single class, brought to the benchmark, would move the similarity
 *  most (BACKLOG F40).
 *
 *  One class at a time, each measured against the same starting point rather
 *  than compounding: the answer to "what one change" has to be one change.
 *  The rest of the portfolio is rescaled to keep the weights summing to one,
 *  which is what actually happens when money moves between classes.
 */
export function sensitivity(user, bench) {
  const base = cosineSimilarity(user, bench)
  const keys = [...new Set([...Object.keys(user), ...Object.keys(bench)])]
  return keys
    .map((key) => {
      const target = bench[key] ?? 0
      const rest = 1 - (user[key] ?? 0)
      const scale = rest > 0 ? (1 - target) / rest : 0
      const moved = Object.fromEntries(keys.map((k) => [k, k === key ? target : (user[k] ?? 0) * scale]))
      return {
        asset_class: key,
        gain: round4(cosineSimilarity(moved, bench) - base),
      }
    })
    .filter((row) => row.gain > 0)
    .sort((a, b) => b.gain - a.gain)
}

/** Full comparison, mirroring the backend's /api/analysis response shape. */
export function analyse(holdings, { groups, groupKey = 'top1', investableOnly = true, labels = {} }) {
  const considered = investableOnly
    ? Object.fromEntries(Object.entries(holdings).filter(([k]) => !NON_INVESTABLE.has(k)))
    : { ...holdings }

  const user = portfolioWeights(considered)
  const bench = benchmarkWeights(groups[groupKey], { investableOnly })
  const total = Object.values(considered).reduce((a, b) => (b > 0 ? a + b : a), 0)
  const excluded = Object.entries(holdings)
    .filter(([k, v]) => !(k in considered) && v > 0)
    .reduce((a, [, v]) => a + v, 0)

  // Ranked over the tiers that partition the population. A nested tier (the
  // top 0.1% inside the top 1%) would put two overlapping populations in one
  // ranking, so it is excluded here even though it is a valid benchmark.
  const ranked = Object.keys(groups)
    .filter((key) => !groups[key].nested)
    .map((key) => ({
      group: key,
      label: groups[key].label,
      similarity: round4(cosineSimilarity(user, benchmarkWeights(groups[key], { investableOnly }))),
    }))
    .sort((a, b) => b.similarity - a.similarity)

  const hasHoldings = Object.keys(user).length > 0
  const complete = groups[groupKey].complete !== false
  const unavailable = groups[groupKey].unavailable || []
  const gapRows = hasHoldings ? computeGaps(user, bench, labels) : []

  if (!complete) {
    const missing = unavailable.map((k) => labels[k] || k).join(', ')
    for (const row of gapRows) {
      if (row.asset_class === UNALLOCATED) {
        row.status = 'pending'
        row.label = missing ? `${PENDING_LABEL} (${missing})` : PENDING_LABEL
      }
    }
  }

  return {
    period: groups[groupKey].period,
    period_complete: complete,
    period_unavailable: unavailable,
    benchmark_group: groupKey,
    benchmark_label: groups[groupKey].label,
    investable_only: investableOnly,
    portfolio_total: total,
    excluded_value: excluded,
    user_weights: user,
    benchmark_weights: bench,
    gaps: gapRows,
    similarity: hasHoldings ? round4(cosineSimilarity(user, bench)) : 0,
    nearest_tier: hasHoldings
      ? {
          nearest: ranked[0].group,
          nearest_label: ranked[0].label,
          similarity: ranked[0].similarity,
          confident: ranked[0].similarity >= SIMILARITY_FLOOR,
          ranked,
        }
      : null,
  }
}

function round4(n) {
  return Math.round(n * 10000) / 10000
}
