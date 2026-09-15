"""FastAPI app factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOW_CREDENTIALS, CORS_ORIGINS
from .database import init_db
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
    app = FastAPI(
        title="Financert API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(benchmarks.router)
    app.include_router(portfolio.router)

    return app


app = create_app()
