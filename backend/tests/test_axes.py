"""The five new dimensions (BACKLOG F11-F15), end to end through the API.

The registry (F17) made these data rather than code, so what is worth testing
is not five near-identical code paths but the properties that have to hold for
every axis at once -- and the couple of places where net worth is genuinely
different from the rest.
"""

import pytest

from app import constants
from app.services import benchmarks

AXES = ["networth", "generation", "education", "income", "race", "age"]
NEW_AXES = [a for a in AXES if a != "networth"]


def test_the_snapshot_carries_every_dimension():
    assert sorted(benchmarks.dimension_names()) == sorted(AXES)


@pytest.mark.parametrize("dimension", AXES)
def test_every_group_has_the_full_history(dimension):
    groups = benchmarks.groups_in(dimension)
    assert groups, dimension
    expected = len(benchmarks.periods())
    for key, group in groups.items():
        assert len(group["history"]) == expected, f"{dimension}.{key}"


@pytest.mark.parametrize("dimension", AXES)
def test_weights_sum_to_one_for_every_group(dimension):
    """The reconciliation in fetch_dfa already proves the taxonomy covers the
    Fed's published total. This proves the read side renormalises cleanly."""
    period = benchmarks.latest_complete_period()
    for key in benchmarks.groups_in(dimension):
        w = benchmarks.weights(key, period, investable_only=True, dimension=dimension)
        assert sum(w.values()) == pytest.approx(1.0), f"{dimension}.{key}"


@pytest.mark.parametrize("dimension", NEW_AXES)
def test_the_new_axes_have_no_percentile_range(dimension):
    """Only a cut defined by percentile has one. Emitting a made-up range for
    "Baby Boom" would be inventing a fact the source does not carry."""
    period = benchmarks.latest_complete_period()
    for alloc in benchmarks.all_allocations(period, dimension=dimension):
        assert alloc["percentile_range"] is None, f"{dimension}.{alloc['group']}"


def test_net_worth_still_has_its_percentile_ranges():
    period = benchmarks.latest_complete_period()
    for alloc in benchmarks.all_allocations(period, dimension="networth"):
        assert alloc["percentile_range"], alloc["group"]


@pytest.mark.parametrize("dimension", AXES)
def test_each_axis_partitions_the_population_on_its_own(dimension):
    """Summing the non-nested groups of one axis should land on roughly the
    same national total whichever axis you pick -- they are six cuts of the
    same households. A cut that is short is a missing group."""
    period = benchmarks.latest_complete_period()
    order = benchmarks.dimensions()[dimension]["group_order"]
    total = sum(benchmarks.allocation(key, period, dimension=dimension)["total_assets"] for key in order)
    national = sum(
        benchmarks.allocation(key, period, dimension="networth")["total_assets"]
        for key in benchmarks.dimensions()["networth"]["group_order"]
    )
    assert total == pytest.approx(national, rel=0.01), f"{dimension} sums to {total:,.0f} vs {national:,.0f}"


def _cutoffs(group: str, dimension: str, field: str) -> list[tuple[str, float]]:
    history = benchmarks.groups_in(dimension)[group]["history"]
    return [(r["period"], r[field]) for r in history if r.get(field) is not None]


def test_the_minimum_wealth_cutoff_is_stored_where_published(client):
    """F6: the column was read and then dropped, which is what made "what net
    worth puts you in the top 1%?" unanswerable from the snapshot.

    It comes from the triennial Survey of Consumer Finances, so it exists for
    12 of the 147 quarters and not for the most recent one. Asserting on the
    latest period would be asserting the source works differently than it does.
    """
    populated = _cutoffs("top1", "networth", "minimum_wealth_cutoff")
    assert len(populated) == 12
    assert all(value > 0 for _, value in populated)
    assert populated == sorted(populated), "cutoffs should be in period order"


def test_a_composite_group_takes_its_lowest_part_not_their_sum():
    """The top 1% is TopPt1 + RemainingTop1. A floor is not additive: the
    combined band begins where its lowest constituent begins, so summing the
    two would claim a threshold roughly five times the real one."""
    period, top1 = _cutoffs("top1", "networth", "minimum_wealth_cutoff")[-1]
    _, top01 = next((p, v) for p, v in _cutoffs("top01", "networth", "minimum_wealth_cutoff") if p == period)
    assert top1 < top01, "the top 1% floor must sit below the top 0.1% floor"


