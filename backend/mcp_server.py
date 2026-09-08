"""Financert as an MCP server.

Exposes the Federal Reserve benchmark data and the allocation comparison as
tools, so an assistant can answer "how does my portfolio compare to the top
1%?" directly.

    python mcp_server.py                 # stdio, for a local client
    python mcp_server.py --http --port 8080   # streamable HTTP, for hosting

Deliberately a **read-only subset** of the REST API. The portfolio storage
endpoints are not exposed, which is a design decision rather than an omission:

* Every tool is a pure function of its arguments and the committed snapshot.
  Nothing is written, so there is no state to corrupt, no auth to get wrong,
  and every tool is honestly annotated ``readOnlyHint=True``.
* The server stores nothing about the caller. Holdings passed to
  ``compare_allocation`` are used to compute the answer and discarded, which
  keeps the data-handling story for directory review trivially simple.
* The underlying data is public Federal Reserve output, so no credential is
  needed to serve it.

Anything that needs to persist a portfolio belongs on the REST API, behind its
token.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

from app.constants import ALL_GROUPS, ASSET_CLASS_KEYS, GROUP_ORDER, WEALTH_GROUPS
from app.services import allocation, benchmarks

INSTRUCTIONS = """
Financert compares a portfolio against how American households in each wealth
tier actually hold their assets, using the Federal Reserve's Distributional
Financial Accounts.

It is descriptive, not advice. It reports what the data says; it does not
recommend holdings. Matching the top 1%'s allocation would not reproduce their
returns -- a sixth of their assets is equity in private businesses they own and
operate -- and the data says nothing about risk, taxes, time horizon or
leverage. Present its output that way.

