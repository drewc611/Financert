"""Orchestrates a pull from all three upstreams.

One venue failing must never take the others down with it. Government
endpoints go offline, the House Clerk reshapes a PDF, a market API rate-limits
— each source is therefore wrapped independently, its failure recorded in
``ingest_runs``, and the run continues. A dashboard showing two of three
sources with an explicit note about the third is far more useful than an error
page.
"""

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ..constants import ALL_VENUES, VENUE_CONGRESS, VENUE_INSIDER, VENUE_POLYMARKET
from ..sources import congress, insiders, polymarket
from ..time_utils import today
from . import ingest, scoring


@dataclass
class RefreshReport:
    results: list[ingest.IngestResult] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    subjects_scored: int = 0

    @property
    def positions_added(self) -> int:
        return sum(r.added for r in self.results)

    def as_dict(self) -> dict:
        return {
            "positions_added": self.positions_added,
            "subjects_scored": self.subjects_scored,
            "by_venue": [
                {"venue": r.venue, "seen": r.seen, "added": r.added, "skipped": r.skipped, "new_actors": r.actors_added}
                for r in self.results
            ],
            "warnings": self.warnings,
            "errors": self.errors,
        }


def refresh(
    db: Session,
    *,
    venues: list[str] | None = None,
    congress_year: int | None = None,
    congress_limit: int = 40,
    sec_days: int = 2,
    sec_limit: int = 120,
    polymarket_limit: int = 25,
    recompute: bool = True,
) -> RefreshReport:
    selected = set(venues or ALL_VENUES)
    report = RefreshReport()

    if VENUE_POLYMARKET in selected:
        try:
            positions, warnings = polymarket.fetch(limit=polymarket_limit)
            report.results.append(ingest.ingest_positions(db, VENUE_POLYMARKET, positions, warnings))
            report.warnings.extend(warnings)
        except Exception as exc:
            message = f"polymarket refresh failed: {exc}"
            report.errors.append(message)
            ingest.record_failure(db, VENUE_POLYMARKET, message)

    if VENUE_INSIDER in selected:
        try:
            positions, warnings = insiders.fetch(days=sec_days, limit=sec_limit)
            report.results.append(ingest.ingest_positions(db, VENUE_INSIDER, positions, warnings))
            report.warnings.extend(warnings)
        except Exception as exc:
            message = f"insider refresh failed: {exc}"
            report.errors.append(message)
            ingest.record_failure(db, VENUE_INSIDER, message)

    if VENUE_CONGRESS in selected:
        try:
            year = congress_year or today().year
            positions, warnings = congress.fetch(year=year, limit=congress_limit)
            # Early in a calendar year there are few filings yet; fall back to
            # the previous year so the feed is never empty in January.
            if not positions and congress_year is None:
                fallback, more = congress.fetch(year=year - 1, limit=congress_limit)
                positions, warnings = fallback, warnings + more
            report.results.append(ingest.ingest_positions(db, VENUE_CONGRESS, positions, warnings))
            report.warnings.extend(warnings)
        except Exception as exc:
            message = f"congress refresh failed: {exc}"
            report.errors.append(message)
            ingest.record_failure(db, VENUE_CONGRESS, message)

    if recompute:
        report.subjects_scored = scoring.recompute_all(db)

    return report
