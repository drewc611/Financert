"""U.S. House periodic transaction reports (PTRs).

Members of Congress must disclose securities transactions within 45 days
(STOCK Act, Pub. L. 112-105). The House Clerk publishes those filings, but not
as data: you get a yearly ZIP containing an XML *index* of every filing, and
the transactions themselves live in one PDF per filing.

So the pipeline is: ZIP -> XML index -> filter to FilingType 'P' -> fetch each
PDF -> extract text -> regex the transaction table.

The regex is the fragile part, and it is fragile because the source is a PDF
rather than because of anything we chose. Two mitigations: the parser is a pure
function over extracted text (so it is testable against saved fixtures), and it
skips rows it cannot confidently parse instead of guessing. Silent wrong
numbers would be far worse than a lower yield.

Senate filings are deliberately not covered — the Senate eFD system gates
search behind a session cookie and an agreement form, and scraping it would be
both brittle and rude. That gap is documented rather than papered over.
"""

import io
import re
import zipfile
from datetime import date
from xml.etree import ElementTree as ET

from ..config import HOUSE_USER_AGENT
from ..constants import (
    ACTOR_POLITICIAN,
    PTR_AMOUNT_BRACKETS,
    PTR_DIRECTION,
    SUBJECT_EQUITY,
    VENUE_CONGRESS,
)
from ..time_utils import parse_date
from . import http
from .base import SourcePosition, geometric_midpoint

INDEX_URL = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.ZIP"
PTR_PDF_URL = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc_id}.pdf"

# Filing type 'P' is the periodic transaction report. The others (annual
# reports, amendments, terminations) carry no per-trade detail.
PTR_FILING_TYPE = "P"

# Asset classes worth tracking as market exposure, per
# https://fd.house.gov/reference/asset-type-codes.aspx
#
# Measured across a sample of recent filings, ST (stock) is ~93% of all
# transaction rows, with GS (government/agency debt), CS (corporate bonds), CT
# (cryptocurrency) and PS making up the tail. Government debt is kept because a
# member rotating into Treasuries is a real risk-off signal, not noise. ETFs
# arrive under both ET and OT depending on the filer.
#
# Excluded by omission: real property, farms, pensions, bank accounts, and the
# other non-market holdings that appear on annual reports.
TRACKED_ASSET_CLASSES = {"ST", "OT", "OP", "ET", "AB", "CS", "EF", "CT", "GS", "PS"}

_AMOUNT = r"\$[\d,]+\s*-\s*\$[\d,]+|Over\s+\$[\d,]+|\$[\d,]+\s*\+"
_DATE = r"\d{2}/\d{2}/\d{4}"

# One transaction row.
#
# The anchor is deliberately "[asset class] code date date amount" rather than
# anything involving the ticker. An earlier version keyed on "(TICKER) [XX]"
# and matched ticker-like text *inside the free-form Description blocks*,
# inventing transactions that were never filed. The bracketed asset class
# immediately followed by a transaction code, two dates and a dollar bracket
# appears only in real table rows.
#
# Note the missing \s+ between the date and amount groups: PDF text extraction
# runs those columns together ("03/16/202603/16/2026$1,001 - $15,000").
_ROW = re.compile(
    r"\[(?P<asset_class>[A-Z]{2})\]\s*"
    r"(?P<code>S\s*\(partial\)|[PSE])\s*"
    r"(?P<transacted>" + _DATE + r")\s*"
    r"(?P<disclosed>" + _DATE + r")\s*"
    r"(?P<amount>" + _AMOUNT + r")"
)

# Ticker printed inside parentheses: "Apple Inc. - Common Stock (AAPL)".
_TICKER_PARENS = re.compile(r"\(([A-Z][A-Z0-9.\-]{0,8})\)\s*$")

# Exchange-qualified ticker: "... ETF Trust NYSEARCA: DIA".
_TICKER_EXCHANGE = re.compile(r"(?:NYSE|NASDAQ|NYSEARCA|NASDAQGS|AMEX|BATS|OTC)[A-Z]*\s*:\s*([A-Z][A-Z0-9.\-]{0,8})")

# Words that look like tickers but are not, for the last-resort inference below.
_NOT_TICKERS = {
    "INC",
    "LLC",
    "LP",
    "LTD",
    "CORP",
    "CO",
    "THE",
    "AND",
    "ETF",
    "FUND",
    "TRUST",
    "CLASS",
    "COMMON",
    "STOCK",
    "SHARES",
    "NEW",
    "US",
    "USA",
    "PLC",
    "SA",
    "NV",
    "AG",
    "REIT",
    "ADR",
    "SER",
    "GROUP",
    "HOLDINGS",
    "INDEX",
    "BOND",
    "CASH",
    "IRA",
    "LLP",
    "NA",
    "OT",
    "ST",
}

