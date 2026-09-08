"""Tests for the MCPB desktop-extension bundle.

The bundle carries a *copy* of the modules the tools need, assembled at pack
time. The failure that copy invites is a missing module — which cannot show up
in any other test here, because in this repo the import always resolves. It
shows up on a user's machine, as an extension that installs and then does
nothing.

So the load-bearing test runs the packed bundle as a real stdio MCP server in a
directory containing nothing but the bundle, and calls a tool.
"""

import json
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import build_mcpb  # noqa: E402


@pytest.fixture(scope="module")
def staged(tmp_path_factory) -> Path:
    """The bundle contents, assembled into an isolated directory.

    Copied out of the build's own output so the server under test cannot
    accidentally import from the repository around it.
    """
    root = tmp_path_factory.mktemp("bundle")
    source = build_mcpb.stage()
    target = root / "financert-mcpb"
    target.mkdir()
    for path in source.rglob("*"):
        dest = target / path.relative_to(source)
        if path.is_dir():
            dest.mkdir(exist_ok=True)
        else:
            dest.write_bytes(path.read_bytes())
    return target


@pytest.fixture(scope="module")
def manifest(staged) -> dict:
    return json.loads((staged / "manifest.json").read_text())


# --- the bundle actually runs -----------------------------------------------


def _rpc(proc, message):
    proc.stdin.write(json.dumps(message) + "\n")
    proc.stdin.flush()


def test_bundle_serves_its_tools_standalone(staged):
    """Run the entry point the way `uv run --directory <bundle> src/server.py`
    does, from a directory holding only the bundle. A module left out of the
    copied closure fails here instead of on a user's machine."""
    proc = subprocess.Popen(
        [sys.executable, "src/server.py"],
        cwd=staged,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env={"PATH": "/usr/bin:/bin", "HOME": str(staged)},
    )
    try:
        _rpc(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "1"},
                },
            },
        )
        assert json.loads(proc.stdout.readline())["result"]["serverInfo"]["name"] == "financert"

        _rpc(proc, {"jsonrpc": "2.0", "method": "notifications/initialized"})
        _rpc(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        tools = json.loads(proc.stdout.readline())["result"]["tools"]
        assert len(tools) == 6
        # Same guarantee as the hosted server, checked on the wire again here:
        # the bundle is a separate artifact and could drift from it.
        assert all(tool["annotations"]["readOnlyHint"] for tool in tools)

        _rpc(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "compare_allocation",
                    "arguments": {"holdings": {"corporate_equities": 60_000, "real_estate": 40_000}},
                },
            },
        )
        result = json.loads(json.loads(proc.stdout.readline())["result"]["content"][0]["text"])
        assert result["gaps"], "the snapshot did not make it into the bundle"
        assert result["closest_tier"]["tier"]
    finally:
        proc.stdin.close()
        proc.terminate()
        proc.wait(timeout=10)


# --- manifest conforms to the MCPB spec -------------------------------------


def test_required_manifest_fields_present(manifest):
    for field in ("manifest_version", "name", "version", "description", "author", "server"):
        assert manifest.get(field), f"manifest is missing required field {field}"
    assert manifest["author"].get("name")


def test_uv_runtime_and_no_vendored_dependencies(staged, manifest):
    """`uv` rather than `python` is forced: a traditional Python bundle must
    vendor its dependencies, and the MCP SDK needs pydantic, which is compiled
    and cannot be vendored portably. The spec then forbids server/lib and
    server/venv outright."""
    assert manifest["server"]["type"] == "uv"
    assert (staged / "pyproject.toml").exists()
    assert not (staged / "server" / "lib").exists()
    assert not (staged / "server" / "venv").exists()


def test_entry_point_and_icon_exist(staged, manifest):
    assert (staged / manifest["server"]["entry_point"]).exists()
    assert (staged / manifest["icon"]).exists()


def test_declared_tools_match_the_server(manifest):
    """A manifest advertising a tool the server no longer has is a listing that
    lies. Generated from the server for that reason; asserted here so a hand
    edit cannot reintroduce the gap."""
    declared = {tool["name"] for tool in manifest["tools"]}
    assert declared == {tool["name"] for tool in build_mcpb.tools()}
    assert manifest["tools_generated"] is False


def test_listing_metadata_is_shared_with_the_directory_submission(manifest):
    """One source of truth: the bundle and the portal listing must not describe
    the product differently."""
    meta = build_mcpb.listing()
    assert manifest["display_name"] == meta["name"]
    assert manifest["description"] == meta["tagline"]
    assert manifest["long_description"] == meta["description"]
    assert manifest["documentation"] == meta["docs_url"]


def test_privacy_policy_url_is_declared_over_https(manifest):
    """Missing or incomplete privacy policies are an immediate rejection."""
    assert manifest["privacy_policies"]
    assert all(url.startswith("https://") for url in manifest["privacy_policies"])


def test_declared_license_matches_the_repository(manifest):
    """The manifest may only claim terms the repo actually carries. Checked
    both ways: a LICENSE file with no manifest entry understates it, and a
    manifest entry with no LICENSE file asserts terms nobody agreed to."""
    licence_file = build_mcpb.REPO / "LICENSE"
    if not licence_file.exists():
        assert "license" not in manifest, "manifest claims a licence the repo does not carry"
        return

    assert manifest.get("license"), "repo has a LICENSE but the manifest does not name it"
    text = licence_file.read_text()
    # An SPDX identifier is not free-text: it has to be recognisable from the
    # file, or a reviewer reading both sees two different answers.
    assert manifest["license"] == "MIT" and text.startswith("MIT License"), (
        f"manifest says {manifest['license']!r}; LICENSE begins {text.splitlines()[0]!r}"
    )


# --- the packed archive ------------------------------------------------------


def test_packed_bundle_is_a_zip_with_the_manifest_at_its_root():
    """`.mcpb` is a zip, and the host reads manifest.json from the top level --
    a nested directory makes the bundle unreadable."""
    bundle = build_mcpb.pack(build_mcpb.stage())
    with zipfile.ZipFile(bundle) as archive:
        names = archive.namelist()
        assert "manifest.json" in names
        assert "src/server.py" in names
        assert "src/data/dfa_snapshot.json" in names
        assert not any(name.startswith("financert-mcpb/") for name in names)
