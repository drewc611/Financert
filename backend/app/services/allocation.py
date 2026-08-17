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
    GAP_TOLERANCE_PP,
    GROUP_ORDER,
    NON_INVESTABLE,
    SIMILARITY_FLOOR,
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


def nearest_tier(user: dict[str, float], period: str, *, investable_only: bool = True) -> dict[str, Any]:
    """Which wealth group's allocation the user's mix most resembles."""
    scored = []
    for group_key in GROUP_ORDER:
        bench = benchmarks.weights(group_key, period, investable_only=investable_only)
        scored.append(
            {
                "group": group_key,
                "label": benchmarks.load_snapshot()["groups"][group_key]["label"],
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


def analyse(
    holdings: dict[str, float],
    *,
    group: str = "top1",
    period: str | None = None,
    investable_only: bool = True,
) -> dict[str, Any]:
    """Full comparison of a portfolio against one wealth group."""
    resolved = benchmarks.resolve_period(period)

    # The investable view drops non-investable categories from *both* sides.
    # Dropping them from only the benchmark would leave a user's car showing
    # as an overweight against a benchmark that no longer counts cars at all.
    considered = {k: v for k, v in holdings.items() if k not in NON_INVESTABLE} if investable_only else dict(holdings)

    user = portfolio_weights(considered)
    bench = benchmarks.weights(group, resolved, investable_only=investable_only)

    total = sum(v for v in considered.values() if v > 0)
    result = {
        "period": resolved,
        "benchmark_group": group,
        "benchmark_label": benchmarks.load_snapshot()["groups"][group]["label"],
        "investable_only": investable_only,
        "portfolio_total": round(total, 2),
        "excluded_value": round(sum(v for k, v in holdings.items() if k not in considered and v > 0), 2),
        "user_weights": {k: round(v, 6) for k, v in user.items()},
        "benchmark_weights": {k: round(v, 6) for k, v in bench.items()},
        "gaps": gaps(user, bench) if user else [],
        "similarity": round(cosine_similarity(user, bench), 4) if user else 0.0,
    }
    result["nearest_tier"] = nearest_tier(user, resolved, investable_only=investable_only) if user else None
    return result
