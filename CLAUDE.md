# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this is

Financert tracks where the most powerful people put their money by unifying
three disclosure regimes — Polymarket positions, SEC Form 4 insider filings,
and U.S. House STOCK Act reports — into one schema, then scoring them against
each other.

The product is **not** the three feeds; each is public and free on its own. It
is the comparison: consensus, divergence, crowding, and late disclosure. If a
change makes the feeds prettier but the comparison weaker, it is the wrong
change.

- `backend/` — FastAPI + SQLite. Almost all logic lives here.
- `frontend/` — static, no build step, with an embedded fallback snapshot.

## Commands

Run from `backend/`:

```bash
make install   # venv + deps
make seed      # fabricated sample data, no network
make refresh   # real filings from all three sources (slow, hits the network)
make run       # uvicorn on :8000
make test      # pytest, fully offline
make lint      # ruff check
make fmt       # ruff import-sort + format
make fallback  # regenerate frontend/fallback-data.js from the current DB
```

Single test: `pytest tests/test_signals.py::test_congress_buying_what_insiders_sell_is_divergence`

Tests never touch `financert.db` — `tests/conftest.py` points
`FINANCERT_DATABASE_URL` at a throwaway temp file *before* importing any `app`
module, because the engine binds to that URL at import time. The schema is
rebuilt fresh for every test by an autouse fixture.

Ruff config (line length 120, `E F I UP B`, `E501` and `B008` ignored) and
pytest config live in `backend/pyproject.toml`. `B008` is off because
`db: Session = Depends(get_db)` is FastAPI's required idiom.

## Architecture

```
  Polymarket / SEC EDGAR / House Clerk
                 │
                 ▼
        sources/*.py  ──►  SourcePosition   (normalize; no DB, no scoring)
                 │
                 ▼
        services/ingest  ──►  Position      (idempotent on venue+external_id)
                 │
                 ▼
        services/scoring ──►  SubjectScore  (materialized, rebuilt wholesale)
                 │
                 ▼
        services/signals ──►  Signal        (the convergence engine)
                 │
                 ▼
              /api/*  ──►  dashboard
```

**Key invariant:** `/api/*` reads only from `SubjectScore`, `Signal`, and a
bounded window of recent `Position` rows — never an unbounded scan. Page loads
stay flat as history grows.

### Where things belong

- `constants.py` — every tunable weight and threshold. This is the single place
  a customer-facing "where does this number come from" question gets answered.
  Do not scatter magic numbers into services.
- `sources/*.py` — one upstream each. Adapters do no database work and no
  scoring, so each can be tested against a fixture of real upstream bytes.
- `services/power.py` — the "who counts" model, isolated because it is the most
  arguable judgment in the project.
- `services/scoring.py` — pure functions plus one bulk query. No N+1. This is
  the file a skeptical reader opens first; keep it boring.
- `services/signals.py` — the convergence engine. Every signal must be able to
  explain itself in `headline` and `detail`.

## Things that will bite you

**The congressional parser is the fragile part**, and it is fragile because the
source is a PDF, not because of anything we chose.

- Field labels are rendered with **NUL bytes** between characters
  (`F\x00\x00\x00\x00\x00 S\x00\x00\x00\x00\x00:` is "FILING STATUS:"). That NUL
  is load-bearing: it is how `_asset_name` knows a line is a label.
- The row anchor is `[asset class] code date date amount`, deliberately **not**
  anything involving the ticker. An earlier version keyed on `(TICKER) [XX]`
  and matched ticker-like text inside filings' free-text Description blocks,
  inventing transactions that were never filed. There is a regression test for
  this; do not "simplify" the anchor.
- PDF extraction runs the date and amount columns together
  (`03/16/202603/16/2026$1,001 - $15,000`), hence the missing `\s+` in the regex.
- Tickers appear three ways: in parentheses, exchange-qualified
  (`NYSEARCA: DIA`), and not at all (`Invesco QQQ`). The third is inferred and
  **flagged in `notes`** — never let an inferred ticker pass as a printed one.
- Unresolvable names are keyed `NAME:<...>` so they can never merge with a real
  symbol. Same idea for insiders: issuers filing "NONE" as their symbol are
  keyed `CIK:<...>`, not collected into a bogus subject called NONE.

**Other traps:**

- Congress discloses **brackets**, not amounts. Use the geometric mean
  (`sources/base.geometric_midpoint`), not the arithmetic one.
- Polymarket rows are **holdings snapshots, not trades**. External ids include
  the snapshot date so repeat runs build a series instead of colliding.
- Ingestion must stay idempotent. Filings get amended and republished;
  double-counting corrupts everything downstream and does so invisibly.
- The SEC blocks clients without a contact-bearing User-Agent and caps at 10
  req/s. All outbound traffic goes through `sources/http.py` for that reason.
- Adapters skip rows they cannot confidently parse and return warnings. A
  silent wrong number is much worse than a missing one — keep it that way.

## Style

Match the surrounding code. Comments explain *why*, especially where a choice
looks odd but is defending against a real upstream behaviour. Where the data is
uncertain, say so in the code, the API, and the UI rather than presenting a
guess with false confidence.
