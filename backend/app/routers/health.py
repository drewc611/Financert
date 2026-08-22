"""/healthz -- liveness plus whether the reference data actually loaded."""

from fastapi import APIRouter

from .. import config
from ..services import benchmarks

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz():
    try:
        snapshot_period = benchmarks.latest_period()
        complete_period = benchmarks.latest_complete_period()
        snapshot_ok = True
    except Exception:
        snapshot_period = None
        complete_period = None
        snapshot_ok = False
    return {
        "status": "ok" if snapshot_ok else "degraded",
        "snapshot_loaded": snapshot_ok,
        "latest_period": snapshot_period,
        "latest_complete_period": complete_period,
        # Surfaced so a deployment's posture can be checked without guessing.
        "auth_enabled": config.AUTH_ENABLED,
        "cors_wildcard": not config.ALLOW_CREDENTIALS,
        "cors_origins": len(config.CORS_ORIGINS),
    }