def test_the_bottom_group_has_no_floor():
    """There is nothing below the bottom 50%, so the file publishes no cutoff.
    Storing 0.0 would read as "no wealth required", which is a different and
    false claim."""
    assert _cutoffs("bottom50", "networth", "minimum_wealth_cutoff") == []


def test_the_entry_threshold_reads_back_to_the_newest_published_one():
    """F28: the cutoffs are triennial, so the latest quarter never carries one.
    A threshold visible only on the quarters that have it would be invisible in
    every view the product actually shows."""
    latest = benchmarks.latest_period()
    resolved = benchmarks.threshold("top1", latest)
    assert resolved["period"] < latest
    assert resolved["field"] == "minimum_wealth_cutoff"
    # ...and it is the newest published one, not merely some earlier one.
    assert (resolved["period"], resolved["value"]) == _cutoffs("top1", "networth", "minimum_wealth_cutoff")[-1]


def test_asking_about_an_older_period_gets_that_era_s_threshold():
    """Otherwise every historical view would date its thresholds to today."""
    then = benchmarks.threshold("top1", "2005-01-01")
    now = benchmarks.threshold("top1", benchmarks.latest_period())
    assert then["period"] < now["period"]
    assert then["value"] < now["value"]


def test_the_thresholds_rank_the_way_the_tiers_do():
    period = benchmarks.latest_period()
    values = [benchmarks.threshold(g, period)["value"] for g in ["next40", "next9", "top1", "top01"]]
    assert values == sorted(values)


def test_the_bottom_tier_has_no_threshold_to_resolve():
    assert benchmarks.threshold("bottom50", benchmarks.latest_period()) is None


@pytest.mark.parametrize("dimension", ["generation", "education", "race", "age"])
def test_an_axis_with_no_cutoff_column_has_no_threshold(dimension):
    period = benchmarks.latest_period()
    for alloc in benchmarks.all_allocations(period, dimension=dimension):
        assert alloc["threshold"] is None, alloc["group"]


def test_only_the_income_axis_carries_income_cutoffs():
    assert _cutoffs("pct99to100", "income", "minimum_income_cutoff")
    period = benchmarks.latest_complete_period()
    generation = benchmarks._entry("boomer", period, "generation")
    assert "minimum_income_cutoff" not in generation
    assert "minimum_wealth_cutoff" not in generation


# ------------------------------------------------------------------- the API


@pytest.mark.parametrize("dimension", AXES)
def test_the_api_serves_every_dimension(client, dimension):
    body = client.get(f"/api/benchmarks?dimension={dimension}").json()
    assert body["dimension"] == dimension
    served = {a["group"] for a in body["allocations"]}
    assert served == set(constants.all_group_keys(dimension))


def test_the_api_defaults_to_net_worth(client):
    body = client.get("/api/benchmarks").json()
    assert body["dimension"] == "networth"
    assert body["group_order"] == constants.GROUP_ORDER


def test_the_api_offers_the_axes_for_a_picker(client):
    body = client.get("/api/benchmarks").json()
    assert {d["key"] for d in body["dimensions"]} == set(AXES)
    for entry in body["dimensions"]:
        assert entry["label"] and entry["group_order"]


def test_the_api_serves_the_threshold_with_its_own_date(client):
    body = client.get("/api/benchmarks").json()
    by_group = {a["group"]: a["threshold"] for a in body["allocations"]}
    assert by_group["bottom50"] is None
    assert by_group["top1"]["value"] > 0
    # The whole point: it is dated separately from the allocation it sits on.
    assert by_group["top1"]["period"] != body["period"]


def test_the_income_axis_serves_income_thresholds(client):
    body = client.get("/api/benchmarks?dimension=income").json()
    assert {a["threshold"]["field"] for a in body["allocations"]} == {"minimum_income_cutoff"}


def test_an_unknown_dimension_is_404_not_a_silent_default(client):
    assert client.get("/api/benchmarks?dimension=astrology").status_code == 404


def test_the_trend_endpoint_resolves_the_dimension_from_the_group(client):
    body = client.get("/api/benchmarks/trend?group=millennial&asset_class=real_estate").json()
    assert body["dimension"] == "generation"
    assert body["points"]


