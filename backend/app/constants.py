"""Asset taxonomy and the Federal Reserve DFA column map.

This module is the single place the answer to "where does this number come
from" lives. Every benchmark figure Financert shows traces back to a column
named here.

Source: the Federal Reserve's Distributional Financial Accounts (DFA),
published as one zip covering six dimensions of the household balance sheet,
quarterly from 1989 Q3:

    https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip

We read ``dfa-networth-levels-detail.csv`` -- the wealth-percentile cut at its
finest granularity. The bulk file replaced an earlier path that pulled ~80
individual series from FRED. That path is gone for three reasons, all measured:

* FRED carries only the wealth-percentile cut; the zip also has generation,
  education, income, race and age.
* FRED's block layout omits ``Annuities`` entirely, which is why the old
  taxonomy left 1-3% of assets in an unexplained residual. With the full
  column set the components reconcile to the published ``Assets`` total to
  within 0.0002%.
* FRED's mirror of noncorporate business equity stops at 2024-07-01. The Fed's
  own file has it populated for every quarter with no gaps -- the lag was an
  artifact of the mirror, not a property of the DFA.

The file splits the top 1% into ``TopPt1`` and ``RemainingTop1``; the combined
top 1% is synthesised by summing them (see ``COMPOSITE_GROUPS``).
"""

# --- wealth groups ----------------------------------------------------------