The top 0.1% is a subset of the top 1%, not a fifth tier. The four tiers that
partition the population are: top1, next9, next40, bottom50.
""".strip()

mcp = MCPServer(
    name="financert",
    title="Financert — US household wealth benchmarks",
    version="0.1.0",
    instructions=INSTRUCTIONS,
    website_url="https://github.com/drewc611/Financert",
)

# Every tool here reads the committed snapshot and returns a computed answer.
# `openWorldHint=False` because the data is a fixed local snapshot, not a live
# lookup against a changing external system.
READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)


def _validate_group(group: str) -> str:
    if group not in ALL_GROUPS:
        raise ValueError(f"unknown tier {group!r}. Valid tiers: {', '.join(ALL_GROUPS)}")
    return group


def _validate_period(period: str | None) -> str:
    try:
        return benchmarks.resolve_period(period)
    except KeyError:
        available = benchmarks.periods()
        raise ValueError(
            f"unknown period {period!r}. Use 'latest', 'complete', or a quarter "
            f"start date between {available[0]} and {available[-1]}."
        ) from None


def _validate_holdings(holdings: dict[str, float]) -> dict[str, float]:
    if not holdings:
        raise ValueError(f"holdings is empty. Provide at least one of: {', '.join(ASSET_CLASS_KEYS)}")
    unknown = sorted(set(holdings) - set(ASSET_CLASS_KEYS))
    if unknown:
        raise ValueError(f"unknown asset class(es): {', '.join(unknown)}. Valid keys: {', '.join(ASSET_CLASS_KEYS)}")
    negative = sorted(k for k, v in holdings.items() if v < 0)
    if negative:
        raise ValueError(f"negative value(s) for: {', '.join(negative)}")
    return holdings


@mcp.tool(
    title="List asset classes",
    description="The asset classes Financert reports on, with what each covers. Use these keys when calling compare_allocation.",
    annotations=READ_ONLY,
)
def list_asset_classes() -> list[dict[str, Any]]:
    return [
        {"key": a["key"], "label": a["label"], "liquid": a["liquid"], "covers": a["blurb"]}
        for a in benchmarks.asset_classes()
        if a["key"] != "unallocated"
    ]


@mcp.tool(
    title="List wealth tiers",
    description="The wealth tiers available as benchmarks, including which are subsets of others.",
    annotations=READ_ONLY,
)
def list_wealth_tiers() -> dict[str, Any]:
    return {
        "partitioning_tiers": GROUP_ORDER,
        "all_tiers": ALL_GROUPS,
        "tiers": [
            {
                "key": key,
                "label": WEALTH_GROUPS[key]["label"],
                "percentile_range": WEALTH_GROUPS[key]["percentile_range"],
                "share_of_households": WEALTH_GROUPS[key]["population_share"],
                "nested_inside": WEALTH_GROUPS[key].get("nested_in"),
            }
            for key in ALL_GROUPS
        ],
        "note": (
            "The tiers in partitioning_tiers cover the whole population and can be "
            "compared against each other. The top 0.1% is nested inside the top 1%, "
            "so it must not be presented as a fifth slice or summed with the others."
        ),
    }


@mcp.tool(
    title="Get a tier's allocation",
    description=(
        "How one wealth tier holds its assets, as shares. Set investable_only=false "
        "to include consumer durables (the Fed counts cars and appliances as assets)."
    ),
    annotations=READ_ONLY,
)
def get_tier_allocation(
    tier: str = "top1",
    period: str | None = None,
    investable_only: bool = True,
) -> dict[str, Any]:
    _validate_group(tier)
    resolved = _validate_period(period)
    result = benchmarks.allocation(tier, resolved, investable_only=investable_only)
    labels = {a["key"]: a["label"] for a in benchmarks.asset_classes()}
    return {
        "tier": result["label"],
        "percentile_range": result["percentile_range"],
        "period": result["period"],
        "nested_inside": result.get("nested_in"),
        "total_assets_usd": result["total_assets"],
        "total_liabilities_usd": result["total_liabilities"],
        "net_worth_usd": result["net_worth"],
        "allocation_pct": {
            labels.get(k, k): round(v * 100, 2) for k, v in sorted(result["weights"].items(), key=lambda kv: -kv[1])
        },
    }


@mcp.tool(
    title="Compare a portfolio against a wealth tier",
    description=(
        "The main tool. Given holdings in dollars keyed by asset class, returns the "
        "gap against a wealth tier per asset class, and which tier the mix most "
        "resembles. Nothing is stored. Descriptive only -- not investment advice."
    ),
    annotations=READ_ONLY,
)
def compare_allocation(
    holdings: dict[str, float],
    tier: str = "top1",
    period: str | None = None,
    investable_only: bool = True,
) -> dict[str, Any]:
    _validate_holdings(holdings)
    _validate_group(tier)
    resolved = _validate_period(period)

    result = allocation.analyse(holdings, group=tier, period=resolved, investable_only=investable_only)
    nearest = result["nearest_tier"]

    return {
        "period": result["period"],
        "compared_against": result["benchmark_label"],
        "portfolio_total_usd": result["portfolio_total"],
        "excluded_as_non_investable_usd": result["excluded_value"],
        "similarity_to_that_tier": result["similarity"],
        "closest_tier": {
            "tier": nearest["nearest_label"],
            "similarity": nearest["similarity"],
            # Below the floor the mix does not really resemble any tier, and
            # saying "you invest like the top 1%" would overclaim.
            "confident": nearest["confident"],
            "all_tiers_ranked": nearest["ranked"],
        },
        "gaps": [
            {
                "asset_class": g["label"],
                "you_pct": g["user_pct"],
                "tier_pct": g["benchmark_pct"],
                "difference_pp": g["gap_pp"],
                "status": g["status"],
            }
            for g in result["gaps"]
        ],
        "note": (
            "Differences under 1.5 percentage points are reported as 'in_line' -- the "
            "DFA is built from survey weights and finer precision would imply accuracy "
            "the source does not have. This is a descriptive comparison, not advice."
        ),
    }


@mcp.tool(
    title="Get an asset class trend",
    description="One asset class's share of a tier's assets over time, quarterly since 1989.",
    annotations=READ_ONLY,
)
def get_asset_class_trend(asset_class: str, tier: str = "top1") -> dict[str, Any]:
    _validate_group(tier)
    try:
        points = benchmarks.trend(tier, asset_class)
    except KeyError:
        raise ValueError(f"unknown asset class {asset_class!r}. Valid keys: {', '.join(ASSET_CLASS_KEYS)}") from None

    labels = {a["key"]: a["label"] for a in benchmarks.asset_classes()}
    return {
        "tier": WEALTH_GROUPS[tier]["label"],
        "asset_class": labels.get(asset_class, asset_class),
        "first": {"period": points[0]["period"], "share_pct": round(points[0]["share"] * 100, 2)},
        "latest": {"period": points[-1]["period"], "share_pct": round(points[-1]["share"] * 100, 2)},
        "points": [{"period": p["period"], "share_pct": round(p["share"] * 100, 2)} for p in points],
    }


@mcp.tool(
    title="Get data source and coverage",
    description="Where the numbers come from, which quarters are covered, and the exact archive the snapshot was built from.",
    annotations=READ_ONLY,
)
def get_data_source() -> dict[str, Any]:
    source = benchmarks.source_meta()
    periods = benchmarks.periods()
    return {
        **source,
        "quarters_covered": len(periods),
        "earliest_period": periods[0],
        "latest_period": periods[-1],
        "caveat": (
            "Descriptive statistics about how households hold assets. Contains no "
            "prices and no returns, so it cannot support performance or backtesting "
            "claims, and it is not investment advice."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the Financert MCP server.")
    parser.add_argument("--http", action="store_true", help="serve over streamable HTTP instead of stdio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument(
        "--allowed-origin",
        action="append",
        default=[],
        metavar="ORIGIN",
        help="Origin permitted to call the HTTP transport. Repeatable. Required when hosting.",
    )
    parser.add_argument(
        "--allowed-host",
        action="append",
        default=[],
        metavar="HOST",
        help="Host header permitted on the HTTP transport. Repeatable. Defaults to --host.",
    )
    args = parser.parse_args()

    # Fail before a client connects rather than on the first tool call.
    try:
        benchmarks.load_snapshot()
    except benchmarks.SnapshotError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if not args.http:
        mcp.run()
        return 0

    # DNS-rebinding protection is on by default in the SDK, and the directory
    # review asks for Origin validation explicitly. Left implicit, a hosted
    # server will happily answer a request forged by any page the user visits.
    security = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=args.allowed_host or [args.host, f"{args.host}:{args.port}"],
        allowed_origins=args.allowed_origin or [f"http://{args.host}:{args.port}"],
    )
    if not args.allowed_origin:
        print(
            "warning: no --allowed-origin given; defaulting to localhost only. "
            "A hosted deployment must pass its real origin.",
            file=sys.stderr,
        )

    mcp.run(
        transport="streamable-http",
        host=args.host,
        port=args.port,
        transport_security=security,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
