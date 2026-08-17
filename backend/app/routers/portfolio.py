"""/api/portfolio and /api/analysis -- the user's own holdings.

Financert is a single-user local tool, so there is no auth and portfolios are
addressed by slug. Treat the database as private to the person running it.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..constants import GROUP_ORDER
from ..dependencies import get_db
from ..models import Holding, Portfolio
from ..schemas import AnalysisOut, PortfolioIn, PortfolioOut
from ..services import allocation, benchmarks

router = APIRouter(prefix="/api", tags=["portfolio"])

DEFAULT_SLUG = "default"


def _get_or_404(db: Session, slug: str) -> Portfolio:
    portfolio = db.query(Portfolio).filter(Portfolio.slug == slug).one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=404, detail=f"no portfolio {slug!r}; PUT one first")
    return portfolio


@router.get("/portfolio", response_model=PortfolioOut)
def read_portfolio(slug: str = Query(DEFAULT_SLUG), db: Session = Depends(get_db)):
    return _get_or_404(db, slug)


@router.put("/portfolio", response_model=PortfolioOut)
def upsert_portfolio(
    payload: PortfolioIn,
    slug: str = Query(DEFAULT_SLUG),
    db: Session = Depends(get_db),
):
    """Create or fully replace a portfolio's holdings.

    A full replace rather than a patch: the client always holds the complete
    allocation, and a partial update would make "I sold all my bonds" require
    a delete the UI has no natural place for.
    """
    portfolio = db.query(Portfolio).filter(Portfolio.slug == slug).one_or_none()
    if portfolio is None:
        portfolio = Portfolio(slug=slug, name=payload.name)
        db.add(portfolio)
    else:
        portfolio.name = payload.name
        portfolio.holdings.clear()
        db.flush()

    for item in payload.holdings:
        portfolio.holdings.append(Holding(asset_class=item.asset_class, value=item.value))

    db.commit()
    db.refresh(portfolio)
    return portfolio


@router.delete("/portfolio", status_code=204)
def delete_portfolio(slug: str = Query(DEFAULT_SLUG), db: Session = Depends(get_db)):
    portfolio = _get_or_404(db, slug)
    db.delete(portfolio)
    db.commit()


@router.get("/analysis", response_model=AnalysisOut)
def analyse_portfolio(
    slug: str = Query(DEFAULT_SLUG),
    group: str = Query("top1", description="Wealth group to compare against"),
    period: str | None = Query(None),
    investable_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    if group not in GROUP_ORDER:
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}")
    portfolio = _get_or_404(db, slug)
    holdings = {h.asset_class: h.value for h in portfolio.holdings}
    try:
        return allocation.analyse(holdings, group=group, period=period, investable_only=investable_only)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown period {period!r}") from None


@router.post("/analysis/preview", response_model=AnalysisOut)
def preview_analysis(
    payload: PortfolioIn,
    group: str = Query("top1"),
    period: str | None = Query(None),
    investable_only: bool = Query(True),
):
    """Analyse holdings without saving them -- lets the UI show a live
    comparison while the user is still typing numbers in."""
    if group not in GROUP_ORDER:
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}")
    holdings = {h.asset_class: h.value for h in payload.holdings}
    try:
        benchmarks.resolve_period(period)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown period {period!r}") from None
    return allocation.analyse(holdings, group=group, period=period, investable_only=investable_only)
