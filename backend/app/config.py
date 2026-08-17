"""Infrastructure settings, read from the environment."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("FINANCERT_DATABASE_URL", f"sqlite:///{BASE_DIR / 'financert.db'}")

SNAPSHOT_PATH = Path(os.getenv("FINANCERT_SNAPSHOT_PATH", BASE_DIR / "data" / "dfa_snapshot.json"))

CORS_ORIGINS = [origin.strip() for origin in os.getenv("FINANCERT_CORS_ORIGINS", "*").split(",") if origin.strip()]
