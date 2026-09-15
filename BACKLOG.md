# Financert backlog

Candidate work, scoped to what the Federal Reserve DFA can actually support.
Sizes are rough: **S** ≈ under an hour, **M** ≈ half a day, **L** ≈ a day or more.

Nothing here is committed to. Cut freely — the point is to choose from a real
list rather than invent features one at a time.

---

## Finding that reshapes this list

The app *used to* pull 80 individual series from FRED. The Fed also publishes
the **entire DFA as one 891 KB zip**, which it now reads instead:

```
https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip
```

It is better than the FRED path in four ways, all verified against the file:

1. **Six dimensions, not one.** Net worth *and* generation, education, income,
   race, and age — each with the same balance-sheet taxonomy.
2. **A finer taxonomy than we have.** The `-detail` files carry 31 columns
   including `Annuities` and `Household count`, which FRED does not expose as
   part of the block we use.
3. **One request instead of eighty.** Faster, and far less to go wrong.
4. **No publication lag.** This is the important one.

### Correction: the Q3 2024 cutoff was not a source limitation

The README, `CLAUDE.md` and both merged PRs say equity in noncorporate business
"is published with a longer lag than everything else." That is wrong, and I
stated it more than once. It is a **FRED artifact**, not a property of the DFA.

Verified: `Miscellaneous other equity` in `dfa-networth-levels-detail.csv`
equals `Unincorporated businesses` in the summary file exactly (4,480,940 for
the top 0.1% in 2024:Q3), and it is populated for **every quarter through
2026:Q1 with zero blanks**. FRED's mirror of that series stops at 2024-07-01;
the Fed's own file does not.

So the incomplete-quarter machinery — `unavailable`, `period=complete`, the
pending-residual relabelling — was built to work around a limitation that only
exists on the path we chose. Migrating the source removes the compromise
rather than managing it. That is why **F1 is first**: several items below get
much cheaper or disappear once it lands.

---

## Phase 0 — data source (do first)

**F1–F5 and F7 are done** — shipped in the commit that added this line. The
snapshot now comes from the bulk zip, covers every quarter through 2026 Q1
with no lagging class, and the unallocated residual fell from 1–3% to 0.00%.

| # | Feature | Size |
|---|---|---|
| ~~F1~~ ✅ | Fetch from the DFA bulk zip instead of 80 FRED series; keep the reconciliation check | L |
| ~~F2~~ ✅ | Parse the `-detail` CSVs into the existing asset taxonomy; map `Miscellaneous other equity` → `private_business` | M |
| ~~F3~~ ✅ | Retire the incomplete-quarter path once F1 proves every quarter is complete (keep the *code* for genuine future gaps, drop the UI compromise) | M |
| ~~F4~~ ✅ | Add `Annuities` as its own asset class (currently invisible) | S |
| ~~F5~~ ✅ | Ingest `Household count` per category — enables every per-household figure below | S |
| ~~F6~~ ✅ | Ingest `Minimum Wealth Cutoff` where populated: "what net worth puts you in the top 1%?" | S |
| ~~F7~~ ✅ | Pin the source: record the zip's published date and checksum in the snapshot | S |
| ~~F8~~ ✂︎ | Keep FRED as a documented fallback path if the zip fetch fails — **not building it**, see below | M |
| ~~F9~~ ✅ | Golden-file test: assert the parsed snapshot matches a committed fixture, so a Fed format change fails loudly | M |
| ~~F10~~ ✅ | Split the snapshot per dimension so the payload stays small | M |

**F9 is done, in two halves, because a golden file only catches half of what
F9 was asking for.** `tests/test_snapshot_golden.py` pins the parser to a
committed slice of the real archive — three quarters (the first, the last, and
one carrying the triennial cutoffs), every dimension, every category — so a
changed column mapping or composite rule shows up as a diff a reviewer can
read. But the fixture is frozen, so it can never notice the Fed changing
anything; only running `fetch_dfa.py` does that, and that runs by hand. So a
weekly workflow now parses the *live* archive with `--check`, which fails the
run on a renamed column or moved member and otherwise notes in the log whether
a new quarter has been published.

**F8 is deliberately not being built.** The FRED path is not a fallback, it is
a worse source: one dimension of six, and a mirror that stopped one series at
2024:Q3 — the "publication lag" this repo wrongly documented twice. A fallback
that silently produces a snapshot missing five axes, with the retired
incomplete-quarter machinery switched back on, is more dangerous than no
fallback. And there is no outage to protect against: the snapshot is committed,
so a failed fetch means the data stays at last quarter until someone retries.
What the failure actually needs is to be noticed, which is what the weekly
source check above does. If the zip ever moves for good, the honest fix is to
find its new home, not to fall back to a lagging mirror.

