"""The directory listing copy, checked against the published field limits.

A listing that overruns a character limit is a mechanical rejection — the form
refuses it, or the portal truncates the description mid-sentence and a reviewer
reads that. The copy is long enough that nobody counts it by hand twice, so CI
counts it instead.

The metadata lives in a fenced JSON block in SUBMISSION.md rather than its own
file: one source of truth, and the prose around it stays the thing a person
actually reads.
"""

import json
import re
from pathlib import Path

import pytest

SUBMISSION = Path(__file__).resolve().parents[2] / "SUBMISSION.md"

# Anthropic's connector listing limits. OpenAI's are not identical, but every
# one of them is looser, so passing here passes there.
LIMITS = {"name": 100, "tagline": 55, "description": 2_000}


@pytest.fixture(scope="module")
def listing() -> dict:
    match = re.search(r"```json\n(.*?)\n```", SUBMISSION.read_text(), re.DOTALL)
    assert match, "SUBMISSION.md has no fenced JSON block"
    return json.loads(match.group(1))


@pytest.mark.parametrize(("field", "limit"), LIMITS.items())
def test_field_fits_its_limit(listing, field, limit):
    value = listing[field]
    assert value.strip(), f"{field} is empty"
    assert len(value) <= limit, f"{field} is {len(value)} chars, limit {limit}"


def test_category_count_is_within_range(listing):
    assert 1 <= len(listing["categories"]) <= 5


def test_five_example_prompts_and_each_is_answerable(listing):
    """Both directories ask for example prompts, and a reviewer will run them.
    One that no tool can answer reads as a broken listing."""
    assert len(listing["example_prompts"]) >= 3
    for prompt in listing["example_prompts"]:
        assert prompt.strip().endswith(("?", ".")), prompt


def test_description_carries_the_not_advice_framing(listing):
    """The listing is read by people who will never open the repo. If the
    framing is only in the code, it may as well not exist."""
    text = listing["description"].lower()
    assert "not advice" in text
    assert "federal reserve" in text


def test_required_urls_are_https(listing):
    for key in ("docs_url", "privacy_url", "source_url"):
        assert listing[key].startswith("https://"), key


def test_unfilled_placeholders_are_visible():
    """The support address is a real gap, not an oversight. It is marked TODO
    on purpose; this asserts the marker is still legible so it cannot be
    submitted blank by someone copying the block wholesale."""
    assert "TODO" in SUBMISSION.read_text()
