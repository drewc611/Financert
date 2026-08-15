#!/usr/bin/env python
"""Fabricate a realistic dataset, with no network access.

Three jobs: make the project demoable without waiting on government PDFs, give
the test suite a fixed world to assert against, and produce data that actually
exercises every signal type — including divergence, which needs the same ticker
to appear in two different venues pointing opposite ways.

Everything here is INVENTED. Names are drawn from public figures because the
shape of the data matters (a CEO's trade should outweigh a VP's), but no
transaction below corresponds to a real filing. Run ``refresh.py`` for real
data.
"""

import argparse
import random
import sys
from datetime import timedelta

from app.constants import (
    ACTOR_INSIDER,
    ACTOR_POLITICIAN,
    ACTOR_WHALE,
    SUBJECT_EQUITY,
    SUBJECT_EVENT,
    VENUE_CONGRESS,
    VENUE_INSIDER,
    VENUE_POLYMARKET,
)
from app.database import Base, SessionLocal, engine, init_db
from app.services import ingest, scoring
from app.sources.base import SourcePosition, geometric_midpoint
from app.time_utils import today

RNG = random.Random(20260815)  # deterministic: tests depend on this

TODAY = today()

# --------------------------------------------------------------------------
# Cast
# --------------------------------------------------------------------------

POLITICIANS = [
    ("Nancy Pelosi", "CA11", "PELOSI"),
    ("Michael Johnson", "LA04", "JOHNSON"),
    ("Hakeem Jeffries", "NY08", "JEFFRIES"),
    ("Maxine Waters", "CA43", "WATERS"),
    ("Rick Crawford", "AR01", "CRAWFORD"),
    ("Jim Himes", "CT04", "HIMES"),
    ("Dan Goldman", "NY10", "GOLDMAN"),
    ("Marjorie Barnes", "TX22", "BARNES"),
]

INSIDERS = [
    ("Jensen Huang", "CHIEF EXECUTIVE OFFICER", "NVIDIA CORP", "NVDA"),
    ("Satya Nadella", "CHIEF EXECUTIVE OFFICER", "MICROSOFT CORP", "MSFT"),
    ("Andrew Cathcart", "CHIEF FINANCIAL OFFICER", "PALANTIR TECHNOLOGIES INC", "PLTR"),
    ("Dana Reeves", "EXECUTIVE VICE PRESIDENT", "PALANTIR TECHNOLOGIES INC", "PLTR"),
    ("Marcus Webb", "DIRECTOR", "LOCKHEED MARTIN CORP", "LMT"),
    ("Priya Raman", "CHIEF OPERATING OFFICER", "NVIDIA CORP", "NVDA"),
    ("Tom Ellery", "VICE PRESIDENT", "EXXON MOBIL CORP", "XOM"),
    ("Sofia Marchetti", "CHIEF EXECUTIVE OFFICER", "TESLA INC", "TSLA"),
    ("Grace Okafor", "SENIOR VICE PRESIDENT", "PALANTIR TECHNOLOGIES INC", "PLTR"),
    ("Ben Alvarez", "DIRECTOR", "PALANTIR TECHNOLOGIES INC", "PLTR"),
]

WHALES = [
    ("waterwaterwater", 480_000),
    ("0xwhaleshark", 210_000),
    ("PolyPrincipal", 96_000),
    ("someone2026", 62_000),
    ("zubizubizu", 41_000),
    ("quietcapital", 18_000),
]

EVENTS = [
    ("will-the-fed-cut-rates-in-q4", "Will the Fed cut rates in Q4 2026?"),
    ("will-the-us-invade-iran-before-2027", "Will the U.S. invade Iran before 2027?"),
    ("will-nvidia-hit-6t-market-cap", "Will Nvidia reach a $6T market cap in 2026?"),
    ("government-shutdown-before-2027", "Will there be a government shutdown before 2027?"),
]

EQUITIES = {
    "NVDA": "NVIDIA CORP",
    "MSFT": "MICROSOFT CORP",
    "PLTR": "PALANTIR TECHNOLOGIES INC",
    "LMT": "LOCKHEED MARTIN CORP",
    "XOM": "EXXON MOBIL CORP",
    "TSLA": "TESLA INC",
    "AAPL": "APPLE INC",
    "JPM": "JPMORGAN CHASE & CO",
    "GOOGL": "ALPHABET INC",
    "AMZN": "AMAZON.COM INC",
    "KO": "COCA-COLA CO",
    "BA": "BOEING CO",
    "DIS": "WALT DISNEY CO",
    "MRNA": "MODERNA INC",
}

