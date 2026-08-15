"""Parser tests, run against real bytes from both upstreams.

Both fixtures are genuine documents, not hand-written approximations. That
matters more here than anywhere else in the project: the failure mode these
parsers have is not crashing, it is confidently returning plausible wrong
numbers, and only real source documents catch that.
"""

from datetime import date

import pytest

from app.sources import congress, insiders
from app.sources.base import geometric_midpoint

# --------------------------------------------------------------- congress


def parse(ptr_text: str):
    return congress.parse_ptr_text(
        ptr_text,
        member_name="Mark Alford",
        state_district="MO04",
        doc_id="20034201",
        year=2026,
        filed_on=date(2026, 3, 31),
    )


def test_ptr_extracts_every_row(ptr_text):
    """The filing's table has nine rows; all nine must come through."""
    rows = parse(ptr_text)
    assert len(rows) == 9


def test_ptr_reads_tickers_from_three_different_layouts(ptr_text):
    """Tickers are printed inconsistently: in parentheses, exchange-qualified
    ("NYSEARCA: DIA"), and not at all ("Invesco QQQ")."""
    keys = {row.subject_key for row in parse(ptr_text)}
    assert {"AMZN", "AAPL", "T", "BRK.B"} <= keys, "parenthesised tickers"
    assert "DIA" in keys, "exchange-qualified ticker"
    assert "QQQ" in keys, "ticker inferred from a name with no printed symbol"


def test_ptr_flags_inferred_tickers(ptr_text):
    """A guessed symbol must say so rather than pass as a printed one."""
    by_key = {row.subject_key: row for row in parse(ptr_text)}
    assert by_key["QQQ"].notes and "inferred" in by_key["QQQ"].notes.lower()
    assert by_key["AMZN"].notes is None


def test_ptr_labels_are_asset_names_not_description_text(ptr_text):
    """Regression: the label used to pick up the previous row's free-text
    Description block, so AAPL rendered as '...shares sold @ $253.45/share'."""
    by_key = {row.subject_key: row for row in parse(ptr_text)}
    assert by_key["AAPL"].subject_label == "Apple Inc. - Common Stock (AAPL)"
    assert by_key["AMZN"].subject_label == "Amazon.com, Inc. - Common Stock (AMZN)"
    for row in parse(ptr_text):
        assert "/share" not in row.subject_label
        assert "$" not in row.subject_label


def test_ptr_does_not_invent_rows_from_description_text(ptr_text):
    """Regression: an earlier anchor matched ticker-like text inside the
    Description prose, inventing transactions that were never filed. The
    description here names SPY, SPYD and BRK/B, none of which are table rows."""
    rows = parse(ptr_text)
    assert len(rows) == 9
    # Every row must carry a real bracket and date parsed from the table.
    for row in rows:
        assert row.usd_low is not None and row.usd_high is not None
        assert row.transacted_at == date(2026, 3, 16)
        assert row.direction == -1


def test_ptr_amounts_use_disclosed_bracket(ptr_text):
    row = parse(ptr_text)[0]
    assert (row.usd_low, row.usd_high) == (1_001.0, 15_000.0)
    # Geometric, not arithmetic: brackets span an order of magnitude.
    # sqrt(1001 * 15000) = 3874.92, against an arithmetic mean of 8000.50.
    assert row.usd_estimate == pytest.approx(3874.92, abs=0.1)


def test_geometric_midpoint_sits_below_arithmetic_mean():
    low, high = 1_001.0, 15_000.0
    assert geometric_midpoint(low, high) < (low + high) / 2


def test_ptr_ignores_untracked_asset_classes():
    """Real property and similar holdings must not become market positions."""
    text = "Some Farmland - Iowa (LAND) [RP] P 01/05/202601/20/2026$50,001 - $100,000"
    assert congress.parse_ptr_text(text, member_name="X", state_district="IA01", doc_id="1", year=2026) == []


def test_ptr_skips_exchanges_which_carry_no_direction():
    text = "Widget Co (WDGT) [ST] E 01/05/202601/20/2026$1,001 - $15,000"
    assert congress.parse_ptr_text(text, member_name="X", state_district="IA01", doc_id="1", year=2026) == []


