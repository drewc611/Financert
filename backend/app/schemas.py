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


class AllocationOut(BaseModel):
    group: str
    label: str
    percentile_range: str
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


class BenchmarksOut(BaseModel):
    period: str
    periods: list[str]
    latest_period: str
    latest_complete_period: str
    complete_periods: list[str]
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


class AnalysisOut(BaseModel):
    period: str
    period_complete: bool = True
    period_unavailable: list[str] = Field(default_factory=list)
    benchmark_group: str
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
    asset_class: str
    points: list[TrendPointOut]
