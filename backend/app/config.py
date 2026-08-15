"""Infrastructure settings, read from the environment.

Business tunables do NOT belong here — they live in ``constants.py`` so there is
exactly one place to answer "where does this number come from".
"""

import os


def _csv(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


# SQLite by default so the project runs with no external services.
DATABASE_URL = os.getenv("FINANCERT_DATABASE_URL", "sqlite:///./financert.db")

# Wide open by default for local development. Lock this down before exposing
# the API to anything real.
CORS_ORIGINS = _csv("FINANCERT_CORS_ORIGINS", "*")

# The SEC requires a descriptive User-Agent with contact info on every request
# and will hard-block clients that omit it. See
# https://www.sec.gov/os/webmaster-faq#developers
SEC_USER_AGENT = os.getenv("FINANCERT_SEC_USER_AGENT", "Financert research contact@financert.local")

# The House Clerk site rejects obvious bot agents.
HOUSE_USER_AGENT = os.getenv("FINANCERT_HOUSE_USER_AGENT", "Mozilla/5.0 (compatible; Financert/0.1)")

# Politeness delay between upstream requests, seconds. The SEC's published
# ceiling is 10 requests/second; we stay well under it.
REQUEST_DELAY_SECONDS = float(os.getenv("FINANCERT_REQUEST_DELAY", "0.12"))

HTTP_TIMEOUT_SECONDS = float(os.getenv("FINANCERT_HTTP_TIMEOUT", "30"))
