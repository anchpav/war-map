"""Data access and metrics logic for the minimal Global War Tracker MVP.

This module intentionally keeps logic simple and explicit so it is easy to read
and extend for beginners.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Optional
import json

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CONFLICTS_FILE = DATA_DIR / "conflicts.json"


def load_conflicts() -> list[dict]:
    """Load conflict records from local JSON file."""

    with CONFLICTS_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def parse_date(value: Optional[str]) -> Optional[date]:
    """Parse YYYY-MM-DD string into ``date`` or return None."""

    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def filter_by_country(conflicts: list[dict], country: Optional[str]) -> list[dict]:
    """Filter records where selected country is either side of the conflict."""

    if not country:
        return conflicts

    country_lower = country.lower()
    return [
        row
        for row in conflicts
        if str(row.get("country", "")).lower() == country_lower
        or str(row.get("opponent", "")).lower() == country_lower
    ]


def get_active_conflicts(conflicts: list[dict], country: Optional[str] = None) -> list[dict]:
    """Return active conflicts (where end is null), optionally country-scoped."""

    scoped = filter_by_country(conflicts, country)
    return [row for row in scoped if row.get("end") is None]


def calculate_days_without_war(conflicts: list[dict], country: Optional[str] = None) -> int:
    """Calculate days without war globally or for selected country.

    Rules:
    - If at least one active conflict exists in scope, return 0.
    - Else return days since most recent end date in scope.
    """

    scoped = filter_by_country(conflicts, country)
    if not scoped:
        return 0

    if any(row.get("end") is None for row in scoped):
        return 0

    ended = [parse_date(row.get("end")) for row in scoped]
    ended = [d for d in ended if d is not None]
    if not ended:
        return 0

    return (date.today() - max(ended)).days
