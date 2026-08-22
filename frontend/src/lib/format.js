export function usd(value, { compact = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—'
  if (compact) {
    const abs = Math.abs(value)
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    if (abs >= 1e3) return `$${Math.round(value / 1e3)}K`
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function pct(fraction, digits = 1) {
  if (fraction == null || Number.isNaN(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

export function pp(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}pp`
}

/** "2024-07-01" -> "Q3 2024" */
export function quarterLabel(period) {
  if (!period) return '—'
  const [year, month] = period.split('-')
  const q = Math.floor((Number(month) - 1) / 3) + 1
  return `Q${q} ${year}`
}

export const STATUS_LABEL = {
  overweight: 'Overweight',
  underweight: 'Underweight',
  in_line: 'In line',
  pending: 'Not yet published',
}