def test_ptr_external_ids_are_stable_and_unique(ptr_text):
    """Ingestion dedupes on these, so a rerun must produce identical keys."""
    first = [row.external_id for row in parse(ptr_text)]
    second = [row.external_id for row in parse(ptr_text)]
    assert first == second
    assert len(set(first)) == len(first)


# ---------------------------------------------------------------- insiders


def test_form4_parses_transactions(form4_submission):
    block = insiders._XML_BLOCK.search(form4_submission)
    assert block, "fixture should contain ownership XML"

    rows = insiders.parse_form4_xml(block.group(0), accession="0001867666-26-000013", filed_on=date(2026, 8, 13))
    assert len(rows) == 2

    sale = rows[0]
    assert sale.actor_name == "Morrone Louis H."
    assert sale.actor_title == "EXECUTIVE VICE PRESIDENT"
    assert sale.subject_key == "ABT"
    assert sale.direction == -1
    assert sale.raw_code == "S"
    # 5,850 shares at $109.83
    assert sale.usd_estimate == pytest.approx(642_505.5, abs=1.0)


def test_form4_weights_transaction_types_by_meaning(form4_submission):
    """An open-market sale is a decision; a discretionary transaction is
    mostly noise. They must not count equally."""
    block = insiders._XML_BLOCK.search(form4_submission)
    rows = insiders.parse_form4_xml(block.group(0), accession="acc", filed_on=date(2026, 8, 13))
    weights = {row.raw_code: row.signal_weight for row in rows}
    assert weights["S"] > weights["I"]


def test_form4_null_tickers_do_not_become_symbols():
    """Regression: issuers filing 'NONE' as their symbol were collected into
    one bogus subject called NONE."""
    xml = """<ownershipDocument>
      <issuer><issuerCik>0000123</issuerCik><issuerName>Private Co</issuerName>
        <issuerTradingSymbol>NONE</issuerTradingSymbol></issuer>
      <reportingOwner><reportingOwnerId><rptOwnerCik>999</rptOwnerCik>
        <rptOwnerName>Jane Doe</rptOwnerName></reportingOwnerId>
        <reportingOwnerRelationship><isOfficer>true</isOfficer>
          <officerTitle>CHIEF EXECUTIVE OFFICER</officerTitle></reportingOwnerRelationship>
      </reportingOwner>
      <nonDerivativeTable><nonDerivativeTransaction>
        <securityTitle><value>Common</value></securityTitle>
        <transactionDate><value>2026-08-01</value></transactionDate>
        <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
        <transactionAmounts>
          <transactionShares><value>100</value></transactionShares>
          <transactionPricePerShare><value>10</value></transactionPricePerShare>
          <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
        </transactionAmounts>
      </nonDerivativeTransaction></nonDerivativeTable>
    </ownershipDocument>"""
    rows = insiders.parse_form4_xml(xml, accession="acc", filed_on=date(2026, 8, 2))
    assert rows[0].subject_key == "CIK:0000123"


def test_form4_direction_follows_acquired_disposed_flag():
    """The A/D flag is authoritative even when the code table would disagree."""
    xml = """<ownershipDocument>
      <issuer><issuerCik>1</issuerCik><issuerName>X</issuerName>
        <issuerTradingSymbol>XYZ</issuerTradingSymbol></issuer>
      <reportingOwner><reportingOwnerId><rptOwnerCik>2</rptOwnerCik>
        <rptOwnerName>Someone</rptOwnerName></reportingOwnerId>
        <reportingOwnerRelationship><isDirector>true</isDirector></reportingOwnerRelationship>
      </reportingOwner>
      <nonDerivativeTable><nonDerivativeTransaction>
        <securityTitle><value>Common</value></securityTitle>
        <transactionDate><value>2026-08-01</value></transactionDate>
        <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
        <transactionAmounts>
          <transactionShares><value>5</value></transactionShares>
          <transactionPricePerShare><value>2</value></transactionPricePerShare>
          <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
        </transactionAmounts>
      </nonDerivativeTransaction></nonDerivativeTable>
    </ownershipDocument>"""
    rows = insiders.parse_form4_xml(xml, accession="acc", filed_on=date(2026, 8, 2))
    assert rows[0].direction == -1
