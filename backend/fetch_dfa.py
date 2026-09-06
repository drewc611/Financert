"""Refresh the bundled Federal Reserve DFA snapshot.

Downloads the Fed's bulk DFA zip, folds the wealth-percentile detail file into
the Financert asset taxonomy, checks the taxonomy reconciles against the Fed's
own published totals, and writes ``data/dfa_snapshot.json``.

    python fetch_dfa.py                 # refresh the snapshot in place
    python fetch_dfa.py --check         # fetch and validate, write nothing
    python fetch_dfa.py --since 2000    # trim history (default: 1989)

One request, no API key. The snapshot is committed to the repo so the app runs
without network access; this script exists so the data can be brought forward
when the Fed publishes a new quarter (roughly ten weeks after quarter end).

Run ``tools/build_fallback.py`` afterwards, or the offline dashboard drifts
from the API.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from app.constants import (
    ALL_GROUPS,
    ASSET_CLASSES,
    CONTROL_COLUMNS,
    DFA_MEMBER,
    DFA_UNITS_MULTIPLIER,
    DFA_ZIP_URL,
    EXTRA_COLUMNS,
    GROUP_ORDER,
    UNALLOCATED,
    WEALTH_GROUPS,
    categories_for,
    columns_for,
    parse_period,
)

SNAPSHOT_PATH = Path(__file__).parent / "data" / "dfa_snapshot.json"

# With the full column set the components reconcile to the Fed's published
# `Assets` total to within 0.0002% across every row, so the bound is tight
# enough to catch a real mapping error. The two directions are still separated:
# an overcount can only mean a sub-item is being summed alongside the parent
# that already contains it, which is never benign.
UNDERCOUNT_TOLERANCE = 0.005
OVERCOUNT_TOLERANCE = 0.005

TIMEOUT = 180
RETRIES = 3

# The archive is ~0.9 MB and the member ~0.16 MB. These caps are ~20x headroom
# for growth while still bounding a decompression bomb: without them a 161 KB
# zip can expand to gigabytes and take the process out. The URL is hardcoded
# and HTTPS, so reaching this needs a compromised federalreserve.gov or a
# broken TLS chain -- unlikely, but the guard is nearly free and the failure
# mode without it is an OOM kill rather than an error.
MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
MAX_MEMBER_BYTES = 200 * 1024 * 1024
MAX_ROWS = 200_000


class FetchError(RuntimeError):
    pass


# federalreserve.gov returns 403 to urllib's default user agent. Identify the
# client honestly rather than impersonating a browser.
USER_AGENT = "Financert/0.1 (+https://github.com/drewc611/Financert) Python-urllib"


def download_zip(url: str = DFA_ZIP_URL) -> bytes:
    last_err: Exception | None = None
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as resp:
                # Read one byte past the cap so an oversized body is detected
                # rather than silently truncated into a corrupt archive.
                blob = resp.read(MAX_ARCHIVE_BYTES + 1)
            if len(blob) > MAX_ARCHIVE_BYTES:
                raise FetchError(f"archive exceeds {MAX_ARCHIVE_BYTES // 1024 // 1024} MB; refusing to parse it")
            return blob
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_err = exc
            if attempt == RETRIES - 1:
                raise FetchError(f"downloading {url}: {exc}") from exc
    raise FetchError(f"downloading {url}: {last_err}")  # pragma: no cover


def read_member(blob: bytes, member: str = DFA_MEMBER) -> list[dict[str, str]]:
    """Extract one CSV from the zip as a list of row dicts."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile as exc:
        raise FetchError(f"downloaded file is not a zip: {exc}") from exc

    if member not in archive.namelist():
        raise FetchError(
            f"{member} missing from the DFA zip; the Fed may have renamed it. "
            f"Members: {', '.join(sorted(archive.namelist())[:8])}..."
        )

    # Check the declared size before decompressing anything. `getinfo` reads
    # the central directory, which a bomb still has to declare honestly for
    # the archive to be valid.
    info = archive.getinfo(member)
    if info.file_size > MAX_MEMBER_BYTES:
        raise FetchError(
            f"{member} declares {info.file_size / 1024 / 1024:.0f} MB uncompressed, "
            f"over the {MAX_MEMBER_BYTES // 1024 // 1024} MB cap; refusing to parse it"
        )

    # ...and cap the rows actually read, in case the declared size lies. The
    # member is opened by exact name and never extracted to disk, so a crafted
    # member name cannot escape the archive.
    rows: list[dict[str, str]] = []
    with archive.open(member) as fh:
        for row in csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig")):
            rows.append(row)
            if len(rows) > MAX_ROWS:
                raise FetchError(f"{member} exceeds {MAX_ROWS:,} rows; refusing to parse it")
    if not rows:
        raise FetchError(f"{member} is empty")
    return rows


def _num(row: dict[str, str], column: str) -> float:
    """Read one cell. Blank means the Fed published no value."""
    try:
        raw = row[column]
    except KeyError:
        raise FetchError(
            f"column {column!r} missing from {DFA_MEMBER}; the Fed may have "
            "renamed it -- check app/constants.py against the file header"
        ) from None
    raw = (raw or "").strip()
    if not raw:
        return 0.0
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _sum_columns(rows: list[dict[str, str]], columns: list[str]) -> float:
    return sum(_num(row, column) for row in rows for column in columns)


