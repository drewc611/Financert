"""Asset taxonomy and the Federal Reserve DFA series map.

This module is the single place the answer to "where does this number come
from" lives. Every benchmark figure Financert shows traces back to a FRED
series id listed here.

Source: Federal Reserve Distributional Financial Accounts (DFA), which give
quarterly household balance-sheet levels split by wealth percentile group,
from 1989 Q3 to the present. Series are pulled from FRED (fred.stlouisfed.org).

Three naming conventions coexist in the DFA on FRED, and all three are needed:

* Legacy block ids -- ``WFRBL<GROUP><NNN>``, where ``NNN`` is a globally
  sequential number. Each wealth group owns a contiguous 27-slot block, and
  the slot's offset within its block identifies the asset category. So
  "Corporate Equities" is offset 13, which is 014 for the top 1% (block
  starts at 1) and 041 for the next 9% (block starts at 28).
* Modern ids -- deposits and pension entitlements were re-cut in a later
  DFA revision and the legacy slots for them were discontinued (they stop
  at 2022 Q1). Their replacements use a different scheme, and, unhelpfully,
  the top 1% orders the parts differently from every other group:
  ``WFRBLTOP1DE`` but ``WFRBLDEN09``. Both spellings are recorded below.
* Alphabetical block ids -- the finer top 0.1% cut, added later, does not
  follow the legacy layout at all. Its block (``WFRBLTP1227``..``253``) is
  ordered alphabetically by category name, so there is no offset arithmetic
  to do and its series are listed explicitly in ``TOP01_SERIES``.

Because of that third scheme, series lookup is per-group rather than a single
formula -- see ``series_ids_for``.
"""

# --- wealth groups ----------------------------------------------------------

# block_start is the legacy sequential id of offset 0 ("Nonfinancial Assets")
# for that group.
WEALTH_GROUPS = {
    # `nested` marks a group that is a subset of another rather than its own
    # slice of the population. The four legacy groups partition every US
    # household; the top 0.1% sits inside the top 1%, so it must never be
    # summed alongside them or presented as a fifth slice of a pie.
    "top01": {
        "code": "TP1",
        "label": "Top 0.1%",
        "percentile_range": "99.9th-100th",
        "block_start": None,  # alphabetical block, see TOP01_SERIES
        "population_share": 0.001,
        "nested": True,
        "nested_in": "top1",
    },
    "top1": {
        "code": "T01",
        "label": "Top 1%",
        "percentile_range": "99th-100th",
        "block_start": 1,
        "population_share": 0.01,
        "nested": False,
    },
    "next9": {
        "code": "N09",
        "label": "Next 9%",
        "percentile_range": "90th-99th",
        "block_start": 28,
        "population_share": 0.09,
        "nested": False,
    },
    "next40": {
        "code": "N40",
        "label": "Next 40%",
        "percentile_range": "50th-90th",
        "block_start": 55,
        "population_share": 0.40,
        "nested": False,
    },
    "bottom50": {
        "code": "B50",
        "label": "Bottom 50%",
        "percentile_range": "0-50th",
        "block_start": 82,
        "population_share": 0.50,
        "nested": False,
    },
}

# The four groups that partition the population, in wealth order. The
# nested top 0.1% is deliberately excluded so anything iterating tiers to
# build a distribution cannot double count it.
GROUP_ORDER = ["top1", "next9", "next40", "bottom50"]

# Every group with data, including nested ones. Use this for fetching and
# for offering benchmarks to compare against.
ALL_GROUPS = ["top01", "top1", "next9", "next40", "bottom50"]

NESTED_GROUPS = [g for g in ALL_GROUPS if WEALTH_GROUPS[g].get("nested")]

# --- legacy block offsets ---------------------------------------------------

# Offsets that are commented out are deliberately excluded from the asset
# taxonomy because they are *sub-components* of a bucket already counted
# (e.g. offset 8/9 roll up into Debt Securities at offset 7) -- including
# them would double count. They are kept here as documentation of the block
# layout rather than deleted.
_BLOCK_LAYOUT = {
    0: "Nonfinancial Assets",  # = real_estate + consumer_durables
    1: "Real Estate",
    2: "Consumer Durables",
    3: "Financial Assets",  # = every financial bucket below
    4: "Checkable Deposits and Currency (DISCONTINUED)",
    5: "Time Deposits and Short-term Investments (DISCONTINUED)",
    6: "Money Market Fund Shares",
    7: "Debt Securities",
    8: "US Government and Municipal Securities",  # sub-item of 7
    9: "Corporate and Foreign Bonds",  # sub-item of 7
    10: "Loans (Assets)",
    11: "Other Loans and Advances (Assets)",  # sub-item of 10
    12: "Mortgages",  # sub-item of 10
    13: "Corporate Equities and Mutual Fund Shares",
    14: "Life Insurance Reserves",
    15: "Pension Entitlements (DISCONTINUED)",
    16: "Equity in Noncorporate Business",
    17: "Miscellaneous Assets",
    18: "Total Liabilities",
    19: "Loans (Liabilities)",  # sub-item of 18
    20: "Home Mortgages",  # sub-item of 18
    21: "Consumer Credit",  # sub-item of 18
    22: "Depository Institutions Loans N.E.C.",  # sub-item of 18
    23: "Other Loans and Advances (Liabilities)",  # sub-item of 18
    24: "Deferred and Unpaid Life Insurance Premiums",  # sub-item of 18
    25: "Net Worth",
}

