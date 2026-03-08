"""Minimal conflict updater script.

- Downloads RSS headlines.
- Extracts country pairs with simple keyword rules.
- Updates client/public/data/conflicts.json.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
import json
import re

import feedparser
import requests

ROOT = Path(__file__).resolve().parent.parent
CONFLICTS_FILE = ROOT / "client" / "public" / "data" / "conflicts.json"
WORLD_FILE = ROOT / "client" / "public" / "data" / "world.geo.json"

RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
]

KEYWORDS = ["war", "conflict", "invasion", "missile", "strike", "clash"]


def load_country_names() -> list[str]:
    with WORLD_FILE.open("r", encoding="utf-8") as file:
        world = json.load(file)

    names = []
    for feature in world.get("features", []):
        props = feature.get("properties", {})
        name = props.get("ADMIN") or props.get("name")
        if name:
            names.append(str(name))
    return names


def download_headlines() -> list[str]:
    headlines: list[str] = []
    for feed in RSS_FEEDS:
        try:
            # Simple network check before feedparser parse.
            requests.get(feed, timeout=10)
            parsed = feedparser.parse(feed)
            for entry in parsed.entries[:20]:
                title = str(getattr(entry, "title", "")).strip()
                if title:
                    headlines.append(title)
        except Exception:
            continue
    return headlines


def detect_pairs(headlines: list[str], countries: list[str]) -> list[dict[str, object]]:
    found: list[dict[str, object]] = []
    for headline in headlines:
        low = headline.lower()
        if not any(keyword in low for keyword in KEYWORDS):
            continue

        matched = [country for country in countries if country.lower() in low]
        if len(matched) < 2:
            continue

        pair = {
            "country": matched[0],
            "opponent": matched[1],
            "start": str(date.today()),
            "active": True,
        }
        found.append(pair)

    # Deduplicate by pair order.
    unique: dict[str, dict[str, object]] = {}
    for item in found:
        key = f"{item['country']}|{item['opponent']}"
        unique[key] = item
    return list(unique.values())


def main() -> None:
    existing = []
    if CONFLICTS_FILE.exists():
        with CONFLICTS_FILE.open("r", encoding="utf-8") as file:
            existing = json.load(file)

    countries = load_country_names()
    headlines = download_headlines()
    detected = detect_pairs(headlines, countries)

    merged = existing.copy()
    seen = {f"{item.get('country')}|{item.get('opponent')}" for item in existing}
    for item in detected:
        key = f"{item['country']}|{item['opponent']}"
        if key not in seen:
            merged.append(item)
            seen.add(key)

    with CONFLICTS_FILE.open("w", encoding="utf-8") as file:
        json.dump(merged, file, indent=2, ensure_ascii=False)

    print(f"Headlines: {len(headlines)} | New conflicts: {len(merged) - len(existing)} | Total: {len(merged)}")


if __name__ == "__main__":
    main()
