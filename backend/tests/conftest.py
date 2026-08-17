"""Test fixtures.

``FINANCERT_DATABASE_URL`` is pointed at a throwaway file *before* any ``app``
module is imported, because the engine binds to the URL at import time. Tests
never touch the real financert.db.
"""

import os
import tempfile
from pathlib import Path

_tmpdir = tempfile.mkdtemp(prefix="financert-tests-")
os.environ["FINANCERT_DATABASE_URL"] = f"sqlite:///{Path(_tmpdir) / 'test.db'}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_schema():
    """Rebuild the schema before every test so cases cannot leak into each other."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(create_app()) as c:
        yield c
