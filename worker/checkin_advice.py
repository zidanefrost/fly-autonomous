"""Rule-based check-in timing advice from a forecast delay-risk level.

Deterministic on purpose, same as risk_engine — this is a recommendation a
traveler or ops planner can audit, not an LLM guess.
"""

from dataclasses import dataclass

ADVICE_BY_LEVEL = {
    "LOW": (
        "Standard timing",
        "Conditions look clear for this departure. Standard check-in timing "
        "(per your airline's usual window) is fine.",
    ),
    "MEDIUM": (
        "Check in as soon as your window opens",
        "Marginal conditions are forecast around this departure. Check in the "
        "moment your airline's window opens and keep an eye on the flight status.",
    ),
    "HIGH": (
        "Check in immediately, have a backup plan",
        "Forecast conditions point to a real chance of delay. Check in as early "
        "as possible, choose online check-in if available, and consider what "
        "you'd do about a missed connection.",
    ),
    "SEVERE": (
        "Check in immediately and monitor closely",
        "Forecast conditions are severe enough to expect meaningful disruption. "
        "Check in immediately, enable airline notifications, and have a "
        "rebooking plan ready before you head to the airport.",
    ),
}


@dataclass
class CheckinAdvice:
    lead_time: str
    message: str


def advice_for_level(level: str) -> CheckinAdvice:
    lead_time, message = ADVICE_BY_LEVEL.get(level, ADVICE_BY_LEVEL["MEDIUM"])
    return CheckinAdvice(lead_time=lead_time, message=message)