def build_snapshot(since_year: int, *, blob: bytes | None = None) -> dict:
    if blob is None:
        print(f"downloading {DFA_ZIP_URL} ...", file=sys.stderr)
        blob = download_zip()
        print(f"  {len(blob) / 1024:.0f} KB", file=sys.stderr)

    rows = read_member(blob)

    # Index by (period, category) so a wealth group can be assembled from one
    # row or several -- the top 1% is split at the 99.9th percentile.
    by_key: dict[tuple[str, str], dict[str, str]] = {}
    for row in rows:
        by_key[(row["Date"], row["Category"])] = row

    periods_raw = sorted({row["Date"] for row in rows}, key=lambda p: parse_period(p))
    periods_raw = [p for p in periods_raw if int(p.split(":")[0]) >= since_year]
    if not periods_raw:
        raise FetchError("no periods at or after the requested start year")

    problems: list[str] = []
    groups: dict[str, dict] = {}

    for group_key in ALL_GROUPS:
        meta = WEALTH_GROUPS[group_key]
        categories = categories_for(group_key)
        history: list[dict] = []

        for period_raw in periods_raw:
            parts = [by_key.get((period_raw, cat)) for cat in categories]
            if any(part is None for part in parts):
                missing = [c for c, p in zip(categories, parts, strict=True) if p is None]
                raise FetchError(f"{period_raw}: category rows missing: {', '.join(missing)}")

            assets = {
                asset["key"]: _sum_columns(parts, columns_for(asset["key"])) * DFA_UNITS_MULTIPLIER
                for asset in ASSET_CLASSES
            }
            controls = {
                name: _sum_columns(parts, [column]) * DFA_UNITS_MULTIPLIER for name, column in CONTROL_COLUMNS.items()
            }
            extras = {name: _sum_columns(parts, [column]) for name, column in EXTRA_COLUMNS.items()}

            reported_total = controls["total_assets"]
            summed_total = sum(assets.values())

            # Validate the taxonomy against the Fed's own published total. A
            # shortfall means a bucket is missing; an overcount means a
            # sub-item is being summed alongside its parent.
            if reported_total > 0:
                drift = (summed_total - reported_total) / reported_total
                if drift > OVERCOUNT_TOLERANCE:
                    problems.append(
                        f"{group_key} {period_raw}: taxonomy OVERCOUNTS -- sums to "
                        f"{summed_total:,.0f} vs published {reported_total:,.0f} "
                        f"(+{drift:.4%}); a bucket is likely double counted"
                    )
                elif -drift > UNDERCOUNT_TOLERANCE:
                    problems.append(
                        f"{group_key} {period_raw}: taxonomy sums to {summed_total:,.0f} "
                        f"but published total is {reported_total:,.0f} ({-drift:.4%} short)"
                    )

            # Rounding only, now that the taxonomy covers every component.
            assets[UNALLOCATED["key"]] = max(reported_total - summed_total, 0.0)

            history.append(
                {
                    "period": parse_period(period_raw),
                    "assets": {k: round(v, 2) for k, v in assets.items()},
                    "total_assets": round(reported_total, 2),
                    "total_liabilities": round(controls["total_liabilities"], 2),
                    "net_worth": round(controls["net_worth"], 2),
                    "household_count": round(extras["household_count"], 2),
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

    if problems:
        for problem in problems[:10]:
            print(f"  RECONCILE FAIL {problem}", file=sys.stderr)
        raise FetchError(
            f"{len(problems)} period(s) failed taxonomy reconciliation -- "
            "the asset taxonomy in constants.py does not match the DFA totals"
        )

    periods = [parse_period(p) for p in periods_raw]
    print(f"{len(periods)} quarters: {periods[0]} .. {periods[-1]}", file=sys.stderr)

    return {
        "source": {
            "name": "Federal Reserve Distributional Financial Accounts",
            "publisher": "Board of Governors of the Federal Reserve System",
            "retrieved_via": f"bulk download, {DFA_MEMBER}",
            "url": "https://www.federalreserve.gov/releases/z1/dataviz/dfa/",
            "download_url": DFA_ZIP_URL,
            "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
            # Pins exactly which publication this snapshot was built from, so a
            # refresh that changes numbers can be told from one that does not.
            "archive_sha256": hashlib.sha256(blob).hexdigest(),
            "archive_bytes": len(blob),
            "units": "US dollars, not seasonally adjusted",
        },
        "periods": periods,
        "latest_period": periods[-1],
        # Every quarter carries every asset class in this source. The fields
        # are kept so the API contract is stable and so a genuine future gap
        # has somewhere to be reported.
        "latest_complete_period": periods[-1],
        "complete_periods": periods,
        "group_order": GROUP_ORDER,
        "all_groups": ALL_GROUPS,
        "asset_classes": [
            {
                "key": a["key"],
                "label": a["label"],
                "liquid": a["liquid"],
                "blurb": a["blurb"],
                "columns": columns_for(a["key"]),
            }
            for a in ASSET_CLASSES
        ]
        + [{**UNALLOCATED, "columns": []}],
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
        row = snapshot["groups"][group_key]["history"][-1]
        total = row["total_assets"]
        label = WEALTH_GROUPS[group_key]["label"]
        print(f"\n{row['period']} -- {label} composition:", file=sys.stderr)
        for asset in [*ASSET_CLASSES, UNALLOCATED]:
            share = row["assets"].get(asset["key"], 0.0) / total * 100 if total else 0.0
            print(f"  {asset['label']:<26} {share:5.2f}%", file=sys.stderr)
        print(f"  {'TOTAL ASSETS':<26} ${total / 1e12:,.1f}T", file=sys.stderr)
        print(f"  {'HOUSEHOLDS':<26} {row['household_count']:,.0f}", file=sys.stderr)

    if args.check:
        print("\n--check: snapshot validated, nothing written", file=sys.stderr)
        return 0

    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(f"\nwrote {SNAPSHOT_PATH} ({SNAPSHOT_PATH.stat().st_size / 1024:.0f} KB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
