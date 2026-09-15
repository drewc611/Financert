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

# --- dimension registry -----------------------------------------------------

# The DFA publishes the same balance-sheet taxonomy cut six different ways, one
# CSV per cut. Each cut is a *dimension*: a set of groups that between them
# partition every US household. Adding one is a matter of describing it here,
# not of writing another copy of the fetch-and-group code.
#
# Within a dimension's ``groups``:
#   ``category``    the value in that file's Category column.
#   ``parts``       a group the file does not publish directly, synthesised by
#                   summing other categories.
#   ``nested``      a group that is a subset of another rather than its own
#                   slice of the population, so it must never be summed
#                   alongside its siblings or drawn as another slice of a pie.
#
# Net worth is the only dimension with a nested group. Income looks like it
# should have one -- ``pct99to100`` is its top-1% analogue -- but the file
# publishes it as its own disjoint slice alongside ``pct80to99``, so summing
# income's six groups is correct where summing net worth's five is not. That
# asymmetry is exactly why nesting is per-group data rather than a rule the
# code assumes.
#
# ``population_share`` is only meaningful where the cut is defined by
# percentile: the top 1% is one percent of households by construction. For
# generation, education, race and age the share is an empirical quantity that
# moves every quarter, so it is None here and belongs to the fetched data
# (``Household count``), not to this table.
#
# Category values below are transcribed from the published files, not inferred
# -- tests/test_dimensions.py checks them against the real archive.
DIMENSIONS = {
    "networth": {
        "label": "Net worth",
        "member": "dfa-networth-levels-detail.csv",
        # "what net worth puts me in this group?" -- published only in this cut.
        "extra_columns": {"minimum_wealth_cutoff": "Minimum Wealth Cutoff"},
        "groups": {
            "top01": {
                "category": "TopPt1",
                "label": "Top 0.1%",
                "percentile_range": "99.9th-100th",
                "population_share": 0.001,
                "nested": True,
                "nested_in": "top1",
            },
            "top1": {
                # Not published as one row; the file splits it at the 99.9th.
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
        },
    },
    "generation": {
        "label": "Generation",
        "member": "dfa-generation-levels-detail.csv",
        "groups": {
            "silent": {"category": "Silent", "label": "Silent and earlier", "nested": False},
            "boomer": {"category": "BabyBoom", "label": "Baby Boom", "nested": False},
            "genx": {"category": "GenX", "label": "Gen X", "nested": False},
            "millennial": {"category": "Millennial", "label": "Millennial and later", "nested": False},
        },
    },
    "education": {
        "label": "Education",
        "member": "dfa-education-levels-detail.csv",
        "groups": {
            "no_hs": {"category": "NoHS", "label": "No high school diploma", "nested": False},
            "hs": {"category": "HS", "label": "High school diploma", "nested": False},
            "some_college": {"category": "SomeCollege", "label": "Some college", "nested": False},
            "college": {"category": "College", "label": "College degree", "nested": False},
        },
    },
    "income": {
        "label": "Income",
        "member": "dfa-income-levels-detail.csv",
        # The income cut is the only one that publishes its own band edges.
        "extra_columns": {
            "minimum_income_cutoff": "Minimum Income Cutoff",
            "maximum_income_cutoff": "Maximum Income Cutoff",
        },
        "groups": {
            "pct00to20": {"category": "pct00to20", "label": "Bottom 20%", "population_share": 0.20, "nested": False},
            "pct20to40": {"category": "pct20to40", "label": "20th-40th", "population_share": 0.20, "nested": False},
            "pct40to60": {"category": "pct40to60", "label": "40th-60th", "population_share": 0.20, "nested": False},
            "pct60to80": {"category": "pct60to80", "label": "60th-80th", "population_share": 0.20, "nested": False},
            "pct80to99": {"category": "pct80to99", "label": "80th-99th", "population_share": 0.19, "nested": False},
            "pct99to100": {"category": "pct99to100", "label": "Top 1%", "population_share": 0.01, "nested": False},
        },
    },
    "race": {
        "label": "Race and ethnicity",
        "member": "dfa-race-levels-detail.csv",
        "groups": {
            "white": {"category": "White", "label": "White, non-Hispanic", "nested": False},
            "black": {"category": "Black", "label": "Black, non-Hispanic", "nested": False},
            "hispanic": {"category": "Hispanic", "label": "Hispanic", "nested": False},
            "other": {"category": "Other", "label": "Other or multiple", "nested": False},
        },
    },
    "age": {
        "label": "Age",
        "member": "dfa-age-levels-detail.csv",
        "groups": {
            "under40": {"category": "ageunder40", "label": "Under 40", "nested": False},
            "age40to54": {"category": "age40to54", "label": "40 to 54", "nested": False},
            "age55to69": {"category": "age55to69", "label": "55 to 69", "nested": False},
            "age70plus": {"category": "age70plus", "label": "70 and over", "nested": False},
        },
    },
}

# The dimension everything defaults to. The app is built around "how does the
# top 1% hold its wealth", so net worth stays the one the plain, unqualified
# endpoints answer for.
DEFAULT_DIMENSION = "networth"


def groups_of(dimension: str = DEFAULT_DIMENSION) -> dict:
    return DIMENSIONS[dimension]["groups"]


def group_order(dimension: str = DEFAULT_DIMENSION) -> list[str]:
    """The groups that partition the population, in published order.

    Nested groups are excluded, so anything iterating a dimension to build a
    distribution cannot double count.
    """
    return [key for key, spec in groups_of(dimension).items() if not spec.get("nested")]


def all_group_keys(dimension: str = DEFAULT_DIMENSION) -> list[str]:
    """Every group with data, nested ones included -- what to fetch, and what
    to offer as a benchmark to compare against."""
    return list(groups_of(dimension))


def nested_group_keys(dimension: str = DEFAULT_DIMENSION) -> list[str]:
    return [key for key, spec in groups_of(dimension).items() if spec.get("nested")]


def dimension_of(group_key: str) -> str:
    """Which dimension a group key belongs to.

    Group keys are unique across the whole registry (checked in
    tests/test_dimensions.py), so a caller holding only a key can still be
    routed without being told which axis it came from.
    """
    for name, spec in DIMENSIONS.items():
        if group_key in spec["groups"]:
            return name
    raise KeyError(group_key)


# --- wealth groups ----------------------------------------------------------

# Net worth's own view of the registry. These four names are what most of the
# app imports; they are derived rather than written out twice so the registry
# stays the single source of truth.
WEALTH_GROUPS = groups_of()
GROUP_ORDER = group_order()
ALL_GROUPS = all_group_keys()
NESTED_GROUPS = nested_group_keys()

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

# Carried per group/period alongside the balance sheet, for every dimension.
COMMON_EXTRA_COLUMNS = {"household_count": "Household count"}


def extra_columns_for(dimension: str = DEFAULT_DIMENSION) -> dict[str, str]:
    """Which non-balance-sheet columns this dimension's file carries.

    These genuinely differ per file, and reading one that isn't there is a hard
    error rather than a zero (see fetch_dfa._num), so this is not decoration:
    ``Minimum Wealth Cutoff`` exists only in the net-worth cut, and the income
    cut is the only one with income cutoffs. Verified against the published
    headers in tests/test_dimensions.py.
    """
    return {**COMMON_EXTRA_COLUMNS, **DIMENSIONS[dimension].get("extra_columns", {})}


# Extras that are a *threshold*, not a quantity. They cannot be summed: the
# floor of a combined band is the floor of its lowest part, not the sum of its
# parts' floors. They are also sparse -- the wealth cutoff comes from the
# triennial Survey of Consumer Finances, so it exists for 12 of 147 quarters
# and never for the bottom group, which has no floor. Blank means "not
# published", which must reach the snapshot as None rather than 0.0: a zero
# here would read as "no wealth required to be in the top 1%".
THRESHOLD_COLUMNS = frozenset({"minimum_wealth_cutoff", "minimum_income_cutoff", "maximum_income_cutoff"})

# Net worth's own view, for the callers that predate the registry.
EXTRA_COLUMNS = extra_columns_for()

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


def categories_for(group_key: str, dimension: str | None = None) -> list[str]:
    """Return the CSV Category value(s) that make up a group.

    Most groups are one row. Net worth's top 1% is not published as a row --
    the file splits it at the 99.9th percentile -- so it is summed from its
    parts. ``dimension`` is resolved from the key when not given.
    """
    dimension = dimension or dimension_of(group_key)
    group = groups_of(dimension)[group_key]
    if "parts" in group:
        return list(group["parts"])
    return [group["category"]]


def summable(group_keys: list[str]) -> bool:
    """Whether these groups may be added together.

    Two ways a sum goes wrong, and both look perfectly reasonable in a chart:
    adding a nested group to the siblings it sits inside (net worth's top 0.1%
    is already inside its top 1%), and adding groups from different dimensions,
    which are separate cuts of the *same* households rather than separate
    households. Callers that total anything should ask first.
    """
    if not group_keys:
        return True
    try:
        dimensions = {dimension_of(key) for key in group_keys}
    except KeyError:
        return False
    if len(dimensions) > 1:
        return False
    groups = groups_of(dimensions.pop())
    return not any(groups[key].get("nested") for key in group_keys)


def parse_period(period: str) -> str:
    """Convert the file's ``1989:Q3`` into the ISO quarter start we store."""
    year, quarter = period.split(":")
    month = (int(quarter.lstrip("Qq")) - 1) * 3 + 1
    return f"{int(year):04d}-{month:02d}-01"