# --- asset taxonomy ---------------------------------------------------------

# The buckets Financert reports on. Non-overlapping, and together they should
# very nearly equal total household assets. fetch_dfa.py checks them against
# the DFA's own "Nonfinancial Assets" + "Financial Assets" controls and fails
# the refresh on a large drift, so a double-counted or missing bucket cannot
# silently skew every percentage.
#
# They do not reconcile to exactly zero, for two measured reasons:
#
#   1. The modern defined-benefit + defined-contribution pension series sum to
#      slightly less than the legacy combined "Pension Entitlements" slot they
#      replaced (~0.3T for the next 9% in 2005). The modern pair is used
#      anyway, because the legacy slot stops in 2022 and current data matters
#      more here than a closed residual.
#   2. The DFA's own published components do not fully add up to its published
#      "Financial Assets" aggregate -- roughly 2% is unaccounted for even when
#      every legacy component is summed. The DFA distributes Financial Accounts
#      aggregates using Survey of Consumer Finances weights, and the per-category
#      FRED slice does not expose every residual line.
#
# Rather than bury either in a bucket it does not belong to, the remainder is
# reported as its own `unallocated` line, and percentages are taken against the
# Fed's control total so they still sum to 100%.
#
# `offset` is the legacy block offset; `modern` names the replacement series
# for the categories whose legacy slots were discontinued in 2022.
ASSET_CLASSES = [
    {
        "key": "corporate_equities",
        "label": "Stocks & Mutual Funds",
        "offset": 13,
        "liquid": True,
        "blurb": "Directly held corporate equities plus mutual fund shares.",
    },
    {
        "key": "private_business",
        "label": "Private Business Equity",
        "offset": 16,
        "liquid": False,
        "blurb": "Ownership of noncorporate businesses -- partnerships, S-corps, sole proprietorships.",
    },
    {
        "key": "pension",
        "label": "Pensions & Retirement",
        "offset": None,
        "modern": {"top1": "WFRBLTOP1DBP+WFRBLTOP1DCP", "other": "DBP+DCP"},
        "liquid": False,
        "blurb": "Defined benefit and defined contribution pension entitlements.",
    },
    {
        "key": "real_estate",
        "label": "Real Estate",
        "offset": 1,
        "liquid": False,
        "blurb": "Owner-occupied housing and other real property.",
    },
    {
        "key": "deposits",
        "label": "Cash & Deposits",
        "offset": None,
        "modern": {"top1": "WFRBLTOP1DE", "other": "DE"},
        "liquid": True,
        "blurb": "Checkable deposits, currency, time deposits and short-term investments.",
    },
    {
        "key": "money_market",
        "label": "Money Market Funds",
        "offset": 6,
        "liquid": True,
        "blurb": "Money market mutual fund shares.",
    },
    {
        "key": "debt_securities",
        "label": "Bonds",
        "offset": 7,
        "liquid": True,
        "blurb": "Treasury, municipal, corporate and foreign bonds held directly.",
    },
    {
        "key": "consumer_durables",
        "label": "Consumer Durables",
        "offset": 2,
        "liquid": False,
        "blurb": "Vehicles, appliances, furnishings -- counted as assets by the Fed, not investments.",
    },
    {
        "key": "life_insurance",
        "label": "Life Insurance",
        "offset": 14,
        "liquid": False,
        "blurb": "Cash value of life insurance reserves.",
    },
    {
        "key": "loans_assets",
        "label": "Loans Receivable",
        "offset": 10,
        "liquid": False,
        "blurb": "Mortgages and other loans held as assets.",
    },
    {
        "key": "misc_assets",
        "label": "Other Assets",
        "offset": 17,
        "liquid": False,
        "blurb": "Miscellaneous assets not classified elsewhere.",
    },
]

ASSET_CLASS_KEYS = [a["key"] for a in ASSET_CLASSES]
ASSET_CLASS_BY_KEY = {a["key"]: a for a in ASSET_CLASSES}

