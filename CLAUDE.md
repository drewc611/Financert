# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this is

Financert answers one question with measured data: *how do the wealthiest
American households actually hold their money, and how does my portfolio
compare?* Enter holdings by asset class; see them beside the real allocation of
five wealth tiers, and which tier the mix most resembles.

The benchmark is the Federal Reserve's **Distributional Financial Accounts**
(DFA), taken from the Fed's bulk download. Early prototype, two parts:

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
  Fed bulk DFA zip
        │  fetch_dfa.py — one download, reconciled against the Fed's own totals
        ▼
  backend/data/dfa_snapshot.json   ← committed
        │
        ├─► services/benchmarks.py ──► /api/benchmarks · /api/benchmarks/trend
        │                                                        │
  holdings ──► SQLite ──► services/allocation.py ──► /api/analysis
                          (weights, gaps, nearest tier)
```

`constants.py` is the single place a "where does this number come from" answer
lives — the asset taxonomy and the CSV column each bucket reads. Start there.
`services/allocation.py` is pure functions over dicts (no I/O, no framework)
because it is the code that encodes what the product actually *claims*.

`frontend/src/lib/analysis.js` deliberately **mirrors** `allocation.py` so the
dashboard works offline. Change a rule in one, change it in the other.

## The DFA data

The data is the Federal Reserve's Distributional Financial Accounts, taken
from the Fed's bulk zip:

    https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip

`fetch_dfa.py` downloads it, reads `dfa-networth-levels-detail.csv`, folds the
columns into the taxonomy in `constants.py`, and checks the result against the
Fed's own published `Assets` total before writing anything. The components
reconcile to within 0.0002%, so the tolerance is tight enough to catch a real
mapping error.

Two things about the file worth knowing:

- **The top 1% is not a row.** The file splits it at the 99.9th percentile
  into `TopPt1` and `RemainingTop1`; the combined tier is summed from both.
  See `categories_for`.
- **Names differ between the summary and detail files.** The detail file calls
  noncorporate business equity `Miscellaneous other equity`; the summary calls
  it `Unincorporated businesses`. Same column, verified equal on every row.

Refreshing:

```bash
cd backend
python fetch_dfa.py --check    # download + validate, write nothing
python fetch_dfa.py            # ...and rewrite the snapshot
python tools/build_fallback.py # regenerate the frontend's embedded copy
```

Always run `build_fallback.py` after `fetch_dfa.py`, or the offline dashboard
drifts from the API.

`federalreserve.gov` returns **403 to urllib's default user agent**, which is
why `fetch_dfa.py` sets one. Don't remove it, and don't replace it with a
browser string — identify the client honestly.

### History: this used to read FRED

The app previously pulled ~80 individual series from FRED, which forced three
awkward workarounds now gone. Kept here because the shape of the code still
carries their marks:

- FRED exposes the DFA under **three incompatible naming schemes** (legacy
  offset blocks, a modern scheme for deposits/pensions re-cut in 2022, and an
  alphabetical block for the top 0.1%). Hence per-group series lookup.
- FRED's block layout has **no `Annuities` column**, which is most of why the
  old taxonomy left 1–3% of assets unexplained. It is now its own class and
  the residual is 0.00%.
- FRED's mirror of noncorporate business equity **stopped at 2024-07-01**,
  which is what the incomplete-quarter machinery was built for. The Fed's own
  file has no such gap. The machinery is still present and still correct — see
  invariants 2 and 3 — it simply has nothing to act on in this source.

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
   `fetch_dfa.py` fails the refresh if it doesn't. Components now reconcile to
   within 0.0002%, so the bound is tight. The two directions are still kept
   separate: a small shortfall is rounding, but an
   *overcount* has no benign explanation — it means a sub-item is being summed
   alongside the parent that already contains it. Several block offsets are
   sub-items of others (8/9 roll into 7; 19–24 roll into 18); including them
   double counts.

6. **Only `benchmarks.py` reads the snapshot; only `allocation.py` does the
   maths.** Routers stay thin. The database holds *only* user portfolios —
   never reference data, so a wiped DB costs nothing but holdings.

## MCP server

`backend/mcp_server.py` exposes six read-only tools over MCP (stdio or
streamable HTTP), reusing `services/benchmarks.py` and `services/allocation.py`
directly — no HTTP hop, no database.

Two constraints here are deliberate and load-bearing for directory submission:

- **Portfolio storage is not exposed, and should not be.** Adding a write tool
  means auth, state, and a data-handling story, and would make every tool's
  `readOnlyHint` a lie. Persistence belongs on the REST API behind its token.
- **Every tool must stay annotated `readOnlyHint=true`.** Missing or wrong
  annotations are the most-cited directory rejection reason. A test guards it,
  including the camelCase wire format — the Python model is snake_case
  (`read_only_hint`), the wire is not.

The HTTP transport runs with DNS-rebinding protection on and requires
`--allowed-origin`. Don't disable it: without Origin validation a hosted server
answers requests forged by any page the user visits.

**Allowed hosts default to the allowed origins' hostnames**, not to `--host`.
A platform proxy terminates TLS and forwards the *public* domain in `Host`,
and the SDK matches `Host` exactly — deriving it from `--host` means a
deployment that set its origin correctly still 421s every request. Every flag
also reads an environment variable (`PORT`, `FINANCERT_MCP_*`) because that is
how container hosts configure a process.

Deployment lives in `backend/Dockerfile.mcp` and `backend/fly.toml` (in
`backend/` because the build context is the directory holding fly.toml), with
a `mcp` compose profile for exercising it locally. [DEPLOY.md](DEPLOY.md) has
three curl probes that must return 200/403/421; run them against any
deployment before treating it as done.

SDK note: this is `mcp` 2.x, where `FastMCP` was renamed `MCPServer` and
host/port moved to `run()` kwargs.

## Directory submission

[SUBMISSION.md](SUBMISSION.md) holds the listing copy in a fenced JSON block,
and `tests/test_submission_metadata.py` checks it against the published field
limits. Edit the JSON, not a copy of it — an overrun listing is a mechanical
rejection, and nobody counts 1,650 characters by hand twice. The MCPB manifest
is generated from that same block, so it is the single source of truth for
every channel.

**The desktop extension is the unblocked channel.** `make mcpb` builds
`dist/financert.mcpb` via `tools/build_mcpb.py`. The Team/Enterprise
requirement people quote belongs to the connectors *portal* (it lives in
organisation settings); desktop extensions use a separate form and carry a
local stdio server, so they need neither an org nor hosting.

Three things about the bundle are load-bearing:

- **`server.type` must stay `"uv"`.** A `"python"` bundle has to vendor its
  dependencies, and the MCP SDK needs pydantic, which is compiled and cannot
  be vendored portably. The spec then forbids `server/lib` and `server/venv`.
- **The bundle carries a *copy* of the module closure** (`MODULES` in
  `build_mcpb.py`), assembled at pack time and never committed — same
  arrangement as `build_fallback.py`. A module missing from that list cannot
  fail in a normal test, because in this repo the import always resolves; it
  fails as an extension that installs and does nothing. `test_mcpb_bundle.py`
  runs the packed bundle as a real stdio server in an empty directory for
  exactly that reason. Don't weaken it into an import check.
- **The manifest is generated, never hand-edited.** Listing fields come from
  SUBMISSION.md, the tools array from the running server.

## Security

[`SECURITY.md`](SECURITY.md) is the disclosure policy. Its "what is *not* a
vulnerability" list is load-bearing: the shared-token model and the open
benchmark routes are documented decisions, and without that section every
reader rediscovers them as bugs. Keep it in step with the code — if per-user
accounts ever land, that entry has to go.

[`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) records what has been checked, what
was fixed, and which risks are accepted deliberately. Read it before changing
the ingestion path or the auth path — several non-obvious guards are there for
reasons that are not visible from the code alone.

Two that are easy to undo by accident:

- **`fetch_dfa.py` bounds the download, the declared member size and the row
  count.** Without them a 161 KB zip expands to gigabytes and OOMs the
  process. Don't remove them when the Fed's file grows — raise them.
- **The token is compared as bytes, not str.** `secrets.compare_digest` raises
  `TypeError` on non-ASCII `str`, and header values are latin-1 on the wire,
  so comparing the str form turns a hostile token into a 500.

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

## Licence

MIT, from 2026. `LICENSE` at the repo root is the source of truth and three
things track it: `backend/mcpb/pyproject.toml`, the `license` field in the
generated MCPB manifest, and the README badge (which reads GitHub's own
detection, so it needs the file on `main`). A test asserts the manifest and
the file agree in *both* directions — claiming terms the repo does not carry
is as wrong as carrying terms the manifest omits.

## Deliberately not built

Price feeds, brokerage account linking, returns/performance tracking, and any
form of recommendation. Also: per-user accounts (see above). Don't "complete"
these without checking with the user first — each one implies a claim the DFA
cannot support, or a security model this doesn't have.
