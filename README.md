# Financert

**Where the most powerful people in the world actually put their money.**

Financert pulls three independent disclosure regimes into one dashboard:

| Source | What it is | Lag | Precision |
|---|---|---|---|
| **Polymarket** | Positions held by the largest traders in open prediction markets | live | exact |
| **Corporate insiders** | SEC Form 4 filings by officers, directors and 10% owners | ~2 days | exact shares and price |
| **Congress** | U.S. House periodic transaction reports filed under the STOCK Act | up to 45 days | dollar *brackets* only |

All three are public and individually free. Stacking them in one page is three
RSS readers in a trench coat. The reason they live in one schema is the
**comparison** between them.

## The actual idea

Every disclosure is normalized into one `Position` row — *a powerful person put
money behind a directional view on a subject* — and then scored against each
other. That makes four things visible that no single feed can show:

- **Divergence** — corporate insiders selling what members of Congress are
  buying. The most interesting pattern in the dataset, because the two groups
  have access to genuinely different non-public information: one about the
  company, one about what is about to happen *to* the company.
- **Consensus** — many powerful people, independently, moving the same way.
- **Crowding** — unusual concentration into one subject in a short window.
- **Late disclosure** — the STOCK Act allows 45 days. Filing on day 262 is a
  finding nobody can argue with.

Every signal states its own evidence in plain English. A number you cannot
interrogate is a number you should not act on.

## Quick start

```bash
cd backend && make install && make seed && make run
```

Then open `frontend/index.html` in a browser. The page tries the API at
`localhost:8000` and falls back to an embedded snapshot if it is not running —
the badge in the header always tells you which one you are looking at.

To pull **real** filings instead of the fabricated sample data:

```bash
cd backend && python refresh.py
```

That downloads the SEC daily index, dozens of congressional PDFs, and the top
Polymarket order books, one request at a time with a politeness delay. It takes
a few minutes. Narrow it with `--venues congress`, or go deeper with
`--sec-limit 400`.

## How the score works

A subject's conviction is the sum, over every position, of five multiplied
factors:

```
weight = power × conviction-quality × venue-trust × size × recency
```

| Factor | Means | Where |
|---|---|---|
| power | Who they are: officer seniority, congressional leadership, or capital at risk | `services/power.py` |
| conviction-quality | Whether the transaction reflects a decision at all | `constants.INSIDER_CODE_META` |
| venue-trust | How much the disclosure regime is worth | `constants.VENUE_TRUST_WEIGHT` |
| size | Log-scaled dollars | `scoring.size_factor` |
| recency | Exponential decay, 60-day half-life | `scoring.recency_factor` |

Every tunable number lives in `backend/app/constants.py`. That is deliberate:
there should be exactly one place to answer "where does this number come from".

**The single most important weighting** is that not every Form 4 line is a
decision. A vesting grant or shares withheld for taxes tells you nothing about
what the filer believes. An open-market purchase tells you a lot — officers
rarely buy their own stock for any reason other than thinking it is cheap. So
code `P` counts at 1.00 and code `A` at 0.05.

## What the numbers do and do not mean

Being straight about this matters more than the dashboard looking impressive.

- **Congressional amounts are brackets, never exact figures.** The law only
  requires a range. We keep both bounds and use the *geometric* mean as the
  point estimate — brackets span an order of magnitude, so the arithmetic mean
  systematically overstates the typical trade ($8,000 vs $3,875 for the
  smallest bracket).
- **Prediction-market rows are holdings snapshots, not trades.** The API
  exposes who holds what right now, not when they bought. `transacted_at` is
  the snapshot date and every row says so.
- **Polymarket traders are pseudonymous.** "Power" there is capital at risk,
  not office held. A whale may be a fund or a well-funded gambler.
- **Congressional seniority is a curated overlay.** Committee assignments are
  not published in the disclosure feed, so `CONGRESS_POWER_OVERRIDES` is a
  small hand-maintained map rather than a scraped approximation that would rot
  silently. Update it when leadership changes.
- **Some tickers are inferred.** ETFs are often filed with no printed symbol
  ("Invesco QQQ"). Those rows carry a note saying the ticker was inferred, and
  the UI shows it. Anything we cannot resolve is keyed under a `NAME:` prefix
  so it never merges with a real symbol.
