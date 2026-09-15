"""Read-side access to the committed DFA snapshot.

The snapshot is loaded once and cached. It is reference data measured by the
Federal Reserve, not per-install state, so nothing here touches the database.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from ..config import SNAPSHOT_PATH
from ..constants import (
    ALL_GROUPS,
    DEFAULT_DIMENSION,
    DIMENSIONS,
    NON_INVESTABLE,
    THRESHOLD_COLUMNS,
    UNALLOCATED,
    extra_columns_for,
)


class SnapshotError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def load_snapshot() -> dict[str, Any]:
    if not SNAPSHOT_PATH.exists():
        raise SnapshotError(f"DFA snapshot missing at {SNAPSHOT_PATH}. Run `python fetch_dfa.py` to build it.")
    with SNAPSHOT_PATH.open() as fh:
        snapshot = json.load(fh)
    return snapshot


def verify_snapshot() -> None:
    """Fail loudly at startup rather than on the first request.

    Checks the default dimension specifically, because that is the one every
    ungated endpoint answers from -- a missing side file should not wait until
    someone loads the dashboard to announce itself.
    """
    missing = [g for g in ALL_GROUPS if g not in groups_in(DEFAULT_DIMENSION)]
    if missing:
        raise SnapshotError(f"snapshot is missing wealth groups: {', '.join(missing)}")


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


def dimensions() -> dict[str, Any]:
    """What axes exist, and their labels and group order -- metadata only.

    Cheap by design: the histories live in their own files and are read on
    demand by groups_in(). A snapshot built before dimensions existed carries
    only the net-worth map at the top level, so that is synthesised into the
    same shape rather than treated as an error -- the API should degrade to
    "one axis" rather than 500 on an older file.
    """
    snapshot = load_snapshot()
    if "dimensions" in snapshot:
        return snapshot["dimensions"]
    return {
        DEFAULT_DIMENSION: {
            "key": DEFAULT_DIMENSION,
            "label": DIMENSIONS[DEFAULT_DIMENSION]["label"],
            "group_order": snapshot["group_order"],
            "all_groups": snapshot["all_groups"],
        }
    }


def dimension_names() -> list[str]:
    return list(dimensions())


@lru_cache(maxsize=len(DIMENSIONS))
def groups_in(dimension: str = DEFAULT_DIMENSION) -> dict[str, Any]:
    """One axis's groups and their full quarterly history.

    Read from that axis's own file the first time it is asked for, and cached
    after -- six axes of history is 4.3 MB, and answering a question about one
    of them should not cost the other five.

    Three shapes are accepted, newest first: an index entry naming a side file,
    an inline ``groups`` map (a single-file snapshot from before the split),
    and the bare top-level ``groups`` of a pre-dimension snapshot.
    """
    snapshot = load_snapshot()
    entry = dimensions().get(dimension)
    if entry is None:
        raise KeyError(dimension)
    if "groups" in entry:
        return entry["groups"]
    if "file" in entry:
        path = SNAPSHOT_PATH.parent / entry["file"]
        if not path.exists():
            raise SnapshotError(
                f"snapshot index names {entry['file']} for dimension {dimension!r} but it is missing. "
                "Run `python fetch_dfa.py` to rebuild."
            )
        with path.open() as fh:
            return json.load(fh)["groups"]
    if dimension == DEFAULT_DIMENSION and "groups" in snapshot:
        return snapshot["groups"]
    raise SnapshotError(f"snapshot has no groups for dimension {dimension!r}")


def _entry(group_key: str, period: str, dimension: str = DEFAULT_DIMENSION) -> dict[str, Any]:
    group = groups_in(dimension).get(group_key)
    if group is None:
        raise KeyError(group_key)
    for row in group["history"]:
        if row["period"] == period:
            return row
    raise KeyError(period)


def weights(
    group_key: str, period: str, *, investable_only: bool = False, dimension: str = DEFAULT_DIMENSION
) -> dict[str, float]:
    """Return a wealth group's allocation as fractions summing to 1.

    With ``investable_only``, categories nobody chooses as an investment
    (consumer durables) and the unallocated residual are dropped and the rest
    renormalised -- otherwise a user comparing a brokerage account against the
    top 1% would be silently competing against the Fed's estimate of everyone's
    used cars.
    """
    row = _entry(group_key, period, dimension)
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


def _liquid_keys() -> frozenset[str]:
    return frozenset(a["key"] for a in asset_classes() if a.get("liquid"))


def shape_metrics(row: dict[str, Any], w: dict[str, float]) -> dict[str, Any]:
    """Three single-number descriptions of a tier's balance sheet.

    Each is ``None`` rather than ``0.0`` when the inputs cannot support it --
    a tier with no assets has no meaningful leverage, and zero would read as
    "no debt" when the truth is "no answer".

    * ``leverage`` -- liabilities over assets. Deliberately computed from the
      row's own totals rather than from ``w``: liabilities are owed against the
      whole balance sheet, so dividing them by an investable-only subtotal
      would overstate the ratio for every tier.
    * ``concentration`` -- the largest single class's share, and which class it
      is. Follows ``w``, so it answers the question the user is actually
      looking at.
    * ``liquidity`` -- the share held in classes flagged ``liquid`` in the
      taxonomy (see constants.ASSET_CLASSES). Also follows ``w``.
    """
    total_assets = row["total_assets"]
    leverage = row["total_liabilities"] / total_assets if total_assets > 0 else None

    largest_key, largest_share = (None, None)
    if w:
        largest_key, largest_share = max(w.items(), key=lambda kv: kv[1])

    liquid = _liquid_keys()
    return {
        "leverage": leverage,
        "concentration": largest_share,
        "concentration_class": largest_key,
        "liquidity": sum(share for key, share in w.items() if key in liquid) if w else None,
    }


def threshold(group_key: str, period: str, dimension: str = DEFAULT_DIMENSION) -> dict[str, Any] | None:
    """What it takes to be in this group, and when that was last measured.

    The cutoffs come from the triennial Survey of Consumer Finances, so they
    exist for a twelfth of the quarters and never for the most recent one.
    Reading back to the newest populated value at or before the period is what
    makes them usable at all -- and it is only honest if the answer carries the
    date it came from, because a 2022 threshold against a 2026 balance sheet is
    four years of asset prices out of date.

    None where the source publishes nothing: the bottom group has no floor, and
    no amount of interpolation would give it one.
    """
    columns = [c for c in extra_columns_for(dimension) if c in THRESHOLD_COLUMNS]
    if not columns:
        return None

    group = groups_in(dimension).get(group_key)
    if group is None:
        raise KeyError(group_key)

    for row in reversed(group["history"]):
        if row["period"] > period:
            continue
        for column in columns:
            if row.get(column) is not None:
                return {"field": column, "value": row[column], "period": row["period"]}
    return None


def allocation(
    group_key: str, period: str, *, investable_only: bool = False, dimension: str = DEFAULT_DIMENSION
) -> dict[str, Any]:
    """A group's full allocation record for one period."""
    row = _entry(group_key, period, dimension)
    group = groups_in(dimension)[group_key]
    w = weights(group_key, period, investable_only=investable_only, dimension=dimension)
    return {
        "threshold": threshold(group_key, period, dimension),
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
        # How many households the totals above are spread across, so a reader
        # can turn a share of $40 trillion into a figure that means something.
        "household_count": row.get("household_count"),
        "weights": w,
        "metrics": shape_metrics(row, w),
    }


def all_allocations(
    period: str, *, investable_only: bool = False, dimension: str = DEFAULT_DIMENSION
) -> list[dict[str, Any]]:
    return [allocation(g, period, investable_only=investable_only, dimension=dimension) for g in groups_in(dimension)]


def trend(group_key: str, asset_key: str, dimension: str = DEFAULT_DIMENSION) -> list[dict[str, Any]]:
    """One asset class's share of a group's assets over the full history.

    Quarters where this class has not been published yet are omitted rather
    than plotted as zero, so a lagging series ends its line early instead of
    falling off a cliff.
    """
    group = groups_in(dimension).get(group_key)
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
