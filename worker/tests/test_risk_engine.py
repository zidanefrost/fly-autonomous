import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from risk_engine import score_metar

# Real METAR samples pulled live from aviationweather.gov on 2026-06-24,
# plus hand-built fixtures for cases that weren't live at fetch time.

CLEAR_VFR = {
    "icaoId": "EGLL",
    "wdir": 360,
    "wspd": 7,
    "visib": "6+",
    "fltCat": "VFR",
    "clouds": [],
}

LIGHT_RAIN_VFR_VARIABLE_WIND = {
    "icaoId": "WSSS",
    "wdir": "VRB",
    "wspd": 1,
    "visib": "6+",
    "wxString": "-RA",
    "fltCat": "VFR",
}

MARGINAL_VISIBILITY = {
    "icaoId": "OMDB",
    "wdir": 320,
    "wspd": 5,
    "visib": 4.35,
    "fltCat": "MVFR",
}

THUNDERSTORM_IFR_GUSTY = {
    "icaoId": "TEST1",
    "wdir": 210,
    "wspd": 18,
    "wgst": 38,
    "visib": 1.5,
    "wxString": "+TSRA",
    "fltCat": "IFR",
}

FOG_LIFR = {
    "icaoId": "TEST2",
    "wdir": 90,
    "wspd": 3,
    "visib": 0.25,
    "wxString": "FG",
    "fltCat": "LIFR",
}

SNOW_MVFR_NO_GUST_KEY = {
    "icaoId": "TEST3",
    "wdir": 40,
    "wspd": 12,
    "visib": 2.0,
    "wxString": "-SN",
    "fltCat": "MVFR",
}

MISSING_FLIGHT_CATEGORY = {
    "icaoId": "TEST4",
    "wdir": 100,
    "wspd": 6,
}


def test_clear_vfr_is_low_risk_with_no_factors_beyond_default():
    result = score_metar(CLEAR_VFR)
    assert result.level == "LOW"
    assert result.score == 0
    assert result.factors == ["Clear conditions, no significant weather reported"]


def test_variable_wind_does_not_crash_and_light_rain_is_still_low():
    result = score_metar(LIGHT_RAIN_VFR_VARIABLE_WIND)
    assert result.level == "LOW"
    assert result.score < 20


def test_mvfr_baseline_score():
    result = score_metar(MARGINAL_VISIBILITY)
    assert result.score == 20
    assert result.level == "MEDIUM"
    assert any("Marginal" in f for f in result.factors)


def test_thunderstorm_with_severe_gust_is_severe():
    result = score_metar(THUNDERSTORM_IFR_GUSTY)
    assert result.level == "SEVERE"
    assert result.score == 100  # clamped: 45 (IFR) + 25 (gust>=35) + 25 (TS) + 5 (heavy) = 100
    assert any("Thunderstorms" in f for f in result.factors)
    assert any("gust" in f.lower() for f in result.factors)
    assert any("Heavy intensity" in f for f in result.factors)


def test_fog_lifr_is_high_or_severe():
    result = score_metar(FOG_LIFR)
    assert result.level in ("HIGH", "SEVERE")
    assert result.score == 85  # 70 (LIFR) + 15 (FG)
    assert any("Fog" in f for f in result.factors)


def test_snow_without_gust_key_present_does_not_crash():
    result = score_metar(SNOW_MVFR_NO_GUST_KEY)
    assert "wgst" not in SNOW_MVFR_NO_GUST_KEY
    assert result.score == 38  # 20 (MVFR) + 18 (SN)
    assert result.level == "MEDIUM"
    assert any("Snow" in f for f in result.factors)


def test_missing_flight_category_defaults_conservatively_not_best_case():
    result = score_metar(MISSING_FLIGHT_CATEGORY)
    assert result.score == 20  # treated as MVFR-equivalent, not 0
    assert result.level == "MEDIUM"


def test_score_is_always_clamped_0_to_100():
    extreme = {
        "icaoId": "TEST5",
        "wspd": 40,
        "wgst": 60,
        "visib": 0,
        "wxString": "+TSRAFZGRVA",
        "fltCat": "LIFR",
    }
    result = score_metar(extreme)
    assert 0 <= result.score <= 100
