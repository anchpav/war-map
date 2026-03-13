"""AI-assisted conflict updater (lightweight + conservative).

This script is intentionally strict and defensive:
- It can read news text from an input file or RSS headlines.
- It asks an AI provider (DeepSeek or Gemini) for strict JSON extraction.
- It validates extracted conflicts against canonical country names from world.geo.json.
- It deduplicates/merges conservatively.
- It writes preview output by default and only overwrites conflicts.json with --apply.
"""

from __future__ import annotations

from argparse import ArgumentParser
from datetime import date
from pathlib import Path
from typing import Any
import json
import os
import re

try:
    import feedparser
except Exception:  # optional for RSS mode
    feedparser = None


ROOT = Path(__file__).resolve().parent.parent
CONFLICTS_FILE = ROOT / "client" / "public" / "data" / "conflicts.json"
SUGGESTED_FILE = ROOT / "client" / "public" / "data" / "conflicts.suggested.json"
WORLD_FILE = ROOT / "client" / "public" / "data" / "world.geo.json"

RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
]

SUPPORTED_PROVIDERS = {"deepseek", "gemini"}
STATUS_VALUES = {"active", "ended", "unknown"}
MIN_CONFIDENCE = 0.80

# Minimal aliases to reduce false negative matches while avoiding fuzzy overreach.
COUNTRY_ALIASES = {
    "us": "United States",
    "u.s.": "United States",
    "usa": "United States",
    "uk": "United Kingdom",
    "russia": "Russia",
    "iran": "Iran",
    "syria": "Syria",
    "palestinian territories": "Palestine",
}


def parse_args() -> Any:
    parser = ArgumentParser(description="AI-assisted update for client/public/data/conflicts.json")
    parser.add_argument("--provider", choices=["deepseek", "gemini"], default=os.getenv("AI_PROVIDER", "deepseek"))
    parser.add_argument("--input", help="Path to a local plain-text news file")
    parser.add_argument("--apply", action="store_true", help="Overwrite conflicts.json (default: preview mode)")
    parser.add_argument("--limit", type=int, default=20, help="Max number of headlines/lines to analyze")
    return parser.parse_args()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)


def load_country_names() -> tuple[list[str], dict[str, str]]:
    world = load_json(WORLD_FILE, {"features": []})
    canonical: list[str] = []

    for feature in world.get("features", []):
        props = feature.get("properties", {})
        name = props.get("ADMIN") or props.get("name")
        if name:
            canonical.append(str(name))

    # Lowercased lookup map for strict exact normalization.
    lookup = {name.lower(): name for name in canonical}
    for alias, target in COUNTRY_ALIASES.items():
        if target.lower() in lookup:
            lookup[alias.lower()] = lookup[target.lower()]

    return canonical, lookup


def normalize_country(value: Any, country_lookup: dict[str, str]) -> str | None:
    if not isinstance(value, str):
        return None

    cleaned = re.sub(r"\s+", " ", value.strip())
    if not cleaned:
        return None

    return country_lookup.get(cleaned.lower())


def load_news_lines(input_path: str | None, limit: int) -> list[str]:
    if input_path:
        path = Path(input_path)
        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {path}")

        lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
        return [line for line in lines if line][:limit]

    headlines: list[str] = []

    if feedparser is None:
        return []

    for feed in RSS_FEEDS:
        try:
            parsed = feedparser.parse(feed)
            for entry in parsed.entries[:limit]:
                title = str(getattr(entry, "title", "")).strip()
                if title:
                    headlines.append(title)
        except Exception:
            continue

    unique: list[str] = []
    seen: set[str] = set()
    for headline in headlines:
        if headline not in seen:
            seen.add(headline)
            unique.append(headline)

    return unique[:limit]


def build_prompt(lines: list[str]) -> str:
    bullets = "\n".join(f"- {line}" for line in lines)
    return f"""
You are a strict information extraction system.

Task: extract only high-confidence interstate or armed conflicts directly supported by the provided text.

Hard safety rules:
- Never invent conflicts.
- Never invent countries.
- Never invent dates.
- If uncertain, return an empty JSON array [].
- Output JSON only (no markdown, no commentary).

Output must be a JSON array of objects with EXACT keys:
country, opponent, date, status, sourceHeadline, confidence

Field rules:
- country: country name exactly as stated or strongly implied
- opponent: country name exactly as stated or strongly implied
- date: ISO date YYYY-MM-DD if present, otherwise null
- status: one of active|ended|unknown
- sourceHeadline: short supporting source text from input
- confidence: number between 0 and 1

Input text:
{bullets}
""".strip()


def call_deepseek(prompt: str) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set")

    import requests

    response = requests.post(
        "https://api.deepseek.com/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "Return strict JSON only."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
        },
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    return str(payload["choices"][0]["message"]["content"])


def call_gemini(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    import requests

    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
        },
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    candidates = payload.get("candidates", [])
    if not candidates:
        return "[]"
    return str(candidates[0]["content"]["parts"][0].get("text", "[]"))


def request_ai_json(provider: str, lines: list[str]) -> str:
    prompt = build_prompt(lines)
    if provider == "deepseek":
        return call_deepseek(prompt)
    if provider == "gemini":
        return call_gemini(prompt)
    raise ValueError(f"Unsupported provider: {provider}")


