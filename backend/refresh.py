#!/usr/bin/env python
"""Pull live data from all three sources, then rescore.

    python refresh.py                      # everything, modest limits
    python refresh.py --venues congress     # one source
    python refresh.py --sec-limit 400       # deeper Form 4 coverage
    python refresh.py --no-recompute        # ingest only

This is the cron entry point. It is slow on purpose: it downloads government
PDFs one at a time with a politeness delay between requests.
"""

import argparse
import sys

from app.constants import ALL_VENUES
from app.database import SessionLocal, init_db
from app.services import refresh as refresh_service


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--venues", nargs="*", choices=list(ALL_VENUES), default=None)
    parser.add_argument("--congress-year", type=int, default=None)
    parser.add_argument("--congress-limit", type=int, default=40, help="max PTR filings to download")
    parser.add_argument("--sec-days", type=int, default=2, help="how many days of the EDGAR index to walk")
    parser.add_argument("--sec-limit", type=int, default=120, help="max Form 4 filings to download")
    parser.add_argument("--polymarket-limit", type=int, default=25, help="max markets to snapshot")
    parser.add_argument("--no-recompute", action="store_true")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        report = refresh_service.refresh(
            db,
            venues=args.venues,
            congress_year=args.congress_year,
            congress_limit=args.congress_limit,
            sec_days=args.sec_days,
            sec_limit=args.sec_limit,
            polymarket_limit=args.polymarket_limit,
            recompute=not args.no_recompute,
        )
    finally:
        db.close()

    print(f"\nAdded {report.positions_added} positions, scored {report.subjects_scored} subjects.\n")
    for result in report.results:
        print(
            f"  {result.venue:12s} seen={result.seen:5d}  added={result.added:5d}  "
            f"skipped={result.skipped:5d}  new actors={result.actors_added}"
        )

    if report.warnings:
        print(f"\n{len(report.warnings)} warning(s):")
        for warning in report.warnings[:15]:
            print(f"  - {warning}")
        if len(report.warnings) > 15:
            print(f"  ... and {len(report.warnings) - 15} more")

    if report.errors:
        print("\nERRORS:")
        for error in report.errors:
            print(f"  ! {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
