.PHONY: install seed fetch run test lint fmt clean

install:
	pip install -r requirements.txt -r requirements-dev.txt

seed:
	python seed.py

fetch:
	python fetch_dfa.py

run:
	uvicorn app.main:app --reload --port 8000

test:
	pytest

lint:
	ruff check .

fmt:
	ruff check --select I --fix . && ruff format .

clean:
	rm -f financert.db
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache
