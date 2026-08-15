"""Pydantic request/response contract."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ActorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    actor_type: str
    title: str | None = None
    affiliation: str | None = None
    power_score: float
    profile_url: str | None = None


class PositionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venue: str
    actor_name: str
    actor_type: str
    actor_title: str | None = None
    actor_affiliation: str | None = None
    power_score: float

    subject_kind: str
    subject_key: str
    subject_label: str

    direction: int
    usd_low: float | None = None
    usd_high: float | None = None
    usd_estimate: float | None = None

    raw_code: str | None = None
    raw_label: str | None = None

    transacted_at: date | None = None
    disclosed_at: date | None = None
    disclosure_lag_days: int | None = None
    source_url: str | None = None
    notes: str | None = None


class SubjectScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subject_key: str
    subject_kind: str
    subject_label: str
    conviction: float
    consensus: float
    gross_activity: float
    # Both sides are exposed, not just the net: the dashboard draws a buy/sell
    # split bar, which cannot be reconstructed from conviction alone.
    long_weight: float
    short_weight: float
    position_count: int
    actor_count: int
    venue_count: int
    venues: str
    usd_long: float
    usd_short: float
    top_actor: str | None = None
    last_activity_at: date | None = None


class SignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subject_key: str
    subject_label: str
    kind: str
    strength: float
    headline: str
    detail: str | None = None
    venues: str
    actor_count: int


class VenueStat(BaseModel):
    venue: str
    position_count: int
    actor_count: int
    usd_tracked: float
    last_activity_at: date | None = None


class IngestRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    venue: str
    started_at: datetime
    finished_at: datetime | None = None
    ok: bool
    positions_added: int
    positions_seen: int
    message: str | None = None


class OverviewOut(BaseModel):
    """Everything the landing page needs, in one call."""

    generated_at: datetime
    lookback_days: int

    total_positions: int
    total_actors: int
    total_usd_tracked: float

    venues: list[VenueStat]
    top_signals: list[SignalOut]
    most_conviction: list[SubjectScoreOut]
    most_contested: list[SubjectScoreOut]
    recent_positions: list[PositionOut]
    last_runs: list[IngestRunOut]


class RefreshRequest(BaseModel):
    venues: list[str] | None = None
    congress_year: int | None = None
    sec_days: int = 2
    polymarket_markets: int = 25
