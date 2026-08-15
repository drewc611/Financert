"""SEC Form 4 — corporate insider transactions.

Officers, directors, and 10% owners must report changes in their holdings
within two business days (Securities Exchange Act §16(a)). This is the
highest-quality dataset of the three: exact share counts, exact prices, exact
dates, filed as XML, with a two-day lag instead of Congress's forty-five.

Discovery goes through EDGAR's daily index, which lists every filing accepted
on a given day. For each Form 4 we fetch the *full submission* text file, which
carries the ownership XML inline — one request per filing rather than two
(directory listing, then document).

The interpretive work happens in ``constants.INSIDER_CODE_META``: not every
Form 4 line reflects a decision. A scheduled grant vesting or shares withheld
to cover taxes tells you nothing about what the filer believes. An open-market
purchase tells you a great deal.
"""

import re
from datetime import date, timedelta
from xml.etree import ElementTree as ET

from ..config import SEC_USER_AGENT
from ..constants import (
    ACTOR_INSIDER,
    INSIDER_CODE_META,
    INSIDER_DEFAULT_META,
    SUBJECT_EQUITY,
    VENUE_INSIDER,
)
from ..time_utils import parse_date
from . import http
from .base import SourcePosition

DAILY_INDEX_URL = "https://www.sec.gov/Archives/edgar/daily-index/{year}/QTR{quarter}/form.{stamp}.idx"
SUBMISSION_URL = "https://www.sec.gov/Archives/{path}"
FILING_PAGE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession_nodash}/{accession}-index.htm"

_XML_BLOCK = re.compile(r"<ownershipDocument>.*?</ownershipDocument>", re.DOTALL | re.IGNORECASE)

# Ways filers write "this issuer has no ticker". Treated as absent rather than
# as a symbol, so unrelated private registrants do not merge into one subject.
_NULL_TICKERS = {"", "NONE", "N/A", "NA", "N.A.", "-", "--", "0", "NULL", "NOT APPLICABLE", "PRIVATE"}


def _text(node, path: str) -> str | None:
    if node is None:
        return None
    found = node.find(path)
    if found is None or found.text is None:
        return None
    value = found.text.strip()
    return value or None


def _float(node, path: str) -> float | None:
    raw = _text(node, path)
    if raw is None:
        return None
    try:
        return float(raw.replace(",", "").replace("$", ""))
    except ValueError:
        return None


def parse_form4_xml(xml_text: str, *, accession: str, filed_on: date | None = None) -> list[SourcePosition]:
    """Turn one Form 4 document into positions. Pure function, one per transaction."""
    root = ET.fromstring(xml_text)

    issuer_name = _text(root, "issuer/issuerName") or "Unknown issuer"
    ticker = (_text(root, "issuer/issuerTradingSymbol") or "").upper().strip()
    cik = _text(root, "issuer/issuerCik") or ""

    owner_name = _text(root, "reportingOwner/reportingOwnerId/rptOwnerName") or "Unknown filer"
    owner_cik = _text(root, "reportingOwner/reportingOwnerId/rptOwnerCik") or owner_name

    relationship = root.find("reportingOwner/reportingOwnerRelationship")
    is_director = (_text(relationship, "isDirector") or "").lower() in {"1", "true"}
    is_officer = (_text(relationship, "isOfficer") or "").lower() in {"1", "true"}
    is_ten_percent = (_text(relationship, "isTenPercentOwner") or "").lower() in {"1", "true"}
    officer_title = _text(relationship, "officerTitle")

    if officer_title:
        title = officer_title
    elif is_director:
        title = "Director"
    elif is_ten_percent:
        title = "10% owner"
    else:
        title = "Insider"

    period = parse_date(_text(root, "periodOfReport")) or filed_on

    # An issuer with no ticker is usually a private or recently delisted
    # registrant. Filers express "no symbol" half a dozen different ways, and
    # taking them literally would invent tickers like NONE and N/A that then
    # collect unrelated companies into one bogus subject.
    if ticker in _NULL_TICKERS:
        ticker = ""
    subject_key = ticker if ticker else f"CIK:{cik}"

    positions: list[SourcePosition] = []
    transactions = root.findall("nonDerivativeTable/nonDerivativeTransaction")

    for index, node in enumerate(transactions):
        code = (_text(node, "transactionCoding/transactionCode") or "").upper()
        meta = INSIDER_CODE_META.get(code, INSIDER_DEFAULT_META)

        shares = _float(node, "transactionAmounts/transactionShares/value")
        price = _float(node, "transactionAmounts/transactionPricePerShare/value")
        acquired_disposed = (_text(node, "transactionAmounts/transactionAcquiredDisposedCode/value") or "").upper()

        # The A/D flag on the transaction is authoritative about direction;
        # the code table is the fallback when it is absent or malformed.
        if acquired_disposed == "A":
            direction = 1
        elif acquired_disposed == "D":
            direction = -1
        else:
            direction = meta["direction"]

        if direction == 0:
            continue

        # Grants are frequently filed at price 0. That is a real fact about the
        # transaction, not missing data, so the value is 0 rather than None.
        usd = (shares * price) if (shares is not None and price is not None) else None

        transacted = parse_date(_text(node, "transactionDate/value")) or period

        positions.append(
            SourcePosition(
                actor_type=ACTOR_INSIDER,
                actor_external_key=str(owner_cik),
                actor_name=owner_name,
                actor_title=title,
                actor_affiliation=issuer_name,
                actor_attrs={
                    "officer_title": officer_title,
                    "is_director": is_director,
                    "is_officer": is_officer,
                    "is_ten_percent_owner": is_ten_percent,
                },
                venue=VENUE_INSIDER,
                external_id=f"{accession}:{index}",
                subject_kind=SUBJECT_EQUITY,
                subject_key=subject_key,
                subject_label=issuer_name,
                direction=direction,
                usd_low=usd,
                usd_high=usd,
                usd_estimate=usd,
                signal_weight=meta["signal_weight"],
                raw_code=code,
                raw_label=meta["label"],
                transacted_at=transacted,
                disclosed_at=filed_on,
                source_url=FILING_PAGE_URL.format(
                    cik=cik.lstrip("0") or cik,
                    accession_nodash=accession.replace("-", ""),
                    accession=accession,
                ),
                notes=(
                    f"{shares:,.0f} shares @ ${price:,.2f}"
                    if shares is not None and price is not None
                    else (f"{shares:,.0f} shares" if shares is not None else None)
                ),
            )
        )
    return positions


