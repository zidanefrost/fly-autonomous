"""Modal app — the autonomous monitoring agent.

One `modal.App` with several functions, deployed together via `modal deploy worker/app.py`:
  1. `refresh_all_airports` — cron, every 10 min: fetch -> score -> upsert -> alert
     -> re-check active flight watches.
  2. `trigger_refresh` — on-demand HTTP endpoint, same logic, for live-demo control.
  3. `ai_briefing` / `ai_briefing_status` — proxy to Manus AI so the API key never
     reaches the browser.
  4. `flight_forecast` — TAF-based delay-risk forecast + check-in advice for a
     given departure airport/time (and optional arrival airport).
  5. `subscribe_flight_watch` — opt in a phone number for WhatsApp (Wassist)
     updates on a specific flight; re-checked by the cron above.
"""

import os
from datetime import datetime, timezone

import modal

from airports_seed import ICAO_CODES
from metar_client import fetch_metars
from risk_engine import RiskResult, forecast_risk, score_metar
from taf_client import fetch_tafs

import checkin_advice
import flight_watch
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
        "flight_watch",
        "airports_seed",
        "supabase_writer",
        "manus_client",
        "wassist_client",
    )
)


def _parse_iso_to_epoch(raw: str) -> tuple[int | None, str | None]:
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp()), None
    except (ValueError, AttributeError):
        return None, "departure_time is not a valid ISO8601 timestamp"


def _risk_payload(icao: str, risk: RiskResult) -> dict:
    return {"icao": icao, "score": risk.score, "level": risk.level, "factors": risk.factors}


def _route_forecast(
    departure_icao: str, arrival_icao: str | None, target_epoch: int, tafs: dict[str, dict]
) -> dict:
    """Shared by the one-shot flight_forecast endpoint and the recurring
    flight-watch check — given already-fetched TAFs, compute the worst-of
    departure/arrival forecast risk for `target_epoch`."""
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    hours_out = round((target_epoch - now_epoch) / 3600, 1)

    departure_taf = tafs.get(departure_icao)
    if not departure_taf:
        return {"available": False, "reason": f"No current TAF available for {departure_icao}."}

    departure_risk = forecast_risk(departure_taf, target_epoch)
    if departure_risk is None:
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
        "hours_until_departure": hours_out,
    }


def _check_flight_watches(client) -> int:
    """Re-checks every active flight_watches row and sends a WhatsApp update
    if the forecast risk level has changed since the last notification, or
    deactivates the watch once its departure time has passed. Returns the
    number of WhatsApp updates actually sent.
    """
    watches = flight_watch.get_active_watches(client)
    if not watches:
        return 0

    now_epoch = int(datetime.now(timezone.utc).timestamp())
    icaos = sorted(
        {w["departure_icao"] for w in watches}
        | {w["arrival_icao"] for w in watches if w.get("arrival_icao")}
    )
    tafs = fetch_tafs(icaos)

    notified = 0
    for watch in watches:
        target_epoch, error = _parse_iso_to_epoch(watch["departure_time"])
        if error:
            continue
        if target_epoch < now_epoch:
            flight_watch.deactivate(client, watch["id"])
            continue

        forecast = _route_forecast(watch["departure_icao"], watch.get("arrival_icao"), target_epoch, tafs)
        if not forecast["available"]:
            continue

        new_level = forecast["overall_level"]
        if new_level == watch.get("last_notified_level"):
            continue

        if wassist_client.is_configured() and watch.get("wassist_conversation_id"):
            template_name = os.environ.get("WASSIST_UPDATE_TEMPLATE_NAME", "otp_sentinel_update")
            try:
                wassist_client.send_template_message(
                    watch["wassist_conversation_id"],
                    template_name,
                    [watch["departure_icao"], new_level, str(forecast["overall_score"])],
                )
                notified += 1
            except Exception:
                pass  # one failed notification must not break the whole refresh cycle

        flight_watch.update_notified_level(client, watch["id"], new_level)

    return notified


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

    try:
        watch_notifications = _check_flight_watches(client)
    except Exception:
        # e.g. the flight_watches table doesn't exist yet on this project —
        # must not take down airport monitoring, the core of this app.
        watch_notifications = 0

    missing = sorted(set(ICAO_CODES) - set(metars.keys()))
    return {
        "written": written,
        "missing": missing,
        "alerts_sent": alerts_sent,
        "watch_notifications": watch_notifications,
    }


