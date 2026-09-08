.PHONY: install seed fetch run mcp mcp-http mcpb icon test lint fmt clean

install:
	pip install -r requirements.txt -r requirements-dev.txt

seed:
	python seed.py

fetch:
	python fetch_dfa.py

run:
	uvicorn app.main:app --reload --port 8000

mcp:
	python mcp_server.py

# Hosting needs the real origin; localhost is only right for local testing.
mcp-http:
	python mcp_server.py --http --port 8080 --allowed-origin http://127.0.0.1:8080

# The desktop-extension bundle -- the submission path that needs no hosting
# and no Team/Enterprise organisation. Writes dist/financert.mcpb.
mcpb:
	python tools/build_mcpb.py

icon:
	python tools/make_icon.py

test:
	pytest

lint:
	ruff check .

fmt:
	ruff check --select I --fix . && ruff format .

clean:
	rm -f financert.db
	rm -rf dist
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache
