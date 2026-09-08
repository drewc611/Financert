---
title: MCP server
---

# Financert MCP server

Six read-only tools exposing US household wealth benchmarks from the Federal
Reserve's Distributional Financial Accounts, plus a portfolio comparison.

**Nothing is stored.** Holdings passed to `compare_allocation` are used to
compute the answer and discarded. There is no account, no login, and no
credential — the underlying data is public Federal Reserve output.

## Tools

| Tool | Does |
|---|---|
| `list_asset_classes` | The asset classes and what each covers |
| `list_wealth_tiers` | The tiers available as benchmarks, and which are subsets |
| `get_tier_allocation` | How one tier holds its assets |
| `compare_allocation` | Your holdings vs a tier: per-class gaps and nearest tier |
| `get_asset_class_trend` | One asset class's share over time, since 1989 |
| `get_data_source` | Provenance, coverage, and the exact archive used |

Every tool is annotated `readOnlyHint: true` and `destructiveHint: false`.
None of them writes anything.

## Example prompts

- "How does my portfolio compare to the top 1%? I have $200k in stocks, $400k
  in home equity, and $150k in my 401(k)."
- "What share of their assets does the top 0.1% hold in private businesses?"
- "Has the top 1%'s allocation to equities changed since 1989?"
- "Which wealth tier does my allocation most resemble?"
- "What does the Fed's data say the bottom 50% hold their wealth in?"

## Connecting

**Local (stdio):**

```bash
git clone https://github.com/drewc611/Financert
cd Financert/backend && make install
make mcp
```

**Hosted (streamable HTTP):**

```bash
make mcp-http   # or: python mcp_server.py --http --port 8080 \
                #       --allowed-origin https://your.domain
```

The HTTP transport runs with DNS-rebinding protection enabled and requires an
explicit `--allowed-origin`. A request carrying any other `Origin` is refused
with 403, and an unrecognised `Host` with 421.

To host it properly — the container image, a Fly config, and three curl probes
that verify the allowlist is right before anyone else finds out it isn't — see
[DEPLOY.md](https://github.com/drewc611/Financert/blob/main/DEPLOY.md).

## Limits and caveats

The DFA is a quarterly snapshot of **what households hold**, built from survey
weights. It contains no prices and no flows, so it cannot support return,
performance or backtesting claims. Differences under 1.5 percentage points are
reported as "in line" rather than over- or under-weight, because finer
precision would imply accuracy the source does not have.

The top 0.1% is a subset of the top 1%, not a fifth tier, and is excluded from
anything that treats the tiers as a partition of the population.

**This is descriptive, not investment advice.**

## Privacy

See the [privacy policy](privacy.html). Short version: the MCP server stores
nothing.
