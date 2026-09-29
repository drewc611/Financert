# Security audit — Financert — 2026-09-27

Part of a 22-repository audit of this account. The cross-repository report (method, pain points, business impact, solution analysis, roadmap) is published at https://claude.ai/artifact/KgdrC9eNyCwdqjvSfwMNuB.

## Summary for this repository

| Severity | Count |
|---|---|
| Low | 4 |

Automated passes run against this repository: gitleaks 8.24.2 (full history and tree), the placeholder-credential checker now shipped in `scripts/`, semgrep 1.178.0 (`p/security-audit`, `p/secrets`, `p/owasp-top-ten`, `p/github-actions`), bandit, pip-audit and npm audit where applicable, plus a manual review of auth, input handling, workflows and deployment files.

## Findings

| ID | Severity | Category | Location | Evidence | Impact | Fix | Status |
|---|---|---|---|---|---|---|---|
| FC-1 | Low | API image runs as root | `backend/Dockerfile:1-11` | No `USER` (the MCP image does set one) | Root in container. | Copy the `useradd`/`USER` lines from `Dockerfile.mcp`. | fixed (a008237) |
| FC-2 | Low | Portfolio routes open when the token is unset | `backend/app/config.py:30-32; dependencies.py:28-29` | `API_TOKEN = os.getenv("FINANCERT_API_TOKEN", "")`; auth skipped when empty | Documented single-household model; no production guard. | Warn loudly at startup when unset and bound to non-loopback. | fixed (695c7b8) |
| FC-3 | Low | Docker frontend without security headers | `frontend/nginx.conf:1-11` | No `add_header` directives | No CSP/XFO/nosniff on the Docker path; token in `localStorage` is exfiltratable by any XSS. | Add the standard header set. | fixed (d646b8b) |
| FC-4 | Low | Scheduled workflow with write scope on mutable tags | `.github/workflows/data-refresh.yml:17-30,98` | `contents: write`, `actions/checkout@v7`, `git push --force` to a rolling branch | Changes still land via reviewed PR. | Pin SHAs; scope the token. | fixed (dab1a91); other workflows still use tag-pinned actions (out of scope of this finding) |

## Guardrails added in this change

- `scripts/check-placeholder-secrets.sh` — fails the build on placeholder credentials, secret defaults, disabled-auth defaults, `debug=True`, literal secret assignments, private keys and committed `.env` files.
- `.gitleaks.toml` — gitleaks defaults plus custom placeholder rules and a fixture allowlist.
- `.github/workflows/secret-scan.yml` — runs both on every push and pull request and weekly over full history (SHA-pinned actions).
- `.pre-commit-config.yaml` — the same checks locally; run `pre-commit install` once.
- `docs/security/AI-CODING-GUARDRAILS.md` — the binding rules for any AI-assisted change, with references.
- A "Security rules for AI-assisted changes" section in `CLAUDE.md` (and `AGENTS.md` / Copilot instructions where present).
- `.gitignore` rules for `.env`, keys and Terraform state where they were missing.

See the cross-repository report for the fail-closed pattern by language and the prioritised fix list.
