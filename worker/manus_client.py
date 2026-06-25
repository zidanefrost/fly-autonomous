"""Thin wrapper around the Manus AI v2 task API for the on-demand "AI Ops
Briefing" feature. Optional: callers should check `is_configured()` first and
degrade gracefully (e.g. a templated local summary) if no key is set.

Verified against live Manus docs (open.manus.ai/docs/v2) as of this build:
- POST /v2/task.create  -> {"ok", "task_id", "task_url", ...}
- GET  /v2/task.detail?task_id=...  -> {"task": {"status": "running"|"waiting"|"stopped"|"error"}}
- GET  /v2/task.listMessages?task_id=...  -> conversation/output content

This is an async, multi-second-to-minutes task model — never call it from a
tight polling loop. It's wired as an on-demand button in the dashboard.
"""

from __future__ import annotations

import os

import httpx

MANUS_BASE_URL = "https://api.manus.ai/v2"


def is_configured() -> bool:
    return bool(os.environ.get("MANUS_API_KEY"))


def _headers() -> dict:
    return {"x-manus-api-key": os.environ["MANUS_API_KEY"]}


def create_briefing_task(prompt: str, client: httpx.Client | None = None) -> str:
    """Kicks off an async Manus task and returns its task_id."""
    owns_client = client is None
    client = client or httpx.Client(timeout=20.0)
    try:
        resp = client.post(
            f"{MANUS_BASE_URL}/task.create",
            headers=_headers(),
            json={
                "message": {"content": prompt},
                "agent_profile": "manus-1.6-lite",
                "hide_in_task_list": True,
                "share_visibility": "private",
            },
        )
        resp.raise_for_status()
        return resp.json()["task_id"]
    finally:
        if owns_client:
            client.close()


def get_task_status(task_id: str, client: httpx.Client | None = None) -> str:
    """Returns one of: running, waiting, stopped, error."""
    owns_client = client is None
    client = client or httpx.Client(timeout=20.0)
    try:
        resp = client.get(
            f"{MANUS_BASE_URL}/task.detail", headers=_headers(), params={"task_id": task_id}
        )
        resp.raise_for_status()
        return resp.json()["task"]["status"]
    finally:
        if owns_client:
            client.close()


def get_task_messages(task_id: str, client: httpx.Client | None = None) -> list[dict]:
    owns_client = client is None
    client = client or httpx.Client(timeout=20.0)
    try:
        resp = client.get(
            f"{MANUS_BASE_URL}/task.listMessages", headers=_headers(), params={"task_id": task_id}
        )
        resp.raise_for_status()
        return resp.json().get("messages", [])
    finally:
        if owns_client:
            client.close()


def build_briefing_prompt(top_risk_airports: list[dict]) -> str:
    """top_risk_airports: list of {icao, name, city, country, level, score, factors}."""
    lines = [
        "You are an airline network operations briefing assistant. "
        "Write a concise (4-6 sentence) operational briefing for a duty manager, "
        "summarizing the highest weather-driven delay-risk airports right now. "
        "Be specific about which airports and why, and end with one practical "
        "recommendation. Do not invent data beyond what's given.",
        "",
        "Current highest-risk airports:",
    ]
    for a in top_risk_airports:
        factors = "; ".join(a.get("factors", []))
        lines.append(
            f"- {a['icao']} ({a.get('name', '')}, {a.get('city', '')}, {a.get('country', '')}): "
            f"{a['level']} risk, score {a['score']}/100 — {factors}"
        )
    return "\n".join(lines)
