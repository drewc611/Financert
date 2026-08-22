"""Request-scoped dependencies."""

import secrets
from collections.abc import Iterator

from fastapi import Header, HTTPException

from . import config
from .database import SessionLocal


def get_db() -> Iterator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_token(authorization: str = Header(default="")) -> None:
    """Guard the portfolio endpoints with a shared bearer token.

    A no-op when ``FINANCERT_API_TOKEN`` is unset, so local development needs
    no setup. The benchmark endpoints are deliberately left open -- they serve
    public Federal Reserve data and nothing user-specific.
    """
    # Read through the module so there is one place to configure (and patch).
    if not config.AUTH_ENABLED:
        return

    scheme, _, credential = authorization.partition(" ")
    if scheme.lower() != "bearer" or not credential:
        raise HTTPException(
            status_code=401,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Constant-time, so a wrong token cannot be recovered by timing the reply.
    if not secrets.compare_digest(credential, config.API_TOKEN):
        raise HTTPException(
            status_code=401,
            detail="invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