_NAME = re.compile(r"Name:\s*(?:Hon\.\s*)?(?P<name>[^\n]+)")
_STATE = re.compile(r"State/District:\s*(?P<sd>[A-Z]{2}\d{2})")


def _clean_amount(text: str) -> str:
    """Normalize spacing so the bracket table lookup succeeds."""
    collapsed = re.sub(r"\s+", " ", text).strip()
    collapsed = collapsed.replace("$ ", "$")
    return re.sub(r"\s*-\s*", " - ", collapsed)


def _amount_bounds(text: str) -> tuple[float | None, float | None]:
    cleaned = _clean_amount(text)
    if cleaned in PTR_AMOUNT_BRACKETS:
        low, high = PTR_AMOUNT_BRACKETS[cleaned]
        return float(low), float(high)
    # Fall back to reading the two numbers directly — the Clerk occasionally
    # emits a bracket that is not in our table (they have been added over
    # time), and a parsed range beats dropping the row.
    numbers = [float(n.replace(",", "")) for n in re.findall(r"\$([\d,]+)", cleaned)]
    if len(numbers) == 2:
        return numbers[0], numbers[1]
    if len(numbers) == 1:
        return numbers[0], numbers[0] * 2
    return None, None


def _asset_name(text: str, match_start: int) -> str:
    """Recover the asset name printed immediately before the asset class.

    Walking backwards line by line is what makes this reliable. Between one row
    and the next sits the previous row's annotation block - Filing Status,
    Subholding Of, Location, and a free-text Description that routinely runs
    several wrapped lines and is full of tickers and dollar figures. Three cheap
    stop conditions separate the name from that noise:

      * the line carries a NUL byte. The Clerk renders letter-spaced field
        labels ("FILING STATUS:") with NULs between the characters, so a NUL is
        an unambiguous "this line is a label" marker.
      * the line contains '$' or '/share' - description prose, never a name.
      * we already have four lines, longer than any real asset name.
    """
    lines = text[:match_start].split("\n")
    collected: list[str] = []
    for raw_line in reversed(lines):
        if "\x00" in raw_line:
            break
        cleaned = raw_line.strip()
        if not cleaned:
            if collected:
                break
            continue
        if "$" in cleaned or "/share" in cleaned:
            break
        collected.append(cleaned)
        if len(collected) >= 4:
            break
    collected.reverse()
    name = re.sub(r"\s+", " ", " ".join(collected)).strip(" -:")
    return name or "Unknown asset"


def _extract_ticker(asset_name: str) -> tuple[str | None, bool]:
    """Pull a ticker out of an asset name.

    Returns (ticker, inferred). ``inferred`` is True when the ticker came from
    the last-resort heuristic rather than an explicit marker; the caller records
    that on the position so the UI can say so out loud rather than presenting a
    guess with the same confidence as a printed symbol.
    """
    if match := _TICKER_PARENS.search(asset_name):
        return match.group(1).upper().strip("."), False
    if match := _TICKER_EXCHANGE.search(asset_name):
        return match.group(1).upper().strip("."), False

    # Last resort: a trailing all-caps token, as in "Invesco QQQ". ETFs are
    # heavily traded by members and are often filed with no explicit ticker, so
    # dropping them would lose real signal - but it is a guess, and is flagged.
    tail = re.sub(r"[^A-Za-z0-9 .\-]", " ", asset_name).split()
    for token in reversed(tail[-2:]):
        candidate = token.upper().strip(".-")
        if 2 <= len(candidate) <= 5 and candidate.isalpha() and candidate not in _NOT_TICKERS:
            return candidate, True
    return None, False


