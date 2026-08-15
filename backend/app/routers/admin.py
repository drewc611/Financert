"""Operational endpoints.

These are unauthenticated because the reference deployment is single-user and
local. Anything internet-facing must put auth in front of this router —
``/admin/refresh`` makes dozens of outbound requests to government endpoints
and is trivially abusable as an amplification vector. Called out here and in
the README rather than left as a surprise.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..constants import ALL_VENUES, DEFAULT_LOOKBACK_DAYS
from ..dependencies import get_db
from ..schemas import RefreshRequest
from ..services import refresh as refresh_service
from ..services import scoring

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/refresh")
def trigger_refresh(payload: RefreshRequest | None = None, db: Session = Depends(get_db)):
    """Pull from the upstream sources, then rescore.

    Synchronous and slow by design — this is a cron entry point, not something
    a page load should call. A full congressional pull downloads dozens of PDFs.
    """
    payload = payload or RefreshRequest()

    if payload.venues:
        unknown = set(payload.venues) - set(ALL_VENUES)
        if unknown:
            raise HTTPException(status_code=422, detail=f"unknown venues: {sorted(unknown)}")

    report = refresh_service.refresh(
        db,
        venues=payload.venues,
        congress_year=payload.congress_year,
        sec_days=payload.sec_days,
        polymarket_limit=payload.polymarket_markets,
    )
    return report.as_dict()


@router.post("/recompute")
def recompute(lookback_days: int = DEFAULT_LOOKBACK_DAYS, db: Session = Depends(get_db)):
    """Rescore everything already stored, without touching the network."""
    count = scoring.recompute_all(db, lookback_days=lookback_days)
    return {"subjects_scored": count, "lookback_days": lookback_days}
