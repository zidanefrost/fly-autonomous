"""Modal app — the autonomous monitoring agent.

One `modal.App` with several functions, deployed together via `modal deploy worker/app.py`:
  1. `refresh_all_airports` — cron, every 10 min: fetch -> score -> upsert -> alert.
  2. `trigger_refresh` — on-demand HTTP endpoint, same logic, for live-demo control.
  3. `ai_briefing` / `ai_briefing_status` — proxy to Manus AI so the API key never
     reaches the browser.
  4. `flight_forecast` — TAF-based delay-risk forecast + check-in advice for a
     given departure airport/time (and optional arrival airport).
"""

from datetime import datetime, timezone

import modal

from airports_seed import ICAO_CODES
from metar_client import fetch_metars
from risk_engine import RiskResult, forecast_risk, score_metar
from taf_client import fetch_tafs

import checkin_advice
import manus_client
import supabase_writer
import wassist_client

app = modal.App("otp-weather-risk")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("httpx", "supabase", "fastapi[standard]")
    .add_local_python_source(
        "risk_engine",
        "metar_client",
        "taf_client",
        "checkin_advice",
        "airports_seed",
        "supabase_writer",
        "manus_client",
        "wassist_client",
    )
)


def _run_refresh_cycle() -> dict:
    metars = fetch_metars(ICAO_CODES)
    risks = {icao: score_metar(metar) for icao, metar in metars.items()}

    client = supabase_writer.get_client()
    written = supabase_writer.upsert_weather_and_risk(client, metars, risks)

    alerts_sent = 0
    for icao, risk in risks.items():
        if risk.level in ("HIGH", "SEVERE"):
            name = metars[icao].get("name", icao)
            sent = wassist_client.send_delay_risk_alert(
                icao, name, risk.level, risk.score, risk.factors
            )
            alerts_sent += int(sent)

    missing = sorted(set(ICAO_CODES) - set(metars.keys()))
    return {"written": written, "missing": missing, "alerts_sent": alerts_sent}


@app.function(
    image=image,
    schedule=modal.Cron("*/10 * * * *"),
    secrets=[modal.Secret.from_name("supabase-creds")],
    timeout=120,
)
def refresh_all_airports():
    result = _run_refresh_cycle()
    print(
        f"Refreshed {result['written']} airports; "
        f"missing={result['missing']}; alerts_sent={result['alerts_sent']}"
    )


@app.function(image=image, secrets=[modal.Secret.from_name("supabase-creds")], timeout=120)
@modal.fastapi_endpoint(method="POST")
def trigger_refresh():
    return _run_refresh_cycle()


@app.function(image=image, secrets=[modal.Secret.from_name("manus-creds")], timeout=60)
@modal.fastapi_endpoint(method="POST")
def ai_briefing(payload: dict):
    """payload: {"airports": [{icao, name, city, country, level, score, factors}], "question": str | None}."""
    if not manus_client.is_configured():
        return {"error": "Manus not configured (set MANUS_API_KEY)"}
    prompt = manus_client.build_briefing_prompt(payload.get("airports", []), payload.get("question"))
    task_id = manus_client.create_briefing_task(prompt)
    return {"task_id": task_id}


@app.function(image=image, secrets=[modal.Secret.from_name("manus-creds")], timeout=30)
@modal.fastapi_endpoint(method="GET")
def ai_briefing_status(task_id: str):
    status = manus_client.get_task_status(task_id)
    if status == "stopped":
        return {"status": status, "messages": manus_client.get_task_messages(task_id)}
    return {"status": status}


def _risk_payload(icao: str, risk: RiskResult) -> dict:
    return {"icao": icao, "score": risk.score, "level": risk.level, "factors": risk.factors}


@app.function(image=image, timeout=30)
@modal.fastapi_endpoint(method="POST")
def flight_forecast(payload: dict):
    """payload: {"departure_icao": str, "arrival_icao": str | None, "departure_time": iso8601 str}.

    TAF-based forecast — only covers roughly the next 24-30 hours from when the
    TAF was issued. Returns {"available": false, "reason": ...} rather than
    silently substituting current conditions when the requested time is out of
    range; a forecast tool that quietly stops being a forecast is a safety bug.
    """
    departure_icao = (payload.get("departure_icao") or "").strip().upper()
    arrival_icao = (payload.get("arrival_icao") or "").strip().upper() or None
    departure_time_raw = payload.get("departure_time")

    if not departure_icao or not departure_time_raw:
        return {"available": False, "reason": "departure_icao and departure_time are required"}

    try:
        target_dt = datetime.fromisoformat(departure_time_raw.replace("Z", "+00:00"))
        if target_dt.tzinfo is None:
            target_dt = target_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return {"available": False, "reason": "departure_time is not a valid ISO8601 timestamp"}

    target_epoch = int(target_dt.timestamp())
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    if target_epoch < now_epoch:
        return {"available": False, "reason": "Departure time is in the past."}

    icaos = [departure_icao] + ([arrival_icao] if arrival_icao else [])
    tafs = fetch_tafs(icaos)

    departure_taf = tafs.get(departure_icao)
    if not departure_taf:
        return {"available": False, "reason": f"No current TAF available for {departure_icao}."}

    departure_risk = forecast_risk(departure_taf, target_epoch)
    if departure_risk is None:
        hours_out = round((target_epoch - now_epoch) / 3600, 1)
        return {
            "available": False,
            "reason": (
                f"Departure is {hours_out}h away — TAF forecasts only cover roughly the "
                "next 24-30 hours. Check back closer to departure for a real forecast."
            ),
        }

    arrival_risk = None
    arrival_taf = tafs.get(arrival_icao) if arrival_icao else None
    if arrival_icao and arrival_taf:
        arrival_risk = forecast_risk(arrival_taf, target_epoch)

    worse = departure_risk
    if arrival_risk and arrival_risk.score > departure_risk.score:
        worse = arrival_risk
    advice = checkin_advice.advice_for_level(worse.level)

    return {
        "available": True,
        "departure": _risk_payload(departure_icao, departure_risk),
        "arrival": _risk_payload(arrival_icao, arrival_risk) if arrival_risk else None,
        "overall_score": worse.score,
        "overall_level": worse.level,
        "checkin_advice": {"lead_time": advice.lead_time, "message": advice.message},
        "hours_until_departure": round((target_epoch - now_epoch) / 3600, 1),
    }
