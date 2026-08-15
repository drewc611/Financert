"""Scoring and power model.

These are the numbers a reader has to trust, so the tests assert on
*relationships* ("a CEO outweighs a VP", "recent outweighs stale") rather than
on magic constants. That way retuning a weight in ``constants.py`` does not
break the suite unless it breaks an actual product claim.
"""

from datetime import date, timedelta

import pytest

from app.constants import CONVICTION_HALFLIFE_DAYS, VENUE_CONGRESS, VENUE_INSIDER
from app.services import power, scoring

TODAY = date(2026, 8, 15)


# ------------------------------------------------------------------- power


def test_seniority_orders_insider_power():
    ceo = power.insider_power("CHIEF EXECUTIVE OFFICER")
    cfo = power.insider_power("CHIEF FINANCIAL OFFICER")
    vp = power.insider_power("VICE PRESIDENT")
    assert ceo > cfo > vp


def test_longest_title_match_wins():
    """'CHIEF EXECUTIVE OFFICER' must not be scored as a bare 'CHIEF'."""
    assert power.insider_power("CHIEF EXECUTIVE OFFICER") > power.insider_power("CHIEF ACCOUNTING OFFICER")


def test_ten_percent_owner_gets_a_floor():
    assert power.insider_power("", {"is_ten_percent_owner": True}) > power.insider_power("")


def test_leadership_outranks_rank_and_file_members():
    speaker = power.politician_power("Michael Johnson", {"last_name": "JOHNSON"})
    backbencher = power.politician_power("Jane Nobody", {"last_name": "NOBODY"})
    assert speaker > backbencher


def test_whale_power_is_log_scaled_and_bounded():
    small = power.whale_power(2_000)
    medium = power.whale_power(50_000)
    large = power.whale_power(500_000)
    huge = power.whale_power(50_000_000)

    assert small < medium < large
    assert huge <= 1.0
    # Log scale: the 25x step from 2k to 50k moves the score more than the
    # 100x step from 500k to 50M, which is past saturation.
    assert (medium - small) > (huge - large)


def test_power_scores_stay_in_unit_range():
    for score in [
        power.insider_power("CHIEF EXECUTIVE OFFICER"),
        power.politician_power("X", {"last_name": "PELOSI"}),
        power.whale_power(10**9),
        power.whale_power(0),
        power.score("unknown-type", "X", None),
    ]:
        assert 0.0 <= score <= 1.0


# ------------------------------------------------------------------ factors


def test_size_factor_rises_with_dollars_but_never_hits_zero():
    assert scoring.size_factor(0) > 0, "an undisclosed amount must not erase the row"
    assert scoring.size_factor(1_000) < scoring.size_factor(100_000) < scoring.size_factor(10_000_000)
    assert scoring.size_factor(10**12) <= 1.0


def test_recency_halves_at_the_half_life():
    fresh = scoring.recency_factor(TODAY, reference=TODAY)
    stale = scoring.recency_factor(TODAY - timedelta(days=int(CONVICTION_HALFLIFE_DAYS)), reference=TODAY)
    assert fresh == pytest.approx(1.0)
    assert stale == pytest.approx(0.5, abs=0.01)


def test_position_weight_responds_to_every_factor():
    base = dict(power_score=0.8, signal_weight=1.0, venue=VENUE_INSIDER, usd=1_000_000.0, when=TODAY, reference=TODAY)
    baseline = scoring.position_weight(**base)

    assert scoring.position_weight(**{**base, "power_score": 0.4}) < baseline
    assert scoring.position_weight(**{**base, "signal_weight": 0.05}) < baseline
    assert scoring.position_weight(**{**base, "usd": 5_000.0}) < baseline
    assert scoring.position_weight(**{**base, "when": TODAY - timedelta(days=180)}) < baseline


def test_grants_barely_count_next_to_open_market_purchases():
    """The core interpretive claim of the insider model."""
    common = dict(power_score=1.0, venue=VENUE_INSIDER, usd=1_000_000.0, when=TODAY, reference=TODAY)
    purchase = scoring.position_weight(signal_weight=1.00, **common)  # code P
    grant = scoring.position_weight(signal_weight=0.05, **common)  # code A
    assert grant < purchase / 10


# -------------------------------------------------------------- aggregation


def _add(db, **kwargs):
    from app.services import ingest
    from tests.conftest import make_position

    ingest.ingest_positions(db, kwargs.get("venue", VENUE_CONGRESS), [make_position(**kwargs)])


def test_opposing_positions_cancel_in_conviction(db):
    _add(db, external_id="a", subject_key="ZZZ", direction=1, transacted_at=TODAY)
    _add(db, external_id="b", subject_key="ZZZ", direction=-1, transacted_at=TODAY, actor_external_key="OTHER|XX02")

    item = scoring.aggregate(db, reference=TODAY)["ZZZ"]
    assert item.gross_activity > 0
    assert abs(item.conviction) < item.gross_activity
    assert abs(item.consensus) < 0.5


def test_one_sided_activity_reaches_full_consensus(db):
    for index in range(3):
        _add(
            db,
            external_id=f"buy-{index}",
            subject_key="YYY",
            direction=1,
            transacted_at=TODAY,
            actor_external_key=f"P{index}|XX0{index}",
        )
    item = scoring.aggregate(db, reference=TODAY)["YYY"]
    assert item.consensus == pytest.approx(1.0)
    assert len(item.actors) == 3


def test_aggregate_tracks_venues_separately(db):
    _add(db, external_id="c1", subject_key="WWW", direction=1, venue=VENUE_CONGRESS, transacted_at=TODAY)
    _add(
        db,
        external_id="i1",
        subject_key="WWW",
        direction=-1,
        venue=VENUE_INSIDER,
        transacted_at=TODAY,
        actor_type="insider",
        actor_external_key="CIK1",
    )
    item = scoring.aggregate(db, reference=TODAY)["WWW"]
    assert item.venue_direction[VENUE_CONGRESS] > 0
    assert item.venue_direction[VENUE_INSIDER] < 0


def test_lookback_window_excludes_old_activity(db):
    _add(db, external_id="old", subject_key="OLD", direction=1, transacted_at=TODAY - timedelta(days=400))
    assert "OLD" not in scoring.aggregate(db, lookback_days=30, reference=TODAY)
    assert "OLD" in scoring.aggregate(db, lookback_days=500, reference=TODAY)


def test_recompute_materializes_scores(db):
    from app.models import SubjectScore

    _add(db, external_id="m1", subject_key="MAT", direction=1, transacted_at=TODAY)
    count = scoring.recompute_all(db, reference=TODAY)
    assert count == 1

    row = db.query(SubjectScore).filter_by(subject_key="MAT").one()
    assert row.conviction > 0
    assert row.actor_count == 1


def test_recompute_is_idempotent(db):
    """Rebuilt wholesale, so running it twice must not duplicate rows."""
    from app.models import SubjectScore

    _add(db, external_id="i1", subject_key="IDEM", direction=1, transacted_at=TODAY)
    scoring.recompute_all(db, reference=TODAY)
    first = db.query(SubjectScore).filter_by(subject_key="IDEM").one().conviction

    scoring.recompute_all(db, reference=TODAY)
    rows = db.query(SubjectScore).filter_by(subject_key="IDEM").all()
    assert len(rows) == 1
    assert rows[0].conviction == pytest.approx(first)
