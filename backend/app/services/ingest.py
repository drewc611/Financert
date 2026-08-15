"""Persist normalized positions.

Idempotency is the whole job here. Filings get amended and re-published,
Polymarket holdings get re-snapshotted, and a refresh may be re-run at any
time — so ingestion is keyed on ``(venue, external_id)`` and an already-seen
position is skipped rather than duplicated. Double-counting would corrupt every
number downstream, and unlike a missing row it would do so invisibly.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Actor, IngestRun, Position
from ..sources.base import SourcePosition
from ..time_utils import days_between, utcnow
from . import power


@dataclass
class IngestResult:
    venue: str
    seen: int = 0
    added: int = 0
    actors_added: int = 0
    warnings: list[str] | None = None

    @property
    def skipped(self) -> int:
        return self.seen - self.added


def _upsert_actor(db: Session, item: SourcePosition) -> tuple[Actor, bool]:
    existing = db.execute(
        select(Actor).where(
            Actor.actor_type == item.actor_type,
            Actor.external_key == item.actor_external_key,
        )
    ).scalar_one_or_none()

    computed_power = power.score(item.actor_type, item.actor_name, item.actor_title, item.actor_attrs)

    if existing:
        existing.last_seen_at = utcnow()
        # Titles change (a VP becomes a CFO) and whale power grows with the
        # book. Keep the most recent view, but never downgrade a whale on a
        # single small position — power is about peak capital deployed.
        if item.actor_title:
            existing.title = item.actor_title
        if item.actor_affiliation:
            existing.affiliation = item.actor_affiliation
        existing.power_score = max(existing.power_score, computed_power)
        return existing, False

    actor = Actor(
        actor_type=item.actor_type,
        external_key=item.actor_external_key,
        name=item.actor_name,
        title=item.actor_title,
        affiliation=item.actor_affiliation,
        power_score=computed_power,
        profile_url=None,
    )
    db.add(actor)
    db.flush()  # assign the id for the position FK
    return actor, True


def ingest_positions(db: Session, venue: str, items: list[SourcePosition], warnings: list[str] | None = None):
    """Write a batch of positions, skipping any already recorded."""
    result = IngestResult(venue=venue, warnings=list(warnings or []))
    run = IngestRun(venue=venue, started_at=utcnow())
    db.add(run)

    existing_ids = {row[0] for row in db.execute(select(Position.external_id).where(Position.venue == venue)).all()}
    # Guard against duplicates inside a single batch too, not just against the
    # database — one upstream payload can legitimately repeat a key.
    batch_ids: set[str] = set()

    for item in items:
        result.seen += 1
        if item.external_id in existing_ids or item.external_id in batch_ids:
            continue
        batch_ids.add(item.external_id)

        actor, created = _upsert_actor(db, item)
        if created:
            result.actors_added += 1

        db.add(
            Position(
                venue=item.venue or venue,
                external_id=item.external_id,
                actor_id=actor.id,
                subject_kind=item.subject_kind,
                subject_key=item.subject_key,
                subject_label=item.subject_label,
                direction=item.direction,
                usd_low=item.usd_low,
                usd_high=item.usd_high,
                usd_estimate=item.usd_estimate,
                signal_weight=item.signal_weight,
                raw_code=item.raw_code,
                raw_label=item.raw_label,
                transacted_at=item.transacted_at,
                disclosed_at=item.disclosed_at,
                disclosure_lag_days=days_between(item.transacted_at, item.disclosed_at),
                source_url=item.source_url,
                notes=item.notes,
            )
        )
        result.added += 1

    run.finished_at = utcnow()
    run.ok = True
    run.positions_seen = result.seen
    run.positions_added = result.added
    run.message = "; ".join(result.warnings or []) or None

    db.commit()
    return result


def record_failure(db: Session, venue: str, message: str) -> None:
    """Log a failed refresh so a stale dashboard is diagnosable."""
    run = IngestRun(venue=venue, started_at=utcnow(), finished_at=utcnow(), ok=False, message=message)
    db.add(run)
    db.commit()
