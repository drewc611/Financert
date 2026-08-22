"""Regenerate the frontend's embedded fallback dataset from the DFA snapshot.

    python tools/build_fallback.py

The dashboard falls back to this file when the API is unreachable, so it must
stay in step with ``data/dfa_snapshot.json``. Run it after ``fetch_dfa.py``.

Only the latest period's allocations and an annual sample of the trend curves
are emitted -- enough for the UI to render truthfully without shipping the full
quarterly history to every visitor.
"""

from __future__ import annotations

import json
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
SNAPSHOT = BACKEND_DIR / "data" / "dfa_snapshot.json"
TARGET = BACKEND_DIR.parent / "frontend" / "src" / "lib" / "fallbackData.js"

GROUPS = ["top01", "top1", "next9", "next40", "bottom50"]
TREND_ASSETS = ["corporate_equities", "private_business", "real_estate"]

HEADER = """/* Embedded snapshot of the Federal Reserve Distributional Financial
   Accounts, generated from backend/data/dfa_snapshot.json. Lets the
   dashboard render when the API is unreachable. Regenerate with:
     python backend/tools/build_fallback.py
   Do not hand-edit. */

export const fallbackData = """


def main() -> None:
    snapshot = json.loads(SNAPSHOT.read_text())
    latest = snapshot["latest_period"]

    out: dict = {
        "source": snapshot["source"],
        "latest_period": latest,
        "latest_complete_period": snapshot["latest_complete_period"],
        "complete_periods": snapshot["complete_periods"][-40:],
        "group_order": snapshot["group_order"],
        "periods": snapshot["periods"][-40:],
        "asset_classes": [{k: a[k] for k in ("key", "label", "liquid", "blurb")} for a in snapshot["asset_classes"]],
        "groups": {},
        "trends": {},
    }

    complete_period = snapshot["latest_complete_period"]
    for group_key in GROUPS:
        group = snapshot["groups"][group_key]
        row = group["history"][-1]
        complete_row = next(r for r in group["history"] if r["period"] == complete_period)
        out["groups"][group_key] = {
            "key": group_key,
            "label": group["label"],
            "percentile_range": group["percentile_range"],
            "nested": group.get("nested", False),
            "nested_in": group.get("nested_in"),
            "period": latest,
            "complete": row.get("complete", True),
            "unavailable": row.get("unavailable", []),
            "total_assets": row["total_assets"],
            "total_liabilities": row["total_liabilities"],
            "net_worth": row["net_worth"],
            "assets": row["assets"],
            # The newest fully published quarter, so the offline dashboard can
            # still show a complete breakdown when the latest one lags.
            "complete_snapshot": {
                "period": complete_row["period"],
                "assets": complete_row["assets"],
                "total_assets": complete_row["total_assets"],
                "total_liabilities": complete_row["total_liabilities"],
                "net_worth": complete_row["net_worth"],
            },
        }

    # Annual Q3 samples keep the file small while preserving the curve's shape.
    for asset in TREND_ASSETS:
        series = {}
        for group_key in GROUPS:
            points = []
            for row in snapshot["groups"][group_key]["history"]:
                if not row["period"].endswith("-07-01"):
                    continue
                if asset not in row["assets"]:
                    continue  # not published for this quarter yet
                total = row["total_assets"] or sum(row["assets"].values())
                points.append(
                    {
                        "period": row["period"],
                        "share": round(row["assets"][asset] / total, 5) if total else 0.0,
                    }
                )
            series[group_key] = points
        out["trends"][asset] = series

    TARGET.write_text(HEADER + json.dumps(out, indent=2) + "\n")
    print(f"wrote {TARGET} ({TARGET.stat().st_size / 1024:.0f} KB), latest period {latest}")


if __name__ == "__main__":
    main()