# `category` is the value in the CSV's Category column. `parts` marks a group
# the file does not publish directly, synthesised by summing other categories.
WEALTH_GROUPS = {
    # `nested` marks a group that is a subset of another rather than its own
    # slice of the population. The four groups in GROUP_ORDER partition every
    # US household; the top 0.1% sits inside the top 1%, so it must never be
    # summed alongside them or presented as a fifth slice of a pie.
    "top01": {
        "category": "TopPt1",
        "label": "Top 0.1%",
        "percentile_range": "99.9th-100th",
        "population_share": 0.001,
        "nested": True,
        "nested_in": "top1",
    },
    "top1": {
        # Not published as one row; the file splits it at the 99.9th percentile.
        "parts": ["TopPt1", "RemainingTop1"],
        "label": "Top 1%",
        "percentile_range": "99th-100th",
        "population_share": 0.01,
        "nested": False,
    },
    "next9": {
        "category": "Next9",
        "label": "Next 9%",
        "percentile_range": "90th-99th",
        "population_share": 0.09,
        "nested": False,
    },
    "next40": {
        "category": "Next40",
        "label": "Next 40%",
        "percentile_range": "50th-90th",
        "population_share": 0.40,
        "nested": False,
    },
    "bottom50": {
        "category": "Bottom50",
        "label": "Bottom 50%",
        "percentile_range": "0-50th",
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

# The buckets Financert reports on: the top-level, non-overlapping asset
# components of the DFA detail file. Together they equal the published
# `Assets` total to within 0.0002% across all 735 published rows, and
# fetch_dfa.py fails the refresh if that stops being true.
#
# `column` is the CSV header. Columns deliberately excluded are *sub-items* of
# a bucket already counted -- including them would double count:
#   U.S. government and municipal securities, Corporate and foreign bonds
#       -> roll up into Debt securities
#   Other loans and advances (Assets), Mortgages
#       -> roll up into Loans (Assets)
#   Nonfinancial assets = Real estate + Consumer durables
#   Financial assets    = every financial bucket below
ASSET_CLASSES = [
    {
        "key": "corporate_equities",
        "label": "Stocks & Mutual Funds",
        "column": "Corporate equities and mutual fund shares",
        "liquid": True,
        "blurb": "Directly held corporate equities plus mutual fund shares, excluding those held through a DC pension.",
    },
    {
        "key": "private_business",
        "label": "Private Business Equity",
        # The Fed calls this "Miscellaneous other equity" in the detail file
        # and "Unincorporated businesses" in the summary; the two are the same
        # column, verified equal across every row.
        "column": "Miscellaneous other equity",
        "liquid": False,
        "blurb": "Proprietors' equity in noncorporate business -- partnerships, S-corps, sole proprietorships, and property held to rent out.",
    },
    {
        "key": "pension",
        "label": "Pensions & Retirement",
        "columns": ["DB pension entitlements", "DC pension entitlements"],
        "liquid": False,
        "blurb": "Defined benefit and defined contribution pension entitlements.",
    },
    {
        "key": "real_estate",
        "label": "Real Estate",
        "column": "Real estate",
        "liquid": False,
        "blurb": "Owner-occupied real estate including vacant land and mobile homes, at market value.",
    },
    {
        "key": "deposits",
        "label": "Cash & Deposits",
        "column": "Deposits",
        "liquid": True,
        "blurb": "Checkable deposits and currency, time deposits and short-term investments.",
    },
    {
        "key": "money_market",
        "label": "Money Market Funds",
        "column": "Money market fund shares",
        "liquid": True,
        "blurb": "Money market mutual fund shares.",
    },
    {
        "key": "debt_securities",
        "label": "Bonds",
        "column": "Debt securities",
        "liquid": True,
        "blurb": "Treasury, municipal, corporate and foreign bonds held directly.",
    },
    {
        "key": "consumer_durables",
        "label": "Consumer Durables",
        "column": "Consumer durables",
        "liquid": False,
        "blurb": "Vehicles, appliances, furnishings -- counted as assets by the Fed, not as investments.",
    },
    {
        "key": "annuities",
        "label": "Annuities",
        "column": "Annuities",
        "liquid": False,
        "blurb": "Annuities sold by life insurers directly to households, outside a pension.",
    },
    {
        "key": "life_insurance",
        "label": "Life Insurance",
        "column": "Life insurance reserves",
        "liquid": False,
        "blurb": "Cash value of life insurance reserves.",
    },
    {
        "key": "loans_assets",
        "label": "Loans Receivable",
        "column": "Loans (Assets)",
        "liquid": False,
        "blurb": "Mortgages and other loans held as assets.",
    },
    {
        "key": "misc_assets",
        "label": "Other Assets",
        "column": "Miscellaneous assets",
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
        "above. Rounding only, since the taxonomy now covers every component."
    ),
}

# Published aggregates, used to validate the taxonomy rather than to report.
# `total_assets` is taken straight from the file rather than summed, so the
# percentages are always shares of the Fed's own total.
CONTROL_COLUMNS = {
    "total_assets": "Assets",
    "nonfinancial_assets": "Nonfinancial assets",
    "financial_assets": "Financial assets",
    "total_liabilities": "Liabilities",
    "net_worth": "Net worth",
}

# Carried per group/period alongside the balance sheet. Household count makes
# per-household figures possible; the wealth cutoff answers "what net worth
# puts me in this group?" and is only populated for some categories.
EXTRA_COLUMNS = {
    "household_count": "Household count",
    "minimum_wealth_cutoff": "Minimum Wealth Cutoff",
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

# The Fed's bulk DFA download: every dimension, one request.
DFA_ZIP_URL = "https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip"

# The wealth-percentile cut at its finest granularity.
DFA_MEMBER = "dfa-networth-levels-detail.csv"

# DFA levels are published in millions of dollars.
DFA_UNITS_MULTIPLIER = 1_000_000


def columns_for(asset_key: str) -> list[str]:
    """Return the CSV column(s) whose sum is this bucket's level."""
    spec = ASSET_CLASS_BY_KEY[asset_key]
    if "columns" in spec:
        return list(spec["columns"])
    return [spec["column"]]


def categories_for(group_key: str) -> list[str]:
    """Return the CSV Category value(s) that make up a wealth group.

    Most groups are one row. The top 1% is not published as a row -- the file
    splits it at the 99.9th percentile -- so it is summed from its parts.
    """
    group = WEALTH_GROUPS[group_key]
    if "parts" in group:
        return list(group["parts"])
    return [group["category"]]


def parse_period(period: str) -> str:
    """Convert the file's ``1989:Q3`` into the ISO quarter start we store."""
    year, quarter = period.split(":")
    month = (int(quarter.lstrip("Qq")) - 1) * 3 + 1
    return f"{int(year):04d}-{month:02d}-01"
