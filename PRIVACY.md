# Privacy policy — Financert

**Status: draft.** This describes what the software actually does today,
verified against the code. It has not been reviewed by a lawyer. Before
publishing it at a public URL for a directory submission or an app store
listing, get it reviewed — and re-check it against the code, because the
claims below are only true while the code stays as described.

Last updated: 2026-09-07

---

## The short version

Financert compares a portfolio against public Federal Reserve statistics. The
benchmark data is public. Your holdings are yours.

- **The MCP server stores nothing at all.** Holdings you pass to it are used to
  compute an answer and discarded when the response is returned.
- **The REST API stores holdings only on the server you run it on**, in a local
  SQLite file. There is no hosted service and nothing is sent anywhere.
- **No analytics, no tracking, no third-party scripts, no advertising.**
- **No accounts, so no email address, name, or password is ever collected.**

## What each component handles

### MCP server (`backend/mcp_server.py`)

Exposes six read-only tools. Every one is a pure function of its arguments and
a data file committed to the repository.

| | |
|---|---|
| Collected | Nothing persistent. Tool arguments exist in memory for the duration of one call. |
| Stored | Nothing. No database, no files written, no logs of arguments. |
| Shared | Nothing. The server makes no outbound requests while serving. |
| Retention | None. |

Holdings passed to `compare_allocation` are financial information about you.
They are used to compute the comparison and then discarded. They are not
written to disk, not logged, and not transmitted onward.

Note that if you use this server through an AI assistant, **that assistant's
own privacy policy governs the conversation**, including anything you typed to
it. Financert has no visibility into or control over that.

### REST API (`backend/app/`)

| | |
|---|---|
| Collected | Portfolio holdings you explicitly save: an asset-class label and a dollar amount, plus a name and slug you choose. |
| Stored | In a SQLite file on the machine running the server. |
| Shared | Nothing. The API makes no outbound requests. |
| Retention | Until you delete the portfolio (`DELETE /api/portfolio`) or delete the database file. |

There are no user accounts. Access is controlled by a single shared bearer
token, if one is configured. **Anyone holding that token can read every
portfolio on that install** — it is not per-user isolation, and it should not
be relied on as such.

### Dashboard (`frontend/`)

Uses browser `localStorage` for your holdings, your theme choice, and the API
token if you enter one. That data stays in your browser. No cookies are set, no
analytics or third-party scripts are loaded, and no requests go anywhere except
the Financert API you point it at.

Clearing site data removes all of it.

## Data we fetch

`fetch_dfa.py` downloads the Federal Reserve's public Distributional Financial
Accounts archive. That is an outbound request to `federalreserve.gov`,
containing no information about you — it is a plain file download, run by
whoever maintains the deployment, not triggered by users.

## Children

Not directed at children and collects nothing that would identify anyone,
including children.

## Changes

Material changes will update the date above. The repository's git history is
the authoritative record of what changed and when.

## Contact

Via the repository: <https://github.com/drewc611/Financert>

*(A directory or app-store submission will require a monitored contact address
here. Add one before submitting.)*
