"""Tunable business constants.

This is the single place a "where does this number come from" question gets
answered. Do not scatter weights or thresholds into the services.
"""

# --------------------------------------------------------------------------
# Venues
# --------------------------------------------------------------------------

VENUE_POLYMARKET = "polymarket"
VENUE_INSIDER = "insider"
VENUE_CONGRESS = "congress"

ALL_VENUES = (VENUE_POLYMARKET, VENUE_INSIDER, VENUE_CONGRESS)

ACTOR_WHALE = "whale"
ACTOR_INSIDER = "insider"
ACTOR_POLITICIAN = "politician"

SUBJECT_EQUITY = "equity"
SUBJECT_EVENT = "event"

DIRECTION_LONG = 1
DIRECTION_SHORT = -1


# --------------------------------------------------------------------------
# Congress: House periodic transaction report (PTR) amount brackets
# --------------------------------------------------------------------------
# Members disclose a bracket, never an exact figure (Ethics in Government Act,
# 5 U.S.C. app. 4 §102). We keep both bounds and use the geometric mean as the
# point estimate — brackets span an order of magnitude, so the arithmetic mean
# systematically overstates the typical trade.

PTR_AMOUNT_BRACKETS: dict[str, tuple[int, int]] = {
    "$1,001 - $15,000": (1_001, 15_000),
    "$15,001 - $50,000": (15_001, 50_000),
    "$50,001 - $100,000": (50_001, 100_000),
    "$100,001 - $250,000": (100_001, 250_000),
    "$250,001 - $500,000": (250_001, 500_000),
    "$500,001 - $1,000,000": (500_001, 1_000_000),
    "$1,000,001 - $5,000,000": (1_000_001, 5_000_000),
    "$5,000,001 - $25,000,000": (5_000_001, 25_000_000),
    "$25,000,001 - $50,000,000": (25_000_001, 50_000_000),
    "$50,000,000 +": (50_000_000, 100_000_000),
    "Over $50,000,000": (50_000_000, 100_000_000),
    "$1,000 - $15,000": (1_000, 15_000),
}

# PTR transaction type codes as printed on the filing.
PTR_DIRECTION: dict[str, int] = {
    "P": DIRECTION_LONG,  # purchase
    "S": DIRECTION_SHORT,  # sale
    "S (partial)": DIRECTION_SHORT,
    "S (PARTIAL)": DIRECTION_SHORT,
    "E": 0,  # exchange — no net directional view
}

# The STOCK Act gives members 45 days to disclose. Anything past that is a
# compliance failure and worth surfacing on its own.
CONGRESS_DISCLOSURE_DEADLINE_DAYS = 45


# --------------------------------------------------------------------------
# Corporate insiders: SEC Form 4 transaction codes
# --------------------------------------------------------------------------
# Not every Form 4 line is a decision. A grant (A) or a tax-withholding
# disposition (F) tells you nothing about conviction; an open-market purchase
# (P) is the single highest-signal event in the whole dataset, because officers
# rarely buy their own stock for any reason other than believing it is cheap.
#
# `signal_weight` scales a transaction's contribution to the conviction score.

INSIDER_CODE_META: dict[str, dict] = {
    "P": {"direction": DIRECTION_LONG, "signal_weight": 1.00, "label": "Open-market purchase"},
    "S": {"direction": DIRECTION_SHORT, "signal_weight": 0.55, "label": "Open-market sale"},
    "A": {"direction": DIRECTION_LONG, "signal_weight": 0.05, "label": "Grant or award"},
    "M": {"direction": DIRECTION_LONG, "signal_weight": 0.05, "label": "Option exercise"},
    "F": {"direction": DIRECTION_SHORT, "signal_weight": 0.02, "label": "Tax withholding"},
    "G": {"direction": DIRECTION_SHORT, "signal_weight": 0.02, "label": "Gift"},
    "D": {"direction": DIRECTION_SHORT, "signal_weight": 0.15, "label": "Disposition to issuer"},
    "C": {"direction": DIRECTION_LONG, "signal_weight": 0.05, "label": "Conversion"},
    "X": {"direction": DIRECTION_LONG, "signal_weight": 0.05, "label": "Option exercise"},
    "I": {"direction": 0, "signal_weight": 0.05, "label": "Discretionary transaction"},
}

INSIDER_DEFAULT_META = {"direction": 0, "signal_weight": 0.05, "label": "Other"}

