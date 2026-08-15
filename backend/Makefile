.PHONY: install seed run refresh test lint fmt fallback clean

VENV ?= .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip

install:
	python3 -m venv $(VENV)
	$(PIP) install -q -r requirements.txt -r requirements-dev.txt

seed:            ## fabricate sample data, no network needed
	$(PY) seed.py --reset

refresh:         ## pull real filings from all three sources (slow, hits the network)
	$(PY) refresh.py

run:
	$(VENV)/bin/uvicorn app.main:app --reload --port 8000

fallback:        ## regenerate the frontend's offline snapshot from the current DB
	$(PY) export_fallback.py

test:
	$(PY) -m pytest

lint:
	$(VENV)/bin/ruff check .

fmt:
	$(VENV)/bin/ruff check --select I --fix .
	$(VENV)/bin/ruff format .

clean:
	rm -f financert.db
	rm -rf .pytest_cache .ruff_cache **/__pycache__
