"""Pluggable WhatsApp delay-risk alert channel (Wassist).

Wassist (wassist.app) is a WhatsApp-commerce AI agent platform; its founder
is a judge for this hackathon. At the time of this build there is no public
developer REST API documented for it (it appears to be a no-code Shopify
dashboard product), so this module deliberately does NOT fabricate an
endpoint shape. Fill in `_send_via_wassist` with the real call once you have
Wassist's actual API docs/credentials (e.g. handed out at the event) — until
then this safely no-ops and logs what would have been sent.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger("wassist_alerts")


def is_configured() -> bool:
    return bool(os.environ.get("WASSIST_API_KEY") and os.environ.get("WASSIST_ALERT_RECIPIENT"))


def send_delay_risk_alert(icao: str, name: str, level: str, score: int, factors: list[str]) -> bool:
    """Returns True if an alert was actually sent, False if skipped/unconfigured.

    Never raises — alerting must never take down the monitoring pipeline.
    """
    message = f"[OTP Sentinel] {level} delay risk at {icao} ({name}): score {score}/100. " + "; ".join(
        factors
    )
    if not is_configured():
        logger.info("Wassist not configured — would have sent: %s", message)
        return False
    try:
        return _send_via_wassist(message)
    except Exception:
        logger.exception("Wassist alert failed")
        return False


def _send_via_wassist(message: str) -> bool:
    raise NotImplementedError(
        "Wire up Wassist's real send-message API here once you have hackathon-provided "
        "docs/credentials — see module docstring."
    )
