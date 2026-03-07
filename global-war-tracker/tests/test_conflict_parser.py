"""Unit tests for conflict parsing and metrics helpers."""

from datetime import date, timedelta
import unittest

from backend.conflict_parser import (
    calculate_days_without_war,
    calculate_total_conflicts_since_1900,
)


class TestCalculateDaysWithoutWar(unittest.TestCase):
    def test_returns_zero_when_any_conflict_active(self) -> None:
        conflicts = [
            {"country": "A", "end": None},
            {"country": "A", "end": "2020-01-01"},
        ]
        self.assertEqual(calculate_days_without_war(conflicts), 0)

    def test_returns_days_since_most_recent_end(self) -> None:
        latest = date.today() - timedelta(days=9)
        older = date.today() - timedelta(days=30)
        conflicts = [
            {"country": "A", "end": older.isoformat()},
            {"country": "B", "end": latest.isoformat()},
        ]
        self.assertEqual(calculate_days_without_war(conflicts), 9)

    def test_country_specific_filtering(self) -> None:
        ended = date.today() - timedelta(days=4)
        conflicts = [
            {"country": "Ukraine", "end": ended.isoformat()},
            {"country": "Syria", "end": None},
        ]
        self.assertEqual(calculate_days_without_war(conflicts, country="Ukraine"), 4)
        self.assertEqual(calculate_days_without_war(conflicts, country="Syria"), 0)


class TestTotalConflictsSince1900(unittest.TestCase):
    def test_counts_unique_ids_across_history_and_conflicts(self) -> None:
        conflicts = [
            {"id": "a", "start": "2020-01-01"},
            {"id": "b", "start": "2021-01-01"},
        ]
        history = [
            {"id": "b", "start": "2021-01-01"},
            {"id": "c", "start": "1950-01-01"},
            {"id": "old", "start": "1890-01-01"},
        ]

        self.assertEqual(calculate_total_conflicts_since_1900(conflicts, history), 3)


if __name__ == "__main__":
    unittest.main()
