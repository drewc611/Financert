/**
 * Translation layer. Deliberately hand-rolled rather than react-i18next: the
 * whole thing is ~80 lines, the app has exactly two runtime dependencies
 * today, and `Intl` already does the hard part (numbers, currency, dates).
 *
 * Adding a language is a data change, not a code change -- drop a JSON file
 * in `locales/` and add one row to LOCALES.
 *
 * Asset-class and tier names are translated here too, keyed by the stable
 * identifiers the backend uses (`corporate_equities`, `top1`). Those labels
 * arrive from the API in English; translating only the surrounding chrome
 * would leave the actual content of the page untranslated.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { num, pct, pp, quarterLabel, usd } from '../lib/format'
import ar from './locales/ar.json'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import pt from './locales/pt.json'

const BUNDLES = { en, es, fr, de, pt, ar }

/** `name` is the endonym -- a language picker that lists "German" is no use
 *  to someone who only reads German. */
export const LOCALES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', dir: 'ltr' },
  { code: 'pt', name: 'Português', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
]

const STORAGE_KEY = 'financert.locale'
const DEFAULT = 'en'

const BY_CODE = Object.fromEntries(LOCALES.map((l) => [l.code, l]))

/** Matches on the base subtag, so `pt-BR`, `pt-PT` and `pt` all resolve. */
function normalise(tag) {
  if (!tag) return null
  const base = String(tag).toLowerCase().split('-')[0]
  return BY_CODE[base] ? base : null
}

export function detectLocale() {
  try {
    const saved = normalise(localStorage.getItem(STORAGE_KEY))
    if (saved) return saved
  } catch {
    /* storage disabled -- fall through to the browser's own preference */
  }
  const preferred = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []
  for (const tag of preferred) {
    const hit = normalise(tag)
    if (hit) return hit
  }
  return DEFAULT
}

function lookup(bundle, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), bundle)
}

/** `{name}` placeholders only. No plural rules: nothing in this UI is
 *  pluralised, and a half-built plural system is worse than none. */
function interpolate(template, vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole))
}

export function translate(locale, key, vars) {
  const value = lookup(BUNDLES[locale] || BUNDLES[DEFAULT], key)
  // Fall back to English rather than rendering a raw key: a partially
  // translated locale should read as mixed, not broken.
  const resolved = typeof value === 'string' ? value : lookup(BUNDLES[DEFAULT], key)
  if (typeof resolved !== 'string') return key
  return interpolate(resolved, vars)
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale)
  const dir = BY_CODE[locale]?.dir ?? 'ltr'

  useEffect(() => {
    // Both attributes matter: `lang` drives hyphenation, spellcheck and screen
    // reader voice; `dir` flips the whole layout for Arabic.
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const setLocale = useCallback((next) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage disabled -- the choice still applies for this session */
    }
  }, [])

  const value = useMemo(
    () => ({
      locale,
      dir,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      /** Asset-class and tier labels come from the API in English; these map
       *  the backend's stable keys onto translated names, falling back to
       *  whatever the API sent if a locale hasn't covered one yet. */
      assetLabel: (key, fallback) => {
        const hit = lookup(BUNDLES[locale] || {}, `assets.${key}`)
        return typeof hit === 'string' ? hit : (fallback ?? translate(locale, `assets.${key}`))
      },
      assetBlurb: (key, fallback) => {
        const hit = lookup(BUNDLES[locale] || {}, `assetBlurbs.${key}`)
        return typeof hit === 'string' ? hit : (fallback ?? translate(locale, `assetBlurbs.${key}`))
      },
      tierLabel: (key, fallback) => {
        const hit = lookup(BUNDLES[locale] || {}, `tiers.${key}`)
        return typeof hit === 'string' ? hit : (fallback ?? translate(locale, `tiers.${key}`))
      },
      /** The API sends English ordinals ("99th-100th"), which don't survive
       *  translation -- French wants "99e", German "99.". Each locale spells
       *  its own range out rather than trying to build one from the string. */
      percentileRange: (key, fallback) => {
        const hit = lookup(BUNDLES[locale] || {}, `percentiles.${key}`)
        return typeof hit === 'string' ? hit : (fallback ?? translate(locale, `percentiles.${key}`))
      },
      /** Formatters pre-bound to the active locale. Components use these
       *  rather than importing from lib/format directly, so a call site
       *  cannot silently format German numbers in en-US. */
      fmt: {
        usd: (v, opts) => usd(v, { ...opts, locale }),
        pct: (v, opts) => pct(v, { ...opts, locale }),
        pp: (v, opts) => pp(v, { ...opts, locale }),
        num: (v, opts) => num(v, { ...opts, locale }),
        quarter: (period) => quarterLabel(period, { locale, template: translate(locale, 'format.quarter') }),
      },
    }),
    [locale, dir, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
