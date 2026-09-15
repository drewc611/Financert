"""Leverage, concentration and liquidity -- the three single-number
descriptions of a tier's balance sheet (BACKLOG F24, F34, F35).

Unit tests use synthetic rows so the expected value is arithmetic rather than
whatever the Fed happens to have published; the ones at the end assert the
properties that must hold against the real committed snapshot.
"""

import pytest

from app.services import benchmarks


def _row(assets=1_000.0, liabilities=250.0):
    return {"total_assets": assets, "total_liabilities": liabilities, "net_worth": assets - liabilities}


def test_leverage_is_liabilities_over_assets():
    m = benchmarks.shape_metrics(_row(assets=1_000.0, liabilities=250.0), {"deposits": 1.0})
    assert m["leverage"] == pytest.approx(0.25)


def test_leverage_ignores_the_investable_only_subtotal():
    """Liabilities are owed against the whole balance sheet. Dividing them by
    an investable-only subtotal would overstate leverage for every tier, so the
    weights passed in must not affect it."""
    row = _row(assets=1_000.0, liabilities=250.0)
    whole = benchmarks.shape_metrics(row, {"deposits": 0.5, "consumer_durables": 0.5})
    investable = benchmarks.shape_metrics(row, {"deposits": 1.0})
    assert whole["leverage"] == investable["leverage"] == pytest.approx(0.25)


def test_leverage_is_none_not_zero_when_there_are_no_assets():
    """0.0 would read as "this tier has no debt". The truth is "no answer"."""
    assert benchmarks.shape_metrics(_row(assets=0.0, liabilities=10.0), {"deposits": 1.0})["leverage"] is None


def test_leverage_can_exceed_one():
    """Underwater is a real state, not an error to clamp away."""
    assert benchmarks.shape_metrics(_row(assets=100.0, liabilities=150.0), {"deposits": 1.0})["leverage"] == 1.5


def test_concentration_reports_the_largest_share_and_names_it():
    m = benchmarks.shape_metrics(_row(), {"corporate_equities": 0.6, "deposits": 0.3, "real_estate": 0.1})
    assert m["concentration"] == pytest.approx(0.6)
    assert m["concentration_class"] == "corporate_equities"


def test_liquidity_sums_only_the_classes_flagged_liquid():
    """corporate_equities, deposits, money_market and debt_securities carry
    liquid=True in the taxonomy; real_estate and private_business do not."""
    m = benchmarks.shape_metrics(
        _row(), {"corporate_equities": 0.4, "deposits": 0.1, "real_estate": 0.4, "private_business": 0.1}
    )
    assert m["liquidity"] == pytest.approx(0.5)


def test_metrics_are_none_when_there_are_no_weights():
    m = benchmarks.shape_metrics(_row(), {})
    assert m["concentration"] is None
    assert m["concentration_class"] is None
    assert m["liquidity"] is None


# --------------------------------------------------------- against real data


def test_every_group_gets_metrics_in_the_real_snapshot():
    period = benchmarks.latest_complete_period()
    for alloc in benchmarks.all_allocations(period, investable_only=True):
        m = alloc["metrics"]
        assert 0.0 <= m["concentration"] <= 1.0, alloc["group"]
        assert 0.0 <= m["liquidity"] <= 1.0, alloc["group"]
        assert m["leverage"] is not None and m["leverage"] >= 0.0, alloc["group"]
        assert m["concentration_class"] in alloc["weights"], alloc["group"]


def test_concentration_follows_the_investable_only_switch():
    """It describes the chart in front of the user, so dropping consumer
    durables and the residual has to be able to change the answer."""
    period = benchmarks.latest_complete_period()
    whole = benchmarks.allocation("bottom50", period, investable_only=False)
    investable = benchmarks.allocation("bottom50", period, investable_only=True)
    assert whole["metrics"]["concentration"] != investable["metrics"]["concentration"]
    # ...while leverage, keyed off the untouched row totals, must not move.
    assert whole["metrics"]["leverage"] == investable["metrics"]["leverage"]


def test_the_top_tier_is_less_levered_than_the_bottom_one():
    """A sanity check on the sign of the whole thing: if this ever inverts,
    either the Fed's data or our reading of it has changed."""
    period = benchmarks.latest_complete_period()
    top = benchmarks.allocation("top1", period)["metrics"]["leverage"]
    bottom = benchmarks.allocation("bottom50", period)["metrics"]["leverage"]
    assert top < bottom


def test_metrics_are_served_by_the_api(client):
    body = client.get("/api/benchmarks?investable_only=true").json()
    for alloc in body["allocations"]:
        assert set(alloc["metrics"]) == {"leverage", "concentration", "concentration_class", "liquidity"}