def parse_ptr_text(
    text: str,
    *,
    member_name: str,
    state_district: str,
    doc_id: str,
    year: int,
    filed_on: date | None = None,
) -> list[SourcePosition]:
    """Extract transactions from one PTR's extracted text.

    Pure function over text so it can be tested against saved fixtures.
    """
    positions: list[SourcePosition] = []
    source_url = PTR_PDF_URL.format(year=year, doc_id=doc_id)

    for index, match in enumerate(_ROW.finditer(text)):
        asset_class = match.group("asset_class").upper()
        if asset_class not in TRACKED_ASSET_CLASSES:
            continue

        code = re.sub(r"\s+", " ", match.group("code")).strip()
        direction = PTR_DIRECTION.get(code, PTR_DIRECTION.get(code.upper(), 0))
        if direction == 0:
            continue  # exchanges carry no directional view

        low, high = _amount_bounds(match.group("amount"))
        transacted = parse_date(match.group("transacted"))
        disclosed = parse_date(match.group("disclosed")) or filed_on

        asset_name = _asset_name(text, match.start())
        ticker, inferred = _extract_ticker(asset_name)

        if ticker:
            subject_key = ticker
        else:
            # No symbol we can trust. Key on the name under a distinct prefix
            # so this can never be mistaken for, or silently merged with, a
            # real ticker when computing convergence.
            subject_key = "NAME:" + re.sub(r"[^A-Z0-9]+", " ", asset_name.upper()).strip()[:64]

        notes = "Ticker inferred from asset name; not printed on the filing." if inferred else None

        positions.append(
            SourcePosition(
                actor_type=ACTOR_POLITICIAN,
                actor_external_key=f"{member_name}|{state_district}".upper(),
                actor_name=member_name,
                actor_title=state_district,
                actor_affiliation="U.S. House of Representatives",
                actor_attrs={"state_district": state_district, "last_name": member_name.split()[-1]},
                venue=VENUE_CONGRESS,
                # doc_id + row index makes re-running a refresh idempotent.
                external_id=f"{doc_id}:{index}",
                subject_kind=SUBJECT_EQUITY,
                subject_key=subject_key,
                subject_label=asset_name,
                direction=direction,
                usd_low=low,
                usd_high=high,
                usd_estimate=geometric_midpoint(low, high),
                signal_weight=1.0,
                raw_code=code,
                raw_label="Purchase" if direction > 0 else "Sale",
                transacted_at=transacted,
                disclosed_at=disclosed,
                source_url=source_url,
                notes=notes,
            )
        )
    return positions


def fetch_filing_index(year: int) -> list[dict]:
    """Download and parse the yearly filing index. Returns PTR filings only."""
    payload = http.get_bytes(INDEX_URL.format(year=year), HOUSE_USER_AGENT)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        xml_names = [n for n in archive.namelist() if n.lower().endswith(".xml")]
        if not xml_names:
            raise ValueError(f"No XML index inside {year}FD.ZIP")
        raw = archive.read(xml_names[0])

    root = ET.fromstring(raw)
    filings = []
    for member in root.findall("Member"):
        if (member.findtext("FilingType") or "").strip() != PTR_FILING_TYPE:
            continue
        doc_id = (member.findtext("DocID") or "").strip()
        if not doc_id:
            continue
        first = (member.findtext("First") or "").strip()
        last = (member.findtext("Last") or "").strip()
        filings.append(
            {
                "doc_id": doc_id,
                "name": f"{first} {last}".strip(),
                "last_name": last,
                "state_district": (member.findtext("StateDst") or "").strip(),
                "filing_date": parse_date(member.findtext("FilingDate")),
                "year": year,
            }
        )
    # Most recent first — a partial run should collect the freshest filings.
    filings.sort(key=lambda f: f["filing_date"] or date.min, reverse=True)
    return filings


def _extract_pdf_text(payload: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(payload))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def fetch(year: int, limit: int = 60) -> tuple[list[SourcePosition], list[str]]:
    """Fetch up to ``limit`` of the year's most recent PTRs.

    Returns (positions, warnings). A filing that fails to download or parse
    produces a warning and is skipped — one scanned-image PDF must not abort
    the run.
    """
    positions: list[SourcePosition] = []
    warnings: list[str] = []

    try:
        filings = fetch_filing_index(year)
    except Exception as exc:  # network, bad ZIP, schema change
        return [], [f"congress: could not load {year} filing index: {exc}"]

    for filing in filings[:limit]:
        url = PTR_PDF_URL.format(year=year, doc_id=filing["doc_id"])
        try:
            payload = http.get_bytes(url, HOUSE_USER_AGENT)
            text = _extract_pdf_text(payload)
        except Exception as exc:
            warnings.append(f"congress: {filing['doc_id']} fetch/extract failed: {exc}")
            continue

        if len(text.strip()) < 200:
            # Almost certainly a scanned image. We do not OCR: a wrong number
            # is worse than a missing one.
            warnings.append(f"congress: {filing['doc_id']} has no extractable text (likely scanned)")
            continue

        name = filing["name"]
        state_district = filing["state_district"]
        # Prefer the name printed on the filing itself when present.
        if header := _NAME.search(text):
            name = header.group("name").strip() or name
        if state := _STATE.search(text):
            state_district = state.group("sd") or state_district

        try:
            rows = parse_ptr_text(
                text,
                member_name=name,
                state_district=state_district,
                doc_id=filing["doc_id"],
                year=year,
                filed_on=filing["filing_date"],
            )
        except Exception as exc:
            warnings.append(f"congress: {filing['doc_id']} parse failed: {exc}")
            continue

        if not rows:
            warnings.append(f"congress: {filing['doc_id']} produced no tracked rows")
        positions.extend(rows)

    return positions, warnings
