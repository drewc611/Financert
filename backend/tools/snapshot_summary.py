"""Say what a snapshot index is, as `key=value` lines.

    python tools/snapshot_summary.py                     # the committed snapshot
    git show HEAD:backend/data/dfa_snapshot.json \
        | python backend/tools/snapshot_summary.py -     # ...and what it was

Written for the data-refresh workflow, which needs both to describe a refresh
in the pull request it opens. `key=value` because that is what a GitHub Actions
step output wants, and because it reads fine on a terminal.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

DEFAULT = Path(__file__).resolve().parent.parent / "data" / "dfa_snapshot.json"


def summarise(snapshot: dict) -> dict[str, str]:
    source = snapshot.get("source", {})
    return {
        "period": snapshot.get("latest_period", "unknown"),
        "periods": str(len(snapshot.get("periods", []))),
        "checksum": str(source.get("archive_sha256", ""))[:12],
        "retrieved": str(source.get("retrieved_at", "")),
        "dimensions": ",".join(snapshot.get("dimensions", {})),
    }


def main(argv: list[str]) -> int:
    raw = sys.stdin.read() if argv[1:2] == ["-"] else DEFAULT.read_text()
    try:
        snapshot = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"error: not a snapshot index: {exc}", file=sys.stderr)
        return 1
    for key, value in summarise(snapshot).items():
        print(f"{key}={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
