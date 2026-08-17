"""A single naive-UTC clock, used everywhere instead of datetime.utcnow()."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    """Current UTC time, naive, for storage in SQLite DateTime columns."""
    return datetime.now(UTC).replace(tzinfo=None)
