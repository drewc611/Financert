"""Data model.

The load-bearing idea: three very different disclosure regimes — a prediction
market, SEC Form 4 filings, and congressional periodic transaction reports —
are normalized into ONE ``Position`` table. A position is "a powerful person
put money behind a directional view on a subject". Everything downstream
(scoring, convergence, the dashboard) reads that one shape and never needs to
know which regime a row came from.

The cost of that choice is real and worth stating: the three sources disclose
at different granularity. Congress gives dollar *brackets*, never exact
figures. Form 4 gives exact share counts and prices. Polymarket gives exact
position sizes. ``usd_low``/``usd_high`` carry that uncertainty explicitly
rather than pretending to a precision the filings do not have.
"""

from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .time_utils import utcnow


class Actor(Base):
    """A person (or pseudonymous wallet) whose money moves we track."""

    __tablename__ = "actors"
    __table_args__ = (UniqueConstraint("actor_type", "external_key", name="uq_actor_identity"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # 'politician' | 'insider' | 'whale'
    actor_type: Mapped[str] = mapped_column(String(32), index=True)

    # Stable id within that source: CIK for insiders, "LAST|STATEDST" for
    # members of Congress, proxy wallet address for Polymarket traders.
    external_key: Mapped[str] = mapped_column(String(128))

    name: Mapped[str] = mapped_column(String(256), index=True)

    # Free-text role: "EXECUTIVE VICE PRESIDENT", "MO04", or "" for whales.
    title: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # Where the power comes from: issuer name for insiders, state/district for
    # politicians, wallet pseudonym for whales.
    affiliation: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # 0..1, computed at ingest from title/seniority/capital. See
    # services/power.py — never hand-edited on the row.
    power_score: Mapped[float] = mapped_column(Float, default=0.5)

    profile_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    positions: Mapped[list["Position"]] = relationship(back_populates="actor")


class Position(Base):
    """One disclosed directional bet, normalized across all three venues."""

    __tablename__ = "positions"
    __table_args__ = (
        # The dedupe key. Every adapter builds a deterministic external_id so
        # re-running a refresh is idempotent — filings get amended and
        # re-published constantly, and we must not double-count them.
        UniqueConstraint("venue", "external_id", name="uq_position_external"),
        Index("ix_position_subject_date", "subject_key", "transacted_at"),
        Index("ix_position_venue_date", "venue", "transacted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    venue: Mapped[str] = mapped_column(String(32), index=True)
    external_id: Mapped[str] = mapped_column(String(256))

    actor_id: Mapped[int] = mapped_column(ForeignKey("actors.id"), index=True)
    actor: Mapped[Actor] = relationship(back_populates="positions")

    # 'equity' (a ticker) or 'event' (a Polymarket outcome).
    subject_kind: Mapped[str] = mapped_column(String(16), index=True)
    # Normalized join key: uppercase ticker, or "pm:<market-slug>".
    subject_key: Mapped[str] = mapped_column(String(128), index=True)
    subject_label: Mapped[str] = mapped_column(String(512))

    # +1 long/acquire, -1 short/dispose, 0 directionally neutral.
    direction: Mapped[int] = mapped_column(Integer)

    # Disclosed dollar range. low == high when the source is exact.
    usd_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    usd_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Point estimate: geometric mean for bracketed sources, exact otherwise.
    usd_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)

    # How much this transaction type says about conviction (see
    # constants.INSIDER_CODE_META). A stock grant is not a decision.
    signal_weight: Mapped[float] = mapped_column(Float, default=1.0)

    # Raw source code, kept so the UI can show "Open-market purchase" instead
    # of an opaque letter.
    raw_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    raw_label: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # When the money actually moved vs. when the public was told. The gap is
    # itself a finding.
    transacted_at: Mapped[date | None] = mapped_column(Date, index=True)
    disclosed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    disclosure_lag_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SubjectScore(Base):
    """Materialized conviction score, one row per subject.

    Key invariant: the ``/api/*`` read endpoints serve from this table, never
    from a full scan of ``positions``. Page loads stay flat as history grows.
    Rebuilt wholesale by ``services.scoring.recompute_all``.
    """

    __tablename__ = "subject_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    subject_kind: Mapped[str] = mapped_column(String(16), index=True)
    subject_label: Mapped[str] = mapped_column(String(512))

    # Power-weighted, size-weighted, recency-decayed. Positive = the powerful
    # are net long. Range is unbounded but typically within +/- 20.
    conviction: Mapped[float] = mapped_column(Float, default=0.0)
    # conviction normalized to [-1, 1] by total activity — "how one-sided",
    # independent of how big.
    consensus: Mapped[float] = mapped_column(Float, default=0.0)

    gross_activity: Mapped[float] = mapped_column(Float, default=0.0)
    long_weight: Mapped[float] = mapped_column(Float, default=0.0)
    short_weight: Mapped[float] = mapped_column(Float, default=0.0)

    position_count: Mapped[int] = mapped_column(Integer, default=0)
    actor_count: Mapped[int] = mapped_column(Integer, default=0)
    venue_count: Mapped[int] = mapped_column(Integer, default=0)
    venues: Mapped[str] = mapped_column(String(128), default="")

    usd_long: Mapped[float] = mapped_column(Float, default=0.0)
    usd_short: Mapped[float] = mapped_column(Float, default=0.0)

    top_actor: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_activity_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    computed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Signal(Base):
    """A named finding about a subject — the output of the convergence engine."""

    __tablename__ = "signals"
    __table_args__ = (Index("ix_signal_kind_strength", "kind", "strength"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject_key: Mapped[str] = mapped_column(String(128), index=True)
    subject_label: Mapped[str] = mapped_column(String(512))

    kind: Mapped[str] = mapped_column(String(32), index=True)
    # 0..1 — how strongly the evidence supports this finding.
    strength: Mapped[float] = mapped_column(Float, default=0.0)
    # Plain-English explanation. Every signal must be able to say why.
    headline: Mapped[str] = mapped_column(String(512))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    venues: Mapped[str] = mapped_column(String(128), default="")
    actor_count: Mapped[int] = mapped_column(Integer, default=0)

    computed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class IngestRun(Base):
    """Audit trail for refreshes, so a stale dashboard is diagnosable."""

    __tablename__ = "ingest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venue: Mapped[str] = mapped_column(String(32), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ok: Mapped[bool] = mapped_column(default=False)
    positions_added: Mapped[int] = mapped_column(Integer, default=0)
    positions_seen: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
