"""Real Wassist API client for WhatsApp flight-risk notifications.

Verified against live docs (docs.wassist.app/api-reference) — Wassist is a
WhatsApp-commerce AI agent platform; its founder is a judge at this
hackathon and offered hackathon participants a free Starter-tier credit
(see Tech Partners page). Base URL, auth, and endpoint shapes below are
taken directly from their published API reference, not guessed.

  POST /api/v1/conversations/                     -> create/start a conversation
  POST /api/v1/conversations/{id}/messages/        -> send a message in it

WhatsApp Business policy requires the *first* outbound message to a
contact (and any message sent outside the active 24h session window) to
use a pre-approved message template, not free text — so every notification
this module sends uses `type: "template"`. The template itself must exist
and be approved in the user's own Wassist/WhatsApp Business account; we
can't create or approve templates on their behalf.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("wassist_client")

WASSIST_BASE_URL = "https://backend.wassist.app/api/v1"


def is_configured() -> bool:
    return bool(os.environ.get("WASSIST_API_KEY") and os.environ.get("WASSIST_AGENT_ID"))


def _headers() -> dict:
    return {"X-API-Key": os.environ["WASSIST_API_KEY"], "Content-Type": "application/json"}


def _template_message(template_name: str, body_vars: list[str]) -> dict:
    return {"type": "template", "template": {"name": template_name, "variables": {"body": body_vars}}}


def start_conversation(
    to_number: str, template_name: str, body_vars: list[str], client: httpx.Client | None = None
) -> str:
    """Creates a new conversation, sending `template_name` as the opening
    message. Returns the conversation id (needed for later updates)."""
    owns_client = client is None
    client = client or httpx.Client(timeout=20.0)
    try:
        resp = client.post(
            f"{WASSIST_BASE_URL}/conversations/",
            headers=_headers(),
            json={
                "agentId": os.environ["WASSIST_AGENT_ID"],
                "toNumber": to_number,
                "fromNumber": os.environ.get("WASSIST_FROM_NUMBER") or None,
                "message": _template_message(template_name, body_vars),
            },
        )
        resp.raise_for_status()
        return resp.json()["id"]
    finally:
        if owns_client:
            client.close()


def send_template_message(
    conversation_id: str, template_name: str, body_vars: list[str], client: httpx.Client | None = None
) -> None:
    """Sends a follow-up template message in an existing conversation —
    used for risk-level-changed updates, which generally happen well outside
    WhatsApp's 24h free-form session window."""
    owns_client = client is None
    client = client or httpx.Client(timeout=20.0)
    try:
        resp = client.post(
            f"{WASSIST_BASE_URL}/conversations/{conversation_id}/messages/",
            headers=_headers(),
            json=_template_message(template_name, body_vars),
        )
        resp.raise_for_status()
    finally:
        if owns_client:
            client.close()


def send_delay_risk_alert(icao: str, name: str, level: str, score: int, factors: list[str]) -> bool:
    """Used by the airport-monitoring cron (not the per-flight watch list)
    for a HIGH/SEVERE escalation alert sent to a single operations contact
    number, if configured. Never raises — alerting must never take down the
    monitoring pipeline.
    """
    to_number = os.environ.get("WASSIST_ALERT_RECIPIENT")
    template_name = os.environ.get("WASSIST_ALERT_TEMPLATE_NAME", "otp_sentinel_alert")
    if not is_configured() or not to_number:
        logger.info("Wassist not configured — would have alerted on %s %s", icao, level)
        return False
    try:
        start_conversation(to_number, template_name, [icao, level, str(score), "; ".join(factors[:2])])
        return True
    except Exception:
        logger.exception("Wassist alert failed for %s", icao)
        return False
