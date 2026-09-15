"""The dimension registry (BACKLOG F17), and the guard rail on summing (F21).

Two jobs here. The first is to prove this refactor changed nothing: the four
names most of the app imports are now derived from the registry rather than
written out, and they must still be exactly what they were. The second is to
check the registry against the published archive, so a Fed rename surfaces as
a named failure rather than as an empty chart (F72).
"""

import csv
import io
import json
import os
import urllib.error
import urllib.request
import zipfile

import pytest

from app import constants
from app.services import benchmarks

# What these were before the registry existed, transcribed from the commit that
# introduced it. Written out literally on purpose -- deriving the expectation
# from the same registry under test would assert nothing.
LEGACY_GROUP_ORDER = ["top1", "next9", "next40", "bottom50"]
LEGACY_ALL_GROUPS = ["top01", "top1", "next9", "next40", "bottom50"]
LEGACY_NESTED_GROUPS = ["top01"]
LEGACY_CATEGORIES = {
    "top01": ["TopPt1"],
    "top1": ["TopPt1", "RemainingTop1"],
    "next9": ["Next9"],
    "next40": ["Next40"],
    "bottom50": ["Bottom50"],
}


def test_the_derived_wealth_constants_are_unchanged():
    assert constants.GROUP_ORDER == LEGACY_GROUP_ORDER
    assert constants.ALL_GROUPS == LEGACY_ALL_GROUPS
    assert constants.NESTED_GROUPS == LEGACY_NESTED_GROUPS


def test_categories_are_unchanged():
    for group_key, expected in LEGACY_CATEGORIES.items():
        assert constants.categories_for(group_key) == expected


def test_group_keys_are_unique_across_the_whole_registry():
    """dimension_of() resolves a bare key, so a key reused on two axes would
    silently route to whichever dimension happened to be declared first."""
    seen = {}
    for name, spec in constants.DIMENSIONS.items():
        for key in spec["groups"]:
            assert key not in seen, f"{key!r} is in both {seen[key]} and {name}"
            seen[key] = name


def test_every_dimension_is_described_consistently():
    for name, spec in constants.DIMENSIONS.items():
        assert spec["member"].endswith(".csv"), name
        assert spec["label"], name
        assert spec["groups"], name
        for key, group in spec["groups"].items():
            assert ("category" in group) ^ ("parts" in group), f"{name}.{key} needs exactly one of category/parts"
            assert group["label"], f"{name}.{key}"
            if group.get("nested"):
                assert group["nested_in"] in spec["groups"], f"{name}.{key} nests into an unknown group"


def test_net_worth_is_the_only_dimension_with_nesting():
    """Income's pct99to100 is its top-1% analogue but the file publishes it as
    a disjoint slice, so income's groups sum where net worth's do not. If this
    ever changes, the summing guard rail below needs revisiting with it."""
    nested = {name for name in constants.DIMENSIONS if constants.nested_group_keys(name)}
    assert nested == {"networth"}


# ------------------------------------------------------------- the guard rail


def test_siblings_may_be_summed():
    assert constants.summable(constants.GROUP_ORDER)
    assert constants.summable(constants.all_group_keys("income"))


def test_a_nested_group_may_not_be_summed_with_its_siblings():
    """The top 0.1% is already inside the top 1%; adding them double counts."""
    assert not constants.summable(["top01", "top1", "next9", "next40", "bottom50"])
    assert not constants.summable(["top01", "next9"])


def test_groups_from_different_dimensions_may_not_be_summed():
    """These are separate cuts of the same households, not separate households,
    so any total across them counts people more than once."""
    assert not constants.summable(["top1", "millennial"])
    assert not constants.summable(["college", "white"])


def test_unknown_keys_are_not_summable():
    assert not constants.summable(["not_a_group"])


def test_empty_is_trivially_summable():
    assert constants.summable([])


# ------------------------------------------- contract against the real archive

pytestmark_network = pytest.mark.skipif(
    os.environ.get("FINANCERT_SKIP_NETWORK_TESTS") == "1",
    reason="FINANCERT_SKIP_NETWORK_TESTS=1",
)


