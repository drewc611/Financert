"""The convergence engine — the reason the three feeds share a database.

Any one of these sources is available for free on its own, and a dashboard that
just stacks them side by side is three RSS readers in a trench coat. The claim
worth making is comparative:

* **Consensus** — many powerful people, independently, moving the same way on
  the same subject.
* **Divergence** — two *different kinds* of power disagreeing. Corporate
  insiders selling what members of Congress are buying is the single most
  interesting pattern in this dataset, because the two groups have access to
  genuinely different non-public information: one about the company, one about
  what is going to happen to the company.
* **Cluster** — unusual crowding into one subject inside a short window,
  regardless of direction.
* **Late disclosure** — the STOCK Act gives members 45 days. Filing on day 200
  is itself a finding, and it is one nobody can argue with.

Every signal must be able to explain itself in a sentence, because a number a
reader cannot interrogate is a number they should not act on. That is what
``headline`` and ``detail`` are for.
"""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..constants import (
    CLUSTER_MIN_ACTORS,
    CLUSTER_WINDOW_DAYS,
    CONGRESS_DISCLOSURE_DEADLINE_DAYS,
    CONSENSUS_THRESHOLD,
    DIVERGENCE_MIN_SIDE_SHARE,
    SIGNAL_CLUSTER,
    SIGNAL_CONSENSUS_LONG,
    SIGNAL_CONSENSUS_SHORT,
    SIGNAL_DIVERGENCE,
    SIGNAL_LATE_DISCLOSURE,
    VENUE_CONGRESS,
)
from ..models import Actor, Position, Signal
from ..time_utils import today, utcnow

VENUE_LABEL = {
    "congress": "members of Congress",
    "insider": "corporate insiders",
    "polymarket": "prediction-market traders",
}


def _label(venue: str) -> str:
    return VENUE_LABEL.get(venue, venue)


def _plural(count: int, singular: str, plural: str | None = None) -> str:
    return f"{count} {singular if count == 1 else (plural or singular + 's')}"


def _consensus_signal(item) -> Signal | None:
    """One-sided agreement, weighted by how many distinct people are behind it."""
    consensus = item.consensus
    actor_count = len(item.actors)

    if abs(consensus) < CONSENSUS_THRESHOLD or actor_count < 2:
        return None

    # Breadth matters as much as lopsidedness: one whale at 100% conviction is
    # not a consensus. Full credit needs CLUSTER_MIN_ACTORS distinct actors.
    breadth = min(actor_count / CLUSTER_MIN_ACTORS, 1.0)
    strength = round(min(abs(consensus) * breadth, 1.0), 4)

    bullish = consensus > 0
    side = "buying" if bullish else "selling"
    venues = ", ".join(_label(v) for v in sorted(item.venues))

    return Signal(
        subject_key=item.subject_key,
        subject_label=item.subject_label,
        kind=SIGNAL_CONSENSUS_LONG if bullish else SIGNAL_CONSENSUS_SHORT,
        strength=strength,
        headline=f"{_plural(actor_count, 'tracked actor')} net {side} {item.subject_label}",
        detail=(
            f"{abs(consensus) * 100:.0f}% of weighted activity is on the "
            f"{'buy' if bullish else 'sell'} side, across {venues}. "
            f"Weighted by seniority, position size, transaction type and recency."
        ),
        venues=",".join(sorted(item.venues)),
        actor_count=actor_count,
    )


def _divergence_signal(item) -> Signal | None:
    """Two different kinds of power taking opposite sides of the same subject."""
    if len(item.venues) < 2:
        return None

    bullish_venues = [v for v, net in item.venue_direction.items() if net > 0]
    bearish_venues = [v for v, net in item.venue_direction.items() if net < 0]
    if not bullish_venues or not bearish_venues:
        return None

    gross = item.gross_activity
    if gross <= 0:
        return None

    # Require both sides to be substantial. Otherwise a lopsided subject with
    # one stray trade on the other side would read as a genuine standoff.
    long_share = item.long_weight / gross
    short_share = item.short_weight / gross
    if min(long_share, short_share) < DIVERGENCE_MIN_SIDE_SHARE:
        return None

    # Strongest when the two sides are closest to evenly matched.
    strength = round(min(long_share, short_share) / 0.5, 4)

    buyers = " and ".join(_label(v) for v in sorted(bullish_venues))
    sellers = " and ".join(_label(v) for v in sorted(bearish_venues))
    # Not str.capitalize(), which would lowercase the rest and turn
    # "members of Congress" into "members of congress".
    buyers_leading = buyers[:1].upper() + buyers[1:]

    return Signal(
        subject_key=item.subject_key,
        subject_label=item.subject_label,
        kind=SIGNAL_DIVERGENCE,
        strength=min(strength, 1.0),
        headline=f"{buyers_leading} are buying {item.subject_label} while {sellers} sell",
        detail=(
            f"Weighted activity splits {long_share * 100:.0f}% buy / {short_share * 100:.0f}% sell "
            f"across {len(item.venues)} independent disclosure sources and "
            f"{_plural(len(item.actors), 'actor')}. These groups see different "
            f"non-public information, so disagreement between them is more "
            f"informative than agreement within any one of them."
        ),
        venues=",".join(sorted(item.venues)),
        actor_count=len(item.actors),
    )


