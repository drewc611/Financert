"""Read-side aggregation for the API.

Key invariant: everything the dashboard renders comes from ``subject_scores``
and ``signals`` — the materialized output of the nightly job — plus a bounded
window of recent positions for the activity feed. Nothing here scans the full
position history, so page loads stay flat as the archive grows.
"""

from datetime import date, timedelta

from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from ..constants import ALL_VENUES, DEFAULT_LOOKBACK_DAYS
from ..models import Actor, IngestRun, Position, Signal, SubjectScore
from ..schemas import (
    IngestRunOut,
    OverviewOut,
    PositionOut,
    SignalOut,
    SubjectScoreOut,
    VenueStat,
)
from ..time_utils import today, utcnow

# Order signals are surfaced in. Divergence leads because it is the only one
# that needs all three feeds in the same database to exist at all.
SIGNAL_PRIORITY = {
    "divergence": 0,
    "consensus_long": 1,
    "consensus_short": 1,
    "cluster": 2,
    "late_disclosure": 3,
}


def position_to_out(position: Position, actor: Actor) -> PositionOut:
    return PositionOut(
        id=position.id,
        venue=position.venue,
        actor_name=actor.name,
        actor_type=actor.actor_type,
        actor_title=actor.title,
        actor_affiliation=actor.affiliation,
        power_score=actor.power_score,
        subject_kind=position.subject_kind,
        subject_key=position.subject_key,
        subject_label=position.subject_label,
        direction=position.direction,
        usd_low=position.usd_low,
        usd_high=position.usd_high,
        usd_estimate=position.usd_estimate,
        raw_code=position.raw_code,
        raw_label=position.raw_label,
        transacted_at=position.transacted_at,
        disclosed_at=position.disclosed_at,
        disclosure_lag_days=position.disclosure_lag_days,
        source_url=position.source_url,
        notes=position.notes,
    )


def recent_positions(db: Session, *, limit: int = 50, venue: str | None = None) -> list[PositionOut]:
    query = (
        select(Position, Actor)
        .join(Actor, Actor.id == Position.actor_id)
        .order_by(Position.transacted_at.desc().nullslast(), Position.id.desc())
        .limit(limit)
    )
    if venue:
        query = query.where(Position.venue == venue)
    return [position_to_out(position, actor) for position, actor in db.execute(query).all()]


def venue_stats(db: Session) -> list[VenueStat]:
    rows = db.execute(
        select(
            Position.venue,
            func.count(Position.id),
            func.count(distinct(Position.actor_id)),
            func.coalesce(func.sum(Position.usd_estimate), 0.0),
            func.max(Position.transacted_at),
        ).group_by(Position.venue)
    ).all()

    by_venue = {
        row[0]: VenueStat(
            venue=row[0],
            position_count=row[1],
            actor_count=row[2],
            usd_tracked=round(float(row[3] or 0.0), 2),
            last_activity_at=row[4] if isinstance(row[4], date) else None,
        )
        for row in rows
    }
    # Always return every venue, so a source that is down reads as an explicit
    # zero rather than vanishing from the UI.
    return [
        by_venue.get(venue, VenueStat(venue=venue, position_count=0, actor_count=0, usd_tracked=0.0))
        for venue in ALL_VENUES
    ]


def top_signals(db: Session, *, limit: int = 12, kind: str | None = None) -> list[SignalOut]:
    query = select(Signal)
    if kind:
        query = query.where(Signal.kind == kind)
    signals = db.execute(query).scalars().all()
    signals.sort(key=lambda s: (SIGNAL_PRIORITY.get(s.kind, 9), -s.strength))
    return [SignalOut.model_validate(s) for s in signals[:limit]]


def most_conviction(db: Session, *, limit: int = 10, kind: str | None = None) -> list[SubjectScoreOut]:
    """Subjects with the strongest one-directional backing."""
    query = select(SubjectScore)
    if kind:
        query = query.where(SubjectScore.subject_kind == kind)
    rows = db.execute(query).scalars().all()
    rows.sort(key=lambda s: -abs(s.conviction))
    return [SubjectScoreOut.model_validate(r) for r in rows[:limit]]


