"""Polymarket — prediction-market positions.

The other two sources are people with power over outcomes. This one is
different in kind: it is people with money betting on outcomes, and it is the
only forward-looking source of the three. A senator's trade tells you what they
did last month; a prediction market tells you what capital expects next.

Two honest caveats, both surfaced in the UI rather than buried:

1. Traders are pseudonymous. "Power" here is capital at risk, not office held.
   A whale may be a hedge fund or a well-funded retail gambler.
2. The holders endpoint returns a *snapshot of current holdings*, not a
   transaction log. We cannot know when a position was opened, so
   ``transacted_at`` is the snapshot date and every row says so in its notes.
   External ids include that date, so repeated runs build a time series rather
   than overwriting each other.
"""

import json
from datetime import date

from ..constants import (
    ACTOR_WHALE,
    POLYMARKET_HOLDERS_PER_MARKET,
    POLYMARKET_MIN_MARKET_VOLUME,
    SUBJECT_EVENT,
    VENUE_POLYMARKET,
    WHALE_MIN_POSITION_USD,
)
from ..time_utils import parse_date, today
from . import http
from .base import SourcePosition

GAMMA_MARKETS_URL = (
    "https://gamma-api.polymarket.com/markets" "?closed=false&active=true&order=volumeNum&ascending=false&limit={limit}"
)
HOLDERS_URL = "https://data-api.polymarket.com/holders?market={condition_id}&limit={limit}"
MARKET_PAGE_URL = "https://polymarket.com/event/{slug}"

# Gamma has no auth and no documented rate limit, but we still identify
# ourselves rather than pretending to be a browser.
USER_AGENT = "Financert/0.1 (research; +https://github.com/drewc611/Financert)"


def _json_field(raw, default):
    """Gamma returns several array fields as JSON-encoded *strings*."""
    if raw is None:
        return default
    if isinstance(raw, list):
        return raw
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else default
    except (TypeError, ValueError):
        return default


def fetch_markets(limit: int = 25) -> list[dict]:
    """Top open markets by lifetime volume, thin ones filtered out."""
    payload = http.get_json(GAMMA_MARKETS_URL.format(limit=max(limit * 2, limit)), USER_AGENT)
    markets = []
    for market in payload:
        try:
            volume = float(market.get("volumeNum") or market.get("volume") or 0)
        except (TypeError, ValueError):
            volume = 0.0
        if volume < POLYMARKET_MIN_MARKET_VOLUME:
            # Below this, the price is a couple of traders' opinions rather
            # than a market view.
            continue
        if not market.get("conditionId"):
            continue
        market["_volume"] = volume
        markets.append(market)
        if len(markets) >= limit:
            break
    return markets


def parse_holders(
    market: dict,
    holders_payload: list,
    *,
    snapshot: date | None = None,
) -> list[SourcePosition]:
    """Turn one market's holder snapshot into positions. Pure function."""
    snapshot = snapshot or today()

    question = market.get("question") or market.get("slug") or "Unknown market"
    slug = market.get("slug") or market.get("conditionId", "")
    outcomes = _json_field(market.get("outcomes"), ["Yes", "No"])
    prices = [float(p) for p in _json_field(market.get("outcomePrices"), []) if _is_number(p)]
    end_date = parse_date(market.get("endDate"))

    positions: list[SourcePosition] = []

    for token_group in holders_payload or []:
        for holder in token_group.get("holders", []) or []:
            wallet = holder.get("proxyWallet")
            if not wallet:
                continue

            try:
                shares = float(holder.get("amount") or 0)
            except (TypeError, ValueError):
                continue

            outcome_index = int(holder.get("outcomeIndex") or 0)
            outcome_label = outcomes[outcome_index] if outcome_index < len(outcomes) else str(outcome_index)

            # Each share pays $1 if the outcome resolves true, so the current
            # market price is the position's mark-to-market value per share.
            price = prices[outcome_index] if outcome_index < len(prices) else None
            usd = shares * price if price is not None else None
            if usd is not None and usd < WHALE_MIN_POSITION_USD:
                continue

            # Index 0 is "Yes" on Polymarket's binary markets: holding it is a
            # bet the event happens.
            direction = 1 if outcome_index == 0 else -1

            display_name = holder.get("name") or holder.get("pseudonym") or wallet[:10]

            positions.append(
                SourcePosition(
                    actor_type=ACTOR_WHALE,
                    actor_external_key=wallet,
                    actor_name=display_name,
                    actor_title="Prediction-market trader",
                    actor_affiliation=holder.get("pseudonym") or None,
                    actor_attrs={"position_usd": usd or 0.0, "verified": bool(holder.get("verified"))},
                    venue=VENUE_POLYMARKET,
                    # Dated, so repeat runs accumulate a series instead of
                    # colliding on the unique constraint.
                    external_id=f"{market.get('conditionId')}:{wallet}:{outcome_index}:{snapshot.isoformat()}",
                    subject_kind=SUBJECT_EVENT,
                    subject_key=f"pm:{slug}",
                    subject_label=question,
                    direction=direction,
                    usd_low=usd,
                    usd_high=usd,
                    usd_estimate=usd,
                    signal_weight=1.0,
                    raw_code=outcome_label,
                    raw_label=f"Holds {outcome_label}",
                    # A snapshot, not a trade date. See the module docstring.
                    transacted_at=snapshot,
                    disclosed_at=snapshot,
                    source_url=MARKET_PAGE_URL.format(slug=slug),
                    notes=(
                        f"{shares:,.0f} {outcome_label} shares @ ${price:.2f}"
                        + (f" - market resolves {end_date.isoformat()}" if end_date else "")
                        + " (current holdings snapshot, not a trade)"
                        if price is not None
                        else f"{shares:,.0f} {outcome_label} shares (holdings snapshot)"
                    ),
                )
            )
    return positions


def _is_number(value) -> bool:
    try:
        float(value)
        return True
    except (TypeError, ValueError):
        return False


def fetch(limit: int = 25) -> tuple[list[SourcePosition], list[str]]:
    """Snapshot the largest holders across the top open markets."""
    positions: list[SourcePosition] = []
    warnings: list[str] = []

    try:
        markets = fetch_markets(limit)
    except Exception as exc:
        return [], [f"polymarket: market list failed: {exc}"]

    if not markets:
        return [], ["polymarket: no markets cleared the volume floor"]

    snapshot = today()
    for market in markets:
        condition_id = market["conditionId"]
        try:
            payload = http.get_json(
                HOLDERS_URL.format(condition_id=condition_id, limit=POLYMARKET_HOLDERS_PER_MARKET),
                USER_AGENT,
            )
        except Exception as exc:
            warnings.append(f"polymarket: holders for {market.get('slug', condition_id)} failed: {exc}")
            continue

        try:
            positions.extend(parse_holders(market, payload, snapshot=snapshot))
        except Exception as exc:
            warnings.append(f"polymarket: parsing {market.get('slug', condition_id)} failed: {exc}")

    return positions, warnings
