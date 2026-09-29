"""Auth and multi-portfolio behaviour.

Config is read from the environment at import time, so these tests patch the
`config` module's attributes. Both the dependency and /healthz read through
that module at call time, so one patch covers both.
"""

import json
import logging
import secrets

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import create_app
from app.middleware import STARTUP_LOGGER

SAMPLE = {"name": "T", "holdings": [{"asset_class": "deposits", "value": 100}]}

PROTECTED = [
    ("get", "/api/portfolio"),
    ("get", "/api/portfolios"),
    ("put", "/api/portfolio"),
    ("delete", "/api/portfolio"),
    ("get", "/api/analysis"),
    ("post", "/api/analysis/preview"),
]


@pytest.fixture
def secured_client(monkeypatch):
    monkeypatch.setattr(config, "AUTH_ENABLED", True)
    monkeypatch.setattr(config, "API_TOKEN", "s3cret")
    with TestClient(create_app()) as c:
        yield c


def test_auth_disabled_by_default(client):
    """Local development needs no setup."""
    assert client.put("/api/portfolio", json=SAMPLE).status_code == 200
    assert client.get("/api/portfolio").status_code == 200


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_protected_endpoints_reject_anonymous(secured_client, method, path):
    resp = getattr(secured_client, method)(path, **({"json": SAMPLE} if method in {"put", "post"} else {}))
    assert resp.status_code == 401
    assert resp.headers.get("WWW-Authenticate") == "Bearer"


def test_wrong_token_rejected(secured_client):
    resp = secured_client.get("/api/portfolio", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401


def test_malformed_authorization_header_rejected(secured_client):
    for value in ("s3cret", "Basic s3cret", "Bearer", ""):
        resp = secured_client.get("/api/portfolio", headers={"Authorization": value})
        assert resp.status_code == 401, value


def test_correct_token_accepted(secured_client):
    headers = {"Authorization": "Bearer s3cret"}
    assert secured_client.put("/api/portfolio", json=SAMPLE, headers=headers).status_code == 200
    assert secured_client.get("/api/portfolio", headers=headers).status_code == 200


def test_benchmarks_stay_public(secured_client):
    """Reference data is public Federal Reserve output; gating it would only
    make the dashboard harder to host, not safer."""
    assert secured_client.get("/api/benchmarks").status_code == 200
    assert secured_client.get("/healthz").status_code == 200


# Split rather than combined: the secured_client fixture patches config for
# the whole test, so a test taking both would see auth enabled on both.
def test_healthz_reports_auth_off(client):
    assert client.get("/healthz").json()["auth_enabled"] is False


def test_healthz_reports_auth_on(secured_client):
    assert secured_client.get("/healthz").json()["auth_enabled"] is True


# --- production start-up guard ----------------------------------------------


@pytest.fixture
def production(monkeypatch):
    """Production mode with no token and no opt-out: the case the guard exists for."""
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "AUTH_ENABLED", False)
    monkeypatch.setattr(config, "API_TOKEN", "")
    monkeypatch.setattr(config, "ALLOW_OPEN_PORTFOLIO", False)


def test_production_without_a_token_refuses_to_start(production):
    with pytest.raises(config.InsecureConfigurationError, match="FINANCERT_API_TOKEN"):
        with TestClient(create_app()):
            pass


def test_production_with_a_token_starts(production, monkeypatch):
    monkeypatch.setattr(config, "AUTH_ENABLED", True)
    monkeypatch.setattr(config, "API_TOKEN", secrets.token_hex(16))
    with TestClient(create_app()) as c:
        assert c.get("/healthz").json()["auth_enabled"] is True


def test_production_open_mode_needs_the_explicit_opt_out(production, monkeypatch):
    monkeypatch.setattr(config, "ALLOW_OPEN_PORTFOLIO", True)
    with TestClient(create_app()) as c:
        assert c.get("/healthz").json()["auth_enabled"] is False


def test_the_opt_out_is_read_from_the_environment(monkeypatch):
    """The two flags are parsed at import, so check the parsing on its own."""
    import importlib

    monkeypatch.setenv("FINANCERT_ENV", "Production")
    monkeypatch.delenv("FINANCERT_API_TOKEN", raising=False)
    monkeypatch.setenv("FINANCERT_ALLOW_OPEN_PORTFOLIO", "true")
    try:
        reloaded = importlib.reload(config)
        assert reloaded.IS_PRODUCTION is True
        assert reloaded.ALLOW_OPEN_PORTFOLIO is True
        reloaded.check_auth_configuration()  # does not raise
    finally:
        monkeypatch.undo()
        importlib.reload(config)


def test_development_without_a_token_starts_and_warns(monkeypatch, caplog):
    monkeypatch.setattr(config, "IS_PRODUCTION", False)
    monkeypatch.setattr(config, "AUTH_ENABLED", False)
    caplog.set_level(logging.WARNING, logger=STARTUP_LOGGER.name)
    STARTUP_LOGGER.propagate = True  # configure_logging() detaches it, and caplog sits on the root
    try:
        with TestClient(create_app()) as c:
            assert c.put("/api/portfolio", json=SAMPLE).status_code == 200
    finally:
        STARTUP_LOGGER.propagate = False
    events = [json.loads(r.message) for r in caplog.records if r.name == STARTUP_LOGGER.name]
    assert [e["event"] for e in events] == ["auth_disabled"]


# --- multi-portfolio -------------------------------------------------------


def test_portfolios_are_isolated_by_slug(client):
    client.put("/api/portfolio", params={"slug": "mine"}, json=SAMPLE)
    client.put(
        "/api/portfolio",
        params={"slug": "spouse"},
        json={"name": "S", "holdings": [{"asset_class": "real_estate", "value": 500}]},
    )

    mine = client.get("/api/portfolio", params={"slug": "mine"}).json()
    spouse = client.get("/api/portfolio", params={"slug": "spouse"}).json()
    assert mine["total_value"] == pytest.approx(100)
    assert spouse["total_value"] == pytest.approx(500)


def test_list_portfolios(client):
    assert client.get("/api/portfolios").json() == []
    client.put("/api/portfolio", params={"slug": "mine"}, json=SAMPLE)
    client.put("/api/portfolio", params={"slug": "spouse"}, json=SAMPLE)

    rows = client.get("/api/portfolios").json()
    assert {r["slug"] for r in rows} == {"mine", "spouse"}
    assert all(r["holdings_count"] == 1 for r in rows)


def test_deleting_one_slug_leaves_the_others(client):
    client.put("/api/portfolio", params={"slug": "mine"}, json=SAMPLE)
    client.put("/api/portfolio", params={"slug": "spouse"}, json=SAMPLE)
    client.delete("/api/portfolio", params={"slug": "mine"})

    assert client.get("/api/portfolio", params={"slug": "mine"}).status_code == 404
    assert client.get("/api/portfolio", params={"slug": "spouse"}).status_code == 200


@pytest.mark.parametrize("slug", ["Has Caps", "with space", "../etc", "a" * 64, "", "under_score"])
def test_invalid_slugs_rejected(client, slug):
    assert client.get("/api/portfolio", params={"slug": slug}).status_code == 422
