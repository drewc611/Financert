"""Data model.

Financert stores only the user's own portfolio. The benchmark side is read
from the committed DFA snapshot, never the database, so the reference data
cannot drift per-install and a wiped database costs nothing but the holdings.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .time_utils import utcnow


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    holdings: Mapped[list["Holding"]] = relationship(
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="Holding.asset_class",
    )

    @property
    def total_value(self) -> float:
        return sum(h.value for h in self.holdings)


class Holding(Base):
    """One asset-class line in a portfolio.

    Deliberately one row per asset class rather than per instrument: the DFA
    benchmark only exists at asset-class granularity, so storing individual
    tickers would imply a comparison the reference data cannot support.
    """

    __tablename__ = "holdings"
    __table_args__ = (UniqueConstraint("portfolio_id", "asset_class", name="uq_holding_class"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    asset_class: Mapped[str] = mapped_column(String(48))
    value: Mapped[float] = mapped_column(Float, default=0.0)

    portfolio: Mapped[Portfolio] = relationship(back_populates="holdings")
