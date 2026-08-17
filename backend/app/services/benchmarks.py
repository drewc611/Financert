"""Read-side access to the committed DFA snapshot.

The snapshot is loaded once and cached. It is reference data measured by the
Federal Reserve, not per-install state, so nothing here touches the database.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from ..config import SNAPSHOT_PATH
from ..constants import GROUP_ORDER, NON_INVESTABLE, UNALLOCATED


class SnapshotError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def load_snapshot() -> dict[str, Any]:
    if not SNAPSHOT_PATH.exists():
        raise SnapshotError(f"DFA snapshot missing at {SNAPSHOT_PATH}. Run `python fetch_dfa.py` to build it.")
    with SNAPSHOT_PATH.open() as fh:
        snapshot = json.load(fh)
    missing = [g for g in GROUP_ORDER if g not in snapshot.get("groups", {})]
    if missing:
        raise SnapshotError(f"snapshot is missing wealth groups: {', '.join(missing)}")
    return snapshot


def asset_classes() -> list[dict[str, Any]]:
    return load_snapshot()["asset_classes"]


def periods() -> list[str]:
    return load_snapshot()["periods"]


def latest_period() -> str:
    return load_snapshot()["latest_period"]


def source_meta() -> dict[str, Any]:
    return load_snapshot()["source"]


def resolve_period(period: str | None) -> str:
    """Map a requested period (or None/'latest') onto a real snapshot period."""
    if period in (None, "", "latest"):
        return latest_period()
    if period not in periods():
        raise KeyError(period)
    return period


def _entry(group_key: str, period: str) -> dict[str, Any]:
    group = load_snapshot()["groups"].get(group_key)
    if group is None:
        raise KeyError(group_key)
    for row in group["history"]:
        if row["period"] == period:
            return row
    raise KeyError(period)


def weights(group_key: str, period: str, *, investable_only: bool = False) -> dict[str, float]:
    """Return a wealth group's allocation as fractions summing to 1.

    With ``investable_only``, categories nobody chooses as an investment
    (consumer durables) and the unallocated residual are dropped and the rest
    renormalised -- otherwise a user comparing a brokerage account against the
    top 1% would be silently competing against the Fed's estimate of everyone's
    used cars.
    """
    row = _entry(group_key, period)
    assets = dict(row["assets"])
    if investable_only:
        for key in (*NON_INVESTABLE, UNALLOCATED["key"]):
            assets.pop(key, None)
    total = sum(assets.values())
    if total <= 0:
        return {k: 0.0 for k in assets}
    return {k: v / total for k, v in assets.items()}


def allocation(group_key: str, period: str, *, investable_only: bool = False) -> dict[str, Any]:
    """A group's full allocation record for one period."""
    row = _entry(group_key, period)
    group = load_snapshot()["groups"][group_key]
    w = weights(group_key, period, investable_only=investable_only)
    return {
        "group": group_key,
        "label": group["label"],
        "percentile_range": group["percentile_range"],
        "period": period,
        "total_assets": row["total_assets"],
        "total_liabilities": row["total_liabilities"],
        "net_worth": row["net_worth"],
        "weights": w,
    }


def all_allocations(period: str, *, investable_only: bool = False) -> list[dict[str, Any]]:
    return [allocation(g, period, investable_only=investable_only) for g in GROUP_ORDER]


def trend(group_key: str, asset_key: str) -> list[dict[str, Any]]:
    """One asset class's share of a group's assets over the full history."""
    group = load_snapshot()["groups"].get(group_key)
    if group is None:
        raise KeyError(group_key)
    out = []
    for row in group["history"]:
        total = sum(row["assets"].values())
        if asset_key not in row["assets"]:
            raise KeyError(asset_key)
        out.append(
            {
                "period": row["period"],
                "share": row["assets"][asset_key] / total if total else 0.0,
                "value": row["assets"][asset_key],
            }
        )
    return out
