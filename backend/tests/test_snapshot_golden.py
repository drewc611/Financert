"""The parse is pinned to a committed fixture (BACKLOG F9).

`fetch_dfa.py` turns the Fed's CSVs into every number this product shows. It
runs by hand, against a file that changes quarterly, so nothing else in the
suite would notice if a column mapping, a unit multiplier or a composite rule
drifted -- the snapshot in `data/` would simply be rebuilt wrong and every test
downstream would keep passing against it.

So: a real slice of the archive (three quarters, every dimension, every
category) under `fixtures/dfa/`, and the snapshot it is expected to produce in
`fixtures/dfa_snapshot_golden.json`. A change in what the parser does shows up
as a diff in numbers a reviewer can read, not as a silent rebuild.

To adopt a deliberate change:

    FINANCERT_UPDATE_GOLDEN=1 pytest tests/test_snapshot_golden.py

and read the resulting diff before committing it.

The three quarters are not arbitrary: the first and last of the published
history, plus one that carries the triennial Survey of Consumer Finances
cutoffs, so the threshold path is exercised rather than only the blank path.
"""

import csv
import io
import json
import os
import zipfile
from pathlib import Path

import pytest

import fetch_dfa
from app.constants import DIMENSIONS

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "dfa"
GOLDEN_PATH = Path(__file__).parent / "fixtures" / "dfa_snapshot_golden.json"

# Rebuilt on every run and never equal between two runs, so they are compared
# for presence and type rather than value.
VOLATILE = ("retrieved_at", "archive_sha256", "archive_bytes")


def _zip(members: dict[str, str]) -> bytes:
    """Pack the fixture CSVs into an archive shaped like the Fed's own."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, text in members.items():
            archive.writestr(name, text)
    return buf.getvalue()


def _members() -> dict[str, str]:
    return {path.name: path.read_text(encoding="utf-8") for path in sorted(FIXTURE_DIR.glob("*.csv"))}


@pytest.fixture(scope="module")
def built() -> dict:
    return fetch_dfa.build_snapshot(1989, blob=_zip(_members()))


def test_the_fixture_covers_every_dimension():
    """Guards the rest of this file: a fixture missing a member would make the
    golden comparison prove less than it appears to."""
    present = _members()
    for name, spec in DIMENSIONS.items():
        assert spec["member"] in present, f"{name} has no fixture CSV"


def test_the_parse_matches_the_golden_snapshot(built):
    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    actual = json.loads(json.dumps(built))
    for key in VOLATILE:
        assert isinstance(actual["source"].pop(key), (str, int))
        golden["source"].pop(key, None)

    if os.environ.get("FINANCERT_UPDATE_GOLDEN"):
        GOLDEN_PATH.write_text(json.dumps(actual, indent=2) + "\n", encoding="utf-8")
        pytest.skip("golden file rewritten; review the diff")

    # Compared dimension by dimension: a whole-snapshot assertion prints 27
    # groups of history on any failure, which is unreadable.
    assert actual["periods"] == golden["periods"]
    assert actual["asset_classes"] == golden["asset_classes"]
    for name in golden["dimensions"]:
        assert actual["dimensions"][name] == golden["dimensions"][name], name
    assert actual == golden


def test_a_missing_column_fails_loudly_and_names_itself():
    """The failure mode this exists for: the Fed renames a column, the parse
    reads it as absent, and the numbers quietly drop a whole asset class."""
    members = _members()
    member = DIMENSIONS["networth"]["member"]
    rows = list(csv.DictReader(io.StringIO(members[member])))
    fields = [f for f in rows[0] if f != "Annuities"]
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    members[member] = out.getvalue()

    with pytest.raises(fetch_dfa.FetchError) as exc:
        fetch_dfa.build_snapshot(1989, blob=_zip(members))
    assert "Annuities" in str(exc.value)


def test_a_renamed_member_fails_loudly_and_lists_what_was_found():
    members = {f"renamed-{name}": text for name, text in _members().items()}
    with pytest.raises(fetch_dfa.FetchError) as exc:
        fetch_dfa.build_snapshot(1989, blob=_zip(members))
    assert DIMENSIONS["networth"]["member"] in str(exc.value)


def test_a_taxonomy_that_stops_reconciling_fails_the_build():
    """Halving the published `Assets` total leaves the components summing to
    roughly twice it, which is the shape of a real double-count."""
    members = _members()
    member = DIMENSIONS["networth"]["member"]
    rows = list(csv.DictReader(io.StringIO(members[member])))
    for row in rows:
        row["Assets"] = str(float(row["Assets"]) / 2)
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    members[member] = out.getvalue()

    with pytest.raises(fetch_dfa.FetchError) as exc:
        fetch_dfa.build_snapshot(1989, blob=_zip(members))
    assert "reconciliation" in str(exc.value)