def _cluster_signal(item, reference: date) -> Signal | None:
    """Unusual crowding into one subject inside a short window."""
    if len(item.actors) < CLUSTER_MIN_ACTORS or not item.dates:
        return None

    window_start = reference - timedelta(days=CLUSTER_WINDOW_DAYS)
    recent = [d for d in item.dates if d >= window_start]
    if len(recent) < CLUSTER_MIN_ACTORS:
        return None

    strength = round(min(len(recent) / (CLUSTER_MIN_ACTORS * 3), 1.0), 4)
    return Signal(
        subject_key=item.subject_key,
        subject_label=item.subject_label,
        kind=SIGNAL_CLUSTER,
        strength=strength,
        headline=f"{_plural(len(recent), 'disclosed move')} on {item.subject_label} in {CLUSTER_WINDOW_DAYS} days",
        detail=(
            f"{_plural(len(item.actors), 'distinct actor')} across "
            f"{', '.join(_label(v) for v in sorted(item.venues))}. "
            f"Crowding is reported regardless of direction."
        ),
        venues=",".join(sorted(item.venues)),
        actor_count=len(item.actors),
    )


def _late_disclosure_signals(db: Session, limit: int = 25) -> list[Signal]:
    """Congressional trades disclosed past the STOCK Act's 45-day deadline."""
    rows = db.execute(
        select(
            Position.subject_key,
            Position.subject_label,
            Position.disclosure_lag_days,
            Position.transacted_at,
            Actor.name,
        )
        .join(Actor, Actor.id == Position.actor_id)
        .where(
            Position.venue == VENUE_CONGRESS,
            Position.disclosure_lag_days.is_not(None),
            Position.disclosure_lag_days > CONGRESS_DISCLOSURE_DEADLINE_DAYS,
        )
        .order_by(Position.disclosure_lag_days.desc())
        .limit(limit)
    ).all()

    signals: list[Signal] = []
    for row in rows:
        overdue = row.disclosure_lag_days - CONGRESS_DISCLOSURE_DEADLINE_DAYS
        # Saturates at a year late; past that the distinction stops mattering.
        strength = round(min(overdue / 365, 1.0), 4)
        signals.append(
            Signal(
                subject_key=row.subject_key,
                subject_label=row.subject_label,
                kind=SIGNAL_LATE_DISCLOSURE,
                strength=strength,
                headline=f"{row.name} disclosed a {row.subject_label} trade {row.disclosure_lag_days} days late",
                detail=(
                    f"Traded {row.transacted_at.isoformat() if row.transacted_at else 'unknown date'}, "
                    f"disclosed {row.disclosure_lag_days} days later. The STOCK Act allows "
                    f"{CONGRESS_DISCLOSURE_DEADLINE_DAYS} days, making this {overdue} days overdue."
                ),
                venues=VENUE_CONGRESS,
                actor_count=1,
            )
        )
    return signals


def rebuild(db: Session, subjects: dict, *, reference: date | None = None) -> int:
    """Recompute every signal from the aggregates ``scoring`` just produced."""
    reference = reference or today()
    db.execute(delete(Signal))

    now = utcnow()
    produced: list[Signal] = []

    for item in subjects.values():
        for signal in (
            _divergence_signal(item),
            _consensus_signal(item),
            _cluster_signal(item, reference),
        ):
            if signal is not None:
                signal.computed_at = now
                produced.append(signal)

    for signal in _late_disclosure_signals(db):
        signal.computed_at = now
        produced.append(signal)

    for signal in produced:
        db.add(signal)
    db.commit()
    return len(produced)


def group_by_kind(signals: list[Signal]) -> dict[str, list[Signal]]:
    grouped: dict[str, list[Signal]] = defaultdict(list)
    for signal in signals:
        grouped[signal.kind].append(signal)
    return dict(grouped)
