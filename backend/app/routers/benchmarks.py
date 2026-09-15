"""/api/benchmarks -- the Federal Reserve reference data."""

from fastapi import APIRouter, HTTPException, Query

from ..constants import DEFAULT_DIMENSION, dimension_of
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
    dimension: str = Query(
        DEFAULT_DIMENSION,
        description="Which cut of the population to benchmark against: networth, generation, education, income, race or age",
    ),
):
    try:
        resolved = benchmarks.resolve_period(period)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown period {period!r}") from None
    if dimension not in benchmarks.dimension_names():
        raise HTTPException(status_code=404, detail=f"unknown dimension {dimension!r}")

    return {
        "period": resolved,
        "periods": benchmarks.periods(),
        "latest_period": benchmarks.latest_period(),
        "latest_complete_period": benchmarks.latest_complete_period(),
        "complete_periods": benchmarks.complete_periods(),
        "dimension": dimension,
        # Offered so a client can build a picker without hardcoding the list.
        "dimensions": [
            {"key": key, "label": spec["label"], "group_order": spec["group_order"]}
            for key, spec in benchmarks.dimensions().items()
        ],
        "group_order": benchmarks.dimensions()[dimension]["group_order"],
        "investable_only": investable_only,
        "source": benchmarks.source_meta(),
        "asset_classes": benchmarks.asset_classes(),
        "allocations": benchmarks.all_allocations(resolved, investable_only=investable_only, dimension=dimension),
    }


@router.get("/benchmarks/trend", response_model=TrendOut)
def get_trend(
    group: str = Query("top1", description="Group key, from any dimension"),
    asset_class: str = Query(..., description="Asset-class key"),
):
    """The dimension is resolved from the group key, which is unique across the
    whole registry, so a caller holding only a key does not have to say which
    axis it came from."""
    try:
        dimension = dimension_of(group)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}") from None
    if group not in benchmarks.groups_in(dimension):
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}")
    try:
        points = benchmarks.trend(group, asset_class, dimension)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown asset_class {asset_class!r}") from None
    return {"group": group, "dimension": dimension, "asset_class": asset_class, "points": points}
