"""End-to-end tests against the HTTP contract."""

import pytest

SAMPLE = {
    "name": "Test portfolio",
    "holdings": [
        {"asset_class": "corporate_equities", "value": 120_000},
        {"asset_class": "deposits", "value": 30_000},
        {"asset_class": "real_estate", "value": 350_000},
    ],
}


def test_healthz_reports_snapshot(client):
    body = client.get("/healthz").json()
    assert body["status"] == "ok"
    assert body["snapshot_loaded"] is True
    assert body["latest_period"]


def test_benchmarks_returns_every_tier(client):
    body = client.get("/api/benchmarks").json()
    groups = [a["group"] for a in body["allocations"]]
    assert groups == ["top01", "top1", "next9", "next40", "bottom50"]
    assert body["source"]["publisher"].startswith("Board of Governors")
    for alloc in body["allocations"]:
        assert sum(alloc["weights"].values()) == pytest.approx(1.0, abs=1e-6)


def test_nested_tier_is_flagged_and_excluded_from_group_order(client):
    """The top 0.1% must not read as a fifth slice of the population."""
    body = client.get("/api/benchmarks").json()
    by_group = {a["group"]: a for a in body["allocations"]}
    assert by_group["top01"]["nested"] is True
    assert by_group["top01"]["nested_in"] == "top1"
    assert by_group["top1"]["nested"] is False
    # group_order is the partition; it excludes the nested tier.
    assert body["group_order"] == ["top1", "next9", "next40", "bottom50"]


def test_top01_is_more_concentrated_than_top1(client):
    """The whole point of the finer tier: it sharpens the same story."""
    body = client.get("/api/benchmarks", params={"period": "complete"}).json()
    by_group = {a["group"]: a["weights"] for a in body["allocations"]}
    assert by_group["top01"]["corporate_equities"] > by_group["top1"]["corporate_equities"]
    assert by_group["top01"]["private_business"] > by_group["top1"]["private_business"]
    assert by_group["top01"]["real_estate"] < by_group["top1"]["real_estate"]


def test_latest_period_is_current_but_flagged_incomplete(client):
    body = client.get("/api/benchmarks").json()
    assert body["period"] == body["latest_period"]
    assert body["latest_period"] > body["latest_complete_period"]
    top1 = next(a for a in body["allocations"] if a["group"] == "top1")
    assert top1["complete"] is False
    assert "private_business" in top1["unavailable"]


def test_complete_period_has_every_class(client):
    body = client.get("/api/benchmarks", params={"period": "complete"}).json()
    assert body["period"] == body["latest_complete_period"]
    for alloc in body["allocations"]:
        assert alloc["complete"] is True
        assert alloc["unavailable"] == []
        assert "private_business" in alloc["weights"]


def test_benchmarks_investable_flag_changes_taxonomy(client):
    full = client.get("/api/benchmarks", params={"investable_only": False}).json()
    lean = client.get("/api/benchmarks", params={"investable_only": True}).json()
    assert "consumer_durables" in full["allocations"][0]["weights"]
    assert "consumer_durables" not in lean["allocations"][0]["weights"]


def test_benchmarks_rejects_unknown_period(client):
    assert client.get("/api/benchmarks", params={"period": "1776-01-01"}).status_code == 404


def test_top1_holds_more_equity_than_bottom50(client):
    """The headline claim the product is built on, asserted against real data."""
    body = client.get("/api/benchmarks", params={"period": "complete"}).json()
    by_group = {a["group"]: a["weights"] for a in body["allocations"]}
    assert by_group["top1"]["corporate_equities"] > by_group["bottom50"]["corporate_equities"]
    assert by_group["top1"]["private_business"] > by_group["bottom50"]["private_business"]
    # ...and the bottom half's wealth is far more concentrated in their home.
    assert by_group["bottom50"]["real_estate"] > by_group["top1"]["real_estate"]


