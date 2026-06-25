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
    """metar: any dict with fltCat/wspd/wgst/wxString — works for a parsed METAR
    object from aviationweather.gov's API, or a synthesized worst-case TAF period
    (see forecast_risk below)."""
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


def _ceiling_ft(clouds: list[dict] | None) -> float:
    """Lowest BKN/OVC cloud base in feet, or +inf if there's no ceiling layer."""
    if not clouds:
        return float("inf")
    bases = [
        c["base"]
        for c in clouds
        if c.get("cover") in ("BKN", "OVC") and isinstance(c.get("base"), (int, float))
    ]
    return min(bases) if bases else float("inf")


def compute_flight_category(visib, clouds: list[dict] | None) -> str:
    """FAA flight-category thresholds. TAF forecast periods don't come with a
    pre-computed category the way AWC's METAR API does, so this derives one
    the same way the agency does for METARs: VFR ceiling>3000ft & vis>5sm;
    MVFR ceiling 1000-3000ft or vis 3-5sm; IFR ceiling 500-1000ft or vis 1-3sm;
    LIFR ceiling<500ft or vis<1sm.
    """
    vis = _parse_visibility_sm(visib)
    vis = 10.0 if vis is None else vis  # missing -> assume good, not the worst case
    ceiling = _ceiling_ft(clouds)

    if ceiling < 500 or vis < 1:
        return "LIFR"
    if ceiling < 1000 or vis < 3:
        return "IFR"
    if ceiling <= 3000 or vis <= 5:
        return "MVFR"
    return "VFR"


def select_forecast_periods(taf: dict, target_epoch: int) -> list[dict] | None:
    """Forecast periods (prevailing + any overlapping BECMG/TEMPO/PROB groups)
    that cover `target_epoch`. Returns None if `target_epoch` is outside the
    TAF's valid window entirely (TAFs only cover roughly 24-30 hours ahead) —
    callers must treat that as "no forecast available", not silently fall back
    to current conditions for a future time.
    """
    valid_from, valid_to = taf.get("validTimeFrom"), taf.get("validTimeTo")
    if valid_from is None or valid_to is None or not (valid_from <= target_epoch <= valid_to):
        return None

    periods = [
        p
        for p in taf.get("fcsts", [])
        if p.get("timeFrom") is not None
        and p.get("timeTo") is not None
        and p["timeFrom"] <= target_epoch <= p["timeTo"]
    ]
    return periods or None


def _worst_case_period(periods: list[dict]) -> tuple[dict, bool]:
    """Merges overlapping forecast periods into one worst-case weather dict.
    TEMPO/PROB groups describe conditions that may occur *in addition to* the
    prevailing forecast, not instead of it, so we take the worst of all of them
    rather than picking just one period.
    """
    visibs = [v for p in periods if (v := _parse_visibility_sm(p.get("visib"))) is not None]
    all_clouds = [c for p in periods for c in (p.get("clouds") or [])]
    wspds = [p["wspd"] for p in periods if isinstance(p.get("wspd"), (int, float))]
    wgsts = [p["wgst"] for p in periods if isinstance(p.get("wgst"), (int, float))]
    wx_strings = [p["wxString"] for p in periods if p.get("wxString")]
    is_probable = any(p.get("fcstChange") == "TEMPO" or p.get("probability") for p in periods)

    merged = {
        "fltCat": compute_flight_category(min(visibs) if visibs else None, all_clouds),
        "wspd": max(wspds) if wspds else None,
        "wgst": max(wgsts) if wgsts else None,
        "wxString": " ".join(wx_strings) if wx_strings else None,
    }
    return merged, is_probable


def forecast_risk(taf: dict, target_epoch: int) -> RiskResult | None:
    """Worst-case explainable risk forecast for `target_epoch`, or None if
    that time falls outside the TAF's valid window.
    """
    periods = select_forecast_periods(taf, target_epoch)
    if periods is None:
        return None
    merged, is_probable = _worst_case_period(periods)
    result = score_metar(merged)
    if is_probable:
        result.factors.append(
            "Includes a temporary/probable forecast window (TEMPO/PROB) — treated as worst-case"
        )
    return result