def most_contested(db: Session, *, limit: int = 10) -> list[SubjectScoreOut]:
    """Subjects where powerful money is most evenly split.

    Sorted by how balanced the two sides are, then by how much is at stake —
    a dead heat between two small trades is noise, not a standoff.
    """
    rows = db.execute(select(SubjectScore).where(SubjectScore.gross_activity > 0)).scalars().all()
    contested = [r for r in rows if min(r.long_weight, r.short_weight) > 0]
    contested.sort(key=lambda s: (abs(s.consensus), -s.gross_activity))
    return [SubjectScoreOut.model_validate(r) for r in contested[:limit]]


def last_runs(db: Session, *, limit: int = 6) -> list[IngestRunOut]:
    rows = db.execute(select(IngestRun).order_by(IngestRun.started_at.desc()).limit(limit)).scalars().all()
    return [IngestRunOut.model_validate(r) for r in rows]


def actors(db: Session, *, limit: int = 100, actor_type: str | None = None) -> list[dict]:
    """People ranked by how much weighted money movement we have attributed."""
    query = (
        select(
            Actor,
            func.count(Position.id).label("position_count"),
            func.coalesce(func.sum(Position.usd_estimate), 0.0).label("usd_total"),
            func.max(Position.transacted_at).label("last_active"),
        )
        .join(Position, Position.actor_id == Actor.id)
        .group_by(Actor.id)
    )
    if actor_type:
        query = query.where(Actor.actor_type == actor_type)

    rows = db.execute(query).all()
    people = [
        {
            "id": row.Actor.id,
            "name": row.Actor.name,
            "actor_type": row.Actor.actor_type,
            "title": row.Actor.title,
            "affiliation": row.Actor.affiliation,
            "power_score": row.Actor.power_score,
            "position_count": row.position_count,
            "usd_total": round(float(row.usd_total or 0.0), 2),
            "last_active": row.last_active,
        }
        for row in rows
    ]
    people.sort(key=lambda p: (-p["power_score"], -p["usd_total"]))
    return people[:limit]


def subject_detail(db: Session, subject_key: str) -> dict | None:
    """One subject: its score, its signals, and every position behind it."""
    score = db.execute(select(SubjectScore).where(SubjectScore.subject_key == subject_key)).scalar_one_or_none()

    rows = db.execute(
        select(Position, Actor)
        .join(Actor, Actor.id == Position.actor_id)
        .where(Position.subject_key == subject_key)
        .order_by(Position.transacted_at.desc().nullslast())
    ).all()

    if score is None and not rows:
        return None

    signals = db.execute(select(Signal).where(Signal.subject_key == subject_key)).scalars().all()
    signals.sort(key=lambda s: (SIGNAL_PRIORITY.get(s.kind, 9), -s.strength))

    return {
        "score": SubjectScoreOut.model_validate(score) if score else None,
        "signals": [SignalOut.model_validate(s) for s in signals],
        "positions": [position_to_out(position, actor) for position, actor in rows],
    }


def overview(db: Session, *, lookback_days: int = DEFAULT_LOOKBACK_DAYS) -> OverviewOut:
    cutoff = today() - timedelta(days=lookback_days)

    total_positions = db.execute(
        select(func.count(Position.id)).where(Position.transacted_at.is_(None) | (Position.transacted_at >= cutoff))
    ).scalar_one()
    total_actors = db.execute(select(func.count(Actor.id))).scalar_one()
    total_usd = db.execute(
        select(func.coalesce(func.sum(Position.usd_estimate), 0.0)).where(
            Position.transacted_at.is_(None) | (Position.transacted_at >= cutoff)
        )
    ).scalar_one()

    return OverviewOut(
        generated_at=utcnow(),
        lookback_days=lookback_days,
        total_positions=total_positions,
        total_actors=total_actors,
        total_usd_tracked=round(float(total_usd or 0.0), 2),
        venues=venue_stats(db),
        top_signals=top_signals(db, limit=12),
        most_conviction=most_conviction(db, limit=10),
        most_contested=most_contested(db, limit=8),
        recent_positions=recent_positions(db, limit=40),
        last_runs=last_runs(db),
    )