@app.function(
    image=image,
    schedule=modal.Cron("*/10 * * * *"),
    secrets=[modal.Secret.from_name("supabase-creds"), modal.Secret.from_name("wassist-creds")],
    timeout=120,
)
def refresh_all_airports():
    result = _run_refresh_cycle()
    print(
        f"Refreshed {result['written']} airports; "
        f"missing={result['missing']}; alerts_sent={result['alerts_sent']}; "
        f"watch_notifications={result['watch_notifications']}"
    )


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-creds"), modal.Secret.from_name("wassist-creds")],
    timeout=120,
)
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

    target_epoch, error = _parse_iso_to_epoch(departure_time_raw)
    if error:
        return {"available": False, "reason": error}

    now_epoch = int(datetime.now(timezone.utc).timestamp())
    if target_epoch < now_epoch:
        return {"available": False, "reason": "Departure time is in the past."}

    icaos = [departure_icao] + ([arrival_icao] if arrival_icao else [])
    tafs = fetch_tafs(icaos)
    return _route_forecast(departure_icao, arrival_icao, target_epoch, tafs)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-creds"), modal.Secret.from_name("wassist-creds")],
    timeout=30,
)
@modal.fastapi_endpoint(method="POST")
def subscribe_flight_watch(payload: dict):
    """payload: {"phone": str, "departure_icao": str, "arrival_icao": str | None, "departure_time": iso8601 str}.

    Saves a persistent watch that `refresh_all_airports` re-checks every 10
    minutes, and — if Wassist is configured — sends an opt-in WhatsApp
    message with the current forecast immediately.
    """
    phone = (payload.get("phone") or "").strip()
    departure_icao = (payload.get("departure_icao") or "").strip().upper()
    arrival_icao = (payload.get("arrival_icao") or "").strip().upper() or None
    departure_time_raw = payload.get("departure_time")

    if not phone or not departure_icao or not departure_time_raw:
        return {"ok": False, "reason": "phone, departure_icao, and departure_time are required"}

    target_epoch, error = _parse_iso_to_epoch(departure_time_raw)
    if error:
        return {"ok": False, "reason": error}

    now_epoch = int(datetime.now(timezone.utc).timestamp())
    if target_epoch < now_epoch:
        return {"ok": False, "reason": "Departure time is in the past."}

    client = supabase_writer.get_client()
    try:
        watch = flight_watch.create_watch(client, phone, departure_icao, arrival_icao, departure_time_raw)
    except Exception as e:
        return {"ok": False, "reason": f"Could not save the watch ({e})."}

    if not wassist_client.is_configured():
        return {
            "ok": True,
            "notified": False,
            "reason": "Saved — but WhatsApp notifications aren't connected yet.",
        }

    tafs = fetch_tafs([departure_icao] + ([arrival_icao] if arrival_icao else []))
    forecast = _route_forecast(departure_icao, arrival_icao, target_epoch, tafs)
    level = forecast.get("overall_level", "PENDING") if forecast["available"] else "PENDING"
    score = forecast.get("overall_score", 0)

    template_name = os.environ.get("WASSIST_OPTIN_TEMPLATE_NAME", "otp_sentinel_optin")
    try:
        conversation_id = wassist_client.start_conversation(
            phone, template_name, [departure_icao, level, str(score)]
        )
        flight_watch.set_conversation(client, watch["id"], conversation_id, level)
        return {"ok": True, "notified": True, "current_level": level}
    except Exception as e:
        return {
            "ok": True,
            "notified": False,
            "reason": f"Saved — but the WhatsApp message failed to send ({e}).",
        }