def test_an_unknown_group_is_still_404(client):
    assert client.get("/api/benchmarks/trend?group=nope&asset_class=real_estate").status_code == 404


def test_every_group_carries_a_household_count(client):
    """F29: the counts are what turn a share of $40 trillion into a figure with
    a household behind it. Every group of every axis has one, and they sum to
    roughly the national total on each axis independently."""
    national = None
    for dimension in AXES:
        body = client.get(f"/api/benchmarks?dimension={dimension}").json()
        counts = {a["group"]: a["household_count"] for a in body["allocations"]}
        assert all(v and v > 0 for v in counts.values()), dimension
        total = sum(counts[g] for g in body["group_order"])
        if national is None:
            national = total
        assert total == pytest.approx(national, rel=0.01), f"{dimension}: {total:,.0f} vs {national:,.0f}"
    assert 100e6 < national < 200e6, f"{national:,.0f} US households is not a plausible number"


def test_the_nested_tier_is_counted_inside_its_parent_not_beside_it():
    """The top 0.1%'s households are already in the top 1%'s count, which is
    why group_order excludes it from the sum above."""
    period = benchmarks.latest_period()
    top01 = benchmarks.allocation("top01", period)["household_count"]
    top1 = benchmarks.allocation("top1", period)["household_count"]
    assert 0 < top01 < top1


# ---------------------------------------------------- the other side (F26)


@pytest.mark.parametrize("dimension", AXES)
def test_the_debt_leaves_sum_to_the_published_liability_total(dimension):
    """The file publishes liabilities as a tree -- Liabilities = loans +
    deferred premiums, loans = four columns -- so reading a parent alongside
    its children would double count exactly the way the asset side could."""
    period = benchmarks.latest_period()
    for key in benchmarks.groups_in(dimension):
        row = benchmarks._entry(key, period, dimension)
        assert sum(row["liabilities"].values()) == pytest.approx(row["total_liabilities"], rel=0.005), (
            f"{dimension}.{key}"
        )


def test_debt_shares_sum_to_one_for_every_group():
    period = benchmarks.latest_period()
    for key in benchmarks.groups_in("networth"):
        shares = benchmarks.debt_weights(key, period)
        assert sum(shares.values()) == pytest.approx(1.0), key


def test_the_debt_mix_is_not_the_same_in_every_tier():
    """A breakdown that reads the same everywhere would not be worth showing.
    The bottom 50% carries far more of its debt as consumer credit than the
    tiers above it."""
    period = benchmarks.latest_period()
    bottom = benchmarks.debt_weights("bottom50", period)
    next40 = benchmarks.debt_weights("next40", period)
    assert bottom["consumer_credit"] > next40["consumer_credit"] * 1.5


def test_the_api_serves_the_debt_mix_and_its_taxonomy(client):
    body = client.get("/api/benchmarks").json()
    keys = {c["key"] for c in body["liability_classes"]}
    assert keys == set(constants.LIABILITY_CLASS_KEYS)
    for alloc in body["allocations"]:
        assert set(alloc["debt_weights"]) <= keys, alloc["group"]
        assert sum(alloc["debt_weights"].values()) == pytest.approx(1.0), alloc["group"]


def test_the_reconciliation_endpoint_publishes_the_residual(client):
    """F41: every percentage this product shows is a share of the Fed's own
    published total, and this is the part the taxonomy does not name. It is
    published so the claim that it is ~zero can be checked."""
    body = client.get("/api/benchmarks/reconciliation").json()
    assert body["dimension"] == "networth"
    assert len(body["periods"]) == len(benchmarks.periods())
    assert body["worst_ever"] < 0.0002, f"residual reached {body['worst_ever']:.6%}"
    row = body["periods"][-1]
    assert set(row["residuals"]) == set(constants.all_group_keys("networth"))
    assert row["worst"] == max(row["residuals"].values())


@pytest.mark.parametrize("dimension", AXES)
def test_the_residual_is_rounding_on_every_axis(client, dimension):
    body = client.get(f"/api/benchmarks/reconciliation?dimension={dimension}").json()
    assert body["worst_ever"] < 0.0002, f"{dimension} residual reached {body['worst_ever']:.6%}"


def test_an_unknown_dimension_has_no_reconciliation(client):
    assert client.get("/api/benchmarks/reconciliation?dimension=astrology").status_code == 404