# Officer seniority multiplier. A CEO buying is a materially stronger statement
# than a divisional VP buying.
INSIDER_TITLE_POWER: tuple[tuple[str, float], ...] = (
    ("CHIEF EXECUTIVE", 1.00),
    ("CEO", 1.00),
    ("PRESIDENT", 0.90),
    ("CHAIRMAN", 0.90),
    ("CHIEF FINANCIAL", 0.85),
    ("CFO", 0.85),
    ("CHIEF OPERATING", 0.75),
    ("COO", 0.75),
    ("CHIEF", 0.70),
    ("EXECUTIVE VICE PRESIDENT", 0.60),
    ("SENIOR VICE PRESIDENT", 0.50),
    ("VICE PRESIDENT", 0.40),
    ("DIRECTOR", 0.55),
    ("GENERAL COUNSEL", 0.50),
)
INSIDER_DEFAULT_TITLE_POWER = 0.35

# A 10% owner is an institution or founder — a different kind of power than a
# hired officer, and worth its own floor.
INSIDER_TEN_PERCENT_OWNER_POWER = 0.80


# --------------------------------------------------------------------------
# Congressional power
# --------------------------------------------------------------------------
# Committee assignments are not published in the disclosure feed, so seniority
# here is a curated overlay keyed on last name. It is deliberately small and
# obvious rather than a scraped approximation that silently rots. Everyone not
# listed gets the default.
#
# Update this by hand when leadership changes; it is documented in the README.

CONGRESS_POWER_OVERRIDES: dict[str, float] = {
    # Chamber and party leadership.
    "JOHNSON": 1.00,
    "JEFFRIES": 1.00,
    "SCALISE": 0.95,
    "CLARK": 0.90,
    "EMMER": 0.90,
    "AGUILAR": 0.85,
    "PELOSI": 0.95,
    # Money committees: Ways and Means, Financial Services, Appropriations.
    "SMITH": 0.80,
    "NEAL": 0.80,
    "HILL": 0.80,
    "WATERS": 0.80,
    "COLE": 0.80,
    "DELAURO": 0.80,
    # Intelligence and Armed Services — non-public information exposure.
    "CRAWFORD": 0.80,
    "HIMES": 0.80,
    "ROGERS": 0.75,
}
CONGRESS_DEFAULT_POWER = 0.50


# --------------------------------------------------------------------------
# Polymarket
# --------------------------------------------------------------------------
# Prediction-market traders are pseudonymous, so "power" is earned through
# capital at risk rather than title. Scored on a log scale: the difference
# between a $1k and a $10k position matters more than $500k vs $509k.

WHALE_MIN_POSITION_USD = 1_000.0
WHALE_POWER_SATURATION_USD = 500_000.0

# Markets below this much lifetime volume are too thin for their prices to mean
# anything.
POLYMARKET_MIN_MARKET_VOLUME = 50_000.0

# How many top holders to record per tracked market.
POLYMARKET_HOLDERS_PER_MARKET = 20


# --------------------------------------------------------------------------
# Conviction and convergence scoring
# --------------------------------------------------------------------------
# A subject's conviction score is the power-weighted, size-weighted, recency-
# decayed sum of directional positions taken in it.

# Each venue's contribution to a blended score. Congress and insiders are both
# legally-compelled disclosures of real money; Polymarket is real money but on
# events rather than equities, so it rarely shares a subject with the other two.
VENUE_TRUST_WEIGHT: dict[str, float] = {
    VENUE_INSIDER: 1.00,
    VENUE_CONGRESS: 0.85,
    VENUE_POLYMARKET: 0.70,
}

# Positions decay with a half-life: a trade from six months ago should not read
# as current conviction.
CONVICTION_HALFLIFE_DAYS = 60.0

# Only score activity inside this lookback.
DEFAULT_LOOKBACK_DAYS = 180

# Size contribution is log-scaled for the same reason whale power is.
SIZE_SATURATION_USD = 1_000_000.0

# --- Convergence -----------------------------------------------------------
# The product's actual thesis: one group buying is a data point; two independent
# groups of powerful people buying the same thing in the same window is a
# signal. Divergence — insiders selling what Congress is buying — is often the
# more interesting of the two.

# Minimum distinct actors on a subject before we call it a cluster.
CLUSTER_MIN_ACTORS = 3

# Window in which separate trades count as coordinated.
CLUSTER_WINDOW_DAYS = 30

# |net direction| above this reads as one-sided agreement rather than churn.
CONSENSUS_THRESHOLD = 0.60

# Both sides must clear this share of activity for a subject to be flagged as
# genuinely contested rather than lopsided with a bit of noise.
DIVERGENCE_MIN_SIDE_SHARE = 0.30

SIGNAL_CONSENSUS_LONG = "consensus_long"
SIGNAL_CONSENSUS_SHORT = "consensus_short"
SIGNAL_DIVERGENCE = "divergence"
SIGNAL_CLUSTER = "cluster"
SIGNAL_LATE_DISCLOSURE = "late_disclosure"
