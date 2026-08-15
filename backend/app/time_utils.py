"""A single naive-UTC clock.

Every module uses ``utcnow()`` instead of ``datetime.utcnow()`` (deprecated) or
``datetime.now()`` (local time). Naive UTC keeps SQLite comparisons simple —
mixing naive and aware datetimes raises at comparison time.
"""

from datetime import UTC, date, datetime


def utcnow() -> datetime:
    """Current UTC time, naive (no tzinfo)."""
    return datetime.now(UTC).replace(tzinfo=None)


def today() -> date:
    return utcnow().date()


def parse_date(value: str | None) -> date | None:
    """Parse the handful of date shapes the three upstream sources emit.

    Returns None rather than raising — upstream filings contain genuinely
    malformed dates, and one bad row should not abort an ingest run.
    """
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    # ISO-8601 with fractional seconds and/or offset (Polymarket).
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def days_between(earlier: date | None, later: date | None) -> int | None:
    if earlier is None or later is None:
        return None
    return (later - earlier).days
