"""/api/benchmarks -- the Federal Reserve reference data."""

from fastapi import APIRouter, HTTPException, Query

from ..constants import DEFAULT_DIMENSION, dimension_of
from ..schemas import BenchmarksOut, MoversOut, ReconciliationOut, TrendOut
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
        "liability_classes": benchmarks.liability_classes(),
        "allocations": benchmarks.all_allocations(resolved, investable_only=investable_only, dimension=dimension),
    }


@router.get("/benchmarks/reconciliation", response_model=ReconciliationOut)
def get_reconciliation(dimension: str = Query(DEFAULT_DIMENSION)):
    """How much of the Fed's published asset total the taxonomy does not name,
    per quarter (BACKLOG F41). Published so the claim that it is zero can be
    checked rather than taken on trust."""
    if dimension not in benchmarks.dimension_names():
        raise HTTPException(status_code=404, detail=f"unknown dimension {dimension!r}")
    rows = benchmarks.reconciliation(dimension)
    return {
        "dimension": dimension,
        "worst_ever": max((r["worst"] for r in rows), default=0.0),
        "periods": rows,
    }


@router.get("/benchmarks/movers", response_model=MoversOut)
def get_movers(
    group: str = Query("top1", description="Any group of any axis"),
    from_period: str = Query(..., alias="from", description="Quarter start date, or 'earliest'"),
    to_period: str | None = Query(None, alias="to", description="Quarter start date; defaults to the latest"),
    investable_only: bool = Query(True),
):
    """Which classes moved most for one group between two quarters (F33), and
    what its mix looked like at each end (F32)."""
    try:
        dimension = dimension_of(group)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}") from None

    start = benchmarks.periods()[0] if from_period == "earliest" else from_period
    try:
        end = benchmarks.resolve_period(to_period)
        rows = benchmarks.movers(group, start, end, investable_only=investable_only, dimension=dimension)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown period {exc.args[0]!r}") from None

    return {
        "group": group,
        "label": benchmarks.groups_in(dimension)[group]["label"],
        "dimension": dimension,
        "investable_only": investable_only,
        "from_period": start,
        "to_period": end,
        "movers": rows,
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
