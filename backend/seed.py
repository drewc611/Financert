"""Create a sample portfolio so a fresh install has something to show.

    python seed.py

Writes a single portfolio under the ``default`` slug -- roughly a typical
US household in its forties: most of its net worth in the house and a 401(k),
a modest brokerage balance, and some cash. Running it again replaces that
portfolio; it never touches anything else in the database.
"""

from app.database import SessionLocal, init_db
from app.models import Holding, Portfolio
from app.services import allocation

SAMPLE_HOLDINGS = {
    "real_estate": 420_000,
    "pension": 210_000,
    "corporate_equities": 68_000,
    "deposits": 34_000,
    "consumer_durables": 31_000,
    "debt_securities": 12_000,
}


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(Portfolio).filter(Portfolio.slug == "default").one_or_none()
        if existing is not None:
            db.delete(existing)
            db.flush()

        portfolio = Portfolio(slug="default", name="Sample household")
        for asset_class, value in SAMPLE_HOLDINGS.items():
            portfolio.holdings.append(Holding(asset_class=asset_class, value=value))
        db.add(portfolio)
        db.commit()

        total = sum(SAMPLE_HOLDINGS.values())
        print(f"seeded portfolio 'default' -- {len(SAMPLE_HOLDINGS)} holdings, ${total:,.0f}")

        result = allocation.analyse(SAMPLE_HOLDINGS, group="top1")
        nearest = result["nearest_tier"]
        print(f"benchmark period {result['period']}, vs {result['benchmark_label']}")
        print(f"closest tier: {nearest['nearest_label']} (similarity {nearest['similarity']:.2f})")
        print("\nlargest gaps vs the top 1%:")
        for row in result["gaps"][:5]:
            arrow = "over " if row["gap_pp"] > 0 else "under"
            print(f"  {row['label']:<26} {arrow} {abs(row['gap_pp']):5.1f}pp")
    finally:
        db.close()


if __name__ == "__main__":
    main()
