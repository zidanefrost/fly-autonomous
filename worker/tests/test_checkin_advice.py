import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from checkin_advice import advice_for_level


def test_every_risk_level_has_distinct_advice():
    levels = ["LOW", "MEDIUM", "HIGH", "SEVERE"]
    messages = {advice_for_level(level).message for level in levels}
    assert len(messages) == len(levels)


def test_unknown_level_falls_back_to_medium():
    assert advice_for_level("UNKNOWN").message == advice_for_level("MEDIUM").message
