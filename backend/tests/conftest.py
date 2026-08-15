"""Test fixtures.

The engine binds to ``FINANCERT_DATABASE_URL`` at import time, so the variable
must be set *before* any ``app`` module is imported. That is why this file
touches os.environ at module scope, above the app imports, and why those
imports deliberately sit below it rather than at the top of the file.
"""

import os
import tempfile
from pathlib import Path

import pytest

_TMP_DB = Path(tempfile.mkdtemp(prefix="financert-tests-")) / "test.db"
os.environ["FINANCERT_DATABASE_URL"] = f"sqlite:///{_TMP_DB}"

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.sources.base import SourcePosition  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def fresh_schema():
    """Every test gets an empty database. Cheap for SQLite, and it removes any
    ordering dependency between tests."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def ptr_text() -> str:
    """Real extracted text from House filing 20034201 (Rep. Mark Alford)."""
    return (FIXTURES / "ptr_20034201.txt").read_text()


@pytest.fixture
def form4_submission() -> str:
    """Real SEC full-submission text for an Abbott Laboratories Form 4."""
    return (FIXTURES / "form4_abbott.txt").read_text()


def make_position(**overrides) -> SourcePosition:
    """A minimal valid position, so tests only state what they care about."""
    defaults = dict(
        actor_type="politician",
        actor_external_key="TEST|XX01",
        actor_name="Test Person",
        actor_title="XX01",
        venue="congress",
        external_id="test-1",
        subject_kind="equity",
        subject_key="TEST",
        subject_label="Test Corp",
        direction=1,
        usd_low=1000.0,
        usd_high=15000.0,
        usd_estimate=3873.0,
        signal_weight=1.0,
    )
    defaults.update(overrides)
    return SourcePosition(**defaults)
