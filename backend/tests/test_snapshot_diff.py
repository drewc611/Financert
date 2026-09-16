"""The refresh diff (BACKLOG F63).

Small hand-built snapshots rather than the committed 4 MB one: the thing under
test is what the tool *says* about a change, and a fixture you can read in one
screen is the only way to know the answer it gives is the right one. One case
at the end runs it against the real snapshot, to keep the reader honest about
the shape of a real file.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.snapshot_diff import SnapshotPair, compare, render  # noqa: E402

REAL_SNAPSHOT = Path(__file__).resolve().parents[1] / "data" / "dfa_snapshot.json"


def snapshot(tmp_path: Path, name: str, *, history, checksum="aaaa", periods=("2025-10-01", "2026-01-01")):
    """An index plus one dimension side file, the shape fetch_dfa.py writes."""
    folder = tmp_path / name
    (folder / "dimensions").mkdir(parents=True)
    (folder / "dimensions" / "networth.json").write_text(
        json.dumps({"groups": {"top1": {"key": "top1", "label": "Top 1%", "history": history}}})
    )
    index = {
        "source": {"archive_sha256": checksum, "retrieved_at": f"2026-01-01T00:00:00+00:00 {name}"},
        "periods": list(periods),
        "latest_period": periods[-1],
        "default_dimension": "networth",
        "dimensions": {"networth": {"key": "networth", "label": "Net worth", "file": "dimensions/networth.json"}},
        "asset_classes": [{"key": "corporate_equities"}, {"key": "real_estate"}],
    }
    path = folder / "dfa_snapshot.json"
    path.write_text(json.dumps(index))
    return path


def row(period, equities, real_estate):
    return {"period": period, "assets": {"corporate_equities": equities, "real_estate": real_estate}}


BASE = [row("2025-10-01", 500, 500), row("2026-01-01", 600, 400)]


def test_an_unchanged_snapshot_reports_nothing(tmp_path):
    old = snapshot(tmp_path, "old", history=BASE)
    new = snapshot(tmp_path, "new", history=BASE)
    report = compare(SnapshotPair(old, new))
    assert report["revisions"] == []
    assert report["periods_added"] == []
    assert "No revisions" in render(report)


def test_a_new_quarter_is_not_a_revision(tmp_path):
    """The common case, and the one a refresh is usually for: everything that
    was there is untouched, and there is one more quarter."""
    old = snapshot(tmp_path, "old", history=BASE)
    new = snapshot(
        tmp_path,
        "new",
        history=[*BASE, row("2026-04-01", 700, 300)],
        periods=("2025-10-01", "2026-01-01", "2026-04-01"),
    )
    report = compare(SnapshotPair(old, new))
    assert report["periods_added"] == ["2026-04-01"]
    assert report["revisions"] == []
    assert report["revised_rows"] == 0


def test_a_restated_quarter_is_reported_in_percentage_points(tmp_path):
    """The Fed revises published quarters, and this is the change that alters a
    number someone has already been shown."""
    old = snapshot(tmp_path, "old", history=BASE)
    revised = [row("2025-10-01", 550, 450), row("2026-01-01", 600, 400)]
    new = snapshot(tmp_path, "new", history=revised)
    report = compare(SnapshotPair(old, new))

    assert report["revised_rows"] == 1
    by_class = {r["asset_class"]: r["change_pp"] for r in report["revisions"]}
    assert by_class["corporate_equities"] == pytest.approx(5.0)
    assert by_class["real_estate"] == pytest.approx(-5.0)
    assert all(r["period"] == "2025-10-01" for r in report["revisions"])
    assert "+5.000 pp" in render(report)


def test_a_dollar_revision_that_leaves_the_mix_alone_is_not_one(tmp_path):
    """Shares, not dollars: every balance sheet grows, and a tool that called
    that a revision would report the whole population as revised every time."""
    old = snapshot(tmp_path, "old", history=BASE)
    new = snapshot(tmp_path, "new", history=[row("2025-10-01", 5000, 5000), row("2026-01-01", 6000, 4000)])
    assert compare(SnapshotPair(old, new))["revisions"] == []


def test_rounding_in_the_source_is_not_a_revision(tmp_path):
    """DFA levels are published in whole millions, so the smallest class of the
    smallest tier moves by a hair whenever anything is restated."""
    old = snapshot(tmp_path, "old", history=BASE)
    new = snapshot(tmp_path, "new", history=[row("2025-10-01", 500.01, 499.99), row("2026-01-01", 600, 400)])
    assert compare(SnapshotPair(old, new))["revisions"] == []


def test_structural_changes_are_named(tmp_path):
    """A class or a group appearing is the change that breaks something rather
    than moving it, so it is reported separately from the numbers."""
    old = snapshot(tmp_path, "old", history=BASE)
    new_path = snapshot(tmp_path, "new", history=BASE)
    index = json.loads(new_path.read_text())
    index["asset_classes"].append({"key": "crypto"})
    index["dimensions"]["wealth_by_pets"] = {"key": "wealth_by_pets", "groups": {}}
    new_path.write_text(json.dumps(index))

    side = new_path.parent / "dimensions" / "networth.json"
    groups = json.loads(side.read_text())
    groups["groups"]["top01"] = {"key": "top01", "label": "Top 0.1%", "history": BASE}
    side.write_text(json.dumps(groups))

    report = compare(SnapshotPair(old, new_path))
    assert report["classes_added"] == ["crypto"]
    assert report["dimensions_added"] == ["wealth_by_pets"]
    assert report["groups_added"] == ["networth/top01"]
    text = render(report)
    assert "Asset classes added: crypto" in text
    assert "Groups added: networth/top01" in text


def test_the_same_archive_says_so(tmp_path):
    """What the weekly source check sees when nothing has been published: the
    checksums match, and the tool says that rather than listing nothing."""
    old = snapshot(tmp_path, "old", history=BASE, checksum="deadbeefcafe")
    new = snapshot(tmp_path, "new", history=BASE, checksum="deadbeefcafe")
    assert "Same archive" in render(compare(SnapshotPair(old, new)))


def test_the_committed_snapshot_compares_with_itself():
    """Against the real file: six dimensions, 147 quarters and side files on
    disk, which is the shape the fixtures above stand in for."""
    report = compare(SnapshotPair(REAL_SNAPSHOT, REAL_SNAPSHOT))
    assert report["revisions"] == []
    assert report["dimensions_added"] == []
    assert report["periods_added"] == []
