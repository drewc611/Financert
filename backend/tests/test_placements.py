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


# ------------------------------------------- the debt side (F25, F27)

MORTGAGE_HEAVY = {"home_mortgages": 400_000}
CARDS_ONLY = {"consumer_credit": 25_000}


def test_debt_placement_is_absent_until_there_is_debt():
    """A portfolio with no debt side has no answer here, which is not the same
    as owing like nobody."""
    assert allocation.placements(EQUITY_HEAVY)["debt_placements"] == []
    assert allocation.placements(EQUITY_HEAVY, debts={"home_mortgages": 0})["debt_placements"] == []


def test_debt_placement_covers_every_axis():
    result = allocation.placements(EQUITY_HEAVY, debts=MORTGAGE_HEAVY)
    assert [p["dimension"] for p in result["debt_placements"]] == AXES
    assert result["total_debt"] == 400_000


def test_what_you_owe_places_differently_from_what_you_hold():
    """The point of F27: a household can hold assets like one tier and owe like
    another. Card debt is the bottom 50%'s shape; margin and policy loans are
    the top 1%'s."""
    assert allocation.nearest_debt_tier(CARDS_ONLY, benchmarks.latest_period())["nearest"] == "bottom50"
    assert allocation.nearest_debt_tier({"other_loans": 300_000}, benchmarks.latest_period())["nearest"] == "top1"


def test_the_endpoint_carries_debts_through(client):
    body = {
        "name": "test",
        "holdings": [{"asset_class": k, "value": v} for k, v in EQUITY_HEAVY.items()],
        "debts": [{"liability_class": k, "value": v} for k, v in CARDS_ONLY.items()],
    }
    response = client.post("/api/analysis/placements", json=body).json()
    assert {p["dimension"] for p in response["debt_placements"]} == set(AXES)
    assert response["total_debt"] == 25_000


def test_an_unknown_liability_class_is_rejected(client):
    body = {"name": "test", "holdings": [], "debts": [{"liability_class": "payday_loan", "value": 1}]}
    assert client.post("/api/analysis/placements", json=body).status_code == 422


def test_a_portfolio_round_trips_its_debts_and_states_its_net_worth(client):
    body = {
        "name": "with debt",
        "holdings": [{"asset_class": "corporate_equities", "value": 500_000}],
        "debts": [{"liability_class": "home_mortgages", "value": 200_000}],
    }
    saved = client.put("/api/portfolio?slug=debtor", json=body).json()
    assert saved["total_debt"] == 200_000
    assert saved["net_worth"] == 300_000

    read_back = client.get("/api/portfolio?slug=debtor").json()
    assert read_back["debts"] == [{"liability_class": "home_mortgages", "value": 200_000}]

    # A replace drops the debt side too, or "I paid it off" would be unsayable.
    cleared = client.put("/api/portfolio?slug=debtor", json={**body, "debts": []}).json()
    assert cleared["debts"] == []
    assert cleared["net_worth"] == 500_000
