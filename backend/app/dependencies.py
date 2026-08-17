"""Request-scoped dependencies."""

from collections.abc import Iterator

from .database import SessionLocal


def get_db() -> Iterator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
