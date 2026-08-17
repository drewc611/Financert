"""Engine, session factory and declarative base.

The engine binds to ``DATABASE_URL`` at import time, so tests must point
``FINANCERT_DATABASE_URL`` at a throwaway file before importing anything
under ``app`` -- see ``tests/conftest.py``.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from . import models  # noqa: F401  (import registers the mappers)

    Base.metadata.create_all(bind=engine)
