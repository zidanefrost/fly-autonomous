"""Fetch TAF (Terminal Aerodrome Forecast) data from aviationweather.gov.

Same free, no-key data family as metar_client, but TAFs are forecasts (one
issuance covering roughly the next 24-30 hours in several time-bounded
periods) rather than a single current observation.
"""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger("taf_client")

TAF_ENDPOINT = "https://aviationweather.gov/api/data/taf"
BATCH_SIZE = 50


def fetch_tafs(icao_codes: list[str], client: httpx.Client | None = None) -> dict[str, dict]:
    """Returns {icao: raw_taf_dict} for every code the API had a current TAF for.

    Mirrors metar_client.fetch_metars: missing codes are simply absent, and a
    transient upstream failure only drops that one batch rather than the
    whole request.
    """
    owns_client = client is None
    client = client or httpx.Client(timeout=20.0)
    results: dict[str, dict] = {}
    try:
        for i in range(0, len(icao_codes), BATCH_SIZE):
            batch = icao_codes[i : i + BATCH_SIZE]
            try:
                resp = client.get(TAF_ENDPOINT, params={"ids": ",".join(batch), "format": "json"})
                resp.raise_for_status()
                # AWC returns 204 No Content (empty body) when none of the
                # requested ids have a current TAF — not an HTTP error, but
                # not JSON either.
                entries = resp.json() if resp.content else []
            except (httpx.HTTPError, ValueError):
                logger.warning("TAF batch fetch failed for %s, skipping batch", batch, exc_info=True)
                continue
            for entry in entries:
                icao = entry.get("icaoId")
                if icao:
                    results[icao] = entry
    finally:
        if owns_client:
            client.close()
    return results
