"""Every endpoint carries a worked example in the generated docs (BACKLOG F67).

Asserted rather than eyeballed because the failure mode is silent: a new
endpoint ships, `/docs` renders it with an empty grey box, and nobody notices
until someone tries to call it.
"""

import pytest

from app.main import create_app

NO_BODY = 204


def _resolve(schema, components):
    """Follow a `$ref`, and look through an array at its item type.

    Those are the only two shapes the endpoints produce: a model, or a list of
    one model. Anything else is new and should fail loudly here rather than be
    silently skipped.
    """
    if "$ref" in schema:
        return components[schema["$ref"].rsplit("/", 1)[-1]]
    if schema.get("type") == "array":
        return _resolve(schema["items"], components)
    return schema


def _example_of(content, components):
    body = content.get("application/json", {})
    if "example" in body or "examples" in body:
        return body.get("example", body.get("examples"))
    return _resolve(body.get("schema", {}), components).get("example")


def _operations(spec):
    for path, methods in spec["paths"].items():
        for verb, operation in methods.items():
            yield f"{verb.upper()} {path}", operation


@pytest.fixture(scope="module")
def spec():
    return create_app().openapi()


def test_every_response_has_an_example(spec):
    components = spec["components"]["schemas"]
    missing = [
        f"{name} -> {status}"
        for name, operation in _operations(spec)
        for status, response in operation["responses"].items()
        if status.startswith("2")
        and int(status) != NO_BODY
        and _example_of(response.get("content", {}), components) is None
    ]
    assert missing == []


def test_every_request_body_has_an_example(spec):
    components = spec["components"]["schemas"]
    missing = [
        name
        for name, operation in _operations(spec)
        if "requestBody" in operation and _example_of(operation["requestBody"]["content"], components) is None
    ]
    assert missing == []


def test_the_portfolio_example_is_one_the_api_would_accept(client):
    """An example that does not validate is worse than none -- it is the first
    thing a reader pastes into the try-it box."""
    example = create_app().openapi()["components"]["schemas"]["PortfolioIn"]["example"]
    assert client.put("/api/portfolio?slug=example", json=example).status_code == 200
