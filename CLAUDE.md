# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this is

Financert answers one question with measured data: *how do the wealthiest
American households actually hold their money, and how does my portfolio
compare?* Enter holdings by asset class; see them beside the real allocation of
five wealth tiers, and which tier the mix most resembles.

The benchmark is the Federal Reserve's **Distributional Financial Accounts**
(DFA), pulled from FRED. Early prototype, two parts:

- `backend/` — FastAPI + SQLite. Almost all the logic. Reads a committed data
  snapshot; the app never needs the network at runtime.
- `frontend/` — Vite + React (plain `.jsx`, no TypeScript). Falls back to an
  embedded copy of the same data when the API is unreachable.

It is a **descriptive benchmarking tool, not investment advice**, and the
product is written that way throughout — copy included. Don't add
recommendations, price feeds, brokerage linking, or return/performance
tracking. The DFA is an allocation benchmark and cannot support those claims.

## Commands

### Backend (from `backend/`)

```bash
make install   # pip install -r requirements.txt -r requirements-dev.txt
make seed      # sample household portfolio, prints its gap vs the top 1%
make fetch     # python fetch_dfa.py — re-pull + validate + rewrite the snapshot
make run       # uvicorn app.main:app --reload --port 8000
make test      # pytest
make lint      # ruff check .
make fmt       # ruff check --select I --fix . && ruff format .
make clean     # remove financert.db and caches
```

Single test: `pytest tests/test_allocation.py::test_name -v`.

Ruff config (line length 120, `E F I UP B`; `E501` and `B008` ignored — `B008`
because `Depends(...)`/`Query(...)` in defaults is the FastAPI idiom) and
pytest config live in `backend/pyproject.toml`.

Tests never touch `financert.db` — `tests/conftest.py` points
`FINANCERT_DATABASE_URL` at a throwaway temp file *before* any `app` module is
imported, because the engine binds to the URL at import time.

### Frontend (from `frontend/`)

```bash
npm install
npm run dev       # :5173
npm run build     # -> dist/
npm run preview   # :4173
npx eslint . --ext .js,.jsx
```

ESLint config is `frontend/.eslintrc.cjs` — it lives beside `node_modules`
because ESLint resolves plugins relative to the config file, not the cwd.

### Docker (repo root)

```bash
docker compose up --build   # dashboard :8080, API :8000
```

## Architecture

```
  FRED (Federal Reserve DFA)
        │  fetch_dfa.py — 80 series, reconciled against the Fed's own totals
        ▼
  backend/data/dfa_snapshot.json   ← committed
        │
        ├─► services/benchmarks.py ──► /api/benchmarks · /api/benchmarks/trend
        │                                                        │
  holdings ──► SQLite ──► services/allocation.py ──► /api/analysis
                          (weights, gaps, nearest tier)
```

`constants.py` is the single place a "where does this number come from" answer
lives — the asset taxonomy and every FRED series id. Start there.
`services/allocation.py` is pure functions over dicts (no I/O, no framework)
because it is the code that encodes what the product actually *claims*.

`frontend/src/lib/analysis.js` deliberately **mirrors** `allocation.py` so the
dashboard works offline. Change a rule in one, change it in the other.

## The DFA data, and why it is awkward

Most of the difficulty in this repo is the source data. Three FRED naming
schemes coexist and all three are needed:

| Scheme | Example | Used for |
|---|---|---|
| Legacy block | `WFRBLT01014` | top1 / next9 / next40 / bottom50, offset arithmetic within a 27-slot block |
| Modern | `WFRBLTOP1DE`, `WFRBLDEN09` | deposits + pensions, whose legacy slots were discontinued in 2022 |
| Alphabetical block | `WFRBLTP1232` | the top 0.1%, ordered alphabetically — listed explicitly, not computed |

Series lookup is therefore per-group (`series_ids_for`), not one formula. The
modern scheme even orders its parts differently for the top 1%
(`WFRBLTOP1DE`) than for everyone else (`WFRBLDEN09`).

> **FRED is probably the wrong source, and the code's own comments overstate
> one thing.** The Fed publishes the whole DFA as a single zip
> (`releases/z1/dataviz/download/zips/dfa.zip`) covering six dimensions, with a
> finer taxonomy and no missing recent quarters.
>
> In particular: comments in `constants.py` and `fetch_dfa.py` describe equity
> in noncorporate business as *published* with a longer lag. That is wrong —
> it is a FRED artifact. In the Fed's own file the column is populated for
> every quarter with no blanks, and matches FRED exactly where both have data.
> Treat the incomplete-quarter machinery as working around a source we chose,
> not a limitation of the DFA. See `BACKLOG.md` (F1–F3).

