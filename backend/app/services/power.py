"""How much does this person's money movement count?

"Where the most powerful people put their money" needs an explicit, arguable
answer to "powerful". Ours, per actor type:

* **Insiders** — seniority, from the officer title on the filing itself. A CEO
  buying their own stock is a different statement than a divisional VP doing
  the same.
* **Politicians** — committee and leadership position, which the disclosure
  feed does not publish. That gap is filled by a small curated overlay in
  ``constants.CONGRESS_POWER_OVERRIDES`` rather than a scraped approximation
  that would rot silently.
* **Whales** — capital at risk, on a log scale, because they are pseudonymous
  and money is the only credential visible.

All three land in [0, 1] so the conviction model can mix them. This is a
judgment call encoded in numbers, which is exactly why it lives in one small
file with the weights in ``constants.py``.
"""

import math

from ..constants import (
    ACTOR_INSIDER,
    ACTOR_POLITICIAN,
    ACTOR_WHALE,
    CONGRESS_DEFAULT_POWER,
    CONGRESS_POWER_OVERRIDES,
    INSIDER_DEFAULT_TITLE_POWER,
    INSIDER_TEN_PERCENT_OWNER_POWER,
    INSIDER_TITLE_POWER,
    WHALE_MIN_POSITION_USD,
    WHALE_POWER_SATURATION_USD,
)


def insider_power(title: str | None, attrs: dict | None = None) -> float:
    attrs = attrs or {}
    text = (title or "").upper()

    score = INSIDER_DEFAULT_TITLE_POWER
    # Longest match wins so "CHIEF EXECUTIVE" beats a bare "CHIEF".
    for needle, value in sorted(INSIDER_TITLE_POWER, key=lambda pair: -len(pair[0])):
        if needle in text:
            score = value
            break

    if attrs.get("is_ten_percent_owner"):
        score = max(score, INSIDER_TEN_PERCENT_OWNER_POWER)
    return round(min(score, 1.0), 4)


def politician_power(name: str, attrs: dict | None = None) -> float:
    attrs = attrs or {}
    last_name = (attrs.get("last_name") or (name.split()[-1] if name.split() else "")).upper()
    return round(CONGRESS_POWER_OVERRIDES.get(last_name, CONGRESS_DEFAULT_POWER), 4)


def whale_power(position_usd: float | None) -> float:
    """Log-scaled capital at risk.

    The gap between a $1k and a $10k position says much more about conviction
    than the gap between $500k and $509k, so the scale is logarithmic and
    saturates at ``WHALE_POWER_SATURATION_USD``.
    """
    usd = float(position_usd or 0.0)
    if usd <= WHALE_MIN_POSITION_USD:
        return 0.1
    ratio = math.log10(usd / WHALE_MIN_POSITION_USD) / math.log10(WHALE_POWER_SATURATION_USD / WHALE_MIN_POSITION_USD)
    return round(min(max(ratio, 0.1), 1.0), 4)


def score(actor_type: str, name: str, title: str | None, attrs: dict | None = None) -> float:
    attrs = attrs or {}
    if actor_type == ACTOR_INSIDER:
        return insider_power(title, attrs)
    if actor_type == ACTOR_POLITICIAN:
        return politician_power(name, attrs)
    if actor_type == ACTOR_WHALE:
        return whale_power(attrs.get("position_usd"))
    return 0.5
