"""Fetch + normalize METAR observations from aviationweather.gov (free, no API key)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("metar_client")

METAR_ENDPOINT = "https://aviationweather.gov/api/data/metar"
BATCH_SIZE = 50  # stay well under the documented 400-entries-per-response cap
STALE_AFTER_MINUTES = 90


def fetch_metars(icao_codes: list[str], client: httpx.Client | None = None) -> dict[str, dict]:
    """Returns {icao: raw_metar_dict} for every code the API had data for.

    Codes with no current observation (e.g. temporarily offline station) are
    simply absent from the result rather than raising — callers should treat
    missing airports as "no data" rather than an error. Likewise, a transient
    upstream failure (the API occasionally 502s) only drops that one batch —
    it must not crash the whole refresh cycle and lose every other airport's
    data for this run.
    """
    owns_client = client is None
    client = client or httpx.Client(timeout=20.0)
    results: dict[str, dict] = {}
    try:
        for i in range(0, len(icao_codes), BATCH_SIZE):
            batch = icao_codes[i : i + BATCH_SIZE]
            try:
                resp = client.get(METAR_ENDPOINT, params={"ids": ",".join(batch), "format": "json"})
                resp.raise_for_status()
            except httpx.HTTPError:
                logger.warning("METAR batch fetch failed for %s, skipping batch", batch, exc_info=True)
                continue
            for entry in resp.json():
                icao = entry.get("icaoId")
                if icao:
                    results[icao] = entry
    finally:
        if owns_client:
            client.close()
    return results


def is_stale(metar: dict, now: datetime | None = None) -> bool:
    report_time = metar.get("reportTime")
    if not report_time:
        return True
    now = now or datetime.now(timezone.utc)
    observed = datetime.fromisoformat(report_time.replace("Z", "+00:00"))
    age_minutes = (now - observed).total_seconds() / 60
    return age_minutes > STALE_AFTER_MINUTES
