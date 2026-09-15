"""Pydantic request/response contract."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .constants import ASSET_CLASS_KEYS


class HoldingIn(BaseModel):
    asset_class: str = Field(description="One of the Financert asset-class keys")
    value: float = Field(ge=0, description="Current value in dollars")

    @field_validator("asset_class")
    @classmethod
    def known_asset_class(cls, v: str) -> str:
        if v not in ASSET_CLASS_KEYS:
            raise ValueError(f"unknown asset_class {v!r}; expected one of {', '.join(ASSET_CLASS_KEYS)}")
        return v


class HoldingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_class: str
    value: float


class PortfolioIn(BaseModel):
    name: str = Field(default="My portfolio", max_length=120)
    holdings: list[HoldingIn] = Field(default_factory=list)

    @field_validator("holdings")
    @classmethod
    def no_duplicates(cls, v: list[HoldingIn]) -> list[HoldingIn]:
        seen = {h.asset_class for h in v}
        if len(seen) != len(v):
            raise ValueError("duplicate asset_class entries; combine them into one holding")
        return v


class PortfolioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    total_value: float
    holdings: list[HoldingOut]


class PortfolioSummaryOut(BaseModel):
    slug: str
    name: str
    total_value: float
    holdings_count: int


class AssetClassOut(BaseModel):
    key: str
    label: str
    liquid: bool
    blurb: str


class ShapeMetricsOut(BaseModel):
    """Single-number descriptions of a tier's balance sheet. Every field is
    nullable on purpose: a tier with no assets has no meaningful leverage, and
    0.0 would read as "no debt" rather than "no answer"."""

    leverage: float | None = Field(
        default=None,
        description="Liabilities over total assets -- always the whole balance sheet, never an investable-only subtotal",
    )
    concentration: float | None = Field(default=None, description="Share held in the single largest asset class")
    concentration_class: str | None = Field(default=None, description="Which asset class that is")
    liquidity: float | None = Field(default=None, description="Share held in classes flagged liquid in the taxonomy")


class ThresholdOut(BaseModel):
    """What it takes to be in a group, and when that was last measured.

    Triennial Survey of Consumer Finances data, so the period is almost never
    the period of the allocation beside it -- which is exactly why it travels
    with its own date rather than inheriting one."""

    field: str
    value: float
    period: str


class AllocationOut(BaseModel):
    group: str
    label: str
    # None where the source publishes no floor -- the bottom group has none,
    # and the five non-percentile axes have no cutoff column at all.
    threshold: ThresholdOut | None = None
    # Only meaningful where the cut is defined by percentile. Generation,
    # education, race and age have no such range, so this is None for them.
    percentile_range: str | None = None
    # True for a group that sits inside another (the top 0.1% inside the top
    # 1%) rather than being its own slice of the population.
    nested: bool = False
    nested_in: str | None = None
    period: str
    complete: bool = True
    unavailable: list[str] = Field(default_factory=list)
    total_assets: float
    total_liabilities: float
    net_worth: float
    weights: dict[str, float]
    metrics: ShapeMetricsOut


class DimensionOut(BaseModel):
    key: str
    label: str
    group_order: list[str]


class BenchmarksOut(BaseModel):
    period: str
    periods: list[str]
    latest_period: str
    latest_complete_period: str
    complete_periods: list[str]
    dimension: str = "networth"
    # Offered so a client can build a picker without hardcoding the axes.
    dimensions: list[DimensionOut] = Field(default_factory=list)
    group_order: list[str]
    investable_only: bool
    source: dict[str, Any]
    asset_classes: list[AssetClassOut]
    allocations: list[AllocationOut]


class GapOut(BaseModel):
    asset_class: str
    label: str
    user_pct: float
    benchmark_pct: float
    gap_pp: float
    status: str


class NearestTierOut(BaseModel):
    nearest: str
    nearest_label: str
    similarity: float
    confident: bool
    ranked: list[dict[str, Any]]


class PlacementOut(NearestTierOut):
    """Where one mix lands on one axis."""

    dimension: str
    label: str


class PlacementsOut(BaseModel):
    """One portfolio read against every axis at once. Six readings of the same
    balance sheet, not six populations -- the groups overlap, so the rows are
    never to be added up."""

    period: str
    investable_only: bool
    portfolio_total: float
    # Empty when there is nothing to place: no holdings is not the same answer
    # as "least like everyone".
    placements: list[PlacementOut] = Field(default_factory=list)


class AnalysisOut(BaseModel):
    period: str
    period_complete: bool = True
    period_unavailable: list[str] = Field(default_factory=list)
    benchmark_group: str
    # Resolved from the group key, which is unique across the whole registry.
    benchmark_dimension: str = "networth"
    benchmark_label: str
    investable_only: bool
    portfolio_total: float
    excluded_value: float
    user_weights: dict[str, float]
    benchmark_weights: dict[str, float]
    gaps: list[GapOut]
    similarity: float
    nearest_tier: NearestTierOut | None


class TrendPointOut(BaseModel):
    period: str
    share: float
    value: float


class TrendOut(BaseModel):
    group: str
    # Resolved from the group key, which is unique across the whole registry.
    dimension: str = "networth"
    asset_class: str
    points: list[TrendPointOut]
