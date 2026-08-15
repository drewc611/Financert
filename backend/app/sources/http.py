"""A deliberately polite HTTP client.

Two of the three upstreams are government services with published rate limits
and a real willingness to block. The SEC requires a contact-bearing
User-Agent and caps clients at 10 req/s; the House Clerk site rejects obvious
bots. Every outbound request in this project goes through here so those rules
live in one place.
"""

import time

import httpx

from ..config import HTTP_TIMEOUT_SECONDS, REQUEST_DELAY_SECONDS

_last_request_at: dict[str, float] = {}


def _throttle(host: str) -> None:
    """Space requests to the same host by at least REQUEST_DELAY_SECONDS."""
    previous = _last_request_at.get(host)
    now = time.monotonic()
    if previous is not None:
        wait = REQUEST_DELAY_SECONDS - (now - previous)
        if wait > 0:
            time.sleep(wait)
    _last_request_at[host] = time.monotonic()


def get(url: str, user_agent: str, *, accept: str = "*/*") -> httpx.Response:
    """GET with throttling and a descriptive User-Agent. Raises on 4xx/5xx."""
    host = httpx.URL(url).host or url
    _throttle(host)
    response = httpx.get(
        url,
        headers={"User-Agent": user_agent, "Accept": accept, "Accept-Encoding": "gzip, deflate"},
        timeout=HTTP_TIMEOUT_SECONDS,
        follow_redirects=True,
    )
    response.raise_for_status()
    return response


def get_json(url: str, user_agent: str):
    return get(url, user_agent, accept="application/json").json()


def get_bytes(url: str, user_agent: str) -> bytes:
    return get(url, user_agent).content
