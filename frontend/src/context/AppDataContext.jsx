import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, getToken, setToken } from '../lib/api'
import { fallbackData } from '../lib/fallbackData'
import { decodeShare } from '../lib/share'
import { readScenarios, remove as removeScenario, suggestName, upsert, writeScenarios } from '../lib/scenarios'

const AppDataContext = createContext(null)

const STORAGE_KEY = 'financert.holdings.v1'
const COHORT_KEY = 'financert.cohort.v1'
const DEBTS_KEY = 'financert.debts.v1'

function readStored(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** `last` is which axis was chosen most recently, so a returning reader lands
 *  on the benchmark they picked rather than back on the top 1%. Shaped
 *  defensively because this comes out of a store anything could have written. */
function readCohort() {
  const stored = readStored(COHORT_KEY)
  const groups = stored.groups && typeof stored.groups === 'object' ? stored.groups : {}
  const last = typeof stored.last === 'string' && groups[stored.last] ? stored.last : null
  return { groups, last }
}

export function AppDataProvider({ children }) {
  // 'live' once the API answers, 'fallback' when we are on the embedded
  // snapshot. The badge in the topbar reads this.
  const [mode, setMode] = useState('loading')
  const [benchmarks, setBenchmarks] = useState(null)
  const [holdings, setHoldings] = useState(() => readStored(STORAGE_KEY))
  /* A "what if" draft (BACKLOG F38). While one is open, every reader of
     `holdings` sees it and nothing is written to storage: asking what a change
     would do should not be the same act as recording that you made it.
     `{ name, holdings, debts }`, or null for the real portfolio. */
  const [scenario, setScenario] = useState(null)
  const [scenarios, setScenarios] = useState(readScenarios)
  /* What the reader owes, by liability class (BACKLOG F25, F27). Optional:
     comparing an allocation needs no debt side at all, and only net worth and
     the debt questions read this. */
  const [debts, setDebts] = useState(() => readStored(DEBTS_KEY))
  /* Which group of an axis the reader says they belong to, one per axis, plus
     the one they chose last (BACKLOG F18). Kept in localStorage and never sent
     anywhere: the benchmark request carries the axis, never who asked. */
  const [cohort, setCohort] = useState(readCohort)
  // Which cut of the population to benchmark against. A reader who has told us
  // their cohort opens on it; everyone else on net worth, the axis the product
  // is built around.
  const [dimension, setDimension] = useState(() => cohort.last ?? 'networth')
  const [groupKey, setGroupKey] = useState(() => cohort.groups[cohort.last] ?? 'top1')
  // Set when a cohort choice needs an axis that is still loading; applied by
  // swapIn once its groups are actually here.
  const pendingGroup = useRef(null)
  const [investableOnly, setInvestableOnly] = useState(true)
  /* 'latest' is the newest quarter, which may be missing a lagging class;
     'complete' is the newest one where everything is published; anything else
     is an ISO date -- any quarter back to 1989 (BACKLOG F30). */
  const [periodMode, setPeriodMode] = useState('latest')
  // Whatever historical quarter was last fetched, kept beside the two the
  // dashboard always holds rather than replacing them: the period control has
  // to be able to come back to 'latest' without another request.
  const [historical, setHistorical] = useState(null)
  const [token, setTokenState] = useState(getToken)
  const [slug, setSlug] = useState('default')
  const [portfolios, setPortfolios] = useState([])
  /* A portfolio arriving in the URL fragment (BACKLOG F52). Held aside rather
     than applied: adopting it would overwrite whatever this browser has saved,
     and a link someone else wrote is not a reason to throw away a reader's own
     numbers. The banner asks; `showShared` is what a yes runs. */
  const [shared, setShared] = useState(() => (typeof window === 'undefined' ? null : decodeShare(window.location.hash)))

  /* What the dashboard reads. Every view asks for `holdings`; which set that
     is depends on whether a draft is open, and nothing downstream needs to
     know (BACKLOG F38). */
  const holdingsShown = scenario ? scenario.holdings : holdings
  const debtsShown = scenario ? scenario.debts : debts

  useEffect(() => {
    let cancelled = false

    /* The selected group has to move with the axis -- 'top1' is not a group on
       the generation axis -- but only once the new data is actually here.
       Resetting it when the picker changes would leave the old allocations
       indexed by a key they do not have until the fetch lands, and would strand
       the app on a nonexistent group if the fetch failed instead. Both setters
       run in one batch, so no render sees the mismatch. */
    function swapIn(next) {
      const wanted = pendingGroup.current
      pendingGroup.current = null
      setBenchmarks(next)
      setGroupKey((key) => {
        const candidate = wanted ?? key
        return next.groups[candidate] ? candidate : next.groupOrder[0]
      })
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

  /* A historical quarter is fetched on demand and only when one is asked for
     -- 147 quarters is a lot to ship to a reader who wants the current one.
     The previous answer stays on screen while this runs, so switching periods
     does not blank the page. */
  useEffect(() => {
    const isDate = periodMode !== 'latest' && periodMode !== 'complete'
    if (!isDate || mode !== 'live') return
    let cancelled = false
    api
      .benchmarks({ period: periodMode, investableOnly: false, dimension })
      .then((data) => {
        // Tagged with the axis it came from. Clearing it when the axis changes
        // instead would race the main fetch: whichever landed last would win,
        // and half the time that is a wipe of the answer just fetched.
        if (!cancelled) setHistorical({ dimension, period: data.period, groups: toGroups(data.allocations) })
      })
      .catch(() => {
        // Leave the last good answer up; the control still reads as selected,
        // and the period shown beside every figure says which one it is.
      })
    return () => {
      cancelled = true
    }
  }, [periodMode, dimension, mode])

  // Holdings live in localStorage so the tool is useful with no backend at
  // all; when the API is up they are also persisted server-side.
  useEffect(() => {
    // Not while a scenario is open: the whole point of one is that it does not
    // touch what is saved.
    if (scenario) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings))
    } catch {
      /* storage disabled -- in-memory state still works for this session */
    }
  }, [holdings, scenario])

  useEffect(() => {
    if (scenario) return
    try {
      localStorage.setItem(DEBTS_KEY, JSON.stringify(debts))
    } catch {
      /* storage disabled -- in-memory state still works for this session */
    }
  }, [debts, scenario])

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
        const stored = readStored(STORAGE_KEY)
        // Only adopt the server's copy when this browser has nothing local,
        // so a fresh device gets the saved portfolio but local edits win.
        if (Object.keys(stored).length === 0 && p.holdings.length) {
          setHoldings(Object.fromEntries(p.holdings.map((h) => [h.asset_class, h.value])))
          setDebts(Object.fromEntries((p.debts ?? []).map((d) => [d.liability_class, d.value])))
        }
      })
      .catch(() => {
        /* no saved portfolio yet -- expected on first run */
      })
    return () => {
      cancelled = true
    }
  }, [mode, slug])

  /* One edit, applied to whichever of the two is in front: the draft when a
     scenario is open, the saved portfolio otherwise. Every view that edits
     holdings goes through here, so none of them has to know which. */
  const edit = useCallback(
    (field, key, value) => {
      const apply = (prev) => {
        const next = { ...prev }
        if (!value || Number(value) <= 0) delete next[key]
        else next[key] = Number(value)
        return next
      }
      /* One or the other, never both. Writing to the portfolio *as well* and
         relying on the storage effect to skip the write is not enough: the
         in-memory copy is what gets persisted the moment the draft closes,
         so discarding a scenario kept its edits. */
      if (scenario) setScenario((draft) => ({ ...draft, [field]: apply(draft[field]) }))
      else if (field === 'holdings') setHoldings(apply)
      else setDebts(apply)
    },
    [scenario],
  )

  const setHolding = useCallback((assetClass, value) => edit('holdings', assetClass, value), [edit])
  const setDebt = useCallback((liabilityClass, value) => edit('debts', liabilityClass, value), [edit])

  const clearHoldings = useCallback(() => {
    if (scenario) {
      setScenario((draft) => ({ ...draft, holdings: {}, debts: {} }))
      return
    }
    setHoldings({})
    setDebts({})
  }, [scenario])

  /* Take the shared link up, or put it down. Either way the fragment goes:
     once the answer is on screen the numbers have no business staying in the
     address bar, and a refresh should not ask the same question again. */
  const dismissShared = useCallback(() => {
    setShared(null)
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  /* Point the whole dashboard at one group of one axis.

     The group is applied through pendingGroup rather than set here whenever
     the axis has to load first: setting it now would index the axis still on
     screen by a key it does not have. */
  const showGroup = useCallback(
    (axis, group) => {
      if (axis === dimension) setGroupKey(group)
      else {
        pendingGroup.current = group
        setDimension(axis)
      }
    },
    [dimension],
  )

  /* Record the reader's own group on one axis, and benchmark against it.
     Passing null forgets that axis and leaves the view where it is. */
  const chooseCohort = useCallback(
    (axis, group) => {
      setCohort((prev) => {
        const groups = { ...prev.groups }
        if (group) groups[axis] = group
        else delete groups[axis]
        const next = { groups, last: group ? axis : prev.last === axis ? null : prev.last }
        try {
          localStorage.setItem(COHORT_KEY, JSON.stringify(next))
        } catch {
          /* storage disabled -- the choice still applies for this session */
        }
        return next
      })
      if (group) showGroup(axis, group)
    },
    [showGroup],
  )

  /* Take a shared link up: its holdings, its debts, and the view it was taken
     from. Defined after showGroup because it needs it -- the group may belong
     to an axis that has to load first. */
  const showShared = useCallback(() => {
    if (!shared) return
    setHoldings(shared.holdings)
    setDebts(shared.debts)
    setInvestableOnly(shared.investableOnly)
    if (shared.periodMode) setPeriodMode(shared.periodMode)
    if (shared.dimension && shared.groupKey) showGroup(shared.dimension, shared.groupKey)
    dismissShared()
  }, [shared, showGroup, dismissShared])

  /* Start a draft from whatever is on screen (F38). Unnamed until it is
     saved, which is the difference between "try something" and "keep it". */
  const startScenario = useCallback(() => {
    setScenario({ name: '', holdings: { ...holdingsShown }, debts: { ...debtsShown } })
  }, [holdingsShown, debtsShown])

  const discardScenario = useCallback(() => setScenario(null), [])

  /* Make the draft the real portfolio. Deliberate and separate from saving a
     scenario: this is the one action here that overwrites what is stored. */
  const applyScenario = useCallback(() => {
    if (!scenario) return
    setHoldings({ ...scenario.holdings })
    setDebts({ ...scenario.debts })
    setScenario(null)
  }, [scenario])

  const saveScenario = useCallback(
    (name) => {
      if (!scenario) return null
      const chosen = (name ?? '').trim() || suggestName(scenarios, 'Scenario')
      const next = upsert(scenarios, { ...scenario, name: chosen, savedAt: new Date().toISOString() })
      setScenarios(next)
      writeScenarios(next)
      setScenario((draft) => (draft ? { ...draft, name: chosen } : draft))
      return chosen
    },
    [scenario, scenarios],
  )

  const openScenario = useCallback((name) => {
    setScenarios((list) => {
      const found = list.find((s) => s.name === name)
      if (found) setScenario({ name: found.name, holdings: { ...found.holdings }, debts: { ...found.debts } })
      return list
    })
  }, [])

  const deleteScenario = useCallback((name) => {
    setScenarios((list) => {
      const next = removeScenario(list, name)
      writeScenarios(next)
      return next
    })
  }, [])

  const save = useCallback(async () => {
    if (mode !== 'live') return { ok: false, reason: 'offline' }
    await api.savePortfolio(
      {
        name: slug === 'default' ? 'My portfolio' : slug,
        holdings: Object.entries(holdings).map(([asset_class, value]) => ({ asset_class, value })),
        debts: Object.entries(debts).map(([liability_class, value]) => ({ liability_class, value })),
      },
      slug,
    )
    const rows = await api.portfolios().catch(() => null)
    if (rows) setPortfolios(rows)
    return { ok: true }
  }, [holdings, debts, mode, slug])

  const updateToken = useCallback((next) => {
    setToken(next)
    setTokenState(next)
  }, [])

  // The group actually being shown, resolved against the selected period.
  const activeGroups = useMemo(() => {
    if (!benchmarks) return null
    if (periodMode === 'complete') return benchmarks.groupsComplete
    // A historical answer from another axis is stale by definition; fall back
    // to the current quarter until this axis's fetch lands.
    if (periodMode !== 'latest') {
      return historical?.dimension === dimension ? historical.groups : benchmarks.groups
    }
    return benchmarks.groups
  }, [benchmarks, periodMode, historical, dimension])

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
      holdings: holdingsShown,
      setHolding,
      debts: debtsShown,
      setDebt,
      clearHoldings,
      // The saved portfolio, for the card that compares it against a draft.
      savedHoldings: holdings,
      scenario,
      scenarios,
      startScenario,
      discardScenario,
      applyScenario,
      saveScenario,
      openScenario,
      deleteScenario,
      shared,
      showShared,
      dismissShared,
      save,
      groupKey,
      setGroupKey,
      dimension,
      setDimension,
      cohort,
      chooseCohort,
      showGroup,
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
      holdingsShown,
      setHolding,
      debts,
      debtsShown,
      setDebt,
      clearHoldings,
      scenario,
      scenarios,
      startScenario,
      discardScenario,
      applyScenario,
      saveScenario,
      openScenario,
      deleteScenario,
      shared,
      showShared,
      dismissShared,
      save,
      groupKey,
      dimension,
      cohort,
      chooseCohort,
      showGroup,
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
      // Carries its own, older date: the cutoffs are triennial, so this is
      // never measured in the same quarter as the allocation beside it.
      threshold: alloc.threshold ?? null,
      period: alloc.period,
      complete: alloc.complete,
      unavailable: alloc.unavailable || [],
      total_assets: alloc.total_assets,
      total_liabilities: alloc.total_liabilities,
      net_worth: alloc.net_worth,
      household_count: alloc.household_count ?? null,
      // Requested with investable_only=false, so these weights span the full
      // taxonomy and the client can derive either view.
      assets: alloc.weights,
      liabilities: alloc.debt_weights ?? {},
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
    liabilityClasses: latest.liability_classes ?? [],
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
    liabilityClasses: data.liability_classes ?? [],
    groups: data.groups,
    groupsComplete,
    trends: data.trends,
  }
}
