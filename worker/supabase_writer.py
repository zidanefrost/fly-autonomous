"""Upsert weather + delay-risk rows into Supabase using the service-role key.

The service-role key bypasses Row Level Security, so this is the only code
path allowed to write — the frontend only ever reads with the anon key.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from supabase import Client, create_client

from metar_client import is_stale
from risk_engine import RiskResult


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def _visibility_to_text(visib) -> str | None:
    if visib is None:
        return None
    return str(visib)


def _build_weather_row(icao: str, metar: dict) -> dict:
    return {
        "icao": icao,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "obs_time": metar.get("reportTime"),
        "raw_metar": metar.get("rawOb"),
        "flight_category": metar.get("fltCat"),
        "wind_dir": str(metar.get("wdir")) if metar.get("wdir") is not None else None,
        "wind_speed_kt": metar.get("wspd"),
        "wind_gust_kt": metar.get("wgst"),
        "visibility_sm": _visibility_to_text(metar.get("visib")),
        "weather_string": metar.get("wxString"),
        "clouds": metar.get("clouds", []),
        "is_stale": is_stale(metar),
    }


def _build_risk_row(icao: str, risk: RiskResult) -> dict:
    return {
        "icao": icao,
        "score": risk.score,
        "level": risk.level,
        "factors": risk.factors,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def upsert_weather_and_risk(
    client: Client, metars_by_icao: dict[str, dict], risk_by_icao: dict[str, RiskResult]
) -> int:
    """Writes both tables in one pass. Returns the number of airports written."""
    weather_rows = [_build_weather_row(icao, metar) for icao, metar in metars_by_icao.items()]
    risk_rows = [_build_risk_row(icao, risk) for icao, risk in risk_by_icao.items()]

    if weather_rows:
        client.table("weather_observations").upsert(weather_rows).execute()
    if risk_rows:
        client.table("delay_risk").upsert(risk_rows).execute()

    return len(weather_rows)
