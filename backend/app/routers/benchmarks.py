"""/api/benchmarks -- the Federal Reserve reference data."""

from fastapi import APIRouter, HTTPException, Query

from ..constants import ALL_GROUPS, GROUP_ORDER
from ..schemas import BenchmarksOut, TrendOut
from ..services import benchmarks

router = APIRouter(prefix="/api", tags=["benchmarks"])


@router.get("/benchmarks", response_model=BenchmarksOut)
def get_benchmarks(
    period: str | None = Query(
        None,
        description="Quarter start date, 'latest' (may lag a class), or 'complete'",
    ),
    investable_only: bool = Query(
        True,
        description="Exclude consumer durables and the unallocated residual, then renormalise",
    ),
):
    try:
        resolved = benchmarks.resolve_period(period)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown period {period!r}") from None

    return {
        "period": resolved,
        "periods": benchmarks.periods(),
        "latest_period": benchmarks.latest_period(),
        "latest_complete_period": benchmarks.latest_complete_period(),
        "complete_periods": benchmarks.complete_periods(),
        "group_order": GROUP_ORDER,
        "investable_only": investable_only,
        "source": benchmarks.source_meta(),
        "asset_classes": benchmarks.asset_classes(),
        "allocations": benchmarks.all_allocations(resolved, investable_only=investable_only),
    }


@router.get("/benchmarks/trend", response_model=TrendOut)
def get_trend(
    group: str = Query("top1", description="Wealth group key"),
    asset_class: str = Query(..., description="Asset-class key"),
):
    if group not in ALL_GROUPS:
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}")
    try:
        points = benchmarks.trend(group, asset_class)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown asset_class {asset_class!r}") from None
    return {"group": group, "asset_class": asset_class, "points": points}
