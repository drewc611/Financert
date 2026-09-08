# Financert

[![CI](https://github.com/drewc611/Financert/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/drewc611/Financert/actions/workflows/ci.yml)
[![CodeQL](https://github.com/drewc611/Financert/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/drewc611/Financert/actions/workflows/codeql.yml)
[![License](https://img.shields.io/github/license/drewc611/Financert)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/python-3.11-3776AB?logo=python&logoColor=white)](backend/pyproject.toml)
[![Data: Federal Reserve DFA](https://img.shields.io/badge/data-Federal%20Reserve%20DFA-1a4d2e)](https://www.federalreserve.gov/releases/z1/dataviz/dfa/)
[![MCP: 6 read-only tools](https://img.shields.io/badge/MCP-6%20read--only%20tools-8A63D2)](backend/mcp_server.py)

**Finance tracker of where to invest like the top 1%.**

Financert answers one question with real data: *how do the wealthiest American
households actually hold their money, and how does my portfolio compare?*

Enter what you own by asset class, and it shows your allocation beside the
measured allocation of the top 0.1%, the top 1%, the next 9%, the next 40% and
the bottom 50% — plus which of those tiers your mix most resembles.

The numbers are not estimates or rules of thumb. They come from the Federal
Reserve's [Distributional Financial Accounts][dfa] (DFA), which publish the
household balance sheet split by wealth percentile every quarter back to 1989.

[dfa]: https://www.federalreserve.gov/releases/z1/dataviz/dfa/

### What the data says

Share of investable assets, Q1 2026:

| Asset class | Top 0.1% | Top 1% | Next 9% | Next 40% | Bottom 50% |
|---|---:|---:|---:|---:|---:|
| Stocks & mutual funds | 54.2% | 50.3% | 31.3% | 11.3% | 7.1% |
| Private business equity | 19.0% | 16.0% | 8.0% | 4.2% | 2.0% |
| Real estate | 7.9% | 11.8% | 22.6% | 40.1% | 58.6% |
| Pensions & retirement | 1.8% | 5.0% | 19.5% | 26.1% | 14.3% |
| Cash & deposits | 6.0% | 6.2% | 7.7% | 9.2% | 9.6% |

The headline is the first three rows: the wealthiest hold their wealth in
businesses and equities, and the bottom half hold theirs in a house. The
pattern sharpens the further up you go — the top 0.1% hold a *smaller* share
in property than anyone else, and almost nothing in a pension.

**The top 0.1% is a subset of the top 1%, not a fifth tier.** It is excluded
from the four-way split everywhere the tiers are meant to partition the
population, including the "closest tier" ranking.

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
  Fed bulk DFA download (one zip, six dimensions)
        │  fetch_dfa.py — validated against the Fed's own totals
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

`fetch_dfa.py` downloads the Fed's bulk DFA zip (one request, no API key) and
checks that the asset taxonomy reconciles against the Fed's own published
totals before writing anything. A double-counted or missing bucket fails the
refresh instead of silently skewing every percentage on the site. The snapshot
records the archive's SHA-256, so a refresh that changes numbers can be told
from one that does not.

### One thing worth knowing about the source

The Fed splits the top 1% at the 99.9th percentile — `TopPt1` and
`RemainingTop1` — so the combined tier is summed from both rows, and the top
0.1% is available as its own (nested) benchmark.

Two earlier caveats are **gone**, both because the app used to read FRED rather
than the Fed's own file:

- The data no longer stops short of the current quarter. FRED's mirror of
  noncorporate business equity lagged by six quarters; the Fed's file has no
  such gap, so the newest quarter is complete.
- The `unallocated` residual fell from 1–3% to **0.00%**. Most of it was
  `Annuities`, a column FRED does not expose in the block the app used. It is
  now its own asset class, and the remainder is rounding.

The plumbing for an incomplete quarter is still there (`complete`,
`unavailable`, `period=complete`) in case the Fed ever does lag a series — it
simply has nothing to act on today.

## Layout

```
backend/
  app/
    constants.py       asset taxonomy + the DFA column each bucket reads (start here)
    config.py          env-driven settings      database.py  engine/session
    models.py          Portfolio + Holding      schemas.py   API contract
    services/
      benchmarks.py    reads the DFA snapshot
      allocation.py    weights, gaps, nearest tier (pure functions)
    routers/           benchmarks · portfolio · health
  data/dfa_snapshot.json   committed Federal Reserve data
  dependencies.py    session + the bearer-token guard
  fetch_dfa.py         refresh the snapshot from the Fed's bulk zip
  mcp_server.py        the six read-only tools, over MCP
  Dockerfile           REST API image      Dockerfile.mcp  MCP server image
  fly.toml             MCP server deployment (see DEPLOY.md)
  tools/build_fallback.py  regenerate the frontend's embedded copy
  seed.py              sample portfolio       tests/  pytest suite
frontend/
  src/
    lib/               api · analysis (mirrors allocation.py) · format · theme
    components/        AllocationChart · GapChart · TrendChart · Tooltip
    views/             Compare · Portfolio · Benchmarks
```

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/healthz` | — | liveness, snapshot state, and the deployment's auth/CORS posture |
| `GET` | `/api/benchmarks` | — | every tier for one period; `period` (`latest`/`complete`/a date), `investable_only` |
| `GET` | `/api/benchmarks/trend` | — | one asset class's share over time; `group`, `asset_class` |
| `GET` | `/api/portfolios` | token | list every portfolio on this install |
| `GET` | `/api/portfolio` | token | one portfolio; `slug` |
| `PUT` | `/api/portfolio` | token | create or fully replace it; `slug` |
| `DELETE` | `/api/portfolio` | token | delete it; `slug` |
| `GET` | `/api/analysis` | token | compare a saved portfolio against a tier |
| `POST` | `/api/analysis/preview` | token | compare unsaved holdings, for live editing |

Interactive docs at `http://localhost:8000/docs`.

## Deploying

[`DEPLOY.md`](DEPLOY.md) is the full guide, including hosting the MCP server
(`backend/Dockerfile.mcp`, `backend/fly.toml`) and publishing the privacy
policy. For the REST API, two environment variables matter, and `/healthz`
reports both so a live deployment can be checked without guessing:

```bash
FINANCERT_API_TOKEN=$(openssl rand -hex 32)   # gates every /api/portfolio* route
FINANCERT_CORS_ORIGINS=https://your.domain    # defaults to localhost only
```

- **`FINANCERT_API_TOKEN`** — unset means no authentication, which is right for
  `make run` on a laptop and wrong for anything reachable from elsewhere. When
  set, the portfolio routes require `Authorization: Bearer <token>`; the
  benchmark routes stay open because they serve public Federal Reserve data.
  The dashboard has a field for the token under **Your portfolio → API token**.
- **`FINANCERT_CORS_ORIGINS`** — defaults to the local dev origins (ports 5173,
  4173 and 8080 on both `localhost` and `127.0.0.1`), *not* `*`. Credentials
  are only sent when the list is a real allowlist, since browsers reject
  wildcard-plus-credentials anyway.

The token is a single shared secret, not a per-user login: anyone holding it
sees every portfolio on the install. That fits a self-hosted single-household
tool. Multi-tenant use would need real accounts — see the scope note below.

## Development

```bash
cd backend  && make test && make lint     # pytest + ruff
cd frontend && npx eslint . --ext .js,.jsx && npm run build
```

CI runs both on every push and pull request.

Tests never touch `financert.db` — `tests/conftest.py` points
`FINANCERT_DATABASE_URL` at a throwaway temp file *before* any `app` module is
imported, because the engine binds to the URL at import time.

## Use it from an AI assistant

`backend/mcp_server.py` exposes the benchmark data and the comparison as MCP
tools, so an assistant can answer "how does my portfolio compare to the top
1%?" directly.

```bash
cd backend
make mcp        # stdio, for a local client
make mcp-http   # streamable HTTP, for hosting
make mcpb       # package as a desktop extension -> dist/financert.mcpb
```

It is deliberately the **read-only subset** — six tools, no portfolio storage,
no auth, nothing retained. Holdings passed to `compare_allocation` are used to
compute the answer and discarded.

`make mcpb` packages the same six tools as a **desktop extension** — an
`.mcpb` bundle carrying a local stdio server. That is the distribution route
that needs no hosting and no Team/Enterprise organisation, so it is the one to
take first.

[DISTRIBUTION.md](DISTRIBUTION.md) covers which channels are viable and why,
[DEPLOY.md](DEPLOY.md) how to stand up the HTTPS endpoint the hosted ones need,
and [SUBMISSION.md](SUBMISSION.md) the listing copy and reviewer test cases.

## Security

[`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) covers the audit: what was found and
fixed, what was checked and clean, and which risks are accepted on purpose.
[`PRIVACY.md`](PRIVACY.md) records what each component stores — a draft, not
yet legally reviewed.

## Notes on scope

Financert is an early prototype and single-household by design. Portfolios are
addressed by slug, so one install can hold several (yours, a spouse's, a
"what if" variant), but they share one token and one database — there are no
user accounts and no per-user isolation. Treat the database as private to
whoever holds the token.

Making this genuinely multi-tenant means real accounts, per-user ownership on
`Portfolio`, and session handling. That is a different piece of work from the
shared-secret gate that is here, and the gate should not be mistaken for it.

Deliberately not built: price feeds, brokerage account linking, returns or
performance tracking, and any form of recommendation. The DFA is an allocation
benchmark, and those features would all imply claims it cannot support.
