# Financert

**Finance tracker of where to invest like the top 1%.**

Financert answers one question with real data: *how do the wealthiest American
households actually hold their money, and how does my portfolio compare?*

Enter what you own by asset class, and it shows your allocation beside the
measured allocation of the top 1%, the next 9%, the next 40% and the bottom
50% — plus which of those tiers your mix most resembles.

The numbers are not estimates or rules of thumb. They come from the Federal
Reserve's [Distributional Financial Accounts][dfa] (DFA), which publish the
household balance sheet split by wealth percentile every quarter back to 1989.

[dfa]: https://www.federalreserve.gov/releases/z1/dataviz/dfa/

### What the data says

As of Q3 2024, share of investable assets:

| Asset class | Top 1% | Next 9% | Next 40% | Bottom 50% |
|---|---:|---:|---:|---:|
| Stocks & mutual funds | 48.5% | 30.1% | 10.8% | 6.4% |
| Private business equity | 16.7% | 8.3% | 4.3% | 2.1% |
| Real estate | 12.8% | 24.1% | 41.7% | 60.6% |
| Pensions & retirement | 5.3% | 20.3% | 26.7% | 14.0% |
| Cash & deposits | 6.5% | 8.1% | 9.3% | 9.4% |

The headline is the first and third rows: the top 1% hold their wealth in
businesses and equities, and the bottom half hold theirs in a house.

> **This is a descriptive tool, not investment advice.** It reports what the
> data says; it does not recommend holdings. Copying the top 1%'s allocation
> would not reproduce their returns — a sixth of their assets is equity in
> private businesses they own and operate, and the data says nothing about
> risk, taxes, time horizon, or leverage.

## Quick start

```bash
# Backend — API on :8000
cd backend
make install
make seed          # optional: a sample household to look at
make run

# Frontend — dashboard on :5173
cd frontend
npm install
npm run dev
```

Or the whole stack:

```bash
docker compose up --build   # dashboard :8080, API :8000
```

The dashboard tries the API first and falls back to an embedded snapshot of the
same Federal Reserve data if it can't reach it (900 ms timeout), so it renders
standalone — the badge in the header shows which mode it's in.

## How it works

```
  FRED (Federal Reserve DFA)
        │  fetch_dfa.py — 64 series, validated against the Fed's own totals
        ▼
  backend/data/dfa_snapshot.json   ← committed; the app never needs the network
        │
        ├─► services/benchmarks.py ──► /api/benchmarks
        │                              /api/benchmarks/trend ──► dashboard
        │                                                            ▲
  your holdings ──► SQLite ──► services/allocation.py ──► /api/analysis
                               (weights, gaps, nearest tier)
```

### The three things it computes

1. **Allocation** — your holdings and each tier's, normalised to shares.
2. **Gap** — per asset class, your share minus the benchmark's, in percentage
   points. Differences under 1.5pp are reported as "in line"; the DFA is built
   from survey weights and finer precision would imply accuracy it doesn't have.
3. **Nearest tier** — cosine similarity between your allocation and each tier's,
   so "your mix looks like the next 40%" is a measurement rather than a vibe.

All of it lives in [`backend/app/services/allocation.py`][alloc] as pure
functions over dicts — no I/O, no framework — because it is the code most worth
reading to understand what the product actually claims.

[alloc]: backend/app/services/allocation.py

### The `investable` view

By default both sides of the comparison drop **consumer durables** (the Fed
counts cars and appliances as household assets) and the unallocated residual,
then renormalise. Otherwise you would be comparing your brokerage account
against the Fed's estimate of everyone's used cars. Untick it to see the full
balance sheet.

## Refreshing the data

The DFA lands roughly ten weeks after quarter end.

```bash
cd backend
python fetch_dfa.py            # pull, validate, rewrite the snapshot
python fetch_dfa.py --check    # pull and validate, write nothing
python tools/build_fallback.py # regenerate the frontend's embedded copy
```

`fetch_dfa.py` pulls 64 series from FRED (no API key needed) and checks that the
asset taxonomy reconciles against the Fed's own published totals before writing
anything. A double-counted or missing bucket fails the refresh instead of
silently skewing every percentage on the site.

### Two things the source data makes awkward

Both are handled explicitly rather than papered over — see the comments in
[`backend/app/constants.py`](backend/app/constants.py).

- **The snapshot ends at Q3 2024, not the current quarter.** *Equity in
  noncorporate business* is published with a longer lag than everything else,
  and it is 17% of the top 1%'s assets. Showing a "latest" allocation missing
  its second-largest component would be worse than being two quarters behind,
  so the snapshot stops at the last quarter where every bucket exists.
- **An `unallocated` residual of ~1–3%.** The DFA's published components don't
  quite sum to its published totals, and the modern pension series don't quite
  match the legacy ones they replaced. Rather than hide the difference inside a
  bucket it doesn't belong to, it gets its own line, and percentages are taken
  against the Fed's control total so they still sum to 100%.

## Layout

```
backend/
  app/
    constants.py       asset taxonomy + the FRED series map (start here)
    config.py          env-driven settings      database.py  engine/session
    models.py          Portfolio + Holding      schemas.py   API contract
    services/
      benchmarks.py    reads the DFA snapshot
      allocation.py    weights, gaps, nearest tier (pure functions)
    routers/           benchmarks · portfolio · health
  data/dfa_snapshot.json   committed Federal Reserve data
  fetch_dfa.py         refresh the snapshot from FRED
  tools/build_fallback.py  regenerate the frontend's embedded copy
  seed.py              sample portfolio       tests/  pytest suite
frontend/
  src/
    lib/               api · analysis (mirrors allocation.py) · format · theme
    components/        AllocationChart · GapChart · TrendChart · Tooltip
    views/             Compare · Portfolio · Benchmarks
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/healthz` | liveness + whether the snapshot loaded |
| `GET` | `/api/benchmarks` | all four tiers for one period; `period`, `investable_only` |
| `GET` | `/api/benchmarks/trend` | one asset class's share over time; `group`, `asset_class` |
| `GET` | `/api/portfolio` | the saved portfolio |
| `PUT` | `/api/portfolio` | create or fully replace it |
| `DELETE` | `/api/portfolio` | delete it |
| `GET` | `/api/analysis` | compare the saved portfolio against a tier |
| `POST` | `/api/analysis/preview` | compare unsaved holdings, for live editing |

Interactive docs at `http://localhost:8000/docs`.

## Development

```bash
cd backend  && make test && make lint     # pytest + ruff
cd frontend && npx eslint . --ext .js,.jsx && npm run build
```

CI runs both on every push and pull request.

Tests never touch `financert.db` — `tests/conftest.py` points
`FINANCERT_DATABASE_URL` at a throwaway temp file *before* any `app` module is
imported, because the engine binds to the URL at import time.

## Notes on scope

Financert is an early prototype and single-user by design: no authentication,
one portfolio per install, holdings stored in SQLite plus `localStorage`. Treat
the database as private to whoever is running it. Before putting it anywhere
public, set `FINANCERT_CORS_ORIGINS` to a real origin and put authentication in
front of `/api/portfolio`.

Deliberately not built: price feeds, brokerage account linking, returns or
performance tracking, and any form of recommendation. The DFA is an allocation
benchmark, and those features would all imply claims it cannot support.
