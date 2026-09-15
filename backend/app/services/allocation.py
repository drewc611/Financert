"""Portfolio maths: weights, benchmark gaps, and nearest wealth tier.

Pure functions over plain dicts -- no database, no I/O. This is the code most
worth reading to understand what Financert actually claims, so it is kept
deliberately simple.
"""

from __future__ import annotations

import math
from typing import Any

from ..constants import (
    ASSET_CLASS_BY_KEY,
    DEFAULT_DIMENSION,
    GAP_TOLERANCE_PP,
    NON_INVESTABLE,
    PENDING_LABEL,
    SIMILARITY_FLOOR,
    UNALLOCATED,
    dimension_of,
    group_order,
)
from . import benchmarks


def portfolio_weights(holdings: dict[str, float]) -> dict[str, float]:
    """Normalise raw holding values into fractions summing to 1."""
    total = sum(v for v in holdings.values() if v > 0)
    if total <= 0:
        return {}
    return {k: v / total for k, v in holdings.items() if v > 0}


def cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    """Similarity of two allocations, ignoring scale. 1.0 = identical mix."""
    keys = set(a) | set(b)
    dot = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in keys)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def gaps(
    user: dict[str, float],
    benchmark: dict[str, float],
    *,
    tolerance_pp: float = GAP_TOLERANCE_PP,
) -> list[dict[str, Any]]:
    """Per-asset-class comparison of two allocations, largest gap first.

    Gaps are in percentage points of the portfolio. Anything inside
    ``tolerance_pp`` is reported as "in line" -- the DFA is an estimate built
    from survey weights, and finer precision would imply accuracy the source
    does not have.
    """
    out = []
    for key in sorted(set(user) | set(benchmark)):
        spec = ASSET_CLASS_BY_KEY.get(key)
        user_pct = user.get(key, 0.0) * 100
        bench_pct = benchmark.get(key, 0.0) * 100
        gap = user_pct - bench_pct
        if abs(gap) <= tolerance_pp:
            status = "in_line"
        elif gap > 0:
            status = "overweight"
        else:
            status = "underweight"
        out.append(
            {
                "asset_class": key,
                "label": spec["label"] if spec else key.replace("_", " ").title(),
                "user_pct": round(user_pct, 2),
                "benchmark_pct": round(bench_pct, 2),
                "gap_pp": round(gap, 2),
                "status": status,
            }
        )
    out.sort(key=lambda r: abs(r["gap_pp"]), reverse=True)
    return out


def nearest_tier(
    user: dict[str, float],
    period: str,
    *,
    investable_only: bool = True,
    dimension: str = DEFAULT_DIMENSION,
) -> dict[str, Any]:
    """Which group of one axis the user's mix most resembles.

    Ranked over the axis's published order, not every group it has: net
    worth's nested top 0.1% is a subset of the top 1%, so including it would
    put two overlapping populations in one ranking and let "closest" land on
    a group that is not a distinct slice of anyone.
    """
    scored = []
    for group_key in group_order(dimension):
        bench = benchmarks.weights(group_key, period, investable_only=investable_only, dimension=dimension)
        scored.append(
            {
                "group": group_key,
                "label": benchmarks.groups_in(dimension)[group_key]["label"],
                "similarity": round(cosine_similarity(user, bench), 4),
            }
        )
    scored.sort(key=lambda r: r["similarity"], reverse=True)
    best = scored[0]
    return {
        "nearest": best["group"],
        "nearest_label": best["label"],
        "similarity": best["similarity"],
        # Below the floor the mix does not really resemble any tier, and
        # saying "you invest like the top 1%" would be an overclaim.
        "confident": best["similarity"] >= SIMILARITY_FLOOR,
        "ranked": scored,
    }


def nearest_debt_tier(
    debts: dict[str, float],
    period: str,
    *,
    dimension: str = DEFAULT_DIMENSION,
) -> dict[str, Any]:
    """Whose *borrowing* one set of debts most resembles (BACKLOG F27).

    The mirror of nearest_tier, and a genuinely different answer: a household
    can hold assets like the Next 9% and owe like the bottom 50%, because a
    mortgage and a brokerage account are not the same decision.
    """
    user = portfolio_weights(debts)
    scored = []
    for group_key in group_order(dimension):
        bench = benchmarks.debt_weights(group_key, period, dimension)
        scored.append(
            {
                "group": group_key,
                "label": benchmarks.groups_in(dimension)[group_key]["label"],
                "similarity": round(cosine_similarity(user, bench), 4),
            }
        )
    scored.sort(key=lambda r: r["similarity"], reverse=True)
    best = scored[0]
    return {
        "nearest": best["group"],
        "nearest_label": best["label"],
        "similarity": best["similarity"],
        "confident": best["similarity"] >= SIMILARITY_FLOOR,
        "ranked": scored,
    }


