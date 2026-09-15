import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from '../lib/api'
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
  // Which cut of the population to benchmark against. Net worth is the axis
  // the product is built around, so it stays the default.
  const [dimension, setDimension] = useState('networth')
  const [groupKey, setGroupKey] = useState('top1')
  const [investableOnly, setInvestableOnly] = useState(true)
  // 'latest' is the newest quarter, which may be missing a lagging class;
  // 'complete' is the newest one where everything is published.
  const [periodMode, setPeriodMode] = useState('latest')
  const [token, setTokenState] = useState(getToken)
  const [slug, setSlug] = useState('default')
  const [portfolios, setPortfolios] = useState([])

  useEffect(() => {
    let cancelled = false

    /* The selected group has to move with the axis -- 'top1' is not a group on
       the generation axis -- but only once the new data is actually here.
       Resetting it when the picker changes would leave the old allocations
       indexed by a key they do not have until the fetch lands, and would strand
       the app on a nonexistent group if the fetch failed instead. Both setters
       run in one batch, so no render sees the mismatch. */
    function swapIn(next) {
      setBenchmarks(next)
      setGroupKey((key) => (next.groups[key] ? key : next.groupOrder[0]))
    }

    async function load() {
      try {
        // Both views are fetched once so the period toggle is instant. Asked
        // for with investable_only=false so the client can derive either view.
        const [latest, complete] = await Promise.all([
          api.benchmarks({ period: 'latest', investableOnly: false, dimension }),
          api.benchmarks({ period: 'complete', investableOnly: false, dimension }),
        ])
        if (cancelled) return
        swapIn(normaliseFromApi(latest, complete))
        setMode('live')
      } catch {
        if (cancelled) return
        // Net worth only, so this is also what reconciles the selected group
        // after a failed switch onto one of the other axes.
        swapIn(normaliseFromFallback(fallbackData))
        setMode('fallback')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dimension])

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
      .portfolios()
      .then((rows) => {
        if (!cancelled && rows) setPortfolios(rows)
      })
      .catch(() => {
        /* auth may be required, or nothing saved yet */
      })
    return () => {
      cancelled = true
    }
  }, [mode, token])

  useEffect(() => {
    if (mode !== 'live') return
    let cancelled = false
    api
      .getPortfolio(slug)
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
  }, [mode, slug])

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
    await api.savePortfolio(
      {
        name: slug === 'default' ? 'My portfolio' : slug,
        holdings: Object.entries(holdings).map(([asset_class, value]) => ({ asset_class, value })),
      },
      slug,
    )
    const rows = await api.portfolios().catch(() => null)
    if (rows) setPortfolios(rows)
    return { ok: true }
  }, [holdings, mode, slug])

  const updateToken = useCallback((next) => {
    setToken(next)
    setTokenState(next)
  }, [])

  // The group actually being shown, resolved against the selected period.
  const activeGroups = useMemo(() => {
    if (!benchmarks) return null
    return periodMode === 'complete' ? benchmarks.groupsComplete : benchmarks.groups
  }, [benchmarks, periodMode])

  const value = useMemo(
    () => ({
      mode,
      benchmarks,
      activeGroups,
      periodMode,
      setPeriodMode,
      token,
      updateToken,
      slug,
      setSlug,
      portfolios,
      holdings,
      setHolding,
      clearHoldings,
      save,
      groupKey,
      setGroupKey,
      dimension,
      setDimension,
      investableOnly,
      setInvestableOnly,
    }),
    [
      mode,
      benchmarks,
      activeGroups,
      periodMode,
      token,
      updateToken,
      slug,
      portfolios,
      holdings,
      setHolding,
      clearHoldings,
      save,
      groupKey,
      dimension,
      setDimension,
      investableOnly,
    ],
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

function toGroups(allocations) {
  const groups = {}
  for (const alloc of allocations) {
    groups[alloc.group] = {
      key: alloc.group,
      label: alloc.label,
      percentile_range: alloc.percentile_range,
      nested: alloc.nested,
      nested_in: alloc.nested_in,
      period: alloc.period,
      complete: alloc.complete,
      unavailable: alloc.unavailable || [],
      total_assets: alloc.total_assets,
      total_liabilities: alloc.total_liabilities,
      net_worth: alloc.net_worth,
      // Requested with investable_only=false, so these weights span the full
      // taxonomy and the client can derive either view.
      assets: alloc.weights,
    }
  }
  return groups
}

function normaliseFromApi(latest, complete) {
  return {
    source: latest.source,
    latestPeriod: latest.period,
    completePeriod: complete.period,
    periods: latest.periods,
    groupOrder: latest.group_order,
    dimension: latest.dimension,
    dimensions: latest.dimensions,
    assetClasses: latest.asset_classes,
    groups: toGroups(latest.allocations),
    groupsComplete: toGroups(complete.allocations),
    trends: null,
  }
}

function normaliseFromFallback(data) {
  // The embedded snapshot carries the latest row inline and the newest fully
  // published one alongside it, so both period views work offline too.
  const groupsComplete = {}
  for (const [key, group] of Object.entries(data.groups)) {
    const snap = group.complete_snapshot
    groupsComplete[key] = {
      ...group,
      period: snap.period,
      complete: true,
      unavailable: [],
      assets: snap.assets,
      total_assets: snap.total_assets,
      total_liabilities: snap.total_liabilities,
      net_worth: snap.net_worth,
    }
  }
  return {
    source: data.source,
    latestPeriod: data.latest_period,
    completePeriod: data.latest_complete_period,
    periods: data.periods,
    groupOrder: data.group_order,
    // The embedded snapshot carries net worth only -- shipping six axes of
    // history to every visitor would be a 3 MB download for a fallback. null
    // is the signal the picker reads to say why it cannot offer the others,
    // rather than showing five axes that would all render empty.
    dimension: 'networth',
    dimensions: null,
    assetClasses: data.asset_classes,
    groups: data.groups,
    groupsComplete,
    trends: data.trends,
  }
}