## Phase 1 — the five new dimensions

Each dimension is the same shape of work. Categories are confirmed from the file.

**F6 and F11-F15 are done, and F20 with them.** All five axes are ingested
and served: `GET /api/benchmarks?dimension=generation|education|income|race|age`,
with net worth still the default. Every one reconciled against the Fed's own
published totals on the first run, because they share the same 31 asset columns
-- checked before writing any of it, not discovered afterwards.

Two things the real files taught us. `Minimum Wealth Cutoff` (F6) was already
being read and then dropped, which is what made "what net worth puts you in the
top 1%?" unanswerable; it is stored now, but it is triennial Survey of Consumer
Finances data, so it exists for 12 of 147 quarters and never for the bottom
50%, which has no floor. And it is a *threshold*, not a quantity: the top 1%'s
floor is where its lowest constituent begins, so a composite takes the minimum
of its parts rather than their sum -- summing would have claimed a number about
five times too high. Blank reaches the snapshot as null, never 0.0, which would
read as "no wealth required".

**F10 is done too, and this is what prompted it.** Ingesting the five axes took
the snapshot from 605 KB to 4.3 MB (5 groups to 27, each with 147 quarters),
and answering a question about one axis parsed all six. It is now an 11 KB
index plus one file per dimension, read on demand:

```
serve one axis (index + networth) :  3.5 ms     637 KB
everything (what it used to cost) : 15.2 ms   3,324 KB
```

The frontend payload was never affected -- the embedded fallback ships only the
latest period and is still 58 KB.

**F17 and F21 are done.** `constants.DIMENSIONS` now describes all six axes --
member file, groups, categories, nesting -- and `WEALTH_GROUPS`, `GROUP_ORDER`,
`ALL_GROUPS` and `NESTED_GROUPS` are derived views of the net-worth entry, so
every existing import kept working unchanged. F11-F15 are now "fetch this
dimension's file and store it" rather than five copies of the grouping code.

One correction from reading the real archive: **net worth is the only dimension
with a nested group.** Income's `pct99to100` looks like it should nest the way
net worth's top 0.1% does, but the file publishes it as a disjoint slice beside
`pct80to99` -- so income's six groups sum where net worth's five do not. F20 was
right to warn against assuming the net-worth shape. `constants.summable()` is
the guard rail (F21): it refuses a nested group beside its siblings, and refuses
any mix of dimensions, which are separate cuts of the same households rather
than separate households.

| # | Feature | Size |
|---|---|---|
| ~~F11~~ ✅ | **Generation** axis — Silent, Baby Boom, Gen X, Millennial | M |
| ~~F12~~ ✅ | **Education** axis — No HS, HS, Some college, College | M |
| ~~F13~~ ✅ | **Income** axis — 0–20, 20–40, 40–60, 60–80, 80–99, 99–100 percentile | M |
| ~~F14~~ ✅ | **Race** axis — White, Black, Hispanic, Other | M |
| ~~F15~~ ✅ | **Age** axis — under 40, 40–54, 55–69, 70+ | M |
| ~~F16~~ ✅ | Dimension picker in the UI; the whole dashboard re-benchmarks against the chosen axis | L |
| ~~F17~~ ✅ | Generalise `WEALTH_GROUPS` into a dimension registry so a new axis is data, not code | L |
| ~~F18~~ ✅ | "Compare me to my cohort" — pick your generation/age/education, benchmark against it | M |
| ~~F19~~ ✅ | Cross-dimension view: your allocation against *all six* axes at once | M |
| ~~F20~~ ✅ | Per-dimension nesting rules (income has its own top-1% analogue; do not assume the net-worth shape) | M |
| ~~F21~~ ✅ | Guard rail: dimensions are separate populations and must never be summed together | S |
| ~~F22~~ ✅ | Framing review for the race axis — descriptive, sourced, no causal or prescriptive language | S |

**F18 covers three of the six axes, and that is the whole design.** Generation,
age and education are things a reader knows about themselves. Income percentile
is a fact about the national distribution that nobody knows offhand, and race
is a cut to browse, not a box to tick before the product will talk to you — both
stay in the axis picker, which is where browsing belongs.

