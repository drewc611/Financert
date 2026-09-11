/**
 * Number and date formatting. Every function takes a `locale`, because the
 * separators move: German writes 1.234,5 %, French puts a space before the
 * sign, Arabic may render Eastern Arabic numerals. `Intl` knows all of that;
 * the `toFixed` these replaced did not.
 *
 * Amounts stay in USD in every locale, deliberately. The underlying Federal
 * Reserve figures are dollars, and converting them would invent an exchange
 * rate the source has no opinion on.
 *
 * Call sites use the pre-bound `fmt` from `useI18n()` rather than importing
 * these directly, so the active locale can't be forgotten at one call site.
 */

const DEFAULT_LOCALE = 'en'
const DASH = '—'

export function usd(value, { compact = false, locale = DEFAULT_LOCALE } = {}) {
  if (value == null || Number.isNaN(value)) return DASH
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    // Compact notation localises the suffix too ("Mio." in German, "mil M"
    // in Spanish) instead of hardcoding K/M/B/T.
    ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }),
  }).format(value)
}

export function pct(fraction, { digits = 1, locale = DEFAULT_LOCALE } = {}) {
  if (fraction == null || Number.isNaN(fraction)) return DASH
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction)
}

/** Percentage *points* — a difference between two shares, not a percentage of
 *  anything. Intl has no unit for it, so the number is localised and the
 *  suffix appended. */
export function pp(value, { digits = 1, locale = DEFAULT_LOCALE } = {}) {
  if (value == null || Number.isNaN(value)) return DASH
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(value)
  return `${n} pp`
}

/** Plain localised number — similarity scores and other bare figures. */
export function num(value, { digits = 2, locale = DEFAULT_LOCALE } = {}) {
  if (value == null || Number.isNaN(value)) return DASH
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** "2024-07-01" -> "Q3 2024". The quarter marker is not universal (French and
 *  Spanish use T for trimestre), so the pattern comes from the locale file. */
export function quarterLabel(period, { locale = DEFAULT_LOCALE, template = 'Q{q} {year}' } = {}) {
  if (!period) return DASH
  const [year, month] = period.split('-')
  const q = Math.floor((Number(month) - 1) / 3) + 1
  // useGrouping: false -- a year is not 2,026.
  const plain = (n) => new Intl.NumberFormat(locale, { useGrouping: false }).format(n)
  return template.replace('{q}', plain(q)).replace('{year}', plain(Number(year)))
}
