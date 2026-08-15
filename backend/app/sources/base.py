"""The contract every source adapter fulfils.

An adapter's only job is to turn one upstream disclosure regime into a list of
``SourcePosition``. It does no database work, no scoring, and no power
calculation — that keeps each adapter independently testable against a fixture
of real upstream bytes, which matters a lot when the upstream is a government
PDF that changes layout without warning.
"""

from dataclasses import dataclass, field
from datetime import date


@dataclass
class SourcePosition:
    """One normalized disclosure, before it touches the database."""

    # --- identity of the person -------------------------------------------
    actor_type: str
    actor_external_key: str
    actor_name: str
    actor_title: str | None = None
    actor_affiliation: str | None = None
    # Raw attributes the power model needs; shape varies by actor_type.
    actor_attrs: dict = field(default_factory=dict)

    # --- the bet ----------------------------------------------------------
    venue: str = ""
    external_id: str = ""
    subject_kind: str = ""
    subject_key: str = ""
    subject_label: str = ""
    direction: int = 0

    usd_low: float | None = None
    usd_high: float | None = None
    usd_estimate: float | None = None

    signal_weight: float = 1.0
    raw_code: str | None = None
    raw_label: str | None = None

    transacted_at: date | None = None
    disclosed_at: date | None = None
    source_url: str | None = None
    notes: str | None = None


def geometric_midpoint(low: float | None, high: float | None) -> float | None:
    """Point estimate for a bracketed range.

    Congressional brackets span an order of magnitude ($1,001–$15,000). The
    arithmetic mean of that is $8,000, which overstates the typical trade,
    because within-bracket amounts cluster toward the low end. The geometric
    mean ($3,873) is the honest summary of a log-uniform range.
    """
    if low is None or high is None:
        return None
    if low <= 0 or high <= 0:
        return (low + high) / 2
    return (low * high) ** 0.5
