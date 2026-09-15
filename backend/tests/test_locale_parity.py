"""Locale bundles must stay in step with each other.

Lives in the backend suite because it is the only test runner this repo has --
the frontend is lint-and-build only (BACKLOG F69). It reads JSON files, so it
needs nothing from the frontend toolchain.

Without this the parity was a convention maintained by hand, and the failure
mode is quiet: a key added to en.json alone renders English inside an otherwise
translated page, which nobody notices unless they read that page in that
language.
"""

import json
import re
from pathlib import Path

import pytest

LOCALES_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "i18n" / "locales"
REFERENCE = "en"
PLACEHOLDER = re.compile(r"\{(\w+)\}")


def _flatten(node, prefix=""):
    flat = {}
    for key, value in node.items():
        path = f"{prefix}{key}"
        if isinstance(value, dict):
            flat.update(_flatten(value, f"{path}."))
        else:
            flat[path] = value
    return flat


def _bundle(code):
    return _flatten(json.loads((LOCALES_DIR / f"{code}.json").read_text(encoding="utf-8")))


def _codes():
    return sorted(p.stem for p in LOCALES_DIR.glob("*.json"))


def test_the_locale_directory_is_not_empty():
    """Guards the rest of this file: a bad path would make every parametrised
    test below vacuously pass."""
    codes = _codes()
    assert REFERENCE in codes
    assert len(codes) >= 2


@pytest.mark.parametrize("code", [c for c in _codes() if c != REFERENCE])
def test_every_locale_has_exactly_the_reference_keys(code):
    reference = set(_bundle(REFERENCE))
    keys = set(_bundle(code))
    assert not (reference - keys), f"{code}.json is missing: {sorted(reference - keys)}"
    assert not (keys - reference), f"{code}.json has keys en.json does not: {sorted(keys - reference)}"


@pytest.mark.parametrize("code", [c for c in _codes() if c != REFERENCE])
def test_placeholders_match_the_reference(code):
    """A translation that drops {quarter} renders the sentence without its
    number; one that invents {tier} renders the braces literally."""
    reference = _bundle(REFERENCE)
    for key, value in _bundle(code).items():
        expected = set(PLACEHOLDER.findall(reference[key]))
        actual = set(PLACEHOLDER.findall(value))
        assert actual == expected, f"{code}.json[{key}]: placeholders {sorted(actual)} != {sorted(expected)}"


@pytest.mark.parametrize("code", _codes())
def test_no_blank_strings(code):
    """Except disclaimer.translationNote, which is deliberately empty for the
    locale the original is written in."""
    for key, value in _bundle(code).items():
        if key == "disclaimer.translationNote":
            continue
        assert isinstance(value, str) and value.strip(), f"{code}.json[{key}] is blank"


def test_non_english_locales_carry_the_machine_translation_note():
    """These were machine-translated and have had no legal review; the note is
    what says the English original governs. Removing it silently would be a
    substantive change, not a copy edit."""
    for code in _codes():
        note = _bundle(code)["disclaimer.translationNote"]
        if code == REFERENCE:
            assert note == "", "en.json should have no translation note"
        else:
            assert note.strip(), f"{code}.json lost its translation note"
