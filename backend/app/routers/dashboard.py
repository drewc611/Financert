"""Read endpoints. Everything the dashboard needs, nothing it does not."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..constants import ALL_VENUES, DEFAULT_LOOKBACK_DAYS
from ..dependencies import get_db
from ..schemas import OverviewOut, PositionOut, SignalOut, SubjectScoreOut
from ..services import analytics

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/overview", response_model=OverviewOut)
def get_overview(
    lookback_days: int = Query(DEFAULT_LOOKBACK_DAYS, ge=1, le=730),
    db: Session = Depends(get_db),
):
    """One call, whole landing page."""
    return analytics.overview(db, lookback_days=lookback_days)


@router.get("/positions", response_model=list[PositionOut])
def get_positions(
    venue: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if venue and venue not in ALL_VENUES:
        raise HTTPException(status_code=422, detail=f"unknown venue '{venue}'; expected one of {list(ALL_VENUES)}")
    return analytics.recent_positions(db, limit=limit, venue=venue)


@router.get("/signals", response_model=list[SignalOut])
def get_signals(
    kind: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return analytics.top_signals(db, limit=limit, kind=kind)


@router.get("/subjects", response_model=list[SubjectScoreOut])
def get_subjects(
    kind: str | None = Query(None, description="'equity' or 'event'"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return analytics.most_conviction(db, limit=limit, kind=kind)


@router.get("/subjects/{subject_key:path}")
def get_subject(subject_key: str, db: Session = Depends(get_db)):
    """One subject with every position behind its score.

    Path is greedy because Polymarket subject keys contain slashes-free slugs
    but equity keys may contain dots ("BRK.B") and NAME: prefixes.
    """
    detail = analytics.subject_detail(db, subject_key)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"no tracked activity for '{subject_key}'")
    return detail


@router.get("/people")
def get_people(
    actor_type: str | None = Query(None, description="'politician', 'insider', or 'whale'"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return analytics.actors(db, limit=limit, actor_type=actor_type)


@router.get("/contested", response_model=list[SubjectScoreOut])
def get_contested(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """Subjects where powerful money is most evenly split."""
    return analytics.most_contested(db, limit=limit)