The choices sit in `localStorage` and are never sent: a benchmark request
carries which cut is being shown, never who asked. Picking one moves the whole
dashboard onto that axis and group, and the most recent pick is where a
returning reader lands — otherwise the product asks who you are and then opens
on the top 1% anyway. Applying the group waits for the new axis's data (see
`pendingGroup` in `AppDataContext`), because setting it first would index the
axis still on screen by a key it does not have.

**F19 is the half of the same question that asks the reader nothing.** Rather
than "how do I compare with this group", it answers "whose balance sheet does
mine look like" six times over — `POST /api/analysis/placements` ranks the mix
against every group of every axis and returns the nearest on each. The rows
overlap by construction (a mix can sit nearest the Next 40% *and* nearest
college graduates), so the card says in as many words that they are six
readings of one balance sheet and do not add up.

It needed `allocation.analyse()` to stop assuming net worth: the axis is now
resolved from the group key, so `?group=millennial` compares against
millennials and ranks within the generation axis, where before it 404'd at the
router and would have read the net-worth file if it had not. This is also the
one part of the dashboard with no offline mirror — placing a portfolio reads
all six axes, and the embedded snapshot carries one — so it says so instead of
rendering an empty table.

**F22 came out as a framing pass over all six axes, not just race.** Singling
one axis out for a caveat is its own editorial claim, and the picker had made
six very different cuts look interchangeable: "Top 1%" is a position in a
distribution, "Baby Boom" is a birth cohort, and a reader switching between
them has nothing telling them so. Each axis now carries a one-line definition
under the picker — what the group is and whose definition it is, in all six
locales — and nothing about why groups differ.

The footer carries that part, because it is true of every axis: *"Where groups
differ, what differs is what they hold; this data records that and does not
explain why."* Its first paragraph also claimed the product compares against
"each wealth tier", which stopped being the whole truth at F11.

## Phase 2 — deeper analysis on data we already hold

**F24, F34 and F35 are done.** All three are pure functions over data the
snapshot already held, surfaced together as one "shape of each balance sheet"
table rather than three scattered numbers. They read cleanly across the tiers:
leverage climbs from 0.9% (top 0.1%) to 58.8% (bottom 50%), the liquid share
falls from 68.8% to 17.8%, and the largest holding flips from equities to real
estate between the Next 9% and the Next 40%.

**F28 is done, and it is the site's own headline question** — what net worth
puts you in the top 1% — which the product could not answer until F6 stored the
cutoffs. $11.1M, as measured in 2022:Q3.

Three things it had to get right. The cutoffs are triennial, so they never sit
on the latest quarter: `benchmarks.threshold()` reads back to the newest
published one and returns it **with its own date**, and every place it is shown
prints that date, because a 2022 threshold under a 2026 balance sheet is four
years of asset prices out of date. The figure is typed in rather than taken
from the portfolio: holdings are assets, these are net worth cutoffs, and
equating them would overstate anyone with a mortgage by the size of it. And the
bottom group has no floor at all, so a figure below every threshold is told
that, not placed in a band the source does not define.

It works offline (`build_fallback.py` now emits the resolved threshold) and it
covers the income axis too, where the same column is an income floor — the tile
label is keyed by which cutoff it is, since both sit under a net-worth figure.

**F29 turns the shares into money.** A toggle on the holdings table divides each
tier's assets by its household count: the top 1% holds $20.5M per household in
equities where the bottom 50% holds $8.7K. It is a *mean*, and the note says so
— the spread inside a tier is the whole story of the tier above it, and the top
0.1% sits inside the top 1% holding roughly five times its average.

The dollar figure is measured against the whole balance sheet, not the
investable subtotal, so the investable switch changes which rows are listed and
never how much a household holds. It reads through `benchmarkWeights()` rather
than `group.assets` directly, because the API sends shares there and the
embedded snapshot sends dollars — only the normalised form means the same thing
in both, and the offline and live figures now match to the cent.


