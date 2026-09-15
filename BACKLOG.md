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

**F26 and F23 are done together, because the debt mix is the liabilities
comparison.** The snapshot carried one number for the whole of what a tier
owed; it now carries the five columns the Fed publishes, and the tiers view has
a second table for them. The file publishes liabilities as a tree
(`Liabilities` = loans + deferred life premiums, loans = four columns), so only
the leaves are stored and `fetch_dfa.py` reconciles their sum against the
published total for every row of every axis — summing a parent beside its
children is the one mistake that would make every debt percentage wrong in the
same direction, and the same check already guards the asset side.

What it shows is worth the work: mortgages are 82% of the Next 9%'s borrowing
but only 51% of the bottom 50%'s, who carry **43%** of their debt as consumer
credit against 12–20% in the middle; the top 1% carries 26% as margin and
policy loans, where no other tier is above 6%.

**F25 and F27 needed the app to ask what the reader owes**, which it never
did: a portfolio of holdings is assets, and every tier in this product is
defined by net worth. The portfolio now carries an optional debt side (a
separate `debts` table, so an existing database picks it up from `create_all`
rather than needing a migration this project has no machinery for), states net
worth as assets less debts, and offers that figure to the threshold card from
F28 instead of asking for it to be retyped.

F27 is the mirror of nearest-tier over the debt mix, and it is a genuinely
different answer rather than a restatement: card debt places in the bottom 50%,
margin and policy loans in the top 1%, a mortgage in the Next 9%. A household
can hold assets like one tier and owe like another, because a mortgage and a
brokerage account are not the same decision.

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
| ~~F23~~ ✅ | Liabilities comparison — we fetch `total_liabilities` and only show a tile | M |
| ~~F24~~ ✅ | Leverage ratio (liabilities ÷ assets) vs each tier | S |
| ~~F25~~ ✅ | Net-worth view alongside the assets view (assets less debt) | M |
| ~~F26~~ ✅ | Debt mix: home mortgages vs consumer credit vs other, per tier | M |
| ~~F27~~ ✅ | "Which tier is my *debt* like?" — the mirror of nearest-tier | M |
| ~~F28~~ ✅ | Net-worth percentile placement from `Minimum Wealth Cutoff` | M |
| ~~F29~~ ✅ | Per-household dollar figures using `Household count`, not just shares | M |
| ~~F30~~ ✅ | Time travel: benchmark against any quarter since 1989, not just two | M |
| F31 | "Your gap over time" — hold your allocation, watch the gap move as the tier changes | L |
| ~~F32~~ ✅ | Era comparison: the top 1% in 1989 vs 2000 vs 2026 | M |
| ~~F33~~ ✅ | Biggest movers: which classes shifted most for a tier over a chosen window | M |
| ~~F34~~ ✅ | Concentration measure (share in the largest class) per tier | S |
| ~~F35~~ ✅ | Liquidity score using the existing `liquid` flag on asset classes | S |
| ~~F36~~ ✅ | Rebalancing distance: smallest set of moves to reach a tier's mix | M |
| ~~F37~~ ✅ | Dollar-terms gap: "you are $X under-allocated to equities" | S |
| F38 | Scenario mode: edit holdings without saving and see the gap move live (the preview endpoint already exists) | M |
| F39 | Save named scenarios and compare two side by side | L |
| ~~F40~~ ✅ | Sensitivity: which single holding change most moves your nearest-tier | M |
| ~~F41~~ ✅ | Aggregate check endpoint exposing the reconciliation residual per period | S |

**F30 is done.** The dashboard held two quarters -- the newest and the newest
fully published one -- which is what the comparison needs and none of what 147
quarters of history are for. Any of them can be selected now, on both views and
on every axis; the top 1% held $15.3T in Q1 2009 against $55T today, and the
threshold beside it resolves to that era's survey (Q3 2007) rather than to
2022.