def fetch_daily_index(day: date) -> list[dict]:
    """List every Form 4 accepted on ``day``. Empty on weekends and holidays."""
    quarter = (day.month - 1) // 3 + 1
    url = DAILY_INDEX_URL.format(year=day.year, quarter=quarter, stamp=day.strftime("%Y%m%d"))
    try:
        body = http.get(url, SEC_USER_AGENT).text
    except Exception:
        # Weekends, federal holidays, and not-yet-published days all 404.
        return []

    filings = []
    for line in body.splitlines():
        if not line.startswith("4 "):
            continue
        # Fixed-width-ish columns, but company names contain runs of spaces, so
        # split from the right where the trailing fields are well-behaved.
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 5:
            continue
        path = parts[-1].strip()
        if not path.endswith(".txt"):
            continue
        accession = path.rsplit("/", 1)[-1].removesuffix(".txt")
        filings.append(
            {
                "form_type": parts[0].strip(),
                "company": parts[1].strip(),
                "cik": parts[2].strip(),
                "filed_on": parse_date(parts[3].strip()) or day,
                "path": path,
                "accession": accession,
            }
        )
    return filings


def fetch(days: int = 2, limit: int = 120, only_ciks: set[str] | None = None) -> tuple[list[SourcePosition], list[str]]:
    """Fetch recent Form 4 filings.

    ``limit`` caps how many filings are downloaded. On a normal weekday the SEC
    accepts roughly a thousand Form 4s, so a full crawl is a background job
    rather than something to do inside a web request. The cap is reported in
    the warnings so a partial run never reads as a complete one.

    ``only_ciks`` narrows to specific issuers when you care about a watchlist.
    """
    positions: list[SourcePosition] = []
    warnings: list[str] = []

    candidates: list[dict] = []
    today = date.today()
    for offset in range(days):
        day = today - timedelta(days=offset)
        entries = fetch_daily_index(day)
        if only_ciks:
            entries = [e for e in entries if e["cik"].lstrip("0") in {c.lstrip("0") for c in only_ciks}]
        candidates.extend(entries)

    if not candidates:
        return [], [f"insiders: no Form 4 filings found in the last {days} day(s)"]

    total = len(candidates)
    selected = candidates[:limit]
    if total > limit:
        warnings.append(f"insiders: sampled {limit} of {total} Form 4 filings (raise --sec-limit for full coverage)")

    for filing in selected:
        try:
            body = http.get(SUBMISSION_URL.format(path=filing["path"]), SEC_USER_AGENT).text
        except Exception as exc:
            warnings.append(f"insiders: {filing['accession']} fetch failed: {exc}")
            continue

        block = _XML_BLOCK.search(body)
        if not block:
            warnings.append(f"insiders: {filing['accession']} has no ownership XML")
            continue

        try:
            positions.extend(
                parse_form4_xml(block.group(0), accession=filing["accession"], filed_on=filing["filed_on"])
            )
        except ET.ParseError as exc:
            warnings.append(f"insiders: {filing['accession']} XML parse failed: {exc}")

    return positions, warnings
