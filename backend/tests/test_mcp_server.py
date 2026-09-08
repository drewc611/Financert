"""Tests for the MCP server.

Two things here are worth more than the rest: that every tool is annotated
read-only on the wire (the most-cited reason directory submissions fail), and
that the portfolio-storage surface is *not* exposed.
"""

import asyncio

import pytest

import mcp_server
from app.constants import ASSET_CLASS_KEYS


def _tools():
    return asyncio.run(mcp_server.mcp.list_tools())


# --- directory-submission requirements -------------------------------------


def test_every_tool_is_annotated_read_only():
    """Anthropic rejects submissions with missing or wrong tool annotations,
    and every tool here really is a pure read."""
    for tool in _tools():
        assert tool.annotations is not None, f"{tool.name} has no annotations"
        assert tool.annotations.read_only_hint is True, f"{tool.name} not marked read-only"
        assert tool.annotations.destructive_hint is False, f"{tool.name} marked destructive"


def test_annotations_serialise_to_spec_camel_case():
    """The MCP spec is camelCase on the wire; the Python model is snake_case.
    A mismatch would make the hints invisible to a reviewing client."""
    dumped = _tools()[0].model_dump(mode="json", by_alias=True, exclude_none=True)
    assert dumped["annotations"]["readOnlyHint"] is True


def test_every_tool_has_a_title_and_description():
    for tool in _tools():
        assert tool.title, f"{tool.name} has no title"
        assert tool.description and len(tool.description) > 30, f"{tool.name} description too thin"


def test_portfolio_storage_is_not_exposed():
    """The stored-portfolio surface stays on the REST API behind its token.
    Exposing it here would mean auth, state, and a data-handling story."""
    names = {t.name for t in _tools()}
    assert not any(n in names for n in ("save_portfolio", "delete_portfolio", "list_portfolios"))
    assert "compare_allocation" in names


def test_instructions_carry_the_not_advice_framing():
    """The server's own instructions have to say this, because the assistant
    reading them is what generates the user-facing wording."""
    text = mcp_server.INSTRUCTIONS.lower()
    assert "not advice" in text
    assert "descriptive" in text


# --- behaviour --------------------------------------------------------------


def test_compare_allocation_returns_gaps_and_nearest_tier():
    result = mcp_server.compare_allocation(
        holdings={"corporate_equities": 60_000, "real_estate": 40_000},
    )
    assert result["gaps"]
    assert result["closest_tier"]["tier"]
    assert 0.0 <= result["closest_tier"]["similarity"] <= 1.0
    assert "not advice" in result["note"].lower()


def test_nested_tier_is_selectable_but_flagged():
    result = mcp_server.get_tier_allocation(tier="top01")
    assert result["nested_inside"] == "top1"

    tiers = mcp_server.list_wealth_tiers()
    assert "top01" not in tiers["partitioning_tiers"]
    assert "top01" in tiers["all_tiers"]
    assert "nested" in tiers["note"].lower()


def test_trend_spans_the_history():
    result = mcp_server.get_asset_class_trend(asset_class="corporate_equities")
    assert result["first"]["period"] < result["latest"]["period"]
    assert len(result["points"]) > 100


def test_data_source_carries_provenance_and_caveat():
    result = mcp_server.get_data_source()
    assert result["publisher"].startswith("Board of Governors")
    assert result["archive_sha256"]
    assert "not investment advice" in result["caveat"].lower()


def test_asset_class_list_excludes_the_residual():
    """`unallocated` is a reconciliation artifact, not something anyone holds."""
    keys = {a["key"] for a in mcp_server.list_asset_classes()}
    assert "unallocated" not in keys
    assert keys == set(ASSET_CLASS_KEYS)


# --- input validation -------------------------------------------------------


def test_unknown_asset_class_names_the_valid_keys():
    with pytest.raises(ValueError, match="unknown asset class"):
        mcp_server.compare_allocation(holdings={"dogecoin": 100})


def test_empty_holdings_rejected():
    with pytest.raises(ValueError, match="empty"):
        mcp_server.compare_allocation(holdings={})


def test_negative_holdings_rejected():
    with pytest.raises(ValueError, match="negative"):
        mcp_server.compare_allocation(holdings={"deposits": -5})


def test_unknown_tier_rejected():
    with pytest.raises(ValueError, match="unknown tier"):
        mcp_server.get_tier_allocation(tier="top5")


def test_unknown_period_names_the_range():
    with pytest.raises(ValueError, match="unknown period"):
        mcp_server.get_tier_allocation(period="1776-01-01")


def test_unknown_trend_asset_class_rejected():
    with pytest.raises(ValueError, match="unknown asset class"):
        mcp_server.get_asset_class_trend(asset_class="nope")


# --- hosting ----------------------------------------------------------------


def test_hosted_origin_also_permits_its_host_header():
    """A platform proxy forwards the *public* domain in `Host`, never the
    address the process bound to. The SDK matches Host exactly, so a deployment
    given only its origin would 421 every request."""
    security = mcp_server.build_security("0.0.0.0", 8080, ["https://financert.example.com"], [])
    assert "financert.example.com" in security.allowed_hosts
    assert security.allowed_origins == ["https://financert.example.com"]


def test_explicit_allowed_host_wins():
    security = mcp_server.build_security("0.0.0.0", 8080, ["https://a.example"], ["b.example"])
    assert security.allowed_hosts == ["b.example"]


def test_protection_is_never_silently_off():
    """Whatever the arguments, the middleware must stay armed -- the whole
    point of the flag is that a hosted server refuses forged origins."""
    for origins, hosts in (([], []), (["https://a.example"], []), ([], ["b.example"])):
        assert mcp_server.build_security("127.0.0.1", 8080, origins, hosts).enable_dns_rebinding_protection


def test_bare_hostname_origin_survives_the_split():
    """A value that isn't a URL (someone passing a hostname) must not silently
    produce an empty host entry that matches nothing."""
    assert mcp_server.hosts_for_origins(["financert.example.com"])[0] == "financert.example.com"


def test_readme_badge_states_the_real_tool_count():
    """The README badge is a static claim about the server. Static claims rot,
    so it is tied to the thing it describes rather than to someone's memory of
    it -- add a seventh tool and this fails until the badge is updated too."""
    import re
    from pathlib import Path

    readme = (Path(__file__).resolve().parents[2] / "README.md").read_text()
    match = re.search(r"MCP-(\d+)%20read--only%20tools", readme)
    assert match, "the MCP tool-count badge is missing from README.md"
    assert int(match.group(1)) == len(_tools())
