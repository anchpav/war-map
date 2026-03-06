"""Utility functions for loading, validating, and analyzing conflict data.

This module is intentionally very explicit and heavily commented so beginners can
follow every step and extend it later.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Optional
import json


@dataclass
class Conflict:
    """Strongly typed representation of a single conflict record."""

    id: str
    name: str
    country: str
    lat: float
    lon: float
    start: str
    end: Optional[str]
    description: str


# Resolve data directory relative to this file so the module works from any cwd.
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CONFLICTS_FILE = DATA_DIR / "conflicts.json"
HISTORY_FILE = DATA_DIR / "history_1900.json"


def load_json_file(path: Path) -> list[dict]:
    """Load a JSON array from disk.

    Why this function exists:
    - Centralizing file loading keeps I/O behavior consistent.
    - It makes error handling clearer for students reading the project.
    """

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json_file(path: Path, records: Iterable[dict]) -> None:
    """Persist records to disk in readable JSON format.

    Why indentation is used:
    - Humans can inspect and edit the file easily during local-first development.
    """

    with path.open("w", encoding="utf-8") as file:
        json.dump(list(records), file, indent=2, ensure_ascii=False)


def load_conflicts() -> list[dict]:
    """Load active + recent conflict records used by the dashboard map."""

    return load_json_file(CONFLICTS_FILE)


def load_history() -> list[dict]:
    """Load long-term historical conflict records since 1900."""

    return load_json_file(HISTORY_FILE)


def parse_date(value: Optional[str]) -> Optional[date]:
    """Convert date strings (YYYY-MM-DD) into ``date`` objects.

    Returns ``None`` when the date is absent. This supports active conflicts
    where ``end`` is intentionally null.
    """

    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def calculate_days_without_war(conflicts: list[dict], country: Optional[str] = None) -> int:
    """Calculate days since the last conflict ended.

    Rules implemented exactly as requested:
    1. If any conflict is active (``end`` is null), return 0.
    2. Otherwise find the newest end date.
    3. Return days from that date to today.

    Optional country filtering is supported for country-specific analytics.
    """

    # Apply optional country filter before any calculations.
    if country:
        filtered = [c for c in conflicts if c.get("country", "").lower() == country.lower()]
    else:
        filtered = conflicts

    if not filtered:
        return 0

    # If at least one conflict is ongoing, the world/country is not currently at peace.
    if any(record.get("end") is None for record in filtered):
        return 0

    end_dates = [parse_date(record.get("end")) for record in filtered]
    concrete_end_dates = [d for d in end_dates if d is not None]

    if not concrete_end_dates:
        return 0

    most_recent_end = max(concrete_end_dates)
    return (date.today() - most_recent_end).days


def calculate_global_tension_index(conflicts: list[dict], history: list[dict]) -> float:
    """Compute a simple, explainable Global Military Tension Index.

    Formula (0-100 scale, clamped):
    - Active conflicts have high weight (6 points each).
    - Recent conflicts ended within 5 years add medium weight (3 points each).
    - Historical memory adds small background pressure (history_count / 20).

    This is intentionally simple so teams can swap in more advanced models later.
    """

    today = date.today()
    active = sum(1 for c in conflicts if c.get("end") is None)

    recent = 0
    for record in conflicts:
        end_date = parse_date(record.get("end"))
        if end_date and (today - end_date).days <= (5 * 365):
            recent += 1

    raw_score = (active * 6) + (recent * 3) + (len(history) / 20)
    return round(min(raw_score, 100), 2)