def test_trend_omits_unpublished_quarters(client):
    """A lagging class ends its line early rather than dropping to zero."""
    equities = client.get("/api/benchmarks/trend", params={"group": "top1", "asset_class": "corporate_equities"}).json()
    business = client.get("/api/benchmarks/trend", params={"group": "top1", "asset_class": "private_business"}).json()
    assert len(business["points"]) < len(equities["points"])
    assert all(p["share"] > 0 for p in business["points"])


def test_trend_returns_full_history(client):
    body = client.get(
        "/api/benchmarks/trend",
        params={"group": "top1", "asset_class": "corporate_equities"},
    ).json()
    assert len(body["points"]) > 100
    assert all(0.0 <= p["share"] <= 1.0 for p in body["points"])


def test_trend_rejects_unknown_inputs(client):
    assert client.get("/api/benchmarks/trend", params={"group": "nope", "asset_class": "deposits"}).status_code == 404
    assert client.get("/api/benchmarks/trend", params={"group": "top1", "asset_class": "nope"}).status_code == 404


def test_portfolio_roundtrip(client):
    assert client.get("/api/portfolio").status_code == 404

    created = client.put("/api/portfolio", json=SAMPLE)
    assert created.status_code == 200
    assert created.json()["total_value"] == pytest.approx(500_000)

    fetched = client.get("/api/portfolio").json()
    assert {h["asset_class"] for h in fetched["holdings"]} == {
        "corporate_equities",
        "deposits",
        "real_estate",
    }


def test_put_replaces_rather_than_merges(client):
    client.put("/api/portfolio", json=SAMPLE)
    client.put(
        "/api/portfolio",
        json={"name": "Simplified", "holdings": [{"asset_class": "deposits", "value": 1_000}]},
    )
    body = client.get("/api/portfolio").json()
    assert len(body["holdings"]) == 1
    assert body["total_value"] == pytest.approx(1_000)


def test_delete_portfolio(client):
    client.put("/api/portfolio", json=SAMPLE)
    assert client.delete("/api/portfolio").status_code == 204
    assert client.get("/api/portfolio").status_code == 404


def test_unknown_asset_class_rejected(client):
    resp = client.put(
        "/api/portfolio",
        json={"name": "Bad", "holdings": [{"asset_class": "crypto", "value": 100}]},
    )
    assert resp.status_code == 422


def test_duplicate_asset_class_rejected(client):
    resp = client.put(
        "/api/portfolio",
        json={
            "name": "Dupe",
            "holdings": [
                {"asset_class": "deposits", "value": 100},
                {"asset_class": "deposits", "value": 200},
            ],
        },
    )
    assert resp.status_code == 422


def test_negative_value_rejected(client):
    resp = client.put(
        "/api/portfolio",
        json={"name": "Neg", "holdings": [{"asset_class": "deposits", "value": -5}]},
    )
    assert resp.status_code == 422


def test_analysis_of_saved_portfolio(client):
    client.put("/api/portfolio", json=SAMPLE)
    body = client.get("/api/analysis", params={"group": "top1"}).json()
    assert body["benchmark_group"] == "top1"
    assert body["gaps"]
    assert body["nearest_tier"]["nearest"] in {"top1", "next9", "next40", "bottom50"}


def test_analysis_requires_a_portfolio(client):
    assert client.get("/api/analysis").status_code == 404


def test_preview_does_not_persist(client):
    body = client.post("/api/analysis/preview", json=SAMPLE).json()
    assert body["portfolio_total"] == pytest.approx(500_000)
    assert client.get("/api/portfolio").status_code == 404


def test_all_equities_portfolio_is_overweight_equities(client):
    body = client.post(
        "/api/analysis/preview",
        json={"name": "x", "holdings": [{"asset_class": "corporate_equities", "value": 100_000}]},
    ).json()
    equities = next(g for g in body["gaps"] if g["asset_class"] == "corporate_equities")
    assert equities["status"] == "overweight"
    assert equities["user_pct"] == pytest.approx(100.0)