# The set pieces below are constructed to demonstrate specific signals. Random
# background activity is kept off those tickers deliberately: noise sprayed
# across the same symbols would dilute each one back under the consensus
# threshold, and the honest fix is cleaner sample data rather than lowering a
# real product threshold until fabricated data clears it.
SET_PIECE_TICKERS = {"NVDA", "PLTR", "XOM", "LMT"}
BACKGROUND_TICKERS = [t for t in EQUITIES if t not in SET_PIECE_TICKERS]

BRACKETS = [
    (1_001, 15_000),
    (15_001, 50_000),
    (50_001, 100_000),
    (100_001, 250_000),
    (250_001, 500_000),
    (500_001, 1_000_000),
    (1_000_001, 5_000_000),
]


def _congress_position(
    politician, ticker: str, direction: int, days_ago: int, *, lag_days: int = 30, bracket: int | None = None
) -> SourcePosition:
    name, district, last = politician
    low, high = BRACKETS[bracket if bracket is not None else RNG.randrange(len(BRACKETS))]
    transacted = TODAY - timedelta(days=days_ago)
    return SourcePosition(
        actor_type=ACTOR_POLITICIAN,
        actor_external_key=f"{name}|{district}".upper(),
        actor_name=name,
        actor_title=district,
        actor_affiliation="U.S. House of Representatives",
        actor_attrs={"last_name": last, "state_district": district},
        venue=VENUE_CONGRESS,
        external_id=f"seed-congress-{name}-{ticker}-{days_ago}-{direction}".replace(" ", ""),
        subject_kind=SUBJECT_EQUITY,
        subject_key=ticker,
        subject_label=EQUITIES.get(ticker, ticker),
        direction=direction,
        usd_low=float(low),
        usd_high=float(high),
        usd_estimate=geometric_midpoint(float(low), float(high)),
        signal_weight=1.0,
        raw_code="P" if direction > 0 else "S",
        raw_label="Purchase" if direction > 0 else "Sale",
        transacted_at=transacted,
        disclosed_at=transacted + timedelta(days=lag_days),
        source_url="https://disclosures-clerk.house.gov/",
        notes="Seeded sample data, not a real filing.",
    )


def _insider_position(insider, direction: int, days_ago: int, code: str, usd: float) -> SourcePosition:
    from app.constants import INSIDER_CODE_META

    name, title, company, ticker = insider
    meta = INSIDER_CODE_META.get(code, {"signal_weight": 0.5, "label": "Other"})
    transacted = TODAY - timedelta(days=days_ago)
    return SourcePosition(
        actor_type=ACTOR_INSIDER,
        actor_external_key=f"seed-cik-{name}".replace(" ", "-").lower(),
        actor_name=name,
        actor_title=title,
        actor_affiliation=company,
        actor_attrs={"officer_title": title, "is_officer": True},
        venue=VENUE_INSIDER,
        external_id=f"seed-insider-{name}-{ticker}-{days_ago}-{code}".replace(" ", ""),
        subject_kind=SUBJECT_EQUITY,
        subject_key=ticker,
        subject_label=company,
        direction=direction,
        usd_low=usd,
        usd_high=usd,
        usd_estimate=usd,
        signal_weight=meta["signal_weight"],
        raw_code=code,
        raw_label=meta["label"],
        transacted_at=transacted,
        disclosed_at=transacted + timedelta(days=2),
        source_url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany",
        notes="Seeded sample data, not a real filing.",
    )


def _whale_position(whale, slug: str, question: str, direction: int, usd: float, days_ago: int) -> SourcePosition:
    handle, _ = whale
    snapshot = TODAY - timedelta(days=days_ago)
    outcome = "Yes" if direction > 0 else "No"
    return SourcePosition(
        actor_type=ACTOR_WHALE,
        actor_external_key=f"0xseed{abs(hash(handle)) % (10**12):012x}",
        actor_name=handle,
        actor_title="Prediction-market trader",
        actor_affiliation=None,
        actor_attrs={"position_usd": usd},
        venue=VENUE_POLYMARKET,
        external_id=f"seed-pm-{handle}-{slug}-{days_ago}",
        subject_kind=SUBJECT_EVENT,
        subject_key=f"pm:{slug}",
        subject_label=question,
        direction=direction,
        usd_low=usd,
        usd_high=usd,
        usd_estimate=usd,
        signal_weight=1.0,
        raw_code=outcome,
        raw_label=f"Holds {outcome}",
        transacted_at=snapshot,
        disclosed_at=snapshot,
        source_url=f"https://polymarket.com/event/{slug}",
        notes="Seeded sample data, not a real position.",
    )


