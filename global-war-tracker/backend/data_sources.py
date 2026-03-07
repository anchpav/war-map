"""Data source adapters for conflict headlines.

Local-first approach:
- Tries RSS feeds when internet is available.
- Falls back to bundled sample headlines for deterministic local testing.
"""

from __future__ import annotations

from typing import Iterable
import re

# feedparser is optional; app still runs without it in offline/demo mode.
try:
    import feedparser  # type: ignore
except Exception:  # pragma: no cover - optional dependency fallback
    feedparser = None


DEFAULT_RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
]

# Deterministic fallback data so the project always works locally.
MOCK_HEADLINES = [
    "Missile attack reported near key border city as ceasefire fails",
    "Government announces military strike after armed clash in northern region",
    "Peace talks continue with no signs of invasion in neighboring state",
    "Aid convoys delayed after war escalates around contested province",
]


def normalize_text(text: str) -> str:
    """Compact and normalize headline text for easier AI / rule parsing."""

    return re.sub(r"\s+", " ", text).strip()


def download_headlines(limit_per_feed: int = 10) -> list[str]:
    """Download latest headlines from RSS feeds.

    If RSS parsing is unavailable or feeds fail, return local mock headlines.
    This ensures offline-first behavior and makes testing reliable.
    """

    if not feedparser:
        return MOCK_HEADLINES.copy()

    headlines: list[str] = []
    for feed_url in DEFAULT_RSS_FEEDS:
        try:
            parsed = feedparser.parse(feed_url)
            entries = parsed.entries[:limit_per_feed]
            for entry in entries:
                title = normalize_text(getattr(entry, "title", ""))
                if title:
                    headlines.append(title)
        except Exception:
            # Ignore per-feed errors; continue collecting what we can.
            continue

    return headlines if headlines else MOCK_HEADLINES.copy()


def unique_headlines(headlines: Iterable[str]) -> list[str]:
    """Remove duplicates while preserving order for stable processing."""

    seen: set[str] = set()
    result: list[str] = []
    for headline in headlines:
        if headline not in seen:
            seen.add(headline)
            result.append(headline)
    return result
