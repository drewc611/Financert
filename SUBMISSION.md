# Directory submission

Everything the Claude connectors directory and the ChatGPT apps directory ask
for, written out so submission is filling in forms rather than composing copy
under a character counter.

[DISTRIBUTION.md](DISTRIBUTION.md) covers *which* channels are viable and why.
This file is the payload. [DEPLOY.md](DEPLOY.md) is how to stand up the
endpoint both forms need.

**What is not here:** the submission itself. Both portals are behind an
account login, and the Anthropic one additionally
[requires a Team or Enterprise organisation](https://claude.com/docs/connectors/building/submission).
Those are actions for the account holder.

---

## Listing metadata

One source of truth for both directories. `tests/test_submission_metadata.py`
checks the lengths against the published limits on every CI run, because a
listing that overruns is a mechanical rejection nobody reads first.

```json
{
  "name": "Financert",
  "tagline": "How US wealth tiers really hold their money",
  "description": "Financert answers one question with measured data: how do American households at each level of wealth actually hold their money, and how does a given portfolio compare?\n\nThe benchmark is the Federal Reserve's Distributional Financial Accounts, taken from the Fed's own bulk release and reconciled against its published totals before it ships. It covers every quarter since 1989 across twelve asset classes, split into five tiers: the top 0.1%, the top 1%, the next 9%, the next 40%, and the bottom 50%.\n\nSix read-only tools. Give it holdings by asset class and it returns the gap against a chosen tier class by class, plus which tier the mix most resembles and how confident that match is. Or ask it the data directly: what share of the top 0.1%'s assets sits in private business equity, how the bottom 50%'s allocation has shifted since 1989, what any tier holds today.\n\nWhat the data shows is stark. The wealthiest hold their wealth in businesses and equities; the bottom half hold theirs in a house.\n\nFinancert is descriptive, not advice. It reports what the data says and does not recommend holdings. Matching the top 1%'s allocation would not reproduce their returns: roughly a sixth of their assets is equity in private businesses they own and operate. The source contains no prices and no returns, so it cannot support performance or backtesting claims, and it says nothing about risk, taxes, time horizon or leverage.\n\nNothing is stored. Holdings passed in are used to compute an answer and discarded when the response is returned. There is no account, no login and no credential, because the underlying data is public Federal Reserve output.",
  "categories": ["Finance", "Research & data"],
  "example_prompts": [
    "How does my portfolio compare to the top 1%? I have $200k in stocks, $400k in home equity, and $150k in my 401(k).",
    "What share of their assets does the top 0.1% hold in private businesses?",
    "Has the top 1%'s allocation to equities changed since 1989?",
    "Which wealth tier does my allocation most resemble?",
    "What does the Fed's data say the bottom 50% hold their wealth in?"
  ],
  "docs_url": "https://drewc611.github.io/Financert/mcp.html",
  "privacy_url": "https://drewc611.github.io/Financert/privacy.html",
  "source_url": "https://github.com/drewc611/Financert",
  "support_email": "TODO — a monitored address, see below"
}
```

Limits the lengths are checked against: name ≤ 100, tagline ≤ 55,
description ≤ 2,000, one to five categories.

The categories above are the honest shape of the thing, but **both portals
pick from their own fixed list** and neither list is stable enough to hardcode
here. Choose the nearest equivalents in the form.

---

## Before either form can be submitted

Four things, none of them code. Each blocks both directories.

| | Blocked on |
|---|---|
| A public HTTPS endpoint | Deploying. See [DEPLOY.md](DEPLOY.md) — the config exists, it needs an account to run in. |
| A published privacy policy URL | Merging to `main`, which publishes the Pages site. The URL above is where it lands. |
| A legal read of that policy | Someone qualified. [PRIVACY.md](PRIVACY.md) is accurate against the code and says on its face that it is a draft. |
| A monitored contact address | A decision. The listing needs somewhere a user or a reviewer can actually reach. |

And for the Anthropic directory specifically, a Team or Enterprise
organisation.

---

## Claude connectors directory

Submitted through a portal inside claude.ai.

Requirements, and where each stands:

- **HTTPS with a stable URL** — pending deployment.
- **Origin-header validation.** Implemented. The HTTP transport runs with DNS
  rebinding protection on; a forged `Origin` gets 403 and an unrecognised
  `Host` gets 421. Verified against a running server, not just asserted —
  DEPLOY.md has the probes.
- **Accurate tool annotations.** Every tool is `readOnlyHint: true`,
  `destructiveHint: false`. This is the single most-cited rejection reason, so
  a test guards it *including the camelCase wire form* — the Python model is
  snake_case and a mismatch would make the hints invisible to a reviewer.
- **Public documentation with example prompts** — `docs/mcp.md`, published at
  the docs URL above.
- **A privacy policy** — drafted; a missing one is an immediate rejection.
- **A reviewer demo account** — not applicable. There is no login, so a
  reviewer can exercise every tool on connect.

### Notes for a reviewer

Worth saying in the form, because both are unusual enough to look like
mistakes:

1. **No write tools, deliberately.** Financert's REST API can store a
   portfolio; the MCP server does not expose that. Adding it would mean auth,
   stored state, and a data-handling story, and would make every tool's
   `readOnlyHint` a lie.
2. **The top 0.1% is nested inside the top 1%**, not a fifth tier. The server's
   instructions say so, and `list_wealth_tiers` returns the four partitioning
   tiers separately from the full list, so an assistant cannot accidentally
   present five slices that sum past 100%.

---

## ChatGPT apps directory

Submitted through the OpenAI developer platform. Same server, same privacy
policy, same hosting prerequisite; the form additionally wants MCP
connectivity details, directory metadata and test cases.

**Connectivity:** streamable HTTP at `https://<host>/mcp`. No authentication.

**Test cases** — these must pass on both ChatGPT web and mobile, so run them in
both before submitting:

| # | Prompt | Expected |
|---|---|---|
| 1 | "What share of its assets does the top 1% hold in stocks?" | `get_tier_allocation`; roughly half, with the quarter named. |
| 2 | "I have $200k in stocks, $400k in home equity and $150k in a 401(k). How does that compare to the top 1%?" | `compare_allocation`; per-class gaps, a nearest tier, and no recommendation. |
| 3 | "Which wealth tier does that mix most resemble?" | A tier from the four partitioning tiers, never the top 0.1%. |
| 4 | "How has the bottom 50%'s allocation to real estate changed since 1989?" | `get_asset_class_trend`; a series starting 1989. |
| 5 | "Where does this data come from?" | `get_data_source`; the Fed's DFA, the archive hash, the quarters covered. |
| 6 | "Should I buy more stocks?" | Declines to advise, and offers the comparison instead. |

Case 6 is the one worth watching. The tool descriptions and the server
instructions both carry the not-advice framing precisely so the assistant
reaches for it, but the wording is generated by the assistant rather than by
Financert, so it has to be checked rather than assumed.

---

## The app stores

Not ready, and not blocked on effort. Apple requires apps for "financial
trading, investment, or financial management" to be submitted by the financial
institution providing those services. That question needs an answer from Apple
or from someone qualified **before** any mobile work — see
[DISTRIBUTION.md](DISTRIBUTION.md#the-app-stores-are-a-different-problem) for
the argument on both sides.
