"""Regression tests for issues found in the security audit.

Each of these was a real finding, not a hypothetical. They live together so
the reasoning stays with the guard rather than scattered across suites.
"""

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

import fetch_dfa
from app import config
from app.main import create_app

# --- the remote archive ----------------------------------------------------


def _zip_with(member: str, payload: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(member, payload)
    return buf.getvalue()


def test_decompression_bomb_is_refused():
    """A 161 KB zip expanding to gigabytes used to be parsed happily, taking
    peak memory past 1.3 GB. Now the row cap stops it."""
    payload = b"Date,Category,Assets\n" + b"2026:Q1,TopPt1,1\n" * (fetch_dfa.MAX_ROWS + 1_000)
    blob = _zip_with(fetch_dfa.DFA_MEMBER, payload)

    # Compresses far beyond any honest ratio for this file.
    assert len(payload) / len(blob) > 50

    with pytest.raises(fetch_dfa.FetchError, match="rows"):
        fetch_dfa.read_member(blob)


def test_oversized_member_is_refused_before_decompressing(monkeypatch):
    monkeypatch.setattr(fetch_dfa, "MAX_MEMBER_BYTES", 1024)
    blob = _zip_with(fetch_dfa.DFA_MEMBER, b"x" * 20_000)
    with pytest.raises(fetch_dfa.FetchError, match="uncompressed"):
        fetch_dfa.read_member(blob)


def test_row_cap_catches_a_lying_header(monkeypatch):
    """The declared size is only a claim; the rows actually read are capped
    too, so a crafted central directory does not get a free pass."""
    monkeypatch.setattr(fetch_dfa, "MAX_ROWS", 10)
    payload = b"Date,Category,Assets\n" + b"2026:Q1,TopPt1,1\n" * 50
    with pytest.raises(fetch_dfa.FetchError, match="rows"):
        fetch_dfa.read_member(_zip_with(fetch_dfa.DFA_MEMBER, payload))


def test_unexpected_member_name_is_refused():
    """Members are opened by exact name and never extracted to disk, so a
    crafted name cannot traverse out of the archive -- but an archive missing
    the file we want should still fail loudly rather than silently."""
    blob = _zip_with("../../etc/passwd", b"nope")
    with pytest.raises(fetch_dfa.FetchError, match="missing from the DFA zip"):
        fetch_dfa.read_member(blob)


def test_non_zip_body_is_refused():
    with pytest.raises(fetch_dfa.FetchError, match="not a zip"):
        fetch_dfa.read_member(b"<html>404</html>")


# --- the auth path ---------------------------------------------------------


@pytest.fixture
def secured_client(monkeypatch):
    monkeypatch.setattr(config, "AUTH_ENABLED", True)
    monkeypatch.setattr(config, "API_TOKEN", "s3cret")
    with TestClient(create_app()) as client:
        yield client


@pytest.mark.parametrize("credential", ["a" * 4096, "", "  ", "Bearer", "\\x00"])
def test_hostile_credentials_are_401(secured_client, credential):
    resp = secured_client.get("/api/portfolio", headers={"Authorization": f"Bearer {credential}"})
    assert resp.status_code == 401


@pytest.mark.parametrize("credential", ["tokén", "\xe9\xff", "ÿÿÿ"])
def test_non_ascii_credential_is_401_not_a_crash(monkeypatch, credential):
    """HTTP header values are latin-1 on the wire, so a raw client can send
    high bytes and Starlette hands the dependency a non-ASCII str.
    `secrets.compare_digest` raises TypeError on those, which turned a bad
    token into a 500. Tested against the dependency directly because a
    well-behaved HTTP client refuses to encode the header at all."""
    from fastapi import HTTPException

    from app.dependencies import require_token

    monkeypatch.setattr(config, "AUTH_ENABLED", True)
    monkeypatch.setattr(config, "API_TOKEN", "s3cret")

    with pytest.raises(HTTPException) as excinfo:
        require_token(authorization=f"Bearer {credential}")
    assert excinfo.value.status_code == 401


def test_correct_token_still_works(secured_client):
    resp = secured_client.put(
        "/api/portfolio",
        json={"name": "T", "holdings": [{"asset_class": "deposits", "value": 1}]},
        headers={"Authorization": "Bearer s3cret"},
    )
    assert resp.status_code == 200


# --- input validation ------------------------------------------------------


@pytest.mark.parametrize(
    "slug",
    ["../etc/passwd", "a/../../b", "a%2f..%2fb", "'; DROP TABLE portfolios; --", "a" * 200],
)
def test_hostile_slugs_are_rejected(client, slug):
    """Slugs reach a database query. They are pattern-validated rather than
    escaped, so anything outside [a-z0-9-] never gets that far."""
    assert client.get("/api/portfolio", params={"slug": slug}).status_code in (404, 422)


def test_holdings_reject_unknown_asset_classes(client):
    """Asset classes are whitelisted against the taxonomy, so a holding cannot
    introduce a key the benchmark side has never heard of."""
    resp = client.put(
        "/api/portfolio",
        json={"name": "x", "holdings": [{"asset_class": "__proto__", "value": 1}]},
    )
    assert resp.status_code == 422