A historical quarter is fetched on demand and kept beside the two the dashboard
always holds, so coming back to the current quarter costs no request and the
previous answer stays on screen while a new one loads. The cached answer is
tagged with the axis it came from: clearing it when the axis changes instead
raced the main fetch, and half the time the wipe landed after the answer --
caught in the browser, switching to the generation axis with 2000 selected.

**F36 and F40 are one card**, because the second is a sentence about the
first. The moves are a pairing of the gap table's surpluses to its deficits,
largest to largest, and the distance is half the sum of the absolute gaps --
moving a dollar closes an overweight and an underweight at once, so counting it
twice would double the answer. Gaps inside the tolerance are left alone: they
are within what the survey can resolve, and "sell $300 of annuities" is not a
finding.

F40 asks which single class, brought to the benchmark, moves the similarity
most -- each measured from the same starting point rather than compounding,
because the answer to "what one change" has to be one change.

Both live in `lib/analysis.js` rather than the API. They are arithmetic over
numbers the client already holds, they work offline for the same reason the
gap table does, and the backend has no consumer for them.

The framing needed care: this is the one card in the product that could read as
advice. It says what matching *would mean* and never that anyone should, and
the footer disclaimer is unchanged.

**F33 and F32 are one card**, because the biggest movers *are* the era
comparison: a "What changed" table showing one group's shares at two quarters
and the difference, biggest move first. The top 1% went from 20.2% to 50.3% in
equities since 1989 while private business equity fell 13.6 points; the bottom
50% lost 11.2 points of real estate share between 2007 and 2026.

Shares rather than dollars, deliberately: every tier's balance sheet grew over
any long window, so a dollar ranking would sort the classes by asset prices
instead of by what changed about the mix.

F32 asked for three eras side by side and this shows two at a time. A third
column doubles the width of a table that already scrolls on a phone, and the
pairwise difference is what carries the finding -- with F30's period control,
any pair of the 147 quarters is reachable.

**F37, F41 and F60 are done together**, because they are the same idea at three
scales: say what the number means in terms a reader can act on or check.

F37 puts the gap in money — a percentage point is the comparison, but the
dollar figure is what it would take to close it, and that is the one people
act on. F41 publishes the reconciliation residual per quarter at
`/api/benchmarks/reconciliation`: every percentage on the site is a share of
the Fed's own published total, and this is the part the taxonomy does not name
(under 0.0002% in all 147 quarters, on every axis — now checkable rather than
asserted). F60 says the same thing in the UI where the residual has a row.

F60 turned up a gap of its own: the tiers table said "share of investable
assets" and the switch that changes it lived only on the Compare tab, so the
residual row was unreachable from the page that shows it. The tiers view has
the switch now.

## Phase 3 — presentation

| # | Feature | Size |
|---|---|---|
| F42 | Stacked-area composition chart over time (one tier, all classes) | M |
| F43 | Small multiples: every tier's composition on one screen | M |
| F44 | Scatter: liquidity vs concentration, one point per tier | M |
| F45 | Slope chart: your allocation vs a tier, class by class | M |
| F46 | Animated or scrubbable time axis on the trend chart | M |
| ~~F47~~ ✅ | Table view toggle for every chart (accessibility) | S |
| F48 | Texture/pattern fills for colour-vision and print | M |
| F49 | Keyboard navigation through chart series | M |
| F50 | Empty, loading and error states audited across all three views | M |
| ~~F51~~ ✅ | Print stylesheet | S |
| F52 | Shareable permalink encoding holdings in the URL | M |
| ~~F53~~ ✅ | CSV export of your comparison | S |
| F54 | PNG export of a chart | M |
| ~~F55~~ ✅ | Onboarding: prefill a plausible household so the app is not empty on arrival | S |
| F56 | Inline "where does this number come from" popovers citing the series | M |
| F57 | Mobile pass on the tiers table (currently scrolls in a container) | M |
| ~~F58~~ ✅ | Dark-mode audit of the newer components | S |
| ~~F59~~ ✅ | Number formatting review — tabular figures everywhere they align | S |
| ~~F60~~ ✅ | Explain the `unallocated` residual in the UI, not just the README | S |

