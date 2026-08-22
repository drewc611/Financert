"""Read-side access to the committed DFA snapshot.

The snapshot is loaded once and cached. It is reference data measured by the
Federal Reserve, not per-install state, so nothing here touches the database.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from ..config import SNAPSHOT_PATH
from ..constants import ALL_GROUPS, NON_INVESTABLE, UNALLOCATED


class SnapshotError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def load_snapshot() -> dict[str, Any]:
    if not SNAPSHOT_PATH.exists():
        raise SnapshotError(f"DFA snapshot missing at {SNAPSHOT_PATH}. Run `python fetch_dfa.py` to build it.")
    with SNAPSHOT_PATH.open() as fh:
        snapshot = json.load(fh)
    missing = [g for g in ALL_GROUPS if g not in snapshot.get("groups", {})]
    if missing:
        raise SnapshotError(f"snapshot is missing wealth groups: {', '.join(missing)}")
    return snapshot


def asset_classes() -> list[dict[str, Any]]:
    return load_snapshot()["asset_classes"]


def periods() -> list[str]:
    return load_snapshot()["periods"]


def latest_period() -> str:
    return load_snapshot()["latest_period"]


def latest_complete_period() -> str:
    """Newest quarter in which every asset class is published."""
    return load_snapshot()["latest_complete_period"]


def complete_periods() -> list[str]:
    return load_snapshot()["complete_periods"]


def source_meta() -> dict[str, Any]:
    return load_snapshot()["source"]


def resolve_period(period: str | None) -> str:
    """Map a requested period onto a real snapshot period.

    ``None`` and ``"latest"`` give the newest quarter, which may be missing a
    lagging asset class; ``"complete"`` gives the newest fully published one.
    """
    if period in (None, "", "latest"):
        return latest_period()
    if period == "complete":
        return latest_complete_period()
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
        for key in NON_INVESTABLE:
            assets.pop(key, None)
        # The residual is only safe to drop when the quarter is complete. In an
        # incomplete one it also holds the buckets the Fed has not published
        # yet -- private business equity, which is very much investable -- so
        # dropping it would renormalise the rest upward and overstate them.
        if row.get("complete", True):
            assets.pop(UNALLOCATED["key"], None)
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
        "nested": group.get("nested", False),
        "nested_in": group.get("nested_in"),
        "period": period,
        "complete": row.get("complete", True),
        "unavailable": row.get("unavailable", []),
        "total_assets": row["total_assets"],
        "total_liabilities": row["total_liabilities"],
        "net_worth": row["net_worth"],
        "weights": w,
    }


def all_allocations(period: str, *, investable_only: bool = False) -> list[dict[str, Any]]:
    return [allocation(g, period, investable_only=investable_only) for g in ALL_GROUPS]


def trend(group_key: str, asset_key: str) -> list[dict[str, Any]]:
    """One asset class's share of a group's assets over the full history.

    Quarters where this class has not been published yet are omitted rather
    than plotted as zero, so a lagging series ends its line early instead of
    falling off a cliff.
    """
    group = load_snapshot()["groups"].get(group_key)
    if group is None:
        raise KeyError(group_key)
    known = {a["key"] for a in asset_classes()}
    if asset_key not in known:
        raise KeyError(asset_key)

    out = []
    for row in group["history"]:
        if asset_key not in row["assets"]:
            continue
        total = row["total_assets"] or sum(row["assets"].values())
        out.append(
            {
                "period": row["period"],
                "share": row["assets"][asset_key] / total if total else 0.0,
                "value": row["assets"][asset_key],
            }
        )
    return out
