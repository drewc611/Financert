import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { fallbackData } from '../lib/fallbackData'

const AppDataContext = createContext(null)

const STORAGE_KEY = 'financert.holdings.v1'

function readStoredHoldings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function AppDataProvider({ children }) {
  // 'live' once the API answers, 'fallback' when we are on the embedded
  // snapshot. The badge in the topbar reads this.
  const [mode, setMode] = useState('loading')
  const [benchmarks, setBenchmarks] = useState(null)
  const [holdings, setHoldings] = useState(readStoredHoldings)
  const [groupKey, setGroupKey] = useState('top1')
  const [investableOnly, setInvestableOnly] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await api.benchmarks({ investableOnly: false })
        if (cancelled) return
        setBenchmarks(normaliseFromApi(data))
        setMode('live')
      } catch {
        if (cancelled) return
        setBenchmarks(normaliseFromFallback(fallbackData))
        setMode('fallback')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Holdings live in localStorage so the tool is useful with no backend at
  // all; when the API is up they are also persisted server-side.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
    } catch {
      /* storage disabled -- in-memory state still works for this session */
    }
  }, [holdings])

  useEffect(() => {
    if (mode !== 'live') return
    let cancelled = false
    api
      .getPortfolio()
      .then((p) => {
        if (cancelled || !p) return
        const stored = readStoredHoldings()
        // Only adopt the server's copy when this browser has nothing local,
        // so a fresh device gets the saved portfolio but local edits win.
        if (Object.keys(stored).length === 0 && p.holdings.length) {
          setHoldings(Object.fromEntries(p.holdings.map((h) => [h.asset_class, h.value])))
        }
      })
      .catch(() => {
        /* no saved portfolio yet -- expected on first run */
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  const setHolding = useCallback((assetClass, value) => {
    setHoldings((prev) => {
      const next = { ...prev }
      if (!value || Number(value) <= 0) delete next[assetClass]
      else next[assetClass] = Number(value)
      return next
    })
  }, [])

  const clearHoldings = useCallback(() => setHoldings({}), [])

  const save = useCallback(async () => {
    if (mode !== 'live') return { ok: false, reason: 'offline' }
    await api.savePortfolio({
      name: 'My portfolio',
      holdings: Object.entries(holdings).map(([asset_class, value]) => ({ asset_class, value })),
    })
    return { ok: true }
  }, [holdings, mode])

  const value = useMemo(
    () => ({
      mode,
      benchmarks,
      holdings,
      setHolding,
      clearHoldings,
      save,
      groupKey,
      setGroupKey,
      investableOnly,
      setInvestableOnly,
    }),
    [mode, benchmarks, holdings, setHolding, clearHoldings, save, groupKey, investableOnly],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider')
  return ctx
}

/* The API and the embedded snapshot carry the same facts in slightly
   different envelopes; both are flattened to one shape here so no view has
   to know which mode it is running in. */

function normaliseFromApi(data) {
  const groups = {}
  for (const alloc of data.allocations) {
    groups[alloc.group] = {
      key: alloc.group,
      label: alloc.label,
      percentile_range: alloc.percentile_range,
      period: alloc.period,
      total_assets: alloc.total_assets,
      total_liabilities: alloc.total_liabilities,
      net_worth: alloc.net_worth,
      // /api/benchmarks was requested with investable_only=false, so these
      // weights span the full taxonomy and the client can derive either view.
      assets: alloc.weights,
    }
  }
  return {
    source: data.source,
    latestPeriod: data.period,
    periods: data.periods,
    assetClasses: data.asset_classes,
    groups,
    trends: null,
  }
}

function normaliseFromFallback(data) {
  return {
    source: data.source,
    latestPeriod: data.latest_period,
    periods: data.periods,
    assetClasses: data.asset_classes,
    groups: data.groups,
    trends: data.trends,
  }
}
