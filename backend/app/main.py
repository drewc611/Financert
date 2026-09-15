"""FastAPI app factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOW_CREDENTIALS, CORS_ORIGINS
from .database import init_db
from .middleware import CacheHeaders, RequestLog, configure_logging
from .routers import benchmarks, health, portfolio
from .services import benchmarks as benchmarks_service

DESCRIPTION = """
Financert compares a portfolio against how American households actually hold
their wealth, by wealth percentile, using the Federal Reserve's Distributional
Financial Accounts.

It is a descriptive benchmarking tool. It reports what the data says the top
1% hold; it does not recommend holdings and is not investment advice.
""".strip()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()
    # The snapshot is an index plus one file per dimension now, so a missing
    # side file is possible in a way it was not when everything lived in one
    # document. Check the default dimension at startup rather than letting the
    # first dashboard load be what discovers it.
    benchmarks_service.verify_snapshot()
    yield


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="Financert API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
    )

    # add_middleware prepends, so this reads inside-out: CacheHeaders sits
    # closest to the routes, CORS wraps it -- otherwise the 304 CacheHeaders
    # returns by itself would carry no Access-Control-Allow-Origin and a
    # browser would reject the revalidation it just asked for -- and the
    # request log wraps everything, so a 304 and a 500 are both recorded.
    app.add_middleware(CacheHeaders)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
        # Without this the browser cannot read either header off the response,
        # which is the whole point of sending them.
        expose_headers=["ETag", "X-Request-ID"],
    )
    app.add_middleware(RequestLog)

    app.include_router(health.router)
    app.include_router(benchmarks.router)
    app.include_router(portfolio.router)

    return app


app = create_app()
