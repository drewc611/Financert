"""Turn raw positions into one conviction score per subject.

Design note, and the reason this file is short and boring: it is the code a
skeptical reader will actually open to decide whether to trust the dashboard.
Every step is a pure function over plain numbers, the weights all live in
``constants.py``, and the nightly job runs a fixed number of bulk queries
rather than one query per subject.

The score answers: **how strongly, and in which direction, are powerful people
currently backing this subject with real money?** Four factors multiply:

    weight = power x conviction-quality x venue-trust x size x recency

* *power* — who they are (``services/power.py``)
* *conviction-quality* — whether the transaction type reflects a decision at
  all. An open-market purchase counts fully; a vesting grant barely counts.
* *venue-trust* — how much the disclosure regime itself is worth
* *size* — log-scaled dollars, so a $10M trade outweighs a $10k one without
  drowning it out entirely
* *recency* — exponential decay, so a trade from six months ago does not read
  as a current view
"""

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..constants import (
    CONVICTION_HALFLIFE_DAYS,
    DEFAULT_LOOKBACK_DAYS,
    SIZE_SATURATION_USD,
    VENUE_TRUST_WEIGHT,
)
from ..models import Actor, Position, SubjectScore
from ..time_utils import today, utcnow

# --------------------------------------------------------------------------
# Pure math
# --------------------------------------------------------------------------


def size_factor(usd: float | None) -> float:
    """Log-scaled dollar size, in (0, 1].

    A position with no disclosed value still counts — the fact that someone
    powerful acted is information — but at the floor rather than at zero,
    which would silently erase it.
    """
    amount = float(usd or 0.0)
    if amount <= 0:
        return 0.15
    scaled = math.log10(1 + amount) / math.log10(1 + SIZE_SATURATION_USD)
    return min(max(scaled, 0.15), 1.0)


def recency_factor(when: date | None, *, reference: date | None = None) -> float:
    """Exponential decay with a half-life of ``CONVICTION_HALFLIFE_DAYS``."""
    if when is None:
        return 0.5
    reference = reference or today()
    age_days = max((reference - when).days, 0)
    return 0.5 ** (age_days / CONVICTION_HALFLIFE_DAYS)


def position_weight(
    *,
    power_score: float,
    signal_weight: float,
    venue: str,
    usd: float | None,
    when: date | None,
    reference: date | None = None,
) -> float:
    """The multiplicative weight of a single position. Always >= 0."""
    return (
        max(power_score, 0.0)
        * max(signal_weight, 0.0)
        * VENUE_TRUST_WEIGHT.get(venue, 0.5)
        * size_factor(usd)
        * recency_factor(when, reference=reference)
    )


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------


@dataclass
class SubjectAggregate:
    """Everything we know about one subject, accumulated in a single pass."""

    subject_key: str
    subject_kind: str = ""
    subject_label: str = ""
    long_weight: float = 0.0
    short_weight: float = 0.0
    usd_long: float = 0.0
    usd_short: float = 0.0
    position_count: int = 0
    actors: set[int] = field(default_factory=set)
    venues: set[str] = field(default_factory=set)
    last_activity_at: date | None = None
    # venue -> net signed weight, the input to cross-venue divergence
    venue_direction: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    # (actor name, weight) so the UI can name the biggest mover
    actor_weights: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    # transaction dates, for cluster detection
    dates: list[date] = field(default_factory=list)

    @property
    def gross_activity(self) -> float:
        return self.long_weight + self.short_weight

    @property
    def conviction(self) -> float:
        return self.long_weight - self.short_weight

    @property
    def consensus(self) -> float:
        """Conviction normalized to [-1, 1]: how one-sided, regardless of size."""
        gross = self.gross_activity
        return (self.conviction / gross) if gross > 0 else 0.0

    @property
    def top_actor(self) -> str | None:
        if not self.actor_weights:
            return None
        return max(self.actor_weights.items(), key=lambda pair: pair[1])[0]


def aggregate(
    db: Session,
    *,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    reference: date | None = None,
) -> dict[str, SubjectAggregate]:
    """One bulk query, one pass. No N+1."""
    reference = reference or today()
    cutoff = reference - timedelta(days=lookback_days)

    rows = db.execute(
        select(
            Position.subject_key,
            Position.subject_kind,
            Position.subject_label,
            Position.venue,
            Position.direction,
            Position.usd_estimate,
            Position.signal_weight,
            Position.transacted_at,
            Position.actor_id,
            Actor.name,
            Actor.power_score,
        )
        .join(Actor, Actor.id == Position.actor_id)
        .where(Position.transacted_at.is_(None) | (Position.transacted_at >= cutoff))
    ).all()

    subjects: dict[str, SubjectAggregate] = {}

    for row in rows:
        if row.direction == 0:
            continue

        item = subjects.get(row.subject_key)
        if item is None:
            item = SubjectAggregate(
                subject_key=row.subject_key,
                subject_kind=row.subject_kind,
                subject_label=row.subject_label,
            )
            subjects[row.subject_key] = item

        weight = position_weight(
            power_score=row.power_score,
            signal_weight=row.signal_weight,
            venue=row.venue,
            usd=row.usd_estimate,
            when=row.transacted_at,
            reference=reference,
        )
        usd = float(row.usd_estimate or 0.0)

        if row.direction > 0:
            item.long_weight += weight
            item.usd_long += usd
        else:
            item.short_weight += weight
            item.usd_short += usd

        item.position_count += 1
        item.actors.add(row.actor_id)
        item.venues.add(row.venue)
        item.venue_direction[row.venue] += weight * row.direction
        item.actor_weights[row.name] += weight

        if row.transacted_at:
            item.dates.append(row.transacted_at)
            if item.last_activity_at is None or row.transacted_at > item.last_activity_at:
                item.last_activity_at = row.transacted_at

        # Prefer the longest label seen — Congress files terse names, the SEC
        # files full registrant names.
        if len(row.subject_label or "") > len(item.subject_label or ""):
            item.subject_label = row.subject_label

    return subjects


def recompute_all(db: Session, *, lookback_days: int = DEFAULT_LOOKBACK_DAYS, reference: date | None = None) -> int:
    """Rebuild ``subject_scores`` wholesale, then re-derive signals.

    Wholesale rather than incremental: the table is small (one row per subject,
    thousands at most), recency decay means every score changes daily anyway,
    and a full rebuild cannot drift out of sync with the positions table.
    """
    from . import signals  # imported here to keep the module import graph acyclic

    subjects = aggregate(db, lookback_days=lookback_days, reference=reference)

    db.execute(delete(SubjectScore))
    now = utcnow()

    for item in subjects.values():
        db.add(
            SubjectScore(
                subject_key=item.subject_key,
                subject_kind=item.subject_kind,
                subject_label=item.subject_label,
                conviction=round(item.conviction, 6),
                consensus=round(item.consensus, 6),
                gross_activity=round(item.gross_activity, 6),
                long_weight=round(item.long_weight, 6),
                short_weight=round(item.short_weight, 6),
                position_count=item.position_count,
                actor_count=len(item.actors),
                venue_count=len(item.venues),
                venues=",".join(sorted(item.venues)),
                usd_long=round(item.usd_long, 2),
                usd_short=round(item.usd_short, 2),
                top_actor=item.top_actor,
                last_activity_at=item.last_activity_at,
                computed_at=now,
            )
        )

    db.commit()

    signals.rebuild(db, subjects, reference=reference)
    return len(subjects)
