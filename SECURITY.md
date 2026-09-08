# Security policy

## Reporting a vulnerability

**Report privately through GitHub**, not in a public issue:
[Security → Advisories → Report a vulnerability](https://github.com/drewc611/Financert/security/advisories/new).

That route exists so a report can be discussed and fixed before it is public,
and it needs no email address on either side.

> Private vulnerability reporting is a repository setting. If that link 404s,
> it has not been switched on yet — **Settings → Advanced Security → Private
> vulnerability reporting**. Until then, open a normal issue saying only that
> you have found something, with no details, and wait to be contacted.

This is an unfunded prototype maintained by one person. Reports are handled on
a best-effort basis with no response-time guarantee. Saying so plainly is
better than publishing an SLA that will not be met.

## What is in scope

The code in this repository: the FastAPI backend, the MCP server, the
dashboard, the data-refresh script, and the packaging that ships them.

Especially interesting:

- **Anything reachable before authentication.** The benchmark routes and every
  MCP tool are unauthenticated by design.
- **The MCP HTTP transport's Host/Origin validation.** If a forged `Origin`
  gets a 200, that is a real finding — see [DEPLOY.md](DEPLOY.md) for the
  probes and their expected `200 / 403 / 421`.
- **`fetch_dfa.py`.** It parses a remote archive. It bounds the download, the
  declared member size and the row count, because without those a 161 KB zip
  expands to gigabytes. A way past those bounds is a finding.
- **Anything that writes.** `/api/portfolio*` is the only write surface, and it
  is the only thing the shared token gates.

## What is *not* a vulnerability

These are documented design decisions, not oversights. Reporting them is not
useful, and [SECURITY-AUDIT.md](SECURITY-AUDIT.md) records why each was
accepted:

- **The API token is a single shared secret, not a per-user login.** Anyone
  holding it can read every portfolio on that install. That fits a self-hosted
  single-household tool. "I used the token and saw someone else's portfolio" is
  the documented behaviour. Real multi-tenancy would need accounts, per-user
  ownership and sessions — a different piece of work.
- **Authentication is off when `FINANCERT_API_TOKEN` is unset.** That is the
  right default for `make run` on a laptop and the wrong one for anything
  reachable from elsewhere. `/healthz` reports which mode is live so a
  deployment can be checked rather than guessed.
- **The benchmark endpoints and MCP tools are open.** They serve public Federal
  Reserve data. There is nothing to protect.
- **The MCP server has no auth and stores nothing.** Both are deliberate; see
  [PRIVACY.md](PRIVACY.md).
- **Numbers you disagree with.** Wrong output is a bug, not a vulnerability —
  open an issue. If the taxonomy stops reconciling against the Fed's published
  totals, `fetch_dfa.py` already fails the refresh rather than shipping it.

## What is checked automatically

| | |
|---|---|
| [CodeQL](.github/workflows/codeql.yml) | Python, JavaScript/TypeScript, and the workflows themselves. Runs on every push and PR to `main`, plus weekly. |
| [Dependabot](.github/dependabot.yml) | Weekly updates for pip, npm and GitHub Actions. |
| [CI](.github/workflows/ci.yml) | `ruff`, `pytest`, `eslint`, and a production frontend build. |

### Not yet active — one setting each

Named here rather than left to be discovered, because a security control
everyone assumes is running is worse than one known to be off.

- **Dependency review.** [The workflow](.github/workflows/dependency-review.yml)
  is written and ready, but the repository's **dependency graph** is off, so
  the action exits with "Dependency review is not supported on this
  repository". Enable it under **Settings → Advanced Security → Dependency
  graph**, then change that workflow's trigger from `workflow_dispatch` back
  to `pull_request`. It is parked rather than left failing on purpose: a check
  that is red on every pull request for a reason no reviewer can act on is how
  a team learns to ignore red CI.
- **Secret scanning and push protection.** Repository settings, not files, so
  no pull request can turn them on. **Settings → Advanced Security**.
- **Private vulnerability reporting**, as above — it is what the reporting
  link at the top of this file depends on.

### A weaker control, deliberately

**Actions are pinned to tags, not commit SHAs.** A SHA pin is stronger, since
a tag can be moved under you. Dependabot watching `github-actions` is the
mitigation. If you want the stronger form, pin them to SHAs and let Dependabot
bump those instead.

## Supported versions

`main` only. This is a prototype with no releases; there is nothing to
backport to.
