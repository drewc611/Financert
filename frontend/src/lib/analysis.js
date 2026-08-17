/* Client-side mirror of backend/app/services/allocation.py.
   Only used when the API is unreachable and the app is running off the
   embedded snapshot. Kept deliberately small and in step with the Python:
   if you change a rule there, change it here. */

export const NON_INVESTABLE = new Set(['consumer_durables'])
export const UNALLOCATED = 'unallocated'
export const GAP_TOLERANCE_PP = 1.5
export const SIMILARITY_FLOOR = 0.5

export function benchmarkWeights(group, { investableOnly = true } = {}) {
  const assets = { ...group.assets }
  if (investableOnly) {
    for (const key of [...NON_INVESTABLE, UNALLOCATED]) delete assets[key]
  }
  const total = Object.values(assets).reduce((a, b) => a + b, 0)
  if (total <= 0) return {}
  return Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, v / total]))
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

  const ranked = Object.keys(groups)
    .map((key) => ({
      group: key,
      label: groups[key].label,
      similarity: round4(cosineSimilarity(user, benchmarkWeights(groups[key], { investableOnly }))),
    }))
    .sort((a, b) => b.similarity - a.similarity)

  const hasHoldings = Object.keys(user).length > 0

  return {
    period: groups[groupKey].period,
    benchmark_group: groupKey,
    benchmark_label: groups[groupKey].label,
    investable_only: investableOnly,
    portfolio_total: total,
    excluded_value: excluded,
    user_weights: user,
    benchmark_weights: bench,
    gaps: hasHoldings ? computeGaps(user, bench, labels) : [],
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
