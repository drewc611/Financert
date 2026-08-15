"""API contract and ingestion behaviour."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.constants import ALL_VENUES, VENUE_CONGRESS, VENUE_INSIDER
from app.main import create_app
from app.models import Actor, Position
from app.services import ingest, scoring
from tests.conftest import make_position

TODAY = date(2026, 8, 15)


@pytest.fixture
def client():
    return TestClient(create_app())


@pytest.fixture
def loaded(db):
    """A small world with one cross-venue disagreement in it."""
    items = []
    for index in range(3):
        items.append(
            make_position(
                external_id=f"c{index}",
                subject_key="ACME",
                subject_label="Acme Corp",
                direction=1,
                transacted_at=TODAY - timedelta(days=index),
                actor_external_key=f"pol-{index}",
                actor_name=f"Rep {index}",
            )
        )
    ingest.ingest_positions(db, VENUE_CONGRESS, items)

    insider_items = [
        make_position(
            external_id=f"i{index}",
            venue=VENUE_INSIDER,
            actor_type="insider",
            actor_external_key=f"cik-{index}",
            actor_name=f"Officer {index}",
            actor_title="CHIEF EXECUTIVE OFFICER",
            subject_key="ACME",
            subject_label="Acme Corp",
            direction=-1,
            usd_estimate=900_000.0,
            transacted_at=TODAY - timedelta(days=index),
        )
        for index in range(3)
    ]
    ingest.ingest_positions(db, VENUE_INSIDER, insider_items)
    scoring.recompute_all(db, reference=TODAY)
    return db


# ------------------------------------------------------------------ health


def test_healthz_reports_state(client):
    body = client.get("/healthz").json()
    assert body["ok"] is True
    assert "positions" in body and "scored_subjects" in body


# ---------------------------------------------------------------- overview


def test_overview_is_one_call(client, loaded):
    body = client.get("/api/overview").json()
    assert body["total_positions"] == 6
    assert body["total_actors"] == 6
    assert body["top_signals"], "the seeded disagreement should raise a signal"
    assert body["recent_positions"]


def test_overview_lists_every_venue_even_when_empty(client, loaded):
    """A source that is down must read as an explicit zero, not vanish."""
    venues = {row["venue"]: row for row in client.get("/api/overview").json()["venues"]}
    assert set(venues) == set(ALL_VENUES)
    assert venues["polymarket"]["position_count"] == 0


def test_overview_exposes_both_sides_of_the_split(client, loaded):
    """Regression: the dashboard's buy/sell bar needs long_weight and
    short_weight, which cannot be reconstructed from conviction alone."""
    subject = client.get("/api/overview").json()["most_conviction"][0]
    assert "long_weight" in subject and "short_weight" in subject
    assert subject["long_weight"] > 0 and subject["short_weight"] > 0


def test_overview_rejects_absurd_lookback(client):
    assert client.get("/api/overview?lookback_days=99999").status_code == 422


# --------------------------------------------------------------- endpoints


def test_positions_filter_by_venue(client, loaded):
    rows = client.get("/api/positions?venue=congress").json()
    assert rows and all(row["venue"] == "congress" for row in rows)


def test_positions_reject_unknown_venue(client, loaded):
    response = client.get("/api/positions?venue=nonsense")
    assert response.status_code == 422
    assert "unknown venue" in response.json()["detail"]


def test_subject_detail_returns_the_evidence(client, loaded):
    body = client.get("/api/subjects/ACME").json()
    assert body["score"]["subject_key"] == "ACME"
    assert len(body["positions"]) == 6
    assert body["signals"]


def test_unknown_subject_is_404(client, loaded):
    assert client.get("/api/subjects/NOPE").status_code == 404


def test_people_endpoint_ranks_by_power(client, loaded):
    people = client.get("/api/people").json()
    assert people
    scores = [person["power_score"] for person in people]
    assert scores == sorted(scores, reverse=True)


def test_people_filter_by_type(client, loaded):
    insiders = client.get("/api/people?actor_type=insider").json()
    assert insiders and all(person["actor_type"] == "insider" for person in insiders)


def test_contested_endpoint_returns_two_sided_subjects(client, loaded):
    rows = client.get("/api/contested").json()
    assert rows
    assert all(row["long_weight"] > 0 and row["short_weight"] > 0 for row in rows)


def test_recompute_endpoint(client, loaded):
    body = client.post("/admin/recompute").json()
    assert body["subjects_scored"] >= 1


def test_refresh_rejects_unknown_venue(client):
    response = client.post("/admin/refresh", json={"venues": ["twitter"]})
    assert response.status_code == 422


# --------------------------------------------------------------- ingestion


def test_ingest_is_idempotent(db):
    """Filings get amended and republished; re-ingesting must not double-count."""
    items = [make_position(external_id="dup-1")]

    first = ingest.ingest_positions(db, VENUE_CONGRESS, items)
    second = ingest.ingest_positions(db, VENUE_CONGRESS, items)

    assert first.added == 1
    assert second.added == 0 and second.skipped == 1
    assert db.query(Position).count() == 1


def test_duplicates_within_one_batch_are_collapsed(db):
    """One upstream payload can repeat a key; the unique constraint would
    otherwise abort the whole batch."""
    items = [make_position(external_id="same"), make_position(external_id="same")]
    result = ingest.ingest_positions(db, VENUE_CONGRESS, items)
    assert result.added == 1
    assert db.query(Position).count() == 1


def test_same_actor_is_reused_across_positions(db):
    items = [
        make_position(external_id="a1", actor_external_key="SAME|XX01"),
        make_position(external_id="a2", actor_external_key="SAME|XX01"),
    ]
    ingest.ingest_positions(db, VENUE_CONGRESS, items)
    assert db.query(Actor).count() == 1


def test_actor_power_never_downgrades(db):
    """A whale's power is peak capital deployed, so a later small position
    must not erase what we already know about them."""
    ingest.ingest_positions(
        db,
        "polymarket",
        [
            make_position(
                external_id="w1",
                venue="polymarket",
                actor_type="whale",
                actor_external_key="0xabc",
                actor_name="whale",
                actor_attrs={"position_usd": 400_000},
            )
        ],
    )
    high = db.query(Actor).filter_by(external_key="0xabc").one().power_score

    ingest.ingest_positions(
        db,
        "polymarket",
        [
            make_position(
                external_id="w2",
                venue="polymarket",
                actor_type="whale",
                actor_external_key="0xabc",
                actor_name="whale",
                actor_attrs={"position_usd": 1_500},
            )
        ],
    )
    assert db.query(Actor).filter_by(external_key="0xabc").one().power_score == high


def test_disclosure_lag_is_computed_on_write(db):
    traded = TODAY - timedelta(days=90)
    ingest.ingest_positions(
        db,
        VENUE_CONGRESS,
        [make_position(external_id="lag", transacted_at=traded, disclosed_at=traded + timedelta(days=61))],
    )
    assert db.query(Position).one().disclosure_lag_days == 61


def test_ingest_records_a_run(db):
    from app.models import IngestRun

    ingest.ingest_positions(db, VENUE_CONGRESS, [make_position(external_id="r1")], warnings=["heads up"])
    run = db.query(IngestRun).one()
    assert run.ok is True
    assert run.positions_added == 1
    assert "heads up" in run.message
