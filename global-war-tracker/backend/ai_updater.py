"""AI-assisted conflict updater.

This module supports two modes:
1. Real AI mode (OpenAI API) if key + client are configured.
2. Local mock mode using keyword detection when API is unavailable.

The local mock mode guarantees the project can run without external services.
"""

from __future__ import annotations

from datetime import date
import hashlib
from pathlib import Path
from typing import Any
import json
import os
import re

from .data_sources import download_headlines, unique_headlines
from .conflict_parser import load_conflicts, save_json_file, CONFLICTS_FILE

# OpenAI is optional, because local mode is required.
try:
    from openai import OpenAI  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    OpenAI = None


KEYWORDS = [
    "war",
    "invasion",
    "military strike",
    "armed conflict",
    "missile attack",
    "clash",
]


def _guess_country_from_text(text: str) -> str:
    """Very small heuristic extractor for mock mode.

    It looks for words after prepositions like "in" or "near" and returns a
    best-effort region string. This is intentionally simple and replaceable.
    """

    match = re.search(r"(?:in|near)\s+([A-Z][a-zA-Z\-]+)", text)
    return match.group(1) if match else "Unknown"


def analyze_headlines_with_mock_ai(headlines: list[str]) -> list[dict[str, Any]]:
    """Rule-based fallback when OpenAI API is unavailable.

    Why needed:
    - Keeps update pipeline functional in fully offline environments.
    - Helps beginner developers understand the pipeline before adding real AI.
    """

    results: list[dict[str, Any]] = []
    for text in headlines:
        lower = text.lower()
        if any(keyword in lower for keyword in KEYWORDS):
            country = _guess_country_from_text(text)
            results.append(
                {
                    "is_conflict": True,
                    "country": country,
                    "location": country,
                    "description": text,
                    "possible_start_date": str(date.today()),
                }
            )
    return results


def analyze_headlines_with_openai(headlines: list[str]) -> list[dict[str, Any]]:
    """Analyze headlines via OpenAI using requested prompt logic."""

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        return analyze_headlines_with_mock_ai(headlines)

    client = OpenAI(api_key=api_key)
    prompt = (
        "Identify whether this headline describes a military conflict, war, invasion, "
        "or armed clash. If yes, extract location, country, short description and "
        "possible start date. Return JSON list with keys: "
        "is_conflict,country,location,description,possible_start_date.\n\n"
        + "\n".join(f"- {h}" for h in headlines)
    )

    completion = client.responses.create(model="gpt-4.1-mini", input=prompt)
    text_output = completion.output_text

    try:
        return json.loads(text_output)
    except json.JSONDecodeError:
        return analyze_headlines_with_mock_ai(headlines)


def convert_analysis_to_conflicts(analysis: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert AI analysis output into the project's conflict JSON schema."""

    new_records: list[dict[str, Any]] = []
    for item in analysis:
        if not item.get("is_conflict"):
            continue

        country = item.get("country") or "Unknown"
        slug_country = country.lower().replace(" ", "-")
        digest = hashlib.md5((country + (item.get("description") or "")).encode("utf-8")).hexdigest()[:8]
        record = {
            "id": f"auto-{slug_country}-{date.today()}-{digest}",
            "name": f"Potential escalation in {country}",
            "country": country,
            # Coordinates unknown in headline-only extraction; defaults are placeholders.
            "lat": 0.0,
            "lon": 0.0,
            "start": item.get("possible_start_date") or str(date.today()),
            "end": None,
            "description": item.get("description") or "Auto-detected conflict signal",
        }
        new_records.append(record)

    return new_records


def merge_new_conflicts(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Append only truly new records by id to avoid duplicates."""

    existing_ids = {record["id"] for record in existing}
    merged = existing.copy()
    for record in incoming:
        if record["id"] not in existing_ids:
            merged.append(record)
            existing_ids.add(record["id"])
    return merged


def run_ai_update_pipeline() -> dict[str, Any]:
    """Run full update pipeline and persist changes.

    Steps:
    1. Download headlines.
    2. Analyze with AI or mock mode.
    3. Convert to conflict schema.
    4. Merge into conflicts.json.
    """

    headlines = unique_headlines(download_headlines())
    analysis = analyze_headlines_with_openai(headlines)
    incoming_conflicts = convert_analysis_to_conflicts(analysis)

    existing_conflicts = load_conflicts()
    merged = merge_new_conflicts(existing_conflicts, incoming_conflicts)

    save_json_file(CONFLICTS_FILE, merged)

    return {
        "headlines_processed": len(headlines),
        "detected_conflicts": len(incoming_conflicts),
        "total_conflicts": len(merged),
    }
