"""Infrastructure settings, read from the environment."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("FINANCERT_DATABASE_URL", f"sqlite:///{BASE_DIR / 'financert.db'}")

SNAPSHOT_PATH = Path(os.getenv("FINANCERT_SNAPSHOT_PATH", BASE_DIR / "data" / "dfa_snapshot.json"))

# Defaults to the local dev origins rather than "*". A wide-open default is
# fine until the day someone deploys without reading the README, and then it
# is not; set this explicitly in any real deployment.
# 5173 is `npm run dev`, 4173 is `npm run preview`, 8080 is the nginx image in
# docker-compose. Both hostnames are listed because an Origin header matches
# literally -- localhost and 127.0.0.1 are different origins to a browser.
DEFAULT_CORS_ORIGINS = ",".join(
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 4173, 8080)
)

CORS_ORIGINS = [
    origin.strip() for origin in os.getenv("FINANCERT_CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",") if origin.strip()
]

# Shared secret for the portfolio endpoints. Unset means no authentication,
# which is fine for `make run` on a laptop and wrong for anything reachable
# from outside it -- /healthz reports which mode is active so a deployment can
# be checked without guessing. The container image sets FINANCERT_ENV=production,
# and in that mode the app refuses to start without a token (see
# check_auth_configuration) unless the open mode is opted into explicitly.
API_TOKEN = os.getenv("FINANCERT_API_TOKEN", "").strip()

AUTH_ENABLED = bool(API_TOKEN)

# Anything other than "production" is treated as local development.
IS_PRODUCTION = os.getenv("FINANCERT_ENV", "development").strip().lower() == "production"

# Explicit opt-out for a production-mode install that really is meant to have
# open portfolio routes (a household server on a network nobody else can reach).
ALLOW_OPEN_PORTFOLIO = os.getenv("FINANCERT_ALLOW_OPEN_PORTFOLIO", "").strip().lower() in {"1", "true", "yes"}


class InsecureConfigurationError(RuntimeError):
    """The environment asks for a production start with the portfolio routes open."""


def check_auth_configuration() -> None:
    """Refuse a production start with no token, unless open mode was chosen.

    Reads the module attributes at call time so tests can patch them, the same
    way ``dependencies.require_token`` does.
    """
    if AUTH_ENABLED or not IS_PRODUCTION or ALLOW_OPEN_PORTFOLIO:
        return
    raise InsecureConfigurationError(
        "FINANCERT_ENV=production but FINANCERT_API_TOKEN is not set, so every "
        "/api/portfolio* route would be open to anyone who can reach this server. "
        "Set FINANCERT_API_TOKEN (for example `openssl rand -hex 32`), or set "
        "FINANCERT_ALLOW_OPEN_PORTFOLIO=true if open access is intended."
    )


# Credentialed CORS plus a wildcard origin is a combination browsers reject
# outright, and it would be a real hole if they did not. Only send credentials
# when the origin list is a real allowlist.
ALLOW_CREDENTIALS = "*" not in CORS_ORIGINS
