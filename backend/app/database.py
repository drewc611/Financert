"""Engine, session factory, and declarative base.

The engine binds to ``config.DATABASE_URL`` at import time, so anything that
needs to point at a different database (the test suite, for one) must set the
environment variable *before* importing any ``app`` module.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, future=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create any missing tables."""
    from . import models  # noqa: F401  (import registers the mappers)

    Base.metadata.create_all(bind=engine)
