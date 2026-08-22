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
# which is the right default for `make run` on a laptop and the wrong one for
# anything reachable from outside it -- /healthz reports which mode is active
# so a deployment can be checked without guessing.
API_TOKEN = os.getenv("FINANCERT_API_TOKEN", "").strip()

AUTH_ENABLED = bool(API_TOKEN)

# Credentialed CORS plus a wildcard origin is a combination browsers reject
# outright, and it would be a real hole if they did not. Only send credentials
# when the origin list is a real allowlist.
ALLOW_CREDENTIALS = "*" not in CORS_ORIGINS
