"""Refresh the bundled Federal Reserve DFA snapshot.

Pulls every series named in ``app/constants.py`` from FRED, folds them into
the Financert asset taxonomy, checks the taxonomy actually reconciles against
the Fed's own totals, and writes ``data/dfa_snapshot.json``.

    python fetch_dfa.py                 # refresh the snapshot in place
    python fetch_dfa.py --check         # fetch and validate, write nothing
    python fetch_dfa.py --since 2000    # trim history (default: 1989)

No API key is required -- FRED serves the CSV download endpoint anonymously.
The snapshot is committed to the repo so the app runs without network access;
this script exists so the data can be brought forward when the Fed publishes
a new quarter (the DFA lands about ten weeks after quarter end).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

from app.constants import (
    ALL_GROUPS,
    ASSET_CLASSES,
    CONTROL_OFFSETS,
    DFA_UNITS_MULTIPLIER,
    FRED_CSV_URL,
    GROUP_ORDER,
    UNALLOCATED,
    WEALTH_GROUPS,
    control_series_id,
    series_ids_for,
)

SNAPSHOT_PATH = Path(__file__).parent / "data" / "dfa_snapshot.json"

# The mapped buckets always fall a little short of the Fed's own asset totals
# -- see constants.ASSET_CLASSES for the two measured reasons. The observed
# shortfall runs about 1% (top 1%) to 3% (next 9%) and is reported as
# `unallocated`, so the failure bound sits above that with headroom.
#
# The two bounds are deliberately asymmetric. A shortfall is expected and only
# suspicious when large. An *overcount* has no benign explanation: it means a
# sub-item is being summed alongside the bucket that already contains it, so
# it trips almost immediately.
UNDERCOUNT_TOLERANCE = 0.06  # buckets may sum to 6% less than the DFA total
OVERCOUNT_TOLERANCE = 0.005  # but essentially never more

TIMEOUT = 60
RETRIES = 3


class FetchError(RuntimeError):
    pass


def fetch_series(series_id: str) -> dict[str, float]:
    """Download one FRED series as {ISO date: value}. Values in $ millions."""
    url = FRED_CSV_URL.format(series_id=series_id)
    last_err: Exception | None = None
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT) as resp:
                body = resp.read().decode("utf-8-sig")
            break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_err = exc
            if attempt == RETRIES - 1:
                raise FetchError(f"{series_id}: {exc}") from exc
    else:  # pragma: no cover - loop always breaks or raises
        raise FetchError(f"{series_id}: {last_err}")

    reader = csv.reader(io.StringIO(body))
    header = next(reader, None)
    if not header or len(header) < 2:
        raise FetchError(f"{series_id}: unexpected CSV header {header!r}")

    out: dict[str, float] = {}
    for row in reader:
        if len(row) < 2:
            continue
        raw = row[1].strip()
        if not raw or raw == ".":  # FRED's missing-value marker
            continue
        try:
            out[row[0].strip()] = float(raw)
        except ValueError:
            continue
    if not out:
        raise FetchError(f"{series_id}: no observations returned")
    return out


def fetch_all(series_ids: list[str]) -> dict[str, dict[str, float]]:
    """Fetch many series concurrently, preserving a stable id -> data mapping."""
    unique = sorted(set(series_ids))
    print(f"fetching {len(unique)} FRED series...", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(fetch_series, unique))
    return dict(zip(unique, results, strict=True))


def _sum_series(data: dict[str, dict[str, float]], ids: list[str], period: str) -> float | None:
    total = 0.0
    for sid in ids:
        value = data[sid].get(period)
        if value is None:
            return None
        total += value
    return total


def build_snapshot(since_year: int) -> dict:
    wanted: list[str] = []
    for group_key in ALL_GROUPS:
        for asset in ASSET_CLASSES:
            wanted.extend(series_ids_for(group_key, asset["key"]))
        for control in CONTROL_OFFSETS:
            wanted.append(control_series_id(group_key, control))

    data = fetch_all(wanted)

    # Periods are driven by the *control totals*, which every group publishes
    # on time. Individual buckets can lag behind them -- notably equity in
    # noncorporate business, which currently trails by several quarters -- so a
    # recent quarter is kept and marked incomplete rather than dropped. Every
    # published bucket's share is still correct in those quarters, because the
    # denominator is the Fed's own asset total and already includes whatever
    # has not been broken out yet.
    control_ids = [control_series_id(g, c) for g in ALL_GROUPS for c in CONTROL_OFFSETS]
    common: set[str] | None = None
    for sid in set(control_ids):
        seen = set(data[sid])
        common = seen if common is None else (common & seen)
    periods = sorted(p for p in (common or set()) if int(p[:4]) >= since_year)
    if not periods:
        raise FetchError("no periods common to every control series")

    problems: list[str] = []
    groups: dict[str, dict] = {}

    for group_key in ALL_GROUPS:
        meta = WEALTH_GROUPS[group_key]
        history: list[dict] = []
        for period in periods:
            assets: dict[str, float] = {}
            unavailable: list[str] = []
            for asset in ASSET_CLASSES:
                value = _sum_series(data, series_ids_for(group_key, asset["key"]), period)
                if value is None:
                    unavailable.append(asset["key"])
                else:
                    assets[asset["key"]] = value * DFA_UNITS_MULTIPLIER

            controls = {
                name: data[control_series_id(group_key, name)][period] * DFA_UNITS_MULTIPLIER
                for name in CONTROL_OFFSETS
            }
            reported_total = controls["nonfinancial_assets"] + controls["financial_assets"]
            summed_total = sum(assets.values())
            complete = not unavailable

            # Validate the taxonomy against the Fed's own total assets. Only
            # complete quarters can be checked: an incomplete one is short by
            # exactly the buckets the Fed has not published, which is expected
            # rather than a mapping bug.
            if reported_total > 0 and complete:
                drift = (summed_total - reported_total) / reported_total
                if drift > OVERCOUNT_TOLERANCE:
                    problems.append(
                        f"{group_key} {period}: taxonomy OVERCOUNTS -- sums to "
                        f"{summed_total:,.0f} vs DFA total {reported_total:,.0f} "
                        f"(+{drift:.2%}); a bucket is likely double counted"
                    )
                elif -drift > UNDERCOUNT_TOLERANCE:
                    problems.append(
                        f"{group_key} {period}: taxonomy sums to {summed_total:,.0f} "
                        f"but DFA totals {reported_total:,.0f} ({-drift:.2%} short)"
                    )

            # Close the remaining gap explicitly rather than letting it distort
            # a real bucket. In a complete quarter this is the small definitional
            # residual; in an incomplete one it also holds the unpublished
            # buckets, which is why `unavailable` travels with it.
            assets[UNALLOCATED["key"]] = max(reported_total - summed_total, 0.0)

            history.append(
                {
                    "period": period,
                    "assets": {k: round(v, 2) for k, v in assets.items()},
                    "unavailable": unavailable,
                    "complete": complete,
                    "total_assets": round(reported_total, 2),
                    "total_liabilities": round(controls["total_liabilities"], 2),
                    "net_worth": round(controls["net_worth"], 2),
                }
            )

        groups[group_key] = {
            "key": group_key,
            "label": meta["label"],
            "percentile_range": meta["percentile_range"],
            "population_share": meta["population_share"],
            "nested": bool(meta.get("nested")),
            "nested_in": meta.get("nested_in"),
            "history": history,
        }

    complete_periods = [
        p for i, p in enumerate(periods) if all(groups[g]["history"][i]["complete"] for g in ALL_GROUPS)
    ]
    if not complete_periods:
        raise FetchError("no quarter has every asset class published")
    print(
        f"{len(periods)} quarters {periods[0]} .. {periods[-1]} "
        f"({len(complete_periods)} complete, latest complete {complete_periods[-1]})",
        file=sys.stderr,
    )

    if problems:
        for p in problems[:10]:
            print(f"  RECONCILE FAIL {p}", file=sys.stderr)
        raise FetchError(
            f"{len(problems)} period(s) failed taxonomy reconciliation -- "
            "the asset taxonomy in constants.py does not match the DFA totals"
        )

    return {
        "source": {
            "name": "Federal Reserve Distributional Financial Accounts",
            "publisher": "Board of Governors of the Federal Reserve System",
            "retrieved_via": "FRED (fred.stlouisfed.org)",
            "url": "https://www.federalreserve.gov/releases/z1/dataviz/dfa/",
            "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "units": "US dollars, not seasonally adjusted",
        },
        "periods": periods,
        "latest_period": periods[-1],
        # The newest quarter in which every asset class is published. Callers
        # that need a full breakdown should prefer this; callers that want
        # recency can take `latest_period` and read each row's `unavailable`.
        "latest_complete_period": complete_periods[-1],
        "complete_periods": complete_periods,
        "group_order": GROUP_ORDER,
        "all_groups": ALL_GROUPS,
        "asset_classes": [
            {
                "key": a["key"],
                "label": a["label"],
                "liquid": a["liquid"],
                "blurb": a["blurb"],
                "series": {g: series_ids_for(g, a["key"]) for g in ALL_GROUPS},
            }
            for a in ASSET_CLASSES
        ]
        + [{**UNALLOCATED, "series": {}}],
        "groups": groups,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate without writing")
    parser.add_argument("--since", type=int, default=1989, help="earliest year to keep")
    args = parser.parse_args()

    try:
        snapshot = build_snapshot(args.since)
    except FetchError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    for group_key in ("top01", "top1"):
        row = next(
            r for r in snapshot["groups"][group_key]["history"] if r["period"] == snapshot["latest_complete_period"]
        )
        total = row["total_assets"]
        label = WEALTH_GROUPS[group_key]["label"]
        print(f"\n{row['period']} -- {label} composition:", file=sys.stderr)
        for asset in [*ASSET_CLASSES, UNALLOCATED]:
            share = row["assets"].get(asset["key"], 0.0) / total * 100 if total else 0.0
            print(f"  {asset['label']:<26} {share:5.1f}%", file=sys.stderr)
        print(f"  {'TOTAL ASSETS':<26} ${total / 1e12:,.1f}T", file=sys.stderr)

    newest = snapshot["groups"]["top1"]["history"][-1]
    if not newest["complete"]:
        missing = ", ".join(newest["unavailable"])
        print(
            f"\nnewest quarter {newest['period']} is incomplete -- not yet published: {missing}",
            file=sys.stderr,
        )

    if args.check:
        print("\n--check: snapshot validated, nothing written", file=sys.stderr)
        return 0

    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2) + "\n")
    size_kb = SNAPSHOT_PATH.stat().st_size / 1024
    print(f"\nwrote {SNAPSHOT_PATH} ({size_kb:.0f} KB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
