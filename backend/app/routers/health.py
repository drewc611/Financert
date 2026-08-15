from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..dependencies import get_db
from ..models import Position, SubjectScore
from ..time_utils import utcnow

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz(db: Session = Depends(get_db)):
    """Liveness plus enough state to tell a healthy-but-empty database apart
    from a healthy-and-loaded one."""
    return {
        "ok": True,
        "time": utcnow(),
        "positions": db.execute(select(func.count(Position.id))).scalar_one(),
        "scored_subjects": db.execute(select(func.count(SubjectScore.id))).scalar_one(),
    }