# Reported alongside the mapped buckets to close the gap to the Fed's control
# total. It is not a real asset category and users cannot hold it.
# In an incomplete quarter the residual is not really "unallocated" -- it is
# holding the classes the Fed has not released yet, so it is relabelled and
# given no over/underweight verdict. Being underweight a residual is not a
# statement anyone can act on.
PENDING_LABEL = "Not yet published"

UNALLOCATED = {
    "key": "unallocated",
    "label": "Unallocated",
    "liquid": False,
    "blurb": (
        "Residual between the Fed's published asset total and the categories "
        "above, caused by a definitional change in the deposits series."
    ),
}

# Aggregate control totals, used to validate the taxonomy rather than to report.
CONTROL_OFFSETS = {
    "nonfinancial_assets": 0,
    "financial_assets": 3,
    "total_liabilities": 18,
    "net_worth": 25,
}

# Assets the DFA counts that most people would not call an investment. The
# "investable" view nets these out so a user comparing their brokerage account
# against the top 1% is not silently competing with the Fed's estimate of
# everyone's used cars.
NON_INVESTABLE = {"consumer_durables"}

# --- allocation analysis knobs ---------------------------------------------

# A gap smaller than this (in percentage points of the portfolio) is reported
# as "in line" rather than over/under-weight -- the DFA itself is an estimate,
# and sub-point precision would imply accuracy the source does not have.
GAP_TOLERANCE_PP = 1.5

# Cosine-similarity floor for calling a user's allocation a match for a wealth
# tier. Below this, the nearest tier is reported without a "looks like" claim.
SIMILARITY_FLOOR = 0.50

FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"

# DFA levels are published in millions of dollars.
DFA_UNITS_MULTIPLIER = 1_000_000


def legacy_series_id(group_key: str, offset: int) -> str:
    """Return the legacy FRED levels series id for a group/offset pair."""
    group = WEALTH_GROUPS[group_key]
    return f"WFRBL{group['code']}{group['block_start'] + offset:03d}"


def modern_series_id(group_key: str, category: str) -> str:
    """Return the modern FRED levels series id.

    `category` is a short DFA code such as ``DE`` (deposits), ``DBP``
    (defined benefit pension) or ``DCP`` (defined contribution pension).
    Three spellings exist: the top 1% puts the group first
    (``WFRBLTOP1DE``), the top 0.1% uses a percentile suffix
    (``WFRBLDE999T100``), and everyone else puts the group last
    (``WFRBLDEN09``).
    """
    if group_key == "top1":
        return f"WFRBLTOP1{category}"
    if group_key == "top01":
        return f"WFRBL{category}999T100"
    return f"WFRBL{category}{WEALTH_GROUPS[group_key]['code']}"


# The top 0.1% block is ordered alphabetically by category name rather than by
# the legacy layout, so its ids are listed rather than computed. Verified
# against the series titles on FRED.
TOP01_SERIES = {
    "corporate_equities": ["WFRBLTP1232"],
    "private_business": ["WFRBLTP1236"],
    "real_estate": ["WFRBLTP1251"],
    "consumer_durables": ["WFRBLTP1230"],
    "money_market": ["WFRBLTP1244"],
    "debt_securities": ["WFRBLTP1233"],
    "life_insurance": ["WFRBLTP1240"],
    "loans_assets": ["WFRBLTP1241"],
    "misc_assets": ["WFRBLTP1243"],
    "deposits": ["WFRBLDE999T100"],
    "pension": ["WFRBLDBP999T100", "WFRBLDCP999T100"],
}

# Control totals for the top 0.1%, matching CONTROL_OFFSETS by name.
TOP01_CONTROLS = {
    "nonfinancial_assets": "WFRBLTP1247",
    "financial_assets": "WFRBLTP1237",
    "total_liabilities": "WFRBLTP1239",
    "net_worth": "WFRBLTP1246",
}


def series_ids_for(group_key: str, asset_key: str) -> list[str]:
    """Return the FRED series id(s) whose sum is this bucket's level."""
    if group_key == "top01":
        try:
            return TOP01_SERIES[asset_key]
        except KeyError:
            raise ValueError(f"no top 0.1% series for asset class {asset_key!r}") from None

    spec = ASSET_CLASS_BY_KEY[asset_key]
    if spec["offset"] is not None:
        return [legacy_series_id(group_key, spec["offset"])]
    if asset_key == "deposits":
        return [modern_series_id(group_key, "DE")]
    if asset_key == "pension":
        return [
            modern_series_id(group_key, "DBP"),
            modern_series_id(group_key, "DCP"),
        ]
    raise ValueError(f"no series mapping for asset class {asset_key!r}")


def control_series_id(group_key: str, control: str) -> str:
    """Return the FRED series id for one of a group's control totals."""
    if group_key == "top01":
        return TOP01_CONTROLS[control]
    return legacy_series_id(group_key, CONTROL_OFFSETS[control])
