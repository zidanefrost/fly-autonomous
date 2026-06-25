"""Modal app — the autonomous monitoring agent.

One `modal.App` with three functions, deployed together via `modal deploy worker/app.py`:
  1. `refresh_all_airports` — cron, every 10 min: fetch -> score -> upsert -> alert.
  2. `trigger_refresh` — on-demand HTTP endpoint, same logic, for live-demo control.
  3. `ai_briefing` / `ai_briefing_status` — proxy to Manus AI so the API key never
     reaches the browser.
"""

import modal

from airports_seed import ICAO_CODES
from metar_client import fetch_metars
from risk_engine import score_metar

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
    """payload: {"top_risk_airports": [{icao, name, city, country, level, score, factors}]}."""
    if not manus_client.is_configured():
        return {"error": "Manus not configured (set MANUS_API_KEY)"}
    prompt = manus_client.build_briefing_prompt(payload.get("top_risk_airports", []))
    task_id = manus_client.create_briefing_task(prompt)
    return {"task_id": task_id}


@app.function(image=image, secrets=[modal.Secret.from_name("manus-creds")], timeout=30)
@modal.fastapi_endpoint(method="GET")
def ai_briefing_status(task_id: str):
    status = manus_client.get_task_status(task_id)
    if status == "stopped":
        return {"status": status, "messages": manus_client.get_task_messages(task_id)}
    return {"status": status}
