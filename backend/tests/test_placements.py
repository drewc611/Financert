"""One portfolio read against all six axes at once (BACKLOG F19)."""

import pytest

from app.services import allocation, benchmarks

# Deliberately lopsided: a mix that is all equities should not land in the same
# place on every axis, or the feature is saying nothing.
EQUITY_HEAVY = {"corporate_equities": 900_000, "deposits": 100_000}
PROPERTY_HEAVY = {"real_estate": 800_000, "deposits": 200_000}

AXES = ["networth", "generation", "education", "income", "race", "age"]


def _body(holdings):
    return {"name": "test", "holdings": [{"asset_class": k, "value": v} for k, v in holdings.items()]}


def test_every_axis_is_placed():
    result = allocation.placements(EQUITY_HEAVY)
    assert [p["dimension"] for p in result["placements"]] == AXES


def test_each_placement_ranks_that_axis_and_nothing_else():
    """The ranking has to stay inside one axis. Mixing them would rank groups
    from different cuts of the same households against each other, which is
    the error constants.summable() exists to refuse elsewhere.

    Compared as a set because the ranking is ordered by similarity; that it is
    sorted at all is the next test's business."""
    for placement in allocation.placements(EQUITY_HEAVY)["placements"]:
        ranked = {row["group"] for row in placement["ranked"]}
        assert ranked == set(benchmarks.dimensions()[placement["dimension"]]["group_order"]), placement["dimension"]
        assert placement["nearest"] in ranked


def test_the_nearest_group_is_the_highest_ranked_one():
    for placement in allocation.placements(PROPERTY_HEAVY)["placements"]:
        best = max(placement["ranked"], key=lambda r: r["similarity"])
        assert placement["nearest"] == best["group"]
        assert placement["similarity"] == best["similarity"]


def test_two_different_mixes_do_not_land_in_the_same_place():
    """A placement that never moves is a placement that says nothing."""
    equities = {p["dimension"]: p["nearest"] for p in allocation.placements(EQUITY_HEAVY)["placements"]}
    property_ = {p["dimension"]: p["nearest"] for p in allocation.placements(PROPERTY_HEAVY)["placements"]}
    assert equities != property_


def test_an_empty_portfolio_places_nowhere():
    """No holdings is not the same answer as "least like everyone"."""
    result = allocation.placements({})
    assert result["placements"] == []
    assert result["portfolio_total"] == 0.0


def test_the_investable_filter_applies_to_the_user_side_too():
    """A car is not an allocation decision, and the benchmark drops it too --
    so including one must not change where the rest of the mix lands."""
    with_car = {**EQUITY_HEAVY, "consumer_durables": 40_000}
    a = allocation.placements(EQUITY_HEAVY)["placements"]
    b = allocation.placements(with_car)["placements"]
    assert [p["nearest"] for p in a] == [p["nearest"] for p in b]
    assert allocation.placements(with_car)["portfolio_total"] == sum(EQUITY_HEAVY.values())


# ------------------------------------------------------------------- the API


def test_the_endpoint_places_a_portfolio_that_was_never_saved(client):
    body = client.post("/api/analysis/placements", json=_body(EQUITY_HEAVY)).json()
    assert {p["dimension"] for p in body["placements"]} == set(AXES)
    assert body["period"] == benchmarks.latest_period()
    for placement in body["placements"]:
        assert placement["label"] and placement["nearest_label"]
        assert 0.0 <= placement["similarity"] <= 1.0


def test_the_endpoint_rejects_an_unknown_asset_class(client):
    body = {"name": "test", "holdings": [{"asset_class": "crypto", "value": 1}]}
    assert client.post("/api/analysis/placements", json=body).status_code == 422


def test_an_unknown_period_is_404(client):
    response = client.post("/api/analysis/placements?period=1789-01-01", json=_body(EQUITY_HEAVY))
    assert response.status_code == 404


# -------------------------------------------------- analysing off net worth


def test_analysis_resolves_the_axis_from_the_group(client):
    """Comparing against "millennial" used to 404 at the router, and would have
    read the net-worth file if it had not: every group key is unique, so the
    caller never has to name the axis."""
    body = client.post("/api/analysis/preview?group=millennial", json=_body(EQUITY_HEAVY)).json()
    assert body["benchmark_dimension"] == "generation"
    assert body["benchmark_group"] == "millennial"
    assert body["benchmark_weights"]


def test_the_nearest_tier_stays_on_the_compared_axis(client):
    body = client.post("/api/analysis/preview?group=college", json=_body(EQUITY_HEAVY)).json()
    ranked = {row["group"] for row in body["nearest_tier"]["ranked"]}
    assert ranked == set(benchmarks.dimensions()["education"]["group_order"])


@pytest.mark.parametrize("group", ["astrology", "", "top1x"])
def test_an_unknown_group_is_still_404(client, group):
    assert client.post(f"/api/analysis/preview?group={group}", json=_body(EQUITY_HEAVY)).status_code == 404
