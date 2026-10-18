"""Gemini: turns a small spending summary into plain-English insights.

Python does all the math (see server.py's dashboard). Gemini only explains the
numbers it is given, and returns JSON that matches the Insights schema below.

Setup:
  1. Get a free key at https://aistudio.google.com/apikey
  2. Add a line to .env:   GEMINI_API_KEY=your_key_here
  3. venv\\Scripts\\pip install -r requirements.txt   (adds google-genai)

Optional in .env: GEMINI_MODEL=... (defaults to gemini-3.8-flash).
If there's no key, or Gemini fails, callers get None and the app keeps working.
"""
import hashlib
import json
import os
import time

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
CACHE_SECONDS = 15 * 60          # reuse an answer for the same numbers for 15 minutes

RULES = (
    "You are a friendly money coach inside a student banking app called Gatorstar. "
    "Use ONLY the numbers in the data you are given; never invent or recalculate figures. "
    "Write in second person, short and specific, with dollar amounts from the data. "
    "Give educational suggestions, not financial or investment advice. "
    "If a value is null, it means there isn't enough data; don't guess."
)


class Insights(BaseModel):
    headline: str            # one sentence, the main takeaway
    persona: str             # 2-3 word spending style, e.g. "Steady saver"
    insights: list[str]      # 2-3 observations
    tips: list[str]          # 1-2 practical suggestions


_client = None
_cache: dict[str, tuple[float, dict]] = {}


def available() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def _get_client():
    global _client
    if _client is None:
        from google import genai   # imported here so the app still starts without the package
        _client = genai.Client()   # reads GEMINI_API_KEY
    return _client


def explain(summary: dict) -> dict | None:
    """Return Insights as a dict, or None if Gemini isn't set up or the call fails."""
    if not available():
        return None
    key = hashlib.sha256(json.dumps(summary, sort_keys=True).encode()).hexdigest()
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    try:
        from google.genai import types
        response = _get_client().models.generate_content(
            model=MODEL,
            contents="Explain this customer's spending for the period:\n" + json.dumps(summary),
            config=types.GenerateContentConfig(
                system_instruction=RULES,
                response_mime_type="application/json",
                response_json_schema=Insights.model_json_schema(),
            ),
        )
        result = Insights.model_validate_json(response.text).model_dump()
    except Exception as e:  # network, quota, bad key, bad JSON: fall back quietly
        print(f"Gemini insights failed: {e}")
        return None
    _cache[key] = (time.time(), result)
    return result