| # | Feature | Size |
|---|---|---|
| F23 | Liabilities comparison — we fetch `total_liabilities` and only show a tile | M |
| ~~F24~~ ✅ | Leverage ratio (liabilities ÷ assets) vs each tier | S |
| F25 | Net-worth view alongside the assets view (assets less debt) | M |
| F26 | Debt mix: home mortgages vs consumer credit vs other, per tier | M |
| F27 | "Which tier is my *debt* like?" — the mirror of nearest-tier | M |
| ~~F28~~ ✅ | Net-worth percentile placement from `Minimum Wealth Cutoff` | M |
| ~~F29~~ ✅ | Per-household dollar figures using `Household count`, not just shares | M |
| F30 | Time travel: benchmark against any quarter since 1989, not just two | M |
| F31 | "Your gap over time" — hold your allocation, watch the gap move as the tier changes | L |
| F32 | Era comparison: the top 1% in 1989 vs 2000 vs 2026 | M |
| F33 | Biggest movers: which classes shifted most for a tier over a chosen window | M |
| ~~F34~~ ✅ | Concentration measure (share in the largest class) per tier | S |
| ~~F35~~ ✅ | Liquidity score using the existing `liquid` flag on asset classes | S |
| F36 | Rebalancing distance: smallest set of moves to reach a tier's mix | M |
| F37 | Dollar-terms gap: "you are $X under-allocated to equities" | S |
| F38 | Scenario mode: edit holdings without saving and see the gap move live (the preview endpoint already exists) | M |
| F39 | Save named scenarios and compare two side by side | L |
| F40 | Sensitivity: which single holding change most moves your nearest-tier | M |
| F41 | Aggregate check endpoint exposing the reconciliation residual per period | S |

## Phase 3 — presentation

| # | Feature | Size |
|---|---|---|
| F42 | Stacked-area composition chart over time (one tier, all classes) | M |
| F43 | Small multiples: every tier's composition on one screen | M |
| F44 | Scatter: liquidity vs concentration, one point per tier | M |
| F45 | Slope chart: your allocation vs a tier, class by class | M |
| F46 | Animated or scrubbable time axis on the trend chart | M |
| F47 | Table view toggle for every chart (accessibility) | S |
| F48 | Texture/pattern fills for colour-vision and print | M |
| F49 | Keyboard navigation through chart series | M |
| F50 | Empty, loading and error states audited across all three views | M |
| F51 | Print stylesheet | S |
| F52 | Shareable permalink encoding holdings in the URL | M |
| F53 | CSV export of your comparison | S |
| F54 | PNG export of a chart | M |
| F55 | Onboarding: prefill a plausible household so the app is not empty on arrival | S |
| F56 | Inline "where does this number come from" popovers citing the series | M |
| F57 | Mobile pass on the tiers table (currently scrolls in a container) | M |
| F58 | Dark-mode audit of the newer components | S |
| F59 | Number formatting review — tabular figures everywhere they align | S |
| F60 | Explain the `unallocated` residual in the UI, not just the README | S |

## Phase 4 — operational

| # | Feature | Size |
|---|---|---|
| F61 | Scheduled quarterly data refresh via GitHub Actions, opening a PR with the diff | M |
| F62 | Alert when the Fed publishes a new quarter | S |
| F63 | Snapshot diff tool: what changed between two refreshes | M |
| ~~F64~~ ◐ | Deployment config and a real deploy — config done (`Dockerfile.mcp`, `fly.toml`, the Pages workflow, and the verification probes in DEPLOY.md); the deploy itself needs a hosting account | M |
| F65 | Structured request logging | S |
| F66 | Response caching for benchmark endpoints | S |
| F67 | OpenAPI examples on every endpoint | S |
| F68 | Backend coverage reporting in CI | S |
| F69 | Frontend tests — currently lint and build only, no test runner | L |
| F70 | Visual regression snapshots for the charts | L |
| F71 | Dependency audit workflow | S |
| F72 ◐ | Data-source contract test hitting the live Fed zip weekly, so a format change surfaces before a refresh needs it — the test exists (`tests/test_dimensions.py`); it still needs a *scheduled* run, since it skips when the network is unreachable | M |

---

## Deliberately excluded

Not oversights. Each would make the product claim something the data cannot
support, or promise a security property it does not have:

- **Returns, performance, or backtesting.** The DFA is a stock of holdings at a
  point in time. It carries no prices and no flows; any return figure would be
  fabricated.
- **Recommendations, targets, or "optimal" allocations.** The product is
  descriptive by design, and the top 1%'s mix is not advice — a sixth of it is
  businesses they personally operate.
- **Price feeds and brokerage account linking.** Out of scope for a benchmark
  tool, and both carry credential-handling obligations this does not meet.
- **Real user accounts and multi-tenancy** (deferred, not rejected). The
  current bearer token is a shared secret; genuine isolation needs accounts,
  per-user ownership on `Portfolio`, and session handling. Worth doing before
  this is exposed beyond one household — it was simply not chosen for this
  round.

## Suggested order

**F1 → F2 → F3** first. They are foundational, they retire a documented
compromise, and they make Phase 1 mostly mechanical. **F17** before the
individual axes, so five dimensions are configuration rather than five
copies of the same code. Then Phase 2, which is where the product gets more
interesting per unit of work.
