import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from taf_client import fetch_tafs


def test_204_empty_response_does_not_crash():
    """Same class of bug as metar_client: AWC returns HTTP 204 with an empty
    body for an id with no current TAF, which isn't an HTTP error but breaks
    a naive resp.json() call."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(204, content=b"")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    assert fetch_tafs(["ZZZZ"], client=client) == {}