- **Filings contain errors, and we reproduce them faithfully.** One filing in
  the test fixtures lists SPYB twice where its own description says SPY and
  SPYD. We report what was filed.
- **Insider coverage is sampled by default.** The SEC accepts ~1,000 Form 4s
  on a normal weekday; `refresh.py` takes the first 120 unless told otherwise,
  and says so in its warnings. A partial run never reads as a complete one.
- **The Senate is not covered.** Its eFD system gates search behind a session
  cookie and an agreement form. Scraping it would be brittle and rude. This is
  a real gap, not an oversight.

Not investment advice.

## Architecture

```
  Polymarket data-api ────┐
  (top holders/market)    │
                          │
  SEC EDGAR daily index ──┼──► sources/*.py ──► Position ──► scoring ──► SubjectScore
  (Form 4 XML)            │    (normalize)      (one         (weight)    (materialized)
                          │                      schema)         │            │
  House Clerk ZIP ────────┘                                      ▼            ▼
  (XML index → PDFs)                                          signals      /api/*
                                                            (convergence)     │
                                                                 │            ▼
                                                                 └────────► dashboard
```

The key invariant: `/api/*` reads only from the materialized `SubjectScore` and
`Signal` tables plus a bounded window of recent positions. Page loads stay flat
as the archive grows.

```
backend/app/
  config.py         infra settings from env (DB URL, CORS, user agents)
  constants.py      every tunable weight and threshold
  models.py         Actor, Position, SubjectScore, Signal, IngestRun
  time_utils.py     one naive-UTC clock + tolerant date parsing
  sources/
    base.py         the SourcePosition contract every adapter fulfils
    http.py         throttled client with the user agents the SEC requires
    polymarket.py   gamma markets + holder snapshots
    insiders.py     EDGAR daily index → Form 4 XML
    congress.py     House Clerk ZIP → XML index → PDF text → transaction table
  services/
    power.py        who counts, and how much
    ingest.py       idempotent upsert keyed on (venue, external_id)
    scoring.py      the five weight factors + the nightly rebuild
    signals.py      the convergence engine
    analytics.py    read-side aggregation
    refresh.py      orchestration; one venue failing never stops the others
  routers/          /api/*, /admin/*, /healthz
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/overview` | Everything the dashboard needs, one call |
| GET | `/api/positions?venue=` | Recent disclosed moves |
| GET | `/api/signals?kind=` | Convergence findings |
| GET | `/api/subjects?kind=` | Ranked by conviction |
| GET | `/api/subjects/{key}` | One subject with all the evidence behind it |
| GET | `/api/contested` | Where powerful money is most evenly split |
| GET | `/api/people?actor_type=` | People ranked by power |
| POST | `/admin/refresh` | Pull upstream, then rescore |
| POST | `/admin/recompute` | Rescore what is already stored, no network |
| GET | `/healthz` | Liveness plus row counts |

`/admin/*` is unauthenticated because the reference deployment is local and
single-user. **Put auth in front of it before exposing this to the internet** —
`/admin/refresh` makes dozens of outbound government requests and is trivially
abusable as an amplification vector.

## Development

```bash
cd backend
make test     # pytest, fully offline
make lint     # ruff check
make fmt      # ruff import-sort + format
make seed     # rebuild the sample dataset
make fallback # regenerate the frontend's offline snapshot
```

Parser tests run against **real** checked-in source documents — a genuine House
PTR and a genuine SEC Form 4 — in `backend/tests/fixtures/`. That is deliberate:
the failure mode for these parsers is not crashing, it is confidently returning
plausible wrong numbers, and only real documents catch that. Several tests are
explicit regression guards for bugs found during development, including one
where the congressional parser matched ticker-like text inside a filing's
free-text description block and invented transactions that were never filed.

The frontend has no build step and no `package.json`. `app.js` is a plain
non-module script so `index.html` works when opened straight off the
filesystem.

## Data sources

- [House Clerk financial disclosures](https://disclosures-clerk.house.gov/PublicDisclosure/FinancialDisclosure)
- [SEC EDGAR daily index](https://www.sec.gov/Archives/edgar/daily-index/) — see the
  [developer FAQ](https://www.sec.gov/os/webmaster-faq#developers) for the
  User-Agent and rate-limit rules this project follows
- [Polymarket Gamma API](https://docs.polymarket.com/)
