# Security audit — 2026-09-06

Self-audit of the Financert codebase, prompted by the data-source migration
adding code that downloads and parses a remote archive.

**Scope:** the whole application — backend API, auth, data ingestion, frontend,
container config, dependencies. **Method:** manual review with a working
exploit or proof for each finding, rather than pattern-matching.

Everything below is fixed, with regression tests in
[`backend/tests/test_security.py`](backend/tests/test_security.py).

---

## Findings

### 1. Unbounded download and decompression — Medium

`fetch_dfa.py` read the remote archive with `resp.read()` and parsed the
extracted member with `list(csv.DictReader(...))`. Neither was bounded.

**Proof.** A 161 KB zip with a 412:1 compression ratio was accepted without
complaint, taking peak RSS from 149 MB to **1,343 MB**:

```
zip on the wire : 161 KB
expands to      : 65 MB  (ratio 412:1)
read_member()   : accepted 4,000,000 rows, no limit enforced
peak RSS        : 149 MB -> 1343 MB
```

The failure mode is an OOM kill, not an error — so it takes out whatever else
shares the box.

**Reachability is low.** The URL is hardcoded and HTTPS, so this needs a
compromised `federalreserve.gov` or a broken TLS chain. It is graded Medium
rather than High for that reason. The guard is nearly free, and the honest
version of "we trust the Fed" is still "we don't let one response OOM us".

**Fixed** with three bounds: 20 MB on the download, 200 MB on the member's
*declared* size checked before decompressing, and 200,000 rows on what is
actually read — because the declared size is only a claim.

### 2. `docker-compose.yml` re-opened CORS to `*` — Medium

The compose file still set `FINANCERT_CORS_ORIGINS: "*"`, left from before the
allowlist default. Anyone running `docker compose up` got the wide-open
behaviour the application code had moved away from, silently.

It also disabled credentialed requests as a side effect — the app only sends
credentials when the origin list is a real allowlist, since browsers reject
wildcard-plus-credentials.

**Fixed**: scoped to the frontend service's actual origin, with a commented
`FINANCERT_API_TOKEN` line so the auth switch is discoverable at the place
someone deploys from.

### 3. Non-ASCII bearer token returned 500 instead of 401 — Low

`secrets.compare_digest` raises `TypeError` when either `str` argument
contains non-ASCII. The credential is attacker-controlled.

**Reachability required checking.** A well-behaved HTTP client refuses to
encode a non-ASCII header at all — `httpx` raises `UnicodeEncodeError` before
the request leaves. But HTTP header values are latin-1 on the wire, so a raw
socket can send high bytes and Starlette hands the dependency a non-ASCII
`str`:

```
latin-1 decoded header value: 'Bearer tokén'
str compare: TypeError -> comparing strings with non-ASCII characters is not supported
```

So: real, but only reachable by a client that bypasses a normal HTTP library.
Impact is an unhandled 500 and a noisy traceback, not a bypass — the
comparison never returns true.

**Fixed** by comparing UTF-8 bytes. The regression test exercises the
dependency directly, since the test client cannot construct the input.

---

## Checked and clean

Recorded so the next audit knows what was already looked at.

| Area | Result |
|---|---|
| SQL injection | No raw SQL anywhere. SQLAlchemy ORM with bound parameters throughout. |
| Path traversal in the archive | Members are opened by exact name via `archive.open()` and never extracted to disk, so a crafted member name has nothing to traverse into. Test included. |
| TLS | No `verify=False`, no unverified context, no `CERT_NONE`. urllib verifies by default. |
| XSS | No `dangerouslySetInnerHTML`, `eval`, `new Function` or `innerHTML` in the frontend. React escapes by default. |
| Secrets in the repo | None. No key-shaped literals in tracked files. |
| Slug handling | Pattern-validated `^[a-z0-9][a-z0-9-]{0,62}$` before reaching a query. No ReDoS shape. Traversal, encoded traversal and SQL-ish payloads all tested. |
| Holdings input | Asset classes whitelisted against the taxonomy; values constrained `>= 0`; duplicates rejected. |
| Timing attacks on the token | Constant-time comparison retained. |
| npm dependencies | `npm audit --omit=dev`: 0 vulnerabilities. |
| Frontend token storage | `localStorage`, which is exposed to XSS by design — acceptable only because there is no XSS vector and the API is a separate origin, making a bearer header the right choice over a cookie. Revisit if the app ever renders untrusted content. |

## Accepted risks

Not defects — deliberate positions, recorded so they are chosen rather than
inherited.

- **The bearer token is a shared secret, not a login.** Anyone holding it sees
  every portfolio on the install. Correct for a self-hosted single-household
  tool; wrong for anything multi-tenant. Documented in the README, and real
  accounts are on the backlog rather than implied to exist.
- **Auth is off when `FINANCERT_API_TOKEN` is unset.** This makes `make run`
  work with no setup, and is the wrong default for anything exposed.
  `/healthz` reports `auth_enabled` so a deployment can be checked rather than
  assumed.
- **No rate limiting.** Single-user tool, no login to brute-force, and the
  benchmark endpoints serve public data. Would need revisiting before any
  public deployment.
- **`/healthz` discloses configuration posture** (`auth_enabled`,
  `cors_wildcard`, origin count). Deliberate — it is what makes a
  misconfigured deployment detectable — and it exposes no values.
- **Malformed numeric cells parse as `0.0`** rather than failing. A silent
  zero is normally a bad default, but the reconciliation check would catch any
  material amount of it, and the alternative is a refresh that dies on one
  stray cell.
