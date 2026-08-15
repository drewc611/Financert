"""FastAPI application factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import init_db
from .routers import admin, dashboard, health

DESCRIPTION = """
Financert tracks where the most powerful people in the world actually put their
money, by unifying three independent disclosure regimes into one schema:

* **Polymarket** - prediction-market positions held by large traders
* **Corporate insiders** - SEC Form 4 filings by officers, directors and 10% owners
* **Congress** - U.S. House periodic transaction reports filed under the STOCK Act

The point is not the three feeds, which are individually public. It is the
comparison between them: where these groups agree, and more usefully, where
they disagree.
"""


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Financert",
        description=DESCRIPTION,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(dashboard.router)
    app.include_router(admin.router)

    return app


app = create_app()