def build_positions() -> dict[str, list[SourcePosition]]:
    congress: list[SourcePosition] = []
    insider: list[SourcePosition] = []
    whale: list[SourcePosition] = []

    # --- The set piece: PLTR divergence -----------------------------------
    # Five members of Congress buying into a defense-software name while the
    # company's own CFO and EVP sell. This is the pattern the product exists
    # to surface, so the seed data has to contain one.
    # Four insider sellers against four congressional buyers. An earlier
    # version used two sellers, which left the sell side at 19% of weighted
    # activity - under the 30% floor that stops a lopsided subject with one
    # stray trade from reading as a genuine standoff. Open-market sales are
    # also discounted (constants.INSIDER_CODE_META) because they are often
    # scheduled rather than opinionated, so it takes several to balance.
    for index, politician in enumerate(POLITICIANS[:4]):
        congress.append(_congress_position(politician, "PLTR", +1, days_ago=12 + index * 3, bracket=4 + (index % 3)))
    insider.append(_insider_position(INSIDERS[2], -1, 9, "S", 4_200_000))
    insider.append(_insider_position(INSIDERS[3], -1, 14, "S", 1_850_000))
    insider.append(_insider_position(INSIDERS[8], -1, 11, "S", 2_400_000))
    insider.append(_insider_position(INSIDERS[9], -1, 16, "S", 1_100_000))

    # --- Consensus long: NVDA, agreed across both venues ------------------
    for index, politician in enumerate(POLITICIANS[2:6]):
        congress.append(_congress_position(politician, "NVDA", +1, days_ago=8 + index * 4, bracket=3 + (index % 3)))
    insider.append(_insider_position(INSIDERS[0], +1, 6, "P", 12_500_000))
    insider.append(_insider_position(INSIDERS[5], +1, 11, "P", 2_100_000))

    # --- Consensus short: XOM ---------------------------------------------
    for index, politician in enumerate(POLITICIANS[3:7]):
        congress.append(_congress_position(politician, "XOM", -1, days_ago=20 + index * 5, bracket=2 + (index % 3)))
    insider.append(_insider_position(INSIDERS[6], -1, 18, "S", 780_000))

    # --- Late disclosure: a trade surfaced 217 days after the fact ---------
    congress.append(_congress_position(POLITICIANS[7], "LMT", +1, days_ago=240, lag_days=217, bracket=5))
    congress.append(_congress_position(POLITICIANS[0], "TSLA", -1, days_ago=150, lag_days=96, bracket=6))

    # --- Ordinary background activity -------------------------------------
    for _ in range(28):
        politician = RNG.choice(POLITICIANS)
        congress.append(
            _congress_position(
                politician,
                RNG.choice(BACKGROUND_TICKERS),
                RNG.choice([1, -1]),
                days_ago=RNG.randrange(3, 170),
                lag_days=RNG.randrange(8, 44),
            )
        )

    # Insiders only ever trade their own employer's stock, so background rows
    # are drawn from people whose company is not one of the set pieces.
    background_insiders = [person for person in INSIDERS if person[3] not in SET_PIECE_TICKERS]
    for _ in range(30):
        person = RNG.choice(background_insiders)
        code = RNG.choices(["S", "P", "A", "M", "F"], weights=[45, 18, 20, 10, 7])[0]
        direction = 1 if code in {"P", "A", "M"} else -1
        insider.append(
            _insider_position(
                person,
                direction,
                RNG.randrange(2, 150),
                code,
                float(RNG.randrange(40_000, 9_000_000)),
            )
        )

    # --- Prediction markets ------------------------------------------------
    for slug, question in EVENTS:
        # A lopsided favourite plus genuine two-sided interest elsewhere.
        for whale_actor in WHALES:
            if RNG.random() < 0.55:
                continue
            direction = RNG.choice([1, -1])
            usd = float(whale_actor[1]) * RNG.uniform(0.15, 1.0)
            whale.append(_whale_position(whale_actor, slug, question, direction, usd, RNG.randrange(0, 6)))

    # Guarantee one heavily crowded market so the cluster signal has a subject.
    slug, question = EVENTS[0]
    for index, whale_actor in enumerate(WHALES):
        whale.append(
            _whale_position(whale_actor, slug, question, 1 if index % 3 else -1, float(whale_actor[1]) * 0.6, index)
        )

    return {VENUE_CONGRESS: congress, VENUE_INSIDER: insider, VENUE_POLYMARKET: whale}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="drop all tables first")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(bind=engine)
    init_db()

    batches = build_positions()
    db = SessionLocal()
    try:
        total = 0
        for venue, items in batches.items():
            result = ingest.ingest_positions(db, venue, items)
            total += result.added
            print(f"  {venue:12s} added {result.added:4d} positions, {result.actors_added:3d} actors")
        subjects = scoring.recompute_all(db)
    finally:
        db.close()

    print(f"\nSeeded {total} positions across {len(batches)} venues; scored {subjects} subjects.")
    print("This is fabricated sample data. Run `python refresh.py` for real filings.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
