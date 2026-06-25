import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from manus_client import build_briefing_prompt

SAMPLE_AIRPORTS = [
    {
        "icao": "RJAA",
        "name": "Tokyo Narita",
        "city": "Tokyo",
        "country": "Japan",
        "level": "SEVERE",
        "score": 70,
        "factors": ["Low instrument flight rules (very low ceiling/visibility)"],
    }
]


def test_default_briefing_has_no_question_framing():
    prompt = build_briefing_prompt(SAMPLE_AIRPORTS)
    assert "operational briefing for a duty manager" in prompt
    assert "RJAA" in prompt
    assert "Answer this specific question" not in prompt


def test_question_framing_includes_the_literal_question():
    prompt = build_briefing_prompt(SAMPLE_AIRPORTS, question="What's happening in Asia?")
    assert 'Answer this specific question using only the data below: "What\'s happening in Asia?"' in prompt
    assert "RJAA" in prompt
