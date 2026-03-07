"""AI conflict updater with DeepSeek -> Gemini -> mock fallback."""

from __future__ import annotations

from datetime import date
import hashlib
import json
import os
import re
from typing import Any
from urllib import error, request

from .conflict_parser import CONFLICTS_FILE, save_json_file
from .data_handler import load_conflicts
from .data_sources import download_headlines, unique_headlines

KEYWORDS = ["war", "invasion", "military strike", "missile attack", "armed conflict", "clash"]


def _guess_country(text: str) -> str:
    """Best-effort country extraction for offline fallback mode."""

    match = re.search(r"(?:in|near|between|over)\s+([A-Z][a-zA-Z\-]+)", text)
    return match.group(1) if match else "Unknown"


def analyze_headlines_with_mock_ai(headlines: list[str]) -> list[dict[str, Any]]:
    """Offline rule-based detector used when both APIs are unavailable/fail."""

    records: list[dict[str, Any]] = []
    for headline in headlines:
        normalized = headline.lower()
        if not any(keyword in normalized for keyword in KEYWORDS):
            continue

        country = _guess_country(headline)
        records.append(
            {
                "is_conflict": True,
                "country": country,
                "location": country,
                "description": headline,
                "possible_start_date": str(date.today()),
                "opponent": "Unknown",
                "side_country": country,
                "side_opponent": "Unknown",
            }
        )
    return records


def _extract_json_list(raw: str) -> list[dict[str, Any]]:
    """Parse list JSON from plain or fenced-model output."""

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    parsed = json.loads(cleaned)
    return parsed if isinstance(parsed, list) else []


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for key, value in headers.items():
        req.add_header(key, value)

    with request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _analyze_with_deepseek(headlines: list[str], api_key: str) -> list[dict[str, Any]]:
    prompt = (
        "Extract active military conflicts from headlines. "
        "Return only JSON list with fields: "
        "is_conflict,country,opponent,side_country,side_opponent,location,description,possible_start_date.\n"
        + "\n".join(f"- {headline}" for headline in headlines)
    )

    response = _post_json(
        "https://api.deepseek.com/v1/chat/completions",
        {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "You are a conflict extraction assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        },
        {"Authorization": f"Bearer {api_key}"},
    )
    content = response["choices"][0]["message"]["content"]
    return _extract_json_list(content)


def _analyze_with_gemini(headlines: list[str], api_key: str) -> list[dict[str, Any]]:
    prompt = (
        "Extract active military conflicts from headlines. "
        "Return only JSON list with fields: "
        "is_conflict,country,opponent,side_country,side_opponent,location,description,possible_start_date.\n"
        + "\n".join(f"- {headline}" for headline in headlines)
    )

    response = _post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}",
        {"contents": [{"parts": [{"text": prompt}]}]},
        {},
    )
    text = response["candidates"][0]["content"]["parts"][0]["text"]
    return _extract_json_list(text)


def analyze_headlines_with_ai(headlines: list[str]) -> tuple[list[dict[str, Any]], str]:
    """Try DeepSeek first, then Gemini, then mock mode."""

    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if deepseek_key:
        try:
            return _analyze_with_deepseek(headlines, deepseek_key), "deepseek"
        except Exception:
            pass

    if gemini_key:
        try:
            return _analyze_with_gemini(headlines, gemini_key), "gemini"
        except Exception:
            pass

    return analyze_headlines_with_mock_ai(headlines), "mock"


def convert_analysis_to_conflicts(analysis: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert extracted analysis to project conflict schema."""

    output: list[dict[str, Any]] = []
    for item in analysis:
        if not item.get("is_conflict"):
            continue

        country = str(item.get("country") or "Unknown")
        opponent = str(item.get("opponent") or "Unknown")
        description = str(item.get("description") or "Conflict signal")
        # Use stable fields only so similar conflicts from different headlines dedupe correctly.
        stable_start = str(item.get("possible_start_date") or date.today())
        digest = hashlib.md5(f"{country}|{opponent}|{stable_start}".encode("utf-8")).hexdigest()[:12]

        output.append(
            {
                "id": f"ai-{digest}",
                "country": country,
                "opponent": opponent,
                "lat": float(item.get("lat") or 0.0),
                "lon": float(item.get("lon") or 0.0),
                "opponentLat": float(item.get("opponentLat") or 0.0),
                "opponentLon": float(item.get("opponentLon") or 0.0),
                "start": str(item.get("possible_start_date") or date.today()),
                "end": None,
                "description": description,
                "side_country": str(item.get("side_country") or country),
                "side_opponent": str(item.get("side_opponent") or opponent),
            }
        )

    return output


def merge_new_conflicts(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge incoming conflicts by stable id."""

    known_ids = {record.get("id") for record in existing}
    merged = existing.copy()

    for record in incoming:
        if record.get("id") not in known_ids:
            merged.append(record)
            known_ids.add(record.get("id"))

    return merged


def run_ai_update_pipeline() -> dict[str, Any]:
    """Fetch headlines, detect conflicts, merge and persist JSON."""

    headlines = unique_headlines(download_headlines())
    analysis, provider = analyze_headlines_with_ai(headlines)
    incoming = convert_analysis_to_conflicts(analysis)
    existing = load_conflicts()
    merged = merge_new_conflicts(existing, incoming)
    save_json_file(CONFLICTS_FILE, merged)

    return {
        "provider": provider,
        "headlines_processed": len(headlines),
        "detected_conflicts": len(incoming),
        "total_conflicts": len(merged),
    }
