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
| F6 | Ingest `Minimum Wealth Cutoff` where populated: "what net worth puts you in the top 1%?" | S |
| ~~F7~~ ✅ | Pin the source: record the zip's published date and checksum in the snapshot | S |
| F8 | Keep FRED as a documented fallback path if the zip fetch fails | M |
| F9 | Golden-file test: assert the parsed snapshot matches a committed fixture, so a Fed format change fails loudly | M |
| F10 | Split the snapshot per dimension so the payload stays small | M |

## Phase 1 — the five new dimensions

Each dimension is the same shape of work. Categories are confirmed from the file.

| # | Feature | Size |
|---|---|---|
| F11 | **Generation** axis — Silent, Baby Boom, Gen X, Millennial | M |
| F12 | **Education** axis — No HS, HS, Some college, College | M |
| F13 | **Income** axis — 0–20, 20–40, 40–60, 60–80, 80–99, 99–100 percentile | M |
| F14 | **Race** axis — White, Black, Hispanic, Other | M |
| F15 | **Age** axis — under 40, 40–54, 55–69, 70+ | M |
| F16 | Dimension picker in the UI; the whole dashboard re-benchmarks against the chosen axis | L |
| F17 | Generalise `WEALTH_GROUPS` into a dimension registry so a new axis is data, not code | L |
| F18 | "Compare me to my cohort" — pick your generation/age/education, benchmark against it | M |
| F19 | Cross-dimension view: your allocation against *all six* axes at once | M |
| F20 | Per-dimension nesting rules (income has its own top-1% analogue; do not assume the net-worth shape) | M |
| F21 | Guard rail: dimensions are separate populations and must never be summed together | S |
| F22 | Framing review for the race axis — descriptive, sourced, no causal or prescriptive language | S |

## Phase 2 — deeper analysis on data we already hold

| # | Feature | Size |
|---|---|---|
| F23 | Liabilities comparison — we fetch `total_liabilities` and only show a tile | M |
| F24 | Leverage ratio (liabilities ÷ assets) vs each tier | S |
| F25 | Net-worth view alongside the assets view (assets less debt) | M |
| F26 | Debt mix: home mortgages vs consumer credit vs other, per tier | M |
| F27 | "Which tier is my *debt* like?" — the mirror of nearest-tier | M |
| F28 | Net-worth percentile placement from `Minimum Wealth Cutoff` | M |
| F29 | Per-household dollar figures using `Household count`, not just shares | M |
| F30 | Time travel: benchmark against any quarter since 1989, not just two | M |
| F31 | "Your gap over time" — hold your allocation, watch the gap move as the tier changes | L |
| F32 | Era comparison: the top 1% in 1989 vs 2000 vs 2026 | M |
| F33 | Biggest movers: which classes shifted most for a tier over a chosen window | M |
| F34 | Concentration measure (share in the largest class) per tier | S |
| F35 | Liquidity score using the existing `liquid` flag on asset classes | S |
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
| F72 | Data-source contract test hitting the live Fed zip weekly, so a format change surfaces before a refresh needs it | M |

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
