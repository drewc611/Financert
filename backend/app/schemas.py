"""Pydantic request/response contract."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .constants import ASSET_CLASS_KEYS, LIABILITY_CLASS_KEYS


def _example(payload: Any, **config: Any) -> ConfigDict:
    """Attach a worked example to a model, for the generated OpenAPI docs.

    Every example below is a real response taken from the committed snapshot,
    not an invention, so the scale of each field is the scale it will actually
    arrive in. Long lists are cut short and say so: the point is the shape, and
    the real response carries all 147 quarters and all 11 asset classes.

    ``tests/test_openapi.py`` asserts every endpoint reaches one of these.
    """
    return ConfigDict(json_schema_extra={"example": payload}, **config)


class HoldingIn(BaseModel):
    model_config = _example({"asset_class": "corporate_equities", "value": 240000})

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


class DebtIn(BaseModel):
    model_config = _example({"liability_class": "home_mortgages", "value": 260000})

    liability_class: str = Field(description="One of the Financert liability-class keys")
    value: float = Field(ge=0, description="Outstanding balance in dollars")

    @field_validator("liability_class")
    @classmethod
    def known_liability_class(cls, v: str) -> str:
        if v not in LIABILITY_CLASS_KEYS:
            raise ValueError(f"unknown liability_class {v!r}; expected one of {', '.join(LIABILITY_CLASS_KEYS)}")
        return v


class DebtOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    liability_class: str
    value: float


EXAMPLE_PORTFOLIO = {
    "name": "My portfolio",
    "holdings": [
        {"asset_class": "corporate_equities", "value": 240000},
        {"asset_class": "pension", "value": 180000},
        {"asset_class": "real_estate", "value": 420000},
        {"asset_class": "deposits", "value": 35000},
    ],
    "debts": [
        {"liability_class": "home_mortgages", "value": 260000},
        {"liability_class": "consumer_credit", "value": 8000},
    ],
}


class PortfolioIn(BaseModel):
    model_config = _example(EXAMPLE_PORTFOLIO)

    name: str = Field(default="My portfolio", max_length=120)
    holdings: list[HoldingIn] = Field(default_factory=list)
    # Optional: a portfolio of holdings alone is a perfectly good comparison of
    # allocation, and only net worth and the debt questions need this side.
    debts: list[DebtIn] = Field(default_factory=list)

    @field_validator("holdings")
    @classmethod
    def no_duplicates(cls, v: list[HoldingIn]) -> list[HoldingIn]:
        seen = {h.asset_class for h in v}
        if len(seen) != len(v):
            raise ValueError("duplicate asset_class entries; combine them into one holding")
        return v

    @field_validator("debts")
    @classmethod
    def no_duplicate_debts(cls, v: list[DebtIn]) -> list[DebtIn]:
        seen = {d.liability_class for d in v}
        if len(seen) != len(v):
            raise ValueError("duplicate liability_class entries; combine them into one debt")
        return v


class PortfolioOut(BaseModel):
    model_config = _example(
        {
            "slug": "default",
            "name": "My portfolio",
            "total_value": 875000.0,
            "total_debt": 268000.0,
            "net_worth": 607000.0,
            "holdings": [
                {"asset_class": "corporate_equities", "value": 240000.0},
                {"asset_class": "deposits", "value": 35000.0},
            ],
            "debts": [{"liability_class": "home_mortgages", "value": 260000.0}],
        },
        from_attributes=True,
    )

    slug: str
    name: str
    total_value: float
    total_debt: float = 0.0
    net_worth: float = 0.0
    holdings: list[HoldingOut]
    debts: list[DebtOut] = Field(default_factory=list)


class PortfolioSummaryOut(BaseModel):
    model_config = _example({"slug": "default", "name": "My portfolio", "total_value": 875000.0, "holdings_count": 4})

    slug: str
    name: str
    total_value: float
    holdings_count: int


class AssetClassOut(BaseModel):
    key: str
    label: str
    liquid: bool
    blurb: str
    # The DFA column(s) this bucket is the sum of. Sent because "where does
    # this number come from" is a question the product should answer in the
    # page rather than in a README (BACKLOG F56).
    columns: list[str] = Field(default_factory=list)


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


class LiabilityClassOut(BaseModel):
    key: str
    label: str
    blurb: str
    columns: list[str] = Field(default_factory=list)


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
    # None only if a future source stops publishing the count; every group in
    # every dimension carries one today.
    household_count: float | None = None
    weights: dict[str, float]
    # Shares of what the group owes. Empty for a group that owes nothing --
    # which is not the same statement as owing nothing of any one kind.
    debt_weights: dict[str, float] = Field(default_factory=dict)
    metrics: ShapeMetricsOut


class DimensionOut(BaseModel):
    key: str
    label: str
    group_order: list[str]


EXAMPLE_ALLOCATION = {
    "group": "top1",
    "label": "Top 1%",
    "threshold": {"field": "minimum_wealth_cutoff", "value": 11146846.0, "period": "2022-07-01"},
    "percentile_range": "99th-100th",
    "nested": False,
    "nested_in": None,
    "period": "2026-01-01",
    "complete": True,
    "unavailable": [],
    "total_assets": 56042476000000.0,
    "total_liabilities": 1009477000000.0,
    "net_worth": 55033000000000.0,
    "household_count": 1348292.0,
    # Abridged: the real response carries all eleven investable classes, and
    # they sum to 1.
    "weights": {"corporate_equities": 0.503409, "private_business": 0.159578, "real_estate": 0.11808},
    "debt_weights": {"home_mortgages": 0.551881, "other_loans": 0.263748, "consumer_credit": 0.161145},
    "metrics": {
        "leverage": 0.018013,
        "concentration": 0.503409,
        "concentration_class": "corporate_equities",
        "liquidity": 0.643029,
    },
}


class BenchmarksOut(BaseModel):
    model_config = _example(
        {
            "period": "2026-01-01",
            # 147 quarters from 1989 Q3; two shown.
            "periods": ["1989-07-01", "2026-01-01"],
            "latest_period": "2026-01-01",
            "latest_complete_period": "2026-01-01",
            "complete_periods": ["1989-07-01", "2026-01-01"],
            "dimension": "networth",
            "dimensions": [
                {"key": "networth", "label": "Net worth", "group_order": ["top1", "next9", "next40", "bottom50"]}
            ],
            "group_order": ["top1", "next9", "next40", "bottom50"],
            "investable_only": True,
            "source": {
                "name": "Federal Reserve Distributional Financial Accounts",
                "publisher": "Board of Governors of the Federal Reserve System",
                "url": "https://www.federalreserve.gov/releases/z1/dataviz/dfa/",
                "retrieved_at": "2026-09-15T08:10:36+00:00",
                "archive_sha256": "28f708eb3707213bb0c2bc69d7efa070efd8dede8c312e754af152720f6d196f",
                "units": "US dollars, not seasonally adjusted",
            },
            "asset_classes": [
                {
                    "key": "corporate_equities",
                    "label": "Stocks & Mutual Funds",
                    "liquid": True,
                    "blurb": "Directly held corporate equities plus mutual fund shares, "
                    "excluding those held through a DC pension.",
                    "columns": ["Corporate equities and mutual fund shares"],
                }
            ],
            "liability_classes": [
                {
                    "key": "home_mortgages",
                    "label": "Home Mortgages",
                    "blurb": "Mortgages secured on owner-occupied property, including home equity lines.",
                    "columns": ["Home mortgages"],
                }
            ],
            # One of the five net-worth groups.
            "allocations": [EXAMPLE_ALLOCATION],
        }
    )

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
    liability_classes: list[LiabilityClassOut] = Field(default_factory=list)
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

    model_config = _example(
        {
            "period": "2026-01-01",
            "investable_only": True,
            "portfolio_total": 875000.0,
            "total_debt": 268000.0,
            # One of six axes; `ranked` is abridged to the two closest groups.
            "placements": [
                {
                    "dimension": "networth",
                    "label": "Net worth",
                    "nearest": "next40",
                    "nearest_label": "Next 40%",
                    "similarity": 0.9435,
                    "confident": True,
                    "ranked": [
                        {"group": "next40", "label": "Next 40%", "similarity": 0.9435},
                        {"group": "bottom50", "label": "Bottom 50%", "similarity": 0.9152},
                    ],
                }
            ],
            "debt_placements": [
                {
                    "dimension": "networth",
                    "label": "Net worth",
                    "nearest": "next40",
                    "nearest_label": "Next 40%",
                    "similarity": 0.9908,
                    "confident": True,
                    "ranked": [{"group": "next40", "label": "Next 40%", "similarity": 0.9908}],
                }
            ],
        }
    )

    period: str
    investable_only: bool
    portfolio_total: float
    total_debt: float = 0.0
    # Empty when there is nothing to place: no holdings is not the same answer
    # as "least like everyone".
    placements: list[PlacementOut] = Field(default_factory=list)
    # The same readings for what is owed rather than what is held; empty unless
    # the request carried debts.
    debt_placements: list[PlacementOut] = Field(default_factory=list)


class AnalysisOut(BaseModel):
    model_config = _example(
        {
            "period": "2026-01-01",
            "period_complete": True,
            "period_unavailable": [],
            "benchmark_group": "top1",
            "benchmark_dimension": "networth",
            "benchmark_label": "Top 1%",
            "investable_only": True,
            "portfolio_total": 875000.0,
            "excluded_value": 0.0,
            # Both weight maps and the gap list are abridged; the real response
            # carries every class either side holds.
            "user_weights": {"corporate_equities": 0.274286, "real_estate": 0.48},
            "benchmark_weights": {"corporate_equities": 0.503409, "real_estate": 0.11808},
            "gaps": [
                {
                    "asset_class": "real_estate",
                    "label": "Real Estate",
                    "user_pct": 48.0,
                    "benchmark_pct": 11.81,
                    "gap_pp": 36.19,
                    "status": "overweight",
                },
                {
                    "asset_class": "corporate_equities",
                    "label": "Stocks & Mutual Funds",
                    "user_pct": 27.43,
                    "benchmark_pct": 50.34,
                    "gap_pp": -22.91,
                    "status": "underweight",
                },
            ],
            "similarity": 0.6384,
            "nearest_tier": {
                "nearest": "next40",
                "nearest_label": "Next 40%",
                "similarity": 0.9435,
                "confident": True,
                "ranked": [{"group": "next40", "label": "Next 40%", "similarity": 0.9435}],
            },
        }
    )

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


class ReconciliationPeriodOut(BaseModel):
    period: str
    residuals: dict[str, float]
    worst: float


class ReconciliationOut(BaseModel):
    """What share of the Fed's published asset total the taxonomy does not
    name. Zero today; published so that is checkable rather than asserted."""

    model_config = _example(
        {
            "dimension": "networth",
            # Rounding in the source's own figures, not a class left unnamed.
            "worst_ever": 1.5750718626537336e-06,
            # One of 147 quarters.
            "periods": [
                {
                    "period": "1989-07-01",
                    "residuals": {"top1": 6.261293808707456e-07, "next9": 0.0, "bottom50": 0.0},
                    "worst": 6.261293808707456e-07,
                }
            ],
        }
    )

    dimension: str
    worst_ever: float
    periods: list[ReconciliationPeriodOut]


class MoverOut(BaseModel):
    asset_class: str
    label: str
    from_share: float
    to_share: float
    change_pp: float


class MoversOut(BaseModel):
    """What changed about one group's mix between two quarters, biggest move
    first. Shares, not dollars: every tier's balance sheet grew over any long
    window, so dollars would rank the classes by asset prices instead."""

    model_config = _example(
        {
            "group": "top1",
            "label": "Top 1%",
            "dimension": "networth",
            "investable_only": True,
            "from_period": "2019-01-01",
            "to_period": "2026-01-01",
            # Biggest move first; abridged to the two largest.
            "movers": [
                {
                    "asset_class": "corporate_equities",
                    "label": "Stocks & Mutual Funds",
                    "from_share": 0.440061,
                    "to_share": 0.503409,
                    "change_pp": 6.334848,
                },
                {
                    "asset_class": "private_business",
                    "label": "Private Business Equity",
                    "from_share": 0.191963,
                    "to_share": 0.159578,
                    "change_pp": -3.238523,
                },
            ],
        }
    )

    group: str
    label: str
    dimension: str
    investable_only: bool
    from_period: str
    to_period: str
    movers: list[MoverOut]


class TrendPointOut(BaseModel):
    period: str
    share: float
    value: float


class TrendOut(BaseModel):
    model_config = _example(
        {
            "group": "top1",
            "dimension": "networth",
            "asset_class": "corporate_equities",
            # Two of 147 quarters, oldest first.
            "points": [
                {"period": "1989-07-01", "share": 0.186908, "value": 895538000000.0},
                # Share of all assets, not of the investable subtotal, so this
                # is a shade below the same class's weight in /api/benchmarks.
                {"period": "2026-01-01", "share": 0.493262, "value": 27643648000000.0},
            ],
        }
    )

    group: str
    # Resolved from the group key, which is unique across the whole registry.
    dimension: str = "networth"
    asset_class: str
    points: list[TrendPointOut]
