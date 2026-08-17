"""/healthz -- liveness plus whether the reference data actually loaded."""

from fastapi import APIRouter

from ..services import benchmarks

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz():
    try:
        snapshot_period = benchmarks.latest_period()
        snapshot_ok = True
    except Exception:
        snapshot_period = None
        snapshot_ok = False
    return {
        "status": "ok" if snapshot_ok else "degraded",
        "snapshot_loaded": snapshot_ok,
        "latest_period": snapshot_period,
    }
