import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from metar_client import BATCH_SIZE, fetch_metars


def test_one_failing_batch_does_not_lose_other_batches():
    """Regression test: a transient 502 on one batch previously crashed the
    whole fetch via raise_for_status(), wiping out every other airport's
    data for that refresh cycle (this happened in production)."""
    codes = [f"AA{i:02d}" for i in range(BATCH_SIZE + 5)]  # forces two batches

    def handler(request: httpx.Request) -> httpx.Response:
        ids = request.url.params["ids"].split(",")
        if ids[0] == codes[0]:
            return httpx.Response(502, text="Bad Gateway")
        return httpx.Response(
            200,
            json=[{"icaoId": icao, "fltCat": "VFR"} for icao in ids],
        )

    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport)

    results = fetch_metars(codes, client=client)

    assert all(icao not in results for icao in codes[:BATCH_SIZE])
    assert all(icao in results for icao in codes[BATCH_SIZE:])


def test_204_empty_response_does_not_crash():
    """Regression test: aviationweather.gov returns HTTP 204 with an empty
    body (not "[]") when none of the requested ids have any data — this isn't
    an HTTP error, but resp.json() on an empty body raises, which crashed a
    single-airport lookup with an unknown/invalid code (production bug)."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(204, content=b"")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    assert fetch_metars(["ZZZZ"], client=client) == {}
