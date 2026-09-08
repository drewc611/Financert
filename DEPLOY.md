# Deploying

Two things need to be reachable on the public internet before Financert can be
submitted to either AI directory: the **MCP server**, over HTTPS at a stable
URL, and the **privacy policy**, at a URL a reviewer can open.

This covers both. [SUBMISSION.md](SUBMISSION.md) is what to do once they exist.

---

## The MCP server

`backend/Dockerfile.mcp` builds an image that serves the six read-only tools
over streamable HTTP. It is separate from `backend/Dockerfile` (the REST API)
on purpose: it never opens the database, so there is no volume, no backup and
no secret to manage. That is also what makes the privacy answer a short one.

### Configuration

Every flag has an environment variable, because that is how container hosts
configure a process.

| Variable | Flag | Default | |
|---|---|---|---|
| `PORT` | `--port` | 8080 | The convention on Fly, Render, Railway, Cloud Run and Heroku. |
| `FINANCERT_MCP_HOST` | `--host` | `127.0.0.1` | The image sets `0.0.0.0`; a process behind a platform proxy is unreachable on loopback. |
| `FINANCERT_MCP_ALLOWED_ORIGINS` | `--allowed-origin` | — | Comma-separated. **Set this.** |
| `FINANCERT_MCP_ALLOWED_HOSTS` | `--allowed-host` | derived from the origins | Only needed when `Host` and `Origin` genuinely differ — a CDN, a rewriting proxy. |

**Setting the origins is the one step that matters.** Left unset, the server
falls back to localhost-only and refuses everything that arrives through the
proxy — it warns on stderr when it does this. Bound to `0.0.0.0` with no
origin allowlist, a hosted server would answer requests forged by any page the
user happens to be visiting.

Allowed hosts are derived from the origins because the two are the same value
in almost every deployment: the platform terminates TLS and forwards the
request with the *public* domain in `Host`, not the address the process bound
to. The SDK matches `Host` exactly, so a deployment that set only its origin
would otherwise reject every real request with 421.

### Fly

`backend/fly.toml` is ready to use. It lives in `backend/` because the build
context is the directory holding it.

```bash
cd backend
fly launch --copy-config --no-deploy   # pick a name; app names are global
```

Then edit two lines in `fly.toml` to match the name you chose — `app` and the
hostname inside `FINANCERT_MCP_ALLOWED_ORIGINS` — and deploy:

```bash
fly deploy
```

`auto_stop_machines` is off deliberately. Streamable HTTP holds a session open
across requests; stopping the machine mid-session drops it.

### Anywhere else

It is a plain container. Render, Railway, Cloud Run, a VPS behind nginx — all
work. Whatever the host, it must:

- set `FINANCERT_MCP_ALLOWED_ORIGINS` to the public HTTPS origin,
- terminate TLS (directories require HTTPS),
- forward the real `Host` header (any reverse proxy does by default; nginx
  needs `proxy_set_header Host $host;` if you have overridden it),
- health-check with a **TCP** connect, not an HTTP request — every MCP route
  validates `Host` and `Origin` before answering, so an HTTP probe gets a 4xx
  that says nothing about health.

### Locally, the way it will really run

```bash
docker compose --profile mcp up --build   # :8081
```

Or without Docker:

```bash
cd backend
FINANCERT_MCP_HOST=0.0.0.0 PORT=8081 \
  FINANCERT_MCP_ALLOWED_ORIGINS=https://financert-mcp.example \
  python mcp_server.py --http
```

### Verifying a deployment

Run these against the real host before submitting. They take a minute and they
check the thing a reviewer checks. Substitute your domain; against a local
run, keep `127.0.0.1:8081` as the connect address and pass the domain in
`Host` — which is exactly what the platform's proxy does.

```bash
BODY='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
  "protocolVersion":"2025-06-18","capabilities":{},
  "clientInfo":{"name":"probe","version":"1"}}}'
HDRS=(-H 'Content-Type: application/json'
      -H 'Accept: application/json, text/event-stream')

# 1. What an MCP client actually sends: correct Host, no Origin.  -> 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://YOUR.DOMAIN/mcp \
  "${HDRS[@]}" -d "$BODY"

# 2. A forged Origin.                                            -> 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://YOUR.DOMAIN/mcp \
  -H 'Origin: https://evil.example' "${HDRS[@]}" -d "$BODY"

# 3. An unrecognised Host.                                       -> 421
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://YOUR.DOMAIN/mcp \
  -H 'Host: 127.0.0.1:8080' "${HDRS[@]}" -d "$BODY"
```

`200 / 403 / 421`. Anything else means the allowlist is wrong, and the two
failure modes look nothing alike: a 421 on probe 1 is a server nobody can
reach, while a 200 on probe 2 is a server anybody can drive from a web page.

Then connect a real client and call one tool — probe 1 only proves the
handshake, not that the data snapshot shipped in the image.

---

## The privacy policy

`.github/workflows/pages.yml` publishes `docs/` to GitHub Pages on every push
to `main`. `PRIVACY.md` is rendered into the site at publish time rather than
copied into `docs/`, so the two cannot drift.

One-time setup: **Settings → Pages → Source: GitHub Actions**. The pages land
at:

- `https://<user>.github.io/Financert/` — overview
- `https://<user>.github.io/Financert/mcp.html` — tools and example prompts
- `https://<user>.github.io/Financert/privacy.html` — the policy

The policy is accurate against the code and says on its face that it has not
been reviewed by a lawyer. It needs both a legal read and a monitored contact
address before it backs a real submission.

---

## The REST API and dashboard

Not required by any directory — the MCP server is a self-contained subset of
the same code. If you do host them:

- **Set `FINANCERT_API_TOKEN`.** Without it the portfolio routes are open.
  `openssl rand -hex 32`. Note what it is not: a single shared secret, so
  anyone holding it sees every portfolio on the install.
- **Set `FINANCERT_CORS_ORIGINS`** to the dashboard's real origin. The default
  is local dev ports, and `*` would silently disable credentialed requests.
- **Point `FINANCERT_DATABASE_URL` at persistent storage.** The default SQLite
  file lives in the container and dies with it.
- `/healthz` reports whether auth is on, so a deployment can be checked without
  guessing.
