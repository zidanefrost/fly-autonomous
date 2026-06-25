import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from risk_engine import compute_flight_category, forecast_risk, select_forecast_periods

# Real TAF pulled live from aviationweather.gov for EGLL on 2026-06-25:
# "TAF EGLL 251700Z 2518/2624 08012KT CAVOK BECMG 2522/2601 VRB03KT
#  PROB30 TEMPO 2600/2607 VRB15G30KT 4000 +TSRAGS
#  BECMG 2609/2612 25010KT PROB30 TEMPO 2620/2624 5000 SHRA"
EGLL_TAF = {
    "icaoId": "EGLL",
    "validTimeFrom": 1782410400,  # 2026-06-25 18:00Z
    "validTimeTo": 1782518400,  # 2026-06-27 00:00Z
    "fcsts": [
        {
            "timeFrom": 1782410400,
            "timeTo": 1782424800,
            "fcstChange": None,
            "probability": None,
            "wdir": 80,
            "wspd": 12,
            "wgst": None,
            "visib": "6+",
            "wxString": "NSW",
            "clouds": [{"cover": "NSC", "base": None}],
        },
        {
            "timeFrom": 1782424800,
            "timeTo": 1782464400,
            "fcstChange": "BECMG",
            "probability": None,
            "wdir": "VRB",
            "wspd": 3,
            "wgst": None,
            "visib": "6+",
            "wxString": "NSW",
            "clouds": [{"cover": "NSC", "base": None}],
        },
        {
            # PROB30 TEMPO thunderstorm window overlapping part of the BECMG calm period
            "timeFrom": 1782432000,
            "timeTo": 1782457200,
            "fcstChange": "TEMPO",
            "probability": 30,
            "wdir": "VRB",
            "wspd": 15,
            "wgst": 30,
            "visib": 2.49,
            "wxString": "+TSRA +TSGS",
            "clouds": [],
        },
        {
            "timeFrom": 1782464400,
            "timeTo": 1782518400,
            "fcstChange": "BECMG",
            "probability": None,
            "wdir": 250,
            "wspd": 10,
            "wgst": None,
            "visib": "6+",
            "wxString": "NSW",
            "clouds": [{"cover": "NSC", "base": None}],
        },
    ],
}


def test_outside_valid_window_returns_none():
    far_future = EGLL_TAF["validTimeTo"] + 3600 * 24
    assert select_forecast_periods(EGLL_TAF, far_future) is None
    assert forecast_risk(EGLL_TAF, far_future) is None


def test_calm_period_is_low_risk():
    calm_time = EGLL_TAF["fcsts"][0]["timeFrom"] + 600
    result = forecast_risk(EGLL_TAF, calm_time)
    assert result is not None
    assert result.level == "LOW"


def test_overlapping_tempo_thunderstorm_is_picked_up_as_worst_case():
    # This timestamp falls inside both the calm BECMG period AND the PROB30
    # TEMPO thunderstorm window — the worst case (thunderstorm) must win.
    storm_time = 1782440000
    result = forecast_risk(EGLL_TAF, storm_time)
    assert result is not None
    assert result.level in ("HIGH", "SEVERE")
    assert any("Thunderstorm" in f for f in result.factors)
    assert any("temporary/probable" in f for f in result.factors)


def test_compute_flight_category_thresholds():
    assert compute_flight_category("6+", [{"cover": "NSC", "base": None}]) == "VFR"
    assert compute_flight_category(4.0, []) == "MVFR"
    assert compute_flight_category(2.0, []) == "IFR"
    assert compute_flight_category(0.5, []) == "LIFR"
    assert compute_flight_category("6+", [{"cover": "OVC", "base": 200}]) == "LIFR"
