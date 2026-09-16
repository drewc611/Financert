"""What changed between two refreshes of the DFA snapshot (BACKLOG F63).

    python tools/snapshot_diff.py OLD_INDEX NEW_INDEX
    python tools/snapshot_diff.py OLD_INDEX NEW_INDEX --json

A refresh rewrites six dimension files and about 4 MB of JSON, and `git diff`
over that says only that every line changed. The question a reviewer actually
has is smaller and has three parts:

* Is there a new quarter, and is that all this is?
* Did the Fed **revise** an old quarter? It does, routinely, and a revision is
  the one change that alters numbers already shown to someone.
* Did the shape change -- a dimension, a group or an asset class appearing or
  disappearing? That is the change that breaks things rather than moving them.

Each side is an index file (``data/dfa_snapshot.json``); the per-dimension
histories are read from the side files beside it, so this works on a checkout
of an older commit as well as on the working tree.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# A share that moved by less than this is the source's own rounding, not a
# revision: DFA levels are published in whole millions, so a small tier's
# smallest class moves by a hair every time anything is restated.
REVISION_FLOOR_PP = 0.005

# Printed per section. A refresh that revises hundreds of rows is a finding in
# itself; the reader does not need all of them to see it.
TOP_N = 12


class SnapshotPair:
    """Two snapshots, each loaded lazily by dimension."""

    def __init__(self, old: Path, new: Path) -> None:
        self.paths = {"old": old, "new": new}
        self.index = {side: json.loads(path.read_text()) for side, path in self.paths.items()}

    def dimensions(self, side: str) -> dict[str, Any]:
        return self.index[side].get("dimensions", {})

    def groups(self, side: str, dimension: str) -> dict[str, Any]:
        """One dimension's groups, from the side file the index names.

        Falls back to an inline ``groups`` map so a pre-split snapshot -- the
        single-file shape this project used before the dimensions landed --
        can still be one side of a comparison.
        """
        entry = self.dimensions(side).get(dimension, {})
        if "groups" in entry:
            return entry["groups"]
        if "file" in entry:
            path = self.paths[side].parent / entry["file"]
            if not path.exists():
                raise SystemExit(f"error: {self.paths[side]} names {entry['file']}, which is not beside it")
            return json.loads(path.read_text())["groups"]
        return self.index[side].get("groups", {}) if dimension == self.index[side].get("default_dimension") else {}


def _shares(row: dict[str, Any]) -> dict[str, float]:
    """One history row as shares of its own asset total.

    Shares rather than dollars: every balance sheet grows, so a dollar
    comparison would report the whole population as revised every quarter.
    """
    assets = row.get("assets", {})
    total = sum(assets.values())
    return {key: value / total for key, value in assets.items()} if total else {}


def compare(pair: SnapshotPair) -> dict[str, Any]:
    old_periods = pair.index["old"].get("periods", [])
    new_periods = pair.index["new"].get("periods", [])

    report: dict[str, Any] = {
        "source": {
            side: {
                "checksum": pair.index[side].get("source", {}).get("archive_sha256", "")[:12],
                "retrieved": pair.index[side].get("source", {}).get("retrieved_at", ""),
                "latest_period": pair.index[side].get("latest_period", ""),
            }
            for side in ("old", "new")
        },
        "periods_added": [p for p in new_periods if p not in set(old_periods)],
        "periods_removed": [p for p in old_periods if p not in set(new_periods)],
        "dimensions_added": sorted(set(pair.dimensions("new")) - set(pair.dimensions("old"))),
        "dimensions_removed": sorted(set(pair.dimensions("old")) - set(pair.dimensions("new"))),
        "classes_added": [],
        "classes_removed": [],
        "groups_added": [],
        "groups_removed": [],
        "revisions": [],
        "revised_rows": 0,
    }

    old_classes = {a["key"] for a in pair.index["old"].get("asset_classes", [])}
    new_classes = {a["key"] for a in pair.index["new"].get("asset_classes", [])}
    report["classes_added"] = sorted(new_classes - old_classes)
    report["classes_removed"] = sorted(old_classes - new_classes)

    for dimension in sorted(set(pair.dimensions("old")) & set(pair.dimensions("new"))):
        old_groups = pair.groups("old", dimension)
        new_groups = pair.groups("new", dimension)
        report["groups_added"] += [f"{dimension}/{k}" for k in sorted(set(new_groups) - set(old_groups))]
        report["groups_removed"] += [f"{dimension}/{k}" for k in sorted(set(old_groups) - set(new_groups))]

        for group in sorted(set(old_groups) & set(new_groups)):
            old_history = {row["period"]: row for row in old_groups[group]["history"]}
            new_history = {row["period"]: row for row in new_groups[group]["history"]}
            # Only periods both snapshots carry: a new quarter is news, not a
            # revision, and it is already reported above.
            for period in sorted(set(old_history) & set(new_history)):
                before = _shares(old_history[period])
                after = _shares(new_history[period])
                moved = False
                for key in sorted(set(before) | set(after)):
                    change = (after.get(key, 0.0) - before.get(key, 0.0)) * 100
                    if abs(change) < REVISION_FLOOR_PP:
                        continue
                    moved = True
                    report["revisions"].append(
                        {
                            "dimension": dimension,
                            "group": group,
                            "period": period,
                            "asset_class": key,
                            "change_pp": round(change, 4),
                        }
                    )
                if moved:
                    report["revised_rows"] += 1

    report["revisions"].sort(key=lambda r: abs(r["change_pp"]), reverse=True)
    return report


def render(report: dict[str, Any]) -> str:
    old, new = report["source"]["old"], report["source"]["new"]
    lines = [
        f"old  {old['checksum'] or '?'}  retrieved {old['retrieved'] or '?'}  latest {old['latest_period'] or '?'}",
        f"new  {new['checksum'] or '?'}  retrieved {new['retrieved'] or '?'}  latest {new['latest_period'] or '?'}",
        "",
    ]

    if old["checksum"] and old["checksum"] == new["checksum"]:
        lines.append("Same archive: the published file has not changed since the committed snapshot was built.")
        lines.append("")

    for label, key in [
        ("Quarters added", "periods_added"),
        ("Quarters removed", "periods_removed"),
        ("Dimensions added", "dimensions_added"),
        ("Dimensions removed", "dimensions_removed"),
        ("Asset classes added", "classes_added"),
        ("Asset classes removed", "classes_removed"),
        ("Groups added", "groups_added"),
        ("Groups removed", "groups_removed"),
    ]:
        if report[key]:
            lines.append(f"{label}: {', '.join(report[key])}")

    # The part worth reading twice: a revision changes a number someone has
    # already been shown.
    if report["revised_rows"]:
        lines.append("")
        lines.append(f"Revised: {report['revised_rows']} group-quarters, {len(report['revisions'])} class shares")
        for revision in report["revisions"][:TOP_N]:
            lines.append(
                f"  {revision['change_pp']:+7.3f} pp  {revision['period']}  "
                f"{revision['dimension']}/{revision['group']}  {revision['asset_class']}"
            )
        if len(report["revisions"]) > TOP_N:
            lines.append(f"  ... and {len(report['revisions']) - TOP_N} more")
    else:
        lines.append("")
        lines.append("No revisions: every quarter both snapshots carry holds the same shares.")

    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("old", type=Path, help="the older snapshot index")
    parser.add_argument("new", type=Path, help="the newer snapshot index")
    parser.add_argument("--json", action="store_true", help="machine-readable, for a workflow to post")
    args = parser.parse_args(argv[1:])

    for path in (args.old, args.new):
        if not path.exists():
            print(f"error: no snapshot at {path}", file=sys.stderr)
            return 2

    report = compare(SnapshotPair(args.old, args.new))
    print(json.dumps(report, indent=2) if args.json else render(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
