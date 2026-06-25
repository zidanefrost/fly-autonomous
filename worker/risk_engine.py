"""Deterministic, explainable delay-risk scoring from a parsed METAR dict.

No network I/O, no Supabase/Modal dependency — pure function so it can be
unit-tested against real METAR fixtures independent of everything else.
"""

from dataclasses import dataclass, field

FLIGHT_CATEGORY_BASE_SCORE = {
    "VFR": 0,
    "MVFR": 20,
    "IFR": 45,
    "LIFR": 70,
}

FLIGHT_CATEGORY_LABEL = {
    "VFR": "Visual flight rules (good ceiling & visibility)",
    "MVFR": "Marginal visual flight rules (reduced ceiling/visibility)",
    "IFR": "Instrument flight rules (low ceiling/visibility)",
    "LIFR": "Low instrument flight rules (very low ceiling/visibility)",
}

SEVERE_WX_TOKENS = [
    ("TS", 25, "Thunderstorms reported (TS)"),
    ("FZ", 30, "Freezing precipitation/fog — icing & braking-action risk (FZ)"),
    ("BLSN", 20, "Blowing snow reported (BLSN)"),
    ("SN", 18, "Snow reported (SN)"),
    ("FG", 15, "Fog reported — visibility risk (FG)"),
    ("GR", 20, "Hail reported (GR)"),
    ("SS", 25, "Sand/duststorm reported (SS)"),
    ("VA", 30, "Volcanic ash reported (VA)"),
]

LEVEL_THRESHOLDS = [
    (20, "LOW"),
    (45, "MEDIUM"),
    (70, "HIGH"),
]
SEVERE_LEVEL = "SEVERE"


@dataclass
class RiskResult:
    score: int
    level: str
    factors: list[str] = field(default_factory=list)


def _parse_visibility_sm(visib) -> float | None:
    """visib from the AWC API is a number (4.35) or a string like "6+" or "10+"."""
    if visib is None:
        return None
    if isinstance(visib, (int, float)):
        return float(visib)
    text = str(visib).strip()
    if text.endswith("+"):
        try:
            return float(text[:-1])
        except ValueError:
            return 10.0
    try:
        return float(text)
    except ValueError:
        return None


def _wind_factors(metar: dict) -> tuple[int, list[str]]:
    score = 0
    factors: list[str] = []
    wspd = metar.get("wspd")
    wgst = metar.get("wgst")  # only present in the payload when actually gusting

    if not isinstance(wspd, (int, float)):
        wspd = None

    if isinstance(wgst, (int, float)):
        spread = wgst - (wspd or 0)
        if wgst >= 35:
            score += 25
            factors.append(f"Severe gusts to {wgst:g}kt (sustained {wspd or 0:g}kt)")
        elif wgst >= 25:
            score += 15
            factors.append(f"Strong gusts to {wgst:g}kt (sustained {wspd or 0:g}kt)")
        elif spread >= 15:
            score += 10
            factors.append(f"Gusting {wgst:g}kt over sustained {wspd or 0:g}kt — crosswind risk")
    elif wspd is not None:
        if wspd >= 35:
            score += 25
            factors.append(f"Severe sustained wind {wspd:g}kt")
        elif wspd >= 25:
            score += 15
            factors.append(f"Strong sustained wind {wspd:g}kt")

    return score, factors


def _weather_phenomena_factors(metar: dict) -> tuple[int, list[str]]:
    wx_string = metar.get("wxString") or ""  # absent key, not "", when no active weather
    score = 0
    factors: list[str] = []
    for token, points, label in SEVERE_WX_TOKENS:
        if token in wx_string:
            score += points
            factors.append(label)
    if wx_string.startswith("+") and factors:
        score += 5
        factors.append("Heavy intensity precipitation (+)")
    return score, factors


def _score_to_level(score: int) -> str:
    for threshold, level in LEVEL_THRESHOLDS:
        if score < threshold:
            return level
    return SEVERE_LEVEL


def score_metar(metar: dict) -> RiskResult:
    """metar: one parsed object as returned by aviationweather.gov's METAR JSON API."""
    factors: list[str] = []

    flt_cat = metar.get("fltCat") or "MVFR"  # unknown/missing -> assume reduced, not best-case
    score = FLIGHT_CATEGORY_BASE_SCORE.get(flt_cat, 20)
    if flt_cat != "VFR":
        factors.append(FLIGHT_CATEGORY_LABEL.get(flt_cat, f"Flight category {flt_cat}"))

    wind_score, wind_factors = _wind_factors(metar)
    score += wind_score
    factors.extend(wind_factors)

    wx_score, wx_factors = _weather_phenomena_factors(metar)
    score += wx_score
    factors.extend(wx_factors)

    score = max(0, min(100, score))

    if not factors:
        factors.append("Clear conditions, no significant weather reported")

    return RiskResult(score=score, level=_score_to_level(score), factors=factors)
