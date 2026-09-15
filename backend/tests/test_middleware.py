"""Request logging (BACKLOG F65) and response caching (F66)."""

import json
import logging

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import create_app
from app.middleware import LOGGER, _etag
from app.services.benchmarks import SnapshotError

SAMPLE = {"name": "Cached", "holdings": [{"asset_class": "deposits", "value": 1000}]}


def _unreadable():
    raise SnapshotError("no snapshot")


@pytest.fixture
def lines(caplog):
    """The JSON objects the request logger emitted, parsed."""
    caplog.set_level(logging.INFO, logger=LOGGER.name)
    # configure_logging() detaches the logger from the root handler, which is
    # also where caplog attaches; put it back for the duration of the test.
    LOGGER.propagate = True
    yield lambda: [json.loads(r.message) for r in caplog.records if r.name == LOGGER.name]
    LOGGER.propagate = False


def test_one_json_line_per_request(client, lines):
    client.get("/healthz")
    (line,) = lines()
    assert line["event"] == "request"
    assert line["method"] == "GET"
    assert line["route"] == "/healthz"
    assert line["status"] == 200
    assert line["duration_ms"] >= 0
    assert line["ts"].endswith("Z")


def test_the_log_records_the_route_not_the_query(client, lines):
    """A slug is the user's own word for their own portfolio and a query string
    is the one part of a GET that carries it (PRIVACY.md)."""
    client.get("/api/analysis?slug=my-spouses-ira&group=top1")
    (line,) = lines()
    assert line["route"] == "/api/analysis"
    assert "my-spouses-ira" not in json.dumps(line)


def test_a_request_id_is_returned_and_a_supplied_one_is_kept(client, lines):
    generated = client.get("/healthz").headers["X-Request-ID"]
    assert len(generated) == 16

    supplied = client.get("/healthz", headers={"X-Request-ID": "trace-0001"})
    assert supplied.headers["X-Request-ID"] == "trace-0001"
    assert [line["request_id"] for line in lines()] == [generated, "trace-0001"]


def test_a_malformed_request_id_is_replaced(client):
    """Whatever arrives is echoed into a header and a log line, so it has to be
    a trace id and not a newline with ideas."""
    response = client.get("/healthz", headers={"X-Request-ID": "no spaces or\nnewlines"})
    assert response.headers["X-Request-ID"] != "no spaces or\nnewlines"


def test_benchmarks_are_revalidated_not_refetched(client):
    first = client.get("/api/benchmarks")
    etag = first.headers["ETag"]
    assert first.headers["Cache-Control"] == "public, max-age=60, must-revalidate"

    again = client.get("/api/benchmarks", headers={"If-None-Match": etag})
    assert again.status_code == 304
    assert again.content == b""
    assert again.headers["ETag"] == etag


def test_the_etag_covers_the_query(client):
    """Same path, different answer: investable_only renormalises every weight,
    and must not be served out of the cache of the other one."""
    plain = client.get("/api/benchmarks").headers["ETag"]
    everything = client.get("/api/benchmarks?investable_only=false").headers["ETag"]
    assert plain != everything
    assert client.get("/api/benchmarks?investable_only=false", headers={"If-None-Match": plain}).status_code == 200


def test_a_weakened_etag_still_matches(client):
    """An intermediary may weaken a validator on the way back; a weak
    comparison is what a conditional GET asks for anyway."""
    etag = client.get("/api/benchmarks").headers["ETag"]
    assert client.get("/api/benchmarks", headers={"If-None-Match": f"W/{etag}"}).status_code == 304


def test_a_failed_request_is_still_logged(lines):
    """The 500 is the line most worth having, and the handler that produced it
    is in no position to write it."""
    app = create_app()
    LOGGER.propagate = True  # create_app() detaches the logger again

    @app.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    with TestClient(app, raise_server_exceptions=False) as failing:
        assert failing.get("/boom").status_code == 500
    (line,) = [entry for entry in lines() if entry["route"] == "/boom"]
    assert line["status"] == 500
    assert line["level"] == "error"


def test_no_checksum_means_no_etag(client, monkeypatch):
    """The validator is a promise that the body cannot have changed. Without a
    checksum to base it on there is no promise to make, and serving the data
    uncached beats serving a validator that means nothing."""
    monkeypatch.setattr("app.middleware.benchmarks.source_meta", dict)
    response = client.get("/api/benchmarks")
    assert response.status_code == 200
    assert "ETag" not in response.headers
    assert response.headers["Cache-Control"] == "no-store"


def test_an_unreadable_snapshot_disables_the_validator(monkeypatch):
    """Exercised directly: a snapshot the service cannot read takes the whole
    endpoint down with it, so there is no response here to inspect."""
    monkeypatch.setattr("app.middleware.benchmarks.source_meta", _unreadable)
    request = Request({"type": "http", "method": "GET", "path": "/api/benchmarks", "query_string": b"", "headers": []})
    assert _etag(request) is None


def test_portfolios_are_never_cached(client):
    """Per-install state behind a shared token. Nothing between the API and the
    browser should be keeping a copy of it."""
    client.put("/api/portfolio", json=SAMPLE)
    for path in ("/api/portfolio", "/api/portfolios", "/api/analysis", "/healthz"):
        response = client.get(path)
        assert response.headers["Cache-Control"] == "no-store", path
        assert "ETag" not in response.headers, path
