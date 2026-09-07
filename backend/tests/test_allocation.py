"""Unit tests for the allocation maths."""

import pytest

from app.constants import GAP_TOLERANCE_PP
from app.services import allocation


def test_portfolio_weights_normalise_to_one():
    w = allocation.portfolio_weights({"corporate_equities": 75_000, "deposits": 25_000})
    assert w == pytest.approx({"corporate_equities": 0.75, "deposits": 0.25})
    assert sum(w.values()) == pytest.approx(1.0)


def test_portfolio_weights_ignore_zero_and_empty():
    assert allocation.portfolio_weights({}) == {}
    assert allocation.portfolio_weights({"deposits": 0}) == {}
    w = allocation.portfolio_weights({"deposits": 100, "bonds_x": 0})
    assert w == {"deposits": 1.0}


def test_cosine_similarity_bounds():
    a = {"corporate_equities": 0.6, "real_estate": 0.4}
    assert allocation.cosine_similarity(a, a) == pytest.approx(1.0)
    # Disjoint allocations share no direction at all.
    assert allocation.cosine_similarity({"a": 1.0}, {"b": 1.0}) == 0.0
    assert allocation.cosine_similarity({}, a) == 0.0


def test_gaps_classify_relative_to_tolerance():
    user = {"corporate_equities": 0.60, "deposits": 0.40}
    bench = {"corporate_equities": 0.40, "deposits": 0.40}
    rows = {r["asset_class"]: r for r in allocation.gaps(user, bench)}

    assert rows["corporate_equities"]["status"] == "overweight"
    assert rows["corporate_equities"]["gap_pp"] == pytest.approx(20.0)
    assert rows["deposits"]["status"] == "in_line"


def test_gaps_sorted_by_absolute_size():
    user = {"a": 0.50, "b": 0.30, "c": 0.20}
    bench = {"a": 0.45, "b": 0.05, "c": 0.50}
    rows = allocation.gaps(user, bench)
    sizes = [abs(r["gap_pp"]) for r in rows]
    assert sizes == sorted(sizes, reverse=True)


def test_gap_exactly_at_tolerance_is_in_line():
    user = {"a": (40 + GAP_TOLERANCE_PP) / 100, "b": 1 - (40 + GAP_TOLERANCE_PP) / 100}
    bench = {"a": 0.40, "b": 0.60}
    rows = {r["asset_class"]: r for r in allocation.gaps(user, bench)}
    assert rows["a"]["status"] == "in_line"


def test_missing_class_counts_as_fully_underweight():
    rows = {r["asset_class"]: r for r in allocation.gaps({"a": 1.0}, {"a": 0.7, "b": 0.3})}
    assert rows["b"]["user_pct"] == 0.0
    assert rows["b"]["status"] == "underweight"


def test_analyse_against_real_snapshot():
    result = allocation.analyse({"corporate_equities": 60_000, "deposits": 40_000}, group="top1", period="complete")
    assert result["benchmark_group"] == "top1"
    assert result["portfolio_total"] == pytest.approx(100_000)
    assert 0.0 <= result["similarity"] <= 1.0
    assert result["nearest_tier"]["nearest"] in {
        "top1",
        "next9",
        "next40",
        "bottom50",
    }
    # Benchmark weights are a distribution over the taxonomy (see the rounding
    # note in test_can_compare_against_the_nested_group).
    assert sum(result["benchmark_weights"].values()) == pytest.approx(1.0, abs=1e-5)


def test_analyse_empty_portfolio_is_safe():
    result = allocation.analyse({}, group="top1")
    assert result["gaps"] == []
    assert result["similarity"] == 0.0
    assert result["nearest_tier"] is None


def test_investable_view_excludes_durables_from_both_sides():
    """A car must not show up as an overweight against a benchmark that has
    already dropped cars -- the comparison has to be like-for-like."""
    holdings = {"corporate_equities": 70_000, "consumer_durables": 30_000}

    investable = allocation.analyse(holdings, group="top1", investable_only=True)
    keys = {g["asset_class"] for g in investable["gaps"]}
    assert "consumer_durables" not in keys
    assert investable["portfolio_total"] == pytest.approx(70_000)
    assert investable["excluded_value"] == pytest.approx(30_000)
    assert investable["user_weights"]["corporate_equities"] == pytest.approx(1.0)

    full = allocation.analyse(holdings, group="top1", investable_only=False)
    assert full["portfolio_total"] == pytest.approx(100_000)
    assert full["excluded_value"] == pytest.approx(0.0)
    assert {g["asset_class"] for g in full["gaps"]} >= {"consumer_durables"}


def test_investable_view_drops_consumer_durables():
    full = allocation.analyse({"corporate_equities": 100}, group="top1", period="complete", investable_only=False)
    investable = allocation.analyse({"corporate_equities": 100}, group="top1", period="complete", investable_only=True)
    assert full["benchmark_weights"]["consumer_durables"] > 0
    assert "consumer_durables" not in investable["benchmark_weights"]
    # The residual is only safe to drop in a fully published quarter.
    assert "unallocated" not in investable["benchmark_weights"]


def test_every_quarter_is_complete():
    """The bulk DFA file publishes every asset class for every quarter. The
    earlier FRED path lagged private business equity by six quarters, which is
    what the incomplete-quarter machinery was built for."""
    latest = allocation.analyse({"corporate_equities": 100}, group="top1", period="latest")
    complete = allocation.analyse({"corporate_equities": 100}, group="top1", period="complete")

    assert latest["period_complete"] is True
    assert latest["period_unavailable"] == []
    assert latest["period"] == complete["period"]
    assert latest["benchmark_weights"]["private_business"] > 0


def test_residual_is_rounding_only():
    """With the full column set the taxonomy covers every component, so the
    unallocated residual should be negligible rather than the 1-3% the FRED
    taxonomy left unexplained."""
    result = allocation.analyse({"corporate_equities": 100}, group="top1", investable_only=False)
    assert result["benchmark_weights"].get("unallocated", 0.0) < 0.0005


def test_nearest_tier_excludes_the_nested_group():
    """The top 0.1% sits inside the top 1%; ranking them together would mix
    two overlapping populations."""
    result = allocation.analyse({"corporate_equities": 90, "deposits": 10}, group="top1")
    ranked = {r["group"] for r in result["nearest_tier"]["ranked"]}
    assert ranked == {"top1", "next9", "next40", "bottom50"}
    assert "top01" not in ranked


def test_can_compare_against_the_nested_group():
    """Even though it is excluded from ranking, it is a valid benchmark."""
    result = allocation.analyse({"corporate_equities": 100}, group="top01", period="complete")
    assert result["benchmark_group"] == "top01"
    assert result["benchmark_label"] == "Top 0.1%"
    # The payload rounds each weight to 6dp, so the sum of 13 classes can drift
    # by a few parts per million. The unrounded weights sum to exactly 1.
    assert sum(result["benchmark_weights"].values()) == pytest.approx(1.0, abs=1e-5)
