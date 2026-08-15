"""The convergence engine.

Divergence is the product's central claim, so most of these tests are about
when it must fire and — more importantly — when it must not.
"""

from datetime import date, timedelta

from app.constants import (
    SIGNAL_CLUSTER,
    SIGNAL_CONSENSUS_LONG,
    SIGNAL_CONSENSUS_SHORT,
    SIGNAL_DIVERGENCE,
    SIGNAL_LATE_DISCLOSURE,
    VENUE_CONGRESS,
    VENUE_INSIDER,
)
from app.models import Signal
from app.services import ingest, scoring
from tests.conftest import make_position

TODAY = date(2026, 8, 15)


def add(db, venue, **kwargs):
    kwargs.setdefault("transacted_at", TODAY)
    kwargs.setdefault("venue", venue)
    ingest.ingest_positions(db, venue, [make_position(**kwargs)])


def kinds(db) -> set[str]:
    return {row.kind for row in db.query(Signal).all()}


def signal_of(db, kind: str, subject_key: str) -> Signal | None:
    return db.query(Signal).filter_by(kind=kind, subject_key=subject_key).one_or_none()


def buyers(db, venue, subject, count, *, usd=500_000.0, prefix="b"):
    for index in range(count):
        add(
            db,
            venue,
            external_id=f"{prefix}-{subject}-{index}",
            subject_key=subject,
            direction=1,
            usd_estimate=usd,
            actor_type="politician" if venue == VENUE_CONGRESS else "insider",
            actor_external_key=f"{prefix}-actor-{index}",
            actor_name=f"Buyer {index}",
        )


def sellers(db, venue, subject, count, *, usd=500_000.0, prefix="s", signal_weight=1.0):
    for index in range(count):
        add(
            db,
            venue,
            external_id=f"{prefix}-{subject}-{index}",
            subject_key=subject,
            direction=-1,
            usd_estimate=usd,
            signal_weight=signal_weight,
            actor_type="politician" if venue == VENUE_CONGRESS else "insider",
            actor_external_key=f"{prefix}-actor-{index}",
            actor_name=f"Seller {index}",
        )


# ------------------------------------------------------------- consensus


def test_broad_one_sided_buying_produces_consensus_long(db):
    buyers(db, VENUE_CONGRESS, "AAA", 4)
    scoring.recompute_all(db, reference=TODAY)
    assert SIGNAL_CONSENSUS_LONG in kinds(db)


def test_broad_one_sided_selling_produces_consensus_short(db):
    sellers(db, VENUE_CONGRESS, "BBB", 4)
    scoring.recompute_all(db, reference=TODAY)
    assert SIGNAL_CONSENSUS_SHORT in kinds(db)


def test_a_single_actor_is_not_a_consensus(db):
    """One person moving alone is a data point, not agreement."""
    buyers(db, VENUE_CONGRESS, "SOLO", 1, usd=50_000_000.0)
    scoring.recompute_all(db, reference=TODAY)
    assert signal_of(db, SIGNAL_CONSENSUS_LONG, "SOLO") is None


def test_consensus_strength_grows_with_breadth(db):
    buyers(db, VENUE_CONGRESS, "NARROW", 2, prefix="n")
    buyers(db, VENUE_CONGRESS, "WIDE", 5, prefix="w")
    scoring.recompute_all(db, reference=TODAY)

    narrow = signal_of(db, SIGNAL_CONSENSUS_LONG, "NARROW")
    wide = signal_of(db, SIGNAL_CONSENSUS_LONG, "WIDE")
    assert narrow and wide
    assert wide.strength > narrow.strength


# ------------------------------------------------------------ divergence


def test_congress_buying_what_insiders_sell_is_divergence(db):
    buyers(db, VENUE_CONGRESS, "SPLIT", 3, prefix="cong")
    sellers(db, VENUE_INSIDER, "SPLIT", 3, prefix="ins")
    scoring.recompute_all(db, reference=TODAY)

    signal = signal_of(db, SIGNAL_DIVERGENCE, "SPLIT")
    assert signal is not None
    assert "buying" in signal.headline and "sell" in signal.headline
    assert VENUE_CONGRESS in signal.venues and VENUE_INSIDER in signal.venues


def test_disagreement_inside_one_venue_is_not_divergence(db):
    """Divergence is about different *kinds* of power disagreeing. Members of
    Congress taking both sides is ordinary churn."""
    buyers(db, VENUE_CONGRESS, "CHURN", 3, prefix="cb")
    sellers(db, VENUE_CONGRESS, "CHURN", 3, prefix="cs")
    scoring.recompute_all(db, reference=TODAY)
    assert signal_of(db, SIGNAL_DIVERGENCE, "CHURN") is None