def parse_ai_json(raw_text: str) -> list[dict[str, Any]]:
    text = raw_text.strip()

    # Defensive cleanup if a model still wraps JSON in code fences.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("AI output is not a JSON array")

    parsed: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            parsed.append(item)
    return parsed


def normalize_status(value: Any) -> str:
    if not isinstance(value, str):
        return "unknown"
    status = value.strip().lower()
    return status if status in STATUS_VALUES else "unknown"


def normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text) else None


def validate_candidates(raw_items: list[dict[str, Any]], country_lookup: dict[str, str]) -> tuple[list[dict[str, Any]], list[str]]:
    valid: list[dict[str, Any]] = []
    logs: list[str] = []

    for index, item in enumerate(raw_items):
        country = normalize_country(item.get("country"), country_lookup)
        opponent = normalize_country(item.get("opponent"), country_lookup)
        confidence = item.get("confidence")

        if country is None or opponent is None:
            logs.append(f"skip[{index}]: country/opponent unrecognized")
            continue
        if country == opponent:
            logs.append(f"skip[{index}]: country equals opponent ({country})")
            continue
        if not isinstance(confidence, (int, float)):
            logs.append(f"skip[{index}]: missing confidence")
            continue
        if float(confidence) < MIN_CONFIDENCE:
            logs.append(f"skip[{index}]: low confidence ({confidence:.2f})")
            continue

        source_headline = item.get("sourceHeadline")
        if not isinstance(source_headline, str) or not source_headline.strip():
            logs.append(f"skip[{index}]: missing source headline")
            continue

        valid.append(
            {
                "country": country,
                "opponent": opponent,
                "date": normalize_date(item.get("date")),
                "status": normalize_status(item.get("status")),
                "sourceHeadline": source_headline.strip(),
                "confidence": round(float(confidence), 3),
            }
        )

    # Deduplicate order-insensitive pairs, keep highest-confidence item.
    dedup: dict[str, dict[str, Any]] = {}
    for item in valid:
        a, b = sorted([item["country"], item["opponent"]])
        key = f"{a}|{b}"
        current = dedup.get(key)
        if current is None or item["confidence"] > current["confidence"]:
            dedup[key] = item

    return list(dedup.values()), logs


def merge_conflicts(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int, int]:
    merged = [dict(item) for item in existing]
    index_by_key: dict[str, int] = {}

    for i, item in enumerate(merged):
        a = str(item.get("country", "")).strip()
        b = str(item.get("opponent", "")).strip()
        if not a or not b:
            continue
        key = "|".join(sorted([a, b]))
        index_by_key[key] = i

    added = 0
    updated = 0

    for item in incoming:
        country = item["country"]
        opponent = item["opponent"]
        key = "|".join(sorted([country, opponent]))

        if key not in index_by_key:
            merged.append(
                {
                    "country": country,
                    "opponent": opponent,
                    "start": item["date"] or str(date.today()),
                    "active": item["status"] != "ended",
                    "sourceHeadline": item["sourceHeadline"],
                    "confidence": item["confidence"],
                }
            )
            index_by_key[key] = len(merged) - 1
            added += 1
            continue

        # Conservative updates for existing rows.
        existing_row = merged[index_by_key[key]]
        changed = False

        if item["confidence"] >= 0.90 and item["date"]:
            current_start = existing_row.get("start")
            if not current_start:
                existing_row["start"] = item["date"]
                changed = True

        if item["confidence"] >= 0.90 and item["status"] == "active" and existing_row.get("active") is False:
            existing_row["active"] = True
            changed = True

        if item["confidence"] >= 0.95 and item["status"] == "ended" and existing_row.get("active") is True:
            existing_row["active"] = False
            changed = True

        if changed:
            existing_row["sourceHeadline"] = item["sourceHeadline"]
            existing_row["confidence"] = item["confidence"]
            updated += 1

    return merged, added, updated


def main() -> None:
    args = parse_args()
    provider = str(args.provider).lower()

    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(f"Invalid provider: {provider}")

    _, country_lookup = load_country_names()
    input_lines = load_news_lines(args.input, args.limit)
    if not input_lines:
        print("No input lines available. Nothing to process.")
        return

    raw_json_text = request_ai_json(provider, input_lines)

    try:
        raw_items = parse_ai_json(raw_json_text)
    except Exception as exc:
        raise RuntimeError(f"Failed to parse AI JSON output strictly: {exc}") from exc

    validated, logs = validate_candidates(raw_items, country_lookup)
    existing = load_json(CONFLICTS_FILE, [])
    if not isinstance(existing, list):
        raise ValueError("conflicts.json must contain a JSON array")

    merged, added, updated = merge_conflicts(existing, validated)

    output_file = CONFLICTS_FILE if args.apply else SUGGESTED_FILE
    save_json(output_file, merged)

    print(f"Provider: {provider}")
    print(f"Input lines: {len(input_lines)}")
    print(f"AI candidates: {len(raw_items)}")
    print(f"Validated candidates: {len(validated)}")
    print(f"Added: {added} | Updated: {updated}")
    print(f"Output written: {output_file}")

    if logs:
        print("\nValidation skips:")
        for line in logs:
            print(f"- {line}")


if __name__ == "__main__":
    main()