**F61 and F62 are the same workflow**: the pull request *is* the alert, and it
is better than one, because it arrives as a reviewable diff rather than as a
notification someone still has to act on. Weekly, opening a PR when the
published archive differs from the committed snapshot; `fetch_dfa.py` fails the
run rather than writing when the taxonomy stops reconciling, so a bad refresh
never reaches a pull request.

One thing the rehearsal caught: the comparison has to be the archive's
**checksum**, not `git diff`. Every run rewrites `retrieved_at` -- which is the
point of that field -- so a diff-based test would have opened an identical pull
request every week until someone turned the workflow off. The checksum is what
F7 put in the snapshot for exactly this: telling a refresh that changes numbers
from one that does not.

**F68 and F71 land with the ESLint 9 migration**, which is what made an audit
gate possible: the last advisory on either side was `js-yaml` via ESLint 8, and
flat config retires it. `npm audit` and `pip-audit` both report clean, so the
workflow is a gate rather than a report -- the first thing it fails on will be
new. It runs weekly and on any dependency change.

F68 prints a per-file coverage table (96% of `app/`) with no threshold: a
number that fails the build is a decision for whoever owns the project, not a
default I should pick for them.

**F69 is half done, and the half that was missing.** The frontend had lint and
build; `src/lib/analysis.js` had neither, and it is what the dashboard computes
with — offline it is the *only* implementation. Vitest now covers it and the
formatters: 46 tests over weights, gaps, shape metrics, threshold placement,
rebalancing, sensitivity and the locale-sensitive number formatting, wired into
CI.

Two of those tests are a bug that shipped: the API sends shares where the
embedded snapshot sends dollars, and reading the raw field made the offline
tables wrong by a factor of a million. "Normalises either form" is now a test
rather than a thing to remember.

Components are still verified by opening the app, which is why this is ◐ rather
than done. That needs a DOM testing library and a judgement about how much
component testing a five-view app earns.

Vite went 5 → 8 with it (the version Vitest needs), which cleared three
pre-existing advisories including a high. The one left is `js-yaml` via ESLint
8, which wants the flat-config migration.

**F53 and F55 are the two ends of the same session**: arriving with nothing,
and leaving with something.

F53 writes the comparison as a CSV in the browser -- offline included, and
nothing about the portfolio leaves the page to produce it. It names the
benchmark, the quarter and the scope in the file, because a spreadsheet three
months from now has no other way to know what it is a comparison of, and it
writes plain decimals rather than localised percentages: "12,3 %" imports as
text or as 123. The scope row is TRUE/FALSE against an existing label, since
the on-screen wording is a sentence fragment in several languages.

F55 loads a plausible household -- roughly the median American shape, most of
it in the house, against a mortgage -- on an explicit click, labelled as an
example, cleared by the same button that clears anything else. An example a
reader cannot tell from their own numbers would be worse than an empty page.

**F47, F51, F58 and F59 are one pass over how the pages read.**

F47: the charts carried `role="img"` and a label, which says what the picture
is and nothing about what it shows. Each now has a switch to the same numbers
as a table -- which is also what a chart is for anyone who wants the number
rather than the shape. GapChart is the exception: the Compare view already
prints those rows as a table directly beneath it, and a second copy behind a
toggle would be two tables of one thing.

F51: a comparison is a thing people take to someone else, and the screen
version printed as a wall of dark boxes with controls in it. Print now drops
what cannot be clicked on paper, flattens the surfaces, and keeps the footer's
provenance -- a page of figures with no source on it is the one thing worth
refusing to hand over.