def test_one_stray_trade_does_not_make_a_standoff(db):
    """A lopsided subject with a token amount on the other side must not read
    as a genuine disagreement."""
    buyers(db, VENUE_CONGRESS, "LOPSIDED", 6, usd=5_000_000.0, prefix="lb")
    sellers(db, VENUE_INSIDER, "LOPSIDED", 1, usd=900.0, prefix="ls", signal_weight=0.02)
    scoring.recompute_all(db, reference=TODAY)
    assert signal_of(db, SIGNAL_DIVERGENCE, "LOPSIDED") is None


def test_divergence_is_strongest_when_evenly_matched(db):
    buyers(db, VENUE_CONGRESS, "EVEN", 3, prefix="eb")
    sellers(db, VENUE_INSIDER, "EVEN", 3, prefix="es")

    # Tilted, but still clearing the 30% minimum-side-share floor. A sharper
    # tilt (5 against 2) drops under it and correctly produces no signal at
    # all, which is covered by test_one_stray_trade_does_not_make_a_standoff.
    buyers(db, VENUE_CONGRESS, "TILTED", 4, prefix="tb")
    sellers(db, VENUE_INSIDER, "TILTED", 3, prefix="ts")

    scoring.recompute_all(db, reference=TODAY)
    even = signal_of(db, SIGNAL_DIVERGENCE, "EVEN")
    tilted = signal_of(db, SIGNAL_DIVERGENCE, "TILTED")
    assert even and tilted
    assert even.strength > tilted.strength


def test_agreement_across_venues_is_not_divergence(db):
    buyers(db, VENUE_CONGRESS, "AGREE", 3, prefix="ab")
    buyers(db, VENUE_INSIDER, "AGREE", 3, prefix="ai")
    scoring.recompute_all(db, reference=TODAY)
    assert signal_of(db, SIGNAL_DIVERGENCE, "AGREE") is None
    assert signal_of(db, SIGNAL_CONSENSUS_LONG, "AGREE") is not None


# --------------------------------------------------------------- cluster


def test_crowding_in_a_short_window_produces_a_cluster(db):
    buyers(db, VENUE_CONGRESS, "CROWD", 5, prefix="cr")
    scoring.recompute_all(db, reference=TODAY)
    assert signal_of(db, SIGNAL_CLUSTER, "CROWD") is not None


def test_activity_spread_over_months_is_not_a_cluster(db):
    for index in range(5):
        add(
            db,
            VENUE_CONGRESS,
            external_id=f"spread-{index}",
            subject_key="SPREAD",
            direction=1,
            transacted_at=TODAY - timedelta(days=40 + index * 20),
            actor_external_key=f"spread-actor-{index}",
        )
    scoring.recompute_all(db, reference=TODAY)
    assert signal_of(db, SIGNAL_CLUSTER, "SPREAD") is None


# ------------------------------------------------------- late disclosure


def test_late_congressional_disclosure_is_flagged(db):
    traded = TODAY - timedelta(days=300)
    add(
        db,
        VENUE_CONGRESS,
        external_id="late-1",
        subject_key="LATE",
        direction=1,
        transacted_at=traded,
        disclosed_at=traded + timedelta(days=210),
    )
    scoring.recompute_all(db, lookback_days=400, reference=TODAY)

    signal = signal_of(db, SIGNAL_LATE_DISCLOSURE, "LATE")
    assert signal is not None
    assert "210 days late" in signal.headline


def test_on_time_disclosure_is_not_flagged(db):
    traded = TODAY - timedelta(days=60)
    add(
        db,
        VENUE_CONGRESS,
        external_id="ontime-1",
        subject_key="ONTIME",
        direction=1,
        transacted_at=traded,
        disclosed_at=traded + timedelta(days=20),
    )
    scoring.recompute_all(db, reference=TODAY)
    assert signal_of(db, SIGNAL_LATE_DISCLOSURE, "ONTIME") is None


# ----------------------------------------------------------------- misc


def test_every_signal_explains_itself(db):
    """A number a reader cannot interrogate is one they should not act on."""
    buyers(db, VENUE_CONGRESS, "EXPL", 3, prefix="eb")
    sellers(db, VENUE_INSIDER, "EXPL", 3, prefix="es")
    scoring.recompute_all(db, reference=TODAY)

    rows = db.query(Signal).all()
    assert rows
    for signal in rows:
        assert signal.headline.strip()
        assert signal.detail and len(signal.detail) > 20
        assert 0.0 <= signal.strength <= 1.0


def test_recompute_replaces_signals_rather_than_appending(db):
    buyers(db, VENUE_CONGRESS, "REP", 4, prefix="rb")
    scoring.recompute_all(db, reference=TODAY)
    first = db.query(Signal).count()

    scoring.recompute_all(db, reference=TODAY)
    assert db.query(Signal).count() == first
