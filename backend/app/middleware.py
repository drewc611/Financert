"""Request logging and HTTP caching -- the two things that wrap every response.

Both sit at the ASGI layer rather than in a router because neither belongs to
any one endpoint: one line per request whatever it was, and one validator over
the reference data whichever part of it was asked for.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sys
import time
from urllib.parse import urlencode
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from .services import benchmarks
from .time_utils import utcnow

LOGGER = logging.getLogger("financert.request")

# A caller-supplied id is echoed back and written to the log, so it is bounded
# and restricted to characters a trace id actually uses. A malformed one is
# replaced rather than rejected -- a bad trace header is not a bad request.
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

# Unmatched paths are logged raw (that is the whole content of a 404 line) and
# a path is caller-controlled text of any length.
MAX_LOGGED_PATH = 200


def configure_logging() -> None:
    """One JSON object per line, on stdout.

    Configured here rather than left to uvicorn's default formatter because the
    point of these lines is to be machine-read: a deployment ships them to
    whatever it ships logs to, and a human-formatted record does not survive
    that trip intact. Idempotent -- create_app() runs once per test client.
    """
    level = logging.getLevelNamesMapping().get(os.getenv("FINANCERT_LOG_LEVEL", "INFO").upper(), logging.INFO)
    LOGGER.setLevel(level)
    if not LOGGER.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        LOGGER.addHandler(handler)
    # Otherwise the root handler prints the same line again, unformatted.
    LOGGER.propagate = False


class RequestLog(BaseHTTPMiddleware):
    """One JSON line per request.

    Deliberately narrow: method, route, status, duration and a request id. No
    query string, no body, no client address -- the query carries portfolio
    slugs and the body carries holdings, and neither belongs in a file that
    outlives the request (PRIVACY.md says so, so it has to stay true).
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id", "")
        if not REQUEST_ID_RE.match(request_id):
            request_id = uuid4().hex[:16]
        request.state.request_id = request_id

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # The traceback is uvicorn's to print; this line exists so an
            # unhandled 500 is not the one request with no record of itself.
            _emit(request, request_id, 500, started)
            raise
        _emit(request, request_id, response.status_code, started)
        response.headers["X-Request-ID"] = request_id
        return response


def _emit(request: Request, request_id: str, status: int, started: float) -> None:
    # The matched route template, not the URL: "/api/portfolio", never the slug
    # that was asked for. Absent on a 404 that matched nothing, where the path
    # is the only informative part of the line.
    route = request.scope.get("route")
    line = {
        "ts": f"{utcnow().isoformat(timespec='milliseconds')}Z",
        "level": "error" if status >= 500 else "info",
        "event": "request",
        "request_id": request_id,
        "method": request.method,
        "route": getattr(route, "path", request.url.path[:MAX_LOGGED_PATH]),
        "status": status,
        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
    }
    LOGGER.log(logging.ERROR if status >= 500 else logging.INFO, json.dumps(line, separators=(",", ":")))


class CacheHeaders(BaseHTTPMiddleware):
    """A validator for the reference endpoints, ``no-store`` for the rest.

    ``/api/benchmarks*`` is a pure function of the committed snapshot and the
    query string, so the archive checksum plus the URL is a complete cache key:
    if both match, the body cannot have changed. A matching ``If-None-Match`` is
    answered here, before the handler runs -- the benchmarks response is a few
    hundred kB assembled out of six quarterly histories, and this skips
    building it rather than building it and throwing it away.

    ``max-age`` is deliberately short. The data itself moves quarterly, but a
    deploy can replace it at any moment and a client holding a stale allocation
    has no way to notice; revalidating costs an empty 304.
    """

    CACHE_CONTROL = "public, max-age=60, must-revalidate"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        etag = _etag(request) if request.method in ("GET", "HEAD") and _is_reference(request) else None
        if etag and _matches(request.headers.get("if-none-match", ""), etag):
            return Response(status_code=304, headers={"ETag": etag, "Cache-Control": self.CACHE_CONTROL})

        response = await call_next(request)
        if etag and response.status_code == 200:
            response.headers["ETag"] = etag
            response.headers["Cache-Control"] = self.CACHE_CONTROL
        elif "cache-control" not in response.headers:
            # Everything else is either per-install state behind a shared token
            # or a liveness answer. Nothing between here and the browser should
            # be keeping a copy of either.
            response.headers["Cache-Control"] = "no-store"
        return response


def _is_reference(request: Request) -> bool:
    return request.url.path.startswith("/api/benchmarks")


def _etag(request: Request) -> str | None:
    try:
        checksum = benchmarks.source_meta().get("archive_sha256")
    except Exception:
        # No snapshot means no promise to make about the body; /healthz is the
        # endpoint that reports that, and it is not one of these.
        return None
    if not checksum:
        return None
    key = f"{checksum}|{request.url.path}|{urlencode(sorted(request.query_params.multi_items()))}"
    return f'"{hashlib.sha256(key.encode()).hexdigest()[:32]}"'


def _matches(header: str, etag: str) -> bool:
    """RFC 9110 If-None-Match: a comma-separated list, or ``*``.

    The ``W/`` prefix is stripped before comparing. We never send a weak
    validator, but an intermediary is allowed to weaken one on the way back,
    and a weak comparison is exactly what a conditional GET asks for.
    """
    tags = {part.strip().removeprefix("W/") for part in header.split(",") if part.strip()}
    return "*" in tags or etag in tags
