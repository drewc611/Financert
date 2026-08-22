"""/api/portfolio and /api/analysis -- the user's own holdings.

These endpoints are gated by ``require_token`` whenever ``FINANCERT_API_TOKEN``
is set. Portfolios are addressed by slug, so one install can hold several
(a personal one, a spouse's, a "what if" variant) without user accounts.

The token is a single shared secret, not a per-user login: everyone holding it
sees every portfolio. That is the right shape for a self-hosted single-household
tool and the wrong one for a multi-tenant service -- see the scope note in the
README before exposing this to more than one household.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..constants import ALL_GROUPS
from ..dependencies import get_db, require_token
from ..models import Holding, Portfolio
from ..schemas import AnalysisOut, PortfolioIn, PortfolioOut, PortfolioSummaryOut
from ..services import allocation, benchmarks

router = APIRouter(prefix="/api", tags=["portfolio"], dependencies=[Depends(require_token)])

DEFAULT_SLUG = "default"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")


def _validate_slug(slug: str) -> str:
    if not SLUG_RE.match(slug):
        raise HTTPException(
            status_code=422,
            detail="slug must be lowercase letters, digits and hyphens (max 63 chars)",
        )
    return slug


def _get_or_404(db: Session, slug: str) -> Portfolio:
    portfolio = db.query(Portfolio).filter(Portfolio.slug == slug).one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=404, detail=f"no portfolio {slug!r}; PUT one first")
    return portfolio


@router.get("/portfolios", response_model=list[PortfolioSummaryOut])
def list_portfolios(db: Session = Depends(get_db)):
    """Every portfolio on this install, newest first."""
    rows = db.query(Portfolio).order_by(Portfolio.updated_at.desc()).all()
    return [
        {
            "slug": p.slug,
            "name": p.name,
            "total_value": p.total_value,
            "holdings_count": len(p.holdings),
        }
        for p in rows
    ]


@router.get("/portfolio", response_model=PortfolioOut)
def read_portfolio(slug: str = Query(DEFAULT_SLUG), db: Session = Depends(get_db)):
    return _get_or_404(db, _validate_slug(slug))


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
    _validate_slug(slug)
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
    portfolio = _get_or_404(db, _validate_slug(slug))
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
    if group not in ALL_GROUPS:
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}")
    portfolio = _get_or_404(db, _validate_slug(slug))
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
    if group not in ALL_GROUPS:
        raise HTTPException(status_code=404, detail=f"unknown group {group!r}")
    holdings = {h.asset_class: h.value for h in payload.holdings}
    try:
        benchmarks.resolve_period(period)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown period {period!r}") from None
    return allocation.analyse(holdings, group=group, period=period, investable_only=investable_only)