F58 found two real defects, both only visible in a dark browser. Printing from
dark mode produced **white text on white paper**: the print block redefined the
palette on bare `:root`, which loses on specificity to
`:root:not([data-theme="light"])`. And the primary button sat at 3.64:1 against
its own white text -- under AA for 14px -- because it borrowed `--series-you`,
a *chart series* colour chosen to read against the page rather than under white
text. It has its own token now. A contrast sweep over every text node in all
three views, both themes, is otherwise clean.

F59: the tile values are the largest figures on the page and sit in a row where
they are read down as much as across, so they get tabular figures like every
other column of numbers already had.

## Phase 4 — operational

| # | Feature | Size |
|---|---|---|
| ~~F61~~ ✅ | Scheduled quarterly data refresh via GitHub Actions, opening a PR with the diff | M |
| ~~F62~~ ✅ | Alert when the Fed publishes a new quarter | S |
| F63 | Snapshot diff tool: what changed between two refreshes | M |
| ~~F64~~ ◐ | Deployment config and a real deploy — config done (`Dockerfile.mcp`, `fly.toml`, the Pages workflow, and the verification probes in DEPLOY.md); the deploy itself needs a hosting account | M |
| ~~F65~~ ✅ | Structured request logging | S |
| ~~F66~~ ✅ | Response caching for benchmark endpoints | S |
| ~~F67~~ ✅ | OpenAPI examples on every endpoint | S |
| ~~F68~~ ✅ | Backend coverage reporting in CI | S |
| ~~F69~~ ◐ | Frontend tests — Vitest over `src/lib`; components still browser-verified | L |
| F70 | Visual regression snapshots for the charts | L |
| ~~F71~~ ✅ | Dependency audit workflow | S |
| ~~F72~~ ✅ | Data-source contract test hitting the live Fed zip weekly, so a format change surfaces before a refresh needs it | M |

**F65, F66 and F67 are one pass over what the API does either side of a
handler**, and two of them are decisions about what *not* to do.

F65 logs one JSON object per request — method, route, status, duration, request
id — and deliberately nothing else. No query string, no body, no client
address: the query carries portfolio slugs and the body carries holdings, and
PRIVACY.md is a claim about this code that has to stay true. The route is the
matched template (`/api/portfolio`), not the URL, so a slug cannot arrive in a
log line by the back door; an unmatched path is logged raw, truncated, because
on a 404 the path is the only informative part. An inbound `X-Request-ID` is
kept and echoed back so a line here joins to a line from whatever sits in front
of it — bounded and character-restricted first, since it is caller-controlled
text on its way into a log.

F66 is an `ETag` over the archive checksum plus the query, which is a complete
cache key: `/api/benchmarks*` is a pure function of the committed snapshot, so
if both match, the body cannot have changed. A matching `If-None-Match` is
answered 304 *before* the handler runs — 9.3 ms of assembling six quarterly
histories becomes 0.3 ms — and `max-age` is 60 seconds rather than the quarter
the data actually lives, because a deploy can replace it at any moment and a
client holding a stale allocation has no way to notice. Everything else gets
`no-store`: portfolios are per-install state behind a shared token, and nothing
between here and the browser should be keeping a copy.

The middleware order is load-bearing and is commented as such. CORS has to wrap
the cache layer, or the 304 the cache returns by itself carries no
`Access-Control-Allow-Origin` and the browser rejects the revalidation it just
asked for.

F67 puts a worked example on every request body and every JSON response, taken
from real output rather than invented, with the long lists cut short and marked
as cut. `tests/test_openapi.py` asserts the coverage, because the failure mode
is silent — a new endpoint renders in `/docs` as an empty grey box and nobody
notices — and it also PUTs the portfolio example back at the API, since an
example that does not validate is worse than none: it is the first thing a
reader pastes into the try-it box.

**F72 needed the scheduled run, not the test.** The contract test skipped when
the network was unreachable, which is right on a laptop and useless in the one
place it was meant to run. `FINANCERT_REQUIRE_NETWORK=1` turns that skip into a
failure, and the weekly `source-check` workflow sets it: a skip that nobody
reads is not a check.

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
