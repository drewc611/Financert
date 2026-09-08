"""Package the MCP server as an MCP Bundle (.mcpb) — a desktop extension.

This is the distribution path that needs no hosting and no organisation: the
Claude connectors *portal* requires a Team or Enterprise org, but desktop
extensions go through a plain submission form, and the server they carry runs
locally over stdio rather than on someone's infrastructure.

    python tools/build_mcpb.py            # -> dist/financert.mcpb
    python tools/build_mcpb.py --stage-only

Two things are generated rather than committed, both to kill a drift risk:

* **manifest.json** is built from the listing block in SUBMISSION.md, so the
  bundle and the directory listing cannot describe the product differently.
* **the tools array** is read out of the running server, so the manifest
  cannot advertise a tool that no longer exists.

The bundle carries a *copy* of the modules it needs. That copy is made here at
pack time and never committed, the same arrangement `build_fallback.py` uses
for the frontend's embedded data.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
REPO = BACKEND.parent
SUBMISSION = REPO / "SUBMISSION.md"
STAGE = BACKEND / "dist" / "financert-mcpb"
BUNDLE = BACKEND / "dist" / "financert.mcpb"

# The exact module closure the six tools need: no FastAPI, no SQLAlchemy, no
# database. A test builds the bundle and imports it in a clean interpreter, so
# a missing entry here fails there rather than on a user's machine.
MODULES = (
    "app/__init__.py",
    "app/config.py",
    "app/constants.py",
    "app/services/__init__.py",
    "app/services/allocation.py",
    "app/services/benchmarks.py",
)
DATA = "data/dfa_snapshot.json"

# Manifest fields with no home in the listing metadata. `license` is absent on
# purpose: the repository has no LICENSE file, and inventing one here would be
# asserting terms nobody chose.
STATIC = {
    "manifest_version": "0.4",
    "author": {"name": "drewc611", "url": "https://github.com/drewc611"},
    "repository": {"type": "git", "url": "https://github.com/drewc611/Financert.git"},
    "keywords": ["finance", "wealth", "federal-reserve", "benchmark", "portfolio"],
    "compatibility": {
        "platforms": ["darwin", "linux", "win32"],
        "runtimes": {"python": ">=3.10"},
    },
}


def listing() -> dict:
    match = re.search(r"```json\n(.*?)\n```", SUBMISSION.read_text(), re.DOTALL)
    if not match:
        raise SystemExit(f"error: no fenced JSON listing block in {SUBMISSION}")
    return json.loads(match.group(1))


def tools() -> list[dict]:
    sys.path.insert(0, str(BACKEND))
    import mcp_server

    return [{"name": tool.name, "description": tool.description} for tool in asyncio.run(mcp_server.mcp.list_tools())]


def manifest(meta: dict, declared: list[dict]) -> dict:
    doc = {
        **STATIC,
        # Machine-readable name: lowercase, no spaces. `display_name` carries
        # the human one.
        "name": "financert",
        "display_name": meta["name"],
        "version": "0.1.0",
        "description": meta["tagline"],
        "long_description": meta["description"],
        "icon": "icon.png",
        "homepage": meta["source_url"],
        "documentation": meta["docs_url"],
        "support": f"{meta['source_url']}/issues",
        "server": {
            "type": "uv",
            "entry_point": "src/server.py",
            "mcp_config": {"command": "uv", "args": ["run", "--directory", "${__dirname}", "src/server.py"]},
        },
        "tools": declared,
        "tools_generated": False,
    }
    # Only meaningful once the policy is actually published; a dead URL in a
    # submitted bundle is worse than an absent optional field.
    if meta["privacy_url"].startswith("https://"):
        doc["privacy_policies"] = [meta["privacy_url"]]
    return doc


def stage() -> Path:
    meta = listing()
    declared = tools()

    if STAGE.exists():
        shutil.rmtree(STAGE)
    (STAGE / "src").mkdir(parents=True)

    (STAGE / "manifest.json").write_text(json.dumps(manifest(meta, declared), indent=2) + "\n")

    for name in ("pyproject.toml", ".mcpbignore", "icon.png"):
        shutil.copy2(BACKEND / "mcpb" / name, STAGE / name)

    # The entry point. `uv run src/server.py` puts src/ on sys.path, so the
    # `app` package below it resolves exactly as it does in the repo.
    shutil.copy2(BACKEND / "mcp_server.py", STAGE / "src" / "server.py")

    for rel in MODULES:
        dest = STAGE / "src" / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(BACKEND / rel, dest)

    # config.py resolves the snapshot relative to app/'s parent, which is src/.
    dest = STAGE / "src" / DATA
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(BACKEND / DATA, dest)

    return STAGE


def pack(root: Path) -> Path:
    BUNDLE.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(BUNDLE, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(root.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(root).as_posix())
    return BUNDLE


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--stage-only", action="store_true", help="write the tree but do not zip it")
    args = parser.parse_args()

    root = stage()
    print(f"staged {root}")
    if args.stage_only:
        return 0

    bundle = pack(root)
    print(f"packed {bundle} ({bundle.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