Refreshing the data:

```bash
cd backend
python fetch_dfa.py --check    # pull + validate, write nothing
python fetch_dfa.py            # ...and rewrite the snapshot
python tools/build_fallback.py # regenerate the frontend's embedded copy
```

Always run `build_fallback.py` after `fetch_dfa.py`, or the offline dashboard
drifts from the API.

## Invariants — do not break these

These are load-bearing. Each one was a bug at some point, and each has tests.

1. **The `investable` view filters *both* sides.** Non-investable classes
   (consumer durables) come out of the user's holdings *and* the benchmark.
   Filtering only the benchmark leaves a user's car showing as an overweight
   against a benchmark that no longer counts cars.

2. **In an incomplete quarter, the residual must survive the investable
   filter.** `unallocated` normally holds a small definitional residual and is
   dropped. When a quarter is incomplete it *also* holds the classes the Fed
   has not published — dropping it renormalises everything else upward and
   silently overstates it. Guard on `row["complete"]`.

3. **The residual gets no over/underweight verdict when incomplete.** It is
   relabelled ("Not yet published (…)") and its status set to `pending`.
   "You are 16% underweight Unallocated" is not a statement anyone can act on.

4. **The top 0.1% is nested, not a fifth tier.** It sits *inside* the top 1%.
   It is excluded from `GROUP_ORDER` (the four groups that partition the
   population) and from the closest-tier ranking — ranking overlapping
   populations together is meaningless. It stays selectable as a benchmark and
   appears in `ALL_GROUPS`. Anything that sums or distributes across tiers must
   iterate `GROUP_ORDER`, never `ALL_GROUPS`.

5. **The taxonomy must reconcile against the Fed's own totals**, and
   `fetch_dfa.py` fails the refresh if it doesn't. The bounds are deliberately
   asymmetric: a ~1–3% *shortfall* is expected and documented, but an
   *overcount* has no benign explanation — it means a sub-item is being summed
   alongside the parent that already contains it. Several block offsets are
   sub-items of others (8/9 roll into 7; 19–24 roll into 18); including them
   double counts.

6. **Only `benchmarks.py` reads the snapshot; only `allocation.py` does the
   maths.** Routers stay thin. The database holds *only* user portfolios —
   never reference data, so a wiped DB costs nothing but holdings.

## Gotchas

- **`.gitignore` swallows `frontend/src/lib/`.** The repo uses GitHub's Python
  template, which ignores `lib/`. There is an explicit un-ignore at the bottom
  of `.gitignore`; if you add another directory named `lib`, expect the same.
  A negation cannot re-include a file whose *parent directory* is excluded, so
  the un-ignore has to target the directory itself.
- **Verify from a clean tree, not the working directory.** That gitignore trap
  produced a green local build and a red CI one. `git checkout-index -a -f
  --prefix=/tmp/x/` then build there.
- **`period` semantics.** `latest` (default) is the newest quarter and may lag
  a class; `complete` is the newest fully published one. Tests that assert a
  full breakdown must pass `period="complete"` or they break each time the Fed
  publishes.
- **CORS defaults to local origins, not `*`** — ports 5173, 4173 and 8080 on
  both `localhost` and `127.0.0.1`. `npm run preview` uses 4173; forgetting it
  silently drops the dashboard into offline mode.
- Run the app and look at it before calling UI work done. Label collisions,
  clipped values and mobile overflow do not show up in tests.

## Auth, and what it is not

`FINANCERT_API_TOKEN` gates every `/api/portfolio*` route (constant-time
compare, no-op when unset so local dev needs no setup). Benchmark routes stay
public — they serve public Federal Reserve data.

It is a **single shared secret, not a per-user login**: anyone holding it sees
every portfolio on the install. That fits a self-hosted single-household tool.
Real multi-tenancy needs accounts, per-user ownership on `Portfolio`, and
session handling — a different piece of work. Don't describe the current gate
as isolation.

## Deliberately not built

Price feeds, brokerage account linking, returns/performance tracking, and any
form of recommendation. Also: per-user accounts (see above). Don't "complete"
these without checking with the user first — each one implies a claim the DFA
cannot support, or a security model this doesn't have.