@pytestmark_network
def test_the_registry_matches_the_published_archive():
    """Every member this registry names exists, and every Category value it
    claims is really in that file.

    This is the check that turns a Fed rename into a named failure instead of
    an empty chart. It is skipped rather than failed when the network is not
    reachable, so an offline run does not report a problem that isn't one.
    """
    request = urllib.request.Request(constants.DFA_ZIP_URL, headers={"User-Agent": "financert-contract-test"})
    try:
        blob = urllib.request.urlopen(request, timeout=90).read(25 * 1024 * 1024)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        pytest.skip(f"DFA archive not reachable: {exc}")

    archive = zipfile.ZipFile(io.BytesIO(blob))
    members = set(archive.namelist())

    for name, spec in constants.DIMENSIONS.items():
        assert spec["member"] in members, f"{name}: {spec['member']} is not in the archive"
        with archive.open(spec["member"]) as fh:
            published = {row["Category"] for row in csv.DictReader(io.TextIOWrapper(fh, "utf-8"))}
        claimed = set()
        for key in spec["groups"]:
            claimed.update(constants.categories_for(key, name))
        missing = claimed - published
        assert not missing, f"{name}: registry names categories the file does not have: {sorted(missing)}"


# ------------------------------------------------- the per-dimension split (F10)


def test_the_index_does_not_carry_any_history():
    """The whole point of the split: the index is what loads at import, so it
    must stay small. Six axes of quarterly history in one document was 4.3 MB,
    and answering a question about one axis parsed all of it."""
    index = benchmarks.load_snapshot()
    assert "groups" not in index
    for name, entry in index["dimensions"].items():
        assert "groups" not in entry, f"{name} inlined its history into the index"
        assert entry["file"].endswith(".json"), name


def test_every_dimension_named_by_the_index_can_be_loaded():
    for name in benchmarks.dimension_names():
        groups = benchmarks.groups_in(name)
        assert set(groups) == set(constants.all_group_keys(name)), name


def test_a_missing_side_file_is_a_named_error_not_a_key_error(tmp_path, monkeypatch):
    """A half-copied data directory should say which file is missing and how to
    rebuild it, rather than surfacing as a bare KeyError from somewhere deep in
    a request."""
    index = dict(benchmarks.load_snapshot())
    index["dimensions"] = {"networth": {**index["dimensions"]["networth"], "file": "dimensions/gone.json"}}
    path = tmp_path / "dfa_snapshot.json"
    path.write_text(json.dumps(index))

    monkeypatch.setattr(benchmarks, "SNAPSHOT_PATH", path)
    benchmarks.load_snapshot.cache_clear()
    benchmarks.groups_in.cache_clear()
    try:
        with pytest.raises(benchmarks.SnapshotError, match="gone.json"):
            benchmarks.groups_in("networth")
    finally:
        monkeypatch.undo()
        benchmarks.load_snapshot.cache_clear()
        benchmarks.groups_in.cache_clear()


def test_an_older_single_file_snapshot_still_loads(tmp_path, monkeypatch):
    """A snapshot built before the split inlines its groups. Refusing to read
    one would turn a routine upgrade into a required data rebuild."""
    inline = dict(benchmarks.load_snapshot())
    inline["dimensions"] = {
        "networth": {
            **{k: v for k, v in inline["dimensions"]["networth"].items() if k != "file"},
            "groups": benchmarks.groups_in("networth"),
        }
    }
    path = tmp_path / "dfa_snapshot.json"
    path.write_text(json.dumps(inline))

    monkeypatch.setattr(benchmarks, "SNAPSHOT_PATH", path)
    benchmarks.load_snapshot.cache_clear()
    benchmarks.groups_in.cache_clear()
    try:
        assert set(benchmarks.groups_in("networth")) == set(constants.ALL_GROUPS)
    finally:
        monkeypatch.undo()
        benchmarks.load_snapshot.cache_clear()
        benchmarks.groups_in.cache_clear()