def placements(
    holdings: dict[str, float],
    *,
    debts: dict[str, float] | None = None,
    period: str | None = None,
    investable_only: bool = True,
) -> dict[str, Any]:
    """Where one mix lands on every axis at once (BACKLOG F19).

    Six answers to "whose balance sheet does this look like", one per cut of
    the same households. They are six readings of one portfolio, not six
    populations to add up -- a mix can sit nearest the Next 40% *and* nearest
    college graduates, because those groups overlap.

    Asking nothing of the reader is the point: this is the cut of the product
    that works without anyone saying who they are.
    """
    resolved = benchmarks.resolve_period(period)
    considered = {k: v for k, v in holdings.items() if k not in NON_INVESTABLE} if investable_only else dict(holdings)
    user = portfolio_weights(considered)
    owed = {k: v for k, v in (debts or {}).items() if v > 0}

    return {
        "period": resolved,
        "investable_only": investable_only,
        "portfolio_total": round(sum(v for v in considered.values() if v > 0), 2),
        "total_debt": round(sum(owed.values()), 2),
        "placements": [
            {
                "dimension": name,
                "label": meta["label"],
                **nearest_tier(user, resolved, investable_only=investable_only, dimension=name),
            }
            for name, meta in benchmarks.dimensions().items()
        ]
        if user
        else [],
        # The same six readings for what is owed rather than what is held
        # (BACKLOG F27). Empty unless the caller supplied debts: a portfolio
        # with no debt side has no answer here, which is not the same as owing
        # like nobody.
        "debt_placements": [
            {
                "dimension": name,
                "label": meta["label"],
                **nearest_debt_tier(owed, resolved, dimension=name),
            }
            for name, meta in benchmarks.dimensions().items()
        ]
        if owed
        else [],
    }


def analyse(
    holdings: dict[str, float],
    *,
    group: str = "top1",
    period: str | None = None,
    investable_only: bool = True,
) -> dict[str, Any]:
    """Full comparison of a portfolio against one group of any axis.

    The axis is resolved from the group key, which is unique across the whole
    registry, so a caller comparing against "millennial" does not have to say
    which cut that came from -- and the nearest-group ranking stays on that
    same axis rather than silently falling back to net worth.
    """
    dimension = dimension_of(group)
    resolved = benchmarks.resolve_period(period)

    # The investable view drops non-investable categories from *both* sides.
    # Dropping them from only the benchmark would leave a user's car showing
    # as an overweight against a benchmark that no longer counts cars at all.
    considered = {k: v for k, v in holdings.items() if k not in NON_INVESTABLE} if investable_only else dict(holdings)

    user = portfolio_weights(considered)
    bench = benchmarks.weights(group, resolved, investable_only=investable_only, dimension=dimension)

    total = sum(v for v in considered.values() if v > 0)
    snapshot_row = benchmarks.allocation(group, resolved, investable_only=investable_only, dimension=dimension)
    result = {
        "period": resolved,
        "period_complete": snapshot_row["complete"],
        "period_unavailable": snapshot_row["unavailable"],
        "benchmark_group": group,
        "benchmark_dimension": dimension,
        "benchmark_label": benchmarks.groups_in(dimension)[group]["label"],
        "investable_only": investable_only,
        "portfolio_total": round(total, 2),
        "excluded_value": round(sum(v for k, v in holdings.items() if k not in considered and v > 0), 2),
        "user_weights": {k: round(v, 6) for k, v in user.items()},
        "benchmark_weights": {k: round(v, 6) for k, v in bench.items()},
        "gaps": gaps(user, bench) if user else [],
        "similarity": round(cosine_similarity(user, bench), 4) if user else 0.0,
    }
    result["nearest_tier"] = (
        nearest_tier(user, resolved, investable_only=investable_only, dimension=dimension) if user else None
    )

    if not snapshot_row["complete"]:
        _mark_pending(result["gaps"], snapshot_row["unavailable"])
    return result


def _mark_pending(rows: list[dict[str, Any]], unavailable: list[str]) -> None:
    """Relabel the residual row in an incomplete quarter.

    It carries the unpublished classes, so calling the user "underweight
    unallocated" would be both meaningless and wrong -- there is no verdict to
    give until the Fed publishes.
    """
    missing = ", ".join(ASSET_CLASS_BY_KEY[k]["label"] for k in unavailable if k in ASSET_CLASS_BY_KEY)
    for row in rows:
        if row["asset_class"] == UNALLOCATED["key"]:
            row["status"] = "pending"
            row["label"] = f"{PENDING_LABEL}{f' ({missing})' if missing else ''}"
